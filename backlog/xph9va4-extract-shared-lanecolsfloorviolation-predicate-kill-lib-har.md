---
kind: story
size: 2
parent: "2804"
status: open
dateOpened: "2026-08-02"
blockedBy: ["2810"]
scope:
  - plateau-app:scripts/dev/fidelity-render.mjs
  - plateau-app:tests/visual/geometry-theme.ts
tags: [plateau-loop, conveyor, ui-fidelity, plateau-app, slice-uifg, tech-debt]
---

# Extract shared laneColsFloorViolation predicate — kill lib/harness grid-collapsed floor drift

The #2810 lib (`plateau-app:tests/visual/geometry-theme.ts`) re-implements the `grid-collapsed` floor
inline in `assertMultiLaneGrid` with default `minCols = 2`, while the #2809 harness grades the same floor in
`gradeReport` (`plateau-app:scripts/dev/fidelity-render.mjs`) against the contract's per-regime `minLaneCols`
of **3**. Two copies of one rule with different default floors is a latent divergence — safe today only
because the #2811 spec passes `minCols` explicitly. Fix: extract one shared `laneColsFloorViolation(laneCols,
minCols)` predicate into the harness and import it in the lib, the same reverse-extraction the lib already
uses for `cellGeometryViolations` and `themeCascadeViolations`, so lib and harness can't drift on the default.

## Provenance

Introspection capture from the independent review of plateau-app PR #133 (the #2810 geometry+theme lib). Not
a live defect — a DRY hazard surfaced while the reviewer traced why the lib and the harness both own a
`grid-collapsed` code path. Filed so the third shared predicate lands the same way the first two did.
