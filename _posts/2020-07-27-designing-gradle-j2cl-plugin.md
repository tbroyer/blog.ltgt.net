---
layout: post
title: Designing a Gradle plugin for J2CL
---

In the [previous post][reverse-engineering-j2cl-bazel-integration],
I explored how J2CL is used in Bazel.
Starting with this post, with this knowledge,
I'll try to design a Gradle plugin for J2CL.

[reverse-engineering-j2cl-bazel-integration]: {% post_url 2020-07-05-reverse-engineering-j2cl-bazel-integration %}

Building blocks
---------------

Let's start with the low-level building blocks.

All the J2CL (`GwtIncompatibleStrip` and `J2clTranspile`)
and Closure compiler (`CommandLineRunner`) tools
can easily be called from Java processes
(the Bazel workers actually call different, sometimes internal, APIs),
so they could be called from [Gradle workers][gradle_workers].
It also shouldn't be a problem to call the J2CL tools incrementally,
only processing changed files;
well, actually, it won't be a problem for the `GwtIncompatibleStrip`
which processes files one by one in isolation;
the `J2clTranspile` however, just like `javac`,
would also need to reprocess other Java files referencing the changed files,
so making it incremental would mean knowing about those dependencies;
let's leave this optimization work for later
(FWIW, the way Bazel deals with it is to **not** do any incremental/partial processing of any kind,
but instead using small sets of files, generally at the Java package level).

[gradle_workers]: https://docs.gradle.org/6.5.1/userguide/custom_tasks.html#worker_api

