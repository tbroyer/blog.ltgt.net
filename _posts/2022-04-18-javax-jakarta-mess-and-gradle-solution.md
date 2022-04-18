---
layout: post
title: The Javax → Jakarta mess, and a Gradle solution
discuss_url: https://dev.to/tbroyer/the-javax-jakarta-mess-and-a-gradle-solution-3c44
---

Nearly five years ago, Oracle was preparing the release of Java EE 8
and [announced](https://blogs.oracle.com/theaquarium/post/opening-up-java-ee "Opening Up Java EE, on Oracle The Aquarium Blob") that it would move it to an open source foundation.
Less a month later, they [announced](https://blogs.oracle.com/theaquarium/post/opening-up-java-ee-an-update "Opening Up Java EE - An Update, on Oracle The Aquarium Blob") they selected the Eclipse Foundation for that work.
Two years later, Jakarta EE 8 was [released](https://jakarta.ee/news/jakarta-ee-8-released/ "Jakarta EE 8 Press Release") as fully compatible version of Java EE 8.
The only thing that changed in that period was about migrating the process to the Eclipse Foundation and Jakarta EE Working Group.

According to [this article](https://blogs.oracle.com/javamagazine/post/transition-from-java-ee-to-jakarta-ee "Transition from Java EE to Jakarta EE, on Java Magazine"),
the source code was exactly the same, except for some additional commits maybe because Oracle transfered the head of the _master_ branches of Git repositories,
and the artifacts got released twice as milestones of the transfer process:
first proving that the code could be built, then a less technical but more procedural release where the Java EE name was replaced by Jakarta EE in javadocs (of course this also means different terms and conditions).

Then fifty months after that, Jakarta EE 9 was [released](https://jakarta.ee/news/jakarta-ee-9-released/ "Jakarta EE 9 Press Release") with only two major changes:
* the package names were all migrated from `javax.*` to `jakarta.*`
* some older specifications were pruned

## But you talked about a mess‽

Yes, Oracle being Oracle, they transfered the technology and documentation, but not the name and trademark.
Indeed, Java EE was renamed to Jakarta EE.
But that's not all, they also prohibited any modification to the `javax.*` packages,
so everything would eventually be moved new packages.
The Eclipse Foundation [presented it](https://eclipse-foundation.blog/2019/05/03/jakarta-ee-java-trademarks/ "Update on Jakarta EE Rights to Java Trademarks, on the Eclipse Foundation blog") as what Eclipse and Oracle had agreed on
but let's not be fooled by that PR wording:
what would you expect from the company that almost ruined our whole industry with the trial against Google over Android?

That's only part of the problem though.
We could have had `javax.*` artifacts (I'm talking about Maven coordinates here) using the `javax.*` package names,
and `jakarta.*` artifacts using the `jakarta.*` package names,
and while this big breaking change would have had a years-long impact,
it would have been somewhat manageable
(we're right into it now actually, with many projects maintaining two branches, one for each package namespace).

But the Jakarta Working Group decided to publish Jakarta EE 8 under the same Maven coordinates as what they expected to publish later Jakarta EE versions.
I have no idea if they were somehow _forced_ to publish those at all (or could have possibly kept them into their own repository),
but they could have at least used specific Maven coordinates,
as they already knew at that point that this would happen:
Oracle _froze_ the `javax.*` package name in May 2019,
while Jakarta EE 8 came out four months later in September 2019.
I have no idea how much Jakarta Working Group members were aware of [this decision](https://jakewharton.com/java-interoperability-policy-for-major-version-updates/ "Java Interoperability Policy for Major Version Updates, on Jake Wharton's blog") by Square, Inc.
to version their Maven coordinates and package names when releasing versions with major breaking changes,
back in December 2015 (but the problem itself was nothing new);
but the decision to publish `javax.*` and later `jakarta.*` packages under the same Maven coordinates was hugely misguided,
and possibly the worst mistake in all this story.

## What does this mean in practice?

First, when there was only Jakarta EE 8, you could have had (transitive) dependencies on both Java EE 8 (or earlier) and Jakarta EE 8.
This would cause duplicates of the `javax.*` classes in the classpath,
because dependency managers aren't told that those artifacts are actually the same but renamed.
If you had an older Java EE artifact on the classpath,
it could also _shadow_ the newer Jakarta EE,
causing breakages at compile-time or, worse, at runtime.

But now that there's also Jakarta EE 9 (and 9.1, and very soon Jakarta EE 10), you could have Jakarta EE 8 artifacts being _upgraded_ to Jakarta EE 9 despite being a completely incompatible API.

In [their newsletter](https://www.eclipse.org/community/eclipse_newsletter/2020/november/1.php "Understanding Jakarta EE 9, Eclipse Newsletter") just before the Jakarta EE 9 release,
Eclipse acknowledged the practical issues it caused,
inviting people to actually depend on Java EE 8 artifacts rather than Jakarta EE 8 ones,
but this came **way** too late, the harm had been done already.

In retrospect, we could say that nobody should have dependended upon Jakarta EE 8 artifacts,
or they should have used version ranges to exclude the next major version
(but version ranges are bad for build reproducibility, unless you use a dependency manager that somehow supports version locking).

## Oh wow! Ok, but you hinted at a Gradle solution?

Yes, this is where Gradle really shines compared to many other dependency managers:
it lets you hook into the dependency resolution process and _fix_ many things.

With Maven for instance, you could use the [Maven Enforcer Plugin](https://maven.apache.org/enforcer/maven-enforcer-plugin/) with [Mojohaus "ban duplicate classes" rule](https://www.mojohaus.org/extra-enforcer-rules/banDuplicateClasses.html, '"Ban duplicate classes" rule, in Mojohaus Extra Enforcer Rules') to detect the Java EE vs Jakarta EE 8 issue,
or the [built-in "dependency convergence" rule](https://maven.apache.org/enforcer/enforcer-rules/dependencyConvergence.html '"Dependency convergence" rule, in Maven Enforcer Plugin built-in rules')
and you would have to resolve it yourself through [dependency exclusions](https://maven.apache.org/pom.html#Exclusions "Dependency Exclusions, in Maven POM Reference") everywhere needed,
(and because the "dependency convergence" rule isn't configurable, you cannot enable it only for the Jakarta EE dependencies, so it has a huge impact).
By the way, if you look at how the "dependency convergence" rule is implemented,
you'll see that it will actually resolve the dependency once again so it can get to the dependency details,
I don't think you can peek into, and influence the dependency resolution process itself.

With Gradle, we can do two things:
* declare that Java EE and Jakarta EE 8 are actually the same thing under a different name
* _fix_ third-parties' dependencies on Jakarta EE 8 to reject any upgrade to Jakarta EE 9+ (Gradle also has the equivalent to Maven's "dependency convergence" rule through [`failOnVersionConflict()`](https://docs.gradle.org/current/userguide/resolution_strategy_tuning.html#fail-version-conflict "Failing on version conflict, in the Preventing accidental dependency upgrades chapter of the Gradle User Guide"))

This would fail the build the same way as with Maven,
but Gradle also allows us to automatically fix those:
because Jakarta EE 8 artifacts are fully compatible with Java EE 8 ones,
we could rewrite third-parties' dependencies to actually use Java EE 8 rather than Jakarta EE 8.

### Declaring that Java EE and Jakarta EE 8 are equivalent

To declare that Jakarta EE 8 replaced Java EE, we could use a [module replacement rule](https://docs.gradle.org/current/userguide/resolution_rules.html#sec:module_replacement),
but this would also say that Jakarta EE 9 replaced Java EE, which is not actually true:
there's no real problem having both Java EE 8 (`javax.*` package) and Jakarta EE 9 (`jakarta.*` package) in the same classpath.

So we'd rather [declare](https://docs.gradle.org/current/userguide/component_metadata_rules.html#adding_missing_capabilities_to_detect_conflicts "Adding missing capabilities to detect conflicts, in the Fixing metadata with component metadata rules chapter of the Gradle User Guide") that Jakarta EE 8 artifacts (and only those) provide the same [_capabilities_](https://docs.gradle.org/current/userguide/dependency_capability_conflict.html) as their Java EE counterparts.

For XML Binding for instance (which also changed name from JAXB), this would look something like this:

```kotlin
components {
    withModule("jakarta.xml.bind:jakarta.xml.bind-api") {
        if (id.version.startsWith("2.")) {
            allVariants {
                withCapabilities {
                    addCapability("javax.xml.bind", "jaxb-api", id.version)
                }
            }
        }
    }
}
```

With that rule,
* you can have `javax.xml.bind:jaxb-api` in any version (Java EE) and `jakarta.xml.bind:jakarta-xml.bind-api:3.0.0` or a later version (Jakarta EE 9+)) without error, but
* you cannot have `javax.xml.bind:jaxb-api` and `jakarta.xml.bind:jakarta-xml.bind-api:2.3.3` (Jakarta EE 8).

If we have such a conflict, Gradle will allow us to resolve it using a rule too, rather than having to play with exclusions which are a <abbr title="Pain In The Ass">PITA</abbr> to maintain in the long run.
Let's first continue to detect the problems.

### Reject upgrades of Jakarta EE 8 to Jakarta EE 9+

Rejecting such upgrades, within the same coordinates, is not as easy.

As we've seen above, we could retrospectively say that the dependencies should have originally been declared to reject them, but that's never the case in practice.
Fortunately, Gradle allows us to [_fix_ those declarations](https://docs.gradle.org/current/userguide/component_metadata_rules.html#fixing_wrong_dependency_details "Fixing wrong dependency details, in the Fixing metadata with component metadata rules chapter of the Gradle User Guide") at resolution time:

```kotlin
components {
    all {
        allVariants {
            withDependencies {
                val dep = find {
                    it.group == "jakarta.xml.bind" &&
                    it.name == "jakarta.xml.bind-api" &&
                    it.versionConstraint.includesMajor("2")
                }
                if (dep != null) {
                    dep.version { reject("[3,)") }
                }
            }
        }
    }
}
```
The `includesMajor` here would be a Kotlin extension function doing the check on the version, which has to deal with Gradle's [_rich versions_](https://docs.gradle.org/current/userguide/rich_versions.html) including version ranges for instance.
The simplest implementation would only look at the _required version_,
which is what a simple version in a Maven POM would map to:
```kotlin
fun VersionConstraint.includesMajor(major: String) =
    requiredVersion.startsWith("${major}.")
```

### Resolving the Java EE / Jakarta EE 8 conflicts

We've used a _capability_ to make them _incompatible_ with one another,
but this will _only_ fail the build if such a thing arise.
We then have to use a [capabilities resolution rule](https://docs.gradle.org/current/userguide/dependency_capability_conflict.html#sub:selecting-between-candidates "Selecting between candidates, in the Handling mutually exclusive dependencies chapter of the Gradle User Guide") to select between them.

Because we declared the capability only on Jakarta EE 8, we can safely use `selectHighestVersion()` to pick the Jakarta EE 8.

Why safely? Because this is evaluated after versions are mediated.
What this means is that if you have all three of `javax.xml.bind:jaxb-api:2.3.1` (Java EE 8), `jakarta.xml.bind:jakarta.xml.bind-api:2.3.3` (Jakarta EE 8), and `jakarta.xml.bind:jakarta.xml.bind-api:3.0.0` (Jakarta EE 9),
then Gradle will first upgrade the Jakarta EE dependency to Jakarta EE 9,
which will _remove_ Jakarta EE 8 from the equation, and at the same time the capability conflict, leaving the Java EE 8 and Jakarta EE 9.
In this case, because Java EE 8 and Jakarta EE 8 are fully compatible, this is not a problem at all;
it would be though if we had a dependency on an older version of Java EE,
as this could break compatibility for the library that depends on Jakarta EE 8.
Anyway, all of this won't happen because we _also_ made it so that the Jakarta EE 8 dependency won't be upgraded to Jakarta EE 9 or later.

To look at the whole picture, if you only had the Java EE (any version) and Jakarta EE 8 dependencies,
then the conflict would be on the `javax.xml.bind:jaxb-api:2.3.1` and `javax.xml.bind:jaxb-api:2.3.3` capabilities
(Gradle capabilities follow the same naming rules as Maven coordinates, with a group, a name and a version)
so with `selectHighestVersion()` the `2.3.3` capability would be selected,
hence the Jakarta EE artifact.
In other words, the Java EE 8 would be upgraded to Jakarta EE 8.
This works because they kept Jakarta EE versions increasing after Java EE ones, and we declared the capability using that version.

### Resolving the Jakarta EE 8 / Jakarta EE 9+ conflicts

Because we know that Java EE 8 and Jakarta EE 8 are fully compatible with one another,
the solution here will be to actually _downgrade_ Jakarta EE 8 to Java EE 8.

We'll thus replace the rule we added above that would reject the upgrade to Jakarta EE 9+,
with a similar one that actually downgrades to Java EE 8.

```kotlin
components {
    all {
        allVariants {
            withDependencies {
                val found = removeIf {
                    it.group == "jakarta.xml.bind" &&
                    it.name == "jakarta.xml.bind-api" &&
                    it.versionConstraint.includesMajor("2")
                }
                if (found) {
                    add("javax.xml.bind:jaxb-api:2.3.1")
                }
            }
        }
    }
}
```
Note that we might want to actually conserve the attributes when replacing the dependency that way (or maybe not, I haven't thought about it much yet).

Such a rule actually trumps all our previous attempts:
* if we replace Jakarta EE 8 with Java EE 8, we no longer have to detect when both are present, even less so resolve any such conflict; and
* because Jakarta EE 8 has been replaced, we no longer have to reject upgrading it to Jakarta EE 9 either.

We can still keep those rules _just in case_, e.g. if Jakarta EE 8 is added as a direct dependency.

## Problem solved then?

Well, for some definition of solved, yes.

Ideally, one would have to go through all the Java EE and Jakarta EE dependencies (fortunately, they can all be found in `javax:javaee-api` and `jakarta.platform:jakartaee-bom` POMs) and package all those rules into a plugin.

To that, one would have to add all the artifacts from EE vendors (e.g. for JAX-RS alone: `javax:javaee-api`, `javax:javaee-web-api`, `org.jboss.spec.javax.ws.rs:jboss-jaxrs-api_2.1_spec`, `org.jboss.resteasy:jaxrs-api`, `org.apache.servicemix.specs:org.apache.servicemix.specs.jaxrs-api-2.1`, `org.apache.aries.spec:org.apache.aries.javax.jax.rs-api`, `org.apache.geronimo.specs:geronimo-jaxrs_2.1_spec`, `org.apache.tomee:javaee-api`, and additionally for Jakarta RS: `jakarta.platform:jakartaee-api`, `jakarta.platform:jakartaee-web-api`, `org.jboss.spec.javax.ws.rs:jboss-jaxrs-api_3.0_spec`, `org.apache.tomee:jakartaee-api`, and I'm probably missing some) to declare them as providing the same Java EE or Jakarta EE capability (and note that versions do not match).

Then there needs to be extensive testing with various combinations of Java EE 7, Java EE 8, Jakarta EE 8 and Jakarta EE 9, including the `includesMajor` version check hinted above.

And of course, because we tap into each and every component, looking at all their dependencies, this needs to be optimized so as to not slow down all your builds.

Easier said than done.

_Many thanks to Björn Kautler (Vampire) and Jendrik Johannes for the discussion and ideas._
