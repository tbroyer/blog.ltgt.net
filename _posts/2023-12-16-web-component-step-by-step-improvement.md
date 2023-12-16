---
layout: post
title: Improving a web component, one step at a time
additional_csp:
    script_src: tbroyer.github.io 'unsafe-inline'
    style_src: "'unsafe-inline'"
discuss_url: https://dev.to/tbroyer/improving-a-web-component-one-step-at-a-time-2673/comments
---

Earlier this month, [Stefan Judis](https://www.stefanjudis.com/) published a small [web component that makes your text sparkle](https://www.stefanjudis.com/blog/a-web-component-to-make-your-text-sparkle/ "A web component to make your text sparkle").

In the spirit of so-called [HTML web components](https://blog.jim-nielsen.com/2023/html-web-components/) which apparently often comes with some sort of aversion for the [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM "Using shadow DOM"), the element directly manipulates the light DOM. As a developer of web apps with heavy DOM manipulations, and lover of _the platform_, this feels weird to me as it could possibly break so many things: other code that manipulates the DOM and now sees new elements and could also change them, handling of disconnection and reconnection of the element (as most such elements modify their children in the `connectedCallback` without checking whether it had already been done), `MutationObserver`, etc.

The first thing that came to my mind was that shadow DOM, for all its drawbacks and bugs, was the perfect fit for such an element, and I wanted to update Stefan's element to use the shadow DOM instead. Then a couple days ago, [Zach Leatherman](https://www.zachleat.com) published [a similar element](https://www.zachleat.com/web/snow-fall/ "<snow-fall> Web Component") that makes it snow on its content, and [I was pleased](https://piaille.fr/@tbroyer/111585454702562025) to see he used shadow DOM to encapsulate (hide) the snowflakes. That was the trigger for me to actually take the time to revisit Stefan's `<sparkle-text>` element, so here's a step by step of various improvements (in my opinion) I made.

_Disclaimer before I begin: this not in any way a criticism of Stefan's work! On the contrary actually, it wouldn't have been possible without this prior work. I just want to show things that *I* think could be improved, and this is all very much subjective._

I'll link to commits in [my fork](https://github.com/tbroyer/sparkly-text) without any (intermediate) demo, as all those changes don't have much impact on the element's behavior, as seen by a reader of the web page (if you're interested in what it changes when looked at through the DevTools, then clone the repository, run `npm install`, `npm run start`, then checkout each commit in turn), except in some specific situations. The final state is available [here](https://tbroyer.github.io/sparkly-text/) if you want to play with it in your DevTools.

## Using shadow DOM

The [first step](https://github.com/tbroyer/sparkly-text/commit/57ef19f625ce886e876a597e198cd4089152a99d "Git commit: Encapsulate sparkles in Shadow DOM") was moving the sparkles to shadow DOM, to avoid touching the light DOM. This involves of course attaching shadow DOM, with a `<slot>` to let the light DOM show, and then changing where the sparkles are added, but also changing how CSS is handled!

<figure>
<figcaption>Abridged diff of the changes (notably excluding CSS)</figcaption>

```diff
@@ -66,16 +62,21 @@ class SparklyText extends HTMLElement {
 `;
     let sheet = new CSSStyleSheet();
     sheet.replaceSync(css);
-    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
-    _needsStyles = false;
+    this.shadowRoot.adoptedStyleSheets = [sheet];
   }
 
   connectedCallback() {
+    if (this.shadowRoot) {
+      return;
+    }
+
     this.#numberOfSparkles = parseInt(
       this.getAttribute("number-of-sparkles") || `${this.#numberOfSparkles}`,
       10
     );
 
+    this.attachShadow({ mode: "open" });
+    this.shadowRoot.append(document.createElement("slot"));
     this.generateCss();
     this.addSparkles();
   }
@@ -99,7 +100,7 @@ class SparklyText extends HTMLElement {
       Math.random() * 110 - 5
     }% - var(--_sparkle-base-size) / 2)`;
 
-    this.appendChild(sparkleWrapper);
+    this.shadowRoot.appendChild(sparkleWrapper);
     sparkleWrapper.addEventListener("animationend", () => {
       sparkleWrapper.remove();
     });
```

</figure>