That means we'd have to declare 3 `configuration`s (for the 3 tools' dependencies),
and we could create corresponding tasks with proper inputs and outputs.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 483.34 98"><g class="graph" transform="translate(4 94)"><g class="node"><text x="56.599" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">sources</text></g><g class="node"><path fill="none" stroke="currentColor" d="M161.198-27h135.07c6 0 12-6 12-12v-12c0-6-6-12-12-12h-135.07c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="228.733" y="-40.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">GwtIncompatibleStrip</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M85.8-67.42l53.045 8.32"/><path stroke="currentColor" d="M139.561-62.53l9.337 5.007-10.422 1.909 1.085-6.916z"/></g><g class="node"><text x="56.599" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">stripperClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M113.44-26.916l25.341-3.975"/><path stroke="currentColor" d="M138.476-34.386l10.422 1.909-9.337 5.007-1.085-6.916z"/></g><g class="node"><text x="409.805" y="-40.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">destinationDirectory</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M308.417-45h25.581"/><path stroke="currentColor" d="M334.201-48.5l10 3.5-10 3.5v-7z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        sources
        stripperClasspath
        destinationDirectory
    }
    GwtIncompatibleStrip [shape=Mrecord]
    sources -> GwtIncompatibleStrip
    stripperClasspath -> GwtIncompatibleStrip
    GwtIncompatibleStrip -> destinationDirectory
}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430.46 206"><g class="graph" transform="translate(4 202)"><g class="node"><text x="61.651" y="-175.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">sources</text></g><g class="node"><path fill="none" stroke="currentColor" d="M171.303-81h72.079c6 0 12-6 12-12v-12c0-6-6-12-12-12h-72.079c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="207.342" y="-94.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">J2clTranspile</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M90.646-168.423c10.464 4.47 22.255 9.849 32.657 15.423 16.867 9.04 34.807 20.318 49.762 30.227"/><path stroke="currentColor" d="M175.135-125.598l6.359 8.474-10.256-2.659 3.897-5.815z"/></g><g class="node"><text x="61.651" y="-121.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">nativeJsSources</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M114.661-116.176l34.461 6.386"/><path stroke="currentColor" d="M149.772-113.229l9.195 5.264-10.47 1.619 1.275-6.883z"/></g><g class="node"><text x="61.651" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">classpath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M95.442-78.262l53.699-9.952"/><path stroke="currentColor" d="M148.637-91.68l10.471 1.619-9.195 5.264-1.276-6.883z"/></g><g class="node"><text x="61.651" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">transpilerClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M105.183-36.03c6.158-2.849 12.352-5.88 18.12-8.97 16.867-9.04 34.807-20.318 49.762-30.227"/><path stroke="currentColor" d="M171.238-78.217l10.256-2.659-6.359 8.474-3.897-5.815z"/></g><g class="node"><text x="356.919" y="-94.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">destinationDirectory</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M255.493-99h25.486"/><path stroke="currentColor" d="M281.141-102.5l10 3.5-10 3.5v-7z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        sources
        nativeJsSources
        classpath
        transpilerClasspath
        destinationDirectory
    }
    J2clTranspile [shape=Mrecord]
    sources -> J2clTranspile
    nativeJsSources -> J2clTranspile
    classpath -> J2clTranspile
    transpilerClasspath -> J2clTranspile
    J2clTranspile -> destinationDirectory
}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 428.94 206"><g class="graph" transform="translate(4 202)"><g class="node"><text x="60.099" y="-175.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">sources</text></g><g class="node"><path fill="none" stroke="currentColor" d="M168.198-81h88.43c6 0 12-6 12-12v-12c0-6-6-12-12-12h-88.43c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="212.413" y="-94.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">ClosureCompile</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M89.133-167.71c9.959 4.413 21.101 9.573 31.065 14.71 18.227 9.397 37.905 20.745 54.383 30.61"/><path stroke="currentColor" d="M176.622-125.247l6.755 8.162-10.371-2.168 3.616-5.994z"/></g><g class="node"><text x="60.099" y="-121.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">entryPoints</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M100.118-118.906l45.789 8.117"/><path stroke="currentColor" d="M146.82-114.182l9.235 5.192-10.457 1.7 1.222-6.892z"/></g><g class="node"><text x="60.099" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">options</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M88.748-77.079l57.304-10.157"/><path stroke="currentColor" d="M145.666-90.722l10.457 1.7-9.236 5.192-1.221-6.892z"/></g><g class="node"><text x="60.099" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compilerClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M101.758-36.015c6.233-2.897 12.543-5.945 18.44-8.985 18.227-9.397 37.905-20.746 54.383-30.61"/><path stroke="currentColor" d="M173.006-78.747l10.371-2.168-6.755 8.162-3.616-5.994z"/></g><g class="node"><text x="362.785" y="-121.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">outputJs</text></g><g class="node"><text x="362.785" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">outputSourceMap</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M268.834-109.13l52.335-9.398"/><path stroke="currentColor" d="M320.922-122.039l10.462 1.677-9.225 5.212-1.237-6.889z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M268.834-88.87l25.7 4.615"/><path stroke="currentColor" d="M295.319-87.67l9.224 5.212-10.461 1.678 1.237-6.89z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        sources
        entryPoints
        options
        compilerClasspath
        outputJs
        outputSourceMap
    }
    ClosureCompile [shape=Mrecord]
    sources -> ClosureCompile
    entryPoints -> ClosureCompile
    options -> ClosureCompile
    compilerClasspath -> ClosureCompile
    ClosureCompile -> outputJs
    ClosureCompile -> outputSourceMap
}
-->

That would work for project sources though, but not external dependencies.
For those, we could probably use [artifact transforms][artifact_transforms],
but that excludes compiling the source files with `javac`,
at least if we want to leverage the Gradle standard `JavaCompile` task
(I've been floating the idea of an ASM-based `GwtIncompatibleStrip`,
which would solve the problem then,
as an artifact transform of the binary JAR).
Let's keep external dependencies for later though.

[artifact_transforms]: https://docs.gradle.org/6.5.1/userguide/artifact_transforms.html

