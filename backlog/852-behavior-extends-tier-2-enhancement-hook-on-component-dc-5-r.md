---
type: decision
workItem: story
size: 3
parent: "076"
status: open
dateOpened: "2026-06-17"
tags: [webcomponents, component, declarative, enhancement]
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# `behavior`/`extends` tier-2 enhancement hook on `<component>`

DC-5 ([#044](/backlog/044-component-scripting-hook/), **ratified 2026-06-08**) decided the **policy**: declarative-only in tier-1; a **tier-2 `behavior`/`extends` attribute associates a *registered* class or trait** for progressive enhancement — **no inline `<script>`** inside the definition (keeps the script-gadget XSS surface closed). That part is settled.

## Retyped `decision` 2026-06-17 (batch-2026-06-17 pre-flight) — DC-5 ruled the policy, not the resolution mechanism

Claimed as a "ready build" (per #076), but the fork-existence test at claim surfaced a genuine buried call DC-5 did **not** settle: **how a registry-key `behavior`/`extends` resolves to a class/trait and is applied to the generated element** — and it collides head-on with a *load-bearing invariant* of the wc-class lowering. [declarativeComponent.ts:~145](../blocks/renderers/component/declarativeComponent.ts) emits a **self-contained ESM with no import-map seam** (explicitly commented, deliberately unlike the functional form) and a **fixed member order** for byte-determinism. Resolving a registry key at runtime can't be done without breaching one of those. The webbehaviors registry that exists ([CustomAttributeRegistry](../plugs/webbehaviors/CustomAttributeRegistry.ts)) is for custom **attributes** (`attributes.define`, e.g. `on:click`), not element class/trait mixins — so there is no precedent to mirror mechanically.

### The fork — resolution time + seam (one real on-merit call; ~70% on the default)

- **A — build-time resolution (recommended ~70%).** The Declarative Component *adapter* (build transform) resolves the key against the project's registered classes/traits and **inlines** the `extends <Base>` / mixin into the generated source. Keeps the runtime ESM self-contained + deterministic (no runtime global, no import seam); consistent with WE's native-first/build-time-adapter + deterministic-generation posture. *Residual:* the unbuilt-runtime delivery path (the twin shipped raw) then needs a fallback resolution seam — a global registry lookup behind a guard — which is the part that nicks self-containment for that one delivery mode.
- **B — runtime global-registry lookup.** Generated class consults a global element-behavior registry (`globalThis`) at definition time. Uniform across built/unbuilt, but adds a runtime global dependency to the self-contained form and an ordering hazard (base must register first).
- **C — import seam.** Generated class `import`s the resolved class/trait. Simplest application, but **breaks the wc-class form's defining no-import-seam invariant** — the property that makes it copy-pasteable static HTML. Likely *broken* for the static-HTML delivery mode.

Plus a sub-call: **`extends` (a registered base class → `class X extends Base`) vs `behavior` (a registered trait/mixin → `Behavior(Base)`)** are distinct application strategies; the build must pin both shapes and how they compose with the fixed member order.

**Ratify the resolution mechanism (default A) before building.** Then the scope below is the build.

## Scope (the build, once the fork above is ruled)
- Parse `behavior=` / `extends=` on `<component>` in the lowering ([declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts)) — value is a **registry key**, not code.
- Generated class resolves the registered class/trait and applies it (mixin/extends the generated base, in the fixed member order the lowering already enforces for determinism).
- Reject inline script / non-registered values with a clear diagnostic (the XSS guardrail DC-5 ratified).
- Feature-Inventory row on [component.njk](../src/_includes/block-descriptions/component.njk) + a `behaviorHook` decision entry in [blocks.json](../src/_data/blocks.json); fixture + unit tests (assert generated source; behaviour exercised in a browser fixture); demo step.

## Notes
- Unblocks the **manual slot assignment** defer in #076 (it needs this JS layer to supply `slot.assign()`).
- Determinism: new members keep the static → `#internals` → `#root` → constructor → `connectedCallback` order.
