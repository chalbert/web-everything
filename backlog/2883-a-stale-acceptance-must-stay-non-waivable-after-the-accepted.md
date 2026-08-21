---
bornAs: xh3d4ub
kind: story
size: 2
status: open
relatedTo: ["2409", "2423"]
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-08-02"
tags: [gate, review, drain]
---

# A stale acceptance must stay non-waivable after the accepted label is stripped

Should the `--no-review-escalation=<pr>` valve be able to waive an `accepted + pending` PR — the label pair that can only mean the drain re-parked a stale acceptance? Today it can, deliberately and by a tested assertion. The original mechanism this card described (the drain stripping `review:accepted` on a re-park, leaving a one-pass window) **ended with #3023 and no longer exists**; the surviving question is the narrower one above, and it is a ruling to make, not a defect to fix. See the two dated notes below, then *Design*.

## The one-pass window

`applyEscalationRelief` (`we:scripts/merge-ai-prs.mjs`) is explicit that the #2409 stale-acceptance re-park is a different concern from a "review never arrived" pending park, and that "the pending-relief valve must NEVER waive it — a fresh look is required".

But the same pass that raises `staleAcceptance` also drops the now-stale `review:accepted` label (the add-first/remove-last block, deliberately ordered so a partial `gh` failure re-triggers the stale check rather than yielding a bare mergeable PR). On the NEXT pass the PR carries only `review:pending`, so `decideReviewGate` never enters the `hasReviewLabel(accepted)` branch, `staleAcceptance` is never raised, and `applyEscalationRelief` sees an ordinary agent-reviewable pending park — which it waives.

So the guard is live for exactly one pass. After that, `--no-review-escalation=<pr>` waives the very thing the guard names as non-waivable.

## Observed

PR #983 on 2026-08-02. After the drain re-parked a valid human acceptance as stale, a scoped `--no-review-escalation=983` waived the park and merged the PR — reported as "agent-reviewable review:pending waived to a merge (#2423)", with no trace of the stale acceptance the previous pass had refused to waive.

The merge itself was correct on the facts (the net patch was proven byte-identical to the accepted tree), but it went through a valve that had explicitly declined that case one pass earlier. The gate did not decide it; the label churn did.

## Why it happens

The non-waivable condition is derived from **transient label state** rather than from the durable evidence, even though the durable evidence exists and outlives the label: the `reviewed-sha` marker is an ordinary PR comment, and `parseReviewedSha` reads it regardless of what labels are present. Only `decideReviewGate`'s control flow makes it unreachable, by consulting freshness solely inside the accepted-label branch.

Note the tension to resolve rather than paper over: making the marker authoritative regardless of labels means a PR that was ever accepted-and-then-rebased stays non-waivable until it is re-accepted. That is arguably the correct reading of #2409, but it removes an escape the operator currently has, so it should be a deliberate call, not a side effect. Cross-check with the sibling question in the companion item on sha-identity-vs-content coverage.

## 2026-08-12 — THE STATED MECHANISM NO LONGER HOLDS, BUT THE CONCERN SURVIVES BY ANOTHER ROUTE

**Read this before building.** This card is agent-ready and its central mechanism is out of date. Do not build
it as written, and do not close it either.

**What is now false.** The premise above — *"the same pass that raises `staleAcceptance` also drops the
now-stale `review:accepted` label"* — describes behaviour that ended with `#3023`. The drain does **not**
remove `review:accepted` on a re-park. Established four independent ways during #3053 and re-verified by the
independent review of PR #1160:

- `decideReviewGate` is pure and issues no `gh` call, so it cannot drop a label at all.
- The drain's park branch makes exactly two label writes: the hold `--add-label`, and `stripReadyOnPark`, whose
  body removes `ready-to-merge` only (`stripReadyOnPark` in
  [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) — find it by name; it sits near line 3204 as of
  2026-08-21, not the L2976 this note was filed with).
- Repo-wide, the live `--remove-label` sites are CI-lifecycle labels, `ready-to-merge` twice, and the
  reviewer's own swap in [we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs) — the
  `to === 'accepted'` branch of `decideSetLabel` and its `gh pr edit` execution; the L242 this note was filed
  with now lands inside the unrelated `restamp` branch.
