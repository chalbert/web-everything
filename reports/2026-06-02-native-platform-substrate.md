# The Native Platform Substrate for Droplist & Form-Validation Standards

**Date:** 2026-06-02
**Status:** Reference note — captures a chat walkthrough so it can be talked through in parallel.
**Builds on:** [`reports/2026-06-02-dropdown-trait-composition.md`](./2026-06-02-dropdown-trait-composition.md) — the component/behavior/provider trait model.
**Why it matters:** A `droplist`/`dropdown` and a form-validation standard should assume the *narrowest reliable native substrate* and progressively enhance above it. This note pins down what that substrate is, as of early 2026.

---

## What this is

A cluster of recent platform APIs all chase the same goal: **let custom components be first-class citizens the way native controls are.** `formAssociated` / `ElementInternals` is the anchor; the rest extend the same idea into state, validation, positioning, and declarative behavior.

The through-line is that the platform has independently converged on the same decomposition this repo uses for traits:

| Platform story | APIs | Trait axis |
|---|---|---|
| *Be a real form control* | `formAssociated`, `ElementInternals`, `setFormValue`, `setValidity`, `:user-invalid` | **provider** (value/validation) |
| *Expose & style internal state* | `CustomStateSet` / `:state()`, `inert` | **component** (visual state) |
| *Declare behavior in markup* | popover, anchor positioning, `command`/`commandfor`, `closedby` | **behavior** (open/dismiss/position) |

That convergence is a strong validation signal for the trait model's shape.

---

## The APIs, in detail

### 0. The anchor — `formAssociated` / `ElementInternals` (FACE)

A static opt-in (`static formAssociated = true`) that makes a custom element a real form control. `this.attachInternals()` returns an `ElementInternals` whose `setFormValue()` puts a value into the form's `FormData`, and `setValidity()` wires into native constraint validation (`:invalid`, `reportValidity()`, submit-blocking). Lifecycle callbacks (`formResetCallback`, `formDisabledCallback`, `formStateRestoreCallback`, `formAssociatedCallback`) become live. `attachInternals()` is one-shot per element.

```js
class MyInput extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  set value(v) { this.#internals.setFormValue(v); }
}
```

### 1. Custom element *state* — sibling to `ElementInternals`

**`CustomStateSet` / `:state()`** — the same internals object exposes `.states`, a set you mutate to expose internal state to CSS *without* leaking attributes:

```js
this.#internals.states.add('expanded');
this.#internals.states.delete('expanded');
```
```css
my-dropdown:state(expanded) { /* ... */ }
```

The FACE-era answer to "style based on internal state." `:state(open)`, `:state(loading)`, `:state(empty)` are exactly the trait-surface vocabulary the droplist model needs. The earlier `:--x` form is deprecated.

### 2. User-driven validation pseudo-classes

**`:user-valid` / `:user-invalid`** — match only *after* the user has interacted or tried to submit, so you stop screaming "invalid!" at an untouched empty field. Driven for free by your `setValidity()` calls. The native version of the "touched/dirty" state every form library reinvents — belongs as the default in the form-validation standard. Pairs with **`field-sizing: content`** (auto-grow inputs/textareas) and **`form.requestSubmit()`** (programmatic submit that *runs validation*, unlike `.submit()`).

### 3. Customizable `<select>` — the native dropdown lands

The old `<selectlist>`/`<selectmenu>` became **customizable `<select>`**:

```css
select, ::picker(select) { appearance: base-select; }
```

Opting into `base-select` allows arbitrary markup inside `<option>`, a styleable picker and button — while keeping native keyboard, a11y, and form submission. The platform trying to obsolete the custom dropdown. Strategic fork for the standard: a `dropdown` now has *two* native substrates — build-your-own via FACE, or progressively enhance native `base-select`.

### 4. Popover + Anchor Positioning — the "floating UI" primitives