Speaking of the `JavaCompile` tasks,
for J2CL we'd want to configure their [`bootstrapClasspath`][CompileOptions.bootstrapClasspath] to the Java Runtime Emulation JAR.
Unfortunately, `-bootclasspath` [can only be used][javac-bootclasspath] when compiling for Java 8,
so that rules out using any Java 9+ syntax: private methods in interfaces, `var` for type inference, etc.
For those more recent Java versions, we'd want to use [`--system`][javac-system],
but that's an entirely different format,
and one that's not even supported by Bazel yet, let alone produced by J2CL
(though maybe it's not that hard to create from the Java Runtime Emulation JAR).
Fwiw, Google also faces the same issue for Android for adding Java 9+ syntax support,
as well as J2ObjC,
so we can be sure they'll find a solution
(they're actually already [working on it][google/j2cl#97]).

[CompileOptions.bootstrapClasspath]: https://docs.gradle.org/6.5.1/dsl/org.gradle.api.tasks.compile.CompileOptions.html#org.gradle.api.tasks.compile.CompileOptions:bootstrapClasspath
[javac-bootclasspath]: https://docs.oracle.com/en/java/javase/11/tools/javac.html#GUID-AEEC9F07-CB49-4E96-8BC7-BCC2C7F725C9__GUID-38BC1737-2F22-4288-8DC9-933C37D471AB
[javac-system]: https://docs.oracle.com/en/java/javase/11/tools/javac.html#GUID-AEEC9F07-CB49-4E96-8BC7-BCC2C7F725C9__GUID-96B805B4-3A9B-45B7-887B-84D0897C9CA2
[google/j2cl#97]: https://github.com/google/j2cl/issues/97

Tests
-----

For tests, the annotation processor and its `@J2clTestInput` have been designed as implementation details,
hidden behind a `j2cl_test` rule in Bazel.
Contrary to Bazel where one `j2cl_test` rule only runs a single test class (which could actually be a test suite),
with a `gen_j2cl_tests` macro to generate them automatically from source files using a naming convention,
in Gradle we'll have a single task for the whole `src/test`.
We could however have a task that generates a JUnit suite, annotated with `@J2clTestInput`,
and referencing the test classes, using a naming convention,
and then processes it with the annotation processor.

This will generate some Java code to be transpiled with J2CL.
This phase can reuse the `J2clTranspile` task from above,
using the `src/test/java` and the generate Java code all at once.

The `test_summary.json` file then needs to be processed
and fan out one Closure compilation per JS entrypoint
(one per non-suite test class, with `.testsuite` file extension).
This cannot reuse the `ClosureCompile` task though:
we want a single task driving multiple Closure compilations.
The result will thus be several JS applications;
we'll put them into separate directories (named after the original Java test),
and generate an additional HTML page to run them.
The task could be made incremental, only recompiling tests that have changed,
but that would need dependency information between files
(that can be extracted using Closure, with some additional work;
or possibly even just analyzing the `goog.provide`/`goog.require`).
BTW, that knowledge could possibly also be used by the `ClosureCompile` task
to skip compilation if a file has changed that's not needed by anything.

Finally, we'll need to run those generated tests in browsers.
The best way to do that is through Selenium WebDriver.
We'll thus want a task taking those directories of compiled tests,
that starts an HTTP server to serve them,
and loads each of them in a web browser through WebDriver,
generating reports (that helps skipping the task if no input has changed).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 491.1 314"><g class="graph" transform="translate(4 310)"><g class="node"><text x="91.98" y="-283.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">testClasses</text></g><g class="node"><path fill="none" stroke="currentColor" d="M231.96-135h72.063c6 0 12-6 12-12v-12c0-6-6-12-12-12h-72.064c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="267.991" y="-148.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">GenerateTests</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M131.007-282.147c17.312 3.951 37.268 10.473 52.952 21.147 30.652 20.86 55.16 56.423 69.625 81.01"/><path stroke="currentColor" d="M256.709-181.576l1.919 10.419-7.998-6.948 6.079-3.471z"/></g><g class="node"><text x="91.98" y="-229.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">options</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M120.917-227.76c18.506 4.534 42.756 11.497 63.042 20.76 17.934 8.189 36.512 19.754 51.625 30.082"/><path stroke="currentColor" d="M237.849-179.605l6.202 8.59-10.205-2.848 4.003-5.742z"/></g><g class="node"><text x="91.98" y="-175.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">classpath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M125.916-174.794l83.914 12.872"/><path stroke="currentColor" d="M210.498-165.36l9.353 4.975-10.415 1.944 1.062-6.919z"/></g><g class="node"><text x="91.98" y="-121.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">bootstrapClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M153.046-135.368l56.838-8.718"/><path stroke="currentColor" d="M209.375-147.549l10.415 1.943-9.354 4.976-1.061-6.919z"/></g><g class="node"><text x="417.56" y="-148.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">destinationDirectory</text></g><g class="node"><text x="91.98" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">annotationClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M156.667-88.438C165.984-91.536 175.33-95.06 183.96-99c17.934-8.189 36.512-19.754 51.625-30.082"/><path stroke="currentColor" d="M233.846-132.137l10.205-2.848-6.202 8.59-4.003-5.742z"/></g><g class="node"><text x="91.98" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">annotationProcessorClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M168.04-36.08c5.587-2.593 10.966-5.55 15.92-8.92 30.65-20.86 55.16-56.423 69.624-81.01"/><path stroke="currentColor" d="M250.63-127.895l7.998-6.948-1.919 10.419-6.079-3.471z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M316.139-153h25.485"/><path stroke="currentColor" d="M341.785-156.5l10 3.5-10 3.5v-7z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        testClasses
        options
        classpath
        bootstrapClasspath
        destinationDirectory
        annotationClasspath
        annotationProcessorClasspath
    }
    GenerateTests [shape=Mrecord]
    testClasses -> GenerateTests
    options -> GenerateTests
    classpath -> GenerateTests
    bootstrapClasspath -> GenerateTests
    GenerateTests -> destinationDirectory
    annotationClasspath -> GenerateTests
    annotationProcessorClasspath -> GenerateTests
}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468.59 152"><g class="graph" transform="translate(4 148)"><g class="node"><text x="60.099" y="-121.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">sources</text></g><g class="node"><path fill="none" stroke="currentColor" d="M168.198-54h113.317c6 0 12-6 12-12v-12c0-6-6-12-12-12H168.198c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="224.856" y="-67.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">ClosureCompileTests</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M89.175-116.47l70.957 23.256"/><path stroke="currentColor" d="M161.359-96.495l8.413 6.441-10.593.211 2.18-6.652z"/></g><g class="node"><text x="60.099" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">options</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M88.797-72h57.292"/><path stroke="currentColor" d="M146.103-75.5l10 3.5-10 3.5v-7z"/></g><g class="node"><text x="395.052" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">destinationDirectory</text></g><g class="node"><text x="60.099" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compilerClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M115.42-36.131l44.687-14.647"/><path stroke="currentColor" d="M159.089-54.128l10.593.212-8.412 6.44-2.181-6.652z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M293.59-72h25.506"/><path stroke="currentColor" d="M319.372-75.5l10 3.5-10 3.5v-7z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        sources
        options
        destinationDirectory
        compilerClasspath
    }
    ClosureCompileTests [shape=Mrecord]
    sources -> ClosureCompileTests
    options -> ClosureCompileTests
    ClosureCompileTests -> destinationDirectory
    compilerClasspath -> ClosureCompileTests
}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 378.35 98"><g class="graph" transform="translate(4 94)"><g class="node"><text x="63.592" y="-67.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">testsDirectory</text></g><g class="node"><path fill="none" stroke="currentColor" d="M175.184-27h38.652c6 0 12-6 12-12v-12c0-6-6-12-12-12h-38.652c-6 0-12 6-12 12v12c0 6 6 12 12 12"/><text x="194.51" y="-40.9" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">J2clTest</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M110.856-62.252l42.11 8.684"/><path stroke="currentColor" d="M153.773-56.975l9.087 5.448-10.501 1.408 1.414-6.856z"/></g><g class="node"><text x="316.091" y="-40.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">reportsDirectory</text></g><g class="node"><text x="63.592" y="-13.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">webdriverClasspath</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M127.517-31.184l25.512-5.261"/><path stroke="currentColor" d="M152.479-39.905l10.501 1.408-9.087 5.447-1.414-6.855z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M226.136-45h25.778"/><path stroke="currentColor" d="M252.02-48.5l9.999 3.5-10 3.5.001-7z"/></g></g></svg>
<!--
digraph {
    rankdir=LR
    {
        node [shape="plaintext"]
        testsDirectory
        reportsDirectory
        webdriverClasspath
    }
    J2clTest [shape=Mrecord]
    testsDirectory -> J2clTest
    J2clTest -> reportsDirectory
    webdriverClasspath -> J2clTest
}
-->

