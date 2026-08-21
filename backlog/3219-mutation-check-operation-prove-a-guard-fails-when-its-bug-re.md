---
bornAs: x4omld5
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# mutation-check operation — prove a guard fails when its bug returns

Three vacuous tests reached a paid juror in one session (PR #1503 rounds 1, 2, 3), each a guard that could not fail: one returned early when the corpus lacked hash ids, one compared the live corpus against itself. Each time the fix was the same hand-rolled procedure — patch the impl, run the guard, assert it FAILS, restore — done as ad-hoc python heredocs with no record. Declare it: required input (the mutant), three-valued outcome (killed / survived / unrun), and survived is BLOCKING. unrun is never folded into killed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## BUILT AND MERGED — resolved 2026-08-21, before this card landed

`mutation-check` shipped in #1509 while this PR was still open, so the card would have
landed describing an already-closed gap. Caught by the PR's own correctness juror,
which is the right outcome: filing a gap and then closing it in the same session is
exactly how a backlog accumulates stale open cards.

Landed as `we:scripts/operations/mutation-check.mjs`. The measurement and rationale above are kept rather than
deleted — they are why the operation exists, and a resolved card is the audit trail.

This is the same failure mode as `#x2sqf62` (~12% of prepared cards described work
already done). Two more would have been added by the very PR that reports it.
