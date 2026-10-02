---
kind: story
size: 2
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-capacity.mjs", "we:scripts/conveyor/__tests__/health-responder-capacity.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: report capacity holds and idle slots (report only)

Operator, 2026-10-02. Report-only, never act: when dispatch is held for over 30 minutes by a load gate (2026-10-01: memory pressure held every launch for 3+ hours; fseventsd at 8.2 GB), or worker slots sit idle while work is blocked, escalate once with the reason, the reading and the top processes by memory and CPU. Related card xd6u5ta. Replay the 2026-10-01 memory-pressure hold.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
