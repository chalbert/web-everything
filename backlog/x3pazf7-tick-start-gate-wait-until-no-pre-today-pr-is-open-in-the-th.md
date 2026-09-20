---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/tick-once.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# tick start-gate: wait until no pre-today PR is open in the three repos

SLICE of the shared-state tick. A launchd service exits until no pre-today PR is open in web-everything, frontierui and plateau-app (createdAt against the New York day, pagination past the 200 cap, API-failure and closed-unmerged rules). It must stay separate from new-work admission so session and manual remediation still work and the gate cannot deadlock (the review found this deadlock risk). DESIGN TO SETTLE: the exact rule for a PR that is open but blocked on the operator, what an API failure means (open or closed), and how the gate is observed. ACCEPTANCE: a table-driven test of the rules; a simulated API failure does not open the gate; a status line says why it is closed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