- A landed invariant pins the absence:
  [we:scripts/lib/__tests__/gate-invariants.test.mjs](../scripts/lib/__tests__/gate-invariants.test.mjs#L612).

So the "one-pass window" is gone: on the next pass the PR carries `accepted + pending`, not a bare `pending`.

**What survives, and it is the same concern by a different path.** `hasUnclearedReviewLabel` refuses the
`accepted + pending` pair by default — but the operator valve does not. Measured 2026-08-12:

| labels | default | with `allowPending` (`--no-review-escalation=<pr>`) |
| --- | --- | --- |
| `accepted` + `pending` | refused | **waived** |

That pair is producible by no sanctioned writer, so it *means* "the drain re-parked a stale accept" — exactly
the state this card says must stay non-waivable. The valve still waives it. The hole this item names is real;
only its explanation was overtaken.

**So the item needs re-deriving, not building or closing.** Its "Definition of done" below still assumes the
strip, and its fourth bullet pins a sequence that can no longer occur.

- A park is treated as a stale acceptance whenever a `reviewed-sha` marker exists and the live head has advanced past it — whether or not `review:accepted` is still on the PR.
- `applyEscalationRelief` refuses that park on every subsequent pass, not just the one where the label was stripped.
- The operator retains a documented way out, and it is named in the refusal message rather than left to be discovered.
- A test pins the multi-pass sequence: accept → head advances → pass 1 re-parks and strips → pass 2 with `--no-review-escalation=<pr>` still refuses.

**Superseded by the 2026-08-12 note above** — the strip no longer happens, so the fourth bullet pins a sequence
that cannot occur, and the first three are written against a label transition that is gone. The surviving
question is narrower: should `allowPending` waive an `accepted + pending` pair, given that pair means a stale
re-park and no sanctioned writer produces it?

## Re-grounded 2026-08-21 — the surviving behaviour is deliberate, tested, and reasoned in place

**The remaining question is a RULING, not a build.** The waiver this card wants closed is not an oversight that
survived review; it is a decision the #x9xqexm round-2 review made explicitly, and both the code and its
invariant test say so in as many words.

`hasUnclearedReviewLabel` (we:scripts/lib/review-escalation.mjs) reads, in order:

1. `review:human` present → refuse (always, regardless of `allowPending`);
2. `!allowPending && review:pending` → refuse;
3. `review:accepted` present → clear;
4. else `review:changes`.

Step 2 sits **above** step 3 on purpose. Its own comment: *"`allowPending: true` still waives it — that is the
#2423 relief valve, an operator naming one PR explicitly, and it is deliberately checked BEFORE the accept
short-circuit so the waiver reads identically with or without a co-present accept."* And INVARIANT 5 in
[we:scripts/lib/__tests__/gate-invariants.test.mjs](../scripts/lib/__tests__/gate-invariants.test.mjs) already
asserts exactly this outcome over the powerset of label sets — `accepted + pending` is `true` (refused) at
`allowPending: false` and `false` (waived) at `allowPending: true`, with the reason inline.

**`applyEscalationRelief` is a different function on a different path, and it is not the one that lets this
through.** It (we:scripts/merge-ai-prs.mjs) still refuses a `gate.staleAcceptance` park unconditionally, and
`decideReviewGate` still raises `staleAcceptance` on **every** pass now that the accept survives — so the
"survives exactly one pass" claim is false twice over. The waiver reaches the merge through `classifyPr`'s
`reviewUncleared` (which calls `hasUnclearedReviewLabel` with the per-PR `allowPendingReview`), a
**non-scoring** path that never consults `decideReviewGate` at all. Any build must target that call, not
`applyEscalationRelief`.

**So the honest options are two, and choosing between them is the work:**

- **Keep it.** `--no-review-escalation=<pr>` is the operator naming one PR by number after looking at it. That
  is the same class of act as a human accept, and #2423 exists precisely because there is no review timeout. On
  this reading the card is already satisfied by the default path, and the item closes with no code change.
- **Tighten it.** Make step 2 refuse the pair even under `allowPending`, on the ground that `accepted + pending`
  carries *information* a bare `pending` does not — "a human accepted this, and then the tree moved". The
  operator's escape then becomes the explicit one: re-accept through
  [we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs) (`--to=accepted`, or `--to=restamp` to
  carry an existing acceptance across a content-preserving rebase — that target exists for this exact shape).

The second is the reading the card argues for, and it is defensible — but it removes an escape, it edits a
gate-self file, and it must flip a landed assertion. **This should be retyped `kind: decision` before it is
worked**, or ruled inline by the operator; it is not a story an agent can pick up and build. Left as-is here
because retyping is not a preparation action.

## Done when

**This item cannot carry a tier-1 criterion as filed, and that is the finding, not a gap in the write-up.**
There is no failing-then-passing command available: the behaviour in question is already asserted green by
INVARIANT 5, and the only change that would make a new test meaningful is the ruling itself. A criterion that
"a test now asserts the opposite" would be pinning a decision that has not been made.

- **Tier 2** — the ruling is recorded where the behaviour is, not only on this card: whichever way it goes, the
  `accepted + pending` line in INVARIANT 5 of
  [we:scripts/lib/__tests__/gate-invariants.test.mjs](../scripts/lib/__tests__/gate-invariants.test.mjs) and the
  step-2 comment in `hasUnclearedReviewLabel` (we:scripts/lib/review-escalation.mjs) cite this item's number and
  the date of the call. `grep -n "2883" we:scripts/lib/review-escalation.mjs` returns a hit.
- **Tier 2 (only if the ruling is "tighten")** — a test in the same INVARIANT 5 block asserts
  `hasUnclearedReviewLabel([accepted, pending], { allowPending: true })` is `true`, and the previously-green
  assertion is *changed*, not deleted — a weakened invariant must be a visible diff, not an absence.
- **Tier 2 (only if the ruling is "tighten")** — the refusal names the way out. The message reachable from the
  refusing path cites `--to=accepted` / `--to=restamp` on we:scripts/review-set-label.mjs by name, so the
  operator is not left to discover it — and **only `--to=accepted` actually works here**. Verified
  2026-08-21: `decideSetLabel`'s `restamp` branch returns `removeLabels: []`, so on an `accepted + pending` PR
  a re-stamp succeeds while changing no label and leaves the hold in place; only `--to=accepted` carries
  `REVIEW_LABELS.pending` in `removeLabels`. Citing `restamp` as the escape would send the operator down a
  no-op. Grep the refusal string for `--to=accepted` and confirm `restamp` is NOT offered as the way out.
- **Tier 2 (only if the ruling is "tighten")** — the escape the message names is proven, not asserted: a test
  drives `decideSetLabel` with the exact refused label state and confirms the cited target's `removeLabels`
  actually clears `hasUnclearedReviewLabel`. That is the deterministic guard against re-introducing the
  restamp mis-citation this preparation nearly shipped.
- **Tier 3** — the body no longer asserts the dead mechanism. Read the card top to bottom: the digest, "The
  one-pass window" and the old "Definition of done" bullets are all explicitly marked superseded, and nothing
  instructs a builder to change `applyEscalationRelief` (the wrong function for this hole).

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — The card's body is itself a three-round premise re-verification. I independently re-traced the load-bearing claims against the live tree: decideParkReadyStrip (we:scripts/lib/review-escalation.mjs:1585-1592) removes ready-to-merge only, never review:accepted/review:pending; decideReviewGate (we:scripts/lib/review-escalation.mjs:2000-2066) is pure (no gh call) and re-enters the accepted branch on every pass since the accept now survives a re-park, so staleAcceptance re-fires every pass, not once; the only --remove-label sites in we:scripts/merge-ai-prs.mjs are the ci-lifecycle reconcile (line 2863) and stripReadyOnPark (ready-to-merge only, line 3204-3208) - no site removes a review:* label. we:scripts/lib/__tests__/gate-invariants.test.mjs INVARIANT 5 (lines 343-394) matches the card's table exactly. The 2026-08-21 claim that classifyPr's reviewUncleared (via buildDrainVerdicts's allowPendingReview, we:scripts/merge-ai-prs.mjs:1236-1244), not applyEscalationRelief, is what lets the waiver through also checks out: applyEscalationRelief only runs for candidates classifyPr already set to decision:'merge', and for a reviewHeld PR nothing in the gate.action==='merge' branch flips v.decision back from 'skip' (loop guard at we:scripts/merge-ai-prs.mjs:3260, fall-through at line 3491).
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The ruling targets one shared predicate, hasUnclearedReviewLabel, and every caller (classifyPr, the couple-gate reconcile, labelOnGreenVerdict, the bare-sweep refusal in we:scripts/merge-ai-prs.mjs; we:scripts/pr-land.mjs:399) derives from it, so a change propagates uniformly without separate wiring. A companion backlog item (we:backlog/2990-check-standards-rule-every-hasunclearedreviewlabel-call-site.md) already enumerates and gates these call sites by a different mechanism, so the ES-import side is doubly covered. I did not find evidence the card checked for subprocess/hook callers of the `--no-review-escalation` CLI flag itself, but the flag is an operator-typed drain arg, not something automated call sites invoke, so this is low-relevance here.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:scripts/lib/__tests__/gate-invariants.test.mjs's INVARIANT 5 already round-trips hasUnclearedReviewLabel over the full label powerset at the seam between we:scripts/lib/review-escalation.mjs and we:scripts/merge-ai-prs.mjs, and the card's Tier-2 (tighten-only) DoD bullet requires that same test file's assertion to be edited, keeping the round-trip test authoritative.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Tier-2 (tighten-only) DoD bullet explicitly requires the previously-green INVARIANT-5 assertion to be CHANGED, not merely supplemented by a new one alongside it - directly guards against the guard becoming decorative (an unreachable old assertion sitting next to a new one).
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card requires (Tier-2, tighten-only) that the refusal message name a documented way out, citing --to=accepted and --to=restamp on we:scripts/review-set-label.mjs by name. I traced decideSetLabel's restamp branch (we:scripts/review-set-label.mjs, the `to === 'restamp'` block, ~lines 214-244): it returns `removeLabels: []` and never touches review:pending - only `--to=accepted` does (its removeLabels includes REVIEW_LABELS.pending, per the docblock at lines 108-110 and the code at ~line 173/the accepted branch). So for a PR that already carries accepted+pending (the exact state the tighten refusal fires on), restamp is not a working recovery route: it succeeds silently (allowed:true) but changes no label, leaving the PR parked. Only --to=accepted (a fresh re-review) actually clears the hold. Disposition: introduced=true (this citation is new content the card itself authors in its DoD), worseThanBase=true (citing a non-working escape actively misdirects a future implementer/operator, worse than no guidance at all), parallelizable=true (a wording fix to the DoD bullet, or a decideSetLabel change to have restamp also strip a stale pending, is independent of the keep/tighten ruling) -> carve-out, not a blocker. impactIfUnfixed: degraded (an operator following the refusal message wastes a cycle on a no-op restamp before finding --to=accepted works; nothing is lost or silently skipped). rootCause: the preparation read restamp's stated purpose ('carry an acceptance across a content-preserving rebase') as covering the already-parked recovery case too, without tracing decideSetLabel's actual removeLabels for that branch. prevention: a deterministic test tying the refusal message's cited escape(s) to decideSetLabel's real removeLabels for that target against the exact refused label-state (e.g. assert decideSetLabel({to:'restamp', currentLabels:[accepted,pending]}) actually clears hasUnclearedReviewLabel before a refusal message may cite it). preventionCaptured: false - no such test exists today; would need filing.

