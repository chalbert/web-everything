---
kind: story
size: 5
parent: "049"
status: resolved
dateOpened: '2026-06-03'
dateResolved: '2026-06-08'
graduatedTo: "frontierui/compiler/src/component-transform/ — bidirectional `<component>` ⇄ class AST transform (POC)"
tags:
  - webcomponents
  - component
  - adapter
  - transform
  - ast
  - poc
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /adapters/declarative-component/, label: Declarative Component Adapter }
---

# Implement the bidirectional `<component>` ↔ class AST transform (POC)

POC build of the deterministic, bidirectional transform between `<component>` declarative source and its lowered `class extends HTMLElement` form. Implementation in `frontierui/compiler/src/component-transform/`; tests pin a byte-identical round-trip contract both directions, so AST library and runtime location stay swap-able. First fixture (`x-empty`) and 4 red tests already in place; next session picks the AST library at first-test-green and grows fixtures one paired rule at a time.

## Progress
- **Status:** resolved 2026-06-08 — POC delivered: the bidirectional `<component>` ⇄ class transform works both directions, the byte-identical round-trip contract is green, the AST library is chosen, and the growth pattern is proven with a second fixture.
- **AST library picked: the TypeScript Compiler API** (`typescript`, already in `frontierui` deps) for the imperative/class side — the genuine AST need; `parseImperative` walks the `SourceFile`. The declarative/HTML side uses a minimal single-element tag reader (the documented swap seam: replace with parse5/an HTML AST when nested-element fidelity is needed). The **IR** (`fui:ir.ts`: `{ name, shadow, templateHTML }`) is the neutral seam both directions route through — grow the contract by adding an IR field + its paired parse/emit rule.
- **Files (frontierui/compiler/src/component-transform/):** `fui:ir.ts` (IR + `pascal`), `fui:declarative.ts` (`parseDeclarative`/`emitDeclarative`), `fui:imperative.ts` (`parseImperative`/`emitImperative` via TS AST), `we:index.ts` (wires `transform()`; failures return structured `errors`, not throws).
- **Tests:** `fui:transform.test.ts` refactored into a reusable `contract(slug, …)` helper (4 assertions: both lowerings + both round-trips). Two fixture pairs green: `x-empty` (default-shadow, empty template) and `user-card` (light DOM `shadow="none"`, non-empty `<slot>` template, multi-segment pascal name) — **8/8 passing**. Also added `compiler/**/__tests__/**` to `we:vitest.config.ts` include globs: the red tests (and pre-existing dormant `compiler/__tests__/*` suites) weren't being discovered at all before. Full frontierui suite 1254 passing; `tsc -p fui:compiler/tsconfig.json` clean; `check:standards` 0/0.
- **Note (no overlap with #076):** the actual `<component>` ↔ class lowering that shipped lives in *webeverything* (`we:blocks/renderers/component/declarativeComponent.ts`, exercised by #076). This item is the separate *frontierui AST-library, byte-identical round-trip* compiler. The frontierui canonical class shape differs from webeverything's (`const root = this.shadowRoot ?? …` rather than a `#root` field) — the fixture defines frontierui's canon.
- **Leftover spun out → #195:** the `const root = this.shadowRoot ?? …` canonical form silently re-attaches for `shadow="closed"` (closed roots aren't readable via `shadowRoot`); latent until the first `closed` fixture lands.
- **Next (ongoing growth, not blocking):** add fixture pairs one paired rule at a time — closed shadow (#195), `shadow` attribute buckets (delegates-focus/clonable/serializable), ElementInternals (`form-associated`, `default-role`, `preserve-on-move`), template escaping edge cases.
