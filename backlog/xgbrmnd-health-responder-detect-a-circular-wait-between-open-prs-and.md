---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-cycles.mjs", "we:scripts/conveyor/__tests__/health-responder-cycles.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: detect a circular wait between open PRs and queued fixes, and propose the narrowest slice that breaks it

Operator, 2026-10-02. Live case: PR #3432 waited on the fix in card xfkqowg (a referral-ruling deadlock), while xfkqowg and two other fixes (xp0lsdi, xng7q1p) could not start because their scopes overlapped files #3432 touches; #3336, #3373 and #3415 sat for hours. The orchestrator broke it by narrowing xfkqowg to files #3432 does not touch. Detector: each tick build the waits-on graph (queued or prepared work waits on an open PR through shared scope; a PR waits on work through a ruling, a blocker or a named fix card) and report any cycle with its members and the shared files, once per cycle. Action: propose, never decide: the investigator suggests the narrowest slice that breaks the cycle (which files to drop, what becomes a follow-up) as one operator decision or a prepare note; a scope change is never applied automatically. Every step is a decision-log record. Replay the 2026-10-02 cycle.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
