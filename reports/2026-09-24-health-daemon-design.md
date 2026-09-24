# Automated health daemon — design (2026-09-24)

Decision card: `xev8pnf` (prepared). Epic: `xqmw8g9` (Conveyor hardening — 2026-09-24 incident follow-ups),
under #3383. Research topic: `/research/automated-health-daemon-smells/`.

## Why

Operator, 2026-09-24 ~6:25 PM ET, verbatim: "In general we should prioritize the automated health daemon that
listen to multiple smell and auto dispatch investigations if needed and can tell me what it think we should
do without needing a session".

On 2026-09-24 every problem was found by a person in a chat session looking at the fleet: daemons alive but
dispatching nothing, dispatched bots getting 401 "Bad credentials" while the live smoke gate passed, lanes
running out, the pool growing past 100 clones, a load average high enough to slow everything, stood-down and
stuck PRs piling up. Each had a cheap mechanical signal. None had a watcher that turned the signal into
"here is what is wrong and what to change".

## What already exists (reused, not rebuilt)

| Building block | Where | Reused for |
| --- | --- | --- |
| Generic resident pass runner with its own heartbeat, interval, self-sync and launchd plist | `we:skills-src/conveyor/pass-daemon.mjs`, `we:skills-src/conveyor/daemon-manifest.mjs` (`DAEMON_MANIFEST`, line 126) | Host of the health watch (one new manifest entry) |
| Daemon liveness vocabulary (`down` / `dead` / `alive-and-stalled` / `alive-and-idle`) | `we:scripts/operations/runner-activity.mjs` (`assessDaemonState`, line 17), `we:scripts/operations/runner-activity-io.mjs` (`KNOWN_DAEMONS`, line 54) | The "owed work, zero dispatches" smell |
| Stuck-PR watch: per-stage thresholds, liveness check, one inspection per episode, global cap of 2, marker comment as episode record | `we:scripts/conveyor/stuck-pr-watch-core.mjs` (`evaluateStuckPr` 213, `DEFAULT_MAX_CONCURRENT_INSPECTIONS` 234, `planStuckDispatches` 261), `we:scripts/conveyor/stuck-pr-dispatch-marker.mjs` (`alreadyDispatchedForEpisode` 157) | The pattern for episodes, caps and investigation dispatch; PR-level stalls stay its job |
| Diagnose-only inspector launch: gh App shim, read-only tool deny-list, session reaper coverage | `we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs` (`INSPECT_DISPATCH_DISALLOWED_TOOLS` 136), `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/lib/gh-app-shim.mjs`, `we:scripts/conveyor/session-reaper.mjs` | Launching the health investigator |
| Operator queue with pure row-builders per section (stood-down, stuck-inspected) | `we:scripts/operations/operator-queue.mjs` (`stuckInspectedRow` 117, `standDownRow` 135) | A new HEALTH section |
| Once-per-item notification pass that never swallows a delivery failure | `we:scripts/operations/operator-notify.mjs` (`planNotifications` 14, `runOperatorNotify` 32) | macOS notification on a high-severity episode |
| Declared `file-item` operation (card + conveyor clearance) | `we:scripts/operations/file-item.mjs` | Filing a known-fix card |
| App token status read | `we:scripts/conveyor/github-app-status.mjs` | Token / rate-limit smell |
| Live smoke gate | `we:scripts/lib/daemon-live-smoke.mjs` | Smoke-failure smell |
| Heavy-command admission and host sampler records | `we:scripts/readiness/heavy-admission.mjs`, `we:scripts/lib/telemetry-machine.mjs` | Load smell |

Gap: nothing reads all of these together, nothing keeps episode state across smells, and nothing writes the
operator a recommendation outside a PR comment.

## Prior art (what production monitoring converged on)

- **Symptom-based alerting over cause-based** (Google SRE book, "Monitoring Distributed Systems"): page on
  what users feel, keep cause signals for diagnosis. Here the "user" is the conveyor's throughput: the
  paging smells are "owed work not moving", "merges per hour dropped", "bots failing auth"; cause signals
  (load, pool size, labels) are alert-only context.
- **`for:` durations and hysteresis** (Prometheus alerting rules, the `for` clause; Alertmanager
  `group_wait`/`repeat_interval`): a condition must hold for a while before it fires, and one notification
  covers a group. This is the episode model below (K breaching samples to open, M clean to close).
