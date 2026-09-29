---
bornAs: xd34ose
kind: task
status: open
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# probation-build-run finds the lane pool regardless of the cwd it is started from

2026-09-29 ~7:35 PM ET: an operator-launched run of we:scripts/operations/probation-build-run.mjs (from the control clone) started from a scratch dir failed with "could not acquire a lane": lane-pool derived the pool root from the cwd (/private/tmp/.lanes/web-everything, none provisioned). It worked only with cwd ~/workspace plus LANE_POOL_ROOT. The runner must pass an explicit pool root derived from its repo root and surface the lane-pool refusal text in its result detail. Test: a run from an unrelated cwd acquires from the real pool.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
