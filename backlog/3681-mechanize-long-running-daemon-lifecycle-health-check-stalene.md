---
bornAs: x6einv9
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-14"
relatedTo: ["3625"]
tags: [daemons, ops, staleness, live-reload]
---

# Mechanize long-running daemon lifecycle: health-check, staleness detection, and live-reload

Operator idea (epic #3383, 2026-09-14): mechanize how this system manages its own long-running daemons -- the resident conveyor runner (we:skills-src/conveyor/runner.mjs), the supervisor (we:skills-src/conveyor/supervisor.mjs), the drain daemon (plateau:tools/drain-daemon/daemon.mjs), and the newly-scheduled driver-watchdog (we:scripts/conveyor/driver-watchdog.mjs) -- instead of each session discovering staleness through ad hoc investigation. Three linked asks: (1) systematic start/stop/restart/health-check tooling instead of manual "is this stale, do I need to restart it" checks, (2) automatic detection that a daemon's running code has gone stale relative to its branch's current HEAD, and (3) a live-reload/graceful-reconnect path so a code change does not require a disruptive kill-and-restart that loses in-flight agent/command state. Open decision, not yet prepared -- real forks below need a `/prepare` pass, not a snap answer.

## Motivating evidence — the same pattern bit twice in one night (2026-09-14)

Both incidents are a live daemon process running code from before a fix landed on its own branch, and both
were caught by luck (someone happened to check) rather than by anything that flagged the staleness:

1. **The telemetry fix (PR #2198)** needed a manual restart of the resident conveyor runner
   (we:skills-src/conveyor/runner.mjs) to take effect. Nothing detected that the running process predated the
   fix; a person had to think to check.
2. **The dispatch fix landed tonight (commit `14e0a7249`)** — a 33+ hour silent dispatch-blocking bug (the
   resident driver's local `main` ref was 161 commits behind `origin/main`, so `assertMainNotStale` silently
   refused every fix/review dispatch) — fixed directly on the driver's own branch. The exact same pattern
   recurred immediately: the live driver process (PID 93017) had been running since before the fix landed, so
   it needed the same ad hoc "is this stale, restart it" check and manual restart. Same failure shape, same
   night, second time.

Both times the fix itself was fine; what was missing was the system knowing, on its own, that a running daemon
no longer matched the code it should be running.

## The three asks (kept distinct — do not conflate)

1. **Lifecycle management.** A systematic way to start/stop/restart/health-check every long-running daemon
   this system depends on (the resident conveyor runner we:skills-src/conveyor/runner.mjs, the supervisor
   we:skills-src/conveyor/supervisor.mjs, the drain daemon `plateau:tools/drain-daemon/daemon.mjs`, and the
   driver-watchdog we:scripts/conveyor/driver-watchdog.mjs, scheduled into the supervisor by commit
   `14e0a7249`) — instead of each session re-deriving "is this stale, do I need to restart it" through ad hoc
   investigation every time.
2. **Staleness detection.** Automatic detection of when the code a daemon is running from has diverged from
   its branch's current HEAD (a new commit landed since the process started), so a stale-running-process
   situation is flagged/handled proactively instead of discovered by luck — the failure shape behind both
   incidents above.
3. **Live-reload / graceful-reconnect.** A full kill-and-restart is disruptive — it loses in-flight
   agent/command state the daemon was coordinating. The operator's own framing: "if it can reload and
   reconnect agent and command it could work" — i.e. a mechanism that swaps in new code without interrupting
   whatever the daemon was already coordinating (a dispatched agent, a command it's tracking).

## Open forks — real, not resolved; this needs a real `/prepare` pass

**Fork 1 — detection mechanism.** How does a daemon know its own running code is stale relative to its
branch's HEAD?
- *Option A — periodic self-check.* The daemon (or its supervisor) periodically compares the commit its
  running process actually started from against the current HEAD of the branch it should be tracking, and
  flags/logs/alerts on divergence.
- *Option B — file-watcher.* Watch the daemon's own source files (or the branch ref) for changes and react
  immediately rather than polling.
- *Option C — something else* (e.g. piggyback on an existing git-fetch/ref-sync pass, like the
  we:scripts/conveyor/main-ref-sync.mjs mechanical pass commit `14e0a7249` just added for the stale-`main`
  half of this same problem).
- No default recommended here — genuinely open, needs the `/prepare` research pass.

**Fork 2 — reload mechanism.** Operator explicitly flagged this needs "special handling" — these are very
different engineering asks:
- *Option A — genuine hot-reload.* The long-running Node process swaps in new code in place, without dropping
  external state it's coordinating (lane leases, in-flight dispatched agents) — the ideal, but open whether
  it's actually feasible for a process with this much live external state.
- *Option B — graceful drain-then-restart.* Finish/hand off in-flight work cleanly, then restart with fresh
  code — likely the realistic ceiling if Option A proves infeasible, but still meaningfully better than
  today's blind kill-and-restart.
- Which of these is achievable (and for which daemon) is exactly the open question a `/prepare` pass should
  answer, not assume.

**Fork 3 — scope.** Does this apply uniformly to all daemons (runner, drain, supervisor, driver-watchdog), or
do some have different risk profiles that warrant different handling — e.g. the drain daemon (actively
merging PRs with real credentials) versus the conveyor runner (dispatching/queueing) versus a lighter-weight
watchdog? A uniform mechanism is simpler to build and reason about; a per-daemon tier may be the more honest
fit for their differing blast radii.

## Related work

- Parent: `#3383` (the background mechanical dispatcher epic).
- Relates to `#3625` (proactive lane/session health monitoring — "nothing watches continuously" is the same
  underlying gap, one layer up: that card is about session/lane health, this one is about the daemons that do
  the watching).
- Relates to the driver-watchdog scheduling work that just landed (commit `14e0a7249`,
  we:scripts/conveyor/driver-watchdog.mjs wired into we:skills-src/conveyor/supervisor.mjs on a 5-minute
  timer) — a staleness-detection daemon and a watchdog daemon are closely related concepts worth
  cross-referencing when this is prepared, possibly the same mechanism wearing two hats.

## Done when

This is a decision item, not a build — it is **not** owed a code deliverable by this card. Done when this
fork set reaches Definition of Ready via `/prepare` (a `/research/` topic + each fork above stated as named
options with a bold default, `preparedDate` stamped) and is later ratified via `/next decision`.
