---
bornAs: xqw7hb2
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["4120"]
scope: ["we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# First adopter: the health daemon runs its probes and investigations as jobs

Slice of decision 4120 (daemon job model); audit we:reports/2026-09-24-daemon-blocking-antipatterns.md. Filed uncleared until 4120 is ratified; the shape below follows its bold defaults and changes with the ruling. The automated health daemon (decision 4065, build slice 4077) is the first adopter: its slower probes and the per-episode investigation launch (slice 4078) run as jobs, and it reads every daemon's job records as a smell source (a job stuck past its bound, a job that keeps failing on resume). Built inside 4077/4078's scope, not a fork of it. Done when: health watch tick never waits on a probe; LIVE proof: a deliberately slow probe (sleep 5 min) runs while 3 health ticks complete on time, timings in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
