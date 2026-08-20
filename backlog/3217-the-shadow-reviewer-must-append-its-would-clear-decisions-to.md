---
bornAs: xu357cb
kind: story
size: 3
parent: "2405"
blockedBy: ["3214"]
status: open
dateOpened: "2026-08-20"
tags: []
---

# The shadow reviewer must append its would-clear decisions to the verdict ledger

The shadow reviewer decides what it would clear and only logs that to stderr, so the agreement history the enforce flip needs is never recorded anywhere durable. Appending those decisions to the same ledger is what turns the shadow period into evidence instead of a log nobody keeps.



## The seam that only logs

`#3007`'s own "What changes at the seams" names this: *"The shadow reviewer's would-clear decisions append
to the same ledger — giving the enforce flip the durable shadow-vs-human agreement history it requires."*
Phase 1 did not touch it, and the seam still only logs to stderr.

So the shadow period produces no record. The enforce flip's whole premise is that a week of agreement
between what the shadow reviewer *would* have cleared and what a human *did* clear is evidence — and that
comparison is impossible when one side is written to a terminal.

Independently useful: even if the authority never flips, a durable would-clear history is what makes the
shadow reviewer's accuracy measurable rather than asserted.

## Done when

Shadow would-clear decisions append through the same single owner as every other verdict row, marked as
shadow so they can never be mistaken for a real clearance, and the agreement summary can compare them
against the human verdicts for the same PR.
