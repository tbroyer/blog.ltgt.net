---
layout: post
title: Deconstructing and rebuilding Wordle (part 2)
has_playground_elements: true
additional_csp:
    script_src: "https://unpkg.com"
---

In the [first installment]({% post_url 2022-02-09-deconstructing-and-rebuilding-wordle %}), we deconstructed Wordle and then built a `wordle-tile` custom element.
We'll now build a `wordle-row`.

Five in a row
-------------

As with a tile, the role of that element will only be about displaying data, with no interaction.
The element will therefore be responsible for managing its internal content (shadow tree) depending on its inputs (attributes and properties) to make it respect the game invariants.

A row contains 5 tiles.
It can be either empty, as a placeholder, the current row, or an evaluated guess.
When in the empty or evaluated state, a row is immutable: either empty or fulfilled.
The *current* state is more complex.

An empty row only contains empty tiles.
An evaluated row only contains evaluated tiles (either correct, present or absent).
The current row can contain a mix of empty and unevaluated tiles, and a current tile, where evaluated tiles are always at the beginning, empty tiles at the end, and the current tile in between.
The current row can be entirely empty in which case the first tile is the current tile, or filled up, in which case all tiles are unevaluated tiles.
Letters can thus be added or removed, and this moves the current tile as the row fills up.

<script type="module" src="/wordle-elements/wordle-row.js"></script>
<style>
    wordle-row {
        max-width: max-content;
    }
</style>
<wordle-row current></wordle-row>
<wordle-row current>g</wordle-row>
<wordle-row current>gu</wordle-row>
<wordle-row current>gue</wordle-row>
<wordle-row current>gues</wordle-row>
<wordle-row current>guess</wordle-row>

When in the *evaluated* state, all letters must have an *evaluation*.

To model those states, we'll use the element's content for the letters, a `current` boolean attribute to help distinguish an empty row from an empty *current* row, and a way to set the evaluations.

Those elements can be combined in invalid, conflicting ways, so we need to define ways to resolve those conflicts, with priorities among them, similar to what we did with the `wordle-tile` element where a `state=current` is ignored for a non-empty tile, and other `state` attribute values are ignored for empty tiles.

Let's start with the easy, non-conflicting situations.
The default state for an element (with no content and no attribute) will be the *empty* state.
When it has no content but a `current` attribute, it's in the *current* state.
When its content is longer than the maximum allowed letters, extraneous letters are ignored (similar to the `wordle-tile`).
When its content is long enough, is doesn't have a `current` attribute, and it has enough evaluations for all letters, it's in the *evaluated* state.

Now for the invalid situations.
What to do if the row is fulfilled, has evaluations for all letters, but also has a `current` attribute? We'll treat it as the current row and ignore the evaluations.
What if there aren't enough evaluations for all letters? We'll ignore the evaluations.
But then what to do if there's content but neither evaluations (or too few) nor a `current` attribute? In this case we'll ignore the content.

To sum up, as soon as there's a `current` attribute, it's the current row and evaluations if any are ignored.
In the absence of a `current` attribute, either there are enough letters **and** enough evaluations and then it's an evaluated row, or we ignore everything and treat it as an empty row.
Note that things are *only* ignored, i.e. they don't change the display, but they're still *there*, so adding a missing item can change its state *non-linearly*. For instance, if the row has enough content and evaluations but is missing both the `current` attribute and one evaluation, it'll be in the *empty* state.

<wordle-row evaluations="correct present absent correct">guess</wordle-row>

Adding the `current` attribute will turn it into a fulfilled *current* row.

<wordle-row current evaluations="correct present absent correct">guess</wordle-row>

If instead one evaluation is added, it becomes an evaluated row.

<wordle-row evaluations="correct present absent correct present">guess</wordle-row>

Finally, to make it more flexible, we'll actually make the number of tiles configurable, through a `length` attribute and reflected property.
We can also make the tile element name configurable, so users can provide their own tile element with a different rendering, provided it respects the same contract as `wordle-tile`.

<wordle-row current length="7">wordle</wordle-row>

