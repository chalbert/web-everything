---
kind: story
size: 3
parent: "232"
status: resolved
priority: low
locus: frontierui
graduatedTo: frontierui/compiler/src/component-transform/surfaces.ts
dateOpened: "2026-06-23"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
tags: [component, adapters, compiler, build-tooling, strategy-axis, source-surface, sfc]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# `.component` dedicated-file surface for `<component>` (one-element-per-file SFC authoring)

A deferred opt-in on the **source-surface axis** established by #231 (the
[component-dc](docs/agent/platform-decisions.md#component-dc) rule). Adds an SFC-style `.component` file
holding one `<component>` — Vue `.vue` / Svelte `.svelte` prove this is a real end-state authoring model.

Costliest of the source-surface opt-ins to wire (a new extension every editor / bundler / language-server
has to learn), so it sits at `priority: low` — settled & valid, built **ahead of** a concrete consumer (we
want the full feature surface complete before adoption, not gated on it), just low-value-now. Picked up when
there's a slack window or a team that wants the one-element-per-file model.

- Additive: joins the source-surface axis, no breakage to the #231 baseline.
- Sibling deferred opt-ins under #232: #1629 (per-bundler-native / SWC), #1630 (`tsc`-only transformer).

## Progress (batch-2026-06-26-1806-1825)

Built in the FUI compiler (the source-surface axis impl lives in `fui:compiler/src/component-transform/`,
not WE per the zero-impl rule), so the item's `locus` was corrected `webeverything → frontierui`. Added a
third `Surface` member `component` alongside `html`/`tsx`:

- `fui:compiler/src/component-transform/surfaces.ts` — `Surface = 'html' | 'tsx' | 'component'`; the
  `component` surface matches a `<component>` element directly in markup (same `COMPONENT_RE` as `html` — a
  `.component` SFC file is just markup dedicated to one component, the extension is the only distinction), so
  it lowers byte-identically.
- `fui:compiler/src/component-transform/compile.ts` — `surfaceForId` maps `.component → 'component'` (strips
  `?query`); `ComponentCompilerOptions.surfaces` doc updated. Opt-in: not in the native-first `['html']`
  default; enable with `surfaces: ['html', 'component']`.
- `fui:compiler/src/component-transform/plugins.ts` — `SURFACE_RE` now includes `component` so every bundler
  wrapper (Vite/Rollup/esbuild/webpack) picks up `.component` files.
- `fui:compiler/src/component-transform/STRATEGY-AXES.md` — surface table + opt-in note.
- Tests: `fui:compiler/__tests__/component-transform/surfaces.test.ts` (+ a `user-card.component` fixture,
  byte-identical to the `.html` fixture) — asserts the `.component` surface lowers to the canonical class and
  is opt-in (left alone under the default). 20/20 surface+plugin tests green.

Remaining #232 opt-ins (siblings): #1630 (`ts-patch`/`ttypescript` `tsc`-only transformer), #1629 (per-bundler
SWC-native), plus arbitrary-string scanning — all still deferred.
