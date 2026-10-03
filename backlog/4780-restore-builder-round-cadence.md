---
bornAs: xbrndtm
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/verify-daemon.mjs", "we:skills-src/conveyor/__tests__/verify-daemon.test.mjs", "we:scripts/lib/phase-timer.mjs", "we:scripts/lib/planning-snapshot.mjs", "we:scripts/lib/__tests__/planning-snapshot.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/scope-lease-collect.mjs", "we:scripts/conveyor/soak/breaks/builder-round-bound.mjs", "we:scripts/conveyor/soak/breaks/builder-round-bound.soak.test.mjs", "we:scripts/conveyor/soak/breaks/fixtures/builder-round-tools.cjs"]
dateOpened: "2026-09-30"
tags: []
---

# Restore builder round cadence and expose phase costs

Measure on top of PR #3176 in lane-58. The configured 120-second builder interval was an unconditional
sleep AFTER work. A 180-second tick therefore caused a 300-second start interval. This is confirmed in
we:skills-src/conveyor/verify-daemon.mjs, the loop imported by the builder. The builder opts into
start-to-start pacing: subtract work from the sleep; an overrun starts the next round immediately,
without concurrent rounds or replaying a backlog of missed ticks. Other callers keep their existing cadence.

## Observed baseline

The requested real command was run against the live local state:
`node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run --json`.
An inherited Node preload counted child-process starts/completions across descendants, including GitHub.
No manual fetch, merge, commit, push, builder restart or deployment was performed.

The unmodified first probe failed after 29.2 seconds in tick-core: creating the shared lane-list lock
was denied by the sandbox. The next probe used the existing `LANE_POOL_LIST_CACHE_TTL_MS=0` setting
on both sides of the comparison, preserving all acquirability checks while avoiding that lock.
It reached the builder's PR read and then failed because DNS for GitHub is blocked here.
These are measured partial real rounds, not successful production rounds or a production recovery claim.

The final matched comparison ran sequentially in this checkout, with the installed builder's
`OPERATION_RUNS_DIR` and `--max-concurrent=3`, after the broad gate finished. The baseline restored the
original planning implementation temporarily while retaining only additive timing instrumentation;
the final working changes were restored in a `finally` block before the after probe. Both used the same
cache-disabled setting and both stopped at the same blocked PR read.

| Phase / work | Before | After |
| --- | ---: | ---: |
| Partial round to failed PR read | 70.836 s | 26.959 s |
| tick-core | 63.781 s | 22.459 s |
| state read (inclusive) | 32.656 s | 12.471 s |
| dispatch-plan (inclusive) | 24.411 s | 8.992 s |
| pool status scans | 3 / 17.295 s | 1 / 3.106 s |
| scope collector calls (inclusive of status) | 2 / 19.520 s | 1 / 2.526 s |
| acquirable scans | 2 / 12.124 s | 1 / 5.166 s |
| build-queue subprocess reads | 2 / 10.946 s | 1 / 3.796 s |
| prepare-status reads | 39 / 4.037 s | 39 / 2.495 s |
| run-store reads (four phases) | 2.734 s | 1.742 s |
| git subprocesses | 511 | 254 |
| gh subprocesses | 45 | 44 |
| all subprocess starts, including background work | 590 | 321 |

Inclusive timings overlap; do not add parent and child times. Live pool activity and host load changed:
the reduction in duplicate calls is deterministic, but the entire wall-time difference cannot be
attributed to this code. An earlier comparison with the default lane run store measured tick-core at
39.892 → 31.343 seconds before the additional build-queue sharing. Its near-zero run-store times were
not representative of the installed builder. A later probe alongside the broad gate took 52.270 seconds,
showing the effect of concurrent load on wall time.

There were two Claude agents listings in the final matched runs (prepare liveness and tick-core).
The 39 prepare-status requests failed quickly on blocked DNS; this cannot establish their latency when
GitHub is reachable. Orphan adoption, infra retry and hold-routing effects do not execute in dry-run;
they cannot be assigned measured production costs here. Draft recovery was not reached because the
preceding PR read failed. No git fetch or merge was observed in either matched trace.

