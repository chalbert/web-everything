---
bornAs: xizryfp
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["2717"]
scope: ["plateau-app:src/feature-tracker/read-model.ts", "plateau-app:src/feature-tracker/forecast.ts", "plateau-app:src/feature-tracker/read-model.test.ts", "plateau-app:src/feature-tracker/forecast.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S1a · Read-model + forecast + bottleneckId (single source of numbers)

Pure logic, unit-tested, no UI: EDGES to blockedBy/blocks, remaining, gatedBy, computeBottleneck(s), findCycle, and bottleneckId owned here (kills the v3 render-order global bug). Forecast vocabulary FC_TXT/FC_CLS + projection-window emitter obeying the honest-forecast rule. Threshold-boundary fixtures prove cutoff correctness.

## Deliverable
Pure logic, unit-tested, NO UI: EDGES → blockedBy/blocks, remaining, gatedBy, computeBottleneck/computeBottlenecks, findCycle. `bottleneckId` is OWNED here as a computed value (R5) — killing the v3 render-order global bug where `BOTTLENECK_ID` was a side-effect of `updateBanner`. Forecast vocabulary `FC_TXT`/`FC_CLS` + the projection-window emitter obeying §0. Feature-tier adapter seam for #2691. Threshold constants (stubbed; DEC re-points in one line). Threshold-boundary fixtures (R6): synthetic inputs straddling each cutoff, driven through the read-model, prove threshold CORRECTNESS not just constant-agreement. Fix + assert the Drain Daemon data honesty.

## FT cases → rendered=yes
Logic behind the F / K / M / S families (no render of its own).

## Scope
- `plateau-app:src/feature-tracker/read-model.ts`
- `plateau-app:src/feature-tracker/forecast.ts`
- `plateau-app:src/feature-tracker/read-model.test.ts`
- `plateau-app:src/feature-tracker/forecast.test.ts`

## Acceptance
read-model + forecast fully unit-tested (gatedBy / computeBottleneck(s) / findCycle / remaining); `bottleneckId` derived here with no render-order dependency; the adapter seam renders coherently at epic-level AND feature-level on one fixture (the #2691 re-point is provably localised); no date emitted for blocked/stalled/cycle; boundary fixtures pass on both sides of every cutoff; every `blk=true` feature has `land='gated'`; a whole-feature date is NEVER computed by dividing total open points by a velocity that already excludes blocked epics — only the unblocked remainder may be projected (denominator-honesty guard carried forward from #2687 per #3125).
