---
bornAs: x3337wu
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/conveyor/verify-dispatch.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# verify-lane request waits forever when no runner is alive

Live 2026-09-25: an interactive session ran we:scripts/verify-lane.mjs request (the sanctioned call for agent sessions, #3105) while no conveyor runner was alive. Nothing ever serves a request except a we:scripts/conveyor/verify-dispatch.mjs tick, so the running marker sat untouched for 30+ minutes and blocked open-pr. Make request detect runner liveness (the runner-activity read) and refuse loudly with 'no runner alive' plus the next step, or have a resident daemon serve requests independently of the conveyor runner. Prove on a live case: request with no runner alive must fail fast, not strand.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
