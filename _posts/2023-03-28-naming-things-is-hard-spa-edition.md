---
layout: post
title: Naming things is hard, SPA edition
discuss_url: https://dev.to/tbroyer/naming-things-is-hard-spa-edition-3g41
---

During the past few months, social networks have been shaken by a _single-page_ vs _multi-page applications_ (SPA vs MPA) battle, more specifically related to Next.js and React, following, among other things, [a tweet by Guillermo Rauch](https://mobile.twitter.com/rauchg/status/1619492334961569792) and [a GitHub comment by Dan Abramov](https://github.com/reactjs/reactjs.org/pull/5487#issuecomment-1409720741).

I've read a few articles and been involved in a few discussions about those and it appeared that we apparently don't all have the same definitions, so I'll give mine here and hope people rally behind them.

## SPA vs MPA: it's about navigation {#navigation}

It's not that hard: a _single-page_ application means that you load a page (HTML) once, and then do everything in there by manipulating its DOM and browser history, fetching data as needed.
This is the exact same thing as _client-side navigation_ and requires some form of _client-side routing_ to handle navigation (particularly from history, i.e. using the back and forward browser buttons).

Conversely, a _multi-page_ application means that each navigation involves loading a new page.

<aside role="doc-pullquote presentation" aria-hidden=true>SPA means you load a page once then navigate by manipulating the DOM and history. MPA means that each navigation involves loading a new page.</aside>

This by itself is a controversial topic: despite SPAs having lots of problems (user experience –aborting navigation, focus management, timing of when to update the URL bar–, [accessibility](https://nolanlawson.com/2019/11/05/what-ive-learned-about-accessibility-in-spas/ "Nolan Lawson: What I’ve learned about accessibility in SPAs"), performance even by not being able to leverage streaming) due to taking responsibility and having to reimplement [many things](https://dev.to/tigt/routing-im-not-smart-enough-for-a-spa-5hki "Taylor Hunt: Routing: I’m not smart enough for a SPA") from the browser (loading feedback, error handling, focus management, scrolling), some people strongly believe this is [“one of the first interesting optimizations”](https://twitter.com/dan_abramov/status/1621949445540659201) and they [“can’t really seriously consider websites that reload page on every click good UX”](https://twitter.com/dan_abramov/status/1617963492908335104)
(I've only quoted Dan Abramov from the React team here, but I don't want to single him out: he's far from being alone with this view; others are [in denial](https://andy-bell.co.uk/the-extremely-loud-minority/ "Andy Bell: The (extremely) loud minority") thinking that [“this is the strategy used by most of the industry today”](https://www.epicweb.dev/the-webs-next-transition#:~:text=This%20is%20the%20strategy%20used%20by%20most%20of%20the%20industry%20today. "Kent C. Dodds: The Web’s Next Transition; this quote in the section about SPAs")).
Some of those issues are supposedly (and hopefully) fixed by the new [navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API "MDN: Navigation API") that's currently only implemented in Chromium browsers.
MPAs aren't free from limitations too, otherwise we probably wouldn't have had SPAs to being with.

My opinion? There's no one-size-fits-all: most sites and apps could ([and probably should](https://www.thoughtworks.com/radar/techniques/spa-by-default "Thoughtworks Technology Radar: SPA by default")) be MPAs, and an SPA is a good (and better) fit for others.
It's also OK to use both MPA and SPA in a single application depending on the needs.
Jason Miller published [a rather good article](https://jasonformat.com/application-holotypes/ "Jason Miller: Application Holotypes: A Guide to Architecture Decisions") 4 years ago (I don't agree with everything in there though).
Nolan Lawson also has written [a good and balanced series](https://nolanlawson.com/2022/06/27/spas-theory-versus-practice/ "Nolan Lawson: SPAs: theory versus practice") on MPAs vs SPAs.

And we haven't even talked about where the _rendering_ is done yet!

## Rendering: SSR, ESR, SWSR, and CSR {#rendering}

Before diving into _where_ it's done, we first need to define _what_ rendering is.

My definition of _rendering_ is applying some form of _templating_ to some _data_.
This means that getting some HTML fragment from the network and putting it into the page with some form of `innerHTML` is **not** rendering.
Conversely, getting some _virtual DOM_ as JSON for example and reconstructing the equivalent DOM from it **would** qualify as rendering.

<aside role="doc-pullquote presentation" aria-hidden=true>Rendering is applying some form of templating to some data.</aside>

Now that we've defined _what_ rendering is, let's see _where_ it can be done: basically at each and any stage of delivery: the origin server (SSR), edge (ESR), service-worker (SWSR), or client (CSR).

There's also a whole bunch of _prerendering_ techniques: static site generation (SSG), on-demand generation, distributed persistent rendering (DPR), etc.

All these rendering stages, except client-side rendering (CSR), generate HTML to be delivered to the browser engine.
CSR will however directly manipulate the DOM most of the time, but sometimes will also generate HTML to be used with some form of `innerHTML`; the details here don't really matter.

Rendering at the origin server or at the edge (Cloudflare Workers, Netlify Functions, etc.) can be encompassed under the name server-side rendering (SSR), but depending on the context SSR can refer to the origin server only.
Similarly, rendering in a service worker could be included in client-side rendering (CSR), but most of the time CSR is only about rendering in a browsing context.
I suppose we could use _browser-side rendering_ (BSR) to encompass CSR and SWSR.

![Schema of SSR, ESR, SWSR and CSR, with grouping representing SSR-in-the-broader-sense (SSR and ESR) vs. BSR (SWSR and CSR), and which generate HTML (SSR, ESR and SWSR) or manipulate the DOM (CSR)](/image/2023/03/ssr-csr.png)

As noted by Jason Miller and Addy Osmani in their [Rendering on the Web](https://web.dev/rendering-on-the-web/ "web.dev: Rendering on the Web") blog post, applications can leverage several stages of rendering (SSR used in the broader sense here), but like many they conflate SPA and CSR.
Eleventy (and possibly others) also allows [rendering a given page at different stages](https://www.11ty.dev/docs/plugins/edge/ "Eleventy Edge: A plugin to run Eleventy in an Edge Function to add dynamic content to your Eleventy sites."), with parts of the page prerendered at build-time or rendered on the origin server, while other parts will be rendered at the edge.

## What does that imply? {#implications}

My main point is that rendering is almost orthogonal to single-page vs multi-page: an SPA doesn't imply CSR.

<aside role="doc-pullquote presentation" aria-hidden=true>SPA doesn't necessarily imply CSR.</aside>

* [Most web sites are MPAs](https://chromestatus.com/metrics/feature/timeline/popularity/2617 "Chrome Platform Status: usage metrics of the history.pushState API") with SSR, sometimes ESR.
* Most React/Vue/Angular applications are SPAs with CSR: the HTML page is mostly empty, generally the same for every URL, and the page loads data on _boot_ and renders it (at the time of writing, the [Angular website](https://angular.io) is such an SPA+CSR).
* Next.js/Gatsy/Remix/Nuxt/Angular Universal/Svelte Kit/Solid Start/îles applications are SPAs with SSR and CSR: data is present as HTML in the  page, but navigations then use CSR staying on the same page (and actually, despite the content being present in the HTML page, those frameworks will discard and re-render it client-side on _boot_).
* Qwik City/Astro/Deno Fresh/Enhance/Marko Run applications are MPAs with SSR (and CSR as needed through [_islands of interactivity_](https://jasonformat.com/islands-architecture/ "Jason Miller: Islands Architecture")); Qwik City provides [an easy way](https://qwik.builder.io/docs/faq/#can-qwik-do-spa "Qwik FAQ: Can Qwik do SPA?") to switch to an SPA with SSR and CSR (though contrary to the above-mentioned frameworks, Qwik City won't re-render on page load).
* [Hotwire Turbo Drive](https://turbo.hotwired.dev/handbook/drive) (literally _HTML over the wire_; formerly Turbolinks) and [htmx](https://htmx.org) applications are SPAs with SSR.
* GitHub is known for its use of Turbolinks and is actually both MPA and SPA, depending on pages and sometimes navigation (going from a user profile to a repository loads a new page, but the reverse is a client-side navigation).

Some combinations aren't really useful: an MPA with CSR (and without SSR) would mean loading an almost empty HTML page at each navigation to then fetch data (or possibly getting it right from HTML page) and do the rendering. Imagine the Angular website (which already makes a dubious choice of not including the content in the HTML page, for a documentation site) but where all navigations would load a new (almost empty) page.

Similarly, if you're doing a SPA, there's no real point in doing rendering in a service worker as it could just as well be done in the browsing context; unless maybe you're doing SPA navigation only on some pages/situations (video playing?) and want to leverage SWSR for all pages including MPAs?

## Other considerations

In an application architecture, navigation and rendering locality aren't the only considerations.

### Inline updates

Not every interaction has to be a navigation:
there are many cases where a form submission would _return_ to the same page (reacting to an article on [Dev.to](https://dev.to), posting a comment, updating your shopping cart), in which case progressive enhancement could be used to do an inline update without a full page refresh.

Those are independent from SPAs: you can very well have an MPA and use such inline updates.
Believe it or not, this is exactly what [Dev.to](https://dev.to) does for their comment form (most other features like following the author, reacting to the post or a comment, or replying to a comment however won't work at all if JavaScript is somehow broken).

### Concatenation and Includes {#includes}

Long before we had capable enough JavaScript in the browser to build full-blown applications (in the old times of DHTML, before AJAX), there already were optimization techniques on the servers to help build an HTML page from different pieces, some of which could have been _prerendered_ and/or cached.
Those were [_server-side includes_](https://en.wikipedia.org/wiki/Server_Side_Includes "Wikipedia: Server Side Includes") and [_edge-side includes_](https://www.w3.org/TR/esi-lang/ "W3C: ESI Language Specification 1.0").

While they are associated with specific syntaxes, the concepts can be used today [in edge functions](https://blog.cloudflare.com/edge-side-includes-with-cloudflare-workers/ "Edge-Side-Includes with Cloudflare Workers") or [even in service workers](https://philipwalton.com/articles/smaller-html-payloads-with-service-workers/ "Philip Walton: Smaller HTML Payloads with Service Workers").

The different parts being concatenated/included this way can be themselves static or prerendered, or rendered on-demand.
Actually the above-mentioned feature of Eleventy where parts of a page are server-rendered or prerendered and other parts are rendered at the edge is very similar to those _includes_ as well.
