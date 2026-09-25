---
kind: story
size: 5
parent: "x95yxvd"
status: open
scope: ["we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/main-staleness.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim scenarios: self-sync and live smoke (overlay conflict, unreachable origin, broken main, smoke bypass paths)

Matrix rows I-14, N-21, N-22, G-07, G-11, G-12, G-25, G-39 in we:reports/2026-09-24-daemon-scenario-simulator.md. G-07/G-11/G-25 are paths that adopt new code WITHOUT the live smoke gate.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