- **Popover API** — `popover` attribute + `popovertarget` on a button. Free top-layer rendering, light-dismiss, focus management, `::backdrop`. No JS for the basic case.
- **CSS Anchor Positioning** — `anchor-name` / `position-anchor` / `anchor()` / `position-try-fallbacks`. Tether a popover to its trigger and auto-flip on overflow.

Together that's the entire dropdown positioning + dismiss story, declaratively. Safari/Firefox anchor support is newest/least even — a progressive-enhancement layer, not a baseline.

### 5. Invoker Commands — declarative behavior wiring

**`command` / `commandfor`** generalize `popovertarget` to arbitrary actions:

```html
<button commandfor="dlg" command="show-modal">Open</button>
<button commandfor="menu" command="toggle-popover">Menu</button>
```

Built-ins (`show-modal`, `close`, `toggle-popover`) plus custom `--my-command` values that fire a `CommandEvent`. The platform formalizing "button declares its effect on another element" — close kin to this repo's *intent* model, where behavior is declared in HTML rather than wired in JS.

### 6. Shadow DOM catches up for components

- **Declarative Shadow DOM** — `<template shadowrootmode="open">`, SSR-able shadow roots, no JS.
- **Cross-root ARIA / Reference Target** — the newest, still-stabilizing fix for "you can't point `aria-activedescendant` across a shadow boundary," which has long blocked fully-accessible custom listboxes/comboboxes.
- **`::slotted()`**, **`@scope`**, **`:has()`** round out styling across/around the boundary.

### 7. Dialog & dismiss behavior

**`<dialog>`** (modal, top-layer, `::backdrop`, focus-trapping) plus the recent **`closedby`** attribute (`"any"` / `"closerequest"` / `"none"`) to declaratively control light-dismiss — unifying the dismiss vocabulary popover already uses.

---

## Support table

First *stable shipping* version, approximate (knowledge cutoff Jan 2026 — verify bleeding-edge rows against caniuse). Sorted by maturity.

**Legend:** ✅ shipped · 🚩 behind flag · ❌ not yet · **Baseline** = interoperable across all three engines

| API | Chrome | Safari | Firefox | Baseline | Polyfill |
|---|---|---|---|---|---|
| `<dialog>` | 37 | 15.4 | 98 | ✅ '22 | `dialog-polyfill` (Google) |
| `requestSubmit()` | 76 | 16 | 75 | ✅ '22 | trivial shim |
| `showPicker()` | 99 | 16 | 101 | ✅ '23 | ❌ un-polyfillable (capability) |
| **FACE** — `formAssociated` / `ElementInternals` | 77 | 16.4 | 98 | ✅ '23 | `element-internals-polyfill` |
| `:user-valid` / `:user-invalid` | 119 | 16.5 | 88 | ✅ '23 | ponyfill (class toggle) |
| Declarative Shadow DOM | 90/111 | 16.4 | 123 | ✅ '24 | tiny hydration shim |
| **Popover API** | 114 | 17 | 125 | ✅ '24 | `@oddbird/popover-polyfill` |
| `CustomStateSet` / `:state()` | 125¹ | 17.4 | 121 | ✅ '24 | `element-internals-polyfill` |
| **CSS Anchor Positioning** | 125 | ❌² | 🚩 | ❌ | `@oddbird/css-anchor-positioning` |
| `command` / `commandfor` (invokers) | 135 | 26 | 🚩 | ❌ | `invokers-polyfill` |
| `field-sizing: content` | 123 | ❌ | ❌ | ❌ | ponyfill (autosize) |
| `<dialog closedby>` | 134 | 18.4 | 🚩 | ❌ | polyfillable (event wiring) |
| Customizable `<select>` (`appearance: base-select`) | 135 | ❌ | ❌ | ❌ | ❌ only by replacement³ |
| Cross-root ARIA / Reference Target | 🚩 | ❌ | ❌ | ❌ | ⚠️ partial mitigation only |

