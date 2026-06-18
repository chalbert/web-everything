# Research Report — Declarative binding layer (DC-4): platform status + prior-art paradigms

**Date**: 2026-06-16
**Seeds**: backlog #076 (declarative custom-element APIs on `<component>`), scaffolds decision #792 (DC-4).
**Question**: Can WE lean on a native binding primitive for `observe=` / reactive bindings, or should it
define its own compile-time `{{expr}}` contract? What does the prior art teach about the shape?

---

## 1. Platform status (verified 2026-06)

The premise that gates `observe=` / reactive bindings — "wait for Template Instantiation / DOM Parts" — is
**not a near-term bet**. None of the relevant proposals ships, none is Baseline, and the center of gravity
moved (Dec 2025) to a new JS-templating proposal — so the older specs are being re-litigated, not finalized.

| Proposal | Stage / venue | Browser reality | Lean on it? |
|---|---|---|---|
| **Template Instantiation API** (`TemplateInstance`, mustache `{{ }}`) | WICG strawman; no W3C track | None ship it | **No** — superseded in discussion by DOM Parts, then #1069 |
| **DOM Parts — imperative** (`getPartRoot`, `ChildNodePart`) | WICG; Chromium "Intent to Prototype" | Behind-flag prototypes only; March-2025 minutes record vendor skepticism (mixed/negative perf) | **No** — in reconsideration, no shipping commitment |
| **DOM Parts — declarative** (`{{ }}` / `{{#}}…{{/}}`, PR #1023) | WICG, exploratory | None | **No** — downstream of the imperative question |
| **TC39 Signals** (`Signal.State`/`Signal.Computed`) | **Stage 1** (since Apr 2024) | Polyfill only; Stage 2 deliberately gated on multi-framework adoption | **No** as a primitive; fine as a *pattern* |
| **JS templating API (#1069)** | New WICG proposal, Dec 2025 + TPAC 2025 | None | **No** — the current forward direction; signals the older specs are unsettled |

**Bottom line:** "Depends on unshipped Template Instantiation / DOM Parts" is a dependency on a moving,
contested, multi-year (or never) target. "Defer until it ships" ≈ "defer indefinitely."

## 2. Prior-art paradigms (the reusable model, not the feature list)

| System | Compile vs runtime | Direction | Expression model | Paradigm WE could borrow |
|---|---|---|---|---|
| **lit-html** | Runtime (tagged template → cached parts) | One-way; two-way manual | Full JS in `${}` | Parts = *positions* in a static template patched in place — the DOM-Parts ancestor. WE already emits a static template. |
| **Angular** | **Compile-time** | `[prop]` / `(evt)` / `[(ngModel)]`; `@if/@for` | Restricted expression sublanguage | A *restricted* grammar compiled away — safest for a build-time lowering. WE's `<for-each>` mirrors `@for`. |
| **Vue SFC** | **Compile-time** (patch flags) | `:prop` / `v-model` / `@evt` | `with`-scoped sandbox | Compiler knows which nodes are dynamic → targeted updates. |
| **Svelte** | **Compile-time**, no runtime framework | `{x}` / `bind:`; `{#each}/{#if}` | Real JS, statically analyzed | *Compile to plain class + direct DOM ops, ship no runtime* — the reference model for WE's stance. |
| **Solid** | Compile-time + fine-grained signals | One-way | Real JS | Fine-grained reactivity without a VDOM — what the Signals direction generalizes. |
| **htmx / Alpine** | Runtime attribute-directive interpreter | Mostly one-way | Small evaluator | HTML-first directive ergonomics — but a *runtime interpreter* (against WE's "no browser-side interpreter"). |
| **Polymer `<dom-bind>`** | Runtime, `{{ }}`/`[[ ]]` | `{{ }}` two-way / `[[ ]]` one-way | Restricted paths + computed | The original native-ish `{{ }}`; the one-way/two-way spelling split is proven and legible. |

**Paradigms to harvest** (candidate composable intents):
- *Restricted expression sublanguage* (Angular/Vue) beats raw-JS-in-`${}` for a build-time, sandboxable,
  statically-analyzable contract — aligns with "borrow platform vocabulary, no impl leakage."
- *Compile-to-imperative, ship-no-runtime* (Svelte) is what WE's lowering already embodies — a binding is
  just *more generated statements* in the `<component>` class.
- *One-way default, two-way opt-in* (Polymer `[[ ]]`/`{{ }}`, Angular) is the most-flexible/legible split.

## 3. The crux

WE already lowers `<component>` to a generated class at build time
([we:declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts) → `generateClassSource`).
It does **not** need a browser binding primitive to reflect an observed attribute into content — it can emit
`static observedAttributes` + `attributeChangedCallback` + targeted `textContent`/attribute assignments,
exactly like Svelte. So the real fork is **not** "wait vs build" on capability grounds (both are buildable);
it is *how much binding surface to commit to now* given the platform is unsettled. See decision #792 for the
fork and recommended default.

## 4. Residual design-blocks (independent vs downstream of DC-4)

- **DC-5 — `behavior`/`extends` scripting hook** (lifecycle side-effects): **independent**, inherently JS;
  own decision (where authored JS attaches to the generated class). Can ship in parallel.
- **Scoped registration (`scope`)**: **independent** — blocked on Scoped-Custom-Element-Registries alignment.
- **Manual slot assignment (`slotAssignment:'manual'`)**: **independent** — needs a `slot.assign()` runtime layer.
- **Shared stylesheets (cross-instance `adoptedStyleSheets`)**: **independent** — a styling-distribution form.
- **Reactive bindings (computed/two-way/list)**: **downstream of DC-4** — extend the B1 grammar; separately prioritized (B2).
- **Custom states `:state()` (DC-14)**: **independent** — deferred on low value, not on binding.

## Correction (2026-06-17) — §2 missed WE's already-shipped binding layer

During #792's ratification turn, grounding found that **WE already ships a `{{ }}`/`[[ ]]` binding layer** —
the `webexpressions` plug family (`status: active`): `CustomExpressionParserRegistry` + `CustomExpressionParser`,
`DoubleCurlyBracketParser`, `DoubleSquareBracketParser`, and a runtime interpreter `InterpolationTextNode`.
§2's table lists Polymer `{{ }}`/`[[ ]]` and the restricted-sublanguage paradigm as *prior art to borrow* —
but WE had **already built** them. The §3 framing ("WE does not need a browser binding primitive — it can emit
`observedAttributes`…") is still correct, but incomplete: it omits that a *runtime* (plugged) interpreter
already exists, so DC-4's compile-time path is the **unplugged twin** of a shipped contract, not a greenfield
one. See #792's ruling for the corrected fork (plugged/unplugged split; reuse `CustomExpressionParser` grammar).

## Sources
- TC39 Signals (Stage 1): https://github.com/tc39/proposal-signals
- Template Instantiation proposal: https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md
- DOM Parts declarative-syntax PR #1023: https://github.com/WICG/webcomponents/pull/1023
- DOM Parts reconsideration (W3C minutes 2025-03-26): https://www.w3.org/2025/03/26-webcomponents-minutes.html
- New JS templating API (#1069, Dec 2025): https://github.com/WICG/webcomponents/issues/1069
- Chromium "Intent to Prototype: DOM Parts": https://groups.google.com/a/chromium.org/g/blink-dev/c/wIADRnljZDA
- EisenbergEffect, "The Future of Native HTML Templating and Data Binding": https://eisenbergeffect.medium.com/the-future-of-native-html-templating-and-data-binding-5f3e52fda259
