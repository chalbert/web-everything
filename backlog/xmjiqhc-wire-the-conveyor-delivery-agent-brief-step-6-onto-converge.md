---
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
tags: []
---

# Wire the conveyor delivery-agent brief step 6 onto /converge

#xztipiw was resolved on the claim that it gives the conveyor's converge-before-PR step a real bounded loop, but its named consumer was never wired: we:skills-src/conveyor/delivery-agent-brief.md step 6 is unchanged prose (spawn a code-review subagent, address every finding to convergence) with no round cap, no panel reduction and no ledger, and #xyihiji covers only we:scripts/workflows/review-parked-prs.mjs. /converge therefore ships with ZERO production callers and nothing filed to give it one. Replace step 6's prose loop with a /converge run against the lane clone, keeping the step ADVISORY (it reports a verdict; it never gates opening the PR).

## Why this is filed separately

Found in the PR #1064 human review of the /converge change. `graduatedTo` on #xztipiw records where the CODE
went, which reads as proof of delivery and masks that the named caller was never connected — so nothing in the
tracker said the loop had no user. This item is that missing edge.

## The gap, concretely

Step 6 of we:skills-src/conveyor/delivery-agent-brief.md today says: spawn one adversarial code-review subagent,
read its returned verdict, "address every finding to CONVERGENCE", re-run after any nontrivial fix "until a pass
comes back clean". Every bound in that sentence is a model's judgment:

- **No round cap.** "Until it comes back clean" has no ceiling, so a non-converging pair can loop until context
  runs out. `/converge` has `panelRigorForCareLevel().rounds`, enforced from the loop's own counter.
- **No panel reduction.** ONE reviewer, one lens, one opinion — versus a multi-lens panel reduced by
  diversity-selection, in which a mandatory lens that fails to run can never read as accept.
- **No ledger.** The verdict lives in a subagent's return value and is gone. `/converge` carries a round history
  and an accumulated dismissal trail.
- **No red-team.** #2707 requires an adversary to try to break an accept before it counts; step 6 has none.

## Definition of done

- Step 6 drives `we:scripts/converge-cli.mjs` against the lane clone instead of describing a hand-run loop.
- The step stays ADVISORY: an `escalate` is reported in the PR body / escalation path, and never blocks PR-open
  (that would gate every drain lane, doc-only lane, and the lane shipping this very change — the reason
  #xztipiw dropped its `pr-land` refusal).
- The brief's step-6 prose no longer restates any bound the core owns (per #51: the deterministic half belongs in
  the tested core, not in the brief).
- Care band comes from #2954's derivation once that lands; until then step 6 passes an explicit `--care`.
