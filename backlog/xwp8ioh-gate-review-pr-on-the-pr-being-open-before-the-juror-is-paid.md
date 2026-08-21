---
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# Gate review-pr on the PR being OPEN, before the juror is paid

The inert-verdict predicate already exists and works: we:scripts/review-set-label.mjs refuses a verdict on a non-OPEN PR (#2953). But it only runs at the END of the chain, inside CI, after jurors have been paid. we:scripts/operations/review-pr-io.mjs reads no PR state at all. On 2026-08-20 that cost three juror rounds (~$4) and five orphaned commits against PR #1503, which had merged two hours before round 1 started. Lift the same predicate into review-pr.read so the refusal happens before the judge step — single-home style: shell the existing home, classify what it said, never reimplement it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## BUILT AND MERGED — resolved 2026-08-21, before this card landed

`the read-side liveness gate` shipped in #1507 while this PR was still open, so the card would have
landed describing an already-closed gap. Caught by the PR's own correctness juror,
which is the right outcome: filing a gap and then closing it in the same session is
exactly how a backlog accumulates stale open cards.

Landed as `we:scripts/lib/pr-liveness.mjs`. The measurement and rationale above are kept rather than
deleted — they are why the operation exists, and a resolved card is the audit trail.

This is the same failure mode as `#x2sqf62` (~12% of prepared cards described work
already done). Two more would have been added by the very PR that reports it.
