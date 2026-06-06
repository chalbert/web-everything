---
type: idea
status: active
dateOpened: '2026-06-06'
dateStarted: '2026-06-06'
tags:
  - rendering
  - render-strategy
  - jsx
  - refactor
relatedReport: reports/2026-06-06-render-strategy-axis.md
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-render-strategy, label: Render Strategy Protocol }
---

# Make JSXRenderer.ts an explicit declarative-static render-strategy provider

Refactor `blocks/renderers/jsx/JSXRenderer.ts` (Frontier UI) from an *implicit* render strategy — it quietly hard-codes eager construct-once DOM — into a **registered `declarative-static` provider** behind `CustomRenderStrategyRegistry`, satisfying the `CustomRenderStrategy` contract (`mount`, optional `update`, optional `dispose`) defined by the [Render Strategy Protocol](reports/2026-06-06-render-strategy-axis.md). This is the seam-establishing first step: **no behavior change**, but the default strategy stops being assumed and becomes one named provider among peers, resolved per scope (nearest-scope wins).

This unblocks #078 (cross-strategy lowering) and #079 (the strategy toggle UI), both of which need a real registry to read from.

**Acceptance:** `CustomRenderStrategyRegistry` exists with `declarative-static` registered as the default; `JSXRenderer` mounts through it; existing JSX adapter tests stay green; a mount-once provider (no `update`) is feature-detected correctly. Contracts live in Web Everything (`project-webcomponents.njk` — done); the concrete provider lives in Frontier UI.

## Progress
- **Status:** active — implementation landed and green; ready for review/close.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - New `blocks/renderers/jsx/render-strategy/` layer: `CustomRenderStrategy.ts` (contract — `mount`/optional `update`/optional `dispose`, `RenderInput`/`RenderHandle`/`RenderScope`), `DeclarativeStaticStrategy.ts` (native-first default, mount-once — **no `update`**), `CustomRenderStrategyRegistry.ts` (name-keyed, parent-chain scope resolution = nearest-scope-wins; pre-seeded `renderStrategyRegistry` + `render()` helper), `index.ts` barrel.
  - Re-exported from `blocks/renderers/jsx/index.ts`. **`JSXRenderer.ts` itself untouched** — zero behavior change; the eager construct-once DOM behaviour is now the *explicit* `declarative-static` provider instead of an implicit assumption.
  - Tests: `blocks/__tests__/unit/renderers/renderStrategy.test.ts` (13 tests) — registry resolution (default/by-name/unknown-throws/nearest-scope-wins), declarative-static mount/fragment/string/dispose, mount-once feature-detection, registry-backed `render()`. Full renderer suite 134/134 green; `tsc --noEmit` clean; `check:standards` 0 errors.
- **Next:** none for #077 — fold into the chain: **#078** (lowering compiler) consumes this registry; **#080** finalizes `RenderInput` shape + re-render trigger ownership (the `update`/subscribe contract this default deliberately leaves open).
- **Notes:** Fragment top-level nodes are captured by `nodeType === DOCUMENT_FRAGMENT_NODE` (not `instanceof`) so it survives happy-dom/linkedom realm differences. Full injector-chain scope resolution is deferred — the `parent` pointer is the minimal honouring of nearest-scope-wins, matching the still-unbuilt `CustomChangeStrategyRegistry`.
