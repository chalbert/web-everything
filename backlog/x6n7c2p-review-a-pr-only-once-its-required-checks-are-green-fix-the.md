---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/review-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Review a PR only once its required checks are green: fix the tests first, then review

Operator rule, 2026-10-01: "test should be first fixed then the review". Live case PR #3432: review round 2 accepted at 9:42 PM ET while CI was red (a CI heal ran right after), and round 3 started at 10:05 PM before daemon-soak finished; daemon-soak then failed at 10:07 PM. Three review rounds were spent on a PR whose required checks were not green. The draft-first gate (promote-draft) only holds drafts; a ready PR re-armed after a fix or CI heal is reviewed straight away. Fix: the review dispatch (we:scripts/conveyor/reconcile-core.mjs dispatchReviewRow, we:scripts/conveyor/review-dispatch.mjs) requires every required check green on the current head for EVERY PR, not only drafts; a pending check waits, a red one goes to CI heal first. Replay #3432.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
