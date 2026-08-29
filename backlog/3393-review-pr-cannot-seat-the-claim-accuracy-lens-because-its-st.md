---
bornAs: xjc0hgu
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-29"
relatedTo: ["3335", "3344", "3319", "3026"]
scope:
  - we:scripts/operations/review-pr.mjs
  - we:scripts/operations/__tests__/review-pr.test.mjs
  - we:scripts/lib/jury-core.mjs
tags: [review, jury, lens, operations, engine]
---

# review-pr cannot seat the claim-accuracy lens, because its step list is fixed at registration

`PANEL_LENSES` (`we:scripts/lib/jury-core.mjs`) carries five lenses; `we:scripts/operations/review-pr.mjs`
declares exactly two `judge` steps — `correctness` and `security` (#3319). A declared operation's steps are
fixed when it is REGISTERED, so no caller can seat a third: #3335 made a caller derive its lens set from the
touch-set, and #3344 made a selection seating no mandatory lens refuse, but neither can add a step to an
operation that never declared one. Every `review-pr` run therefore reports the same footer — *"The other 3
panel lens(es) (simplicity, standards-conformance, claim-accuracy) did NOT run"* — and records the shortfall
as STRUCTURAL. This item is that structure.

## The evidence, measured on PR #1680

The PR was a single backlog card. It took **three** human-verdict rounds on a byte-identical head, and both
blocking findings were CLAIM-ACCURACY findings — the card asserted things about existing code that were false:

| round | finding | shape |
| --- | --- | --- |
| 1 | the card claimed adding a target to `REVIEW_LABEL_TARGETS` writes no comment and no ledger row; `runReviewLabelCli` writes both unconditionally, and `decideSetLabel` falls through to the `changes` bounce | a claim about existing behaviour, false |
| 2 | the card's `Done when` cited `decideDrainAction`, which exists nowhere (the real decider is `decideReviewGate`) | a claim about an existing symbol, false |
| 3 | juror reduced to ACCEPT with **zero** findings on the same unchanged head | — |

The seated lenses reduced to `accept` in rounds 2 and 3; a human override supplied both verdicts. The lens
built for exactly this class was available and structurally could not sit. `we:scripts/lib/jury-core.mjs:713`
already records the counter-evidence that it is worth seating — on PR #1569 the `claim-accuracy` juror found a
real defect two rounds before any other lens.

## What this is NOT

- NOT "run all five lenses always". The care dial exists, and this PR's touch-set scored care `none`; the
  point is that the dial cannot ASK for a lens the operation never declared.
- NOT a re-open of #3319. That item ruled the cheapest wiring for a second lens and was right to; this is the
  generalisation its own trade-off note defers.
- NOT #3026. That gate resolves whether a cited SYMBOL exists; round 1's finding was a false claim about a
  symbol that does exist. A lint cannot answer it, which is why it needs a lens.

## The shape question

1. **Declare all five `judge` steps and let a `skip` verdict retire the unearned ones.** Keeps the step list
   static and honest; costs a spawn decision per lens per run.
2. **Make the step list a function of the derived lens set** — the operation declares a lens-parameterised
   judge stage rather than N named steps. Strongest, and the biggest change to the engine's registration
   contract.
3. **A second operation** (`review-claims`) the caller runs alongside. Rejected on the same ground #3319
   rejected two sequential `review-pr` runs: two verdicts on one PR with no declared reduction between them.

(2) is the one that ends the class; (1) is the one that could land this week. The call belongs with whoever
owns the engine's registration contract (#3029), not to this card.

## Done when

1. **Executable** — a test in `we:scripts/operations/__tests__/review-pr.test.mjs` pins that a run whose
   derived lens set includes `claim-accuracy` actually seats a juror for it, failing today.
2. **Executable** — the `review-pr` declaration's own step listing (via `we:scripts/operations/run.mjs`)
   reports a lens set that is not hard-coded to two members.
3. The run footer stops reporting a STRUCTURAL shortfall for a lens the touch-set earned.
