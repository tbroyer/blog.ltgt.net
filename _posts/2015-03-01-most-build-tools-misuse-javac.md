---
layout: post
title: Most build tools misuse javac
published: true
discuss_url: https://plus.google.com/113945685385052458154/posts/HsAxSiwynqK
---

Over the past couple years, I've been looking more closely to the build tools
I use and trying to imaging what the _[ultimate build tool]_ would look like.
Doing that, I regularly stumble on mistakes in one tool that seem to be copied
over most (if not all) of them like _cargo cult_. Recently, I've had gripes
with `javac`, or more accurately how it's used by build tools, and started
investigating further. But first, let's see how `javac` works.

[ultimate build tool]: /in-quest-of-the-ultimate-build-tool

**EDIT(2015-03-08):** the _source path_ issue has been fixed in [Buck][buck-fix]
and [Gradle][gradle-release-notes].

[buck-fix]: https://github.com/facebook/buck/commit/c75bb91f7d8eec8ea8ed86b598fb2ef3bb67a3bf
[gradle-release-notes]: https://gradle.org/docs/2.4/release-notes#changes-to-default-value-for-java-compilation-sourcepath

How does `javac` work?
----------------------

[`javac`] takes as input a _boot class path_, _class path_, _source path_,
_processor path_, _extension dirs_, list of source files to compile, and list
of class files to run annotation processors on.

[`javac`]: https://docs.oracle.com/javase/8/docs/technotes/tools/unix/javac.html

 * The _boot class path_ is used for cross-compilation, you should use it as
   soon as you target a version of Java different from the one `javac` shipped
   with. It defaults to the same _boot class path_ used at runtime with the
   platform `javac` shipped with.

 * The _class path_ is also similar to the one used when running Java
   programs. It's where `javac` will look for compiled classes referenced by
   input source files (i.e. dependencies). It defaults to the current directory
   if not set.

 * The _source path_ is where `javac` will look for source files for classes
   referenced by the input source files. Those might end up being implicitly
   compiled. This is what we'll mainly discussed today. The _source path_
   defaults to the _class path_ if not set.

 * The _processor path_ is where `javac` will look for annotation processors;
   it will too default to the _class path_ if not set.

 * The _extension dirs_ contains JARs that are automatically added to the class
   path. Each JRE comes with its own _extension dir_ prepopulated with a few
   JARs: PKCS#11, locale data, Nashorn (Java 8), etc. When cross-compiling, you
   should pass the _extension dirs_ for the target JRE.

Let's ignore annotation processing and cross-compilation for now.

You can then control the behavior of `javac` with several options. Let's look
at a few of them:

 * `-⁠encoding` tells `javac` how source files (both the _input source files_ and
   the ones found in the _source path_) are encoded, defaulting to the platform
   default if not set. Nowadays [you should use UTF-8] so you should always be
   passing `-⁠encoding UTF-8`.

 * `-⁠d` indicates where class files will be written. If not set, they're output
   next to the corresponding source file. I don't think anybody uses that
   behavior anymore, so you'll likely use that option.

 * `-⁠implicit:class` and `⁠implicit:none` control what to do when a source file
   is implicitly compiled form the _source path._ See below for more about that.

 * `-⁠source` specifies the version of the source code. Note that depending on
   the value, it might trigger cross-compilation. Unless you're cross-compiling,
   this option is actually mostly useless.

 * `-⁠Xprefer:newer` and `-⁠Xprefer:source` control when `javac` will implicitly
   compile files from the _source path._ See below for more.

 * `-⁠Xpkginfo:always`, `-⁠Xpkginfo:legacy`, and `-⁠Xpkginfo:nonempty` tell `javac`
   when to generate a `package-⁠info.class` for a given `package-⁠info.java`
   source file. This option is only available starting with JDK 7. As the
   documentation points out, `-⁠Xpkginfo:always` will help incremental builds
   when they check the output for each input (rather than the set of inputs vs.
   the set of outputs as a whole.)

[you should use UTF-8]: http://www.utf8everywhere.org/

What's interesting, and counter-intuitive, is that `javac`, when looking for
information on types referenced by the input source files, could implicitly
compile other source files, looked up in the _source path._ And even less
intuitive is that `javac` will look for both a compiled class (in the class
path) and source file (in the source path) for each type, and will by default
prefer the newer when both are found. You can control this behavior using the
`-⁠Xprefer:source` and `-⁠Xprefer:newer` options. Note that there's no
`-⁠Xprefer:class`, and this is where many build tools start to get things wrong.
Finally, when such types are implicitly compiled, class files are generated
by default; you can control that with the `-⁠implicit:class` and `-⁠implicit:none`
options (`-⁠implicit:class` being the default behavior).

So, `javac` isn't without flaws, and as I said, this is where build tools start
to get things wrong. To fully understand how and why, let's look at how those
tools work and what their expectations are.


How do build tools work?
------------------------

First, I'll only talk about _modern_ and _high-level_ build tools that are Maven,
Gradle and Buck. I know there are many others around (Buildr, Pants, etc. even
Ant would be worth the look), I just haven't taken the time to look at how they
deal with it.

