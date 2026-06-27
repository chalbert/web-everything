---
name: feedback_skeptic_finding_is_a_hypothesis
description: A red-team/skeptic refutation is itself a claim to TEST against data before it reshapes a ruling — the skeptic over-generalizes too
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c11fff23-8609-4cda-ada8-1f02bacf96e9
---

A skeptic/red-team sub-agent's refutation is a **hypothesis to verify**, not a verdict to fold in.
The attacker can over-generalize exactly like the prepared default can — so before letting a skeptic
finding flip or reshape a decision, run the real empirical check (residuals, the actual data, the tree).

**Why:** On #1505 (calibrator affine-cost model) the prep skeptic claimed "work-bound stops inflate
the intercept with non-productive context → keep a per-stop-reason intercept term." I folded that into
the prepared ruling as `Fork 1 (b)` without testing it. The user pushed **twice** ("the prep work is
real work in all batches… shouldn't it average out?") before I actually fit the residuals — which
**refuted** the skeptic: mean residual −0.5 work-bound vs +5.3 for the lone capacity-bound batch (the
saturating batch sat *above*, not below). The fixed overhead is *universal*, a single legit intercept,
and selection bias only bites under extrapolation — here we estimate from and predict to the same
(work-bound-dominated) population. The model collapsed to a pooled fit and a whole fork dissolved.

**How to apply:** Treat `SURVIVES-WITH-AMENDMENT` / `REFUTED` skeptic verdicts as claims carrying the
same burden as the default they attack — quantify them against the live data before they enter a
ruling. Cheap test: if the skeptic asserts a systematic bias by group, compute the per-group residuals
first. Extends [[feedback_verify_grounding_claims_before_ratifying]] and [[feedback_test_before_asserting_cause]]
to the *attacker's* claims; complements [[feedback_red_team_discussion_born_flips]] (a flip clears the
same gate). Also: "fixed overhead present in every sample is a legitimate intercept, not per-sample
waste to exclude."
