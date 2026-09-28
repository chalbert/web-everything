---
kind: story
size: 3
status: open
scope: ["plateau:src/wip/wip-read.ts", "plateau:src/wip/wip-model.ts", "plateau:src/wip/wip-view.ts", "plateau:src/wip/types.ts"]
dateOpened: "2026-09-28"
tags: []
---

# /wip shows the daemons and what they are really doing

**Scope.** A new "Daemons" panel on /wip, additive to the existing runner chips
(plateau:src/wip/wip-read.ts's `readRunners`/`readDrainRunner`) and machine-health strip — reuse those readers
where they overlap rather than re-fetching the same data twice.

**Problem.** The operator has no single place to see whether the build-dispatch daemon's own "N building"
status text matches what is REALLY in flight, or why work is held. Confirmed live today:
~/workspace/.operations/coordination/build-dispatch-daemon.log's JSON status lines carry `status` (the
tick-core's own "conveyor · N building · ... · N queued" text), `inFlight`, `dispatched`, `hold` (array of
`{num, lane, rule, reason}`, e.g. `"7 builds in flight (cap 4)"`) and `freeze` — these can and do diverge from
each other.

**Panel content, each source confirmed live:**
1. Resident launchd daemons up/down — `launchctl list | grep -E 'com\.(we|plateau)\.'` (16 entries today:
   build-dispatch, verify, review, fix-dispatch, health-watch, lease-reaper, wip-publisher, drain-daemon, the
   per-repo lane-pool-health-watch/parked-pr-conflict-watch daemons, conveyor-pass-daemon.merge-orphan-sweep).
2. Build-dispatch: real in-flight builds (`inFlight`/`dispatched`) vs. the tick-core's own "N building" count,
   plus the `hold[]` reason(s) — tail the last JSON line of
   ~/workspace/.operations/coordination/build-dispatch-daemon.log.
3. Verify daemon's queue — `node we:scripts/operations/run.mjs heavy-queue --json` (the host-wide admission pool
   verify-lane runs share), not the plain-text tick log (~/workspace/.operations/coordination/verify-daemon.log
   has no JSON/queue-depth field).
4. Live daemon-started agent sessions — `claude agents --json`, filtered to entries whose pid is actually
   alive; reuse plateau:src/wip/wip-read.ts's existing `readRunningNow` (WE's `live-state`/`live-work` RUNNING
   section) instead of a second, parallel read where the two already cover the same sessions.
5. The operator's own hand-briefed workers — no cheap live source found; leave an explicit "not shown, no
   cheap source" note in the panel rather than fake a row.

**Risks.** `launchctl list` and the daemon log are laptop-local (no relay yet) — same constraint as the rest of
/wip; degrade this panel the same way (`degraded` source) rather than block the page. Log tailing must bound
the read (last line only) — the file is large (build-dispatch-daemon.log is ~280KB and growing).

**Test plan.** Unit-test each new reader with injected `exec`/`readFileSync` fakes (mirrors `readRunners`'s own
seam); a shape-mismatch (stale daemon build) degrades only this panel, never the rest of the snapshot. Add a
`wip-view` render test for the panel's up/down + in-flight-vs-reported-mismatch + hold-reason display.

**Tasks.** (1) add the four readers to plateau:src/wip/wip-read.ts, each in its own `attempt()` boundary;
(2) extend plateau:src/wip/types.ts with the panel's wire shape; (3) render it in plateau:src/wip/wip-view.ts;
(4) wire plateau:src/wip/wip-model.ts if any derived state is needed; (5) tests; (6) `npm test` in plateau-app.

**Proof plan.** At the same moment: the panel's daemon up/down list must match `launchctl list | grep com.we`
(plus `com.plateau`), and its build-dispatch row must match that moment's last line of
~/workspace/.operations/coordination/build-dispatch-daemon.log.

## Done when

1. **Executable** — `npx vitest run plateau:src/wip/wip-read.test.ts plateau:src/wip/wip-view.test.ts` passes
   with cases for the new daemons-panel readers (launchd up/down, build-dispatch in-flight-vs-reported +
   hold reason, verify heavy-queue, live agent sessions) and their render.
