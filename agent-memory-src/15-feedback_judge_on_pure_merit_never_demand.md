---
name: feedback_judge_on_pure_merit_never_demand
description: "judge a candidate on pure merit (\"useful to a dev anywhere?\"); NEVER gate/defer on demand — a private unpublished project always has zero demand;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c7fe2f7d-2b57-4bf4-a978-eaefc938ec62
---

Judge whether to build a candidate feature on **pure merit only**: *could this be useful to a dev anywhere?* If yes → go. The "demand" / "urgency unproven" / "is there a market for this yet" argument must **disappear entirely** from my language, reasoning, and verdicts.

**Why:** the project is still private and unpublished, so there is *always* zero observed demand for everything in it. "No demand yet" is therefore a constant, not a signal — it can't discriminate between good and bad ideas, so using it to gate/defer/down-rank a build is always invalid. The user called this out explicitly and asked me to drop it completely.

**How to apply:**
- Decide go/no on a feature by merit (real capability, on-moat, clean prior-art delta), never by guessed demand/urgency. A "not-yet, demand unproven" verdict is the exact anti-pattern.
- Don't smuggle it back in as "urgency", "is anyone asking for this", "ahead of need", or a soft trigger gated on future demand.
- Real gates are still fine: a genuine `blockedBy` dependency (e.g. capture substrate for one slice) or cost/hosting constraints. Those are mechanism, not demand. See [[feedback_decouple_build_from_release_timing]] (build now, release later) and [[feedback_soft_deferred_parks_retired]] (specifiable-now ⇒ priority:low, not a park).
- Related: [[feedback_fork_not_a_prioritization_tool]] — merit decides; cost/effort/demand aren't branches.

Origin: #1631 repro-bundle decision — my prepared "not-yet (demand unproven)" verdict was overruled to GO on pure merit.
