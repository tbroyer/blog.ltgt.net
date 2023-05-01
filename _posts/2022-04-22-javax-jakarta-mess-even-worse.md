---
layout: post
title: The Javax → Jakarta mess, it's even worse than I thought
discuss_url: https://dev.to/tbroyer/the-javax-to-jakarta-mess-its-even-worse-than-i-thought-54ag/comments
---

In the [previous post]({% post_url 2022-04-18-javax-jakarta-mess-and-gradle-solution %} "The Javax → Jakarta mess, and a Gradle solution"), I described how the Javax to Jakarta migration was a mess, but doing more research on the subject I discovered that it's actually way worse than that.

<ins datetime="2022-11-18">**EDIT(2022-11-18):** There's a new/updated Gradle plugin to help us, and Spring 6 uses Jakarta EE 9 as a baseline. Continue reading for details.</ins>

## Wait, how could it be worse‽

Until now, I focused on APIs, but what I forgot about were implementations. I didn't really forgot about them, as they were partly what led me to do the research to begin with, but I forgot about how you may want to have implementations for both Java EE and Jakarta EE 9+ at the same time.

The case that got me looking at the subject was a combination of Resteasy, jOOQ, and Sentry-Java. Resteasy and Sentry-Java both require a Servlet implementation (I'm using an embedded Jetty server, but I could have picked Tomcat or Undertow). Resteasy and jOOQ both depend on XML Binding. Resteasy and jOOQ (and Pac4j and Jackson, that I also use) actually maintain two parallel versions, comptible with either Java EE 8 or Jakarta EE 9 (and in the case of jOOQ at least, they're not really _parallel_, it's more that the previous version is kept _perfused_ with all the bugfixes being backported, but the featureset of the Java EE 8 compatible version is not the same as of the Jakarta EE 9 compatible one). Sentry-Java on the other side is only compatible with the `javax.` flavor of Servlets. What this means is that I had to choose between using the _older_ versions of Resteasy and jOOQ, or forking Sentry-Java to bring it to Jakarta EE 9 (this is what I ended up doing, as it's only 3 classes). And of course I discovered the problem totally _by accident_, looking the results of a `./gradlew dependencies` where I had the _older_ version of Resteasy but the latest version of jOOQ, and noting that the `jakarta.xml.bind:jakarta.xml.bind-api` transitive dependency of Resteasy was being upgraded to 3.0.0 because of jOOQ.

If it was only a matter of waiting for everyone to provide a Jakarta EE compatible version, it could possibly be workable, although it would take years and some companies don't have incentives in such upgrades (anyone knows when Guice, or Dagger, will move to `jakarta.inject`? fortunately I don't use anything that _depends_ on Dependency Injection, so I can live very well with `javax.inject` alongside everything `jakarta.*`, and that's indeed what I'm currently doing).

No, what I had totally forgotten actually were reference implementations, and specifically (in my case) for Mail. Many EE APIs are frameworks (Servlets, REST) where you **have** to pick one flavor and one implementation anyway: you wouldn't use Java EE Servlets within a Jakarta EE Servlet container, just like you wouldn't use Vert.x handlers in such container either, or a Spring Web resource within Resteasy or Jersey, and you wouldn't use Resteasy and Jersey at the same time either. But Mail is different, it's a library that you use to send mails, and because it knows how to parse multipart content, it can be used transitively by other libraries that you'll depend on (honestly, I don't think that will be the case for me, fortunately).

