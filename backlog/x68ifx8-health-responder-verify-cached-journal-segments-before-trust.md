---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/health-responder-state.mjs", "we:scripts/conveyor/__tests__/health-responder-state.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: verify cached journal segments before trusting the receipt archive

Follow-up from the #3490 advisory (operator approved #3490, 2026-10-02). we:scripts/conveyor/health-responder-state.mjs:113 trusts the receipt archive without re-checking cached segments, so a corrupted or altered archived segment can bypass the promised freeze on journal corruption. Validate each cached segment against its content hash before trusting it; tests for corruption with an existing cache and for altered cached receipts.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
