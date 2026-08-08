---
bornAs: xfdgdln
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: [gate, review, drain, review-escalation, declarative-leash, ratification]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:docs/agent/platform-decisions.md
---

# A stale-acceptance re-park re-asserts review:human from the whole-PR score, not the uncovered delta

After a genuine head advance the drain re-parks `review:human` whenever the FRESH whole-PR score says the diff touches the declarative leash, even when the new commit does not — so a clearance is re-gated over content the human already saw. Narrowing it to the delta-since-clearance moves the human boundary, so it needs ratification, not an impl call.

## Where this came from

This is rule 2 of [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/),
carried out of PR #1119 as its stated residual. That PR shipped rules 1 and 3 and resolved the parent; the
round-1 review flagged (major 3) that a deferral under a resolved parent is a deferral that disappears. This is
the item that keeps it on the board.

## The behaviour today

`decideReviewGate` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)) re-parks a stale
acceptance with a label derived from `score.humanRequired`, and `score` is computed over the **whole PR's**
changed-file set — the same set the original clearance covered. So a PR that was cleared for a gate-self edit,
then advances its head by one commit touching nothing but a README, is re-parked `review:human`: the leash
verdict is re-derived from files the human already read and signed off.

The correct reading is that the re-park should score only the paths the clearance did **not** cover — the
delta between the reviewed tree and the live head. On that reading the README commit re-parks `review:pending`
(an owed agent review of new content), and only a new commit that itself touches a leash path re-parks
`review:human`.

## Why it was not done in PR #1119

Narrowing `review:human` changes **what the declarative leash covers**, which is a principle edit, not an impl
one. Statute `#review-human-declarative-leash-only` plus [#2840](/backlog/2840/)'s "the leash split is
fail-closed and cannot shrink" put the boundary itself under ratification
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md), `#principle-and-impl-two-pr`). An
impl PR may not author it.

## What this item is

1. **Prepare the fork** — state the option set and the bold default for "does a stale-acceptance re-park score
   the whole PR or the uncovered delta?", with the fail-closed argument on both sides. The hard case is a head
   advance that MOVES a leash-path edit rather than adding one; a delta-only score must still catch that.
2. **Ratify it** as a principle change (statute edit + `codifiedIn`), separately from any code.
3. **Only then** implement the narrowing, with the leash-cannot-shrink invariants extended to cover it.

Until (2) lands, the current whole-PR behaviour is the fail-closed one and stays.

Related: [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (parent),
[#2840](/backlog/2840/), [#2409](/backlog/2409/), [#2771](/backlog/2771/).
