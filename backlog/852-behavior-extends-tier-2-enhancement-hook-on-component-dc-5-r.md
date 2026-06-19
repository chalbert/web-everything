---
type: decision
workItem: story
size: 3
parent: "076"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-18"
relatedProject: webcomponents
relatedReport: reports/2026-06-17-component-behavior-extends-resolution.md
preparedDate: "2026-06-17"
crossRef: { url: /blocks/component/, label: Component block }
tags: [webcomponents, component, declarative, enhancement]
---

# `behavior`/`extends` tier-2 enhancement hook on `<component>`

**Prepared 2026-06-17 — ready to ratify.** DC-5 ([#044](/backlog/044-component-scripting-hook/), ratified
2026-06-08) settled the **policy**: tier-1 is declarative-only; a tier-2 `behavior`/`extends` attribute
associates a **registered** class or trait for progressive enhancement — **no inline `<script>`** inside
the definition (the script-gadget XSS surface stays closed). That part is settled and is **not** reopened
below.

The open call DC-5 did **not** settle is the **resolution mechanism** — how a registry-key
`behavior`/`extends` resolves to a class/trait and is applied to the generated element. The forks below are
grounded in a prior-art survey published as the
[`component-behavior-extends-resolution`](/research/#component-behavior-extends-resolution) research topic
(session report linked via `relatedReport`). **The survey reshaped the framing:** the item's single
A/B/C fork split into **two forks keyed by delivery mode** (the built vs unbuilt twin already exists), and
the `extends`-vs-`behavior` sub-call **dissolved** to *Supported by default* (DC-5 and WICG
[#1009](https://github.com/WICG/webcomponents/issues/1009) both name both spellings — they compose, not
compete).

## Axis-framing — what the real tree forces

The lowering ships as a **twin** — the same `ComponentDef`, two emit paths — and the resolution question
has a *different* answer for each, which is why one fork became two:

- **Built / static-HTML form.** `generateClassSource`
  ([we:declarativeComponent.ts:152-208](../blocks/renderers/component/declarativeComponent.ts#L152-L208)) emits
  a **self-contained ESM with no import-map seam** — explicit at
  [:204-207](../blocks/renderers/component/declarativeComponent.ts#L204-L207) ("kept inline so the wc-class
  form stays a SELF-CONTAINED ESM … unlike the functional form") — and a **fixed member order** for
  byte-determinism ([:156-163](../blocks/renderers/component/declarativeComponent.ts#L156-L163)). The
  functional twin ([we:functionalComponent.ts:57-60](../blocks/renderers/functional/functionalComponent.ts#L57-L60))
  is the contrast: it *does* carry an import seam (`import jsx, { defineElement } from JSX_RUNTIME_SPECIFIER`).
  Resolving a registry key here can only be done at **build time** without breaching one of those invariants.
- **Unbuilt / runtime form.** `defineFromDefinition`
  ([we:declarativeComponent.ts:212-250](../blocks/renderers/component/declarativeComponent.ts#L212-L250)) ships
  the raw twin with **no build step to inline into** — so resolution there is necessarily a **runtime** seam.
- **No precedent to mirror.** The in-tree webbehaviors registry
  ([CustomAttributeRegistry](../plugs/webbehaviors/CustomAttributeRegistry.ts)) is for custom **attributes**
  (`attributes.define`, e.g. `on:click`), the **wrong unit** for an element class/trait mixin. The natural
  runtime-resolution home is the existing DI layer:
  [webinjectors `Injector.register`/`consume`](../plugs/webinjectors/Injector.ts#L146-L152) already does
  lazy, hierarchical, deduped key→value resolution.

WICG [#1009](https://github.com/WICG/webcomponents/issues/1009) confirms the platform leaves this open
(*"Must the script be inline, or can it be bundled? Can it be loaded late?"*) and names **both** an
`extends`-a-base-class and a shared-`behavior` shape — so WE is genuinely greenfield, and both spellings are
legitimate. The two shipping poles map cleanly onto the twin: **Enhance** (build-time expansion + separate
hydration script) = build-time inline; **Stimulus** (`data-controller` resolved against a runtime registry)
= runtime lookup.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — built/static-HTML form | **Build-time inline** — the adapter resolves the key and inlines `extends Base` / `Behavior(Base)` into the generated source | Import seam (**broken**: breaks the wc-class form's defining no-import-seam invariant) | High (~85%) |
| 2 — unbuilt/runtime form seam | **Reuse the webinjectors DI registry** (`register`/`consume`) behind a guard | A new dedicated global element-behavior registry | Med (~70%) |

## Fork 1 — built/static-HTML form: build-time inline vs runtime-global vs import seam

*Fork-existence (case a, flawed branch named):* the **import seam (C)** is **broken** for this form — it
breaks the defining no-import-seam invariant
([we:declarativeComponent.ts:204-207](../blocks/renderers/component/declarativeComponent.ts#L204-L207)) that
makes the built form copy-pasteable static HTML and an upgrade-safe ESM. So exactly one branch keeps the
invariant intact for the form whose entire value *is* self-containment + byte-determinism.

- **A — Build-time inline (recommended).** The Declarative Component *adapter* (build transform) resolves
  the registry key against the project's registered classes/traits and **inlines** the `extends <Base>` /
  `Behavior(Base)` mixin into the generated source, in the fixed member order the lowering already enforces.
  Keeps the runtime ESM self-contained + deterministic (no runtime global, no import seam). Consistent with
  WE's native-first / build-time-adapter / deterministic-generation posture; mirrors Enhance's build-time
  expansion. The *value* is resolved once, at build, so a forward-adapter (#463/#505/#507) can emit it
  deterministically.
- **B — Runtime global-registry lookup.** The generated class consults a global element-behavior registry
  at definition time. *Dominated here:* adds a runtime global dependency + an ordering hazard (base must
  register first) to the one form whose point is to need neither — coherent but strictly worse than A for
  the built form.
- **C — Import seam.** Generated class `import`s the resolved class/trait. *Rejected* — breaks the
  no-import-seam invariant; the static-HTML delivery mode stops being copy-pasteable.

**Recommended default: A (build-time inline).** Confidence ~85%. Red-team: the decider should argue that a
built form might legitimately want *late-loaded* behavior (Enhance itself ships a *separate* hydration
script, not pure inlining) — if so the built form grows a runtime seam too and partly converges on Fork 2.
The default holds because the common case is eager enhancement, inlining is the only branch that preserves
both load-bearing invariants, and late-loading can be added later as an opt-in without reversing A. Residual:
the boundary between "inline now" and "defer to the Fork-2 seam" for an explicitly late-loaded behavior.

## Fork 2 — unbuilt/runtime form seam: reuse webinjectors vs a new dedicated global registry

*Fork-existence (case b, genuine either/or):* the unbuilt twin has **no build to inline into**
([we:declarativeComponent.ts:212-250](../blocks/renderers/component/declarativeComponent.ts#L212-L250)), so it
**must** resolve the key at runtime — and the resolution must consult exactly **one** canonical registry.
Reusing the existing DI seam and minting a new dedicated global registry are both coherent end-states that
cannot both be *the* canonical seam; the call is which one.

- **A — Reuse the webinjectors DI registry (recommended).** The generated runtime class resolves the key via
  the existing [`Injector.register`/`consume`](../plugs/webinjectors/Injector.ts#L146-L152) seam (lazy,
  hierarchical, deduped — the exact lifecycle), behind a feature guard. The running element consults it at
  definition time, so it is a **legitimate runtime-DI seam** (not a cargo-cult global —
  *a `CustomXRegistry` is justified only when the running standard consults it and nothing existing fits*,
  and webinjectors fits). Minimizes new surface / lock-in; mirrors Stimulus' registry-resolve.
- **B — New dedicated global element-behavior registry.** A purpose-built `globalThis` element-behavior
  registry with its own `define`/`get`. *Con:* mints a new global and a second registry convention alongside
  webbehaviors + webinjectors, for a unit the DI layer already serves; only warranted if the DI layer's
  parent/child injector hierarchy genuinely mismatches element-behavior (global) semantics.

**Recommended default: A (reuse webinjectors).** Confidence ~70%. Red-team: the decider should argue B by
pointing at semantic fit — webinjectors resolves *modules* by key with a parent/child injector *hierarchy*,
whereas element-behavior registration is conceptually flat/global, so reuse may force an awkward provider
type. The default holds because adding a thin element-behavior provider type to webinjectors is far cheaper
than a new global registry + convention, and the hierarchy is opt-in (a flat root injector is a valid
degenerate case). Residual: whether webinjectors needs a dedicated provider type for element classes, and
whether its hierarchy semantics leak into a contract that wants to stay flat.

## Supported by default (not decisions)

- **`extends` AND `behavior` both ship — two composable emit shapes, not a pick-one.** DC-5 ratified both;
  WICG [#1009](https://github.com/WICG/webcomponents/issues/1009) names both ("extend `HTMLElement`, or …
  another class with shared behavior"). `extends="<key>"` → `class X extends <ResolvedBase>`;
  `behavior="<key>"` → a **subclass-factory mixin** `<ResolvedBehavior>(Base)` (the
  [TC39 proposal-mixins](https://github.com/tc39/proposal-mixins) / [Lit mixins](https://lit.dev/docs/composition/mixins/)
  idiom). Both insertions preserve the fixed member order
  ([we:declarativeComponent.ts:156-163](../blocks/renderers/component/declarativeComponent.ts#L156-L163)).
  Bias-toward-separation: two homes, not a fused one. The build pins both shapes — a build detail, not a fork.
- **Registry-key only, never inline code (ratified DC-5 invariant).** The value is a **registry key**, not
  code; non-registered values are rejected with a clear diagnostic. This is the XSS guardrail DC-5 ratified —
  re-asserted as a floor, not reopened.

---

## Scope (the build, once the forks above are ruled)
- Parse `behavior=` / `extends=` on `<component>` in the lowering
  ([we:declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts)) — value is a **registry
  key**, not code.
- **Built form:** the adapter resolves the key and inlines `extends Base` / `Behavior(Base)` into the
  generated source (Fork 1A), in the fixed member order.
- **Unbuilt form:** the runtime class resolves the key via the webinjectors seam behind a guard (Fork 2A),
  base-registers-first ordering handled there.
- Reject inline script / non-registered values with a clear diagnostic (the DC-5 XSS guardrail).
- Feature-Inventory row on [we:component.njk](../src/_includes/block-descriptions/component.njk) + a
  `behaviorHook` decision entry in [fui:blocks.json](../src/_data/blocks.json); fixture + unit tests (assert
  generated source; behaviour exercised in a browser fixture); demo step.

## Notes
- Unblocks the **manual slot assignment** defer in #076 (it needs this JS layer to supply `slot.assign()`).
- Determinism: new members keep the static → `#internals` → `#root` → constructor → `connectedCallback`
  order.

## Resolution — ratified 2026-06-18 (Fork 1 = build-time inline; Fork 2 = reuse webinjectors)

Fork 1 → **build-time inline**: the import-seam branch breaks the no-import-seam invariant (high confidence). Fork 2 → **reuse webinjectors DI** (~70%): per the runtime-DI-vs-devtools-provider rule a new CustomXRegistry is justified only when the running standard consults it, and nothing here does — so the behavior/extends tier-2 hook composes over webinjectors rather than minting a new global registry. Governed by the component-dc table. Reversible.
