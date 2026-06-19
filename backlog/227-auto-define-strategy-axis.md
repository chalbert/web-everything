---
type: decision
workItem: story
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "protocol:auto-define-strategy"
codifiedIn: "one-off"
size: 5
tags: [components, custom-elements, self-registration, auto-define, strategy-axis, research]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/functional-component-adapter/, label: Functional Component Adapter }
---

# Design the auto-define strategy axis: how/when a custom element gets registered (open + pluggable)

#072 ruled that custom-element self-registration is a **module-import** concern, not a JSX/renderer
one, and that we carry the *concept* from plateau — never its POC implementation (a render-time
WeakMap `AutoDefineService`, scaffolding thrown together only to prove the idea). This item is to
actually **work the concept** into a first-class WE model, rather than just describe today's
incidental behavior.

What exists today is only a partial, implicit realization: generated component modules end in a
top-level `customElements.define(...)` side effect
(`we:blocks/renderers/component/declarativeComponent.ts:151`,
`we:blocks/renderers/functional/functionalComponent.ts:71`), and one adapter doc shows
`await import('…?form=functional'); // self-registers <user-card>`. That's a convention by
accident, not a designed concept.

## Auto-define is a strategy axis, not one mechanism

Self-registration / auto-define is a **dimension** with multiple legitimate strategies — not a
single fixed approach. plateau's render-time tracker was merely *one runtime strategy* it happened
to use to prove the concept. Candidate strategies along the axis, ordered by how much inference /
magic they add:

- **None / explicit**: author hand-writes every `customElements.define`. The native-HTML baseline,
  zero inference. This is a real end-state, not just the absence of the others.
- **Eager barrel / register-all**: one module imports + defines every component up front. Crude but
  fully predictable; no per-element decision.