So you may want or need to use both JavaMail and Jakarta Mail at the same time. And [it happens](https://github.com/eclipse-ee4j/mail/issues/527 '"Using Jakarta mail and Javamail in the same runtime" issue in the Jakarta Mail bug tracker') that this is not possible, because Jakarta EE decided to keep using the `com.sun.mail.*` package names while migrating to Jakarta EE 9 APIs. Note that those exact same class names are actually published at separate Maven coordinates, similar to the Java EE 8 vs. Jakarta EE 8, but this time it extends to the whole Jakarta EE irrespective of the version (and to make the matter worse, they changed the Maven coordinates again for Jakarta EE 10: from `com.sun.mail:javax.mail` to `com.sun.mail:jakarta.mail` to `org.eclipse.angus:jakarta.mail` ; oh, and they reset the versioning scheme, so you also have to somehow guess that Angus Mail 1.0.0 is Jakarta Mail 2.1)

It's as if everything was deliberately made to make the migration as painful as possible, and specifically make it impossible (or at the very least make zero effort to make it possible) to have both Java EE and Jakarta EE in the same project, for no technical reason (besides we'll only have to search/replace `javax.` with `jakarta.`, and nothing else, which you'll convene is rather weak an argument).

![Lieutenant Columbo saying “Just one more thing”](/image/2022/04/one_more_thing_columbo.png)

Another thing I had totally forgotten, was Java EE's _tradition_ to publish API jars that are only good to compile against, and then reference implementations that **also** contain the API classes, but this time with actual code in the methods (this is also why you have EE vendor flavors of them by the way, because they have to change one constant somewhere to point to their actual implementation class).

This means that `com.sun.mail:javax.mail` contains the same classes as `javax.mail:javax.mail-api`. And because they apparently always have to complicate things, this JAR is also a _bundle_ of `mailapi` (that still also contains the API classes), `smtp`, `imap` and `pop3`. Jakarta EE 9 followed the exact same layout, except for the `javax` to `jakarta` renaming (but keeping the `com.sun.mail` package names though, remember?) Angus Mail (the Jakarta EE 10 reference implementation) doesn't depart from that tradition and also provides `org.eclipse.angus:jakarta.mail` as a _bundle_ of both `org.eclipse.angus:angus-mail` and `jakarta.mail:jakarta.mail-api` (but this time it seems like `jakarta.mail:jakarta.mail-api` contains _normal_ classes, not a version stripped out of the methods' code to keep only the ABI), and `org.eclipse.angus:angus-mail` is a _bundle_ of `angus-core`, `image`, `smtp`, `pop3`, and `logging-mailhandler`.

It's also been a _tradition_ to have JARs bundling **all** the EE APIs together: `javax.javaee-web-api` and `javax:javaee-api`, respectively `jakarta.platform:jakartaee-web-api` and `jakarta.platform:jakartaee-api` (fortunately, they now also publish a `jakarta.platform:jakartaee-bom` that simply _references_ the other Maven artifacts rather than _bundling_ them in a fat jar).

Don't get me wrong, it's OK to build such JARs for people who don't use Maven or Maven-compatible dependency resolvers ; what is **not** OK is to publish them to the Central Repository with their **own** Maven coordinates (did you keep count of how many JARs contained `javax.mail.*` or `jakarta.mail.*` classes and how many contained `com.sun.mail.*` classes?)

## OK, so it's indeed way worse, but we have Gradle our savior, right?

Gradle can help indeed: we can teach it to fail the build if we ever have conflicting JARs in our classpaths, but there are cases that don't have a clean solution besides picking one side and _rewriting_ everything to either `javax` or `jakarta`.

### Detecting more conflicts

Using the same kind of component metadata rules as in our previous installment, we'd be able to teach Gradle that:
* `javax.mail:javax.mail-api`, `com.sun.mail:javax.mail`, and `com.sun.mail:mailapi` (in version 1) are incompatible as they all contain `javax.mail.*` classes
* `com.sun.mail:javax.mail` is incompatible with `com.sun.mail:mailapi`, `com.sun.mail:smtp`, `com.sun.mail:imap`, and `com.sun.mail:pop3` as it's a bundle of those 4 JARs (it provides all the same capabilities than each one of them taken individually), same for `com.sun.mail:jakarta.mail`
* `jakarta.mail:jakarta.mail-api`, `com.sun.mail:jakarta.mail`, `com.sun.mail:mailapi` (in version 2), and `org.eclipse.angus:jakarta.mail` are incompatible as they all contain `jakarta.mail.*` classes (and note that Angus Mail doesn't use the same versioning scheme, because it wasn't complicated enough)
* `org.eclipse.angus:jakarta.mail` and `org.eclipse.angus:angus-mail` are incompatible with their subsets
* `org.eclipse.angus` artifacts are incompatible with their `com.sun.mail` counterparts (and again beware of the new versioning scheme)
* `com.sun.mail` artifacts in version 1 shouldn't be upgraded to version 2

