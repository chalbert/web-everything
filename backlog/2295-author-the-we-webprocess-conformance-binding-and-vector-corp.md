---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["2294"]
dateOpened: "2026-07-06"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: conformance-vectors/webprocess.vectors.ts, frontierui/webprocess/webprocessConformance.ts
tags: []
---

# Author the WE webprocess conformance binding and vector corpus

Add we:conformance-vectors/webprocess.vectors.ts (interaction-script ConformanceVectorSuite over the SynchronousConformanceBinding, exact/deep-equal/predicate matchers per #1816) and register it in we:conformance-vectors/index.ts; add the fui:webprocess/webprocessConformance.ts binding factory. Invariants sourced from we:demos/webprocess-conformance-demo.ts. Third slice of the process cascade under #1294.

## Resolution (2026-07-09)

Two PRs, mirroring the webpolicy conformance slice (#1800) exactly:
- **WE**: `we:conformance-vectors/webprocess.vectors.ts` — an 11-vector `ConformanceVectorSuite` (`standard:
  'webprocess'`) over the clock-free `SynchronousConformanceBinding`, covering the dependency-graph frontier
  (`runnableSteps`), run completion (`isRunComplete`), the tolerance-throttled `effectiveCeiling` (nominal,
  low-tolerance drop, floor-at-L0, per-step override applied before the throttle), the OPEN autonomy ladder,
  and the trust-crossing seam guard (`BrokenStepGraphError` / `ArtefactContractError`) — every invariant
  sourced from `we:demos/webprocess-conformance-demo.ts`. Registered in `we:conformance-vectors/index.ts`.
- **FUI**: `fui:webprocess/webprocessConformance.ts` — the `WebprocessConformanceBindingFactory`, driving the
  relocated `fui:webprocess/{driver,registry}.ts` (#2294) through five seam verbs (`defineSteps` / `complete`
  / `setRecipe` / `defineLevel` / `ceilingFor`) and exposing five observable surfaces (`runnable` / `complete`
  / `ceiling` / `ladder` / `error`); a caught contract violation is exposed via `error` rather than aborting
  the run. Exported from `fui:webprocess/index.ts`. All 11 vectors verified end-to-end against the real
  binding before landing.
