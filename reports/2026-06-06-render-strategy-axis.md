# Render Strategy — the Axis-2 protocol (how a component tree updates over time)

**Point:** The rendering-strategy axis is its own conformance contract — a `CustomRenderStrategy` / `CustomRenderStrategyRegistry` Protocol owned by **Web Components** — that turns a parsed element tree plus a change source into committed DOM updates. The JSX adapter (and any other surface) merely *targets* a registered strategy; it never owns reactivity.

**Date**: 2026-06-06
**Owning project**: Web Components (`webcomponents`)
**Protocol**: `render-strategy` (anchor `protocol-render-strategy` in `project-webcomponents.njk`)
**Companions**: backlog `052-jsx-rendering-strategy-axis` (this report's source item); report `2026-05-31-change-tracking-observability.md` (the **Change Strategy** sibling — detection, in Web States); report `2026-06-03-jsx-adapter-feature-mapping.md` (Axis-1 syntax contract).

---

## 1. The two halves of reactivity (the framing)

Web Everything already shipped one half of reactivity as the **Change Tracking Protocol** (Web States): `CustomChangeStrategy` turns a tracked target into a stream of **Change Records** — the *"what changed."* It deliberately stops at detection and "leaves delivery to the framework."

Render Strategy is the **other half**: given an element tree and a source of change, *commit updates to the DOM* — the *"how the view updates."* The two are siblings, not rivals, and they **compose**:

| | Change Strategy (Web States, shipped) | Render Strategy (this report) |
|---|---|---|
| Question | *what* mutated, expressed how? | *how* does the DOM reflect it? |
| Contract | `CustomChangeStrategy.track/diff/applyInverse` | `CustomRenderStrategy.mount/update` (below) |
| Examples | native-signals, snapshot-diff, proxy, patch, crdt | declarative-static, vdom, fine-grained, imperative |
| Output | Change Records | committed DOM |

A render strategy may **consume** a change strategy as its reactivity source (the fine-grained strategy reads native-signals), or be self-contained (vdom does its own diff; declarative-static binds by path and never needs records). Keeping them separate is what lets one app run a CRDT change strategy under a vdom render strategy without either knowing about the other.

## 2. Why it is a separate axis from syntax (recap)

Axis-1 (syntax: HTML ⇄ JSX ⇄ template-string) is pure *spelling* of one element tree — reversible, covered by `2026-06-03-jsx-adapter-feature-mapping.md`. Axis-2 (this report) is *semantics*: what re-runs when state changes. The **same** JSX tree can be driven by completely different update machines, and that choice is independent of the spelling. Conflating them is what made the existing `JSXRenderer.ts` quietly hard-code one strategy (eager construct-once DOM). Naming the axis makes every strategy a peer behind one contract.

**Corollary — directives belong to Axis-2.** `<template is="for-each">` exists *only because inert HTML can't iterate*; it is an artifact of the declarative-static strategy, not a feature of HTML-the-syntax. Under a vdom or fine-grained strategy the iteration is just `items.map(…)` and there is nothing to "spell." Directives therefore appear and disappear **with the strategy** — which is exactly why they cannot be modeled on the syntax axis.

## 3. The contract (registry + provider, contracts-only)

Mirrors the `CustomChangeStrategy` shape so the two read as a family. **Web Everything ships the contract; Frontier UI ships the concrete strategies.**

```typescript
interface RenderStrategy {
  /** Realize a tree into live DOM under host; return a handle for later updates. */
  mount(tree: RenderInput, host: ParentNode, scope: Scope): RenderHandle;
  /** Reflect new state into the mounted tree. Strategy decides how (rebind / diff / recompute / rerun). */
  update?(handle: RenderHandle, next: RenderInput): void;
  /** Tear down bindings/subscriptions; leave the DOM removable. */
  dispose?(handle: RenderHandle): void;
}
```

- `RenderInput` is strategy-shaped: a parsed template + binding map (declarative-static), a `render()` thunk returning a vtree (vdom), a reactive computation (fine-grained), or an imperative builder (imperative).
- **Capability is feature-detected by which optional methods are present** (same convention as Change Strategy): a strategy with no `update` is mount-once (the current `JSXRenderer.ts` behavior); one with `update` supports re-render.
- The active strategy is resolved per scope through the injector chain via **`CustomRenderStrategyRegistry`** — *nearest-scope wins* — so different subtrees of one app render with different strategies simultaneously (a static marketing header on declarative-static, a live grid on fine-grained). This is the identical resolution rule as `CustomChangeStrategyRegistry`.
- **Native-first default = `declarative-static`**: parse-once DOM + binding behaviors (`bind-*`) + text-node parsers (`{{ }}`/`[[ ]]`) + template directives (`<template is="for-each|if">`). Zero runtime framework; this is the baseline every other strategy is opt-in against.

### The four registered strategies (the registry catalog)

| Strategy | How it updates | Iteration / conditionals expressed as | Reactivity source |
|---|---|---|---|
| **declarative-static** *(default)* | parse-once DOM + `bind-*` + `{{ }}` + directives | `<template is="for-each">`, `<template is="if">` | binds by path; no records needed |
| **vdom** | `render()` returns a tree; diff + patch | plain JS — `items.map(…)`, `cond && <X/>` | self-contained diff |
| **fine-grained** | expressions become reactive computations; surgical DOM, no diff | plain JS, tracked at read-time | consumes a `native-signals` Change Strategy |
| **imperative** | direct, hand-written manipulation | `for` loop + `createElement` | author-managed |

This list is **registry-driven, not a fixed enum** — a future platform target (DOM Parts / Template Instantiation) registers as a fifth provider without touching the contract or the adapter.

## 4. Cross-strategy conversion = lowering / lifting (the compiler half)

Conversions split into two difficulty classes:

- **Same-strategy = pure spelling** (HTML×declarative ⇄ JSX×declarative-mirror). Trivially reversible — this is Axis-1, already shipped (`htmlToJsx` / `jsxToHtml`).
- **Cross-strategy = lowering / lifting** (this item). Converting JSX×vdom `items.map()` into HTML×declarative `<template is="for-each">` (and back) is real compiler work: **lower** JS control-flow into directives, **lift** directives back into JS.

### The correspondence contract

| JS control-flow (vdom / fine-grained) | ⇄ | Declarative-static primitive | Reversible? |
|---|---|---|---|
| `items.map(i => …)` | ⇄ | `<template is="for-each" items key>` | ✅ structural |
| `cond && <X/>` / ternary | ⇄ | `<template is="if" condition>` | ✅ structural |
| `{expr}` (eager JS value) | ⇄ | `{{ expr }}` / `bind-text="path"` (reactive-by-path) | ⛔ **lossy boundary** |
| `onclick={namedFn}` | ⇄ | `on:click="namedFn($event)"` | ✅ for named handlers |
| `onclick={() => …}` (inline closure) | → | synthesized handler name or flagged lossy | ⚠ one-way |

**The `{ }` tension (the one hard boundary):** eager JS evaluation (`{expr}`) has no faithful inverse to a reactive runtime path (`{{ expr }}`). Lowering vdom→declarative can *emit* a binding, but lifting declarative→vdom cannot recover whether the author meant an eager value or a tracked path. **The contract must declare this boundary lossy** and the compiler must either pick a documented convention (treat `{{ }}` as `bind-*`, never as eager `{}`) or refuse the round-trip with a diagnostic. Everything else round-trips.

### Compile targets

A JSX tree authored against any strategy can be lowered to: (1) an HTML template (`<template is="for-each">`) — directive target; (2) native HTML with `bind-*` + `{{ }}` — declarative-bindings target; (3) pure DOM (`createElement` loop) — imperative target; (4) vdom `map` kept as JS — render target. These are the §3 strategies named as outputs.

## 5. Composition boundaries

- **Web States — Change Tracking Protocol.** The reactivity *source*. Render strategies that need records (fine-grained) resolve a `CustomChangeStrategy`; render strategies own the *commit*, change strategies own the *detect*. No overlap, explicit seam.
- **Web Directives.** Owns the *directive vocabulary* (`for-each`, `if`) as a syntax. Render Strategy owns *whether directives exist at all* for a given strategy. The declarative-static strategy is the one that materializes Web Directives; other strategies bypass them.
- **Web Adapters — JSX adapter.** A pure *consumer*: JSX compiles onto a chosen strategy and never bundles a reactivity model, preserving "no runtime magic." The strategy toggle on a block page is the UI surface of this protocol.
- **Web Components — declarative `<component>` (DC-4).** The `<component>` element's tier-2 "reactive depth" decision *is* a render-strategy choice; tier-1 static = the declarative-static strategy with no `update`. They converge here rather than each re-inventing reactivity.

## 6. Placement — resolved

052's open decision was *own standard vs fold into the JSX adapter*. **Resolved: own standard.**

- A **Protocol** (contracts only — registry, interface, no shipped strategy bodies), **not an Intent** — rendering strategy is a *technical* contract, not a UX preference, so it stays out of `/intents/` (consistent with the intent-UX-only rule).
- **Owned by Web Components**, which already owns the adjacent rendering surfaces: declarative definition, transient components, the SSR/hydration contract. Render strategy is "how a component's tree updates," squarely in-mission.
- The JSX adapter (Web Adapters) *targets* it; the declarative `<component>` element (Web Components) *targets* it; Web Directives supplies the directive vocabulary the default strategy uses. No new project — escalation to a `webrendering` project is held in reserve only if the catalog later attracts its own plugs/blocks (the Error-Recovery→Web-Reliability precedent), which it does not today.

## 7. Open points register

- 🔶 **DECIDE: `RenderInput` shape per strategy** — one tagged union vs per-strategy input types. Recommendation: tagged union keyed by strategy id, validated by the registered provider. → backlog item.
- 🔶 **DECIDE: re-render trigger ownership** — does `update()` get *called by* the host on a Change Record, or does the strategy *subscribe* itself? Recommendation: strategy subscribes (matches fine-grained reality; mount-once strategies simply omit `update`). → backlog item.
- ⚠ **CONFLICT (documented lossy): `{}` eager ⇄ `{{ }}` reactive** — no faithful inverse (§4). Contract declares the boundary lossy; compiler picks the `bind-*` convention. → tracked as a named lowering rule.
- 🔨 **ROUGH: directive canonical HTML spelling on lift** — comment-form vs template-element form when lifting vdom→declarative (feature-mapping row 8). Folds here from Axis-1. → backlog item.
- 🔶 **DECIDE: `JSXRenderer.ts` realignment** — make its implicit eager-DOM behavior an *explicit* registered `declarative-static`/`imperative` provider before adding the others. Recommendation: yes, first concrete step. → backlog item.

## 8. Next steps (phases)

1. **Make the default explicit.** Refactor `JSXRenderer.ts` from an implicit strategy into a registered `declarative-static` provider behind `CustomRenderStrategyRegistry` (Frontier UI). No behavior change; establishes the seam.
2. **Author the protocol body** in `project-webcomponents.njk` (done in this pass — `protocol-render-strategy`).
3. **Cross-strategy lowering compiler.** Build the §4 correspondence as a directive/strategy-registry-driven transform extending `htmlToJsx`/`jsxToHtml` to cross strategies (not just spelling). Pin the lossy `{}` boundary with a failing-by-design test.
4. **Second (strategy) toggle in the UI.** Add the strategy selector alongside the existing html/jsx source toggle on block pages, reading the registry.

## 9. Files created / modified (this pass)

| File | Action | Purpose |
|---|---|---|
| `reports/2026-06-06-render-strategy-axis.md` | created | This report (outside 11ty build; exposed via backlog 052) |
| `src/_data/protocols.json` | modified | Added `render-strategy` protocol (owned by `webcomponents`) |
| `src/_includes/project-webcomponents.njk` | modified | Added `protocol-render-strategy` normative section |
| `src/_data/semantics.json` | modified | Added **Render Strategy**, **Render Strategy Registry**, **Lowering**, **Lifting** |
| `backlog/052-jsx-rendering-strategy-axis.md` | modified | parked → in-progress; `relatedReport` → this report; placement resolved |
| `backlog/0NN-*.md` | created | Gap items spun out of §7 (see backlog) |