Maven and Gradle use similar project layouts: each _project_ has its own folder
where all sources are put and generally compiled as a whole (in at least two
phases actually: tests are compiled separately). You can however, with a bit more
work, partition source files using globs in _includes_ and _excludes_ patterns.
And of course each project declares its external dependencies, with different
_scopes_ depending on where they'll be used (compile-time, runtime, tests, etc.)
The result of the compilation goes to a specific directory: Maven uses the same
output directory as the one it also copies resources, whereas Gradle uses a
specific output directory for each task (which greatly helps for incremental
builds, but that's not today's subject.)

With Buck however, one (or two) giant source tree is split into several
compilation tasks, generally per package, but not necessarily (one task could
include subpackages except a few ones, you can use includes/excludes patterns
to partition a package, which is sometimes used to put both production classes
and tests in the same source tree, etc.) FWIW, resources also live in that same
source tree. And just like Gradle, Buck uses a specific output directory for
each compilation task.

Generally speaking, all three tools have a well-defined list of inputs (both
dependencies and source files) and an output directory (remember that `-⁠d`
option of `javac` we've talked about above?) Knowing that, you would think they
should all three work in quite similar ways? You'd be wrong. Let's see how, but
first let's define how we'd expect those tools to work with `javac`.

How do I expect build tools to use `javac`?
-------------------------------------------

Let's get the easy things first: dependencies go in the _class path_, the output
directory is passed as `-d`, and input source files are passed each one as an
argument.

As seen above, the `-⁠encoding` should also always be explicit (and I suggest
using `UTF-8` by default).

If you only do that though, you risk compiling source files implicitly loaded
from the classpath. [It has happened before][gwt issue 3439] (and remember
that there's no `-⁠Xprefer:class`, and no way to prevent `javac` from implicitly
loading source files). So you need to pass an explicit _source path_.

[gwt issue 3439]: https://code.google.com/p/google-web-toolkit/issues/detail?id=3439

What should be put in _source path_? If you use your _source roots_, then you'll
risk you includes/excludes patterns to not be respected. [It has happened before].
I propose that _source path_ be empty (it's as easy as using `-⁠sourcepath :` or
`-⁠sourcepath ""`.)

[It has happened before]: https://jira.codehaus.org/browse/MCOMPILER-26
[generates a warning]: https://jira.codehaus.org/browse/MCOMPILER-180

As seen above, `-⁠target` (and `-⁠source`, which controls `-⁠target`) should never
be used without setting the _boot class path_ and _extension dirs_. Even a tool
like [animal sniffer], [doesn't guarantee] your code will run [without issues].
What build tools should do is let you easily require a minimum JDK version for
development, and a specific version for releases (unless you properly setup
cross-compilation by also setting the _boot class path_ and _extension dirs_),
and use animal sniffer to make sure you at least don't call APIs from a newer
Java version.

[animal sniffer]: http://mojo.codehaus.org/animal-sniffer/
[doesn't guarantee]: http://developer-blog.cloudbees.com/2014/12/beware-siren-target-call.html
[without issues]: http://www.draconianoverlord.com/2014/04/01/jdk-compatibility.html

Now that we know how to use `javac`, and how we'd want our build tools to use
it, we can starting looking at what they actually do, and specifically what they
get wrong.

How do build tools misuse `javac` then?
---------------------------------------

### What does Maven do wrong?

I'll start with Maven.

The maven-compiler-plugin has default values for `-⁠source`
and `-⁠target`, with very _oldish_ defaults (`1.5` in the latest version released
two years ago, but it was `1.4` not so long ago). This more or less forces you
to redefine the values in every project. You can enforce a JDK version using the
maven-enforcer-plugin's [`requireJavaVersion` rule], and using profiles you could
easily have different things for development and releases; and animal sniffer is
designed with Maven as the first consumer. Maven also supports _toolchains_ for
quite a while, which let's you use a specific JDK version different from the one
you run Maven with. It's rather limited and incomplete though (the toolchain
applies to the whole lifecycle, not just to one plugin, for example; and
developers have to create the appropriate toolchain definitions on their machine
to be able to build a project making use of them.)

[`requireJavaVersion` rule]: https://maven.apache.org/enforcer/enforcer-rules/requireJavaVersion.html

The maven-compiler-plugin (or is it the plexus-compiler?) sets the _source roots_
as the _source path_, which we've seen above is wrong as soon as you use
includes/excludes patterns. Strangely, that was fixed [long ago], but was then
[reintroduced][MCOMPILER-98] (for bad reasons) a few years later, and [reported
again] as a bug since then. I made a repro case if you want to try it:
<https://gist.github.com/tbroyer/d3ddd1851beeff5868cc>

[long ago]: https://jira.codehaus.org/browse/MCOMPILER-26
[MCOMPILER-98]: https://jira.codehaus.org/browse/MCOMPILER-98
[reported again]: https://jira.codehaus.org/browse/MCOMPILER-174

Beware too that the maven-compiler-plugin 3.2 also has an issue when used with
annotation processing: it adds the _generated sources output directory_ to the
_source path_ (more accurately to its _source roots_, which it uses as the
_source path_), [causing compilation errors].

[causing compilation errors]: https://jira.codehaus.org/browse/MCOMPILER-235

Finally, maven-compiler-plugin 3.x uses a new approach to incremental builds
that recompiles all source files as soon as it detects one changed file (it
previously only recompiled the changed sources, which [causes issues] when you
change an API that's used by other, untouched, classes), but it apparently
still tries to somehow match `.java` and `.class` files to each others, which
[won't work for `package-info.java`][MCOMPILER-205] classes, that don't always
generate a `package-info.class` by default. maven-compiler-plugin should use
`-⁠Xpkginfo:always`, but it only works starting with Java 7, and Maven has
committed to support very old JDKs…

[causes issues]: https://cwiki.apache.org/confluence/display/MAVEN/Incremental+Builds
[MCOMPILER-205]: https://jira.codehaus.org/browse/MCOMPILER-205

### What does Gradle do wrong?

Gradle doesn't pass a `-⁠source` and `-⁠target` by default, which is good, but it
lets you easily set them. It however lets you easily set the _boot class path_
and _extension dirs_ too, so it's not so bad. Gradle is gaining support for
_toolchains_ similar to Maven, but it's not usable yet. It'll likely be more
flexible than Maven's take on it, but I fear the toolchain definitions will be
defined right in the build script, despite not being portable across developer
machines, particularly when not using the same operating system (each developer
will probably have different paths to the JDKs.)  
You can quite easily enforce a particular JDK version using snippets like the
following in your build script:

```groovy
assert JavaVersion.current().isJava8Compatible()
```

or

```groovy
assert JavaVersion.current() == JavaVersion.VERSION_1_8
```

And [there's a plugin] for animal sniffer.

[there's a plugin]: https://bitbucket.org/lievendoclo/animalsniffer-gradle-plugin

~~Gradle doesn't pass a _source path_, which we've seen is wrong. Here's a small
repro case if you want: <https://gist.github.com/tbroyer/d8174f5eb99bdb7f291b>
and I've [reported the issue](http://forums.gradle.org/gradle/topics/gradle-should-pass-sourcepath-to-javac-by-default-to-avoid-false-positives).~~
**Edit(2015-03-08,2015-05-14):** Gradle has been [fixed][gradle-release-notes]; the fix
shipped in 2.4.

No `-⁠encoding` by default, but [easy to configure].

[easy to configure]: http://gradle.org/docs/current/dsl/org.gradle.api.tasks.compile.CompileOptions.html#org.gradle.api.tasks.compile.CompileOptions:encoding

### What does Buck do wrong?

Buck always passes a `-⁠source` and `-⁠target` (defaults to `1.7` though). It
lets you define the _boot class path_ (even though it's undocumented) but not
_extension dirs._ You can however do that easily thanks to `extra_arguments`.
Note that this configuration is global to your project. There's no way to plug
animal sniffer or other similar tools too, and no way to enforce a JDK version
(so by default, if you use a JDK 8, you'll risk producing classes that won't
run with Java 7 despite the default `target_level=7` configuration.) I suppose
you could do something using a `gen_rule`, though that'd be a hack if you ask
me.

~~Like Gradle, Buck doesn't pass a _source path_. Here's a small repro case:
<https://gist.github.com/tbroyer/512941cd798e1ccba4b4> and I've [reported the
issue](https://github.com/facebook/buck/issues/244).~~
**Edit(2015-03-06):** Buck has been [fixed][buck-fix].

No `-⁠encoding` either, Buck assumes your environment is already UTF-8 (which
is a not-so-wrong assumption), but it can be passed using `extra_arguments` if
you prefer being explicit.

Conclusion
----------

As we've seen, all three build tools studied above misuse `javac`, each in a
different way. Fortunately, there are workarounds for most flaws (if not all).
I'd be happy to get feedback on how other build tools behave.

### What's next?

I've looked a bit at [Pants](https://pantsbuild.github.io/) and it uses JMake
under the hood, with a customized in-process `javac` call that tracks the
mapping between inputs and outputs (to the extent that `javac` provides the
information). Contrary to all three build tools above, JMake will try to make
a truly incremental build, recompiling only the changed classes and all those
that depend on them (JMake even claims that it parses the code and looks at
changed APIs and which classes call them). I haven't yet investigated how JMake
actually calls `javac`, and Pants is currently not easy to setup (at least
according to its documentaton.)

I'll probably have a quick look at Ant too. It's a bit low-level but provides
some high-level features for incremental builds. I suppose however that whether
your build is _broken_ or not would depend a lot on how you use Ant, not just
how Ant uses `javac`.

Also, Takari provide a [custom Maven lifecycle] replacing most (if not all)
standard plugins with their own. I haven't yet looked at how they call `javac`,
and how they use ECJ/JDT for incremental compilation (looks like they could use
JMake, and possibly the custom Twitter Compiler, to bring their incremental
compilation to `javac`, and get annotation processing working at the same time.)

[custom Maven lifecycle]: http://takari.io/book/40-lifecycle.html
