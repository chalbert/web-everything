# The `<component>` Element — Declarative Custom Element Definition

**Date:** 2026-06-03
**Project:** [Web Components](../src/_includes/project-webcomponents.njk)
**Point:** add an HTML-native way to **define** a brand-new custom element — tag
name, template, shadow options — entirely in markup, with a deterministic
build-time AST transform to the equivalent class-based element as the intended
implementation. This is the fourth gap in Web Components, after scoped
registries, injector integration, and transient components.

---

## The shift in one line

```html
<!-- TODAY — defining a reusable element still needs imperative JS -->
<script>
  class UserCard extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: 'open' }).innerHTML = `<h3><slot name="title"></slot></h3><slot></slot>`;
    }
  }
  customElements.define('user-card', UserCard);
</script>

<!-- PROPOSED — the definition is markup -->
<component name="user-card" shadow="open">
  <template>
    <style>:host { display:block } h3 { margin:0 }</style>
    <h3><slot name="title">Untitled</slot></h3>
    <slot></slot>
  </template>
</component>
```

Both register `<user-card>`. The declarative form is the authoring surface; the
class form is what a build-time adapter emits.

## Why now / prior art

Defining a custom element from HTML is the **open frontier** of web components,
not a solved problem. The platform is deliberately landing the *primitives*
bottom-up rather than shipping one monolithic "declarative component" feature:

