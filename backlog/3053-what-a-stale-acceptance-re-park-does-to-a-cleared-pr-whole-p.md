---
bornAs: xxdslno
kind: decision
status: open
dateOpened: "2026-08-09"
tags: [gate, review, drain, review-escalation, declarative-leash, ratification]
---

# What a stale-acceptance re-park does to a cleared PR — whole-PR score, uncovered-delta score, or a fourth `review:stale` hold tier

Three mutually-weakening approaches to the same hole compete with no ruling, and each has been proposed
independently: keep the whole-PR score (status quo, fail-closed), narrow the re-park score to the **uncovered
delta** ([#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/)), or add a fourth
**`review:stale`** hold tier that is neither operator-only nor agent-clearable (deferred by
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) and, until this item, never
filed). Each makes the others largely unnecessary; none may be built before this is ruled. Carved out of #3024
per the fork-flip-or-carve rule in
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) — a fork never lives inline in a story body.

## Why this exists as its own item

Two separate write-ups arrived at the same hole from opposite ends and neither could ratify the other:

- #3024 keeps three hold tiers and narrows **which** one a stale re-park applies.
- PR #1124's write-up proposes a **fourth** tier so the re-park stops landing on an operator-only label at all.
  #3039 states of that proposal, verbatim, "A fourth hold tier touches ~10 consumers plus the policy contract and
  its conformance suite. **Filed separately rather than smuggled in here.**" It was **not** filed separately — a
  grep of every item in `we:backlog/` for `review:stale` and "hold tier" returned only #3039's own sentence. This
  item is that filing, folded into #3024's fork rather than opened as a sixth card on one hole.

Both options change what a stale re-park does to a cleared PR, and each weakens the other's argument: a new tier
that is neither operator-only nor agent-clearable removes much of the reason to re-score the delta, and a
delta-scored re-park removes much of the reason for a new tier. They are **not** complementary refinements.

## The precondition that reframes the whole fork

Both options above assume the re-park on WE PR #1106 was *correct*. **It was not.** The contribution digest
diverged on a byte-identical contribution because `main` grew a different number of lines above two of the lane's
hunks — re-derived by script for this filing: 1,534 projection lines on each side, exactly two differing, both
inter-hunk gap values (`~424 → ~439`, `~324 → ~328`). That root cause is the umbrella `#3054`
([#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) plus `#3052`), which is
the layer *above* both options here — a fix there would have prevented #1106 entirely.

So this is a **three-way** reconciliation, and its first question is: **how much of this hole survives once the
false stale stops firing?** If the answer is "very little", the status quo may be the correct ruling and both
proposals become dead weight. The umbrella `#3054` is `blockedBy` this item so the ruling lands before the
digest work commits to a shape.

## Option A — keep the whole-PR score (status quo)

`decideReviewGate` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)) re-parks a stale
acceptance with a label derived from `score.humanRequired`, and `score` is computed over the **whole PR's**
changed-file set — the same set the original clearance covered. A PR cleared for a gate-self edit that then
advances its head by one commit touching nothing but a README is re-parked `review:human`: the leash verdict is
re-derived from files the human already read and signed off.

*On merit:* it is the fail-closed reading, and it is the ratified posture today. Statute
`#review-human-declarative-leash-only` plus [#2840](/backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat/)'s
"the leash split is fail-closed and cannot shrink" put the boundary itself under ratification
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md), `#principle-and-impl-two-pr`). Until
this item resolves, **A is what stands.**

## Option B — score only the uncovered delta (#3024)

Score only the paths the clearance did **not** cover — the delta between the reviewed tree and the live head. On
that reading the README commit re-parks `review:pending` (an owed agent review of new content), and only a new
commit that itself touches a leash path re-parks `review:human`.

*On merit:* it stops re-gating a human over content that human already saw, which is the actual complaint.

*The hard case a delta-only score must still catch:* a head advance that **MOVES** a leash-path edit rather than
adding one. A naive path-set delta sees no new leash path and clears; the leash has in fact been re-written.

*Why it was not done in PR #1119:* narrowing `review:human` changes **what the declarative leash covers**, which
is a principle edit, not an impl one. An impl PR may not author it. #3024 is the build item that carries this
option; it is `blockedBy` this decision and may not be implemented before it resolves.

## Option C — a fourth `review:stale` hold tier (#3039's unfiled deferral, folded in here)

`review:stale` means: *an operator clearance exists, the tree moved past it, the PR is held pending
re-confirmation, and no agent may clear it.* The re-park then stops landing on an operator-only label at all.

*Why #3039 could not simply drop or downgrade the hold instead* — both alternatives were checked and both fail:

- **Dropping the hold entirely** leaves `review:accepted` alone, which `hasUnclearedReviewLabel` reads as cleared
  — the bare `/merge` sweep would land a tree the reviewer never saw (the
  [#2366](/backlog/2366-merge-step-must-refuse-an-un-cleared-review-pending-pr-concu/) hole).
- **Downgrading to `review:pending`** makes a gate-self PR agent-clearable: `decideSetLabel` refuses
  `--to=accepted` only on a `review:human` PR, and [we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs)
  writes `review:accepted` unattended in `enforce` mode. That hands an agent the
  [#2285](/backlog/2285-negotiated-agent-review-for-the-drain/) clearance.

*On merit:* it is the only option that makes the revocation **impossible** rather than merely loud or narrower.

*Its cost, as #3039 states it:* a fourth tier touches roughly **ten label consumers** plus the policy contract and
its conformance suite. That is the largest of the three by a wide margin, and it is the reason it was deferred out
of PR #1124 rather than built there.

## Prep still owed — no `preparedDate`, do not rule this cold

Per *Never Take An Unprepared Decision*, prep must:

1. **Answer the precondition first** — quantify how much of the hole survives once `#3054` lands. This is the
   gating question, not a footnote.
2. **Enumerate the `review:stale` blast radius for real** — the "~10 consumers" figure is from PR #1124's
   write-up and is **unreplicated**. Grep the actual `REVIEW_LABELS` / `hasUnclearedReviewLabel` call sites and
   the policy-contract conformance suite and produce a counted list.
   [#2990](/backlog/2990-check-standards-rule-every-hasunclearedreviewlabel-call-site/) is the existing item on
   that call-site surface and should be read first.
3. **Run the statute-overlap check** — draft the rule each option would codify and grep
   [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) for anchors on the same turf
   (`#review-human-declarative-leash-only`, `#principle-and-impl-two-pr`), reconciling any overlap **before**
   `preparedDate` is stamped.
4. **State a bold default** and red-team it — in particular, red-team B's move-a-leash-edit case and C's claim
   that a fourth tier is genuinely neither operator-only nor agent-clearable across all ten consumers.

## Bold default (provisional, unprepared — not a ruling)

**A, pending (1).** Not because A is good, but because the precondition may dissolve most of the hole, and both B
and C are irreversible boundary moves paid for with a hole that might not survive the digest fix. If (1) shows a
substantial residual, the tentative preference inverts to **C** — it is the only option that closes the class,
and B's move-a-leash-edit case is exactly the kind of gap a fail-closed statute should not be asked to carry.
Whoever prepares this should treat that inversion as a claim to attack, not inherit.

Related: [#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) (the build side of
option B), [#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) (where option C
was deferred, resolved),
[#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (rule 2 of which is where
option B came from, resolved),
[#2771](/backlog/2771-narrow-the-review-human-escalation-criteria-implementation-m/) (the prior narrowing of the
same criteria, resolved),
[#2840](/backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat/) (the leash-cannot-shrink
ruling, resolved).
