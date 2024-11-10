---
layout: post
title: How do HTML event handlers work?
---

[HTML event handlers](https://html.spec.whatwg.org/multipage/webappapis.html#eventhandler) are those `onxxx` attributes and properties many of us are used to, but do you know how they actually work?
If you're writing custom elements and would like them to have such event handlers, what would you have to do? And what would you possibly be unable to implement? What differences would there be from _native_ event handlers?

Before diving in: if you just want something usable, I wrote [a library](https://github.com/tbroyer/platformer "The Platformer library on GitHub") that implements all this ([and more]({% post_url 2024-01-21-web-component-properties %})) but first [jump to the conclusion](#recap) for the limitations; otherwise, read on.

## High-level overview

Before all, an event handler is a property on an object whose name starts with `on` (followed by the event type) and whose value is a JS function (or null).
When that object is an element, the element also has a similarly-named attribute whose value will be parsed as JavaScript, with a variable named `event` whose value will be the current event being handled, and that can return `false` to cancel the event (how many times have we seen those infamous `oncontextmenu="return false"` to _disable right click_?)

Setting an event handler is equivalent to adding a listener (removing the previous one if any) for the corresponding event type.

Quite simple, right? but the devil lies in the details!

(fwiw, there are two special kinds of event handlers, `onerror` and `onbeforeunload`, that I won't talk about the here.)

## In details

Let's go through those details the devil hides in (in no particular order).

### Globality

All built-in event handlers on elements are _global_, and available on every element (actually, every `HTMLElement`; that excludes SVG and MathML elements).
This include custom elements so you won't need to implement, e.g., an `onclick` yourself, it's built into every element.
This also implies that as new event handlers are added to HTML in the future, they might conflict with your own event handlers for a _custom event_ (this is also true of properties and methods that could later be added to the `Node`, `Element` and `HTMLElement` interfaces though).

{% pullquote "presentation" %}Custom elements already have all "native" event handlers built-in.{% endpullquote %}

Conversely, this _globality_ isn't something you'll be able to implement for a _custom event_: you can create an `onfoo` event handler on your custom element, but you won't be able to put an `onfoo` on a `<div>` element and expect it to do anything useful.
(Technically, you possibly could _monkey-patch_ the `HTMLElement.prototype` and use a `MutationObserver` to detect the attribute, but you'll still miss attributes on detached elements and, well, _monkey-patching_… do I need to say more?)

To avoid forward-incompatibility (be future-proof) you might want to name your event handler with a dash or other non-ASCII character in its attribute name, and maybe an uppercase character in its property name.
When [custom attributes](https://github.com/WICG/webcomponents/issues/1029) are a thing, then maybe this will also allow having such an attribute globally available on all elements.
Not sure it's a good idea, if you ask me I think I'd just use a _simple_ name and hope HTML won't add a conflicting one in the future.

### Return value

We briefly talked about the return value of the event handler function above: if it returns `false` then the event will be cancelled.

It happens that we're talking about the exact `false` value here, not just any _falsy_ value.

Fwiw, by _cancelled_ here, we mean just as if the event handler function had called `event.preventDefault()`.

### Listener ordering

When you set an event handler, it adds an event listener for the corresponding event, so if you set it in between two `element.addEventListener()`, it'll be called in between the event listeners.

Now if you set it to another value later on, it won't actually remove the listener for the previous value and add one for the new value; it will actually reuse the existing listener!
This was likely some kind of optimization in browser engines in the past (from the time of Internet Explorer or even Netscape I suppose), but as websites relied on it it's now part of the spec.

```js
const events = [];
element.addEventListener("click", () => events.push("click 1"));
element.onclick = () => "replaced below"; // starts listening
element.addEventListener("click", () => events.push("click 3"));
element.onclick = () => events.push("click 2"); // doesn't reorder the listeners
element.click();
console.log(events);
// → ["click 1", "click 2", "click 3"]
```

If you remove an event handler (set the property to `null` –wait, there's more about it, see [below](#non-function-property-values)– or remove the attribute), the listener will be removed though.
So if for any reason you want to make sure an event handler is added to the end of the listeners list, then first remove any previous value then set your own.

### Non-function property values

We talked about _setting an event handler_ and _removing an event handler_ already, but even there there are small details to account for.

When you set an event handler's property, any object value (which include functions) will _set_ the event handler (and possibly add an event listener).
When an event is dispatched, only function values will have any useful effect, but any object can be used to activate the corresponding event listener (and possibly later be replaced with a function value without reordering the listeners).

Conversely, any non-object, non-function value will be [_coerced_]({% post_url 2024-01-21-web-component-properties %}#type-coercion) to `null` and will _remove_ the event handler.

This means that `element.onclick = new Number(42)` _sets_ the event handler (to some _useless_ value, but still starts listening to the event), and `element.onclick = 42` _removes_ it (and `element.onclick` then returns `null`).

### Invalid attribute values, lazy evaluation

Attribute values are never `null`, so they always _set_ an event handler (to _remove_ it, remove the attribute).
They're also evaluated lazily: invalid values (that can't be parsed as JavaScript) will be stored internally until they're needed (either the property is read, or an event is dispatched that should execute the event handler), at which point they'll be tentatively evaluated.

When the value cannot be parsed as JavaScript, an error is reported (to `window.onerror` among others) and the event handler is replaced with `null` but *won't* remove the event handler!
(so yes, you can have an event handler property returning `null` while having it listen to the event, and not have the listener be reordered when set to another value)

```js
const events = [];
element.addEventListener("click", () => events.push("click 1"));
element.setAttribute("onclick", "}"); // invalid, but starts listening
console.log(element.onclick); // reports an error and logs null, but doesn't stop listening
element.addEventListener("click", () => events.push("click 3"));
element.onclick = () => events.push("click 2"); // doesn't reorder the listeners
element.click();
console.log(events);
// → ["click 1", "click 2", "click 3"]
```

The error reports the original location of the value, that is the `setAttribute()` call in a script, or even the attribute in the HTML, even though the value is actually evaluated much later.
This is something that I don't think could be implemented in userland.

### Scope

We've said above that an `event` variable is available in the script set as an attribute value, but that's not the only _variable_ in scope:
every property of the current element is directly readable as a variable as well.
Also in scope are properties of the associated `form` element if the element is _form-associated_, and properties of the `document`.

This means that `<a onclick="alert(href)"` will show the link's target URL, `<button onclick="alert(action)">` will show the form's target URL (as a side effect, you can also refer to other form elements by name), and `<span onclick="alert(location)">` will show the document's URL.

This is more or less equivalent to evaluating the attribute value inside this:
```js
with (document) {
  with (element.form) {
    with (element) {
      // evaluate attribute value here
    }
  }
}
```

Related to scope too is the script's _base URL_ that would be used when `import()`ing modules with a relative URL.
Browsers seem to behave differently already on that: Firefox resolves the path relative to the document URL, whereas Chrome and Safari fail to resolve the path to a URL (as if there was no base URL at all).
I don't think anything can be done here in a userland implementation.

### Function source text

When the event handler has been set through an attribute, the function returned by the event handler property has a very specific _source text_ (which is exposed by its `.toString()`), which is close to, but not exactly the same as what `new Function("event", attrValue)` would do (declaring a function with an `event` argument and the attribute's value as its body).

You couldn't directly use `new Function("event", attrValue)` anyway due to the [scope](#scope) you need to setup, but there's a trick to control the exact source text of a function so this isn't insurmoutable:

```js
const handlerName = "onclick"
const attrValue = "return false;"
const fn = new Function(`return function ${handlerName}(event) {\n${attrValue}\n}`)()
console.log(fn.toString())
// → "function onclick(event) {\nreturn false;\n}"
```

### Content Security Policy

Last, but not least, event handler attribute values are rejected early by a Content Security Policy (CSP): the violation will be reported as soon as the attribute is tentatively set, and this won't have any effect on the state of the event handler (that could have been set through the property).

The CSP directive that controls event handler attributes is `script-src-attr` (which falls back to `script-src` if not set, or to `default-src`).
When implementing an event handler for a _custom event_ in a custom element, the attribute value will have to be evaluated by scripting though (through `new Function()` most likely) so it will be controlled by `script-src` that will have to include either an appropriate hash source, or `'unsafe-eval'` (notice the difference from native event handlers that would use `'unsafe-inline'`, not `'unsafe-eval'`).
Hash sources will be a problem though, because you'll have to evaluate not just the attribute's value, but a script that embeds the attribute's value (to set up the [scope](#scope) and [source text](#function-source-text)).
And you'd have to actually evaluate both to make sure the attribute value doesn't mess with your evaluated script (think SQL injection but on JavaScript syntax).
This would mean that each event handler attribute would have to have two hash sources allowed in the `script-src` CSP directive, one of them being dependent on the custom element's implementation of the event handler.

## Recap: What does it mean for custom event handlers? {#recap}

As seen above, it's not possible to fully implement event handlers for a custom event in a way that would make it indistinguishable from _native_ event handlers:

* they won't be globally available on every element (except maybe in the future with _custom attributes_)
* a Content Security Policy won't be able to use `script-src-attr` on those custom event handlers, and if it uses hash sources, chances are that 2 hash sources will be need for each attribute value (one of them being dependent on the custom event handler implementation details)
* errors emitted by the scripts used as event handler attribute values won't point to the source of the attribute value
* an `import()` with a relative URL, inside an event handler attribute value, won't behave the same as in a _native_ event handler

The first two points alone might make one reevaluate the need for adding such event handlers at all.
And if you're thinking about only implementing the property, think about what it brings compared to _just_ having users call `addEventListener()`.

That being said, [I did the work](https://github.com/tbroyer/platformer "The Platformer library on GitHub") (more as an exercise than anything else), so feel free to go ahead a implement event handlers for your custom elements.