(and I hope I haven't missed more cases‼)

### Rewriting things?

There are tools to rewrite JARs and classes, the most complete probably being [Eclipse Transformer](https://github.com/eclipse/transformer), that is apparently used by the Payara application server to rewrite EARs dynamically at deployment time.

There's a [Gradle plugin](https://github.com/hibernate/jakarta-transformer-plugin/ "JakartaTransformer Gradle plugin") by Hibernate, but it's not much documented and it looks like Hibernate didn't even use it in their migration. The plugin seems to be tailored to creating JARs to be deployed (historically, the `*-jakarta` Hibernate JARS, even though there were made without the plugin as far as I can tell), not for rewriting those dependencies that you might be using.

To rewrite your dependencies, you could theoretically use an [artifact transform](https://docs.gradle.org/current/userguide/artifact_transforms.html '"Transforming dependency artifacts on resolution" chapter in the Gradle User Guide'). Registering it would probably require either identifying the dependencies that need rewriting (by way of _attributes_), or apply it to each and every dependency (by adding said attribute to all variants of all components). That mess was decided years ago, we should be passed the point where someone already packaged it so you only have to apply one Gradle plugin and it Just Works™, but the community seems to have decided that we should all suffer this mess and wait for every library you depend on to have migrated, and in the mean time be locked with older versions, possibly unmaintained, of your other dependencies.

Note that this rewriting wouldn't magically solve all your problems: you'd still have to have capabilities rule to prevent having several components with different Maven coordinates provide the same package names (including after the rewriting), but this time maybe resolve the conflicts automatically to pick the highest Jakarta EE version.

## So what now?

Honestly, I'm fed up.

<del datetime="2022-11-18">Maybe I'll try to make a plugin with all these rules (or contribute them to Jendrik Johannes' [Java Ecosystem Capabilities Gradle Plugin](https://github.com/jjohannes/java-ecosystem-capabilities)) so at least I can verify that I don't have issues. If anyone would like to help create a list of all the conflicts (including the vendor libraries), get in touch (but I don't promise anything).</del>

<ins datetime="2022-11-18">**UPDATE(2022-11-18):** the [GradleX plugin](https://github.com/gradlex-org/java-ecosystem-capabilities) now has most of those rules, at least for the official Java EE/Jakarta EE artifacts, i.e. not the Jetty, Tomcat or Glassfish flavors. See also [this comment](https://github.com/gradlex-org/java-ecosystem-capabilities/issues/6#issuecomment-1311312175) for current limitations; specifically it won't downgrade Jakarta EE 8 to Java EE 8, so Jakarta EE 9 dependencies might upgrade them and break things at runtime.</ins>

But for the rest, the best thing to do is probably to poke at project maintainers so they do the upgrade and/or provide parallel flavors (possibly helped by the Eclipse Transformer, and by yourself: please don't be assholes with open source maintainers, lend them a hand or sponsor them).

<ins datetime="2022-11-18">**UPDATE(2022-11-18):** Spring Framework 6 has been released that uses Jakarta EE 9 as a baseline. This will undoubtedly drive adoption of the `jakarta.*` namespace, but not all projects have an interest in such combination (e.g. Guice [[tracking issue](https://github.com/google/guice/issues/1383)] and Dagger [[tracking issue](https://github.com/google/dagger/issues/2058)] will likely stay with `javax.inject` for a good while, and Guice Servlets with `javax.servlet` [[tracking issue](https://github.com/google/guice/issues/1490)]).</ins>

And maybe in the future I won't use "standard APIs" as often as I used to: I'd rather have libraries that don't know how to talk to each other, and write some glue code, than libraries you cannot even put in the same classpath. So maybe I'll try alternatives to Servlets and/or Jakarta RS, trying to minimize my dependency on them through clear segregation (already what I'm doing mostly, where the Jakarta RS endpoints only _translate_ the HTTP request to a business-oriented service, and translate the result back to an HTTP response), such that rewriting the Web layer/adapter would indeed be costly, but entirely doable. I'm glad I never actually tried to use `javax.json` for instance, similar to how I already ditched `javax.ws.rs.client` for OkHttp a few years ago.

Theoretically, I could also embrace the Java Module System (JPMS), as it's good to detect duplicate packages and missing dependencies (e.g. when Jakarta EE 8 is upgraded to Jakarta EE 9, assuming a change in module name), but it's a whole other mess as it adds yet another naming scheme. Just as an example, the JBoss version of Jakarta RS 3.0 is still using the `java.ws.rs` module name rather than `jakarta.ws.rs`, and Jetty's version of Jakarta Servlet 5.0 is using `jetty.servlet.api` rather than `jakarta.servlet`, Jakarta EE 8 dependencies themselves have sometimes switched module name during patch releases; this means that you cannot just swap one JAR for another as the JVM will then complain that some `requires` is not fulfilled. Not to mention that many JARs still aren't compatible with JPMS, with not even an `Automatic-Module-Name`: Resteasy 6 and Sentry-Java for instance, and some Java EE dependencies too (e.g. `javax.inject:javax.inject`) so downgrading Jakarta EE 8 to Java EE 8 is not without problems either. That would probably deserve a third post, but for my sanity I'd rather wait a couple years 😁
