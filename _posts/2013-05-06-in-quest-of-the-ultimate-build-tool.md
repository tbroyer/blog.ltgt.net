---
layout: post
title: In quest of the ultimate build tool
published: true
discuss_url: https://plus.google.com/113945685385052458154/posts/fkks9Uu48jo
---
It all began last December when [Lex Spoon] published [Recursive Maven considered
harmful]. Using Maven for a few years without any real issue (though with some frustration), that piqued my curiosity.

Among other things, Lex argues that builds should be file-based (with MD5 or SHA1
hashes) when many _modern_ build tools are task-based, and have the notion of a
project made of several modules.

[Lex Spoon]: https://plus.google.com/111102660583646544610
[Recursive Maven considered harmful]: http://blog.lexspoon.org/2012/12/recursive-maven-considered-harmful.html

That got me thinking; and I started researching what build tools were doing,
looking at (but not testing, only reading their docs) Gradle, SBT, SCons, etc.
(read the comments on Lex's blog; if I made any mistake there or hereafter, or if
there's any inaccuracy, please come discuss on Google+)

There's been a few other interesting discussions around the topic in the following
weeks (all from Google alumni and all leaning in the same direction):

 * [Monetology moving to Rake](https://plus.google.com/108767398608071205202/posts/Kg6yZ2MYAS2)
 * [“I used to like Maven, and then I started using it”](https://plus.google.com/111102660583646544610/posts/ikP6HtgFtnw)


Enter Buck
----------

Fast forward to mid-April: Xoogler Michael Bolin, now at Facebook, releases an
Open Source clone of [Google's Blaze build system], specialized for building
Android apps (but [aiming at supporting any Java project][buck-issue-7]) and without
the distributed build nature of Blaze: [Buck].

[Google's Blaze build system]: http://google-engtools.blogspot.fr/2011/08/build-in-cloud-how-build-system-works.html
[buck-issue-7]: https://github.com/facebook/buck/issues/7
[Buck]: http://facebook.github.io/buck/

<blockquote class="twitter-tweet" align="center"><p>@<a href="https://twitter.com/tbroyer">tbroyer</a> Interesting. I like that aspect. I mostly take issue with them not solving any of the existing hard problems around Android builds.</p>&mdash; Jake Wharton (@JakeWharton) <a href="https://twitter.com/JakeWharton/status/325002919034363907">April 18, 2013</a></blockquote>

[Contrary to many _modern_ build tools], Buck is **only** a build tool: it doesn't
manage dependencies, releases, or publishing produced artifacts to some repository,
and won't let you _run_ those produced artifacts (you'll have to write some docs
or scripts for that). All it does is build your project and run tests on it (and
installing it to your Android device for testing/debugging). Oh, and yes, it'll also
generate IntelliJ IDEA project files (which is fun since Buck seems to be coded in
Eclipse according to some code comments and commit logs).

[Contrary to many _modern_ build tools]: https://plus.google.com/114156500057804356924/posts/Muoq6gy3cCM

<blockquote class="twitter-tweet" align="center"><p>Solving an actual Hard Problem™ for Dart's build system. <a href="http://t.co/HaUcrx1ajB" title="http://news.dartlang.org/2013/04/pubs-new-constraint-solver.html">news.dartlang.org/2013/04/pubs-n…</a> Don't tell Facebook that this is what real build systems do.</p>&mdash; Jake Wharton (@JakeWharton) <a href="https://twitter.com/JakeWharton/status/325342363427954689">April 19, 2013</a></blockquote>
<script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

If you want managed dependencies, you'll have to use [Ivy] or build a small tool around
Ivy or [Aether] that could download artifacts and generate the appropriate `BUCK` file.

[Ivy]: http://ant.apache.org/ivy/
[Aether]: http://eclipse.org/aether/

Maven → Buck
------------

And then 10 days later, [Shawn Pearce announces] working on replacing Maven with
Buck for building Gerrit. He claims the build is more reliable and faster than
with Maven.

[Shawn Pearce announces]: https://groups.google.com/d/topic/repo-discuss/Ab4y-D8lcWI

With the recent additions of plugins to Gerrit, some features being
moved to plugins, and those plugins thus being bundled in the release WAR for
backwards compatibility, I can understand that releasing Gerrit has become a
bit harder and you could screw it easily. The refactored Buck build makes use
of Git submodules to bring the core plugins in the source tree, something that
would probably have been possible for Maven too (but that wouldn't have solved
everything).

**So, is Buck faster?** I first ran Maven with as many threads as Buck is using,
i.e. 1.25 per CPU core, building the Gerrit WAR and skipping tests (I ran the
build twice, so all dependencies were downloaded already for the second build):

```
$ time mvn package -DskipTests -pl gerrit-war/ -am -T 1.25C
…
real    3m0.004s
user    10m49.532s
sys     0m28.340s
```

Then I ran Buck; in two steps: first downloading all dependencies, and then
building the Gerrit WAR:

```
$ buck build `buck targets |grep '^//lib/' |grep -v LICENSE`
$ time buck build :gerrit
BUILDING //:gerrit
BUILD SUCCESSFUL

real    2m7.408s
user    9m58.164s
sys     0m38.648s
```

**DISCLAIMER:** This is by no mean a benchmark; I ran those builds with several
other processes running (including Chrome and Jekyll where I write this post).
<p style="text-align: center"><a href="http://xkcd.com/303/"><img alt="" src="http://imgs.xkcd.com/comics/compiling.png" style="width: 413px; height: 360px"></a>

Is Buck faster? Well yes, and it gets slightly better for incremental / non-clean
builds (the following one is a no-op; the Maven build includes calls to Ant that
don't do staleness checks though so the results unfortunately aren't really
meaningful, but that would to the overall complexity of the `pom.xml`; the Maven
build could also possibly be made faster by using the latest versions of plugins,
e.g. `maven-compiler-plugin` 3.1 rather than 2.3.2):

```
$ time mvn package -DskipTests -pl gerrit-war/ -am -T 1.25C
…
real    0m55.824s
user    0m39.472s
sys     0m16.236s
$ time buck build :gerrit
BUILDING //:gerrit
BUILD SUCCESSFUL

real    0m10.640s
user    0m6.220s
sys     0m1.528s
```

In the end, the choice of Buck for Gerrit is more about maintainability of the
build definition files (note also that this is just a first step, the second
one being moving files back into a single big source tree; more on that later).
But actually much more importantly, paraphrasing Lex:

 * You never need to run `buck clean` (even just after switching branches, even just before releasing).
 * You can pick any Buck target, in your entire tree of code, and confidently tell Buck just to build that one target.
 
And I don't think anyone would disagree here that most _modern_ build tool will
get it wrong: they'll probably leave files in their `target/` that wouldn't have been
generated by a clean build (this is generally the case when you switch branch and
some files don't exist in the new branch, or you simply deleted a source file).

Internals
---------

What strikes me is that Buck performs well even though it does a whole lot of stuff.
The very first thing Buck does is [scan the whole source tree] looking for `BUCK`
files. It then [parses them by executing them as Python scripts][parse] (**update:**
[Buck now uses Jython] for better perfs and system independence), where each function
call [generates a bit of JSON] that is then parsed by the Buck main program to build
the DAG. Finally, for each rule, it scans all its sources and [computes a SHA1 hash] to
determine whether the task has to be run; [the results] are stored in a file used for
later incremental builds. Clearly the filesystem's own optimizations really help here;
Buck doesn't even optimizes to compute the SHA1 once per file; it'll probably compute
it twice for each source file.

[scan the whole source tree]: https://github.com/facebook/buck/blob/ef014b357fa3c9adf3d517fcbcfe0ef5b18ab3c0/src/com/facebook/buck/model/BuildFileTree.java#L110-129
[parse]: https://github.com/facebook/buck/blob/ef014b357fa3c9adf3d517fcbcfe0ef5b18ab3c0/src/com/facebook/buck/json/BuildFileToJsonParser.java#L161-192
[Buck now uses Jython]: https://github.com/facebook/buck/commit/575931561c61e82e477eecb2f0ffe8400bf2fc39
[generates a bit of JSON]: https://github.com/facebook/buck/blob/ef014b357fa3c9adf3d517fcbcfe0ef5b18ab3c0/src/com/facebook/buck/parser/buck.py#L44-48
[computes a SHA1 hash]: https://github.com/facebook/buck/blob/ef014b357fa3c9adf3d517fcbcfe0ef5b18ab3c0/src/com/facebook/buck/rules/RuleKey.java#L192-193
[the results]: https://github.com/facebook/buck/blob/ef014b357fa3c9adf3d517fcbcfe0ef5b18ab3c0/src/com/facebook/buck/rules/OutputKey.java#L43-44

Contrast that with Maven loading a bunch of `pom.xml` files referenced from one another
in the current directory, and then executing all the plugins' goals, letting them
determine using their own means whether to do any work. [Incremental builds in Maven]
are relatively recent, and still being worked one, with many small issues here and
there (outputting everything to a folder where things can possibly already exist and
other things will be output, and possibly the outputs will be post-processed, makes it
impossible to reliably do a staleness check).

[Incremental builds in Maven]: https://cwiki.apache.org/confluence/display/MAVEN/Incremental+Builds

The main difference between Buck and Maven is that a `BUCK` file only describes what
you want to produce (e.g. a `java_library`) whereas a `pom.xml`, even if you follow
[The Maven Way™], is made of _actions_. By definition, a Maven build is _dynamic_;
you cannot determine what the inputs and outputs of a build are without running
plugins, and those inputs and outputs can vary depending on build properties, profiles,
and even the goals you run. In Buck, a `java_library` is seen as a whole; its inputs
and outputs are declared explicitly in the `BUCK` file, and how it's built is
hard-coded in Buck. If you need anything fancier, you use other rules that generate
the appropriate dependencies for your `java_library` (that's composition vs.
extension). On the other hand, if any file (source or resource) has changed,
Buck will rebuild the JAR from scratch, unconditionally recompiling the sources.

[The Maven Way™]: http://developer-blog.cloudbees.com/2013/04/the-maven-way.html

Actually, Buck looks a lot like Make, and could very well generate a Make file,
except it uses SHA1 hashes rather than timestamps. The `java_library` rule in Buck
(I deliberately reuse the Maven scheme for organizing source files):

```
java_library(
  name = 'my-library',
  srcs = glob(['src/main/java/**/*.java']),
  resources = glob(['src/main/resources/**/*']),
  deps = [
    '//third-party/guava:guava'
  ],
)
```

is more or less equivalent to the following Make snippet:

```make
MY_LIBRARY_SRCS := $(shell find src/main/java -type f -name '*.java')
MY_LIBRARY_RESOURCES := $(shell find src/main/resources -type f)
my-library.jar: $(MY_LIBRARY_SRCS) $(MY_LIBRARY_RESOURCES) third-party/guava.jar
    rm my-library.jar
    mkdir -p my-library_tmp
    javac -classpath third-party/guava.jar -d my-library_tmp $(MY_LIBRARY_SRCS)
    jar cf my-library.jar -C my-library_tmp . -C src/main/resources .
```

Most other tools work with a finer level of granularity: Ant, Maven, SBT, Gradle, and
Scons will all try to recompile only those files that have changed. Unfortunately, Java
doesn't make it easy: one source file can generate several outputs, and annotation
processors make it even worse. SCons (and possibly SBT) tries harder than others by
_parsing_ the source files to extract inter-class dependencies, but most others will
fall into [_build too few_ traps](https://cwiki.apache.org/confluence/display/MAVEN/Incremental+Builds), and none of them will take into accounts classes generated by annotation
processors. I believe Buck has the right approach here, and numbers prove it's not
slowing it down that much.

The ultimate build tool
-----------------------

I think Bob Vawter sums it up [in a comment on Google+]:
> The Right Way seems to involve systems that are declarative at a high level, to
> express relationships between components in a manner amenable to tooling, and then
> imperative at the low-level, to take care of all the ugly stuff that really just
> needs an if-statement.

[in a comment on Google+]: https://plus.google.com/111102660583646544610/posts/ikP6HtgFtnw

The ultimate build tool would be something like Buck, with high-level rules that
clearly define their input and output files (so the tool can reliably track changes),
but also easily allows you to provide your own rules. And it'd of course follow the
two properties Lex talked about, described by Peter Miller 16 years ago: _“never run a
clean build, and reliably build any sub-target you like.”_

Maven has it all wrong: you can't test one module without testing all modules in the
reactor, or building and installing them in your local repository. And `mvn test` can
lead to different results than `mvn package` because the former won't package the
previous modules but will make dependencies on their _intermediate_ `target/classes`
(which BTW can be the wrong thing to do if you happen to depend on a _secondary 
artifact_ such as `<type>java-source</type>` or `<type>test-jar</type>`).

Gradle seems to handle things better as it has clean inputs/outputs so the build tool
can check for changes and decide whether to run a particular task or not, but it's
too low-level: you have dependencies on tasks –what should _run_ first–, not files
–what should be _built_ first–: e.g. to compile `moduleB` I first need to package
`moduleA`, rather than: to _build_ `moduleB` I need that `moduleA` be _built_ first,
for whichever definition of _build_.

Buck is too high-level. It allows extensions through macros and external scripts run
with the `genfile` rule; but one can probably do better (but Buck is young and _will_
change).  
I don't really like that it totally separates tests from what's being tested;
this is something Maven got right IMO. My problem is that Buck allows you to have the
tests of `moduleA` depend on both `moduleA` and `moduleB` (which uses `moduleA`); this
is OK for integration tests, but for unit-tests you'll want to test `moduleA` in
isolation. That's part of the _flexibility_ and simplicity of Buck, and a good set of
_Best Practices_ can give you something clean, but I wouldn't be against those things
being enforced by the build tool.  
Buck is also meant to be used by spreading `BUCK` files in a single `src` tree to
_partition_ it into build artifacts. The partitionning will generally follow Java
packages, but if you later want to split a _package_ without breaking backwards
compatibility (by moving those classes into another package), you'll end up using
`glob()`s, and if you get them wrong you'll put one class into several JARs, which is
generally not a good thing. Maven makes it harder to get things wrong, and that's a
good thing (but it does so at the expense of also making it harder to get things right).
<p style="text-align:center"><a href="http://xkcd.com/927/"><img alt="" src="http://imgs.xkcd.com/comics/standards.png" style="width: 500px; height: 283px"></a>

As to whether the build tool should also manage third-party dependencies, help with the
release process, publish artifacts to some shared repository and/or provide means to
run the project, or leave some or all of these tasks to external tools, I'll leave
that to another post.

