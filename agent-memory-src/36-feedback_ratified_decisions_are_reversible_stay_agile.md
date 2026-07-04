---
name: feedback_ratified_decisions_are_reversible_stay_agile
description: "ratified decisions are reversible — as more get resolved, some WILL be reverted and that's normal; push back to defend the prior ruling first, but stay genuinely open and reverse without friction when the case holds; record reversals with lineage, never erase"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1aec940a-9116-4864-974b-19c18d17fb2c
---

As the constellation matures and more decisions carry a `resolved` ruling, **a growing fraction will eventually be revisited or reversed — and that is normal and healthy, not a failure of the original call.** A ruling was the best read of the evidence *at the time*; new findings, a shifted boundary, a downstream build exposing a wrong assumption, or the user simply deciding the tradeoff differently are all legitimate grounds to reopen. Stay **agile**; never treat the ratified backlog as a frozen contract to defend at all costs.

**Why:** over-committing to past rulings as permanent contracts ossifies the project; a coherent reversal today beats a stale ruling defended out of inertia. Consistency is not the goal — being right *now* is.

**How to apply (both directions, held together):**
- **Push back first.** When a new ask cuts against a `resolved` decision, don't silently flip — surface the prior decision, explain *why* it was ruled that way (cite `#NNN` + its rationale/principle), and say plainly the new ask reverses it. The standing ruling has earned a reasoned defense (same instinct as the Red-team pass, pointed at change).
- **But stay genuinely open.** Pushing back is advocacy, not obstruction. If the user's reasoning is sound or they re-weigh the tradeoff, **reverse without friction** — don't re-litigate past the first honest defense, don't protect your own prior recommendation.
- **Record it, don't erase it.** A reversal is a normal decision turn: reopen (`resolved → active`) or file a superseding `decision` with a `crossRef`/`blockedBy` to the original; write the new ruling **plus a one-line "supersedes the #NNN ruling because …"**; re-run the ratification gate (explicit ratification + Red-team); re-check downstream items the original unblocked.

Standards rulings carry a higher bar for what justifies a reversal than soft categories, but the agility applies to **all** of them. Codified in [docs/agent/backlog-workflow.md](../../../../../workspace/webeverything/docs/agent/backlog-workflow.md) ("A ratified decision is reversible — stay agile").

Related: [[feedback_monetization_soft_accepted_revisitable]] (the heaviest-weight already-revisitable category — this generalizes the spirit to all decisions, standards included), [[feedback_decisions_are_workitems_not_plan_mode]] (decisions live as backlog items, so a reversal is a backlog turn), [[feedback_prepared_means_dor_not_ratified_directly]] (the ratification gate a reversal re-runs).
