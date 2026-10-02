---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# A block ruling on a mandatory referral sends the PR back for changes instead of re-asking

Live case 2026-10-02: on PR #3490 the mandatory reviewer ruled a real finding "block" (the responder decision journal stops ticks past 32 MiB, we:scripts/conveyor/health-responder-state.mjs:51), but the review run ended as "mandatory finding-specific review required" and was re-dispatched 33 times; nothing sent the PR back to its author. Fix in we:scripts/lib/jury-core.mjs and we:scripts/operations/review-pr.mjs: a recorded block ruling for the current head ends the run with a changes verdict whose body carries the finding and its ruling rationale, so the fix daemon picks it up; the same head is not re-reviewed until a new push. Follow-up to the review-loop fix (card xfkqowg, PR #3507), which covers not-real rulings. Replay #3490.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
