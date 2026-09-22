---
bornAs: xc2ggrf
kind: story
size: 8
parent: "3443"
status: open
blockedBy: ["3901", "3895", "3897", "3911", "3906", "3908", "x9ytnq8", "xa9fkfz", "x8v2xw9"]
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/__tests__/runner.test.mjs", "we:skills-src/conveyor/__tests__/runner-shutdown-live.test.mjs", "we:skills-src/conveyor/supervisor.mjs", "we:skills-src/conveyor/__tests__/supervisor.test.mjs", "we:scripts/conveyor/tick-once.mjs", "we:scripts/conveyor/__tests__/tick-once.test.mjs", "we:scripts/conveyor/tick-bookkeeping.mjs", "we:scripts/conveyor/__tests__/tick-bookkeeping.test.mjs", "we:scripts/operations/__fixtures__/shared-tick-driver.mjs", "we:scripts/operations/__tests__/shared-tick-two-drivers.test.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate tick-core + supervisor/runner crash-loop and idle-with-queue alerting hardening from lane/mechanical-dispatcher to main

Bug fixes and alerting layered ON TOP of the new we:skills-src/conveyor/supervisor.mjs and we:skills-src/conveyor/runner.mjs reconcile-pass wiring (the two sibling slices in this group) -- land after both, since several branch commits interleave edits to we:scripts/conveyor/tick-core.mjs together with we:skills-src/conveyor/runner.mjs and we:skills-src/conveyor/supervisor.mjs and do not cleanly separate. Covers: the durable build-guard floor that never expired and permanently inflated the building count (#3403), heartbeating the singleton lease mid-pass rather than only after the tick (#3404), stopping dispatchPass own guard bookkeeping from suppressing its own dispatch (#3416), backing off a repeated idle-stop respawn distinct from a stand-down (#3406), and supervisor out-of-band alerting for crash-loop plus idle-with-queue (#3398). Tests: we:scripts/conveyor/__tests__/tick-core.test.mjs (new), we:skills-src/conveyor/__tests__/runner.test.mjs, we:skills-src/conveyor/__tests__/supervisor.test.mjs.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/conveyor/tick-core.mjs we:skills-src/conveyor/runner.mjs we:skills-src/conveyor/supervisor.mjs` reports no diff not already accounted for by the two sibling slices above, and `we:scripts/conveyor/__tests__/tick-core.test.mjs` plus the runner/supervisor test suites pass on `main`.
2. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before both `blockedBy` slices above.

## Step 0 re-plan (2026-09-22)

**Re-scoped to the runtime-core slice (E3 in the plan), the last code slice.** Since this card was filed, the branch's `we:skills-src/conveyor/runner.mjs` diff grew to +918 lines and now imports 8 new modules, so it no longer fits the original 3-file scope. The scope is now every remaining runtime-core file: the runner, supervisor, `we:scripts/conveyor/tick-core.mjs`, `we:scripts/conveyor/tick-once.mjs`, `we:scripts/conveyor/tick-bookkeeping.mjs`, `we:scripts/operations/host-process-sample.mjs`, `we:scripts/lib/gh-throttle.mjs`, `we:scripts/conveyor/lease-reaper.mjs`, the readiness diffs, the land path (`we:scripts/pr-land.mjs`, `we:scripts/lib/forge-land-provider.mjs`), the driver watchdog and mode, the vitest setup, and the small leftover op diffs. The old blockers #3483 and #3486 are resolved; it now waits on 3901, 3895, 3897, 3911, 3906 and 3908. Faithful port, no behaviour change. Before any continuous loop runs on main, validate with one manual tick (same caution as #3437). Size 8: split it with /split before dispatch if the design pass finds a clean seam. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22).

### #3487 (S4) — runtime core (size 8)

**Blockers:** #3901, #3895, #3897, #3911, #3906, #3908, and slices S1, S2, S3.
- runner imports `we:scripts/conveyor/queue-scope.mjs` (#3911); `we:scripts/operations/action-store.mjs`, `we:scripts/operations/action-dispatch.mjs`, `we:scripts/operations/action-ground-truth.mjs`, `we:scripts/operations/tick-mutex.mjs` (#3901); `we:scripts/operations/telemetry-store.mjs` (#3895); `we:scripts/operations/host-process-sample.mjs` (S3); `we:scripts/conveyor/reconcile-core.mjs` + review-wrapper wiring `02d9af300` (#3908).
- `we:scripts/conveyor/tick-once.mjs` / `we:scripts/conveyor/tick-bookkeeping.mjs` import `coordination-root`, `session-role`, `tick-throttle`, `action-record` (#3901).
- dispatch behaviour parity needs #3906 / #3897 on main.

**Files (incl. tests):**
- `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/__tests__/runner.test.mjs`, `we:skills-src/conveyor/__tests__/runner-shutdown-live.test.mjs`
- `we:skills-src/conveyor/supervisor.mjs`, `we:skills-src/conveyor/__tests__/supervisor.test.mjs`
- `we:scripts/conveyor/tick-once.mjs`, `we:scripts/conveyor/__tests__/tick-once.test.mjs`
- `we:scripts/conveyor/tick-bookkeeping.mjs`, `we:scripts/conveyor/__tests__/tick-bookkeeping.test.mjs`
- `we:scripts/operations/__fixtures__/shared-tick-driver.mjs`, `we:scripts/operations/__tests__/shared-tick-two-drivers.test.mjs`

(Moved out by ruling: `we:package.json` `gen:dispatch-routing-table` script → #3897; `we:scripts/operations/__fixtures__/load-analysis/runner-audit.jsonl` → #3899; `we:scripts/lane-pool.mjs` dropped.)

**Carries:** #3398 supervisor crash-loop / idle-with-queue alerting (`5f38cb023`), #3416 (`340fb3268`), #3404 mid-pass lease heartbeat (`d9127968a`), #3406 idle-stop respawn backoff (`494742501`), SIGTERM lease release (`c081e1650`), watchdog schedule (`14e0a7249`), reconcile-pass wiring (`055db567e`, `5eabbb39f`, `21da24f63`), telemetry wiring (`fe2d96ac6`, `e539e430e`, `7ee2ba6f0`), queue scoping (`2acd6c567`), POC-branch sync (`b4be77b3b`), shared-state tick slice 1 (`0c4167849`), tick-once CLI (`bfa0e2c0d`), #3720 item-pull (`c32f875e8` runner half).

**Why this cannot be split further:** `we:scripts/conveyor/tick-once.mjs` imports `runTickOnce` / `createTickCoordination` / `buildCliTickEffects` / `makeCliTickOnce` from runner; `5f38cb023`, `494742501`, `c081e1650`, `14e0a7249`, `3380ca8cd` each edit runner + supervisor; `0c4167849` spans runner + tick-bookkeeping + shared-tick fixtures + `we:vitest.setup.ts` (the setup itself goes earlier, in S1).

**Merge notes** (freshness rule — route through `origin/lane/mechanical-dispatcher-catchup`: step 1 `git merge-file catchup <659744301> ff1618065`, step 2 `git merge-file origin/main 5ab140f50 <step1>`):
- `we:skills-src/conveyor/runner.mjs` — 0 conflicts via catchup (direct 3-way from `ca7e68b71`: 4). Main's `9c828db99`, `72f0329e0`, `f211888d0`, `9a9629972`, `efa134d33` all come through.
- `we:skills-src/conveyor/__tests__/runner.test.mjs` — 0 conflicts via catchup (direct: 4); main's `5dcc14d4e` (#3877 runner-lock keyed lease) comes through.
- `we:skills-src/conveyor/supervisor.mjs` (+test), tick-once, tick-bookkeeping, shared-tick fixture/test, `we:skills-src/conveyor/__tests__/runner-shutdown-live.test.mjs` — main untouched / new; apply as-is. `we:skills-src/conveyor/runner-lock.mjs` changed on main only (#3877); every name runner/supervisor import from it exists on main.

#### Manual-tick check (after this slice lands; run from the primary checkout on `main`)

1. **Preconditions.** `node we:scripts/conveyor/driver-status.mjs` and `/runner-status` show no resident runner, no live runner lease, no tick in flight. `we:scripts/conveyor/tick-once.mjs` never takes the runner lease — it relies on the tick mutex, which an older resident runner does not honour — so any running runner must be stopped first, or this is the #3437 double-dispatch setup again.
2. **Plan-only run:** `node we:scripts/conveyor/tick-once.mjs --verbose` → exit 0 and a decision trace; `git status --porcelain` and `.conveyor/` unchanged; `node we:scripts/lane-pool.mjs status` shows no new leases.
3. **Fence the test tick:**
   - `node we:scripts/readiness/dispatch-pause.mjs set --kinds=build,prepare,prepare-decision,investigate,fix,ci-heal`
   - write `we:.conveyor/queue.json` with ONE known item that has an open `review:pending` PR, then `node we:scripts/conveyor/queue-scope.mjs set` — review/reconcile passes then touch only that PR.
4. **One real tick:** `node we:scripts/conveyor/tick-once.mjs --apply --verbose --min-interval-ms=0` → exit 0.
5. **Double-dispatch probe (#3437):** run the same command again immediately. Safe means ALL of:
   - at most one review session for that PR in the agent listing (the second tick binds the existing session by name);
   - `review-round:<N>` label unchanged;
   - exactly one dispatch action record for that PR;
   - no lane lease taken;
   - newest `.conveyor/decision-trace/` entry shows every spawn kind held `dispatch-paused`;
   - `driver-status` reads as a finished/once run with its lease released;
   - `node we:scripts/readiness/heavy-admission.mjs status` shows `staleWaiting: []`.
   Then run the resident path once: `node we:skills-src/conveyor/runner.mjs --once --json` — same observations; it must exit and leave no lease.
6. **Widen one step at a time.** Unpause one kind (`we:scripts/readiness/dispatch-pause.mjs set --kinds=` minus `build`) and repeat steps 4–5. Then `node we:scripts/readiness/dispatch-pause.mjs clear` and `node we:scripts/conveyor/queue-scope.mjs clear`. Only then start a continuous loop via `/conveyor`.

### Designer rulings (2026-09-22)

- **Split:** #3487 keeps only the runtime core (S4). x9ytnq8 (test setup, heavy-command admission), xa9fkfz (dispatch gate, tick-core core) and x8v2xw9 (land path, gh-throttle, lease-reaper) land first. `we:scripts/operations/open-pr.mjs` moved to #3903; `we:scripts/operations/wake.mjs` and `we:scripts/operations/explore-io.mjs` to #3906; the `we:package.json` script to #3897; the load-analysis runner-audit fixture to #3899; `we:scripts/lane-pool.mjs` dropped (main already has everything the branch has).
- Heavy-admission: main's reaper is the base, plus the branch's additions and status shape; the branch's second `pruneStaleWaiting` call is dropped.
- **Landing order:** #3908 makes the blocking mechanical review path the default, and main's runner has no heartbeat for it until this slice lands. Between #3908 landing and this slice landing, the conveyor runner must not run continuously on main (pause it, or land the two back to back).
