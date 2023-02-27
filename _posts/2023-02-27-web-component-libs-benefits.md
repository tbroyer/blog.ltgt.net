---
layout: post
title: The benefits of Web Component Libraries
---

Web component browser APIs aren't that many, and not that hard to grasp (if you don't know about them, have a look at Google's [Learn HTML section](https://web.dev/learn/html/template/) and MDN's [Web Components guide](https://developer.mozilla.org/en-US/docs/Web/Web_Components));
but creating a web component actually requires [taking care of many small things](https://web.dev/custom-elements-best-practices/).
This is where web component libraries come in very handy, freeing us of having to think about some of those things by taking care of them for us.
Most of the things I'll mention here are handled one way of another by other libraries (GitHub's [Catalyst](https://catalyst.rocks/), [Haunted](https://github.com/matthewp/haunted), [Hybrids](https://hybrids.js.org/), Salesforce's [LWC](https://lwc.dev), [Slim.JS](https://slimjs.com/), Ionic's [Stencil](https://stenciljs.com/)) but I'll focus on Google's [Lit](https://lit.dev) and Microsoft's [FAST](https://fast.design) here as they probably are the most used web component libraries out there (ok, [I lied](https://npmtrends.com/@github/catalyst-vs-@lwc/compiler-vs-@microsoft/fast-element-vs-@stencil/core-vs-haunted-vs-hybrids-vs-lit-vs-slim-js), Lit definitely is, FAST not that much, far behind Lit and Stencil; but Lit and FAST have many things in common, starting with the fact that they are _just_ native web components, contrary to Stencil that _compiles_ to a web component).
Both Lit and FAST leverage TypeScript decorators to simplify the code even further so I'll use that in examples,
even though they can also be used in pure JS (decorators are coming to JS soon BTW). I'll also leave the most apparent yet most complex aspect for the end.

Let's dive in!

## Registration

It's a small detail, and I wouldn't even consider it a _benefit_;
it's mostly syntactic sugar, but with FAST at least it also does a few other things that we'll see later: registering the custom element.

In vanilla JS, it goes like this:

```js
class MyElement extends HTMLElement {}

customElements.define('my-element', MyElement);
```

With Lit:

```ts
@customElement('my-element')
class MyElement extends LitElement {}
```

And with FAST:

```ts
@customElement({
    name: 'my-element',
    // other properties will come here later
})
class MyElement extends FASTElement {}
```

## Attributes and Properties

With native HTML elements, we're used to accessing attribute (also known as _content attributes_ in the HTML spec) values as properties (aka _IDL attributes_) on the DOM element (think `id`, `name`, `checked`, `disabled`, `tabIndex`, etc. even `className` and `htmlFor` although they use sligthly different names to avoid conflicting with JS keywords) with sometimes some specificities: the `value` attribute of `<input>` elements is accessible through the `defaultValue` property, the `value` property giving access to the actual value of the element (along with `valueAsDate` and `valueAsNumber` that additionally convert the value).

Custom elements have to implement this themselves if they want it, and web component libraries make it a breeze.
They help us _reflect_ properties to attributes when they are modified (if that's what we want; and all while avoiding infinite loops), convert attribute values (always strings) to/from property values, or handle _boolean attributes_ (where we're only interested in their absence or presence, not their actual value: think `checked` and `disabled`).

Let's compare some of these cases, first without library:

```js
class MyElement extends HTMLElement {
    // Attributes have to be explicitly observed
    static get observedAttributes() {
        return [ 'reflected-converted', 'reflected', 'non-reflected', 'bool' ];
    }

    #reflectedConverted;

    // In a real element, you'd probably use a getter and setter
    // to somehow update the element when the property is set.
    nonReflected;

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
        case 'reflected-converted':
            // Convert the attribute value
            this.reflectedConverted = newValue != null ? Number(newValue) : null;
            break;
        case 'non-reflected':
            this.nonReflected = newValue;
            break;
        // other attributes handled in accessors below
        }
    }

    get reflectedConverted() {
        return this.#reflectedConverted;
    }
    set reflectedConverted(newValue) {
        // avoid infinite loop with attributeChangedCallback
        if (newValue !== this.#reflectedConverted) {
            this.#reflectedConverted = newValue;
            if (newValue == null) {
                this.removeAttribute('reflected-converted');
            } else {
                // Here we let the browser automatically convert to string
                this.setAttribute('reflected-converted', newValue);
            }
        }
    }

    get reflected() {
        return this.getAttribute('reflected');
    }
    set reflected(newValue) {
        if (newValue == null) {
            this.removeAttribute('reflected');
        } else {
            this.setAttribute('reflected', newValue);
        }
    }

    get bool() {
        return this.hasAttribute('bool');
    }
    set bool(newValue) {
        this.toggleAttribute('bool', newValue);
    }
}
```

Now with Lit:

```ts
class MyElement extends LitElement {
    @property({ attribute: 'reflected-converted', type: Number, reflect: true})
    reflectedConverted?: number;

    @property({ reflect: true })
    reflected?: string;

    @property({ attribute: 'non-reflected' })
    nonReflected?: string;

    @property({ type: Boolean })
    bool: boolean = false;
}
```

And with FAST:

```ts
class MyElement extends FASTElement {
    @attr({ attribute: 'reflected-converted', converter: nullableNumberConverter })
    reflectedConverted?: number;

    @attr reflected?: string;

    @attr({ attribute 'non-reflected', mode: 'fromView' })
    nonReflected?: string;

    @attr({ mode: 'boolean' })
    bool: boolean = false;
}
```

## Early-initialized properties

Another thing with properties is that they could be set on a DOM element even before it's _upgraded_:
the script that defines the custom element does not need to be loaded by the time the browser parses the custom tag in the HTML,
and some script might access that element in the DOM before the script that _defines_ it has loaded;
only then will the element be _upgraded_: the class instantiated to take control of the custom element.

When that happens, you wouldn't want properties that would have been set on the element earlier to be overwritten by the upgrade process.

Without a library, you would have to take care of it yourself with code similar to the following:

```js
class MyElement extends HTMLElement {
    constructor() {
        super();
        // "upgrade" properties
        for (const propName of ['reflectedConverted', 'reflected', 'nonReflected', 'bool']) {
            if (this.hasOwnProperty(propName)) {
                let value = this[propName];
                delete this[propName];
                this[propName] = value;
            }
        }
    }
}
```

Again, libraries do that for you, automatically, based on the previously seen declarations.

## Responding to property changes

The common way to respond to property changes is to implement a setter. This requires also implementing a getter though, as well as storing the value in a private field. When changing the value from `attributeChangedCallback`, make sure to also use the setter and not assign directly to the backing field.

To respond to changes to the `nonReflected` property in the above example, one would have to write it like so:

```js
#nonReflected;

get nonReflected() {
    return this.#nonReflected;
}
set nonReflected(newValue) {
    this.#nonReflected = newValue;
    // respond to change here
}
```

Both Lit and FAST provide their own way of doing this, though most of the time this is not really needed given that most reaction to change is to update the shadow tree, and Lit and FAST have their own ways of doing this ([see below](#rendering-and-templating) for more about rendering).

With Lit, you listen to changes to any property and have to tell them apart by name, a bit similar to `attributeChangedCallback` but _batched_ for several properties at a time:

```ts
@property({ attribute: 'non-reflected' })
nonReflected?: string;

// You could also use updated(changedProperties), depending on your needs
willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("nonReflected")) {
        // respond to change here
    }
}
```

With FAST, you can implement a method with a `Changed` suffix appended to the property name:

```ts
@attr({ attribute 'non-reflected', mode: 'fromView' })
nonReflected?: string;

nonReflectedChanged(oldValue?: string, newValue?: string) {
    // respond to change here
}
```

## Shadow DOM and CSS stylesheets

The most efficient way to manage CSS stylesheets in Shadow DOM is to use so-called _constructable stylesheets_: construct a `CSSStyleSheet` instance once (or soon `import` a CSS file), then reuse it in each element's shadow tree through `adoptedStyleSheets`:

```js
const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    :host { display: block; }
    :host([hidden]) { display: none; }
`);

class MyElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [ sheet ];
    }
}
```

With Lit, you'd rather use this more _declarative_ syntax:

```ts
class MyElement extends HTMLElement {
    static styles = css`
        :host { display: block; }
        :host([hidden]) { display: none; }
    `;
}
```

and similarly with FAST:

```ts
const styles = css`
    :host { display: block; }
    :host([hidden]) { display: none; }
`;

@customElement({
    name: 'my-element',
    styles,
})
class MyElement extends FASTElement {}
```

Constructable stylesheets currently still require a polyfill in Safari though (this is being added in Safari 16.4), but both Lit and FAST take care of this for you.

## Rendering and templating

The most efficient way to populate the shadow tree of a custom element is by cloning a _template_ that has been initialized once.
That template could be any document fragment but the `<template>` element was made specifically for these use-cases.
You would then retrieve nodes inside the shadow tree to add event listeners and/or manipulate it in response to those inside events or to attribute and property changes ([see above](#responding-to-property-changes)) from the outside.

```js
const template = document.createElement('template');
template.innerHTML = `
    <button>Add</button>
    <output></output>
`;

class MyElement extends HTMLElement {
    #output;

    constructor() {
        super();
        // … (upgrade properties as seen above) …
        this.attachShadow({ model: 'open' });
        this.shadowRoot.append(template.content.cloneNode(true));
        // Using an <output> element makes it easier
        // We could also create a text node and append it ourselves
        this.#output = this.shadowRoot.querySelector('output');
        this.shadowRoot.querySelector('button').addEventListener('click', () => this.count++);
        this.#output.value = this.count;
    }

    // … (count property, with attribute changed callback and converter) …
    set count(value) {
        // … (reflect to attribute or whatever) …
        this.#output.value = value;
    }
}

customElements.define('my-element', MyElement);
```

Things get much more complex when you want to conditionally render some subtrees (the easiest probably being to toggle their `hidden` attribute), or render and update a list of elements.

This is where Lit and FAST (and a bunch of other libraries) work much differently from the above, introducing the concept of _reactive_ or _observable_ properties and a _render_ lifecycle based on a specific syntax for templates allowing placeholders for dynamic values, a syntax to register event listeners right from the template, and composability.

With Lit, that could look like:

```ts
@customElement('my-element')
class MyElement extends LitElement {
    @property count: number = 0;

    render() {
        // No need for an <output> element here, though we could
        // (and it would possibly even be better for accessibility)
        return html`
            <button @click=${this.#increment}>Add</button>
            ${this.count}
        `;
    }

    #increment() {
        this.count++;
    }
}
```

and with FAST:

```ts
// No need for an <output> element here, though we could
// (and it would possibly even be better for accessibility)
const template = html<MyElement>`
    <button @click=${x => x.count++}>Add</button>
    ${x => x.count}
`;

@customElement({
    name: 'my-element',
    template,
})
class MyElement extends FASTElement {
    @attr({ converter: numberConverter }) count: number = 0;
}
```

The way Lit and FAST work is by observing changes to the properties and scheduling an update everytime it happens.

With Lit, the update (also called _rerender_) will call the `render()` method of the component and then process the template. The rerender is scheduled using a [microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) such that it can _batch_ changes to multiple properties into a single rerender.

With FAST, the update is instead scheduled using `requestAnimationFrame` (achieving the same _batching_ as Lit) and will call every lambda of the template that needs to be: FAST tracks which dynamic part uses which properties to only reevaluate those parts when a given property changes.

In the examples above, any change to the `count` property, either from the outside or in response to the click of the button, schedules a update.
And in FAST's case, only the `x => x.count` lambda is called and the corresponding DOM node updated.
In Lit's case, the button's click listener would also be evaluated, but determined to be the same as before so no change would be performed.

The `html` tagged template literal (both in Lit and FAST, also in other libraries such as [`@github/jtml`](https://github.com/github/jtml)) will use a `<template>` under the hood to parse the HTML once and reuse it later, just like the `css` seen earlier uses a constructable stylesheet. It puts markers in the HTML (special comments, elements or attributes) in place of the dynamic parts so it can find them back to attach event listeners and inject values, making it possible to _surgically_ update only the nodes that need it, without touching anything else (FAST actually being even more _surgical_ by tracking the properties used in each dynamic part).

With Lit's `render()` method returning such a _template_ and called each time a property or internal state changed, its programming model looks a bit like React, rerendering and returning a new JSX each time a prop or state changed;
while FAST's approach looks a bit more like Angular (or Vue or Svelte) where each component is associated with a single template at definition time.

## Other niceties

Lit and FAST also provide some helpers to peek into the shadow tree: to get a direct reference to some node, or the `<slot>`s' assigned nodes.

Lit also pioneers [_reactive controllers_](https://lit.dev/docs/composition/controllers/) that allow code reuse between components through composition, where the controller can _hook_ into the render lifecycle (i.e. trigger a rerender of the component that uses the controller).
The goal is ultimately to make them [reusable across frameworks](https://github.com/webcomponents-cg/community-protocols/issues/27) too.
Some have already embraced it, like Haunted with [its `useController()`](https://hauntedhooks.netlify.app/docs/hooks/usecontroller/) that allows using reactive controllers in Haunted components, or [Apollo Elements](https://apolloelements.dev/) that's built around reactive controllers. Lit also provides a `useController()` React hook as part of its `@lit-labs/react` package (that also makes it easier to use a Lit component in a React application by wrapping it as a React component), and [there are prototypes](https://github.com/lit/lit/issues/1682) for several frameworks such as Angular or Svelte, or even native web components [through a mixin](https://next.apolloelements.dev/api/libraries/mixins/controller-host-mixin/).
FAST developers are interested in supporting reactive controllers too, but those currently don't quite match with the way FAST updates the rendering.

The Lit team provides reactive controllers to [manage contextual values](https://github.com/lit/lit/tree/main/packages/labs/context), easily [wire asynchronous tasks](https://lit.dev/docs/composition/controllers/#asynchronous-tasks) to rendering, [wrap a bunch of native observers](https://github.com/lit/lit/tree/main/packages/labs/observers) (mutation, resize, intersection, performance), or [handle routing](https://github.com/lit/lit/tree/main/packages/labs/router). Others are embracing them too: Apollo Elements for GraphQL already cited above; James Garbutt has [a collection of utilities](https://github.com/43081j/relit) for Lit, many of them being reactive controllers usable outside Lit; [Nano Stores](https://github.com/nanostores/lit) provide reactive controllers; Guillem Cordoba has [controllers for Svelte Stores](https://github.com/guillemcordoba/lit-svelte-stores); etc.

## Conclusion

Web component libraries are really helpful to streamline the development of your components.
While you could develop custom elements without library, chances are you'd be eventually creating your own set of helpers, reinventing the wheel (there are [more than enough](https://webcomponents.dev/blog/all-the-ways-to-make-a-web-component/board/) ways to build web components already).
Understand what each library brings and pick one.
