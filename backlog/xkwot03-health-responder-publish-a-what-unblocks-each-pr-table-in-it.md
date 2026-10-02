---
kind: story
size: 2
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/operations/health-respond.mjs", "we:scripts/operations/__tests__/health-respond.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: publish a what-unblocks-each-PR table in its feed

Operator, 2026-10-02. The orchestrator built a per-PR "real state / what unblocks it" table by hand several times a day. The responder already knows each stuck PR, its cause and the pending action, so its read-only operation and Plateau feed publish that table: PR, plain-language state, cause, what unblocks it (an action in flight, a card, or an operator decision), and since when. Replay the 2026-10-02 morning state.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
