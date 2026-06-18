---
type: idea
workItem: story
size: 5
parent: "315"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: tools/trait-enforcer/__tests__/chunk-isolation.build.test.ts
tags: []
---

# Temporal build-chunk isolation dogfood — production-build assertion that per-preset fixtures pull only their traits' chunks

Carved from #898 (batch-2026-06-17): the datetime-picker PRESET shipped (calendar-grid + clock composition, frontierui/demos/datetime-picker), but the #713 build-chunk dogfood — a PRODUCTION-build assertion that a date-only fixture pulls no clock chunk and a time-only fixture pulls no calendar chunk (per-preset trait isolation) — outgrew the preset slice: FUI has no production-build chunk-isolation test harness (the enforcer test only covers manifest generation, not a real vite build), and this overlaps the generic cross-bundler chunk-isolation conformance owned by #720/#722. Build a harness that runs vite build (frontierui locus) on minimal date-only / time-only / datetime fixtures and inspects the rollup output chunk graph to assert each fixture loads only its bound traits' chunks. Coordinate scope with #720/#722 (generic) — this is the temporal per-preset dogfood. locus frontierui.

## Progress (resolved 2026-06-18, batch-2026-06-18 — impl in frontierui)

Built the production-build chunk-isolation harness as a vitest test that runs a **real `vite build`**
(vite 5 `build()` API, `write:false` in-memory, `configFile:false`) per fixture through The Enforcer
(`fui:tools/trait-enforcer/vite-plugin.ts`) and inspects the Rollup chunk graph —
`fui:tools/trait-enforcer/__tests__/chunk-isolation.build.test.ts`. This is the gap #898 named: the
existing `fui:trait-enforcer.test.ts` covers only manifest **codegen** (the pure scan/generate functions),
never a real build.

- **Three fixtures, asserted on the emitted chunks:** date-only (`<input type="date" calendar-grid>`)
  pulls a `fui:blocks/temporal/traits/CalendarGrid.ts` chunk and **no** Clock module; time-only
  (`<input type="time" clock>`) pulls Clock and **no** CalendarGrid; the composed datetime fixture pulls
  **both**, each as its own split chunk (composition doesn't collapse them).
- **Isolation mechanism proven end-to-end:** the per-fixture template drives The Enforcer's usage scan,
  so only used traits enter the generated manifest, so only their `() => import(spec)` thunks reach
  Rollup → only their chunks are emitted. The test verifies the real build honours this, not just that
  codegen emits the thunks.
- **Two build-API gotchas pinned down** (documented inline): (1) the test entry must **invoke** the lazy
  thunks or Rollup tree-shakes the uncalled `import()` away (empty entry chunk); (2) `include: []` must
  be passed to the Enforcer so **only** the per-fixture template drives the scan — its default
  `['demos','src']` walk otherwise pulls every trait used anywhere in the real demos in.
- Scope kept to the **temporal per-preset** dogfood; the generic cross-bundler chunk-isolation
  conformance stays #720/#722. 33 trait-enforcer tests green; FUI `check:standards` 0 errors.
