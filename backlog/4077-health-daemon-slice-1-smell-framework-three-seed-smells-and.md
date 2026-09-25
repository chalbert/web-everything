---
bornAs: xv71n7k
kind: story
size: 8
parent: "4075"
status: active
blockedBy: ["4065", "4052"]
scope: ["we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/operations/operator-queue.mjs", "we:skills-src/conveyor/launchd/com.we.health-watch.plist.example", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
tags: [health-daemon]
---

# Health daemon slice 1: smell framework, three seed smells, and the recommendation channel

First build slice of the health daemon ruled in 4065 (design: we:reports/2026-09-24-health-daemon-design.md).

- **The process** (4065 Fork 1): its own resident process, singleton per host, from a `main`-only clone
  that never runs overlays. Expected vehicle: a `health-watch` entry in we:skills-src/conveyor/daemon-manifest.mjs
  with self-sync set explicitly in its plist. Every child call has a hard timeout; each completed tick writes
  a last-tick-completed stamp separate from the lease heartbeat.
- **Pure core + IO shell**: we:scripts/conveyor/health-watch-core.mjs (smell evaluation, episode transitions,
  notification plan) and we:scripts/conveyor/health-watch.mjs (runs probes, reads/writes the episode store).
- **Smell registry** (data, one file per smell under we:scripts/conveyor/health-smells/): id, scope
  host|repo, cadence, probe, breach, openAfter, closeAfter, severity, action, optional deterministic
  `diagnose` operation.
- **Episodes** (Fork 3): key (smell, subject), hysteresis, flap cap, expiring tracked-silences; store under
  the pinned daemon state root (#4052).
- **Seed smells**: (1) daemon owed work with 0 dispatches, diagnosed first by
  we:scripts/operations/dispatch-eligibility.mjs; (2) repeated 401 / Bad credentials, diagnosed by
  we:scripts/conveyor/github-app-status.mjs; (3) lane starvation (acquirable below demand, or repeated
  no-lane failures), diagnosed by the stale-state read; (15) the health tick's own overrun.
- **Recommendation channel** (Fork 4): a per-episode report and a HEALTH section in
  we:scripts/operations/operator-queue.mjs, whose first line is the last-tick-completed age.
- **Shadow mode**: ships in `shadow` — no agent dispatch (slice 2), no notification, no filing.

## Build notes (2026-09-25)

- **Four more smells pulled into slice 1** — each is something that hurt on 2026-09-25: `daemon-silent` (a daemon
  alive but not ticking, or hung: the fix-dispatch daemon's pid stayed up at 10:28 ET while its log and lease
  heartbeat stopped); `daemon-owed-no-dispatch` also covers "refusing everything for 30+ min" (the fix daemon's
  `dispatched 0, refused N` with a `{{SCOPE}}` dispatch failure, and the review daemon's ticks throwing from
  09:20 ET); `clone-stale` (design smell 4: `smoke-rejected` / `clone-held-stale` / `smoke-slow` in
  `~/.claude/daemon-self-sync-state/*.alerts.jsonl`, the 08:15 ET stuck clone); `red-pr-unattended` (CI red for
  over 1 h with no `fix-<PR>` session in `claude agents --json`).
- **HEALTH section**: we:scripts/operations/operator-queue.mjs was owned by #4139 when this landed, so the section
  ships as a separate renderer (`healthSectionLines` in we:scripts/conveyor/health-watch.mjs, and its `section`
  subcommand); the one-line call in the operator queue is a follow-up.
- The daemon logs carry no timestamps; the watch uses its own sample clock (first read estimates backwards from
  the log's mtime at the daemon's tick interval, flagged `estimated`).

## Done when

1. **Executable** — a unit test drives the pure core through each seed smell's breach → open → clean → close
   sequence (including a flap past the cap and an expired tracked-silence) and fails before this lands.
2. **Live proof** — on the running fleet, `node we:scripts/operations/operator-queue.mjs` shows a HEALTH
   section with the last-tick age, and a forced lane-starvation condition (a test pool) opens exactly one
   episode with a report file, before/after evidence recorded on the PR.
