---
type: idea
workItem: task
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-06'
tags:
  - jsx
  - adapters
  - rendering
  - reactivity
  - vdom
  - directives
relatedReport: reports/2026-06-06-render-strategy-axis.md
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-render-strategy, label: Render Strategy Protocol }
graduatedTo: protocol:render-strategy
---

# JSX adapter — the rendering-strategy axis (binding, vdom, directives)

> **Resolved 2026-06-06 — graduated to the `render-strategy` Protocol (Web Components).** The axis is now
> a first-class conformance contract (`CustomRenderStrategy` / `CustomRenderStrategyRegistry`), sibling to the
> Change Tracking Protocol, designed in [reports/2026-06-06-render-strategy-axis.md](reports/2026-06-06-render-strategy-axis.md)
> and specified at `/projects/webcomponents/#protocol-render-strategy`. The open placement decision below is
> **resolved: own standard (Protocol under Web Components), not folded into the JSX adapter** — the adapter merely
> targets it. Remaining implementation work spun out as agent-ready items: **#077** (make `JSXRenderer.ts` an
> explicit `declarative-static` provider — the seam), **#078** (cross-strategy lowering/lifting compiler),
> **#079** (strategy toggle UI), **#080** (finalize the contract's open decisions). Kept visible to expose the
> report and the graduation trail; the original design narrative is preserved below.

The JSX adapter has two **orthogonal** axes that the first cut deliberately keeps separate: the *syntax* (how an element tree is spelled — HTML ↔ JSX ↔ template-string, fully reversible) and the *rendering strategy* (how that tree **updates over time**). This item parks the second axis — a pluggable choice between declarative-static bindings, virtual-DOM render methods, fine-grained signals, and imperative DOM — to attack after the syntax/conversion work ships. The strategy must be a registry-backed, swappable seam (native-first default = declarative-static), **not** baked into JSX, so the adapter never owns reactivity and the "no runtime magic" principle holds.

## Why it's a separate axis

Axis 1 (syntax) is pure spelling: `<div class="x">` ⇄ `<div class="x">`, trivially reversible, and it's what the source-toggle and the feature-mapping table cover. Axis 2 (this item) is semantics — what re-runs when state changes. The same JSX tree can be driven by completely different update machines, and **that choice is independent of the spelling**. Conflating them is what made the existing `JSXRenderer.ts` quietly assume one strategy (eager construct-once DOM); naming the axis lets every strategy be a peer.

## The strategies (the toggle's options — open-ended, registry-driven)

| Strategy | How it updates | Iteration / conditionals expressed as |
|---|---|---|
| **declarative-static bindings** *(native-first default)* | parse-once DOM + binding behaviors (`bind-*`) + text-node parsers (`{{ }}`/`[[ ]]`) + template directives | `<template is="for-each">`, `<template is="if">` |
| **virtual-DOM render** | a `render()` returns a tree; diff + patch on change | plain JS — `items.map(…)`, `cond && <X/>` |
| **fine-grained / signals** | expressions become reactive computations; surgical DOM updates, no diff | plain JS, tracked at read-time |
| **imperative / pure DOM** | direct, hand-written manipulation | `for` loop + `createElement` |

This list is the **change-tracking-observability strategy catalog** applied to rendering — it must be a registry (a `renderStrategy` / `customChangeDetector`-style provider), not a fixed enum, so new strategies (e.g. a future platform DOM-Parts / Template Instantiation target) register without touching the adapter.

## The key insight: directives belong to Axis 2, not Axis 1

A `<template is="for-each">` exists **only because inert HTML can't iterate** — it's an artifact of the declarative-static strategy, not a feature of HTML-the-syntax. Under a render strategy the iteration is just `items.map(…)` and the renderer does the work; there is nothing to "spell" as a directive. So directives appear and disappear *with the strategy*, which is exactly why they can't be modeled on the syntax axis.

## What "conversion" means once strategy varies

Conversions split into two difficulty classes:

- **Same-strategy = pure spelling** (HTML×declarative ⇄ JSX×declarative-mirror). Trivially reversible; this is Axis-1 / the feature-mapping table. Already in scope for the first cut.
- **Cross-strategy = lowering / lifting** (this item). Converting JSX×vdom `items.map()` into HTML×declarative `<template is="for-each">` (and back) is real compiler work — lower JS control-flow into directives, lift directives back into JS. The correspondence contract:

  | JS control-flow (render strategies) | ⇄ | Declarative-static primitive |
  |---|---|---|
  | `items.map(i => …)` | ⇄ | `<template is="for-each" items>` |
  | `cond && <X/>` / ternary | ⇄ | `<template is="if" condition>` |
  | `{expr}` (eager JS value) | ⇄ | `{{ expr }}` / `bind-text="path"` (reactive-by-path) |
  | function handler `onclick={fn}` | ⇄ | string behavior `on:click="fn($event)"` |

  Note the `{ }` tension: eager JS evaluation has no faithful inverse to a reactive `{{ }}` path — round-trip across this boundary is *not* guaranteed and the contract must say where it's lossy.

## The compile targets

A JSX tree authored against a render strategy can be lowered to any of (this is the same set as the strategies above, named as compile outputs):

1. an **HTML template** (`<template is="for-each">` …) — declarative-directive target;
2. **native HTML with binding behaviors + text-node directives** (`bind-*`, `{{ }}`) — declarative-bindings target;
3. **pure DOM manipulation** (`createElement` loop) — imperative target;
4. **vdom `map`** kept as JS — render target.

## Open decision — ownership / placement

**Current recommendation:** the rendering-strategy axis is its **own standard** (the `change-tracking-observability` research growing a "render strategy" facet, under `webadapters` or a dedicated rendering project) that the JSX adapter merely *targets*. JSX stays a syntax that compiles onto a chosen strategy; it does not own reactivity. **Alternative held open:** fold the default strategy into the JSX adapter for a faster first cut, accepting that JSX then implies a reactivity model (contradicts "no runtime magic").

## When to attack / dependencies

Gated on the Axis-1 slice landing first: (a) the HTML×declarative ⇄ JSX×declarative-mirror feature-mapping table, (b) the `html`/`jsx` source toggle on block pages, (c) the realigned runtime renderer. This item then designs the registry seam + the cross-strategy lowering compiler, and adds the second (strategy) toggle to the UI. Related: the **event-style** sub-toggle (string ⇄ function handlers) is a smaller, Axis-1-adjacent contextual option and is tracked with the syntax work, not here. See also the `virtual-elements` research topic.
