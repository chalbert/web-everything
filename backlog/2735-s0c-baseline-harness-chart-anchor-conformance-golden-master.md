---
bornAs: xz7aent
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2720"]
scope: ["plateau-app:tests/visual/baselines/", "plateau-app:src/feature-tracker/feature-tracking.baselines.ts", "plateau-app:src/feature-tracker/feature-tracking.golden.test.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S0c · Baseline harness + chart-anchor conformance + golden-master

Drive every rendered=yes state via __setState and export per-state x per-theme x per-viewport baseline PNGs. Missing baseline for a yes case is a hard fail. Define chart-anchor conformance (data-derived scalars, not raw path d) and the whole-screen golden-master harness.

## Deliverable
Extend `__setState` to drive EVERY `rendered=yes` state; export per-state × per-theme × per-viewport baseline PNGs via the #2670 render-baselines harness. RULE: a missing baseline for a `rendered=yes` case is a HARD fail; by-eye skip only for spec. Define chart-anchor conformance (R4): for spark/burn-up/DAG pin data-derived text/aria + computed scalars (done, total, ceiling, gated-pts, node-count) — NOT the raw path `d`. Add the whole-screen golden-master harness (R9): the assembled screen, both themes, vs the frozen baseline.

## FT cases → rendered=yes
Baseline infra for all yes cases (no new render).

## Scope
- `plateau-app:tests/visual/baselines/` (ft-*.png)
- `plateau-app:src/feature-tracker/feature-tracking.baselines.ts`
- `plateau-app:src/feature-tracker/feature-tracking.golden.test.ts`

## Acceptance
Baselines exist for every yes state in both themes + both viewports; the missing-baseline-hard-fail rule is encoded; chart-anchor semantics are documented + machine-checked; the golden-master spot-check is runnable per milestone.
