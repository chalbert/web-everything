---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# check:standards gate — a skill naming a raw home that a declared operation owns

An operation is only half-built when its declaration lands. #3029/#3035 derive the CLI and HTTP callers from one declaration, but the third caller — the skill prose telling an agent which command to run — stayed a manual edit done once per operation by whoever remembered. Measured 2026-08-21: 5 of 11 operations are named by ZERO skills; 14 skills instruct we:scripts/lane-pool.mjs while 0 instruct dispatch-lane. Add a scan, same shape as the #2967 test-only-export warning, that fails when a skill names a raw home an operation declares over — unless marked as comparison or as that operation own docs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
