# The Droplist in Trait Language

**Date:** 2026-06-02
**Status (2026-06-03):** Graduated. The family-level rules (two channels, three altitudes, trait surface map) now live on the [Droplist block](/blocks/droplist/); the single-dropdown worked example (altitudes 1/1a/2/3, country example, `DropList` class) now lives on the [Dropdown block](/blocks/dropdown/). Multi-dropdown and Autocomplete sections remain here as seed content for the [multi-select-dropdown](/backlog/multi-select-dropdown-block/) and [autocomplete](/backlog/autocomplete-block/) backlog items.
**Companion to:** [`2026-06-02-dropdown-trait-composition.md`](./2026-06-02-dropdown-trait-composition.md) and [`2026-06-02-intent-vs-trait-change-plan.md`](./2026-06-02-intent-vs-trait-change-plan.md)
**Point:** show the dropdown re-expressed so that *structural identity* ("I am a single dropdown") is **explicit trait composition**, not an injected intent. `customContexts:droplistIntent="single"` is gone.

---

## The shift in one line

```html
<!-- BEFORE — structure smuggled through the intent (DI) channel -->
<div customContexts:droplistIntent="single;editable;filter=async"> … </div>

<!-- AFTER — structure is local trait selection; the intent channel carries no structure -->
<ul role="listbox" focus-delegation="strategy=virtual" selection="model=single" …> … </ul>
```

"Single" stops being a preference the environment hands down and becomes what it actually is: a value the developer sets on the **selection** trait when building this widget.

**The rule that falls out:** *structural* dimensions (`model`, `editable`, whether `filter`/`windowed` are present) are **always local** — they decide which traits exist and what shape the widget is. *Behavioral* dimensions (focus strategy, collision handling, truncation) **may** come from an ambient intent as a design-set default. Two channels, and structure never travels on the intent one.

---

## Native baseline (unchanged)

```html
<select name="country">
  <option value="ar">Argentina</option>
  <option value="au">Australia</option>
</select>
```

Zero traits. You climb off this only when a requirement rules native out.

## A single dropdown, three altitudes

Same widget, expressed at three levels of the same trait language — no intent for structure at any of them.

**1 — HTML, explicit behaviors (the substrate).** Each attribute is one trait; the attribute *value* is the trait selection.

```html
<button aria-haspopup="listbox" aria-expanded="false" anchor="country-list">Country</button>

<ul id="country-list" role="listbox"
    focus-delegation="strategy=virtual"     <!-- behavioral; may default from ambient intent -->
    selection="model=single"                <!-- STRUCTURAL: always local -->
    type-ahead
    anchored="placement=bottom-start;collision=flip,resize"
    hidden>
  <li role="option" composite-descendant data-value="ar">Argentina</li>
  <li role="option" composite-descendant data-value="au">Australia</li>
</ul>
```

**1a — Inside `<drop-list>`: the class.** A dropdown doesn't bake in *which* options or *whose* selection — it's generic. The component class is what bridges the public surface (attributes, `value`, the form, events) and the private substrate (the locals its template reads). Two things are non-negotiable here: it's a **form-associated custom element** (so `<form>` / `FormData` / reset / validity all just work, no hidden input), and it exposes its resolved attributes on **its own injector** as locals that nothing outside the element can see.

