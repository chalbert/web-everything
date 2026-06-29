# Composition rubric — framework-parity benchmark & the budgeted-host-node principle

**Decision:** [#1963](../backlog/1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md) · prep survey · 2026-06-29

Grounds the per-case composition-mechanism rubric against a **framework-parity, zero-compromise bar**
(ergonomics ≥ React/Vue/Svelte/Solid; zero layout/CSS/a11y compromise; a solution for every case; open to
net-new mechanisms; HTML + JSX). Benchmarks each case against the leading frameworks and the FUI tree, and
surveys the emerging standards that bear on the hardest case (deep structural composition). Catalog companion:
[/research/dom-less-composition](../src/_includes/research-descriptions/dom-less-composition.njk).

## The spine — *the host node is the API surface, so it is a budgeted resource*

A framework component is a **function/object** in a virtual tree or compiled output; only leaf elements reify as
DOM, so 10 providers = 10 closures = **0 DOM nodes**. A custom element is **defined as a DOM element** —
`customElements.define` binds behaviour to a *tag*, and a tag is a node with a box, an event-path position, an
AX entry, and a `:host`. **Slotting, Shadow-DOM scoping, `connectedCallback` lifecycle, `ElementInternals`
semantics, and focus are all keyed off that node** — you cannot have them *and* not have the node.

So the platform "charges per node" for a reason, and **no emerging standard removes it** (see §emerging). The
correct response is therefore not to wait for a primitive but to **budget the host node**: pay it only where you
need slot / shadow / AX-identity / lifecycle; for every other concern use a **zero-node mechanism**. This is
exactly what frameworks do — they compile structural layers away into functions/directives. Framework parity for
WE is a *discipline*, not a missing feature.

## Per-case benchmark (framework approach → what a CE system must do → parity today)

| # | Case | Representative framework approach | CE-must-do | Parity today |
|---|---|---|---|---|
| 1 | Real `<button>` presentational | React/Vue/Svelte/Solid **emit the literal `<button>`**, component leaves no host | compile/emit-to-native (transient), **or** persistent host + `formAssociated` + `attachInternals()` (`internals.role`/`setFormValue`) + hand-rolled focus/keyboard | **Partial** — emit-native = full parity; persistent host = form+AX yes, native behaviour no; `is=` blocked by Safari |
| 2 | Grouped / reactive control | shared state: React controlled props · Vue `v-model` · Svelte `bind:group` · Solid signals · Lit reactive props | group CE holds state; child form-associated CEs `setFormValue` + bubble events; **needs a signals/observed-property reactivity primitive** | **Yes** (all DOM/form pieces native; supply the reactivity glue) |
| 3 | Multi-root / Fragment (no wrapper) | React `<>` · Vue 3 multi-root · Svelte no-root · Angular `<ng-container>` · Lit multi-node result | don't emit a host (compile-away) **or** `:host{display:contents}` to drop the box | **Partial** — compile-away = full; `display:contents` recovers layout/CSS, residual AX caveat (now mostly fixed) |
| 4/5 | if / for / switch regions | **comment/text anchors** in Vue, Svelte, Solid, Lit (confirmed); Angular leaves a debug comment; React uses reconciler+keys | bracket each region with **comment anchor nodes**, insert/move/remove siblings between them; keyed reconciliation for lists | **Yes** — pure plain-DOM, zero layout/CSS/AX cost; WE has it (`CustomComment` #1130) |
| 6 | Context / DI provider, no layout impact | React `Context.Provider` adds **zero DOM** (virtual tree) | `display:contents` custom element on the injector chain (#1044) | **Yes\*** — layout-transparent; box gone, node/event/AX remain (benign for providers); AX regression fixed Safari 16 / FF 62 |
| 7 | Behavioural composition (N behaviours / 1 element) | HOCs / hooks / mixins / directives | `CustomAttribute` behaviours + class mixins — **zero node** | **Yes** — the HOC analog, HTML attr-driven + JSX |
| 8 | Attach behaviour to an **existing** native element, no wrapper | `is=` customized built-in | **no zero-compromise cross-browser path** — `is=` dead in Safari (#97); `ElementInternals` only helps *your own* autonomous element, not an element you don't own | **Compromise** — `is=` PE-only, or emit a fresh element (transient) instead |
| 9 | Teleport / portal | React/Vue portals | WE `webportals` logical-tree (built, #demo) + **`moveBefore()`** (Chrome 133, state-preserving reparent) | **Yes\*** — built logical portal; `moveBefore()` not yet cross-browser |
| 10 | **Deep STRUCTURAL composition** (10 nested provider/layout/boundary layers) | frameworks **compile structural layers away** into functions/directives → 0 nodes | structural layers → **function/directive render** (zero node) or `display:contents` host (cheap node); registered hosts **budgeted** to slot/shadow/AX/lifecycle | **Yes — by discipline.** Not an invent-case: parity is achievable today by *not nesting registered hosts* |

\* contingent on a small confirm (case 6 AX-tree; case 9 `moveBefore` fallback) — see the decision's forks.

## Emerging standards bearing on case 10 (the "do we need to invent" question)

The honest verdict: **no shipping or proposed standard makes a registered custom element cost zero nodes** —
they reduce per-node *cost*, not node *count*:

| Standard | Removes the box? | Removes the node/event/AX? | Status |
|---|---|---|---|
| `display: contents` | **yes** | no | shipping (Baseline ~94%); AX regression fixed Safari 16 / FF 62; can't be a focusable host |
| `subgrid` | aligns through wrapper | no | Baseline widely available (2026) |
| `Node.moveBefore()` | n/a | no — but makes reparent **non-destructive** (state/lifecycle preserved) | Chrome/Edge 133 (Feb 2025); not yet cross-browser |
| **DOM Parts** `ChildNodePart` | n/a — for *content* regions, **not** CE hosts | yes, content regions only | **proposal-stage, unshipped** (W3C, active Mar 2025) |
| `ElementInternals` / ARIA reflection | no | no — makes the node *worth* paying for | shipping all engines (ARIA reflection flagged in FF) |

The pattern that *does* reach zero-node parity — **Haunted `virtual()`, Lit directives, Stencil functional
components** — achieves it precisely by **abandoning the registered host**: a function that renders into the
parent, not a `customElements.define`'d element. That is the framework ontology, and it is the platform's own
steer. **Conclusion: case 10 is not a net-new-plug invent-case; it is a classification rule** (budget the host
node; structural layers go zero-node). DOM Parts is a *watch* item for declarative wrapper-free *content*
regions, not a blocker.

## What this means for the rubric (verdict feed)

- **Cases 2, 4/5, 7 — at parity today**, raw-platform; build only the reactivity primitive + comment-anchor
  engine (both already present in WE). Supported by default.
- **Cases 3, 6, 9 — at parity with `display:contents` / logical-portal**, modulo a small AX/fallback confirm.
- **Case 1 (transient)** is the *emit-to-native* strategy — which the benchmark shows is **full parity** for the
  real-element goal (it's what React/Svelte/Solid do). Re-judged under #1962; transient is parity-competitive,
  not a liability, for behaviour-free leaves.
- **Case 8 (`is=`)** has **no zero-compromise cross-browser path** — Safari foreclosed, `ElementInternals` is for
  your-own element. Resolve: `is=` is progressive-enhancement-only (never load-bearing); emit a fresh element
  (transient) where a real customized element is needed. A genuine fork.
- **Case 10** — **the budgeted-host-node classification rule** (structural layers zero-node; hosts budgeted to
  slot/shadow/AX/lifecycle). Parity is a discipline, achievable now — *not* an invention. A genuine fork (the
  rule vs invent vs accept-bloat), default to the rule.

## Sources
React [Fragment](https://react.dev/reference/react/Fragment) · [DOM components](https://react.dev/reference/react-dom/components) ·
Vue [multi-root](https://v3-migration.vuejs.org/new/fragments) · Svelte [components](https://svelte.dev/docs/svelte-components) /
[anchor-node walkthrough](https://dev.to/tanhauhau/compile-svelte-in-your-head-if-1g6b) · Solid [control flow](https://www.solidjs.com/tutorial/flow_for) ·
Angular [ng-container](https://angular.dev/api/core/ng-container) · Lit [comment markers](https://lit.dev/docs/v1/lit-html/creating-directives/) ·
[MDN ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals) · [WHATWG custom elements](https://html.spec.whatwg.org/multipage/custom-elements.html) ·
[WebKit #97 (is= oppose)](https://github.com/WebKit/standards-positions/issues/97) ·
[WICG DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts-Imperative.md) · [Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md) · [W3C minutes 2025-03-26](https://www.w3.org/2025/03/26-webcomponents-minutes.html) ·
[chrome moveBefore](https://developer.chrome.com/blog/movebefore-api) · [MDN moveBefore](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore) ·
[MDN display:contents](https://developer.mozilla.org/en-US/docs/Web/CSS/display) · [hidde.blog display:contents a11y](https://hidde.blog/more-accessible-markup-with-display-contents/) ·
[web.dev subgrid](https://web.dev/articles/css-subgrid) · [Haunted](https://github.com/matthewp/haunted)