- **Grouping, inhibition and silences** (Alertmanager): one alert per group, a higher-level alert inhibits
  its dependents, known issues are silenced with an expiry. Here: an episode linked to an open card goes
  quiet ("tracked"), a daemon-down episode inhibits that daemon's derived smells.
- **Dead-man's switch / Watchdog alert** (kube-prometheus `Watchdog`, Deadman's Snitch, healthchecks.io): an
  always-firing heartbeat checked by something outside the monitoring stack, because a monitor cannot report
  its own death. Here: an outside dead-man check with no shared dependencies (slice 6), matching ruled
  clause 6 of `we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle`.
- **Automated diagnosis, human-approved remediation** (PagerDuty Runbook Automation diagnostics, Datadog
  Watchdog root-cause, Meta's "SEV" tooling): automation gathers evidence and proposes; changes ship through
  the normal change process. Here: investigations are diagnose-only; fixes become cards through the conveyor.
- **Alert fatigue** (PagerDuty and SRE literature): every alert must be actionable, rare, and novel; noisy
  alerts get tuned or deleted. Here: persistence, per-episode dedup, tracked-quieting, a shadow period
  before notifications, and a per-smell precision record.

## The design (bold defaults; the decision card carries the forks)

### Shape

Its own resident process in its own failure domain: a singleton per host, never inside a daemon it watches,
running from a `main`-only clone that never takes live overlays (the drain's carve-out model), with a hard
timeout on every child call and a last-tick-completed stamp written from inside the tick (the pass runner's
lease heartbeat keeps moving through a hung tick, `we:skills-src/conveyor/pass-daemon.mjs:194`). The expected
vehicle is a `health-watch` entry in `DAEMON_MANIFEST` with self-sync set explicitly. A pure core (`we:scripts/conveyor/health-watch-core.mjs`: smell evaluation, episode
transitions, dispatch and notification plans) plus a thin IO shell (`we:scripts/conveyor/health-watch.mjs`:
runs the probes, reads and writes the episode store, calls the dispatcher, the notifier and `file-item`).
State under the pinned daemon state root (#4052), not in the clone.

### A smell

```js
// we:scripts/conveyor/health-smells/lane-starvation.mjs (slice 1 shape)
export default {
  id: 'lane-starvation',
  scope: 'host',                  // host | repo — multi-host ready (see below)
  cadence: 'every-tick',          // every-tick | gh (15 min) | transcript (10 min)
  probe: 'lanePoolAcquirable',    // a named IO read the shell provides; the core never does IO
  breach: ({ acquirable, demand, noLaneFailures30m }) => acquirable < demand || noLaneFailures30m >= 3,
  openAfter: 2, closeAfter: 3,    // K breaching samples open an episode; M clean samples close it
  severity: 'high',
  action: 'investigate',          // alert | investigate | file
  knownFix: null,                 // or a card template for action 'file'
  recommendationHint: 'Lanes below demand: pool cap, leaked leases, or litter-dirty lanes.',
};
```

### Seed smells (from 2026-09-24's real incidents)

| # | Smell | Breach (default) | Action | Slice |
| --- | --- | --- | --- | --- |
| 1 | Daemon has owed work but 0 dispatches | `alive-and-stalled`, or owed > 0 and 0 dispatches for 3 ticks | diagnose (`dispatch-eligibility`) → investigate if unexplained (high) | 1 |
| 2 | Repeated 401 / "Bad credentials" in dispatched transcripts | ≥ 3 in 15 min across sessions, or App status error | diagnose (`github-app-status`) + alert (high); inhibits agent dispatch | 1 |
| 3 | Lane starvation | acquirable < queued demand for 2 samples, or ≥ 3 no-lane failures in 30 min | investigate (high) | 1 |
| 4 | Daemon clone behind `main` / self-sync in conflict | behind > 30 min: alert; conflict for 2 samples: investigate | alert → investigate | 3 |
| 5 | Live smoke gate failure | any failure | investigate (high) | 3 |
| 6 | Session bound live-process, transcript stale | transcript untouched > 20 min while bound live | investigate | 3 |
| 7 | Drain pass over budget / merges per hour dropped | pass > 10 min twice, or merges/h < 25% of 7-day median with a non-empty queue | investigate | 3 |
| 8 | PRs stuck per stage (systemic) | ≥ 3 PRs stuck in the same stage at once (per-PR stalls stay with the stuck-PR watch) | alert; recommendation aggregates the stuck-PR inspections already posted | 4 |
| 9 | Open unaccepted PRs above the limit | over the backpressure limit (x55tmjy) | alert | 4 |
| 10 | Contradictory or stray review labels | any PR with a contradictory pair | alert + file | 4 |
| 11 | Stood-down PRs accumulating | ≥ 5 stood-down open | alert | 4 |
| 12 | Lane pool growth / dirty-lane accumulation | lanes > 90% of cap, or > 20% dirty-unacquirable | alert (+ file when litter-only) | 4 |
| 13 | Machine load high | load1 > 1.5 × cores for 3 samples | alert; inhibits agent dispatch | 4 |
| 14 | GitHub App token / rate limit | remaining < 10%, or token refresh failing | alert (high); inhibits agent dispatch | 4 |
| 15 | Self: health tick over budget or a probe erroring | tick > 60 s, or the same probe errors 3 times | alert | 1 |

### When a smell dispatches, and when it only alerts

Deterministic diagnosis first: a smell may name a declared read operation that runs before any agent
(`dispatch-eligibility` for smell 1, `github-app-status` for smells 2 and 14). An agent is dispatched only
when all four hold: the symptom has **more than one plausible cause** the deterministic diagnosis did not
settle; the evidence lives in **transcripts, logs or histories an agent must read**; **no other watch already
dispatches for that subject** (per-PR stalls belong to the stuck-PR watch, conflicts to the parked-PR
conflict watch); and **no inhibiting episode is open** (App token / rate limit breaks the investigator's own
gh shim; high load makes more agents worse). Otherwise alert only.

The investigator holds **declared read operations only**; Edit, Write and every `gh` write (including
`gh pr comment`) are denied, because it reads untrusted transcript text. It is launched as a new kind on the
declared `dispatch-lane` operation (`#conveyor-dispatch-calls-the-declared-operation` clause 1), not by
importing the spawner.

### Episodes and dedup

An episode is keyed by `(smell id, subject)` — the subject is the daemon, repo, host or PR stage. It opens
after `openAfter` breaching samples and closes after `closeAfter` clean ones. One investigation and one
notification per episode. An episode linked to an open card or PR is "tracked": it stays listed but raises
nothing new until the card resolves or the severity rises — and that silence expires after 72 h unless the
card is `active`. A (smell, subject) that re-opens more than 3 times in 24 h becomes one `flapping` episode.
An unacknowledged high-severity episode re-notifies once after 4 h. After 3 agent investigations on the same
(smell, subject) in 7 days, no fourth runs; the episode is marked "recurring — needs a product fix" (a count,
not a model judging agreement).

### Recommendation channel (no session needed)

1. **Durable episode report** `<stateRoot>/health/episodes/<episode-id>.md` (+ `.json`): what is wrong, the
   measurements, the investigation's evidence with cited command output, the product change that fixes it
   (an existing card, or the card it filed), and one line "what you should do".
2. **A HEALTH section in the operator queue** (the terminal command and the plateau /wip panel both render
   it): one row per open episode — smell, subject, age, the one-line recommendation, the report path. The
   first line of the operator queue is the health daemon's last-tick age.
3. **A macOS notification** only when a high-severity episode opens, **sent by the health process itself**
   under its own once-per-episode state. Not through `operator-notify`: the dispatcher runs that pass
   (`we:skills-src/conveyor/runner.mjs:335`), so it could never announce the dispatcher's own stall. This
   widens the "only NEEDS YOU notifies" contract by exactly one class, which ratification must accept.
4. **A filing request, landed as an uncleared card** when the fix is a product change: the daemon writes the
   request; a lane-bound declared operation lands it through a leased lane (`file-item --queue=false`, verify,
   PR). The daemon never files from its own clone (a dirty clone freezes self-update) and never clears
   readiness (`#state-lives-where-its-nature-dictates` clause 3). Never a GitHub issue: the backlog is the
   tracker.

Model-authored report text passes the privacy scrub of `#automated-session-introspection` clause 3.

### Investigation budget

The model comes from dispatch routing for the investigator role, never hand-set (Sonnet expected).
Diagnose-only, declared read operations only. One per episode, at most 1 running at a time (separate from the
stuck-PR watch's cap of 2, inhibited under high load), at most 6 per rolling 24 h, and a 20-minute wall clock
the health process enforces by stopping the session through the session reaper (the launch path has no
turn cap to lean on). Over budget, the episode is marked `budget-exhausted` and stays alert-only. All numbers
are config.

### Alert fatigue

Persistence (`openAfter`), hysteresis (`closeAfter`), one notification per episode, tracked-quieting,
inhibition (a daemon-down episode suppresses that daemon's derived smells), notifications only for high
severity, **probation in `shadow`** (smells, episodes, deterministic diagnoses and reports run; agent
dispatch, notifications and filing requests stay off until the operator turns each on as a settings change —
the precedent of `#planner-build-plan-and-execute` clause 9), and a per-smell count of episodes the operator
marked "not a problem" so noisy smells get re-tuned.

### Who watches the watcher

Already ruled, not a new fork: clause 6 of `#resident-daemon-reload-lifecycle` requires an outside check that
alerts when any daemon's heartbeat stops, and #4045 builds it. The health process is one more daemon under
it. What this design adds: (1) the outside check must read the **last-tick-completed stamp**, not only the
lease heartbeat, because the heartbeat keeps moving through a hung tick; (2) launchd `KeepAlive` restarts a
crashed process; (3) the operator queue's first line shows the health process's last-tick age, where the
operator already looks. Slice 6 is blocked by #4045.

### Single host now, multi-host ready

One health daemon per host, singleton lease. Each smell declares `scope: host | repo`. Host smells (load,
lanes, transcripts, local clones) must run on every host; repo smells (PRs, labels, merge rate) run on one
host only. Until the multi-instance decisions (#3639, #3615, probation #4010) rule, there is one host and it
runs both. When they rule, repo-scope smells follow whichever leader lease they choose; nothing here
pre-empts that.

### Cadence

A 5-minute tick. Local probes every tick; GitHub probes every 15 minutes sharing one `gh pr list` per repo
per window; transcript scans every 10 minutes reading a bounded tail. Tick budget: 60 s wall, at most 20 `gh`
calls. An overrun is itself a smell (#15).

## Build slices (filed under `xqmw8g9`, blocked by `xev8pnf`)

1. `xv71n7k` — the health process, smell framework, smells 1–3 + 15, deterministic diagnoses, episode store,
   report + HEALTH section, shadow mode (also blocked by #4052).
2. `x61epyr` — agent investigation per episode.
3. `xd9lp7o` — smells 4–7.
4. `x1k0zfj` — smells 8–14.
5. `x6dyxwq` — filing requests landed as uncleared cards through a lane-bound operation.
6. `xllcgox` — last-tick-completed check in #4045's outside watcher + last-tick header (blocked by #4045).

Composing cards: `xaawsd6` (live status page, reads the same episode store) and `xag0rnz` (stall alerts, the
notification for smell 1).

## Adversarial screen (2026-09-24, foreground)

One adversarial Opus skeptic round (four axes: classification, merit, statute overlap, citation scope) and
one fresh-context two-confusion screen ran on the first draft. What changed:

| Draft fork | Skeptic | Screen | Change |
| --- | --- | --- | --- |
| 1 Host | survives with amendment | flagged (impl + prio) | Re-ruled as "own failure domain"; `main`-only clone; per-tick timeout; last-tick stamp; manifest-vs-bespoke moved to a build note |
| 2 Dispatch rule | survives with amendment | clear | Deterministic diagnosis first; inhibition leg; systemic stuck-PR row made alert-only; declared-reads tool surface; launch through the declared `dispatch-lane` operation |
| 3 Episodes | survives with amendment | clear | Flap cap, high-severity reminder, expiring silences; citation to the stuck-PR marker corrected |
| 4 Channel | refuted as written | flagged (impl) | Self-delivered notification (not the dispatcher-run notifier); explicit contract widening; privacy scrub; paths moved to the build slice |
| 5 Filing | refuted | clear | Default flipped: uncleared filing request landed through a leased lane; never cleared at birth; never files from the daemon clone |
| 6 Watcher | refuted (not a fork) | flagged (already ruled) | Dissolved into clause 6 of `#resident-daemon-reload-lifecycle` via #4045, plus the last-tick-stamp addition |

Hidden forks the skeptic found in "supported by default", now settled by precedent or made mechanical:
shadow exit is the operator's act (`#planner-build-plan-and-execute` clause 9); "3 investigations agreed" →
a plain count; the budget's turn cap had no mechanism → a wall clock enforced through the session reaper.