¹ Chromium shipped the `internals.states` object ~90 but only under the deprecated `:--x` selector; the `:state(x)` selector is the ~125 row.
² Safari & Firefox anchor-positioning were both in active development in early 2026 — likely closer/shipped by the time you read this.
³ The `<selectlist>` era had an OpenUI polyfill, but `appearance: base-select` isn't polyfillable — you fall back to a normally-styled native `<select>`, a perfectly good baseline.

---

## Polyfillability tiers

The line is **computation vs. capability**:

> Anything that's *logic over DOM you already control* (validation state, dismiss behavior, sizing) is polyfillable. Anything that's a *UA-privileged capability* (open a native picker, render native select chrome, write the a11y tree across a shadow root) is not.

### ✅ Fully reproducible (ponyfill — behavior 100% recoverable)

- **`:user-valid` / `:user-invalid`** — track `focus`/`blur`/`input`/`submit`, mirror `el.validity.valid` onto a `.user-invalid` class. Can't mint a real pseudo-class, so CSS targets `.user-invalid`. ~30 lines.
- **`<dialog closedby>`** — read the attribute, wire listeners: `"any"` → Esc + outside-click hit-test, `"closerequest"` → Esc only, `"none"` → swallow both. Can be a *true* polyfill since it augments an element you control.
- **`field-sizing: content`** — classic autosize: mirror-element / `scrollHeight` for textareas, hidden-span measurement for inputs. Behavior exact; applied via JS not the CSS property.

### ⚠️ Partial mitigation only — no clean shim

- **Cross-root ARIA / Reference Target** — the gap lives in the **accessibility tree**, which JS can't directly write. Mitigations, not shims: AOM element-reflection (`el.ariaActiveDescendantElement`, thin support, doesn't reliably cross shadow roots); move referenced content to **light DOM** (the pragmatic fix); node mirroring (fragile). Never a drop-in. **This is the one genuine accessibility blocker for shadow-encapsulated comboboxes.**

### ❌ Not polyfillable even in theory

- **`showPicker()`** — performs a UA-privileged action no other API exposes. No method → no way to summon native picker UI. Rendering your own picker isn't the same thing.
- **`appearance: base-select`** — only *replaceable*, not polyfillable. Faking it = rebuilding the full ARIA combobox in JS, the exact wheel the feature retires; you lose the native top-layer picker, native form/a11y guarantees, and mobile native UI. "Polyfilling" it means leaving the native path entirely.

---

## Implications for the standards

- **Top 8 table rows are Baseline** — FACE, `:user-invalid`, popover, `:state()` are *assumable*. That's the reliable substrate; polyfill only for legacy-enterprise support.
- **Bottom 5 are enhancement-only** — design so the component is fully functional without anchor positioning, invokers, `base-select`, `closedby`, cross-root ARIA, and *better* with them.
- **Native-first fork for dropdowns** — a `dropdown` now has two native substrates: build-your-own via FACE/`ElementInternals`, or progressively enhance native `appearance: base-select`. Worth an explicit decision in the trait-composition report (see [Native-First Default] in memory).
- **Authoring rule for the trait model** — **provider** and **behavior** traits tend to fall on the polyfillable (computation) side; the **component** trait — where it touches native-rendered chrome or the a11y tree — is where you hit hard platform walls and should design native-first fallbacks rather than promise parity.

---

## Open questions

These are now tracked in the [backlog](/backlog/) (the source of truth) rather than here:

- `polyfill-baseline-floor` — require a polyfill baseline, or declare Baseline-2024 the floor?
- `droplist-cross-root-aria-mandate` — does the droplist contract mandate cross-root ARIA correctness, forking toward light-DOM / native `base-select`?
- `base-select-first-class-adapter` — promote `appearance: base-select` to a first-class adapter once it ships in >1 engine?
- `droplist-native-substrate-fork` — native as tiebreak vs. privileged-before-check in the droplist DI resolver.
- `verify-substrate-support-versions` — verify the approximate bleeding-edge rows in the support table against caniuse.
