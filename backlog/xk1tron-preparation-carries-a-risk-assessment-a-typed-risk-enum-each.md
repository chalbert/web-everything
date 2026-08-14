---
kind: story
size: 5
parent: "3099"
status: open
dateOpened: "2026-08-14"
tags: [delivery, backlog, readiness, preparation, risk]
scope:
  - we:docs/agent/backlog-workflow.md
  - we:scripts/readiness/risk-assessment.mjs
  - we:scripts/readiness/__tests__/risk-assessment.test.mjs
---

# Preparation carries a risk assessment: a typed risk enum, each with its reducing strategy

Operator proposal, 2026-08-14: preparation should carry a **risk assessment** — a rating, the elements that
drive it, and the strategies that reduce them — and it should be **mechanical where it can be**: a closed
enum of risk types, each with the strategy that addresses it.

The enum below is **not invented**. Every entry is a defect class that cost review rounds in one measured
session, paired with the strategy that was observed to remove it. That is the point: a risk taxonomy
assembled from what actually went wrong is worth more than one assembled from what might.

## The enum, with the evidence and the strategy

| risk | what it is | strategy that removed it | evidence |
| --- | --- | --- | --- |
| **premise** | the card's own claim may be false | verify by mutation or reversion BEFORE building | [#2996] reverted the code under a "regression test" and it passed anyway; [#2967] proved both gaps live and found one already shipping at two sites |
| **blast-radius** | a rule or lint fires on far more than expected | measure against the real corpus before wiring | [#3015] measured the proposed pattern set at **1,276 of 3,319 files** and retired three families that would have reddened a third of the board |
| **consumer** | the change reaches callers the scope does not name | find consumers TWO ways: ES imports AND subprocess/hook callers | [#3090] (unscoped caller hosted the real defect), [#3091] (four call sites, found one at a time over six rounds) |
| **interface** | two halves built separately disagree at the seam | round-trip test at the seam, written by whoever owns neither half | [#3044] / [#3101] — writer and reader of one block, built in parallel, coordinated only by a note |
| **population** | a statistic over one set drives another set's decision | name the population each threshold guards | [#3090] four rounds of exactly this; [#3071] stood down for it |
| **decorative-guard** | the guard exists and enforces nothing | mutate the guarded line; require a NAMED test to redden | the whole session — no green gate caught anything |
| **unmeasured-impact** | the work may not unblock anything | measure the constraint before sizing | [#3071] — two rounds of correct work on the least-binding of three blockers |
| **legibility** | the failure presents as silence, not as an error | assert the failure SURFACES, not just that it occurs | the gate-timeout stall (8×, none reported); a wedged `claude` hangs rather than reddens |

## What is mechanical and what is not — the #2607 line

[#2607] (deterministic core, thin judgment) says the script-decidable half belongs in a script. Splitting
this honestly:

**Script can decide PRESENCE** — whether a risk applies at all, from the card plus the repo:
- consumer risk: does any scoped file have a consumer not covered by `scope:`?
- blast-radius risk: does the card propose a rule, lint or gate?
- interface risk: does another OPEN item's scope overlap this one's?
- unmeasured-impact risk: does the card cite a measurement at all?

**Script cannot decide SEVERITY, and must not pretend to.** Whether a consumer actually needs changing is
judgment. So the script's output is *"these risks apply; here is the strategy for each; state your answer"*
— it prompts, it does not score. A number invented by a script and then quoted as evidence is the exact
defect this repo spent a week on ([#3099]'s retracted evidence row).

## The "go rating" — the part that needs a ruling, not a build

The operator asked for a rating. **This card deliberately does not invent one**, and that is the open
question a decision must settle before code:

- **A count** ("4 of 8 risks apply, 2 addressed") is honest and nearly useless for ranking.
- **A weighted score** ranks — and invents weights nobody measured, which is how a made-up number becomes
  quoted evidence.
- **A gate** ("no unaddressed risk may dispatch") is the strongest and would have stopped several items
  this session — including some that turned out fine.

Recommend the count plus a **per-risk addressed/unaddressed flag**, and no composite number until there is
data to weight one. Rank on `shortBy`-style facts, never on a synthesised score.

## Done when

- [ ] The enum is a closed, named set in one place that both docs and script read — not a list retyped in
      prose.
- [ ] For each risk a script can decide PRESENCE of, it does, with a test per risk over a real card.
- [ ] The output names the STRATEGY, not just the risk. A risk without its remedy is an anxiety.
- [ ] Severity and the go rating are explicitly NOT computed until the rating fork is ruled.
- [ ] Re-run over three real items from this session ([#3090], [#3091], [#3015]) and confirm it flags the
      risks that actually bit them — and stays quiet on [#3071]'s scope, which was correct.

## Watch for

- **This must not become a form.** The value today came from doing the probe, not from recording that a
  probe was owed. If a card can pass by ticking boxes, it will.
- The enum is closed **for now** and should grow only from an observed failure, with the evidence attached
  — the same rule that produced these eight.
