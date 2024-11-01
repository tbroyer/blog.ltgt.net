---
layout: post
title: Making Web Component properties behave closer to the platform
discuss_url: https://dev.to/tbroyer/making-web-component-properties-behave-closer-to-the-platform-c1n/comments
last_modified: 2024-02-25
---

Built-in HTML elements' properties all share similar behaviors, that don't come _for free_ when you write your own custom elements. Let's see [what](#what) those behaviors are, [why](#why) you'd want to implement them in your web components, and [how](#how) to do it, including how some web component libraries actually don't allow you to mimic those behaviors.

## Built-in elements' behaviors {#what}

I said it already: built-in elements' properties all share similar behaviors, but there are actually several different such shared behaviors. First, there are properties (known as _IDL attributes_ in the HTML specification) that _reflect_ attributes (also known as _content attributes_); then there are other properties that are unrelated to attributes. One thing you won't find in built-in elements are properties whose value will change if an attribute change, but that _won't_ update the attribute value when they are changed themselves (in case you immediately thought of `value` or `checked` as counter-examples, the situation is actually a bit more complex: those attributes are reflected by the `defaultValue` and `defaultChecked` properties respectively, and the `value` and `checked` properties are based on an internal state and behave differently depending on whether the user already interacted with the element or not).

### Type coercion

But I'll start with another aspect that is shared by all of them, whether reflected or not: typing. DOM interfaces are defined using [WebIDL](https://webidl.spec.whatwg.org), that has types and _extended annotations_, and defines mapping of those to JavaScript. [Types in JavaScript](https://tc39.es/ecma262/#sec-ecmascript-language-types) are rather limited: null, undefined, booleans, IEEE-754 floating-point numbers, big integers, strings, symbols, and objects (including errors, functions, promises, arrays, and typed arrays). WebIDL on the other hand defines, among others, 13 different numeric types (9 integer types and 4 floating point ones) that can be further annotated to change their overflowing behavior, and several string types (including enumerations).

The way those types are experienced by developers is that getting the property will always return a value of the defined type (that's easy, the element _owns_ the value), and setting it (if not read-only) will coerce the assigned value to the defined type. So if you want your custom element to _feel_ like a built-in one, you'll have to define a setter to coerce the value to some specific type. The underlying question is what should happen if someone assigns a value of an unexpected type or outside the expected value space?

{% pullquote "presentation" %}Convert and validate the new value in a property custom setter.{% endpullquote %}

You probably don't want to use the exact WebIDL coercion rules though, but similar, approximated, rules that will behave the same most of the time and only diverge on some edge cases. The reason is that WebIDL is really weird: for instance, by default, numeric values overflow by wrapping around, so assigning 130 to a `byte` (whose value space ranges from -128 to 127) will coerce it to… -126! (128 wraps to -128, 129 to -127, and 130 to -126; and by the way 256 wraps to 0; for the curious, `BigInt.asIntN` and `BigInt.asUintN` will do such wrapping in JS, but you'll have to convert numbers to `BigInt` and back); non-integer values assigned to integer types are truncated by default, except when the type is annotated with `[Clamp]`, in which case they're rounded, with half-way values rounded towards even values (something that only happens _natively_ in JS when setting such non-integer values to typed arrays: `Math.round(2.5)` is 3, but `Int8Array.of(2.5)[0]` is 2).

Overall, I feel like, as far as primitive/simple types are concerned, boolean, integers, double (not float), string (WebIDL's `DOMString`), and enumerations are all that's needed; truncating (or rounding, but with JavaScript rules), and clamping or enforcing ranges for integers. In other words, wrapping integers around is just weird, and what matters is coercing to the appropriate type and value space. Regarding enumerations, they're probably best handled by the reflection rules though (see below), and treated only as strings: no single built-in element has a property of a type that's a WebIDL `enum`.

### Reflected properties

Now let's get back to reflected properties: most properties of built-in elements [reflect attributes](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes "HTML Living Standard: Reflecting content attributes in IDL attributes") or similarly (but with specific rules) correspond to an attribute and change its value when set; non-reflected properties are those that either expose some internal state (e.g. the current value or validation state of a form field), computed value (from the DOM, such as the `selectedIndex` of a `select`, or the `cellIndex` of a table cell) or direct access to DOM elements (elements of a form, rows of a table, etc.), or that access other reflected properties with a transformed value (such as the `valueAsDate` and `valueAsNumber` of `input`). So if you want your custom element to _feel_ like a built-in one, you'll want to use similar _reflection_ wherever appropriate.

{% pullquote "presentation" %}Have your properties reflect attributes by default.{% endpullquote %}

The way reflection is defined is that the source of truth is the attribute value: getting the property will actually parse the attribute value, and setting the property will _stringify_ the value into the attribute. Note that this means possibly setting the attribute to an _invalid_ value that will be _corrected_ by the getter. An example of this is setting the `type` property of an `input` element to an unknown value: it will be reflected in the attribute as-is, but the getter will correct it `text`. Another example where this is required behavior is with dependent attributes like those of `progress` or `meter` elements: without this you'd have to be very careful setting properties in the _right order_ to avoid invalid combinations and having your set value immediately rewritten, but this behavior makes it possible to update properties in any order as the interaction between them are resolved internally and exposed by the getters: you can for example set the `value` to a value upper than `max` (on getting, `value` would be normalized to its default value) and then update the `max` (on getting, value could now return the value you previously set, because it wasn't actually rewritten on setting). Actually, these are not _technically_ reflected then as they have specific rules, but at least they're consistent with _actual_ reflected properties; for the purpose of this article, I'll consider them as reflected properties though.

This is at least how it _theoretically_ works; in practice, the parsed value can be _cached_ to avoid parsing every time the property is read; but note that there can be several properties reflecting the same attribute (the most known one probably being `className` and `classList` both reflecting the `class` attribute). Reflected properties can also have additional options, depending on their type, that will change the behavior of the getter and setter, not unlike WebIDL extended attributes.

Also note that HTML only defines reflection for a limited set of types (if looking only at primitive/simple types, only non-nullable and nullable strings and enumerations, `long`, `unsigned long`, and `double` are covered, and none of the narrower integer types, big integers, or the `unrestricted double` that allows `NaN` and infinity).

You can see how Mozilla tests the compliance of their built-in elements
[in the Gecko repository](https://github.com/mozilla/gecko-dev/blob/master/dom/html/test/reflect.js) (the `ok` and `is` assertions are defined in their [`SimpleTest`](https://github.com/mozilla/gecko-dev/blob/master/testing/mochitest/tests/SimpleTest/SimpleTest.js) testing framework). And here's the Web Platform Tests' [reflection harness](https://github.com/web-platform-tests/wpt/blob/master/html/dom/reflection.js), with data for each built-in element in sibling files, that [almost every browser pass](https://wpt.fyi/results/html/dom).

### Events

Most direct changes to properties and attributes don't fire events: user actions or method calls will both update a property **and** fire an event, but changing a property programmatically generally won't fire any event. There are a few exceptions though: the events of type `ToggleEvent` fired by changes to [the `popover` attribute](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute%3Aconcept-element-attributes-change-ext) or [the `open` attribute of `details` elements](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element%3Aconcept-element-attributes-change-ext), or the `select` event when changing the [`selectionStart`](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection%3Adom-textarea%2Finput-selectionstart-2 "HTML Living Standard: selectionStart attribute's setter"), [`selectionEnd`](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection%3Adom-textarea%2Finput-selectionend-3 "HTML Living Standard: selectionEnd attribute's setter") or [`selectionDirection`](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#textFieldSelection:dom-textarea/input-selectiondirection-4 "HTML Living Standard: selectionDirection attribute's setter") properties of `input` and `textarea` elements (if you know of others, let me know); but notably changing the value of a form element programmatically won't fire a `change` or `input` event. So if you want your custom element to _feel_ like a built-in one, don't fire events from your property setters or other attribute changed callbacks, but fire an event _when_ (just after) you programmatically change them.

{% pullquote "presentation" %}Don't fire events from your property setters or other attribute changed callbacks.{% endpullquote %}

## Why you'd want to implement those {#why}

If you're you (your team, your company) are the only users of the web components (e.g. building an application out of web components, or an _internal_ library of reusable components), then OK, don't use reflection if you don't need it, you'll be the only user anyway so nobody will complain. If you're publicly sharing those components, then my opinion is that, following the principle of least astonishment, you should aim at behaving more like built-in elements, and reflect attributes.

Similarly, for type coercions, if you're the only users of the web components, it's ok to only rely on TypeScript (or Flow or whichever type-checker) to make sure you always pass values of the appropriate type to your properties (and methods), but if you share them publicly then you should in my opinion coerce or validate inputs, in which case you'd want to follow the principe of least astonishment as well, and thus use rules similar to WebIDL and reflection behaviors. This is particularly true for a library that can be used without specific tooling, which is generally the case for custom elements.

For example, all the following design systems can be used without tooling (some of them provide ready-to-use bundles, others can be used through import maps): Google's [Material Web](https://github.com/material-components/material-web/discussions/5239), Microsoft's [Fluent UI](https://github.com/microsoft/fluentui/tree/master/packages/web-components), IBM's [Carbon](https://carbondesignsystem.com/developing/frameworks/web-components/), Adobe's [Spectrum](https://opensource.adobe.com/spectrum-web-components/), Nordhealth's [Nord](https://nordhealth.design/web-components/), [Shoelace](https://shoelace.style/), etc.

## How to implement them {#how}

Now that we've seen [what](#what) we'd want to implement, and [why](#why) we'd want to implement it, let's see _how_ to do it. First without, and then [with](#libraries) libraries.

I started collecting implementations that _strictly_ follow (as an exercise, not as a goal) the above rules in [a GitHub repository](https://github.com/tbroyer/custom-elements-reflection-tests) (strictly because it directly reuses the above-mentioned Gecko and Web Platform Tests harnesses).

### Vanilla implementation {#vanilla}

In a _vanilla_ custom element, things are rather straightforward:

```js
class MyElement extends HTMLElement {
  get reflected() {
    const strVal = this.getAttribute("reflected");
    return parseValue(strVal);
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.setAttribute("reflected", stringifyValue(newValue));
  }
}
```

or with intermediate caching (note that the setter is identical, setting the attribute will trigger the `attributeChangedCallack` which will close the loop):

```js
class MyElement extends HTMLElement {
  #reflected;

  get reflected() {
    return this.#reflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.setAttribute("reflected", stringifyValue(newValue));
  }

  static get observedAttributes() {
    return [ "reflected" ];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    // Note: in this case, we know it can only be the attribute named "reflected"
    this.#reflected = parseValue(newValue);
  }
}
```

And for a non-reflected property (here, a read-write property representing an internal state):

```js
class MyElement extends HTMLElement {
  #nonReflected;
  get nonReflected() {
    return this.#nonReflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.#nonReflected = newValue;
  }
}
```

Because many rules are common to many attributes (the `coerceType` operation is defined by WebIDL, or using similar rules, and the HTML specification defines a handful of _microsyntaxes_ for the `parseValue` and `stringifyValue` operations), those could be packaged up in a helper library. And with decorators [coming to ECMAScript](https://github.com/tc39/proposal-decorators) (and already available in TypeScript), those could be greatly simplified:

```js
class MyElement extends HTMLElement {
  @reflectInt accessor reflected;
  @int accessor nonReflected;
}
```

I actually built such a library, mostly as an exercise (and I already learned a lot, most of the above details actually). It's currently not published on NPM but you can find it [on Github](https://github.com/tbroyer/platformer "The Platformer library on GitHub")

### With a library {#libraries}

Surprisingly, web component libraries don't really help us here.

First, like many libraries nowadays, most expect people to just pass values of the appropriate types (relying on type checking through TypeScript) and basically leave you handling everything including how to behave in the presence of unexpected values. While it's OK, as we've seen [above](#why), in a range of situations, there are limits to this approach and it's unfortunate that they don't provide tools to make it easier at least coercing types.

Regarding reflected properties, most libraries tend to discourage you from doing it, while (fortunately!) supporting it, if only minimally.

All libraries (that I've looked at) support observed attributes though (changing the attribute value updates the property, but not the other way around), and most default to this behavior.

Now let's dive into the _how-to_ with Lit, [FAST](#fast), and then [Stencil](#stencil) (other libraries left as a so-called exercise for the reader).

#### With Lit {#lit}

By default, [Lit reactive properties](https://lit.dev/docs/components/properties/) (annotated with `@property()`) observe the attribute of the same (or configured) name, using a converter to parse the value if needed (by default only handling numbers through a plain JavaScript number coercion, booleans, strings, or possibly objects or arrays through `JSON.parse()`; but a custom converter can be given). If your property is not associated to any attribute (but needs to be reactive to trigger a render when changed), then you can annotate it with `@property({ attribute: false })` or `@state()` (the latter is meant for internal state though, i.e. private properties).

To make a reactive property [reflect an attribute](https://lit.dev/docs/components/properties/#reflected-attributes), you'll add `reflect: true` to the `@property()` options, and Lit will use the converter to stringify the value too. This won't be done immediately though, but only as part of Lit's reactive update cycle. This timing is a slight deviation compared to built-in elements that's probably acceptable, but it makes it harder to implement some reflection rules (those that set the attribute to a different value than the one returned by the getter) as the converter will always be called with the property value (returned by the getter, so after normalization). For a component similar to `progress` or `meter` with dependent properties, Lit recommends correcting the values in a `willUpdate` callback (this is where you'd check whether the `value` is valid with respect to the `max` for instance, and possibly overwrite its value to bring it in-range); this means that attributes will have the corrected value, and this requires users to update all properties in the same _event loop_ (which will most likely be the case anyway).

It should be noted that, surprisingly, Lit _actively_ discourages reflecting attributes:

> Attributes should generally be considered input to the element from its owner, rather than under control of the element itself, so reflecting properties to attributes should be done sparingly. It's necessary today for cases like styling and accessibility, but this is likely to change as the platform adds features like the `:state` pseudo selector and the Accessibility Object Model, which fill these gaps.

No need to say I disagree.

For type coercion and validation, Lit allows you to have [your own accessors](https://lit.dev/docs/components/properties/#accessors-custom "Lit documentation: Reactive properties: creating custom property accessors") (and version 3 makes it [even easier](https://lit.dev/docs/v3/releases/upgrade/#updates-to-lit-decorators "Lit 3 upgrade guide: Updates to Lit decorators")), so everything's ok here, particularly for non-reflected properties:

```js
class MyElement extends LitElement {
  #nonReflected;
  get nonReflected() {
    return this.#nonReflected;
  }
  @state()
  set nonReflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.#nonReflected = newValue;
  }
}
```

For those cases where you'd want the attribute to possibly have an _invalid_ value (to be corrected by the property getter), it would mean using a non-reactive property wrapping a private reactive property (this assumes Lit won't flag them as errors in future versions), and parsing the value in its getter:

```js
class MyElement extends LitElement {
  @property({ attribute: "reflected", reflect: true })
  accessor #reflected = "";

  get reflected() {
    return parseValue(this.#reflected);
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.#reflected = stringifyValue(newValue);
  }
}
```

or with intermediate caching (note that the setter is identical):

```js
class MyElement extends LitElement {
  @property({ attribute: "reflected", reflect: true })
  accessor #reflected = "";

  #parsedReflected = "";
  get reflected() {
    return this.#parsedReflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.#reflected = stringifyValue(newValue);
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("#reflected")) {
      this.#parsedReflected = parseValue(this.#reflected);
    }
  }
}
```

It might actually be easier to directly set the attribute from the setter (and as a bonus behaving closer to built-in elements) and only rely on an _observed property_ from Lit's point of view (setting the attribute will trigger `attributeChangedCallback` and thus Lit's _observation_ code that will use the converter and then set the property):

```js
class MyElement extends LitElement {
  @property({
    attribute: "reflected",
    converter: (value) => parseValue(value),
  })
  accessor #reflected = "";

  get reflected() {
    return this.#reflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.setAttribute("reflected", stringifyValue(newValue));
  }
}
```

Note that this is actually very similar to the approach in the vanilla implementation above but using Lit's own lifecycle hooks. It should also be noted that for a `USVString` that contains a URL (where the attribute value is resolved to a URL relative to the document base URI) the value needs to be processed in the getter (as it depends on an external state –the document base URI– that could change independently from the element).

<details>
<summary>A previous version of this article contained a different implementation that happened to be broken.</summary>

```js
class MyElement extends LitElement {
  #reflected = "";
  get reflected() {
    return this.#reflected;
  }
  @property()
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    const stringValue = stringifyValue(newValue);
    // XXX: there might be a more optimized way
    // than stringifying and then parsing
    this.#reflected = parseValue(stringValue);
    // Avoid unnecessarily triggering attributeChangedCallback
    // that would reenter that setter.
    if (this.getAttribute("reflected") !== stringValue) {
      this.setAttribute("reflected", stringValue);
    }
  }
}
```

This implementation would for instance have the setter called with `null` when the attribute is removed, which actually needs to behave differently than user code calling the setter with `null`: in the former case the property should revert to its default value, in the latter case that `null` would be coerced to the string `"null"` or the numeric value `0` and the attribute would be added back with that value.

</details>

If we're OK only reflecting valid values to attributes, then we can fully use converters but things aren't necessarily simpler (we still need the custom setter for type coercion and validation, and marking the internal property as reactive to avoid triggering the custom setter when the attribute changes; we don't directly deal with the attribute but we now have to _normalize_ the value in the setter in the same way as stringifying it to the attribute and parsing it back, to have the getter return the appropriate value):

```js
const customConverter = {
  fromAttribute(value) {
    return parseValue(value);
  },
  toAttribute(value) {
    return stringifyValue(value);
  },
};

class MyElement extends LitElement {
  @property({ reflect: true, converter: customConverter })
  accessor #reflected = "";
  get reflected() {
    return this.#reflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    // XXX: this should use a more optimized conversion/validation
    this.#reflected = parseValue(stringifyValue(newValue));
  }
}
```

#### With FAST {#fast}

I know [FAST](https://www.fast.design/) is not used that much but I wanted to cover it as it seems to be the only library that [reflects attributes by default](https://www.fast.design/docs/fast-element/defining-elements#customizing-attributes "FAST Documentation: Building Components: Customizing Attributes"). By default it won't do any type coercion unless you use the `mode: "boolean"`, which works _almost_ like an HTML boolean attribute, except an attribute present but with the value `"false"` will coerce to a property value of `false`!

Otherwise, it works more or less like Lit, with one big difference: the converter's `fromView` is _also_ called when setting the property (this means that `fromView` receives any _external_ value, not just string values from the attribute). But unfortunately this doesn't really help us as most coercion rules need to throw at one point and we want to do it only in the property setters, never when parsing attribute values; and those rules that don't throw will have possibly different values between the attribute and the property getter (push invalid value to the attribute, sanitize it on the property getter), or just behave differently between the property (e.g. turning a `null` into `0` or `"null"`) and the attribute (where `null` means the attribute is not set, and the property should then have its default value which could be different from `0`, and will likely be different from `"null"`).

This means that in the end the solutions are almost identical to the Lit ones (here using TypeScript's _legacy_ decorators though; and applying the annotation on the _private_ property to avoid triggering the custom setter on attribute change):

```ts
class MyElement extends FASTElement {
  @attr({ attribute: "reflected" })
  private _reflected = "";

  get reflected() {
    return parseValue(this._reflected);
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this._reflected = stringifyValue(newValue);
  }
}
```

or with intermediate caching (note that the setter is identical):

```ts
class MyElement extends FASTElement {
  @attr({ attribute: "reflected" })
  private _reflected = "";

  private _reflectedChanged(oldValue, newValue) {
    this._parsedReflected = parseValue(newValue);
  }

  private _parsedReflected;
  get reflected() {
    return this._parsedReflected;
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.__reflected = stringifyValue(newValue);
  }
}
```

Or if you want immediate reflection to the attribute (the internal property can now be used to store the parsed value):

```ts
class MyElement extends FASTElement {
  @attr({
    attribute: "reflected",
    mode: "fromView",
    converter: {
      fromView(value) {
        return parseValue(value);
      },
      toView(value) {
        // mandatory in the converter type
        throw new Error("should never be called");
      }
    }
  })
  private _reflected;

  get reflected() {
    return this._reflected ?? "";
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this.setAttribute("reflected", stringifyValue(newValue));
  }
}
```

Note that the internal property is not initialized, to avoid calling the converter's `fromView`, and handled in the getter instead (our `fromView` expects a string or null coming from the attribute, so we'd have to initialize the property with such a string value which would hurt readability of the code as that could be a value different from the one actually stored in the property and returned by the pblic property getter).

If we're OK only reflecting valid values to attributes, then we can fully use converters but things aren't necessarily simpler (we still need the custom setter for type coercion and validation, and marking the internal property as reactive to avoid triggering the custom setter when the attribute changes; we don't directly deal with the attribute but we still need to call `stringifyValue` as we know the converter's `fromView` will receive the new value):

```ts
const customConverter = {
  fromView(value) {
    return parseValue(value);
  },
  toView(value) {
    return stringifyValue(value);
  },
};

class MyElement extends FASTElement {
  @attr({ attribute: "reflected ", converter: customConverter })
  private _reflected;

  get reflected() {
    return this._reflected ?? "";
  }
  set reflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this._reflected = stringifyValue(newValue);
  }
}
```

For non-reflected properties, you'd want to use `@observable` instead of `@attr`, except that it doesn't work on custom accessors, so you'd have to [do it manually](https://www.fast.design/docs/fast-element/observables-and-state#access-tracking "FAST Documentation: Building Components: Observables and State: Access Tracking"):

```ts
class MyElement extends FASTElement {
  private _nonReflected = "";
  get nonReflected() {
    Observable.track(this, 'nonReflected');
    return this._nonReflected;
  }
  set nonReflected(value) {
    const newValue = coerceType(value);
    // …there might be additional validations here…
    this._nonReflected = newValue;
    Observable.notify(this, 'nonReflected');
  }
}
```

#### With Stencil {#stencil}

First a disclosure: I never actually used [Stencil](https://stenciljs.com/), only played with it a bit locally in a hello-world project while writing this post.

Stencil is kind of special. It supports observable attributes through the `@Prop()` decorator, and reflected ones through `@Prop({ reflect: true })`. It will however reflect default values to attributes when the component initializes, doesn't support custom converters, and like FAST will convert an attribute value of `"false"` to a boolean `false`. You also have to add `mutable: true` to the `@Prop()` if the component modifies its value (Stencil assumes properties and attributes are inputs to the component, not state of the component).

A `@Prop()` must be public too, and cannot have custom accessors. You can use a `@Watch()` method to do some validation, but throwing from there won't prevent the property value from being updated; you can revert the property to the old value from the watch method, but other watch methods for the same property will then be called twice, and not necessarily in the correct order (depending on declaration order).

You cannot expose properties on the element's API if they are not annotated with `@Prop()`, making them at a minimum observe an attribute.

In other words, a Stencil component **cannot**, by design, _feel_ like a built-in custom element (another thing specific to Stencil: besides `@Prop()` properties, you can expose methods through `@Method` but they must be `async`).
