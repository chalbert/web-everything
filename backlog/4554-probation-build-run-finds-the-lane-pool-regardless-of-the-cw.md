---
bornAs: xd34ose
kind: task
status: resolved
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# probation-build-run finds the lane pool regardless of the cwd it is started from

2026-09-29 ~7:35 PM ET: an operator-launched run of we:scripts/operations/probation-build-run.mjs (from the control clone) started from a scratch dir failed with "could not acquire a lane": lane-pool derived the pool root from the cwd (/private/tmp/.lanes/web-everything, none provisioned). It worked only with cwd ~/workspace plus LANE_POOL_ROOT. The runner must pass an explicit pool root derived from its repo root and surface the lane-pool refusal text in its result detail. Test: a run from an unrelated cwd acquires from the real pool.

## Prep

Resolve the pool with `defaultPoolRoot(repoRoot, env)` and pass it explicitly through `LANE_POOL_ROOT`; preserve configured overrides and surface the pool subprocess refusal output. A subprocess probe starts from an unrelated scratch cwd and selects the fixture pool beside the repo.

## Done when

1. **Executable** — `runner=we:scripts/operations/probation-build-run.mjs; npx vitest related "${runner#we:}" --run` passes, including `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs`.
