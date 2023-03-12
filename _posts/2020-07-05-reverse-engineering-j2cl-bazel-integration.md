---
layout: post
title: Reverse-engineering J2CL–Bazel integration
discuss_url: https://dev.to/tbroyer/reverse-engineering-j2cl-bazel-integration-1o1f/comments
---

J2CL is a tool by Google that transpiles Java code to Closure-compatible JavaScript.
It's been started in 2015 to eventually replace GWT at Google,
for various reasons explained in the [project README],
and will be used as the basis for GWT 3.
As a Google project, it's deeply integrated with their build tool: [Bazel].
We'll look at how it all works,
with the goal to create an equivalent [Gradle] plugin.

[project README]: https://github.com/google/j2cl#j2cl-vs-gwt
[Bazel]: https://bazel.build
[Gradle]: https://gradle.org

This reverse-engineering work has already been done several times,
I had done it a couple times a few years ago,
but I don't think it's ever be documented though,
so here it is.

<ins datetime="2020-07-28">**EDIT(2020-07-28):** j2cl-maven-plugin [now](https://github.com/Vertispan/j2clmavenplugin/commit/97c5409c6941ec37b58e74ae883294e7885c98fb) serves tests using a web server.</ins>

Starting points
---------------

From a user point of view,
the main starting points are the Bazel rules `j2cl_library` and `j2cl_application`.

The `j2cl_application` rule is actually just a macro around the [`rules_closure`][rules_closure] rules.
It takes as input `closure_js_library` and `j2cl_library` dependencies,
and entry point Closure namespaces (that must be present in the dependencies),
and produces optimized JavaScript through a `closure_js_binary` rule,
with a handful configuration options.
It also generates a `web_library` rule for running your code during development,
we'll come back to it later.

[rules_closure]: https://github.com/bazelbuild/rules_closure

As we just saw, a `j2cl_application` doesn't directly have sources,
but takes them as dependencies.
All the code of your application would thus actually be in a `j2cl_library`.

A `j2cl_library` rule is what actually translates your Java source to JS.
It takes Java source files as input
and produces a JAR of compiled Java classes,
and a ZIP of the transpiled JS (known as a JSZip).

Finally, there are rules for tests
(we'll get to them later on),
and for importing third-party libraries,
including from Maven repositories.

`j2cl_library`
--------------

Let's look closer at what a `j2cl_library` does.

A `j2cl_library` is somehow both a `java_library` and a `closure_js_library`.
It takes as input a set of Java and JS source files,
along with dependencies that can be either `closure_js_library` or other `j2cl_library` rules.
Note that in Bazel, Java code that's also used in the server for example will **also** be used by a `java_library`.

A `j2cl_library` will start by removing all the code from the Java source files that's annotated with `@GwtIncompatible`
(technically, it replaces that code with spaces, such that line numbers are preserved).
This stripped code will then be compiled with `javac`;
this step could also produce new Java sources through annotation processing
(technically, it could even generate JS files).
The Java and JS source files, and the ones generated during compilation,
will then be passed to J2CL to generate a Closure JS library.

To transpile Java code,
J2CL needs the dependencies as compiled Java classes to resolve the Java APIs
(specifically the method overloads, implicit casts, or even type inference through Java 10's `var` keyword);
those need to be the *stripped* variants of the dependencies,
which is why `j2cl_library` rules depend on other `j2cl_library` rules,
and not on *standard* `java_library` rules.
J2CL also resolves `.native.js` files sibling to the `.java` files,
that generally contains JS code implementing `native` methods (somehow equivalent to GWT's JSNI),
and concatenates their content into the generated `.js` files.
It should be noted that the `javac` step replaces the bootstrap classpath
with the Java Runtime Emulation library
(which is almost-100% shared with GWT).

So, a `j2cl_library` outputs both a JAR like a `java_library`,
except the sources have been stripped of any `@GwtIncompatible` code first,
and a ZIP of JS files like a `closure_js_library`.

Technically, in Bazel, a `j2cl_library`, just like a `closure_js_library`,
also type-checks the JS (this is probably a bit redundant in J2CL's case, though thereare the `.native.js` files too),
and outputs metadata files about the library
to help speed up downstream Closure JS libraries
(by not rebuilding / re-type-checking them when their upstream API hasn't changed;
this is similar to how Bazel, and Gradle, extract an API-only JAR/info from Java classes)
and pass diagnostic suppressions down to the Closure compilation.
This is quite specific to Bazel and the `rules_closure`,
though could possibly be implemented in Gradle as well
(the way Gradle extracts and checks the API-only info from Java classes
is entirely different from how Bazel does it though:
Gradle apparently fingerprinting a whole classpath of a Java compilation,
whereas Bazel generates an iJAR for each `java_library` and then compares those files checksums as any other input).

As we saw, a `j2cl_library` leverages three tools:
* `GwtIncompatibleStripper`
* `javac`
* and finally `J2clTranspiler`

And last, but not least, those tools are all run in persistent worker processes,
so you don't have to spawn a JVM every time
(which with Bazel's design of having rules almost for each Java package,
would mean a **lot** of times).

Importing JARs
--------------

There are three Bazel rules for importing JARs in J2CL.

The `j2cl_import` rule is a simple *bridge* for when you need a `j2cl_library` to depend on a `java_library`;
this should only be used for annotation-only JARs though
(J2CL doesn't need the sources for annotations, and they don't generate JS code;
they're only useful to trigger annotation processors,
or configure static analysis tools, such as [ErrorProne]).

[ErrorProne]: https://errorprone.info

The `j2cl_import_external` rule takes a set of alternative URLs to a JAR (and its SHA256 checksum),
and generates either a `j2cl_import` for annotation-only JARs,
or a `j2cl_library`.
In the latter case, the JAR should then contain Java sources.
It is actually expected to be GWT library,
with super-sources in `super` subpackages.
The `j2cl_library` will then use the super-sources
(and ignore the equivalent super-sourced files, that is then GWT-incompatible),
and also ignore any `*_CustomFieldSerializer*` file
(as Google doesn't use GWT-RPC anymore, and thus didn't port it to J2CL).

Finally, the `j2cl_maven_import_external` rule is a wrapper around `j2cl_import_external`
simply generating the URLs from Maven coordinates and a set of Maven repository URLs.
It should be noted that this macro uses the sources JAR,
i.e. it replaces the classifier and packaging with `sources` and `jar` respectively.

Yes, you understand it right:
those last two rules will only consider source files in the JARs
(unless they are annotation-only JARs)
and will therefore strip their `@GwtIncompatible` code
and (re)compile them with `javac`,
before finally translating them to JS.
It is thus expected that the JARs either include all the source code
(most importantly including the sources generated by annotation processing),
or that, possibly, their dependencies are configured in such a way that
the `javac` step will be able to process the annotations and generate the missing files.
GWT libraries would fall in the former bucket,
but their sources JAR as deployed in Maven repositories might not,
so when reproducing this outside Bazel,
we'd possibly make different choices.

Actually, if you look at the J2CL repository,
you'll see that it has to use a different technique when importing the jbox2d library,
as that one puts super-sources in a `gwtemul` subpackage
(and includes GWT-incompatible code in another package).
In this specific case, it grabs the sources from GitHub,
filters out the super-sourced or J2CL-incompatible files,
and then declare a `j2cl_library` for those source files
(therefore really rebuilding the library from sources).

`j2cl_application`
------------------

As we briefly saw above, this macro is actually only a (rather simple) *helper* to generate Closure rules,
and you could actually just use the Closure rules directly.
This means that this rule is actually not concerned at all with J2CL,
except for the few configuration options it passes to the Closure compiler.

The inputs to the Closure compiler are the transitive closure of all the `closure_js_library`
and the JS output of the `j2cl_library` dependencies.
This is the only place where the JS output of the `j2cl_library` rules are used;
when a `j2cl_library` depends on another `j2cl_library`, as we saw above,
it only uses its JAR output.

It's interesting to look at how users woud run and debug their code though:
the `j2cl_application` will generate a JS non-optimized version
(mostly as a `closure_js_binary` with different configuration),
and an HTML file that to load it,
and will launch a development server to serve them all.
The HTML page and dev server are also `ibazel` and livereload aware,
such that if run through `ibazel` the page will *livereload* whenever a source file is changed.

There are notes in the code about applications with *custom dev servers*,
one could imagine servers that guard the page behind authentication,
or need to somehow inject dynamic things into the page.
This is left undocumented for now though.
In any case, for those who know [how GWT's super dev mode works][how-does-gwts-super-dev-mode-work],
this is much different, much more like `parcel serve` than `parcel watch` for those who know JS development with [Parcel], and without hot module replacement (HMR);
though we do not really know how GWT development works at Google with Bazel,
the [`rules_gwt`][rules_gwt] being developped and maintained by a Googler whose not in the GWT team.

[how-does-gwts-super-dev-mode-work]: {% post_url 2012-06-10-how-does-gwts-super-dev-mode-work %}
[Parcel]: https://parceljs.org/
[rules_gwt]: https://github.com/bazelbuild/rules_gwt

Tests
-----

Tests are defined by `j2cl_test` rules,
whose implementation has not actually been open sourced ([yet][j2cl_roadmap]).
Those rules can be generated through a `gen_j2cl_tests` rule,
where we can learn a bit more about it,
though we'll actually learn more by looking at how it's used in J2CL's own tests.

[j2cl_roadmap]: https://github.com/google/j2cl/issues/93

Each `j2cl_test` rule corresponds to only one test class,
which can be test case or a test suite.
It should be noted that J2CL supports both JUnit 3 and JUnit 4 tests cases,
but only supports JUnit 4 test suites.

Tests can be run in two flavors: `compiled` or not;
I *suppose* it means whether to use optimized or unoptimized Closure output.
And they can be run in several specific browsers,
or, I suppose, against a set of globally-defined ones.

In the J2CL Git repository, we can also find an unused `j2cl_generate_jsunit_suite` macro,
which is probably used internally at Google by the `j2cl_test` rule.
It takes as input a test class name,
generates a dummy Java file that references it in a `@J2clTestInput` annotation,
and compiles it with an annotation processor that will generate support files.
So, the dummy Java file is **only** used to trigger the annotation processor,
but is otherwise completely useless.
The processor will generate
a `test_summary.json` file describing the tests,
a JS file for each test case,
and a Java file that needs to be processed by J2CL and is used by the JS files.
Compilation is done through a `j2cl_library`,
so the JS files actually have a `.testsuite` extension
such that they're not picked up by J2CL.
Technically, the dummy Java file could be processed using `javac -proc:only`,
and then the generate Java file processed by J2CL without needing to be compiled to a Java class first.
In the Bazel macro, the output of the `j2cl_library` is then processed
to generate a ZIP containing only JS (with `.testsuite` renamed to `.js`) and the `test_summary.json`.
The `jsunit_test` referenced in the macro
is probably similar to the `closure_js_test` rule from `rules_closure`,
but we can't really know.

To actually learn more about how testing works with J2CL,
we have to look at the ongoing [`j2cl-maven-plugin`][j2cl-maven-plugin] effort,
whose dev team asked Google how to actually do it.

[j2cl-maven-plugin]: https://github.com/Vertispan/j2clmavenplugin

In the Maven plugin,
test cases (or test suites) are expected to be annotated with `@J2clTestInput`
directly referencing the annotated class
(whereas in Bazel, the annotation is actually entirely kept as an implementation detail).
The plugin will itself compile the classes
(despite them already having been compiled by the `maven-compiler-plugin`),
because is will also, as Bazel does, first strip `@GwtIncompatible` code,
and add the annotation processor to the compilation process.
It will then read the generated `test_summary.json` and, for each test,
copy the generated `.testsuite` file to `.js`,
run the Closure compiler on it,
similar to a `j2cl_application` with that script as the entry point,
generate a simple HTML file loading the resulting script,
and finally load that page in a browser to actually run the tests.
To detect that the tests have finished running,
the plugin will poll the page for specific JS state;
this is actually the same as the `phantomjs_test` plumbing in `rules_closure`.
<del datetime="2020-07-28">AFAICT, the main difference from `rules_closure` is that
the HTML page is loaded as a `file://` URL in the Maven plugin,
whereas it's actually served through HTTP in the `rules_closure` test harness,
and this can actually have real consequences when dealing with cookies, resources, or HTTP requests.</del>  
<ins datetime="2020-07-28">**EDIT(2020-07-28):** the Maven plugin [now](https://github.com/Vertispan/j2clmavenplugin/commit/97c5409c6941ec37b58e74ae883294e7885c98fb) uses an HTTP server.</ins>

Closing thoughts
----------------

Gradle should have all that's needed to make it performant to build
a similar tooling as the J2CL–Bazel integration described here:
built-in up-to-date checks for performant incremental builds,
variants (JS vs Java classes for a J2CL library),
worker processes for best performance,
artifact transforms for J2CL'ing external dependencies
(with built-in caching),
continuous builds for rerunning the whole build pipeline on file change,
etc.

I'll try to design such a Gradle plugin in a following post. Stay tuned!