```typescript
const { injectors, InjectorRoot } = window;

class DropList extends HTMLElement {
  static formAssociated = true;                                  // → real form control
  static observedAttributes = ['value', 'options', 'name', 'placeholder'];

  #internals = this.attachInternals();
  #injector  = injectors.ensureInjector(this);                   // private to this element
  #options: ReadonlyArray<{ value: string; label: string }> = [];
  #selected: { value: string; label: string } | null = null;
  static #counter = 0;

  connectedCallback() {
    // Public attributes → private contexts, scoped to this element's injector.
    // Descendants of <drop-list> see @options / @placeholder / @surfaceId;
    // anything outside the element does not.
    this.#options = this.#resolveOptions(this.getAttribute('options'));
    this.#injector.set('customContexts:options',     this.#options);
    this.#injector.set('customContexts:placeholder', this.getAttribute('placeholder') ?? '');
    this.#injector.set('customContexts:surfaceId',   `drop-list-${++DropList.#counter}`);

    this.value = this.getAttribute('value') ?? '';               // initial selection
    this.addEventListener('selection-change', this.#onInnerSelection);
  }

  // ── Form-control surface (string value, like <select>) ────────────────────
  get value() { return this.#selected?.value ?? ''; }
  set value(v: string) {
    this.#selected = this.#options.find(o => o.value === v) ?? null;
    this.#injector.set('customContexts:selected', this.#selected ?? { value: '', label: '' });
    this.#internals.setFormValue(this.value);
  }
  get selectedOption() { return this.#selected; }

  formResetCallback() { this.value = this.getAttribute('value') ?? ''; }
  formStateRestoreCallback(state: string) { this.value = state; }

  // ── Event boundary ────────────────────────────────────────────────────────
  // The inner `selection="model=single"` trait fires selection-change inside
  // the template; we update state and re-emit a public `change` event that
  // consumers listen for on <drop-list> itself.
  #onInnerSelection = (e: CustomEvent<{ value: string }>) => {
    e.stopPropagation();
    this.value = e.detail.value;
    this.dispatchEvent(new CustomEvent('change', { detail: this.#selected, bubbles: true }));
  };

  // `options="@countries"` → ancestor-injector lookup; literal JSON also accepted.
  #resolveOptions(raw: string | null) {
    if (!raw) return [];
    if (raw.startsWith('@')) {
      return InjectorRoot.getProviderOf(this, `customContexts:${raw.slice(1)}`) ?? [];
    }
    return JSON.parse(raw);
  }
}

customElements.define('drop-list', DropList);
```

**The template the class renders.** The locals the class just set (`@options`, `@selected`, `@placeholder`, `@surfaceId`) are the *only* contexts referenced here. There is no hidden input — form participation moved to the element itself via `ElementInternals.setFormValue` above.

```html
<button anchor="{{@surfaceId}}"
        aria-haspopup="listbox"
        commandfor="{{@surfaceId}}" command="toggle-popover">
  {{@selected.label ?? @placeholder}}
</button>

<ul id="{{@surfaceId}}" role="listbox"
    focus-delegation="strategy=virtual"
    selection="model=single"
    type-ahead
    anchored="placement=bottom-start;collision=flip,resize"
    popover>
  <template for-each="@options as option">
    <li role="option" composite-descendant
        data-value="{{@option.value}}"
        aria-selected="{{@option.value === @selected.value}}">
      {{@option.label}}
    </li>
  </template>
</ul>
```

Reading the pair as trait language:

- **Literal — structural identity.** `selection="model=single"`, `type-ahead`, `role="listbox"`, `role="option"`, `composite-descendant`, `aria-haspopup="listbox"`. These are what make this a single dropdown and not a multi-select or a menu; the trait language locks them, so a consumer cannot pass them in as a prop.
- **Literal — behavioral, ambient-overridable.** `focus-delegation="strategy=virtual"`, `anchored="placement=…;collision=…"`. Hardcoded as this widget's stance; the ambient `droplistIntent` injector still wins on any dimension the author hasn't stated, per the [resolution rule](#per-trait-resolution-the-merge) below.
- **Erased — open state.** No literal `aria-expanded="false"` and no `hidden` to keep in sync. `commandfor` + `command="toggle-popover"` drives the native [popover] machinery; the platform owns `aria-expanded` on the trigger and the visibility of the surface. The `anchored` trait only layers placement/collision on top.
- **Erased — form participation.** No hidden `<input>`. `static formAssociated = true` + `#internals.setFormValue(this.value)` is the whole story: `<form>` submission, `FormData.get('country')`, `form.reset()` (→ `formResetCallback`), bfcache restore (→ `formStateRestoreCallback`), `<label for>`, `setValidity()`, `:user-valid` / `:user-invalid`, and the `autocomplete` attribute all light up without any extra HTML.
- **Bound — data via private context.** `<template for-each="@options as option">` stamps one `<li>` per option from the **component-local** `@options`; `data-value`, the label, and `aria-selected` all read the same locals. They are scoped to the element's own injector — nothing outside the `<drop-list>` can read or shadow them.
- **Bound — selection event, scoped.** No imperative click wiring on `<li>`. The `selection="model=single"` trait controller owns click / Enter / Space / typeahead → a `selection-change` event; the class's `#onInnerSelection` listener catches it, calls `stopPropagation`, updates `@selected` via `set value()`, and re-emits a public `change` event consumers listen for on `<drop-list>` itself.

**2 — Component (a named preset of traits).** The element and its attributes *are* the trait selection. The consumer passes the data in; the component handles the rest.

```html
<drop-list name="country"
           options="@countries"
           on:change="setCountry($event)"></drop-list>
<!-- `single` is baked into the preset; `options` accepts a context reference
     (resolved from an ancestor injector) or an inline expression, and is
     re-exposed inside the component as the private @options context — see 1a. -->
```

**3 — TypeScript, explicit composition (the purest trait language).** A list of `with*` factories — structurally identical to `loader.load(promise, [traitA, traitB])`.

```typescript
const country = composeDroplist(trigger, [
  withAnchoredSurface({ placement: 'bottom-start', collision: ['flip', 'resize'] }),
  withFocusDelegation({ strategy: 'virtual' }),   // omit strategy → inherits ambient intent
  withSelection({ model: 'single' }),             // structural: stated here, never inherited
  withTypeAhead(),
]);
// → returns a handle; country.cleanup() reverts every trait, in reverse.
```

`withSelection({ model: 'single' })` is the entire "I am a single dropdown" statement. It reads as construction, because it is.

## Example — a project's country dropdown

A project consumes the generic `<drop-list>` by passing data and a handler at the boundary; the component is otherwise untouched.

```html
<form on:submit="saveAddress($event)">
  <label for="country">Country</label>
  <drop-list id="country"
             name="country"
             options="@countries"
             placeholder="Select a country…"
             on:change="setCountry($event)"></drop-list>

  <!-- … other fields … -->

  <button type="submit">Save</button>
</form>
```

```javascript
import { SimpleStore } from '/blocks/stores/simple';
const { injectors } = window;

// Project data — could equally come from a fetch or a generated list.
const COUNTRIES = [
  { value: 'ar', label: 'Argentina' },
  { value: 'au', label: 'Australia' },
  { value: 'br', label: 'Brazil' },
  { value: 'ca', label: 'Canada' },
  // …
];

const addressStore = new SimpleStore({ country: null });

// Provide @countries and the action handlers at the document root —
// any <drop-list options="@countries"> in the tree can resolve them.
const root = injectors.getInjectorOf(document);
root.set('customContexts:countries', COUNTRIES);
root.set('customContexts:handlers', {
  setCountry: (e) => addressStore.setItem('country', e.detail.value),
  saveAddress: (e) => {
    e.preventDefault();
    // POST addressStore state
  },
});

window.attributes.upgrade(document.body);
```

What the project owns vs. what `<drop-list>` owns:

- **Project**: the country list (`@countries`), the persistent selection (`addressStore.country`), the submit handler. Nothing about *how a dropdown works.*
- **`<drop-list>`**: trait composition, popover open/close, keyboard navigation, single-selection commit semantics, the private `@options`/`@selected`/`@placeholder` locals — and the public `change` event. Nothing about *what's in the list.*

The same `<drop-list>` is reused for currency, language, time zone, role, or account by changing `options=` and the handler — never by editing the component.

## Multi-dropdown — one trait flip

No new trait, no intent change — just a different value on the **selection** trait:

```html
<ul role="listbox" focus-delegation selection="model=multiple;selectionFollowsFocus=false" …>
```
```typescript
withSelection({ model: 'multiple', selectionFollowsFocus: false }),
```

## Autocomplete — swap one trait, move the focus host

`editable` is not an intent value either — it's the decision to compose **filter** instead of **type-ahead** and to point **focus-delegation** at the input (`controller`):

```typescript
const city = composeDroplist(input /* the combobox */, [
  withAnchoredSurface({ placement: 'bottom-start', collision: ['flip', 'resize'] }),
  withFocusDelegation({ strategy: 'virtual', controller: input }),   // host ≠ collection
  withSelection({ model: 'single', selectionFollowsFocus: false }),
  withFilter({ mode: 'async', source: (q) => fetchCities(q) }),      // REPLACES withTypeAhead
  withClearable(),
  withLiveStatus(),
]);
```

The dropdown→autocomplete delta is now literally three lines: drop `withTypeAhead`, add `withFilter`, give focus a `controller`. Nothing about it is expressed as an injected intent.

---

## Where ambient intent still lives (behavioral only)

The intent channel doesn't disappear — it narrows to what it was always for: **design-set behavioral preference** that flows down to *every* droplist (and menu, tree, grid…) in a subtree.

```typescript
// App root — a designer/product policy, NOT structure:
injector.set('customContexts:droplistIntent', {
  focusStrategy: 'virtual',     // prefer virtual focus everywhere
  collision: ['flip', 'shift'],
  truncate: true,
});
```

A trait with no explicit option for a *behavioral* dimension reads this:

```typescript
withFocusDelegation()            // no strategy given → resolves 'virtual' from the ambient intent
withFocusDelegation({ strategy: 'roving' })   // explicit → overrides the ambient intent
withSelection({ model: 'single' })            // structural → ambient intent has no say, ever
```

So one app-level line still makes "every droplist here uses virtual focus and truncates" true — but it can never make a dropdown single or multiple. That stays where you build the widget.

## Per-trait resolution (the merge)

```
trait option  =  explicit option (local)  ⊕  ambient intent  ⊕  trait default
                 │                            │ behavioral dims only
                 │ structural dims stop here ─┘
```

- **Structural** (`model`, `editable`, `filter`/`windowed` presence): explicit ⊕ default. No ambient channel.
- **Behavioral** (`focusStrategy`, `collision`, `truncate`): explicit ⊕ ambient intent ⊕ default.

That single rule is the whole reconciliation: intent is the ambient, design-owned, behavioral-preference channel; trait selection is the local, developer-owned, structural-construction channel; and a component resolves itself by merging them — with structure never crossing over.