- **Runtime — on import** (today's WE default): module top-level `customElements.define` side effect;
  define-as-we-import-them — registers when the module loads. Runtime alternative to build-time
  parse: same outcome, resolved at load instead of statically before ship.
- **Runtime — on first use / DOM-presence**: a MutationObserver (or `whenDefined` gate) watches for
  unknown tags and fetch+defines on demand. plateau's render-time "undetermined" scan re-cast as a
  *deliberate lazy runtime strategy*, not scaffolding.
- **Build-time static parse**: a build pass statically resolves which custom elements a tree/app
  uses and injects the imports / emits a registration manifest, so nothing is discovered at runtime.
  Crucially it parses **HTML usage too, not just the JS import graph** — detects custom-element tags
  in markup (e.g. `<user-card>` written as plain HTML with no import) and injects the registration
  import for each, so an author writes plain HTML and the build wires up the defines. Needs a tag →
  module resolution map.
- **Declarative tag→module map**: an import-map-style manifest (or `<link>`) the loader reads to
  register on demand. HTML-declarative and reversible — fits the mirror-dialect premise.
- **Convention / URL resolution**: tag name resolves to a module URL by naming convention; loader
  fetches by convention, no manifest.
- **Server / SSR-driven**: server emits exactly the import/define set for what it rendered.

These aren't a flat list — they decompose into **cross-cutting sub-dimensions**, and a concrete
strategy is a point across them:

- **trigger**: import · first-use · in-viewport · DOM-presence · build-time · server-render
- **scope**: global registry vs the scoped-custom-element-registry proposal (per shadow root)
- **decider**: author-explicit vs tool-inferred (parse) vs convention

Per the dimension-vs-fixed-mechanic rule, because more than one of these is a legitimate end-state,
self-registration should be modeled as a **configurable strategy dimension** (with a native-first
default), the same way the JSX adapter's rendering strategy is an axis. This item should define that
axis — the strategies, the sub-dimensions, their tradeoffs, the default, and where the choice is
expressed — not pick a single mechanism.

## Open extension point — hook for custom strategies

The built-in strategy list above must **not** be a closed enum. Following the intents-open-design
philosophy (standardize the meta-schema, not the list), the axis
needs a **registry hook so authors can register their own auto-define strategy** that coexists
conflict-free with the built-ins (same registry+adapter shape WE uses elsewhere). The standard defines the strategy *contract* (the
interface a strategy implements: trigger, tag→module resolution, how it performs the define / scope)
and the resolution rules; the concrete strategies — built-in or custom — are plugged in. So a team
can add e.g. a bespoke server-driven or convention-based strategy without forking WE.

## Prior art (research — 2026-06-09)

This is a well-precedented design space; the strategies above map onto real implementations:

- **Both auto + manual registration are legitimate** — Component Kitchen / Jan Miksovsky argue a
  library should support *both*: some modules export only the class (consumer registers — full
  control), others export the class *and* self-register. Direct validation of the "decider"
  sub-dimension and that explicit + auto are both real end-states.
  (component.kitchen/blog/posts/supporting-both-automatic-and-manual-registration-of-custom-elements)
- **DOM-presence auto-loader** — the CSS-Tricks "An Approach to Lazy Loading Custom Elements" pattern
  is the on-first-use strategy: a MutationObserver dynamic-`import()`s an element's impl when its tag
  appears in the DOM; the browser then upgrades it. (css-tricks.com/an-approach-to-lazy-loading-custom-elements/)
- **Custom Elements Manifest** — `webcomponents/custom-elements-manifest` (+ the `customElements`
  field in we:package.json) is a standard file format describing a package's elements. It's the natural
  substrate for the build-time-parse and declarative-tag→module strategies (tag → defining module
  resolution). (github.com/webcomponents/custom-elements-manifest, custom-elements-manifest.open-wc.org)
- **Scoped Custom Element Registries** — WICG proposal, shipped in Safari, Chromium implementing;
  `attachShadow({ customElementRegistry })` associates a registry with a shadow root. This is the
  "scope" sub-dimension (global vs per-shadow-root) and motivates why tag→constructor isn't global.
  (we:wicg.github.io/webcomponents/proposals/Scoped-Custom-Element-Registries.html; open-wc.org scoped-elements)
- **Stencil output targets prove the consumer-chooses model** — `dist` (lazy: a small entry registers
  all components and defers loading each impl until rendered) vs `dist-custom-elements` (standalone:
  consumer imports and calls `defineCustomElement`). Same source, both shipped, *the consumer picks
  which build/strategy to use* — exactly the configurable-dimension framing, in production.
  (stenciljs.com/docs/custom-elements)

Remaining to research before settling the default: how `unplugin`-style auto-import tooling
(Vue/Nuxt components, unplugin-icons) resolves component tags at build time — the closest analog to
the "build-time parse HTML usage and inject imports" strategy — and whether a custom-elements-manifest
can drive that resolution directly.

## Concept questions to settle (work the idea, don't port code):

- **The contract.** What is the canonical self-registration shape a component module exposes —
  bare top-level `customElements.define`, an exported `register()`, a decorator, or a WE helper that
  makes it idempotent + collision-safe (re-import, duplicate tag, HMR re-run)?
- **Tag ↔ class binding.** Where does the tag name live so import-time registration and the JSX
  class path (`<UserCard/>` → `new UserCard()`) agree without a side channel?
- **Lazy / MaaS interaction.** How self-registration composes with lazy `import()` and the MaaS
  delivery forms — register eagerly on import vs on first use.
- **Hand-authored parity.** What an author writes by hand to get the same self-registration the
  generators emit, and how that's surfaced where authors look (not folklore in one adapter doc).

Sibling to #002 (carry plateau's @domain concept into WE) — same "carry the concept, not the POC"
shape. Surfaced as a close-out leftover from #072.

## Resolution (2026-06-09)

Graduated to the **Auto-Define Strategy Protocol**
(`/projects/webcomponents/#protocol-auto-define-strategy`, `we:protocols.json#auto-define-strategy`),
owned by the webcomponents project — the same Protocol-not-Intent path render-strategy took.

Rulings:

1. **Strategy axis, mirroring render-strategy's framing** but built on the canonical registry idiom —
   the registry **extends core `CustomRegistry`** (`we:plugs/core/CustomRegistry.ts`), not a bespoke
   `#defaultName` registry.
2. **No tool-baked default.** The native baseline is *explicit* registration (the platform has no
   auto-registration). The default-strategy selection is a value in the **platform config a project
   extends**, shipped in flavors (`strict-explicit` → explicit; `lazy-dom` → on-first-use;
   `build-parsed` → build-time). Codified as a cross-cutting rule —
   defaults live in a project config that extends the platform default — applies to ALL strategy axes, not just this one.
3. **Contract** `AutoDefineStrategy`: `key`, `trigger`, optional `resolve(tag)→module`,
   `define(tag, ctor, scope?)`. Inferring strategies (lazy-dom, build-parsed, manifest, convention,
   server) are opt-in; the explicit baseline needs no strategy object.
4. **`defineElement(tag, ctor)`** idempotent/HMR/dup-safe helper = how explicit registration is
   expressed; generators and hand-authors call the same one (parity answered).
5. **`static tagName`** = the tag↔class single source of truth; JSX resolves through it.
6. **Open hook** — custom strategies register conflict-free (standardize the contract, not the list).
7. **Scope** — global default; reserve a `RegistryScope` token for Scoped Custom Element Registries.

Successor builds: **#241** (contract + `defineElement` + `static tagName`), **#242** (registry +
platform flavors + open hook). Leftover: **#243** (align `CustomRenderStrategyRegistry` /
change-strategy to the config-extends model — render-strategy currently bakes its default into the
tool).

**Graduated to** `protocol:auto-define-strategy` — contract at /projects/webcomponents/#protocol-auto-define-strategy.
