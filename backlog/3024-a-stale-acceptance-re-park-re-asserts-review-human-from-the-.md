---
bornAs: xfdgdln
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
blockedBy: ["xxdslno"]
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

## What this item is — the BUILD side only; the fork was carved out on 2026-08-09

This item originally carried three steps: prepare the fork, ratify it, then implement. **Steps 1 and 2 no longer
live here.** Per the fork-flip-or-carve rule
([we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)) a fork never lives inline in a story body,
so the 2026-08-09 consolidation carved it to its own item:

> **`#xxdslno`** — *What a stale-acceptance re-park does to a cleared PR — whole-PR score, uncovered-delta score,
> or a fourth `review:stale` hold tier.* It is now a **three-way** fork: it also absorbed the `review:stale`
> fourth-tier proposal that PR #1124's write-up made and #3039 said was "filed separately rather than smuggled in
> here" but never was. That decision item carries the full option set, the hard cases, and the prep still owed.

What remains here is **step 3 only**: once `#xxdslno` rules for the delta-only score, implement the narrowing,
with the leash-cannot-shrink invariants extended to cover it. This item is `blockedBy: xxdslno` and may not be
built before it resolves. **Until then the current whole-PR behaviour is the fail-closed one and stays.**

Two facts the carved decision turns on, kept here because they are this item's own findings:

- The reconciliation is really **three-way**, not two-way, and its first question is *how much of this hole
  survives once the false stale stops firing.* This item and the `review:stale` proposal both assume the re-park
  on #1106 was *correct*. It was not — the contribution digest diverged on a byte-identical contribution because
  `main` grew a different number of lines above two of the lane's hunks (re-derived by script 2026-08-09:
  1,534 projection lines each side, exactly two differing, both gap values). That root cause is the umbrella
  `#x5p1xz8` ([#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) plus
  `#x0pfbqp`), the layer above both options — a fix there would have prevented #1106 entirely.
- The hard case any delta-only score must still catch: a head advance that **MOVES** a leash-path edit rather
  than adding one.

Related: [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (parent),
[#2840](/backlog/2840/), [#2409](/backlog/2409/), [#2771](/backlog/2771/),
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) (the
notice-on-revocation fix; its code landed in PR #1124, merged 2026-08-09T11:50:32Z, and the card was resolved
2026-08-09 once its notice was observed firing in production on PR #1100 at 12:20:59Z), `#xxdslno` (the carved
fork this item is blocked on), `#x5p1xz8` (the false-stale umbrella, the layer above), `#3046` and `#x0pfbqp`
(its two slices — the false-stale root causes).
