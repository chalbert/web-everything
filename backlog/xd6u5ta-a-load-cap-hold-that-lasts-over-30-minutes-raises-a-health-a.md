---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# A load-cap hold that lasts over 30 minutes raises a health alert naming the cause and the top memory and CPU processes

Live case 2026-10-01: macOS memory pressure went to warn (level 2) at 1 PM ET and stayed, so the load gate (we:scripts/readiness/heavy-admission.mjs loadAdmissionDecision, reason "mem pressure 2 (>=2)") silently held every new build, fix, review and CI-heal launch for 3+ hours while 51% of memory was free and CPU was 56% idle. The cause was fseventsd at 8.2 GB, likely from lane-clone file churn and editor watchers on the lane pool. Nothing alerted; it was found only when the operator asked how the builder was doing. Fix: (1) the tick core counts consecutive load-cap ticks (like advanceHeldStall in we:scripts/conveyor/tick-core.mjs) and after 30 minutes raises a health alert with the reading and the top 5 processes by memory and CPU; (2) the alert says whether the hold is from our own work or from the host. Separate question for the operator, not built here: whether pressure level 2 with over 40% memory free should hold at all.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
