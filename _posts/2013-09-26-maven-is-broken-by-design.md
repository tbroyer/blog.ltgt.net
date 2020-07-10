---
layout: post
title: Maven is broken by design
published: true
old_discuss_url: https://plus.google.com/113945685385052458154/posts/7LHoGXQdkri
has_embedded_tweets: true
additional_csp:
  img_src: imgs.xkcd.com
---

The other day, [someone asked] about the status of the GWT Mavenization, saying he loves
Maven and would like to help. I replied that “I used to really like it” but wasn't “so
sure nowadays.” It obviously was followed by “I know it could cause issues if not used
in the proper way […] Do you mind telling me why you don't love it anymore?” I've ranted
a bit already on Twitter, on blog comments, and in my [last post about Buck], so here's
a digest of it all so I can link to it the next time I'm asked about my thoughts on
Maven.

[someone asked]: https://groups.google.com/d/msg/google-web-toolkit-contributors/MZRnJwCbKUM/oRp7fzcRWTYJ
[last post about Buck]: {% post_url 2013-05-06-in-quest-of-the-ultimate-build-tool %}

_Disclaimer: I'm writing this while on sick leave, taken by dizziness and other
niceties._

**EDIT(2020-07-10):** Maven soon to have a build POM separate from the deployed POM!

Maven's model is mutable
------------------------

A few weeks ago, in reaction to Tesla Polyglot bringing a Scala DSL instead of XML to
describe your project, Arnaud Héritier tweeted:

<blockquote class="twitter-tweet" data-align="center" data-conversation="none"><p><a href="https://twitter.com/emmanuelbernard">@emmanuelbernard</a> <a href="https://twitter.com/lescastcodeurs">@lescastcodeurs</a> :-) I&#39;m not against a simplest /less verbose config file (json for example), but I&#39;m against a dev language</p>&mdash; Arnaud Héritier (@aheritier) <a href="https://twitter.com/aheritier/statuses/374810577866346496">September 3, 2013</a></blockquote>

To which I replied:

<blockquote class="twitter-tweet" data-align="center" data-conversation="none"><p><a href="https://twitter.com/aheritier">@aheritier</a> <a href="https://twitter.com/emmanuelbernard">@emmanuelbernard</a> I initially was too (after looking at Rake, Buildr, Gradle and SBT), but Buck made me change my mind.</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/statuses/374820078643982336">September 3, 2013</a></blockquote>

<blockquote class="twitter-tweet" data-align="center" data-conversation="none"><p><a href="https://twitter.com/aheritier">@aheritier</a> <a href="https://twitter.com/emmanuelbernard">@emmanuelbernard</a> …particularly when considering how Maven&#39;s supposedly declarative approach is actually so imperative…</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/statuses/374820456055857152">September 3, 2013</a></blockquote>

Think about this not-uncommon scenario: a pom.xml can only list a single source folder.
If you have more than one (for whichever reason), you have to use the `build-helper-maven-plugin`
to dynamically add it at some phase of the build earlier to where it'll be used
(generally by the `maven-compiler-plugin` at the `compile` phase, so you'd add the
source folder at the `generate-sources` file for instance). Now imagine you're building
an IDE and have to import such a project: to _discover_ the existence of the second
source folder, you have to either:

 * know about the `build-helper-maven-plugin` and read its configuration (i.e. duplicate the work in the IDE), or
 * run the project in an embedded Maven instance and then inspect the `MavenProject` object

[M2Eclipse uses the former], while IntelliJ IDEA seems to be using a mix of [the same] 
and heuristics (but hardcodes the `build-helper-maven-plugin` and doesn't seem to be
pluggable).

[M2Eclipse uses the former]: http://wiki.eclipse.org/M2E_plugin_execution_not_covered#delegate_to_a_project_configurator_.28recommended.29
[the same]: https://github.com/JetBrains/intellij-community/blob/9bfcbbe23072cd964dc8931369bbf7c74b697fdf/plugins/maven/src/main/java/org/jetbrains/idea/maven/importing/MavenFoldersImporter.java#L141

Conversely, Gradle, for instance, has an immutable model. [The project model is built]
first, and hooks are provided for plugins to dynamically augment it, then it's frozen
and the build can be executed. This allows IDEs to inspect the project's model without
duplicating work, without executing (part of) the build, and without heuristics.  
And yet, Gradle projects are _described_ using a “dev language” (to reuse Arnaud's
words). This is because that code doesn't _build_ anything, but rather constructs a
representation of the project in memory.

[The project model is built]: http://www.gradle.org/docs/current/userguide/build_lifecycle.html#sec:build_phases

Surprisingly (or not), Maven has such a model (which BTW is the basis of Tesla
Polyglot); what it lacks is a clean distinction between constructing that description
and then using it to build the project. **I don't think this can be fixed without
breaking backwards compatibility with almost all plugins out there that generate
sources or resources.**