Putting it all to work
----------------------

For an application like the HelloWorld sample from the Bazel repository,
wiring all those tasks together would lead to a graph like the following:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1129.32 1754.2"><g class="graph" transform="translate(4 1750.2)"><g class="cluster"><path fill="none" stroke="currentColor" d="M8-667.6v-1070.6h450v1070.6H8z"/></g><g class="cluster"><path fill="none" stroke="currentColor" d="M466-8v-1530.4h514V-8H466z"/></g><g class="node"><ellipse cx="213" cy="-1712.2" fill="none" stroke="currentColor" rx="44.078" ry="18"/><text x="213" y="-1708" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">src/main</text></g><g class="node"><path fill="none" stroke="currentColor" d="M231.357-1603.4H92.643v36h138.714v-36z"/><text x="162" y="-1581.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">stripGwtIncompatible</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M205.801-1694.302l-32.642 81.157"/><path stroke="currentColor" d="M176.306-1611.59l-6.979 7.972.485-10.584 6.494 2.612z"/><text x="215.855" y="-1644.6" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.java</text></g><g class="node"><path fill="none" stroke="currentColor" d="M124.256-1019.4H37.744v36h86.512v-36z"/><text x="81" y="-997.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">transpileJ2cl</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M171.032-1705.917C118.126-1696.79 34-1677.73 34-1648.8v245.9c0 8.225-.34 10.276-.436 18.5-.189 15.999-.272 20.002 0 36 1.796 105.829 2.719 132.31 8.436 238 1.298 24.002-4.505 31.165 3 54 3.314 10.083 8.97 20.098 14.831 28.765"/><path stroke="currentColor" d="M62.705-1029.634l2.976 10.168-8.668-6.093 5.692-4.075z"/><text x="71.718" y="-1362.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.native.js</text></g><g class="node"><path fill="none" stroke="currentColor" d="M258.149-711.6H153.851v36h104.298v-36z"/><text x="206" y="-689.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compileClosure</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M232.427-1695.992C244.214-1684.268 257-1667.29 257-1648.8v882.2c0 17.924-10.46 34.586-21.906 47.452"/><path stroke="currentColor" d="M237.365-716.459l-9.44 4.809 4.381-9.647 5.059 4.838z"/><text x="317.661" y="-1216.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.js !&#42;&#42;/&#42;.native.js</text></g><g class="node"><path fill="none" stroke="currentColor" d="M769.251-274H640.749v36h128.502v-36z"/><text x="705" y="-251.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compileTestClosure</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M257.283-1710.97c166.112 4.903 742.717 24.624 742.717 62.17v1337.3c0 22.401-133.078 39.748-220.47 48.724"/><path stroke="currentColor" d="M779.676-259.273l-10.301-2.476 9.597-4.489.704 6.965z"/><text x="1060.661" y="-952.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.js !&#42;&#42;/&#42;.native.js</text></g><g class="node"><ellipse cx="151" cy="-1439.4" fill="none" stroke="currentColor" rx="84.316" ry="18"/><text x="151" y="-1435.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;stripped sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M160.63-1567.204l-7.484 99.316"/><path stroke="currentColor" d="M156.63-1467.534l-4.242 9.709-2.739-10.235 6.981.526z"/></g><g class="node"><path fill="none" stroke="currentColor" d="M193.975-1311.4h-85.95v36h85.95v-36z"/><text x="151" y="-1289.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compileJava</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M151-1421.204v99.316"/><path stroke="currentColor" d="M154.5-1321.825l-3.5 10-3.5-10h7z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M143.343-1421.27c-10.371 24.714-29.313 70.42-44.343 109.87-24.524 64.368-40.273 78.124-52 146-8.344 48.299 9.04 104.096 21.89 136.577"/><path stroke="currentColor" d="M72.147-1030.106l.552 10.58-7.03-7.927 6.478-2.653z"/></g><g class="node"><ellipse cx="363" cy="-1147.4" fill="none" stroke="currentColor" rx="87.182" ry="18"/><text x="363" y="-1143.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;compiled classes&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M164.042-1275.208c15.15 20.054 41.82 52.198 70.958 72.808 21.434 15.16 47.704 27.352 70.855 36.368"/><path stroke="currentColor" d="M307.111-1169.299l8.114 6.812-10.591-.265 2.477-6.547z"/></g><g class="node"><ellipse cx="147" cy="-1147.4" fill="none" stroke="currentColor" rx="90.658" ry="18"/><text x="147" y="-1143.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;generated sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M150.501-1275.204l-2.72 99.316"/><path stroke="currentColor" d="M151.278-1175.726l-3.773 9.901-3.225-10.092 6.998.191z"/></g><g class="node"><path fill="none" stroke="currentColor" d="M720.077-1092.4H609.923v36h110.154v-36z"/><text x="665" y="-1070.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">compileTestJava</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M419.804-1133.67c51.231 12.385 126.549 30.59 180.172 43.552"/><path stroke="currentColor" d="M600.827-1093.513l8.898 5.752-10.542 1.052 1.644-6.804z"/></g><g class="node"><path fill="none" stroke="currentColor" d="M608.457-784.6h-92.914v36h92.914v-36z"/><text x="562" y="-762.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">generateTests</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M394.762-1130.444c18.904 12.62 39.238 31.823 39.238 56.044v234.8c0 35.275 37.135 53.729 71.402 63.248"/><path stroke="currentColor" d="M506.607-779.657l8.82 5.87-10.556.912 1.736-6.782z"/></g><g class="node"><path fill="none" stroke="currentColor" d="M812.359-511.8H701.641v36h110.718v-36z"/><text x="757" y="-489.6" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">transpileTestJ2cl</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M367.284-1129.214c3.089 14.7 6.716 35.973 6.716 54.814v517.2c0 31.748 207.482 51.107 317.024 59.116"/><path stroke="currentColor" d="M691.585-501.553l9.723 4.208-10.225 2.774.502-6.982z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M138.774-1129.204L93.53-1029.118"/><path stroke="currentColor" d="M96.638-1027.496l-7.309 7.671.93-10.554 6.379 2.883z"/></g><g class="node"><ellipse cx="147" cy="-839.6" fill="none" stroke="currentColor" rx="91.257" ry="18"/><text x="147" y="-835.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;transpiled sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M88.443-983.154l47.142 115.57"/><path stroke="currentColor" d="M138.947-868.609l.536 10.581-7.018-7.937 6.482-2.644z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M154.353-821.404L194.8-721.317"/><path stroke="currentColor" d="M198.053-722.608l.501 10.583-6.992-7.96 6.491-2.623z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M206.458-825.847C255.48-812.726 317-791.332 317-766.6v455.1c0 31.303 200.454 46.28 313.2 52.228"/><path stroke="currentColor" d="M630.688-262.752l9.806 4.011-10.167 2.98.361-6.991z"/></g><g class="node"><ellipse cx="860" cy="-1512.4" fill="none" stroke="currentColor" rx="38.274" ry="18"/><text x="860" y="-1508.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">src/test</text></g><g class="node"><path fill="none" stroke="currentColor" d="M832.459-1384.4H669.541v36h162.918v-36z"/><text x="751" y="-1362.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">stripTestGwtIncompatible</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M841.062-1496.482c-11.703 10.401-26.572 24.684-37.772 39.082-15.53 19.963-29.591 45.03-39.211 63.799"/><path stroke="currentColor" d="M767.084-1391.787l-7.616 7.365 1.361-10.507 6.255 3.142z"/><text x="828.855" y="-1435.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.java</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M860-1494.1v456.2c0 28.317 17.685 30.682 33 54.5 7.68 11.945 31.814 39.23 36 52.8 4.716 15.29 8.75 22.605 0 36-22.382 34.263-57.908 5.74-84.323 37C828.56-838.525 831-828.073 831-803.1v491.6c0 13.47-24.424 25.838-51.766 35.462"/><path stroke="currentColor" d="M780.071-272.626l-10.595-.124 8.36-6.51 2.235 6.634z"/><text x="904.661" y="-835.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.js !&#42;&#42;/&#42;.native.js</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M874.2-1495.613c10.433 14.071 22.8 35.184 22.8 56.213v401.5c0 24.961 2.098 32.328 13.564 54.5 14.22 27.5 30.877 25.477 45.436 52.8 11.814 22.172 15 29.377 15 54.5v318.9c0 31.337-85.428 48.385-148.333 56.69"/><path stroke="currentColor" d="M822.75-496.993l-10.361-2.211 9.478-4.733.883 6.944z"/><text x="947.718" y="-997.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.native.js</text></g><g class="node"><ellipse cx="741" cy="-1220.4" fill="none" stroke="currentColor" rx="100.464" ry="18"/><text x="741" y="-1216.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;stripped test sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M749.754-1348.204l-6.803 99.316"/><path stroke="currentColor" d="M746.437-1248.563l-4.175 9.738-2.808-10.216 6.983.478z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M731.528-1202.204l-52.299 100.469"/><path stroke="currentColor" d="M682.313-1100.079l-7.722 7.254 1.513-10.486 6.209 3.232z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M789.92-1204.667c24.942 11.398 50.08 29.72 50.08 57.267v109.5c0 25.123 2.654 32.62 15 54.5 10.475 18.564 16.105 21.805 33 34.8 13.243 10.186 24.472 3.634 33 18 8.167 13.758 9.373 23.033 0 36-15.355 21.244-93.94 18.004-112 37-17.31 18.207-15 29.377-15 54.5v245.9c0 13.375-6.218 26.438-13.556 37.198"/><path stroke="currentColor" d="M783.195-517.837l-8.778 5.932 3.163-10.111 5.615 4.179z"/></g><g class="node"><ellipse cx="577" cy="-912.6" fill="none" stroke="currentColor" rx="102.829" ry="18"/><text x="577" y="-908.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;compiled test classes&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M655.076-1056.154l-63.375 116.523"/><path stroke="currentColor" d="M594.606-937.645l-7.853 7.113 1.703-10.458 6.15 3.345z"/></g><g class="node"><ellipse cx="805" cy="-912.6" fill="none" stroke="currentColor" rx="106.806" ry="18"/><text x="805" y="-908.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;generated test sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M680.788-1056.154l101.918 117.79"/><path stroke="currentColor" d="M785.587-940.385l3.897 9.853-9.19-5.272 5.293-4.581z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M575.13-894.404l-10.203 99.316"/><path stroke="currentColor" d="M568.397-794.615l-4.504 9.59-2.46-10.306 6.964.716z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M789.137-894.79C778.34-880.801 766-860.29 766-839.6v282.4c0 11.626-1.502 24.334-3.279 35.299"/><path stroke="currentColor" d="M766.161-521.252l-5.187 9.238-1.706-10.457 6.893 1.219z"/></g><g class="node"><ellipse cx="562" cy="-620.6" fill="none" stroke="currentColor" rx="79.076" ry="18"/><text x="562" y="-616.4" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;generated tests&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M562-748.404v99.316"/><path stroke="currentColor" d="M565.5-649.025l-3.5 10-3.5-10h7z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M553.053-602.488C547.728-590.058 542-573.012 542-557.2v245.7c0 20.246 45.631 34.604 88.607 43.638"/><path stroke="currentColor" d="M631.469-271.259l9.109 5.411-10.495 1.451 1.386-6.862z"/><text x="642.519" y="-426.2" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/test_summary.json &#42;&#42;/&#42;.testsuite</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M588.299-603.5l132.113 85.908"/><path stroke="currentColor" d="M722.757-520.241l6.476 8.385-10.292-2.517 3.816-5.868z"/><text x="694.855" y="-553" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&#42;&#42;/&#42;.java</text></g><g class="node"><ellipse cx="705" cy="-145" fill="none" stroke="currentColor" rx="107.989" ry="18"/><text x="705" y="-140.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;closure compiled tests&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M705-237.67v64.121"/><path stroke="currentColor" d="M708.5-173.357l-3.5 10-3.5-10h7z"/></g><g class="node"><ellipse cx="705" cy="-367" fill="none" stroke="currentColor" rx="107.405" ry="18"/><text x="705" y="-362.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">&lt;transpiled test sources&gt;</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M757.004-475.726c-.58 14.936-2.783 36.42-10.004 53.726-4.347 10.42-11.162 20.6-18.047 29.313"/><path stroke="currentColor" d="M731.495-390.27l-9.086 5.448 3.706-9.926 5.38 4.478z"/></g><g class="edge"><path fill="none" stroke="currentColor" d="M705-348.67v64.121"/><path stroke="currentColor" d="M708.5-284.357l-3.5 10-3.5-10h7z"/></g><g class="node"><path fill="none" stroke="currentColor" d="M732-52h-54v36h54v-36z"/><text x="705" y="-29.8" font-family="Times,serif" font-size="14" text-anchor="middle" fill="currentColor">test</text></g><g class="edge"><path fill="none" stroke="currentColor" d="M705-126.67v64.121"/><path stroke="currentColor" d="M708.5-62.357l-3.5 10-3.5-10h7z"/></g></g></svg>
<!--
digraph {
    subgraph clustermain {
        "src/main" -> stripGwtIncompatible [label="**/*.java"]
        stripGwtIncompatible [shape=box]
        stripGwtIncompatible -> "<stripped sources>"
        "<stripped sources>" -> compileJava
        compileJava [shape=box]
        compileJava -> "<compiled classes>"
        compileJava -> "<generated sources>"
        "src/main" -> transpileJ2cl [label="**/*.native.js"]
        "<stripped sources>" -> transpileJ2cl
        "<generated sources>" -> transpileJ2cl
        transpileJ2cl [shape=box]
        transpileJ2cl -> "<transpiled sources>"
        "src/main" -> compileClosure [label="**/*.js !**/*.native.js"]
        compileClosure [shape=box]
        "<transpiled sources>" -> compileClosure
    }

    subgraph clustertest {
        "src/test" -> stripTestGwtIncompatible [label="**/*.java"]
        stripTestGwtIncompatible [shape=box]
        stripTestGwtIncompatible -> "<stripped test sources>" 
        "<stripped test sources>" -> compileTestJava
        "<compiled classes>" -> compileTestJava
        compileTestJava [shape=box]
        compileTestJava -> "<compiled test classes>"
        compileTestJava -> "<generated test sources>"
        { rank="same"; "<compiled test classes>" "<generated test sources>"}
        "<compiled classes>" -> generateTests
        "<compiled test classes>" -> generateTests
        generateTests [shape=box]
        generateTests -> "<generated tests>"
        "<generated tests>"
        "<generated tests>" -> compileTestClosure [label="**/test_summary.json **/*.testsuite"]
        "<generated tests>" -> transpileTestJ2cl [label="**/*.java"]
        "src/test" -> transpileTestJ2cl [label="**/*.native.js"]
        "<compiled classes>" -> transpileTestJ2cl
        "<stripped test sources>" -> transpileTestJ2cl
        "<generated test sources>" -> transpileTestJ2cl
        transpileTestJ2cl [shape=box]
        transpileTestJ2cl -> "<transpiled test sources>"
        "<transpiled sources>" -> compileTestClosure
        "<transpiled test sources>" -> compileTestClosure
        "src/main" -> compileTestClosure [label="**/*.js !**/*.native.js"]
        "src/test" -> compileTestClosure [label="**/*.js !**/*.native.js"]
        compileTestClosure [shape=box]
        compileTestClosure -> "<closure compiled tests>"
        "<closure compiled tests>"
        "<closure compiled tests>" -> test
        test [shape=box]
    }
}
-->

The code for these tasks and sample project is available [on Github][gradle-j2cl-plugin].

[gradle-j2cl-plugin]: https://github.com/tbroyer/gradle-j2cl-plugin

Next steps
----------

Now that we have the building blocks and are able to wire them together for a simple example,
the next steps will be:
 * handling external dependencies (stripping and transpiling them on-the-fly)
 * handling project dependencies (a library subproject would expose its transpiled sources to an application subproject)
 * defining conventions to make things as simple as applying a Gradle plugin (a J2CL application would be the easiest, as libraries could target J2CL, GWT, the JVM, J2ObjC, etc.)
