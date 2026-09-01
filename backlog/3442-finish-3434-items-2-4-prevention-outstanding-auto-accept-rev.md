---
bornAs: xp9fgj2
kind: story
size: 3
parent: "3434"
status: resolved
scope: ["we:scripts/lib/review-loop-policy.mjs", "we:scripts/lib/__tests__/review-loop-policy.test.mjs", "we:scripts/operations/review-loop-cli.mjs", "we:scripts/operations/__tests__/review-loop-cli.test.mjs", "we:skills-src/review/review-agent-brief.md", "we:backlog/3433-technically-enforce-review-dispatch-s-never-self-accept-neve.md"]
dateOpened: "2026-09-01"
dateStarted: "2026-09-01"
dateResolved: "2026-09-01"
tags: []
---

# Finish #3434 items 2-4: prevention-outstanding auto-accept, review-agent-brief update, reconcile #3433

`#3434` (ratified decision) made `review:pending` acceptance mechanical from a clean independent verdict.
Its Done-when item 1 already shipped (PR #1768, merged). This item finishes items 2-4, verbatim from
`#3434`'s own ratified text: give `prevention-outstanding` its own file-then-accept branch in
`reviewLoopAutoConfirm` instead of bouncing forever as `changes`; update the dispatched-reviewer brief so
its "stop here, don't resume yourself" instruction applies only to `review:human`; and reconcile `#3433`
(re-scope or close as superseded) so it never stands unreconciled against `#3434`'s new doctrine.

## Done when

1. **Executable** — `prevention-outstanding` gets its own branch in the function `reviewLoopAutoConfirm`, in
   `we:scripts/lib/review-loop-policy.mjs`: file the named prevention(s) (reusing the file-then-notify shape
   `buildAcceptQueueEntry` already established), then answer as accept-worthy rather than falling through to
   the generic `changes` answer — with a real test proving a `prevention-outstanding` verdict no longer
   bounces once its prevention is filed.
2. `we:skills-src/review/review-agent-brief.md` (the dispatched-reviewer brief) is updated to match — it
   currently instructs "queue it... stop here... do not run that resume command yourself" for what would
   otherwise be an accept; that instruction is now only correct for `review:human`, not for `review:pending`.
3. `we:backlog/3433-technically-enforce-review-dispatch-s-never-self-accept-neve.md` (`#3433`) is re-scoped
   (narrowed to `review:human` only, if anything is left to harden there) or closed as superseded by this
   decision — never left standing unreconciled, contradicting the new doctrine.