In terms of implementation, because we'll have to use the length at different places, we'll change the way we parse its value from the attribute by memoizing it:
the property setter still modifies the attribute, but we'll now listen for the attribute change and store its parsed value in a private field, that the property getter will then directly return.

<svg xmlns="http://www.w3.org/2000/svg" width="721" height="237" viewBox="-0.5 -0.5 721 237"><ellipse cx="660" cy="180" fill="#FFF" stroke="#007fff" rx="60" ry="40"/><text x="660" y="184" font-size="12" text-anchor="middle">attribute</text><ellipse cx="460" cy="180" fill="#FFF" stroke="#007fff" rx="60" ry="40"/><text x="460" y="184" font-size="12" text-anchor="middle">property</text><path fill="none" stroke="#007fff" stroke-miterlimit="10" d="M517.57 68.28Q480 100 462.85 134.3"/><path fill="#007fff" stroke="#007fff" stroke-miterlimit="10" d="M460.5 139v-7.83l2.35 3.13h3.91Z"/><text x="482" y="102" font-size="11" text-anchor="middle">get</text><path fill="none" stroke="#007fff" stroke-miterlimit="10" d="M502.43 208.28Q560 230 611.62 210.53"/><path fill="#007fff" stroke="#007fff" stroke-miterlimit="10" d="m616.53 208.68-5.32 5.74.41-3.89-2.88-2.66Z"/><text x="560" y="233" font-size="11" text-anchor="middle">set</text><ellipse cx="560" cy="40" fill="#FFF" stroke="#007fff" rx="60" ry="40"/><text x="560" y="44" font-size="12" text-anchor="middle">field</text><path fill="none" stroke="#007fff" stroke-miterlimit="10" d="M660 140q-10-20-20-35t-32.57-32.78"/><path fill="#007fff" stroke="#007fff" stroke-miterlimit="10" d="m603.3 68.98 7.67 1.58-3.54 1.66-.79 3.84Z"/><text x="636" y="103" font-size="11" text-anchor="middle">attributeChangedCallback</text><ellipse cx="260" cy="115" fill="#FFF" stroke="#007fff" rx="60" ry="40"/><text x="260" y="119" font-size="12" text-anchor="middle">attribute</text><ellipse cx="60" cy="115" fill="#FFF" stroke="#007fff" rx="60" ry="40"/><text x="60" y="119" font-size="12" text-anchor="middle">property</text><path fill="none" stroke="#007fff" stroke-miterlimit="10" d="M217.57 86.72Q160 65 108.38 84.47"/><path fill="#007fff" stroke="#007fff" stroke-miterlimit="10" d="m103.47 86.32 5.32-5.74-.41 3.89 2.88 2.66Z"/><text x="160" y="68" font-size="11" text-anchor="middle">get</text><path fill="none" stroke="#007fff" stroke-miterlimit="10" d="M102.43 143.28Q160 165 211.62 145.53"/><path fill="#007fff" stroke="#007fff" stroke-miterlimit="10" d="m216.53 143.68-5.32 5.74.41-3.89-2.88-2.66Z"/><text x="160" y="168" font-size="11" text-anchor="middle">set</text></svg>

By the way, we'll also handle the shadow tree much differently from the the `wordle-tile`:
because the rendering (updating the shadow tree) can be quite heavyweight, we'll try to do it only once per event loop, rather than each time a property changes.
Imagine the situation where the element is dynamically created, so it starts empty, with no evaluations and with length 5. For some reason, the code first sets `current` to true, then the content to a 6-character long value, and finally the length to 7. We don't want to first change the state of the first tile to `current`, then undo it and set each tile's letter, and finally add two more tiles, set the sixth one's letter (the one that was previously ignored because it overflowed) and the seventh one's `current` to true.
Instead, we'll *batch* those changes into a [microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) and do the rendering once all properties have been updated.
To do that, we'll listen for all the changes (to attributes using `attributeChangedCallback`, and to the content with a `MutationObserver`) and queue a microtask when they happen, using a flag to avoid queueing more than one.

<playground-ide project-src="/wordle-elements/wordle-row.project.json" html-file="wordle-row.html"></playground-ide>
