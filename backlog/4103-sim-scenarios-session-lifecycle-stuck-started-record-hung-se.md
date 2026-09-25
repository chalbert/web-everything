---
bornAs: xitzlx9
kind: story
size: 8
parent: "4097"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/operations/completion-cli.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim scenarios: session lifecycle (stuck started record, hung session, pid recycle, failed session, stale completion record)

Matrix rows I-01, I-02, N-05, N-06, N-07, N-31, N-32, G-13, G-30, G-31, G-33 in we:reports/2026-09-24-daemon-scenario-simulator.md. I-01/I-02 go green once the hung-session axis (4085) lands; G-13/G-30/G-31 are expected to find real bugs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