| Building block | Status (2026) | Role here |
|---|---|---|
| [Declarative Shadow DOM](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Declarative-Shadow-DOM.md) | **Shipped** | Shadow content from markup — the one dependency that's done; `shadow="open"` maps onto it |
| [WICG Declarative Custom Elements strawman](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Declarative-Custom-Elements-Strawman.md) (`<definition name constructor>`) | Stalled strawman | The closest public attempt; we choose `<component>` over `<definition>` |
| [Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md) | Being split into smaller pieces | Tier-2 reactive bindings compose with this as it matures |
| [DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md) | Lower-level, under debate | Binding primitive underneath template instantiation |
| [Scoped Custom Element Registries](https://wicg.github.io/webcomponents/proposals/Scoped-Custom-Element-Registries.html) | Stage 2 / flagged in Chrome | Tier-2 `scope` attribute composes with the project's existing section |
| [Open questions, WICG #1009](https://github.com/WICG/webcomponents/issues/1009) | Open | Frames the four hard areas: declaration, scripting, lifecycle, templates |

Framework patterns we borrow vocabulary from (not behavior):

| Framework | Pattern | Note |
|---|---|---|
| Vue | `<component :is="tag">` | Names the *instantiate-vs-define* ambiguity we must resolve (Open Point 1) |
| Svelte | `<svelte:element this={tag}>` | Compile-time element selection — a build-time transform, like ours |
| Lit | static `html` templates + `@customElement` | Class authoring our transform output resembles |
| Stampino | declarative templates as web components | Userland proof that HTML-defined components are viable today |

## Feature inventory (disposition × tier)

| Feature | Disposition | Tier |
|---|---|---|
| Register custom element by `name` from markup | built-in | 1 |
| Shadow template (`shadow="open\|closed"`, DSD-aligned clone) | built-in | 1 |
| Light-DOM template (`shadow="none"`) | built-in | 1 |
| Slots / content projection | compose (native `<slot>`) | 1 |
| `<style>` in template (native scoped styling) | built-in (native) | 1 |
| Build-time AST transform → class component | adapter | 1 |
| Declarative↔class source toggle on examples (static) | built-in (docs) | 1 |
| Declared observed attributes → reflect to template | built-in | 2 |
| Reactive bindings `{{expr}}` in template | compose (web-expressions / template-instantiation) | 2 |
| `if` / `each` structural directives in template | compose (for-each, web-directives) | 2 |
| Scoped registration (`scope`) | compose (Scoped Registries) | 2 |
| Associate a JS class for enhancement (`extends`/`behavior`) | built-in hook | 2 |
| Live in-browser transform in the toggle editor | defer | 2 |
| Inherit / extend another `<component>` | compose | 3 |
| Declarative lifecycle hooks | defer / adapter | 3 |

Tier 1 ships the static, DSD-aligned definition + the AST-transform adapter spec.
Tiers 2–3 **compose** with other WE standards as they mature — they are not
reimplemented here.

## Intended implementation: a deterministic build-time AST transform

The reference implementation is **not** a runtime that interprets `<component>`
in the browser. It is a build-time, deterministic, AST-based **adapter** that
rewrites each `<component name>…</component>` into an equivalent
`class … extends HTMLElement` + `customElements.define()` — the same lowering
Svelte/Lit-style tools already perform. Properties:

- **Deterministic** — identical input markup always yields byte-identical class
  output (stable member order, no timestamps/hashes), so it diffs cleanly and is
  cacheable.
- **AST-based, not string-templated** — parse the definition to an AST, emit from
  the AST; never regex-rewrite source.
- **Zero residual runtime for tier 1** — output depends only on baseline DOM APIs
  (`attachShadow`, `<template>.content.cloneNode`, `customElements.define`).

This lives as the `declarative-component` adapter, in the lineage of the canonical
HTML Adapter's "AST Transformation" section.

## Open Points Register

Kept **open for progressive resolution** — each is mirrored as a `backlog/*.md`
`decision` thread (`relatedReport` → this report) so it can be resolved
independently over time. `🔶 DECIDE` = pending; current recommendation only.

| ID | 🔖 | Point | Condition | Current recommendation |
|----|----|-------|-----------|------------------------|
| DC-1 | 🔶 DECIDE | Tag name & define-vs-instantiate ambiguity | `<component>` reads like Vue's instantiate-here | Keep `<component name>`; `name` + `<template>` child disambiguate. Alts: `<define-element>`, `<custom-element>`, `<definition>` |
| DC-2 | 🔶 DECIDE | Shadow attribute spelling | Native DSD uses `shadowrootmode` | `shadow="open\|closed\|none"` mapped onto DSD/`attachShadow`; `none` = light DOM |
| DC-3 | 🔶 DECIDE | Registration timing | `<component>` must register without a global scanner | Autonomous element registers in `connectedCallback`, then self-removes (transient-like) |
| DC-4 | 🔶 DECIDE | Reactive template depth | Bindings depend on unshipped specs | Tier 1 static; `{{expr}}`/`if`/`each` compose later with web-expressions/for-each |
| DC-5 | 🔶 DECIDE | Scripting / enhancement hook | "Can a declarative element be enhanced with script?" (#1009) | Declarative-only tier 1; tier-2 `behavior`/`extends` associates a class; no inline `<script>` (script-gadget risk) |
| DC-6 | 🔶 DECIDE | Adapter placement | Overlaps html-adapter's AST Transformation | Standalone `declarative-component` adapter cross-referencing html-adapter; revisit merge later |
| DC-7 | 🔶 DECIDE | Toggle editor interactivity | Docs examples show both forms | Static toggle now; live in-browser transform deferred to tier 2 |
| DC-8 | 🔶 DECIDE | Protocol extraction | Multiple engines may need a conformance contract | Ship as a Block now; extract a "declarative-component-definition" Protocol once the contract stabilizes |
| DC-9 | 🔶 DECIDE | Implicit empty `<template>` for childless `<component>` | A childless `<component>` is meaningful; declarative shorthand vs explicit-required | Transform desugars omitted child to empty `<template>` until a native standard lands; only the canonical (omitted) form is byte-identical on round-trip |

## Next Steps

- **Tier 2** — observed-attributes reflection; `behavior`/`extends` enhancement
  hook (resolves DC-5); `scope` scoped registration; reactive bindings composing
  with Web Expressions / Template Instantiation (resolves DC-4); live in-browser
  transform in the toggle editor (resolves DC-7).
- **Tier 3** — `<component>` inheritance/extension; declarative lifecycle hooks.
- **Protocol** — if a second independent transform/runtime appears, extract the
  conformance contract per DC-8.
- **Reference implementation** — a working `<component>` + AST-transform demo and
  the class-output generator belong in Frontier UI, not this canonical repo.