Incremental builds are either inexistent or broken
--------------------------------------------------

Maven's [incremental builds] state of affair is rather bad.

First, it has to be done by each plugin. This gives more flexibility to the plugins, 
but once again makes it impossible to infer the inputs and outputs from the outside to 
build the project model in an IDE. Again, Gradle's approach looks better, and I'm not 
even talking about Buck, which now even has a _build cache_ (inputs are hashed and the 
output is stored in a cache – local or shared – with that hash as the key; when you run 
the build again, the cache is checked first, and because it can be shared on the 
network, everyone in the team can benefit from others' builds!)

[incremental builds]: https://cwiki.apache.org/confluence/display/MAVEN/Incremental+Builds

Then, Maven's approach is that many plugins write to the same output directory, making
it impossible to accurately check for staleness (if a first plugin writes to a file,
and a second plugin overwrites it, it really doesn't matter whether the sources for the
first plugin are stale or not, as the result would be overwritten anyway).

Finally, due to the above rule, staleness is too often managed at a too fine-grain
level (file-level), which can lead to _build too few_ cases: if class B uses class A,
and class A changes, the `maven-compiler-plugin` will recompile class A but won't
recompile class B leading to possible errors are runtime rather than compile-time. I'm
not even talking about deleted or renamed files (if you rename A into C, the `A.class` 
won't be deleted unless you `mvn clean`) or annotation processors (even if deleted 
files were tracked, tracking files generated by annotation processors would be harder).

AFAICT, most other build tools suffer from the same issues (Ant, SCons, etc.) Buck is a
notable exception here, but is probably not alone.

**It could possibly be fixed, but would have to be done in each and every plugin, so
it's not going to happen, and it would probably be too fragile to be trusted anyway.
So let's just say it's not fixable.**

As far as the `maven-compiler-plugin` is concerned, JDK 8 introduces a new tool,
[`jdeps`], that can give you the class dependencies.

[`jdeps`]: http://mail.openjdk.java.net/pipermail/core-libs-dev/2012-November/012485.html

<blockquote class="twitter-tweet" data-align="center"><p>Could be used to make a true incremental Java build tool (except maybe when annotation processors come in the play)&#10;<a href="https://t.co/3QB6Nxf85v">https://t.co/3QB6Nxf85v</a></p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/statuses/377365329040531456">September 10, 2013</a></blockquote>

The `maven-compiler-plugin` could then build a graph of the dependencies and rebuild
B whenever A changed.

<blockquote class="twitter-tweet" data-align="center" data-conversation="none"><p><a href="https://twitter.com/tbroyer">@tbroyer</a> Now the question is: would it be worth it? I&#39;d bet no. This is not what&#39;s slowing our builds.</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/statuses/377366759025557505">September 10, 2013</a></blockquote>

Is it really worth keeping track of all those things and try to only recompile the
few things that have changed (and the things that depend on it, transitively) when
compiling is not the most time-consuming task in a build? (note that you'd first have
to fix the handling of deleted sources, etc.) Everything's so much easier if you treat
compilation as an atomic (non-incremental) task, the way Buck does.

Reactor builds are half-baked
-----------------------------

Most other issues with Maven are related to reactor builds, _aka_ multi-module 
projects. The problems with reactor builds are many, but basically stem from 2 design
decisions: linear build lifecycle and snapshots.

Here are some use cases that Maven cannot handle without compromising the 
reproducibility of your build:

 * Running a WAR submodule in a lightweight container (e.g. Tomcat or Jetty), or deploy
   it to a remote container. Some plugins (e.g. Tomcat) have special support for
   reactor builds, but the result is different from packaging the WAR and then
   deploying it manually.
 * Rebuilding only the modules you're working on and those that transitively depend on
   them; or run tests of those modules.

For all these cases, the only (somewhat) reliable way is to `mvn install` the modules
you don't want to rebuild constantly and then run everything in _offline_ module, to
make sure the snapshots you just installed won't be overwritten by ones coming from
your repo manager, provisioned by your CI server. This poses other problems, as some
plugins don't support running offline.

This is exacerbated by DVCS and their lightweight local branches: each time you switch
branch you have to rebuild everything from scratch if you want to make sure you're not
mixing things from the previously checked-out branch.

As Lex Spoon already pointed this out last year in his [Recursive Maven considered harmful] 
piece.

[Recursive Maven considered harmful]: http://blog.lexspoon.org/2012/12/recursive-maven-considered-harmful.html

One other issue is the linear build lifecycle: `mvn test` won't package anything,
downstream modules will use the `target/classes` from the modules they depend on. But
what if one of the module dependencies contains an annotation processor? This is where
you start to use `mvn package` and `mvn package -DskipTests` everytime you want to test
or compile something.

Finally, linked to the above two issues, is one with the command line: back to the
second use case above (the first one could be used too, but it's not much about the
_build_). Let's say I have a feature-branch cut from `master` a couple days ago. I'm
working on module C, which depends on A and B, but I don't really need to test A and B
as the CI server said they were OK at the time I cut the branch; I just want to use
them, in their state corresponding to the revision I checked out. I do want to run
tests for the C module that I'm working on though. You simply cannot tell Maven to
package everything up to (and excluding) C, without running the tests, and then compile
(and maybe package) and run tests for the C module. No, you only have two choices:

 * `mvn install -pl A,B` (which incidentally will run all of their unit and integration
   tests; `-DskipTests` would only skip part of them, there's no global switch) to
   install A and B into your local repo, then `mvn test -pl C -o` which will resolve
   the A and B dependencies from the local repo. Note that the first step means that
   you know you need A and B, or you could also install the C module; and running the
   tests for C might require other dependencies so running in offline mode might not
   work, again you could install C too which would resolve all plugins and
   dependencies.
 * `mvn package -pl C -am` to package and run tests for all of A, B and C.

In any case, you're asking Maven to do too much work. Combined with Maven's tendency
to already do too much work (see incremental builds above), this is a real productivity
killer.

<figure><a href="http://xkcd.com/303/"><img alt="" src="http://imgs.xkcd.com/comics/compiling.png" width="413" height="360"></a></figure>

AFAICT, Maven didn't initially have multi-module support, and this was first
contributed as a plugin before being builtin. That would explain why reactors and the
linear lifecycle don't play well together, but it's not an excuse.

And again, **I don't think this can be fixed without breaking a whole lot of builds out
there; this is just how Maven works and has been designed: _broken by design_.**

POMs have two uses
------------------

The POM in a Maven project has two uses: it describes how to build the project, and
how to use the artifacts it produced. The main thing in common is the list of
dependencies, and Maven's scopes are too limiting: there's no “this is only need at
compile-time” scope (you'd use an _optional_ dependency, or the `provided` scope),
and `test` dependencies are not transitive (in the sense that if you need to expose a
testing framework, you cannot just say “use the `test` artifact”, as you wouldn't have
the transitive dependencies; you have to split the tests in a separate module, which
generally means you'll also move some tests out of the module they're supposed to test;
this can be seen as a limitation of the [“one artifact per module” rule] too)

[“one artifact per module” rule]: http://www.gradle.org/docs/current/userguide/maven_plugin.html#sub:multiple_artifacts_per_project

Do we really need to share in Central the recipes we used to build our artifacts? Who
benefits from it? Compare that to how much it weighs.

**EDIT(2020-07-07):** Maven will actually (in version 3.7) [distinguish between the *build POM* and the so-called *consumer POM*][build-vs-consumer-poms].
Not much differences in practice in this first run,
but still, POMs will no longer have two uses.

[build-vs-consumer-poms]: https://lists.apache.org/thread.html/r1dc1da015ab400d5e35c91af90ce3f6bbd923de8ca40ca6fb27ed186%40%3Cusers.maven.apache.org%3E

I'll succumb to the siren call of version ranges and add that artifact metadata in
repositories should be updatable in some ways: what if you could update your old
artifact to explicitly say that it's not compatible with some new version of one of its
dependencies? And how about adding information about known security vulnerabilities?
Making the artifact as _deprecated_ if you've made an “emergency release” to fix a bug?

**This isn't going to happen, as it would break everyone's expectations that a released
version is immutable.** (One would have to explain to me why Maven tracks the source of
the downloaded artifacts then: if you don't trust your repositories for providing “the
right artifacts”, then you probably have a bigger problem than what Maven is trying to
work around here)

The project layout isn't human- or even tooling-friendly
--------------------------------------------------------

Let's finish with a small additional rant. Maven has standardized the
`src/{main,test}/{java,resources}` layout for projects. It was made with the best of
intentions (everyone always had `excludes="**/*.java"`, so segregating those files into
separate folders seemed like a good idea), but it really comes in the way of the
developers, and tooling isn't there:

 * If you're in the CLI, you have to replace not only the file name from your previous
   command, but also replace `java` with `resources`.
 * If you're looking at your files in an _explorer_ view (Windows Explorer, Nautilus,
   Finder, etc.) you'll have to drill down into 2 folder trees, as if having to drill
   down into `src/main/java` wasn't painful already.
 * Most IDEs will show you 2 folders for resources and java sources, just like an
   _explorer_, rather than a _package-oriented view_ (IntelliJ IDEA has such a view
   though). That said, package-oriented views are great for editing existing files,
   but when it comes to create a new file, you have to select the physical folder you
   want to put it in (or maybe the IDE could infer it?)

Repositories are all checked for all dependencies
-------------------------------------------------

You cannot tell Maven to download some dependency from some repository and some other
dependency from some other repository. No, Maven will instead always check all the
listed repositories, including (quite obviously) those from POMs of your dependencies
and their transitive dependencies, i.e. things you don't really have a hand in. This
can become a real pain when one of those repositories is down (temporarily or
permanently) as Maven will keep checking it, slowing your builds even more than they
already (artificially) are.

The answer from the Maven developers and community is to set up a repository manager
in your local network to serve as a proxy and never ever configure any repository in
your POMs. This is nothing more than a workaround though, almost looking like they're
apologizing for their broken tool (hey, but you get some nice features out of that new 
tool!). For reference, Ivy recommends such a setup for enterprises, but for
[completely different reasons] \(that are also solved by a Maven repository manager
BTW). An Ivy enterprise repository is also an entirely different beast than a Maven
repository manager: it's not a new piece of software, it can be a network filesystem, a
WebDAV server (or simply an HTTP server if it should be read-only), or a remote
filesystem accessible via SFTP or SSH; and you have to explicitly publish to it (it's
not a proxy to public repositories).

[completely different reasons]: http://ant.apache.org/ivy/history/latest-milestone/bestpractices.html

It's becoming even worse if you have a laptop: you'll have to switch your 
`settings.xml` depending on whether you're at work (and want to use your enterprise
repo manager) or at home or on the go (and want to use public repos). Most of the time,
you won't work on the same projects in those different places, so the settings you'll
need are _per project_, but Maven doesn't let you do it. It's an all or nothing. And
guess what the Maven community answer to this issue is? Install a [repo manager on your laptop]
to proxy all those repositories! (including your enterprise repo manager that already
proxies most of them, but just isn't always available as you move), and of course pay
twice the price for storing all those artifacts (the repo manager cache, and your local
repository).

[repo manager on your laptop]: http://mail-archives.apache.org/mod_mbox/maven-users/201309.mbox/%3C52412E71.5060703%40gmail.com%3E

This can probably be fixed by enhancing the POM (and current Maven versions would
reject it), or possibly using a plugin/extension to swap artifact resolvers. The bad 
news is that Sonatype tries to get everyone to standardize on Aether for resolving
artifacts, and I believe that the issue is there, rather than in Maven proper (haven't
checked though).

Maven is broken, it's by design, and unfixable
----------------------------------------------

Maven hasn't been initially designed with incremental builds and multi-module projects 
in mind. The implications in Maven's way of working are so deep that it's impossible to
fix it without breaking almost everyone. **Unfixable** and **unfixable**.

Similarly, and as Lex said, SNAPSHOTs are harmful for builds (they can be useful as
dependencies in other projects though, I don't deny it), but unfortunately you have to
use them or keep rebuilding and retesting things you shouldn't need to. Because the
outcome from a build cannot be accurately predicted, and because of the linear 
lifecycle where you're not forced to package your artifacts, it's hard to impossible to
add a build cache to Maven. **Unfixable**.

And we've seen that Maven's internal representation of the project and its lifecycle
isn't IDE-friendly (among other things), and that cannot be fixed either without
breaking almost everyone. **Unfixable**.

The standardized project layout isn't much of an improvement relative to the already
common `src` and `test` source roots. This is of course fixable (Maven can be
configured this way), but we're talking about “convention over configuration” here.
**Unfixable**.

The POM as used in repositories is too verbose for its intended use, and could be
vastly improved. Slimming it down would be possible, but enhancing it by making it no
longer immutable would break everyone. **Unfixable**.

And repository management is, er, dumb? plain broken? **Unfixable**.

So what's left? Er… not much I'd say… Good intentions? The road to hell is paved with good intentions.

And the worst part: it's not just Maven, as almost everyone jumped into the bandwagon
(mostly for compatibility's sake, at least I hope so), and people keep advertizing
Maven as [the One True Way™] despite all its issues (sometimes not even denying them,
sometimes because they don't know what they're missing, and other times just suffering
from the Stockholm syndrom).

[the One True Way™]: http://www.javarants.com/2013/07/16/why-your-new-jvm-build-tool-is-making-things-worse-aka-use-maven-to-execute-your-build/

All that said…
--------------

…I'd love to be proved wrong, given Maven's market share. From now on, I'll invest some
time trying out Gradle on a real project to better understand how it works and what its
pitfalls are. Buck+Ivy+scripts are still an appealing combo, in case nothing else works
_the way it should_, particularly as [Buck is going to get plugins] to contribute new
tasks (rather than hack around macros and `genrule`s).

[Buck is going to get plugins]: https://groups.google.com/d/msg/buck-build/sYb5fWje-Mw/UikiAjbPgqEJ
