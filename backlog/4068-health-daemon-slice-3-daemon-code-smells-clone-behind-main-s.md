---
bornAs: xd9lp7o
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["4065"]
scope: ["we:scripts/conveyor/health-smells/"]
dateOpened: "2026-09-24"
tags: []
---

# Health daemon slice 3: daemon-code smells — clone behind main, self-sync conflict, smoke-gate failure, stale live-process bindings, drain pass over budget

Third slice of 4065: add the daemon-code smells seen on 2026-09-24 to the registry built in slice 1: a daemon clone behind origin/main or its self-sync in conflict (we:scripts/lib/daemon-self-sync.mjs), live smoke gate failures (we:scripts/lib/daemon-live-smoke.mjs), sessions bound as live-process whose transcripts are stale, and the drain's pass duration over budget or merges per hour dropping.

## Done when

1. **Executable** — each new smell has a fixture-driven unit test (breach and clean samples) through the
   slice-1 core; the suite fails before this lands.
2. **Live proof** — each smell's probe runs against the live fleet in `shadow` and its reading is shown in
   the episode report or HEALTH section.