The builder directly calls tick-core, not the separate tick-once mutex/throttle path. Existing mutex and
throttle files dated September 24 are not evidence that this builder waited on them. The live log also
contains a separate 134.260-second self-sync rebuild smoke; it is a real additional delay on that rebuild,
not evidence of the cost of every tick. Outer loop elapsed time now includes auth/self-sync work.

## Change and safety

we:scripts/lib/planning-snapshot.mjs shares successful JSON from read-only lane status, acquirable list,
build-queue, and scope observations within one private planning directory. we:skills-src/conveyor/build-dispatch-daemon.mjs
creates it for a single tick-core invocation and deletes it even on failure. Exact collector arguments
(including repository selectors) distinguish observations. Failures are not cached as empty success.
The snapshot environment is passed only to the planning subprocess, never to actual dispatches.
Mandatory acquire-time and pre-launch safety checks retain fresh reads. No timeout was raised.

Scope collection in planning uses its existing read-only `--no-track-attempts` option. Planning consumes
predicted/observed scope, not the advisory breach-attempt counter. The standalone observer's counter
behavior is unchanged.

Tick JSON now includes `timings.totalMs`, per-effect `timings.phases` (milliseconds and invocation count),
the nested tick-core substeps, and live `timings.loop` (whole wrapped round and configured interval).
Errors retain completed effect timings. Monotonic time measures elapsed work; `at` remains completion time.

## Verification

The required `node we:scripts/verify-lane.mjs` was attempted; its marker write was denied under the
read-only git directory. Its supported marker-free equivalent, `node we:scripts/verify-lane.mjs run`,
then ran the same selected gate with a private temporary admission pool: 14,950 tests total,
14,909 passed, 22 failed, 19 skipped, and one unhandled localhost `listen EPERM` error.
The gate remains RED. No test was skipped, weakened or retargeted to hide these failures.

Failures were in seven unchanged test files: process-table probes (`ps EPERM`, including parent-command
attribution and detached job liveness), localhost socket binding, and protected user transcript/drain-lock
writes, plus a transcript-path assertion returning null (its persistence helper writes to user storage,
but that assertion did not expose the underlying write error). The prior PR's card records the same count
and categories of sandbox failures. This patch does
not attempt to change those unrelated runtime contracts to accommodate the sandbox.

`npm run check:standards` passed with zero errors. The final targeted timing, cadence, builder and tick-core
suite passed 390 tests. The full CLI soak in we:scripts/conveyor/soak/breaks/builder-round-bound.mjs uses
three rounds with a simulated slow 90-lane pool, isolated stores and fixture executables. Each round
must return within 8 seconds and perform exactly one status, scope, acquirable and build-queue read;
new rounds must read again. The pre-fix code took 11.854 seconds and made three status reads and two
reads of each other collector; the fixed rounds took 6.394, 6.136 and 5.827 seconds, with 26 fixture
subprocess calls and seven gh calls each. The final Vitest soak also passed. This is a controlled regression bound,
not a promise that arbitrary live network/host delays fit under 120 seconds.

The full requested successful before/after real dry-run remains blocked by network restrictions.
The matched partial-round artifacts are in temporary files named `builder-matched-before` and
`builder-matched-after` (JSON/error/child trace) under the system temporary directory. No shared agent
documentation was edited, and no change was committed, pushed or deployed.

## Follow-ups

- Run the exact real dry-run command with network access after review. Record full before/after phase
  timing and foreground/background subprocess counts; this sandbox cannot complete the required remote read.
- Observe live tick logs after deployment, particularly prepare status, draft recovery, orphan adoption,
  infra retry and the difference between outer loop and inner tick time. Do not attribute an unmeasured
  phase to the original 5–10-minute intervals.
- Compare collector call counts as well as wall time: active lanes and host load change between live probes.
- Keep these testing lessons in this card, not shared agent documentation.
