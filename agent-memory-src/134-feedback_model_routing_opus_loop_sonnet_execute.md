---
name: feedback_model_routing_opus_loop_sonnet_execute
description: Opus loop orchestrates; claim-time verdict delegates mechanical execution to a Sonnet sub-agent; judgment never delegated
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02098cc5-0786-41b4-a647-8c0ea561fa77
---

The Opus main loop always orchestrates; it never switches its own model. Judgment work — selection, the decision arc, slicing/splitting, [[feedback_decisions_are_workitems_not_plan_mode]], preparing a fork, every close-out review — stays on Opus. *Execution* (the mechanical middle of an already-decided item) gets delegated to a **Sonnet sub-agent** (`Agent(model: "sonnet")`). The real win is context isolation: the sub-agent reads files in its own cheap context and returns a summary, keeping the Opus loop lean.

**Why:** spend Opus tokens only where judgment lives, without losing quality. From the user's seat nothing changes — same Opus session, same skills as-is; routing is a step inside the skill, never a model they pick.

**How to apply:** The routing verdict is emitted **at claim**, folded into the freshness re-read the claim already does (re-validate the possibly-stale card against the current tree — [[feedback_prepared_means_dor_not_ratified_directly]]). Never self-rate "is this hard"; decide on card signals. **Delegate to Sonnet** only when ALL hold: prepared/DoR or mechanically clear · still holds against current tree (no drift) · bounded blast radius (single locus, no contract/shared-gate/cross-repo seam) · small `size`. **Keep on Opus** when: drift found (it's judgment again), the work is judgment, or it's a trivial one-liner (spawn tax floor). Bias: when in doubt, escalate — over-delegating wastes a few tokens, under-escalating writes a bad ruling. Escalation up is control-flow, not a score: a Sonnet sub-agent hitting a real fork **stops and hands back** ([[feedback_hand_back_early_in_interactive_loops]]), never decides it.

**Batch calibration:** delegation does NOT break serial-`/batch` calibration. The loop still does claim→brief→summary→review per item in sequence, so its context grows roughly linearly in items, just a gentler slope — calibration stays valid and `capacityPoints` simply **re-converges upward = bigger batches**. The EMA re-learns over a few sessions; the only transient is a safe under-shoot. Caveat: mixed delegate/inline = bimodal cost-per-point (noisier); making delegation the standard path collapses it to one slope; if it bites, calibrate on loop-context cost not raw points. (Parallel `/workflow` is genuinely decoupled — resolves in worktree contexts — so it alone skips calibration; pin `model:"sonnet"` on its `agent()` calls.) Codified in `docs/agent/backlog-workflow.md` → *Model routing* (#model-routing); close skill surfaces a model-usage suggestion at session close.
