---
bornAs: xk1tron
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

## Second wave of evidence, same day (2026-08-14) — reviewing the PREPARATION itself, not just the build

Seven cards were prepared (design decided, interfaces cited) and merged with no independent review, then
independently reviewed after the fact as a separate pass. **All seven had real defects**, each landing on an
enum entry already above — the taxonomy held without needing a ninth category:

- **premise** — [#2803]'s design was reasoned from a resolve-time model the repo moved past ~2.5 weeks earlier
  (since #2748 landed 2026-07-28: the drain owns the flip now, not the producing lane); [#3004]'s residual
  claim ("unrecoverable") rested on a manifest-location fact that changed under #2411.
- **blast-radius** — [#2842]'s proposed statute-lint rule would fail `check:standards` repo-wide the moment
  anyone resolved one of three specific in-flight items — unmeasured and unnamed until review.
- **consumer** — [#2787] named one print site for a bug that had two; the second was live on `main`, printing
  the bug and its own fix on adjacent lines.
- **interface** — [#2351] picked a lock key that turned out to be the resident drain daemon's own
  whole-process lock; [#3063]'s render step needed data its producer never passed.
- **decorative-guard, the sharpest hit** — [#3004] and [#3095]'s designs were **provable no-ops**: wired to
  derive from inputs already structured to exclude the failing case, or to look up a value that is never
  recorded anywhere. Not "might miss something" — literally could not fire, and the card's own `## Done when`
  would have gone green against it, because every bullet was satisfiable on a hand-seeded fixture rather than
  the real production path.
- **population / unmeasured-impact** — [#2842] and [#2803] both *did* measure (against the real doc corpus,
  against 426 historical merges) — the counter-evidence that measuring works when someone does it; the defect
  in both was elsewhere (interface/premise), not in the measured claims themselves.
- **legibility** — [#3063]'s wide catch would have turned an operator's typo into "REFUSED — start a fresh
  run," silently re-charging a metered judge call rather than surfacing the actual mistake.

**The new finding this wave adds, which changes how the enum gets applied, not what's in it**: self-verification
(the preparer re-checking their own claim, item 8 of the checklist) caught real things earlier the same day —
and caught NONE of these seven. The preparer is structurally the wrong person to catch an error in their own
reasoning. Risk assessment during preparation and independent review of the preparation are not the same
control and neither substitutes for the other — see `we:agent-memory-src/story-preparation-checklist.md`
item 9, added from this same evidence.

## What is mechanical and what is not — the #2607 line

[#2607] (deterministic core, thin judgment) says the script-decidable half belongs in a script. Splitting
this honestly:

**Script can decide PRESENCE** — whether a risk applies at all, from the card plus the repo:
- consumer risk: does any scoped file have a consumer not covered by `scope:`?
- blast-radius risk: does the card propose a rule, lint or gate?
- interface risk: does another OPEN item's scope overlap this one's?
- unmeasured-impact risk: does the card cite a measurement at all?

**These four are not equally mechanical, and the build must own that** (independent review, 2026-08-14):
interface is a pure repo fact (frontmatter set intersection); consumer decides *candidate* presence (the ES
import graph plus a subprocess/hook grep whose hits include doc-only mentions — it over-fires, and that is
acceptable); blast-radius and unmeasured-impact read the card's own text and are heuristics that can miss a
novel phrasing. So build every check conservative — err toward firing, because a spurious fire costs one
prompt while a silent miss is an unassessed risk wearing an assessed card's clothes — and the output must
present a non-firing check as "not flagged", never as "clear".

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

## Independent review — 2026-08-14 (checklist item 9, applied to this card itself)

Confidence: **High**. Eight evidence citations spot-checked against the cited cards and their review PRs
([#2996], [#3015], [#2787], [#2803], [#3004], [#3095], [#2842], [#3071]) — all support their rows, several
verbatim (the 1,276-of-3,319 measurement, the two adjacent lines on `main`, the "provably a no-op" and
"never recorded anywhere" wording). The second-wave section matches PR #1254's own body. Leaving the go
rating unruled is the right call: the bold default (count + per-risk flag) is stated, so the fork is
ready to ratify, and ruling it inside a review would bypass the decision turn the card itself asks for.
**One change made:** the presence checks were presented as uniformly script-decidable when two of the four
are text heuristics — the paragraph above ("not equally mechanical") was added so a builder does not treat
a heuristic's silent miss as a clearance.

## Watch for

- **This must not become a form.** The value today came from doing the probe, not from recording that a
  probe was owed. If a card can pass by ticking boxes, it will.
- The enum is closed **for now** and should grow only from an observed failure, with the evidence attached
  — the same rule that produced these eight.