**Corrections applied by this review:**

- The card cites we:scripts/merge-ai-prs.mjs#L2976 for stripReadyOnPark; in the live tree that function is defined at we:scripts/merge-ai-prs.mjs:3204, not 2976.
- The card cites we:scripts/review-set-label.mjs#L242 as 'the reviewer's own swap' (the --to=accepted label removal); line 242 in the live tree falls inside the unrelated `restamp` branch (`keepsHuman: isHuman,`) - the actual --to=accepted swap logic is at we:scripts/review-set-label.mjs:108-177 and its `gh pr edit` execution is at we:scripts/review-set-label.mjs:755-758.

A rigorous, self-correcting re-grounding note whose technical claims all check out against the live repo; one narrow, non-blocking gap in the tighten-branch DoD's escape-hatch citation, plus two stale line-number citations.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** All three points accepted and applied, each re-verified. The
**legibility** finding was correct and is the one that mattered: `decideSetLabel`'s `restamp` branch returns
`removeLabels: []` (read at source), so on the exact `accepted + pending` state the tighten-branch refusal
would fire on, a re-stamp is a no-op and only `--to=accepted` (whose `removeLabels` carries
`REVIEW_LABELS.pending`) clears the hold. The criterion now names `--to=accepted` only, forbids offering
`restamp`, and adds the reviewer's own suggested prevention as a further tier-2 bullet. Both stale line
citations in the 2026-08-12 note are replaced with find-by-name references.
