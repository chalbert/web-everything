---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# mutation-check disqualifier priority is asserted nowhere against a competing condition

we:scripts/operations/mutation-check.mjs orders its four disqualifiers deliberately — not-restored is checked FIRST, ahead of any verdict, because a tree still holding the mutant matters more than the result. Its correctness juror on PR #1509 found the order is pinned only in prose: every test varies ONE field, so no case asserts which reason wins when two apply at once. A future reordering would ship silently and a caller could read a result while its checkout is still sabotaged. Add combined-condition cases, e.g. a probe with restored false AND mutantRan false expecting not-restored, under the existing no-path-reaches-killed block.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
