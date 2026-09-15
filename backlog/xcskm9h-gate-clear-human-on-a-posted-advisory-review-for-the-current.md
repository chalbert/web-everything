---
kind: task
parent: "3589"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/review-escalation.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Gate clear-human on a posted advisory review for the current head

Implements the ratified ruling from #3589 (should clear-human wait for an independent review to actually run before the drain merges): (1) add a precondition to we:scripts/review-set-label.mjs's decideSetLabel clear-human target — refuse the clearance unless the PR already carries the advise step's (#3453) advisory-note comment for its CURRENT head, same guard-clause shape as the existing --actor/--reason checks in runReviewLabelCli; on refusal, name the fix (dispatch we:scripts/operations/review-dispatch.mjs --pr=<n>, or wait for the next conveyor tick, then retry clear-human). (2) we:scripts/operations/review-pr.mjs's renderAdvisoryNote posts no durable per-head marker today, so add a <!-- advisory-sha: <head-sha> --> marker mirroring buildReviewedShaMarker in we:scripts/lib/review-escalation.mjs — needed before the precondition check in (1) can be exact rather than a coarse does-any-advisory-comment-exist check (a real, accepted, bounded weakening until this lands, per the ratified item's stated residual). (3) wire the config toggle (Fork 3 of #3589, operational default ON) — a WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE-style env var following the existing WE_MERGE_BREAK_GLASS convention in we:scripts/merge-ai-prs.mjs — gating whether the new precondition in (1) is enforced.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/review-set-label.test.mjs` passes with new cases
   added for `decideSetLabel`'s `clear-human` target: (a) refuses (with the dispatch-fix message named) when
   no advisory-note comment is present for the PR's current head, (b) allows the existing clearance path
   unchanged when one is present, and (c) is a no-op (unchanged behavior) when the
   `WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE`-style toggle is off. A companion case in
   `we:scripts/operations/review-pr.mjs`'s test suite asserts `renderAdvisoryNote` now emits an
   `<!-- advisory-sha: <head-sha> -->` marker per #3589's stated residual.
