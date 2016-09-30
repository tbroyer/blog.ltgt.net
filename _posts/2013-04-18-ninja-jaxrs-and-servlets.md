---
layout: post
title: Ninja, JAX-RS and Servlets
published: true
discuss_url: https://plus.google.com/113945685385052458154/posts/UneFVuF3myS
has_embedded_tweets: true
---
A couple weeks ago I discovered the [Ninja web framework](http://www.ninjaframework.org)
_via_ a link on Twitter. It's presented as a Java web framework largely inspired from
the [Play! framework](http://www.playframework.com). What I liked from the very beginning
is that it's a Java citizen before all: plays nice with Maven and everything you're used
to do with/in a Java project. This is in total opposition to Play! which forces you to
use its own tools and way of thinking. Furthermore, Play! (v1) does runtime bytecode
manipulation to override the semantics of `static` fields (replacing them with a
`ThreadLocal`). This is probably the one thing that I dislike the most in Play!: it's no
longer Java.

<blockquote class="twitter-tweet" data-align="center"><p>Ninja web framework: Play! framework done right?<br>Looks a lot like JAX-RS though; I think I'll stick with that one.<br><br><a href="http://t.co/TrCzBqTo9a" title="http://www.ninjaframework.org/introduction.html">ninjaframework.org/introduction.h…</a></p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/status/320153069285412864">April 5, 2013</a></blockquote>

I like Ninja's _minimalism_ but I think it can do better (and I'm not even talking about
the rather limit set of features compared to Play!). For example, Play! is advertized as
being _highly scalable_, partly due to using non-blocking I/O and more specifically
[Netty](http://netty.io). Ninja also talks about Netty being a potential deployment target,
but had a strong dependency on the Servlets API. [A few hours of hacking later](https://github.com/reyez/ninja/pull/85),
Servlets are only an implementation detail.

I'm looking at OAuth 2.0 for that project at work where we'll use Play! (v2) so I wondered
how it'd look like in Ninja, and I found out there's no clean way to communicate between a
`ninja.Filter` and a controller. So I [proposed adding](https://github.com/reyez/ninja/pull/86)
`getAttribute` and `setAttribute` (it turns out that Play! already has those methods).

Digging deeper in Ninja's internals, I found a [couple](https://github.com/reyez/ninja/issues/88)
other [things](https://github.com/reyez/ninja/issues/87) I'd like to change, and I started
working on them, along with Grizzly and Netty backends. [Raphael A. Bauer](https://github.com/reyez)
is very open and very reactive, so overall working on Ninja was a pleasure.

But there was still something that bugged me, and I couln't put words on it at the time.

<blockquote class="twitter-tweet" data-align="center"><p>The more I look at frameworks like Play or Ninja, the more I want to go “no framework”. Will have to experiment with that…</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/status/320997765129854976">April 7, 2013</a></blockquote>

<blockquote class="twitter-tweet" data-align="center"><p>Don't get me wrong: I'm not saying Play or Ninja are bad; just that, 1 or 2 days in, I really can't say I'm in love.</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/status/321020175291920384">April 7, 2013</a></blockquote>

Overall, I think it boils done to the fact that I don't like frameworks. I largely prefer
libraries. Play! is a _full-stack_ framework, and Ninja borrows from it by providing the
router, the templating engine (Freemarker), a simple API to send mails, etc.

JAX-RS 2.0
----------

At work, I'm also working concurrently on a project using JAX-RS 2.0 and I really like it.
JAX-RS provides its own dependency injection mechanism but we made it play nicely with
[Guice](http://code.google.com/p/google-guice/) (and I even experimented with replacing
Guice with [Dagger](http://square.github.io/dagger)). It feels a bit weird to have two
DI framework (Jersey comes with its own DI framework called HK2) coexisting in the same
app but Jersey is only one implementation of JAX-RS (just like Guice and Dagger are
implementation of JSR 330, except JSR 330 doesn't deal with how you configure injection).

Hacking on Ninja+Grizzly the other day, it happened to me that I actually want it to be
more like JAX-RX. The main differences between them would be:

 * Ninja's controllers are much simpler than JAX-RS resource classes and methods, but also
   less flexible.
 * The mapping of URLs to controllers is centralized in `conf.Routes` in Ninja, where as
   in JAX-RS it's scattered around all the resources as annotations are put on classes and
   methods. JAX-RS is slightly more type-safe though: you don't have to use a method's
   name (as a `java.lang.String`, error-prone, easily broken by refactorings) when defining
   your routes, only possibly when creating links to resources (it depends how you built
   your resources).
 * JAX-RS doesn't come with a template engine, but it's really easy to make one. The big
   advantage is that you're free to choose the engine you want. On the other hand, choosing
   the template dynamically requires a bit more work.
 * JAX-RS doesn't come with support for file upload, but again it's easy to build, and both
   Jersey and RESTEasy provide it as an extension (you're then building a Jersey or RESTEasy
   app though, not a JAX-RS one).
 * JAX-RS won't map your `application/x-www-form-urlencoded` request body to an object, but
   yet again… (you know what I'll say?) it's easy to build if you really need it. And JAX-RS
   can also do it differently: if your problem is having too many arguments to your resource
   method, JAX-RS will inject fields, contrary to Ninja (because resource classes are
   short-lived in JAX-RS, when they're generally singletons in Ninja, so there's no shared
   state unless you specifically build for it).
 * Ninja builds on Guice, whereas JAX-RS has it's own DI framework (but can also work with
   CDI or whatever, then again your app just becomes less portable, which can or cannot be
   a problem)

Overall, I prefer JAX-RS as it allows you to compose the parts you want (template engine,
etc.) as you want, at a somewhat negligible cost (compared to the flexibility it brings!)

Servlets 3.1
------------

Approximately at the same moment, I see something about [Servlets 3.1](http://jcp.org/en/jsr/detail?id=340)
so I go check the spec to see what's new. I end up reading the spec almost back to back, and I generally like what I see. The one advantage compared to Ninja and JAX-RS is that it has
support for NIO (already implemented in Grizzly 3.0-SNAPSHOT, among others), but it's lacking
advanced routing (with extraction of path-parameters from the URL, and construction of links from
a URL-Template/pattern) and I don't know of any such thing as a standalone library.

<blockquote class="twitter-tweet" data-align="center"><p>Lightweight web “framework” (toolkit?): Servlet 3.1 + some router + DI container + template engine. The problem is to find a router…</p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/status/321223833065508864">April 8, 2013</a></blockquote>

I unfortunately haven't had the time yet to do the experiment. I'm not even sure a full-blown
_router_ component is really needed after all (it really depends how you want your URLs
to look like).

Conclusion
----------

I haven't given much time to Ninja but in the end I think I much prefer JAX-RS 2.0.

Servlets 3.1 look very interesting but are even lower-level. Depending on your needs, I
think it can be a better choice. It's lightweight enough that it can be implemented on
top of many lower-level APIs (Netty, Grizzly, Jetty, etc.) so it provides a lightweight
portable API (but JAX-RS is similar).

The only missing bit to JAX-RS (and Ninja) compared to Servlets 3.1 (and Play! v2) is the 
support for NIO. It's apparently [_on the radar_](http://java.net/projects/jax-rs-spec/lists/users/archive/2012-10/message/12)
but will go through experiments with _proprietary_ (Jersey vs. RESTEasy vs. …) APIs. Now
it hasn't really been an issue 'til now and it won't be an issue in practice for many of us
(many templating engines and other renderers/serializers don't make use of NIO to begin with),
but still.

So what?
--------

Oh, this was all just musings on web frameworks from my past 2 weeks with them. I didn't
talk about Play! as I haven't yet spent much time on it (I focused on SBT for now, which
I must say I really don't like) nor that _experiment_ (running in production for a couple
years though) from Tim Boudreau:

<blockquote class="twitter-tweet" data-align="center"><p>Interesting new Java web framework by @<a href="https://twitter.com/kablosna">kablosna</a>; actor pattern, based on Netty and Guice.<a href="http://t.co/TIrgSBgQRK" title="http://timboudreau.com/blog/Acteur/read">timboudreau.com/blog/Acteur/re…</a></p>&mdash; Thomas Broyer (@tbroyer) <a href="https://twitter.com/tbroyer/status/321243058886815745">April 8, 2013</a></blockquote>
<script>
var scripts = document.getElementsByTagName('script');
var script = scripts[scripts.length - 1];
var p = document.createElement('p');
p.innerHTML = "<em>Note: the URL above should be <a href='http://timboudreau.com/blog/Acteur/read'>http://timboudreau.com/blog/Acteur/read</a> but Twitter's widget doesn't allow fixing it (for obvious reasons).</em>";
script.parentNode.insertBefore(p, script);
</script>

I've always tried to favor _standard APIs_ anyway, by principle and to avoid lock-in, so
I'd rather stick to JAX-RS and Servlets (and JAX-RS can be implemented on top of Servlets
to be deployed everywhere servlets can, including e.g. Google AppEngine), but those other
frameworks bring interesting things. ~~I'll have to learn Play! (v2) at work anyway, let's
see how it goes…~~
