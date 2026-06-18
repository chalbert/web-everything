# `behavior`/`extends` resolution mechanism on `<component>` — prior-art survey (prep for #852)

**Date:** 2026-06-17 · **Decision:** [#852](/backlog/852-behavior-extends-tier-2-enhancement-hook-on-component-dc-5-r/) ·
**Parent epic:** [#076](/backlog/076-component-declarative-wc-apis/) · **Policy ancestor:** DC-5 / [#044](/backlog/044-component-scripting-hook/) (ratified 2026-06-08)

## The question prep had to answer

DC-5 ratified the **policy**: tier-1 is declarative-only; a tier-2 `behavior`/`extends` attribute
associates a *registered* class or trait for progressive enhancement — never an inline `<script>` (the
XSS-gadget surface stays closed). DC-5 did **not** settle the **mechanism**: *how a registry-key
`behavior`/`extends` resolves to a class/trait and is applied to the generated element.* The item flagged
that this collides with a load-bearing invariant of the wc-class lowering
([we:blocks/renderers/component/declarativeComponent.ts:152-208](../blocks/renderers/component/declarativeComponent.ts#L152-L208)):
`generateClassSource` emits a **self-contained ESM with no import-map seam** (explicit comment at
[:204-207](../blocks/renderers/component/declarativeComponent.ts#L204-L207)) and a **fixed member order**
for byte-determinism ([:156-159](../blocks/renderers/component/declarativeComponent.ts#L156-L163)). The
existing webbehaviors registry
([CustomAttributeRegistry](../plugs/webbehaviors/CustomAttributeRegistry.ts)) is for custom
**attributes** (`attributes.define`, e.g. `on:click`), not element class/trait mixins — so there is no
in-tree precedent to mirror mechanically.

## Prior-art survey (design-first step 1)

### The platform leaves this exactly open — and names both spellings

WICG **[declarative-custom-elements #1009](https://github.com/WICG/webcomponents/issues/1009)** (the
proposal DC-5 built on) lists the open questions verbatim:

- *"Can a declarative custom element be enhanced with script? How is that script associated with the
  element? **Must the script be inline, or can it be bundled? Can the script be loaded late? Is there an
  upgrade-like step when it does?**"*
- *"What is the base class for a declarative custom element? **Does it directly extend `HTMLElement`, or is
  there another class with shared behavior?**"*

Two takeaways. (1) The platform itself frames the **inline-vs-bundled-vs-loaded-late** axis — which *is*
WE's build-time-inline-vs-runtime-resolution question — and has **not** picked, so WE is genuinely
greenfield and must invent. (2) The platform names **both** an `extends`-a-base-class and a
shared-`behavior` shape as legitimate, directly validating DC-5's two spellings.

### Two shipping poles, mapping onto WE's existing twin

| System | How behavior associates | Resolution time | Maps to WE option |
|---|---|---|---|
| **[Enhance](https://enhance.dev/docs/learn/concepts/html)** (enhance.dev) | HTML-first custom elements **expanded** server/build-side; interactivity via a *separate* hydration script | **Build/render-time inline expansion** | **A** (build-time inline) |
| **[Stimulus](https://stimulus.hotwired.dev/reference/controllers)** | `data-controller="name"` resolved against a controller **registry** at runtime; a [custom resolver](https://www.npmjs.com/package/stimulus-controller-resolver) maps name→class | **Runtime registry lookup** | **B** (runtime global registry) |

These are not competing winners — they are the two *delivery modes* WE already ships as a twin:
`generateClassSource` (the **built**, self-contained form, Enhance-like) and `defineFromDefinition`
([:212-250](../blocks/renderers/component/declarativeComponent.ts#L212-L250), the **unbuilt runtime**
form, which has no build step to inline into). The honest framing is *per-delivery-mode*, not one global
default — this reshaped the item's single A/B/C fork into two.

### The `behavior` application shape is a settled idiom

A trait/mixin applies as a **subclass-factory mixin** `Behavior(Base)` — a function from a class to a
subclass — the [TC39 proposal-mixins](https://github.com/tc39/proposal-mixins) definition, and the
shipping [Lit mixins](https://lit.dev/docs/composition/mixins/) idiom (`class X extends Behavior(LitElement)`).
`extends` is the simpler `class X extends Base`. Both are well-trodden; the only WE-specific constraint is
that whichever the build inserts must preserve the fixed member order.

## How it reshapes the decision

The item entered prep with **one** fork (resolution time + seam: A build-time / B runtime-global / C
import, default A ~70%) plus a sub-call (`extends` vs `behavior`). The survey splits it:

1. **The A-vs-B tension is per-delivery-mode, not one default.** The built form and the unbuilt-runtime
   form are different machines (the existing twin); each resolves the key its own way. So the single fork
   becomes **two** — one per form.
2. **`extends` vs `behavior` is not a fork at all** (pass-0 dissolve). DC-5 ratified both; WICG #1009 names
   both; they are two composable application strategies, not a pick-one. → *Supported by default*, with the
   two emit shapes pinned (`extends Base` / `Behavior(Base)`).
3. **C (import seam) is the named-broken branch**, not a co-equal option: it breaks the wc-class form's
   defining no-import-seam invariant ([:204-207](../blocks/renderers/component/declarativeComponent.ts#L204-L207)),
   which is the property that makes the built form copy-pasteable static HTML.

### The two forks, with grounded defaults

- **Fork 1 — built/static-HTML form: build-time inline (A, default ~85%)** vs runtime-global (B) vs import
  (C). C is excluded (invariant); B needlessly adds a runtime global + an ordering hazard (base must
  register first) to a form whose entire value is self-containment + determinism. Mirrors Enhance.
  *Residual:* if a built form ever legitimately wants *late-loaded* behavior (Enhance ships a separate
  hydration script), it grows a runtime seam too, blurring into Fork 2.
- **Fork 2 — unbuilt-runtime form's resolution seam: reuse the webinjectors DI registry (default ~70%)**
  vs a new dedicated global element-behavior registry vs import. Build-time inlining is *impossible* here
  (the raw twin ships as-is), so resolution must happen at runtime. webinjectors
  ([we:Injector.ts:146-152](../plugs/webinjectors/Injector.ts#L146-L152)) already does lazy `register`/
  `consume` with hierarchical resolution and dedup — the running element consults it at definition time, so
  it is a legitimate runtime-DI seam (not a cargo-cult global). Mirrors Stimulus. *Residual:* webinjectors
  resolves *modules* by key, not element-classes specifically — may need a thin element-behavior provider
  type; and its parent/child injector hierarchy may be richer than element-behavior (global) semantics want.

## Classification (per-fork pass)

- **Layer:** the resolution mechanism is an **implementation detail of the Declarative Component adapter +
  its runtime twin** (webcomponents block), not a new protocol. `behavior`/`extends` is an **intent
  dimension** on `<component>`, not a standalone standard.
- **DI-injectable?** Fork 2 *is* the DI seam question: yes for the unbuilt form (runtime consults a
  registry), resolved by **reusing the existing webinjectors seam** rather than minting a global — consistent
  with *a CustomXRegistry is justified only when the running standard consults it and nothing existing fits*.
- **Most-permissive default / separation:** `extends` and `behavior` stay **two composable homes** (bias
  toward separation), each with its own emit shape.
- **Seam between intents:** the XSS guardrail (registry-key only, never code) is the ratified DC-5
  invariant, re-asserted as a *Supported by default* floor, not re-litigated.

## Sources

- [WICG/webcomponents #1009 — declarative-custom-elements: capabilities & open questions](https://github.com/WICG/webcomponents/issues/1009)
- [Enhance — HTML / custom-element expansion](https://enhance.dev/docs/learn/concepts/html) · [enhance-ssr](https://github.com/enhance-dev/enhance-ssr)
- [Stimulus — Controllers reference](https://stimulus.hotwired.dev/reference/controllers) · [stimulus-controller-resolver](https://www.npmjs.com/package/stimulus-controller-resolver)
- [TC39 proposal-mixins](https://github.com/tc39/proposal-mixins) · [Lit — Mixins](https://lit.dev/docs/composition/mixins/)
