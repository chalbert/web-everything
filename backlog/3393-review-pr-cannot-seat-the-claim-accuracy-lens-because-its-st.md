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

## Confirmed again, still open (2026-09-14) — the opening claim's seat count is now stale; the gap itself is not

**Correction, not a resolve.** This card's opening paragraph says `we:scripts/operations/review-pr.mjs`
"declares exactly two `judge` steps — `correctness` and `security`". That is no longer accurate: reading the
live declaration directly (`we:scripts/operations/review-pr.mjs`, current `main`) shows FIVE named seats now
exist — `judge` (correctness), `judgeSecurity` (#3319), `judgeAdvisory` (`ADVISORY_JUDGE_LENS`, the third
seat), a `codex-correctness` advisory seat gated by `REVIEW_PR_CODEX_CORRECTNESS_ADVISORY`, and
`judgeAntigravityReview` (`ANTIGRAVITY_REVIEW_LENS`, the fourth seat, deliberately kept OUT of
`PANEL_LENSES`/`MANDATORY_LENSES` like the codex-correctness seat). Three more seats were bolted on, one named
step at a time, exactly the shape this card's own shape-question option (1) describes ("declare all five
`judge` steps") — except it went past five, into two seats that sit outside `PANEL_LENSES` entirely, and it
still stopped short: `standards-conformance` and `claim-accuracy`, both real `PANEL_LENSES` members, still
have no declared step anywhere in the operation.

**Live reproduction, PR #2206 (`readiness: heavy-command-pool container POC`, epic #3383).** An independent
jury review of that PR (`we:.operations/review/review-pr-744615b3-.../chalbert-web-everything-2206-verdict.md`)
scored its touch-set care `elevated` (blast-radius + size), which `panelRigorForCareLevel('elevated')` asks 5
lenses for. Five lenses DID seat — correctness, security, simplicity, codex-correctness, antigravity-review —
and the verdict recorded the shortfall in the same words this card already uses: *"SHORTFALL: 2 earned
lens(es) (standards-conformance, claim-accuracy) did not sit... The shortfall is structural — the step list is
fixed at registration (#3319) — so it is RECORDED here rather than implied away."* Same failure class this
card names, on a real PR, five weeks after this card was filed and still open. Filed as a fresh confirming
instance rather than a new card — checked `we:backlog/` for anything else covering this shape first; nothing
else does. `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md` carries a short
session-log pointer to this note for anyone scanning the epic.

**Why this still matters beyond one PR.** The caller declared no `--careLevel` on that run, so nothing checked
the seated shape against what the touch-set earned (`#3335`'s own declared-shape check only refuses an
UNDER-declaration; it does not add a seat). Any PR whose derived care level asks for more than the five
ad-hoc-named seats that exist today — in particular anything that earns `standards-conformance` or
`claim-accuracy` specifically, which is exactly the class `claim-accuracy` was built to catch (see the PR
#1680 evidence above) — gets a lighter review than its own care dial says it should, silently, because the
record only states what ran, never that the run fell short of what was earned. This card's `Done when` #2 is
now arguably true in letter (five hard-coded seats, not two) but not in spirit: the count grew ad hoc, not
because #3393 shipped, and #1 and #3 remain false. Not resolved by this note.
