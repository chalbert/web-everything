---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
codifiedIn: "one-off"
tags: [jsx, adapters, renderer, custom-elements]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Decide whether to recover the JSX renderer's auto-define tracking from the plateau prototype

The old `plateau:plateau/src/blocks/renderers/jsx-renderer.ts` tracked "undetermined" elements/attributes/comments in WeakMaps so an AutoDefineService could auto-register custom elements discovered in a JSX-rendered tree. The current `we:blocks/renderers/jsx/JSXRenderer.ts` rewrite deliberately dropped this — it creates plain DOM and leaves registration to the author.

Current recommendation: leave it dropped for the mirror-dialect POC (authors register elements explicitly, matching how HTML works). Alternative held open: reintroduce a lightweight auto-define pass so a JSX tree self-registers its custom elements. This is a sibling to the `injector-domain-concept-carry-forward` decision — both ask whether a plateau concept should be carried into Web Everything.

## Resolution (2026-06-09)

**Do not recover plateau's render-time auto-define mechanism.** plateau was a POC — its
WeakMap "undetermined" tracking + `AutoDefineService` was scaffolding thrown together to *prove
the concept of self-registration*, not a design to port. We carry the **concept**, not the
implementation.

The concept — self-registration — is real and worth having, but it belongs at **module import**,
not at render time inside the renderer:

- A component module performs `customElements.define(...)` as a top-level side effect, so
  *importing the module registers the element*. This is renderer-agnostic and serves HTML string
  tags (`<user-card>`) and the JSX class path (`<UserCard/>` → `new UserCard()`) identically.
- WE already realizes this: generated modules end in `customElements.define`
  (`we:blocks/renderers/component/declarativeComponent.ts:151`,
  `we:blocks/renderers/functional/functionalComponent.ts:71`), and the functional-component-adapter
  doc shows `await import('…?form=functional'); // self-registers <user-card>`.
- What JSX uniquely makes easier is *instantiation from the class*, not registration — and even
  that requires the class to be defined first (custom-element constructors throw if unregistered).
  So registration stays upstream at import; JSX is just a consumer of an already-registered element.

Recovering the render-time pass would duplicate, at a worse layer, a job define-on-import already
does correctly — and it has no reverse HTML spelling, breaking the mirror-dialect reversibility the
JSX adapter is built on. Auto-define is therefore **not** a JSX concern.

Leftover captured: #227 — design the auto-define **strategy axis** (runtime on-import /
on-DOM-presence, build-time parse of HTML+JS usage, declarative manifest, convention, server-driven,
or none), as an **open + pluggable** dimension with a custom-strategy hook and a native-first
default — not a single mechanism.
