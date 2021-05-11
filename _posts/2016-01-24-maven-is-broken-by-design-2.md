---
layout: post
title: "Maven is broken by design — Take 2: annotation processors"
published: true
old_discuss_url: https://plus.google.com/+ThomasBroyer/posts/2diBF3qhh36
---

More than 2 years ago, I wrote about why [Maven is broken by design],
and while not everything was accurate I stand by most of what I wrote back then.
This week, the Maven Compiler Plugin gained the ability to use `javac`'s `-processorpath`
by declaring annotation processor dependencies in a special configuration property,
[finally fulfilling][MCOMPILER-203] a [years-old enhancement request][MCOMPILER-134].

[Maven is broken by design]: {% post_url 2013-09-26-maven-is-broken-by-design %}
[MCOMPILER-203]: https://issues.apache.org/jira/browse/MCOMPILER-203
[MCOMPILER-134]: https://issues.apache.org/jira/browse/MCOMPILER-134

While playing with this (and actually a not-yet-released fix for [another years-old bug][MCOMPILER-235]),
I stumbled upon another design flaw with Maven.
But let's first see what the plugin attempts to achieve,
and before that let's have a look at how things work in Maven-land.

[MCOMPILER-235]: https://issues.apache.org/jira/browse/MCOMPILER-235

<ins datetime="2021-05-11">**EDIT(2021-05-11):** I've just been made aware that this new feature is actually [utterly broken][MCOMPILER-272],
wrt processor path dependency resolution.
This was reported a few months after the release,
and is still unfixed almost 5 years later. 🤷</ins>

[MCOMPILER-272]: https://issues.apache.org/jira/browse/MCOMPILER-272

<ins datetime="2020-07-20">**EDIT(2020-07-10):** Gradle, including the Android Gradle Plugin, 
have had built-in support for annotation processor for a while now.</ins>

Maven dependency management 101
-------------------------------

