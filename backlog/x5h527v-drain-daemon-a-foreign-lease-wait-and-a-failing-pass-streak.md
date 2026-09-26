---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["xr05jjl"]
scope: ["plateau-app:tools/drain-daemon/"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Drain daemon: a foreign lease wait and a failing-pass streak are bounded and notify the operator (flow gaps, plateau drain-daemon)

plateau-app drain daemon: waiting on a foreign drain lease past a bound notifies once per holder episode; consecutive failed passes (incl. duplicate-NNN) hit a cap that escalates once per streak, still retrying at the ceiling. Clears drain-land lease-arbitration, pass-running, duplicate-nnn-parked (xb4yerj, xwo3j0l).

## Slice

Sliced by FILE from the four flow-checker gap cards (xwuof33, xb4yerj, xwo3j0l, x56qzx8), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- drain-land lease-arbitration (unbounded-wait)
- drain-land pass-running (uncapped-retry)
- drain-land duplicate-nnn-parked (uncapped-retry)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.

## Built (2026-09-26)

**IMPL** (`plateau:tools/drain-daemon/`, lane-2):
- `plateau:tools/drain-daemon/lib.mjs`: `DEFAULTS.leaseWaitAlertSec` (1800s/30min) + `DEFAULTS.maxConsecutiveFailures`
  (6), both env-overridable (`DRAIN_DAEMON_LEASE_WAIT_ALERT_SEC`, `DRAIN_DAEMON_MAX_CONSECUTIVE_FAILURES`) exactly
  like the existing DEFAULTS rows. Two new pure functions: `decideLeaseWaitEscalation` (escalates once per
  foreign-holder episode past the bound; the daemon still never contends) and `decideFailureEscalation` (escalates
  once per failure streak — a duplicate-NNN park folds into the same `consecutiveFailures` counter, no special case
  — once it reaches the cap; the retry still continues at the backoff ceiling). `buildStatusReport` passes through
  `leaseWaitEscalated` / `failureStreakEscalated` from state.
- `plateau:tools/drain-daemon/daemon.mjs`: factored the existing anomaly-alert's inline `osascript` call into a
  shared `notify(title, summary)` helper, reused by the two new escalations. Wired both into the main loop: the
  `wait` branch tracks per-holder episode start + fires the lease-wait escalation (log line + `notify` +
  `leaseWaitEscalated` in `plateau:.drain-daemon/state.json`, cleared when the holder changes or the lease is
  acquired); the post-pass block tracks the failure streak (`decideFailureEscalation`) and fires the streak
  escalation (log line with the last failure's reason + `notify` + `failureStreakEscalated` in
  `plateau:.drain-daemon/state.json`, cleared on the next successful pass).
- `plateau:tools/drain-daemon/cli.mjs`: `status` prints both escalation lines when present.
- `plateau:tools/drain-daemon/README.md`: new "Bounded waits, still-unbounded retries, with a notice" section
  documenting both bounds + env knobs.
- Tests: 13 new cases in `plateau:tools/drain-daemon/lib.test.mjs` (resolveConfig defaults/overrides,
  `decideLeaseWaitEscalation`, `decideFailureEscalation`, `buildStatusReport` passthrough) — confirmed red
  (`decideLeaseWaitEscalation is not a function` / `decideFailureEscalation is not a function`) before
  implementing, green after (234/234 passed, full `plateau:tools/drain-daemon/lib.test.mjs` run).

**WE** (`we:scripts/conveyor/flows/drain-land.flow.json`, lane-51):
- `lease-arbitration.wait`: `timeout: '30m'`, `onTimeout: 'lease-wait-escalated'`; removed its `unbounded-wait` ack.
- `pass-running.retries` and `duplicate-nnn-parked.retries`: `cap: 6`, `onCap: 'failure-streak-escalated'` (shared
  state — a duplicate-NNN failure counts into the same cap); removed both `uncapped-retry` acks.
- New non-terminal states `lease-wait-escalated` and `failure-streak-escalated` (owner = the daemon's own loop,
  `escalation.to: 'operator'`, citing the new `plateau:tools/drain-daemon/lib.mjs` /
  `plateau:tools/drain-daemon/daemon.mjs` lines) plus the 5 transitions wiring them in and back out
  (lease-wait-escalated → lease-arbitration; failure-streak-escalated → pass-running, reachable from both
  `pass-running` and `duplicate-nnn-parked`).
- `node we:scripts/conveyor/flows/check.mjs --json`: the three targeted findings (drain-land `lease-arbitration`
  unbounded-wait, `pass-running` uncapped-retry, `duplicate-nnn-parked` uncapped-retry) are gone; 0 unacknowledged
  findings repo-wide (54 total, all acknowledged) — no new gap introduced by the two added states.
- `npx vitest run we:scripts/conveyor/flows/__tests__/real-flows.test.mjs we:scripts/conveyor/flows/__tests__/flow-model.test.mjs`:
  14/14 green.

**Replay proof** (read-only against the live daemon's `plateau:.drain-daemon/daemon.log`, ~105k lines):
- *Lease wait*: the log's only real lease-wait episode (holder `Mac:2366:drain-daemon`, 2026-08-01T15:25:52Z →
  15:40:10Z = 14.3 min) is under the 30-min bound, so both old and new code correctly stay silent on it (negative
  control). Replayed a synthetic continuation of that SAME episode/holder out to 40 min: old code (no escalation
  hook exists) stays silent the whole way; new code fires **exactly once**, at 2026-08-01T15:55:52.001Z (30.0 min
  waited), then stays silent for the rest of the 40 min.
- *Failure streak*: no real ≥6-in-a-row failure streak exists in the log — every exit≠0 run found (the exit-4
  `gh-error` bursts on 2026-09-23/24, the duplicate-NNN parks through September) is broken within 1–4 failures by
  either a real merge landing or a daemon restart (both reset `consecutiveFailures`), confirmed against the
  surrounding log lines. Built a synthetic 9-failure streak reusing the exact real `gh-error` reason/detail text
  from today's 2026-09-26T16:13:00.927Z incident, in the log's own line format: old code backs off silently to the
  900s ceiling through all 9; new code (cap 6) escalates **exactly once**, at failure #6 (synthetic timestamp
  2026-09-26T20:44:00.000Z), and correctly does not re-fire on failures #7–9.

**Not done**: nothing outstanding from this slice's scope. The live daemon clone/launchd install is untouched (out
of scope — this only edited the two lane clones).
