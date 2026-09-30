---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3028's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3028's review (reviewed head `f396c34f46a3968ac8d26f32ebe77ddb73413ed0`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/operations/__tests__/probation-build-run.test.mjs:205` — Add to we:build-dispatch-hold-router.test.mjs: `classifyHoldReason('worker-declined: spec already done on main: commit abc1234')` equals `{route:'out-of-scope', commit:null}`. Also assert `route` and `commit` in the runner test.
2. `we:scripts/operations/build-dispatch-hold-route-land.mjs:165` — Give the standalone section its own body text and assert it in the card-text tests.
3. `we:scripts/operations/probation-build-run.mjs:505` — Run every post-worker tool and the checker from a pristine, read-only snapshot of the base (a `git archive` or worktree at `baseSha`, with its own node_modules) and pass the lane only as cwd. Add a test in which the fake worker plants an ignored `node_modules` file and the resolve or checker step must not execute it. A lint that flags `weRoot: lanePath` would also catch this.
4. `we:scripts/operations/probation-build-run.mjs:556` — Place the hold and reserve the lease only after the gated commit succeeds (or immediately before `openPr`), or release them in the failure path. Add a test that a failure at commit, gate or PR leaves no hold and no lease.
5. `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:146` — Add a deterministic isolation test returning a separately registered daemon clone outside the launch checkout, asserting refusal and unchanged snapshots.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