Maven provides [_scopes_] to categorize dependencies into buckets
that will be used to build classpaths used during the build or later when using the artifact.
There are 6 such dependency scopes only, and in Maven 3 you cannot define custom ones
(that apparently was possible in Maven 2):
`compile`, `provided`, `runtime`, `test`, `system`, and `import` (and that one's special).

[_scopes_]: https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html#Dependency_Scope

Maven then bakes rules around those scopes:

 * when compiling "main" classes, the classpath will include the `compile`, `provided`, and `system` dependencies
 * when compiling test classes, the classpath will include all the above and the `test` dependencies
 * when running tests (through the Surefire plugins), the classpath will include all the above and the `runtime` dependencies
   (which actually means **all** dependencies, unless you exclude some through the plugin configuration)
 * when using the artifact, the classpath will include its transitive `compile` and `runtime` dependencies

Additionally, AFAICT, a dependency can only fall in a single one of those buckets
(sounds logical given that scopes are mostly additive,
and while not entirely true there are cases where it's enforced:
the scope is never part of the _key_ used when building artifact maps,
so at least it seems like it's _supposed_ to work like this),
and dependency mediation (aka conflict resolution) will completely ignore scopes.

What that new Maven Compiler Plugin feature is about
----------------------------------------------------

The feature that had been requested as far back as 5 years ago
was to be able to declare dependencies to be used as `javac`'s `-processorpath`.
What that means is that we'd like to define a separate classpath, with separate version mediation.
The two main goals are that annotation processors and their dependencies don't end up in the compilation classpath
(that could cause issues because code could reference classes from the processors' dependencies
that wouldn't be available at runtime, and you wouldn't notice until, well, runtime),
and that they wouldn't influence dependency mediation either.
This obviously conflicts with Maven's view of dependency management.

The current (i.e. before that feature was added) way of using annotation processors
is to declare them as `provided` dependencies.
They're then placed into the classpath and `javac` is called without `-processorpath`
so it looks up annotation processors into the classpath.  
Earlier versions of the Maven Compiler Plugin (or when forcing the use of a forked `javac` process)
also put all the plugin's dependencies into `javac`'s classpath,
so you could declare your annotation processors as dependencies of the plugin.

To fulfill our goals, some people had proposed using a new `processor` dependency scope,
but that wouldn't have solved the “don't influence dependency mediation” issue.
You'd have needed a `test-processor` scope too to differentiate processors to use
for the main classes vs. the test classes,
and need to make a choice whether the `processor` scope would be used when compiling test classes.

One alternative could have possibly been to use a custom `<type>` for the dependencies,
but that would have had the same issues AFAICT,
plus the processors would have ended up in the classpath within plugins that are unaware of the custom type.

So the only way to do it is to have custom code within the Maven Compiler Plugin,
and only within the Maven Compiler Plugin.
This has been done in the form of an `annotationProcessorPaths` configuration property
where you configure annotation processors dependency coordinates,
and the plugin will resolve them by itself.
This unfortunately has sad side-effects.

The problem with Maven
----------------------

The problem with this situation is that
when you have an annotation processor and a module using it within the same reactor build
then Maven won't guarantee that the annotation processor is built before the using module.
This is because the _dependency_ is hidden inside the Maven Compiler Plugin
and Maven doesn't know about it when building the reactor's execution graph.

Not to mention that:

 * those _dependencies_ aren't subject to `dependencyManagement`
   or anything equivalent
 * the Maven Compiler Plugin will have to implement exclusion of transitive dependencies by itself (it currently does not)

So once again, we see that **Maven is broken, it's by design, and unfixable.**

As an anecdote, the not-yet-released change I was playing with is related to incremental build,
fixing [a years-old bug][MCOMPILER-235] that affects anyone using annotation processors that generates Java sources (most of them).
It happens that maintainer of the Maven Compiler Plugin who added the above-mentioned feature
never stumbled on it because he always does clean builds with Maven
(leaving his IDE handle incremental compilation).
In other words, incremental builds in Maven are so broken that even core contributors don't use them.  
I'm ready to bet that everyone else simply use an old version of the Maven Compiler Plugin that doesn't exhibit the issue.

And before bringing that post to a close, let's quickly see how Maven compares to other build tools. We'll see that most of them don't have the issues discussed above.

How about other build tools?
----------------------------

Both [Bazel] and [Buck] have built-in support for annotation processors and the `-processorpath` (though not documented in the case of Buck).

[Bazel]: http://bazel.io/docs/be/java.html#java_plugin
[Buck]: https://github.com/facebook/buck/blob/master/src/com/facebook/buck/jvm/java/JvmLibraryArg.java#L43

[Pants] has a rule to build an annotation processor, but it apparently uses them like any other dependency,
putting them in the classpath and relying standard discovery mechanism;
just like what everyone does currently with Maven.

[Pants]: https://pantsbuild.github.io/build_dictionary.html#bdict_annotation_processor

<del datetime="2020-07-20">Gradle doesn't have [built-in support][gradle pull 456] for `-processorpath`
but that can easily be added to any build script, or built as a plugin.
I wrote [such a plugin][gradle-apt-plugin],
and there's [another one][android-apt] dedicated to Android projects.
You get separate dependency mediation and a proper execution graph.</del>
Gradle gained a dedicated `annotationProcessorPath` option to its `JavaCompile` tasks [in 3.4][JavaCompile.options.annotationProcessorPath],
and a dedicated configuration to declare your annotation processor dependencies [in 4.6][SourceSet.annotationProcessor].
It also places generated sources in a separate directory by default (through `javac`'s `-s`) [since 5.2][annotationProcessorGeneratedSourcesDirectory],
and even built some Gradle-specific support for incremental annotation processing [since 4.7][incap]
(with major improvements since that first release).
The Android Gradle Plugin has had built-in support [since 2.2.0][agp-annotationProcessor].

[gradle pull 456]: https://github.com/gradle/gradle/pull/456
[gradle-apt-plugin]: https://plugins.gradle.org/plugin/net.ltgt.apt
[android-apt]: https://bitbucket.org/hvisser/android-apt
[JavaCompile.options.annotationProcessorPath]: https://docs.gradle.org/3.4/release-notes.html#compile-avoidance-in-the-presence-of-annotation-processors
[SourceSet.annotationProcessor]: https://docs.gradle.org/4.6/release-notes.html#convenient-declaration-of-annotation-processor-dependencies
[annotationProcessorGeneratedSourcesDirectory]: https://docs.gradle.org/5.2/release-notes.html#annotation-processor-improvements
[incap]: https://docs.gradle.org/4.7/release-notes.html
[agp-annotationProcessor]: https://developer.android.com/studio/releases/gradle-plugin#2-2-0
