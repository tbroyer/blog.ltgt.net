---
layout: post
title: Deconstructing and rebuilding Wordle (part 1)
has_embedded_tweets: true
has_playground_elements: true
---

During the past weeks, [a small game](https://www.powerlanguage.co.uk/wordle/) built by someone [for his girlfriend](https://www.nytimes.com/2022/01/03/technology/wordle-word-game-creator.html) took the world by storm and ended up being [bought by the New York Times](https://www.nytimes.com/2022/01/31/business/media/new-york-times-wordle.html) for a price “in the low seven figures”. Let's rebuild it!

Just like the original game, I'll use Web Components here.

<blockquote class="twitter-tweet" data-dnt="true" data-align="center"><p lang="en" dir="ltr">Wordle is built with Web Components, and it&#39;s sort of wild how people keep rebuilding it except slower.</p>&mdash; Alex Russell (@slightlylate) <a href="https://twitter.com/slightlylate/status/1486027365482262530?ref_src=twsrc%5Etfw">January 25, 2022</a></blockquote>

This is an exercise on component design, and as such requires some prior knowledge on [how to build custom elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements).
I'll focus on component design and behavior, mostly putting aside the CSS and game logic.
I'll try to make reusable components, and as such I won't take shortcuts like one might have if the goal was only to rebuild the game.
I won't use any library or framework, because it shouldn't be necessary, even though it will indeed require a bit more work.
I will however use *modern* APIs and features even when they're not supported in every browser, as long as there exists polyfills to make them usable in every evergreen browser, or for language features if they can be transformed (using Babel or similar tools).
I'll make sure to [follow best practices](https://developers.google.com/web/fundamentals/web-components/best-practices) and have the elements behave as close to builtin elements as possible.

Deconstructing it first
-----------------------

Wordle's UI is made of a board and a keyboard.

The board is a 6 row, 5 column grid of tiles,
each row representing an attempt to find the day's 5-letter word,
and each tile on a row representing a letter of that attempt.

A row can be completely empty as a placeholder for a later proposed word, the current proposed word, or a past, evaluated attempt (possibly correct).

A tile can be empty as a placeholder for later proposed letters (in a placeholder row, or in the current row), a letter of the current row, or a letter of an evaluated row.
In that case, it will have varying a background color showing whether the proposed letter is absent, present but at the wrong place, or correct (present *and* at the right place).

The keyboard is part of the game UI as it also shows hints about letters that are present in the secret word, using the same colors as evaluated letters.

There are also help, statistics (with the famous share button) and settings modals, and a toast when your proposed word is not part of the dictionary.

Speaking of the dictionary, besides the UI, Wordle has 2 lists of words: the list of all accepted words you could propose (10657 words to be precise), and another list of the various “words of the day”, in apparition order (2315 words, which will last for roughly 6 years and a quarter!)
That second list started on June, 19th 2021 so we're now on the 235th word.

The last part is the state of the game: it's automatically stored in *local storage* so you can return at any time in the course of the day and continue your game, along with your statistics.

Now that we've *deconstructed* Wordle, we're ready to rebuild it.

One piece at a time
-------------------

A small side note about web components before we dive in:
a custom element's API is made of attributes and properties (mostly for *inputs*), methods sometimes, events for interactions with other elements (preferably to callbacks), [slots](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot) for content, and [CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties) and [CSS shadow parts](https://developer.mozilla.org/en-US/docs/Web/CSS/::part) for styling.

With that said, let's start with a tile.

We've seen already that a tile can be empty or display a single letter, and it can have an *evaluation* that will be one of *absent*, *present* or *correct*.
In order to model a *current* state as well where the tile is rendered a bit differently, we'll actually generalize the evaluation as a *state* with possible values `current`, `correct`, `present`, and `absent`, and the *empty* state for either an placeholder tile or an unevaluated tile.

While we could just use a simple element with the letter as sole content and CSS classes for the state, we'll nevertheless formalize things in a custom element.
We'll use the element's content for the letter, that we'll also expose as a property, similar to how an `<option>` or `<textarea>` work already.
We won't use a `<slot>` in our shadow tree though, as we want the content to only be a single (valid) letter, without HTML markup, so we'll use a [mutation observer](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) here to react to changes.
It would have probably been easier with an attribute, at the expense of being less accessible (at least I suppose; I must say I'm far from being an expert on accessibility, and I won't put much effort here to make things fully accessible).
Note that I consider that it's not the role of the element to validate whether the content is a valid letter or not, it only makes sure that it *displays* only one character.

We'll however use an attribute and property for the state.
Speaking of attributes, there are several ways to handle them in custom elements,
I'll use the slightly less verbose way of parsing them from property getters,
rather than synchronizing them with properties and parsing them when they're modified,
because we won't read them that much anyway.
We can revisit this later if needed, or abstract this using a library/framework.
By the way, this also matches the HTML specification for [reflecting content attributes as IDL attributes](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes).

Next thing we need are the colors for the various states, that we'd want to make themeable to support light and dark themes and/or a color-blind mode.
For that, we'll simply use CSS custom properties so the values can be set from outside the element, knowing that they'll be reused for the keyboard keys as well.

We don't need any event, as there's no interaction.

In terms of implementation, we don't need to observe the `state` attribute as we can do everything we need with just CSS, matching the attribute directly on the custom element.
We'll differentiate the empty state from other states using CSS selector specificity: defaulting to the empty state (absence of a `state` attribute, or presence with any invalid value) and overriding for the other states using more specific selectors.
This somehow duplicates the logic from the `state` property getter but avoids having to observe the attribute to synchronize its value to an attribute or CSS class in the shadow tree.
Still using only CSS, we can differentiate a placeholder tile from an unevaluated one using the `:empty` pseudo-class.
We'll only apply the *current* state to empty tiles, and other non-empty states to non-empty tiles, just in case the `state` attribute and element content are inconsistent.

In another note, to get the first character of the element's content, we won't use `s.charAt(0)` or equivalent `s.substring(0, 1)` as that wouldn't work for non-BMP characters.
We'll use `String.fromCodePoint(s.codePointAt(0))` instead.
I have no idea if this would be really useful, but there's also no reason not to do it given how easy it is.
Much more complex would be to correctly upper-case letters depending on locale: the JavaScript code itself doesn't run in the *context* of the element so `toLocaleUpperCase()` won't take into account `lang` attributes on the element itself or one of its ancestors, and it alternatively accepts an explicit locale but [there's no API](https://github.com/whatwg/html/issues/7039) to get the closest `lang` attribute (taking into account embedded shadow trees).
We'll thus only *display* in uppercase using CSS `text-transform: uppercase`, which correctly takes locale into account, and let users of the element (this will likely be ourselves later, in another to-be-built custom element) deal with it 🤷

<playground-ide project-src="/wordle-elements/wordle-tile.project.json" html-file="wordle-tile.html"></playground-ide>

What's next?
------------

In [followup installments]({% post_url 2022-02-13-deconstructing-and-rebuilding-wordle-2 %}), we'll create other elements, one at a time, to eventually get a working Wordle clone, customizable in many ways so you can build your own clone in different languages (e.g. [French](https://wordle.louan.me), [French](https://www.solitaire-play.com/lemot/), or [Hebrew](https://wordleheb.web.app/)), with different form-factors (e.g. playing [two](https://zaratustra.itch.io/dordle) or [four](https://quordle.com/)), or even different rules with a bit more work (e.g. words of varying length [with a hint](https://sutom.nocle.fr/) or finding [geographical points of interest](https://wordlemonde.fr/), an [adversarial version](https://qntm.org/files/wordle/), etc.)

Japanese: https://plum-chloride.jp/kotonoha-tango/index.html https://aseruneko.github.io/WORDLEja/
Portuguese: https://term.ooo/
Spanish: https://wordle.danielfrg.com/
Naughty: https://www.lewdlegame.com/
