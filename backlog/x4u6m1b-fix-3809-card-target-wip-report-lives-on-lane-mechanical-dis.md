---
kind: task
status: open
scope: ["we:backlog/"]
dateOpened: "2026-09-29"
tags: []
---

# Fix #3809 card target: wip-report lives on lane/mechanical-dispatcher, not main

#3809 (the /wip report readable on a phone) is marked prepared but its scope (we:scripts/operations/wip-report*.mjs) does not exist on main — the files live on the prototype branch lane/mechanical-dispatcher (Codex found this 2026-09-29 and changed nothing). Re-prepare it: either set deliveryTarget to that registered POC branch, or re-scope it against main. Until then it must not be offered to builders or workers.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
