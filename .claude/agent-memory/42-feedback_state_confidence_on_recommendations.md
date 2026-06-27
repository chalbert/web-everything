---
name: feedback_state_confidence_on_recommendations
description: "Carry an explicit confidence level on every recommendation, decision ruling, and fork sub-call"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c49d13bd-59e4-4b70-a06f-4d2a04d2e1ce
---

On any recommendation, decision ruling, or fork sub-call, state an **explicit confidence level**
(e.g. ~75%, ~85%, or low/medium/high) — and name the residual uncertainty that the remainder
represents.

**Why:** the user reads the confidence to calibrate how hard to push back and whether to ratify
directly; a bare recommendation hides whether it's a near-certainty or a coin-flip. Flagged when a
#811 decision presentation gave a stance with no confidence attached.

**How to apply:** every fork/sub-call in a `type:decision` presentation gets its own confidence
(Fork 1 ~X%, Fork 2 ~Y%), not one blended number; pair it with a one-line "the residual is …" so the
uncertainty is legible, not just a digit. Reversing a prepared default after a red-team
([[feedback_verify_grounding_claims_before_ratifying]]) is exactly when the number matters most.
Related: [[feedback_decision_mode_engage_real_fork]], [[feedback_support_all_coherent_fork_existence_test]].
