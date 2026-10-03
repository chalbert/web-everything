---
bornAs: xs4ok3k
kind: story
size: 2
parent: "3383"
status: resolved
scope: ["we:scripts/operations/review-job.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/__tests__/review-job.test.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs"]
scopeRationale: "we:scripts/lane-pool.mjs is cited only as evidence and as an explicit no-change file; the fix uses its existing acquire --lane=N branch."
dateOpened: "2026-09-25"
dateResolved: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Concurrent review jobs contend the lane-pool scan lock and defer instead of acquiring

Live on 2026-09-25 (4152 overlay): the review daemon dispatched 7 review jobs in one tick; 2 acquired lanes, 5 reported deferred-no-lane after ~250s because every concurrent acquire waited on the shared lane-pool acquirability scan lock (gave up waiting for the scan lock after 120000ms) while 26 lanes were acquirable. No session was burned (the next tick retries), but it delays reviews by a tick or more. Options: stagger job starts within a tick, have we:skills-src/conveyor/review-daemon.mjs pass one fresh scan result to the jobs, or raise we:scripts/operations/review-job.mjs REVIEW_JOB_LANE_WAIT_MS past the scan time.

## Progress

Premise re-checked on 2026-10-03 against current main. Two mitigations landed after this card was filed (12:59 ET on 2026-09-25):

