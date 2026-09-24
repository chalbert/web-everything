---
kind: story
size: 3
parent: "3383"
status: resolved
scaffoldedBy: "session-3383-lane-guard"
dateScaffolded: "2026-09-23"
scope: ["we:scripts/lib/lane-pool-paths.mjs", "we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool-vitest-real-root-guard.test.mjs"]
dateOpened: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# tests never touch the real lane pool: guard + fix dispatch-plan/conveyor-state real-subprocess tests

PR #2542's O(lanes×heads) `git cherry` loop in `we:scripts/lane-pool.mjs` was multiplied because
`we:scripts/conveyor/__tests__/dispatcher-fixture-harness.test.mjs` and
`we:scripts/readiness/__tests__/conveyor-state.test.mjs` (its "CLI --json flush" test) spawned the
real `we:scripts/readiness/dispatch-plan.mjs`/`we:scripts/readiness/conveyor-state.mjs` CLIs with no
pool-root override, so they shelled the REAL `we:scripts/lane-pool.mjs list --acquirable`/`status
--json` against the real `~/workspace/.lanes` pool. 13 concurrent lane suites hammered it at once —
load average 70-88, drain/review/tests stalled over an hour. A concurrent sibling item (#x7xv2xt,
already landed) fixed those two specific tests at the source (fixture mode / `--free-lanes` /
`--no-lane-pool`, plus `we:scripts/lib/bounded-child.mjs`'s timeout+reaper for
`we:scripts/readiness/dispatch-plan.mjs`'s own spawns). This item adds the STRUCTURAL BACKSTOP
#x7xv2xt didn't: `guardedPoolRoot` (throws when `VITEST` is set and no `LANE_POOL_ROOT` override / no
explicit opt-out was given), which `we:scripts/lane-pool.mjs` now resolves through instead of the bare
`defaultPoolRoot` — so a FUTURE test that forgets the fixture-mode flags still fails loudly instead of
quietly hammering the shared pool.

## Done when

1. **Executable** — `node we:scripts/lane-pool.mjs status --json` run with `VITEST=true` and no
   `LANE_POOL_ROOT` set exits non-zero with a refusal message (was: silently resolved+ran against the
   real pool). The same invocation with `LANE_POOL_ROOT=<tmp>` or
   `WE_ALLOW_REAL_LANE_POOL_IN_TESTS=1` succeeds.
2. `npx vitest run we:scripts/__tests__/lane-pool-vitest-real-root-guard.test.mjs
   we:scripts/__tests__/lane-pool-root-and-shallow.test.mjs` passes (RED→GREEN proof against the real
   root, plus the pure resolver's own unit test unaffected).
