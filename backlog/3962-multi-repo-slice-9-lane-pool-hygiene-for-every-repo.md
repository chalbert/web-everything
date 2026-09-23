---
bornAs: xr4ygg7
kind: task
parent: "3963"
status: open
blockedBy: ["3956"]
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 9: lane-pool hygiene for every repo

we:scripts/conveyor/lease-reaper.mjs only matches WE session names, so dead leases in the frontierui and plateau pools are reclaimed only by TTL; tick capacity counts only the WE pool (we:scripts/conveyor/tick-core.mjs:1472). Match other repos' fix/review sessions and count capacity per pool.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