- `5a023b396` (#4122, 13:32 ET): `acquire` tries the health-watch free-lane list first (`we:scripts/lane-pool.mjs:2034` (freeList), `we:scripts/lib/free-lane-list.mjs:165` (resolveFreeLaneListPath)).
- `ab05eb311` (4172, 19:09 ET): a waiter on another caller's scan lock now gives up at its own `--wait-ms` with a "lock contention" message (`we:scripts/lane-pool.mjs:2974` (acquirableListCached callerDeadlineMs)), not after 120s+grace.

**The contention is still live.** The review-job logs in the review daemon clone (`.operations/review-jobs/*.log` under `~/workspace/wev-review-daemon`) hold 94 "lock contention" deferrals and 6 "scan did not finish" deferrals: 5 on 09-25, 28 on 09-28, 64 on 09-29, 1 on 10-01, 2 on 10-02. Latest: `review-3481` at 2026-10-02T13:56:54Z, `acquireMs: 63651`, "no lane within 60000ms … lock contention … NOT necessarily because all 90 lane(s) are held/dirty". The free list was fresh then (published 13:51:51Z, 23 lanes). So the free-list fast path ran out (its entries were up to ~5 min old and taken), and the job fell back to the shared scan.

Why the scan path stays slow under a burst: every lease claim changes the pool's lease fingerprint. That invalidates the 30s list cache (`we:scripts/lane-pool.mjs:2617`). So N concurrent jobs run up to N back-to-back full scans through one lock, each ~60s under load.

Corrected scope: the fix lives in the review job and the daemon only. `we:scripts/lane-pool.mjs` needs no change and is dropped from scope. The two test files are added.

### Implementation and checkout proof — 2026-10-03

Implemented all seven MVP wiring changes in the four declared files. The daemon preserves its scan's lane numbers and assigns one per dispatch; jobs try the explicit lane at zero wait, log success or the stale-hint fallback, and retain the existing bounded auto-pick and deferral behavior. Numeric capacity callers and session dispatch retain their prior call shapes. No change to the lane pool, wait constant, or session brief.

- **Before, executable regression:** ran the new tests against the original two implementation files from checkout HEAD, restoring the edits afterward. `npx vitest run review-job.test review-daemon.test`: **7 failed, 152 passed**. The failures cover preferred acquisition, fallback, single deferral, dispatch argv, session stripping, array capacity, and the seven-review soak.
- **After, executable regression:** the identical command with the implementation restored: **159 passed across 2 files**. The deterministic soak in `we:scripts/operations/__tests__/review-job.test.mjs` runs **100 seven-review ticks / 700 jobs**, requiring one scan per tick, seven distinct explicit acquisitions, zero auto-picks, and successful review outcomes. Effects are fake: this is dispatch/arc regression proof, not concurrent real-pool or latency proof.
- **Wider verification:** `node we:scripts/verify-lane.mjs` ran **94 test files: 93 passed, 1 failed; 4,779 tests passed, 2 failed**. The two failures are existing parent-process identity cases in `we:scripts/lib/__tests__/gh-app-shim.test.mjs`: expected the parent script basename, received `session:must-not`; expected `sh`, received null. Running that suite alone reproduces both (**70 passed, 2 failed**). Its generated shim reads identity with `/bin/ps`; a direct `/bin/ps -p $$ -o command=` probe here returns **Operation not permitted**. The sandbox does not permit escalation. No test or gate was weakened; the out-of-scope shim files were not edited. Verification remains red.
- **Standards:** `npm run check:standards` completed with **0 errors** (5,572 warnings). `git diff --check` also passes.
- **Live baseline re-observed:** the daemon clone has **752 job logs containing 94 lines with "lock contention"**, matching the recorded baseline. Its current review-job source has **no `--prefer-lane` support**; its latest daemon log reports a dispatch refusal because the clone is eight commits behind main.
- **Live after-proof pending:** this uncommitted checkout is not deployed to the daemon, and this job explicitly prohibits commit/push/PR publication. The daemon clone is outside the writable roots. Thus neither a changed live multi-review tick nor the changed-code replay from that clone can be run here. No live after-count, low-second acquisition claim, or job timings JSON is asserted. Done-when 5 remains unproven; the simulated soak is not a substitute.

## Design

Tactic chosen: **share one scan** (the daemon hands each job a lane number). Reasons:

- The daemon already runs one fresh full scan per tick, right before it dispatches. `we:skills-src/conveyor/review-daemon.mjs:665` (defaultAcquirableLaneCount) calls `we:scripts/conveyor/reconcile-fix-dispatch.mjs:566` (freeLaneNumbers), which returns the lane numbers. It then throws them away and keeps only the count.
- The fix-dispatch path already does exactly this. It pre-assigns one free lane per fix with `lanes.shift()` (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:1215`), and the agent acquires `--lane=N` (header at `we:scripts/conveyor/reconcile-fix-dispatch.mjs:30`). Same pattern, no new mechanism.
- `acquire --lane=N` touches only that lane. It never takes the shared scan lock (`we:scripts/lane-pool.mjs:1876` explicit branch). It still re-checks dirty/ahead and refuses a live lease (`we:scripts/lane-pool.mjs:1911`, `we:scripts/lane-pool.mjs:1928`). So a stale hint costs a refusal, never a clobbered lane.
- Rejected: **raise the wait.** Each sibling claim invalidates the cache, so the 7th job waits for ~6 serial scans. No single constant covers that. **Stagger.** Same serial-scan cost, and it slows every tick.

Behaviour:

1. `runReviewTick` (`we:skills-src/conveyor/review-daemon.mjs:218`): `acquirableLanes` may now return an array of lane numbers or a number. The count is `Array.isArray(x) ? x.length : Number(x)`; the cap logic is unchanged. When it is an array, the i-th entry of `dispatchable` gets `preferLane: lanes[i]` in its `dispatch(...)` call. When it is a number (every existing test), the call object is unchanged (no `preferLane` key).
2. New `defaultAcquirableLaneNumbers({ repo })` next to `defaultAcquirableLaneCount` in `we:skills-src/conveyor/review-daemon.mjs`. It returns `freeLaneNumbers({ lanePoolRepo })`. `buildCliDaemonEffects` (`we:skills-src/conveyor/review-daemon.mjs:760`) wires it as `acquirableLanes`. Keep `defaultAcquirableLaneCount` exported (other callers/tests may use it).
3. `dispatchReviewByMode` (`we:scripts/operations/review-job.mjs:578`): in `session` mode, drop `preferLane` before calling `dispatchReview` (the session brief stays lane-less).
4. `dispatchReviewJob` (`we:scripts/operations/review-job.mjs:517`): new `preferLane` option. If it is a positive integer, append `--prefer-lane=<n>` to the spawned argv. Otherwise argv is unchanged.
5. CLI (`we:scripts/operations/review-job.mjs:585`): parse `--prefer-lane` and pass it to `runReviewJob` as `preferLane` (positive integer or `null`).
6. `runReviewArc` (`we:scripts/operations/review-job.mjs:404`): when `preferLane` is set, first call `io.acquireLane({ laneRepo, slug, actorId, lane: preferLane, waitMs: 0 })`. On success use it. On failure, log `preferred lane-<n> not taken (<error>) — falling back to auto-pick` and run today's call unchanged (`io.acquireLane({ laneRepo, slug, actorId, waitMs: laneWaitMs })`). `timings.acquireMs` covers both tries. Deferral logic is unchanged.
7. `createReviewJobIo().acquireLane` (`we:scripts/operations/review-job.mjs:247`): when `lane` is a positive integer, add `--lane=<lane>` to the argv. Everything else is unchanged.

## MVP

Items 1–7 above. No change to `we:scripts/lane-pool.mjs`, `REVIEW_JOB_LANE_WAIT_MS`, or the session brief.

## Test plan

Vitest. In `we:scripts/operations/__tests__/review-job.test.mjs`:

- `preferLane: the job acquires the daemon-assigned lane first and never auto-picks when it wins` — fake `acquireLane` records calls; expect exactly one acquire call with `{ lane: 7, waitMs: 0 }` and the loop runs in that lane.
- `preferLane: a lost preferred lane falls back to the bounded auto-pick` — first call returns `{ lanePath: null, error: 'lane-7 is held' }`, second succeeds; expect two calls, the second with no `lane` and `waitMs: REVIEW_JOB_LANE_WAIT_MS`, and outcome is not `deferred-no-lane`.
- `preferLane: both tries failing still defers exactly once (lane-deferrals:1)`.
- `no preferLane: a single auto-pick acquire, unchanged` — call has no `lane` key.
- `dispatchReviewJob passes --prefer-lane=<n> to the spawned job only when preferLane is a positive integer` — fake `spawnJob` captures argv; check `5` → flag present, `null`/`0`/`'x'` → absent.
- `dispatchReviewByMode session mode never forwards preferLane to dispatchReview`.

In `we:skills-src/conveyor/__tests__/review-daemon.test.mjs`:

- `acquirableLanes returning lane numbers caps by their count and hands each dispatch a distinct preferLane` — `acquirableLanes: () => [4, 9]`, three reviews owed; expect two dispatches with `preferLane` 4 and 9, one deferred.
- `acquirableLanes returning a number keeps the dispatch call shape unchanged (no preferLane)`.

## Proof plan

Live case: the review daemon clone at `~/workspace/wev-review-daemon`.

- **Before** (already captured): counting "lock contention" lines across that clone's `.operations/review-jobs/*.log` gives 94; latest `review-3481` at 2026-10-02T13:56:54Z with `acquireMs: 63651` and `deferred-no-lane`.
- **After**: once the daemon self-syncs the change, wait for a tick that dispatches ≥3 reviews (its `.conveyor/review-daemon.log`: "dispatched N"). For each job log from that tick, show the `--prefer-lane` acquire succeeding (or the fallback line), `acquireMs` in the low seconds, and no new "lock contention" lines. Record the before/after counts and one job's `timings` JSON in this card.
- If no multi-review tick happens soon, replay: run `node we:scripts/operations/review-job.mjs run --pr=<open PR> --repo=chalbert/web-everything --prefer-lane=<a lane from the pool's free-lane list>` from the daemon clone, and show the single explicit acquire in its log.

## Done when

1. **Executable** — `npx vitest run review-job.test review-daemon.test` passes, with the new tests in `we:scripts/operations/__tests__/review-job.test.mjs` and `we:skills-src/conveyor/__tests__/review-daemon.test.mjs` named above. They fail before the change (no `preferLane` support) and pass after.
2. The review daemon passes a distinct free lane number to each review job it dispatches in a tick, taken from the scan it already runs.
3. A job acquires its assigned lane with `--lane=N` first, and falls back to today's bounded auto-pick only if that lane is gone.
4. Session-mode dispatch and every caller that passes a numeric `acquirableLanes` behave exactly as before.
5. The live proof above is recorded in this card: a multi-review tick with no "lock contention" deferrals.

## Follow-ups

- Before closing, rerun `node we:scripts/verify-lane.mjs` where parent-process inspection is permitted, then capture the specified live multi-review tick after deployment. Keep the card open while these proof requirements remain outstanding; the requested resolve command is conditional on being done.

- The scan-path weakness remains for other auto-pick callers: each claim invalidates the shared list cache, so a burst of auto-pick acquires runs serial full scans. A fix inside `we:scripts/lane-pool.mjs` (e.g. drop only the claimed lane from the cached list instead of invalidating it all) would help every caller. File it only if non-review callers show the same deferrals.
- 6 deferrals were "scan did not finish" (the scan itself overran 120s). That is a scan-speed issue, separate from this card.
