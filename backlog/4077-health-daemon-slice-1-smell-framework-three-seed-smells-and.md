---
bornAs: xv71n7k
kind: story
size: 8
parent: "4075"
status: open
blockedBy: ["4065", "4052"]
scope: ["we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-24"
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

## Done when

1. **Executable** — a unit test drives the pure core through each seed smell's breach → open → clean → close
   sequence (including a flap past the cap and an expired tracked-silence) and fails before this lands.
2. **Live proof** — on the running fleet, `node we:scripts/operations/operator-queue.mjs` shows a HEALTH
   section with the last-tick age, and a forced lane-starvation condition (a test pool) opens exactly one
   episode with a report file, before/after evidence recorded on the PR.
