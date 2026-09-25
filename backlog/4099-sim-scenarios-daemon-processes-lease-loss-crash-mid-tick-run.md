---
bornAs: xb6sj32
kind: story
size: 8
parent: "4097"
status: open
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/pass-daemon.mjs", "we:skills-src/conveyor/supervisor.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim scenarios: daemon processes (lease loss, crash mid-tick, runner beside daemons, pass child hang, supervisor, repo failures)

Matrix rows N-02, N-03, N-04, N-11, N-23, N-24, N-26, N-29, N-30, N-34, N-35, N-36, G-06, G-08, G-10, G-16, G-27, G-29, G-34..G-38 in we:reports/2026-09-24-daemon-scenario-simulator.md. G-06 and G-37 are high risk (the old runner still runs a loose reaper and a second fix pass).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