In Stefan's version, CSS is injected to the document, with a boolean to make sure it's done only once, and styles are _scoped_ to `.sparkle-wrapper` descendants of the `sparkle-text` elements. With shadow DOM, we gain style encapsulation, so no need for that scoping, we can directly target `.sparkle-wrapper` and `svg` as they're in the shadow DOM, clearly separate from the HTML that had been authored. We need to do it for each element though (we'll improve that later), but we now need to make sure we initialize the shadow DOM only once instead (I'm going step by step, so leaving this in the `connectedCallback`).

As a side effect, this also fixes some edge-case bug where the CSS would apply styles to any descendant SVG of the element, whether a sparkle or not (this could have been fixed by only targetting SVG inside `.sparkle-wrapper` actually); and of course with shadow DOM encapsulation, page author styles won't affect the sparkles either.

## Small performance improvements

Those are really small, and probably negligible, but I feel like they're good practice anyway so I didn't even bother measuring actually.

First, as said above, the CSS needs to be somehow _injected_ into each element's shadow DOM, but the constructible stylesheet can actually be shared between all of them. I've thus split construction of the stylesheet with its adoption in the shadow DOM, and made sure construction was only made once. Again, to limit [the changes](https://github.com/tbroyer/sparkly-text/commit/783d76d4766b70d7ca2d7767d1950f27f6a20d24 "Git commit: Only create a single CSSStyleSheet"), everything's still in the same method, just move inside an `if` (I think I would have personally constructed the stylesheet early, as soon as the script is loaded, rather than waiting for the element to actually be used; it probably doesn't make a huge difference).

```diff
   generateCss() {
-    const css = `…`;
-    let sheet = new CSSStyleSheet();
-    sheet.replaceSync(css);
+    if (!sheet) {
+      const css = `…`;
+      sheet = new CSSStyleSheet();
+      sheet.replaceSync(css);
+    }
     this.shadowRoot.adoptedStyleSheets = [sheet];
   }
```

Similarly, sparkles were created by `innerHTML` the SVG into each. I [changed that](https://github.com/tbroyer/sparkly-text/commit/887cdeafd58807bb7d96104178a806f45c109353 "Git commit: Create sparkles by cloning a template node") to using `cloneNode(true)` on an element _prepared_ only once.

```diff
   addSparkle() {
-    const sparkleWrapper = document.createElement("span");
-    sparkleWrapper.classList.add("sparkle-wrapper");
-    sparkleWrapper.innerHTML = this.#sparkleSvg;
+    if (!sparkleTemplate) {
+      sparkleTemplate = document.createElement("span");
+      sparkleTemplate.classList.add("sparkle-wrapper");
+      sparkleTemplate.innerHTML = this.#sparkleSvg;
+    }
+
+    const sparkleWrapper = sparkleTemplate.cloneNode(true);
```

We actually don't even need the wrapper element, we could directly use the SVG [without wrapper](https://github.com/tbroyer/sparkly-text/commit/9daa0df820ad113a745d1be7ae01ce9b6cf00711 "Git commit: Remove sparkle-wrapper element").

## Handling disconnection

The element uses chained timers (a `setTimeout` callback that itself ends up calling `setTimeout` with the same callback, again and again) to re-add sparkles at random intervals (removing the sparkles is done as soon as the animation ends; and all of this is done only if the user didn't configure their browser to prefer reduced motion).

If the element is removed from the DOM, this unnecessarily continues in the background and could create memory leaks (in addition to just doing unnecessary work). [I started](https://github.com/tbroyer/sparkly-text/commit/dc4b731a3f33e5164b5f4d8cc867d76207069405 "Git commit: Stop sparkling once disconnected") with a very small change: check whether the element is still connected to the DOM before calling adding the sparkle (and calling `setTimeout` again). It could have been better (for some definition of better) to track the timer IDs so we could call `clearTimeout` in `disconnectedCallback`, but I feel like that would be unnecessarily complex.

```diff
       const {matches:motionOK} = window.matchMedia('(prefers-reduced-motion: no-preference)');
-      if (motionOK) this.addSparkle();
+      if (motionOK && this.isConnected) this.addSparkle();
```

This handles disconnection (as could be done by any _destructive_ change to the DOM, like navigating with [Turbo](https://turbo.hotwired.dev/) or [htmx](https://htmx.org/), I'm not even talking about using the element in a JavaScript-heavy web app) but not reconnection though, and we've exited early from the `connectedCallback` to avoid initializing the element twice, so this change actually broke our component in these situations where it's moved around, or stashed and then reinserted. To fix that, we need to always call `addSparkles` in `connectedCallback`, so move all the rest into an `if`, that's actually as simple as that… except that when the user prefers reduced motion, sparkles are never removed, so they keep piling in each time the element is connected again. One way to handle that, without introducing our housekeeping of individual timers, is to just remove all sparkles on disconnection. Either that or conditionally add them in `connectedCallback` if either we're initializing the element (including attaching the shadow DOM) or the user doesn't prefer reduced motion. The difference between both approaches is in whether we want the small animation when the sparkles appear (and appearing at new random locations). [I went with the latter](https://github.com/tbroyer/sparkly-text/commit/ba8652eb490c41940fd531e2e87c6711cb1cc8d9 "Git commit: Restart animation on reconnection").

This still doesn't handle the situation where `prefers-reduced-motion` changes while the element is displayed though: if it turns to `no-preference`, then sparkles will start animating (due to CSS) then disappear at the end of their animation (due to JS listening to the `animationend` event), and no other sparkle will be added (because the `setTimeout` chain would have been broken earlier). I don't feel like it's worthy enough of a fix for such an element but it's also rather easy to handle so [let's do it](https://github.com/tbroyer/sparkly-text/commit/e0412236e1e5d8870cee14d044368eed46a060b1 "Git commit: Handle prefers-reduced-motion changes"): listen to the media query change and start the timers whenever the user no longer prefers reduced motion.

```diff
@@ -94,6 +94,19 @@ connectedCallback() {
       );
       this.addSparkles();
     }
+
+    motionOK.addEventListener("change", this.motionOkChange);
+  }
+
+  disconnectedCallback() {
+    motionOK.removeEventListener("change", this.motionOkChange);
+  }
+
+  // Declare as an arrow function to get the appropriate 'this'
+  motionOkChange = () => {
+    if (motionOK.matches) {
+      this.addSparkles();
+    }
   }
```

## Browser compatibility

Constructible stylesheets aren't supported in Safari 16.3 and earlier (and possibly other browsers). To avoid the code failing and strange things (probably, I haven't tested) happening, I started by [bailing out early](https://github.com/tbroyer/sparkly-text/commit/59062d60e228111a9d00e5dd47695d0855cb937f "Git commit: Bail out early when constructible stylesheets aren't supported") if the browser doesn't support constructible stylesheets (the element would then just do nothing; I could have actually even avoided registering it at all). Fwiw, I borrowed the check from Zach's `<snow-fall>` which works this way already (thanks Zach). As an aside, it's a bit strange that the code assumed construtible stylesheets were available, but tested for the availability of the custom element registry 🤷

```diff
   connectedCallback() {
-    if (this.shadowRoot) {
+    // https://caniuse.com/mdn-api_cssstylesheet_replacesync
+    if (this.shadowRoot || !("replaceSync" in CSSStyleSheet.prototype)) {
       return;
     }
 
```

But Safari 16.3 and earlier still represent more than a third of users on macOS, and more than a quarter of users on iOS! (according to [CanIUse](https://caniuse.com/)) To widen browser support, I therefore added [a workaround](https://github.com/tbroyer/sparkly-text/commit/e5785ef938678e55c9b039dad518f69bd40075ea "Git commit: Support Safari < 16.4"), which consists of injecting a `<style>` element in the shadow DOM. Contrary to the constructible stylesheet, styles cannot be shared by all elements though, as we've seen above, so we only conditionally fallback to that approach, and continue using a constructible stylesheet everywhere it's supported.

```diff
-      sheet = new CSSStyleSheet();
-      sheet.replaceSync(css);
+      if (supportsConstructibleStylesheets) {
+        sheet = new CSSStyleSheet();
+        sheet.replaceSync(css);
+      } else {
+        sheet = document.createElement("style");
+        sheet.textContent = css;
+      }
     }

-    this.shadowRoot.adoptedStyleSheets = [sheet];```
+    if (supportsConstructibleStylesheets) {
+      this.shadowRoot.adoptedStyleSheets = [sheet];
+    } else {
+      this.shadowRoot.append(sheet.cloneNode(true));
+    }
```

## Other possible improvements

I stopped there but there's still room for improvement.

For instance, the `number-of-sparkles` attribute is read once when the element is connected, so changing the attribute afterwards won't have any effect (but will have if you disconnect and then reconnect the element). To handle that situation (if only because you don't control the order of initialization when that element is used within a JavaScript-heavy application with frameworks like React, Vue or Angular), one would have to listen to the attribute change and update the number of sparkles dynamically. This could be done either by removing all sparkles and recreating the correct number of them (with `addSparkles()`), but this would be a bit _abrupt_, or by reworking entirely how sparkles are managed so they could adapt dynamically (don't recreate a sparkle, let it _expire_, when changing the number of sparkles down, or create just as many sparkles as necessary when changing it up). I feel like this would bump complexity by an order of magnitude, so it's probably not worth it for such an element.

The number of sparkles could also be controlled by a property [reflecting](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes "HTML Living Standard: Reflecting content attributes in IDL attributes") the attribute; that would make the element more similar to built-in elements. Once the above is in place, this hopefully shouldn't be too hard.

That number of sparkles is expected to be, well, a number, and is currently parsed with `parseInt`, but the code doesn't handle parsing errors and could set the number of sparkles to `NaN`. Maybe we'd prefer using the default value in this case, and similarly for a zero or negative value; basically defining the attribute as a [number limited  to only positive numbers with fallback](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#limited-to-only-non-negative-numbers-greater-than-zero-with-fallback "HTML Living Standard: Reflecting content attributes in IDL attributes, of type unsigned long limited to only positive numbers with fallback").

All this added complexity is, to me, what separates so-called _HTML web components_ from others: they're designed to be used from HTML markup and not (or rarely) manipulated afterwards, so shortcuts can be taken to keep them simple.

Still speaking of that number of sparkles, the timers that create new sparkles are entirely disconnected from the animation that also makes them disappear. The animation length is actually configurable through the `--sparkly-text-animation-length` CSS custom property, but the timers delay is not configurable (a random value between 2 and 3 seconds). This means that if we set the animation length to a higher value than 3 seconds, there will actually be more sparkles than the configured number, as new sparkles will be added before the previous one has disappeared. There are several ways to _fix_ this (**if** we think it's a bug –this is debatable!– and is worth fixing): for instance we could use [the Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API "MDN: Web Animations API") to read the computed timing of the animation and compute the timer's delay based on this value. Or we could let the animation repeat and move the element on `animationiteration`, rather than remove it and add another, and to add some randomness it could be temporarily paused and then restarted if we wanted (with a timer of some random delay). The code would be much different, but not necessarily more complex.

<script type=module src=https://tbroyer.github.io/sparkly-text/sparkly-text.js></script>
<figure>
  <sparkly-text number-of-sparkles=10 style="--sparkly-text-animation-length: 10s">
    10 sparkles, animation lengthened to 10 seconds
  </sparkly-text>
  <p>There are currently <output></output> sparkles.</p>
  <script>
    const sparklyText = document.currentScript.parentElement.querySelector("sparkly-text");
    const output = document.currentScript.parentElement.querySelector("output");
    customElements.whenDefined("sparkly-text").then(() => {
      new MutationObserver(() => {
          output.value = sparklyText.shadowRoot.querySelectorAll(":host > svg").length;
      }).observe(sparklyText.shadowRoot, { childList: true });
    });
  </script>
</figure>

Regarding the animation events (whether `animationend` like it is now, or possibly `animationiteration`), given that they bubble, they could be listened to on a single parent (the element itself –filtering out possible animations on light DOM children– or an intermediate element inserted to contain all sparkles). This could hopefully simplify the code handling each sparkle.

Last, but not least, the `addSparkles` and `addSparkle` methods could be made private, as there's no reason to expose them in the element's API.

## Final words

Had I started from scratch, I probably wouldn't have written the element the same way. I tried to keep the changes small, one step at a time, rather than doing a big refactoring, or starting from scratch and comparing the outcome to the original, as my goal was to specifically show what I think could be improved and how it wouldn't necessarily involve big changes. Going farther, and/or possibly using a helper library ([I have written earlier]({% post_url 2023-02-27-web-component-libs-benefits %} "The benefits of Web Component Libraries") about their added value), is left as an exercise for the reader.
