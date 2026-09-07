---
bornAs: x1t5emx
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: []
---

# file-item's NON_DISPATCHABLE_KINDS test never cross-checks we:scripts/conveyor/queue.mjs's real map, so the two can silently drift

Independent review of #1991 (graduating we:scripts/operations/file-item.mjs to main) found: we:scripts/operations/__tests__/file-item.test.mjs:182 compares NON_DISPATCHABLE_KINDS only to a hardcoded literal (new Set(['epic','decision'])), never to we:scripts/conveyor/queue.mjs's own NON_DISPATCHABLE map, though we:scripts/operations/file-item.mjs's own docstring claims 'the two lists are asserted to agree in we:scripts/operations/__tests__/file-item.test.mjs' — false. MUTATION PROBE (confirmed): adding a third entry to we:scripts/conveyor/queue.mjs's NON_DISPATCHABLE map in an isolated clone left the full conveyor + file-item suite green, including this test. Impact if unfixed: a future kind added as non-dispatchable in we:scripts/conveyor/queue.mjs would silently NOT be excluded by we:scripts/operations/file-item.mjs's own copy, auto-clearing it for the conveyor with no test failure. Fix: export we:scripts/conveyor/queue.mjs's NON_DISPATCHABLE keys for direct import in the test (making the assertion a real cross-check), or add a check-standards rule flagging a test whose description asserts 'X agrees with Y' but whose body never imports Y.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
