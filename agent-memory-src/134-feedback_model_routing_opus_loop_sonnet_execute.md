---
name: feedback_model_routing_opus_loop_sonnet_execute
description: Opus loop orchestrates and never switches its own model; the claim emits a TIER verdict (not a whether-to-delegate one — delegation is the default per delegate-by-default-main-loop-orchestrates); the CALL is never delegated
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02098cc5-0786-41b4-a647-8c0ea561fa77
---

The Opus main loop always orchestrates; it never switches its own model. The **call** — selection, the decision arc, slicing/splitting, [[feedback_decisions_are_workitems_not_plan_mode]], preparing a fork, every close-out review — is never delegated. The **work** underneath it is, by default: execution goes to a **Sonnet sub-agent** (`Agent(model: "sonnet")`), and judgment-shaped work that would otherwise burn the loop's context goes to an **Opus sub-agent** rather than staying inline. The real win is context isolation: the sub-agent reads files in its own context and returns a summary, keeping the Opus loop lean.

> **Superseded bias (2026-08-06):** this rule originally made Sonnet *"the path an item must affirmatively qualify for."* That gate is **inverted** — delegation is now the default and **running inline is what must qualify** ([[delegate-by-default-main-loop-orchestrates]]). The gate existed because *delegate* once meant *downgrade*; [[always-set-subagent-model-explicitly]] severed those axes, so hard work delegates to Opus instead of staying inline. What survives unchanged: the loop never switches its own model, and it never delegates the **call**.

**Why:** spend Opus tokens only where judgment lives, without losing quality. From the user's seat nothing changes — same Opus session, same skills as-is; routing is a step inside the skill, never a model they pick.

**How to apply:** The routing verdict is emitted **at claim**, folded into the freshness re-read the claim already does (re-validate the possibly-stale card against the current tree — [[feedback_prepared_means_dor_not_ratified_directly]]). Never self-rate "is this hard"; decide on card signals. The verdict answers **which tier**, not whether to spawn at all:

- **Sonnet** when the card is prepared/DoR or mechanically clear · still holds against the current tree (no drift) · bounded blast radius (single locus, no contract/shared-gate/cross-repo seam) · small `size`. The re-validated card *is* the brief.
- **Opus sub-agent** when the claim re-read finds **drift** (a stale card no longer matching the tree is judgment again), or the work is judgment-shaped. It leaves the loop the same way — what makes it Opus is the tier, not staying inline.
- **Inline** only below the spawn floor: a trivial one-liner the loop is already positioned for, where a fresh agent's context load costs more than the work.

Bias: when torn between tiers, **go up** — over-spending costs a few tokens, under-spending writes a bad ruling. Escalation up is control-flow, not a score: a sub-agent hitting a real fork **stops and hands back** ([[feedback_hand_back_early_in_interactive_loops]]), never decides it.

**Batch calibration:** delegation does NOT break serial-`/batch` calibration. The loop still does claim→brief→summary→review per item in sequence, so its context grows roughly linearly in items, just a gentler slope — calibration stays valid and `capacityPoints` simply **re-converges upward = bigger batches**. The EMA re-learns over a few sessions; the only transient is a safe under-shoot. The old mixed-mode caveat (bimodal cost-per-point when some items delegate and some don't) is **retired by delegate-by-default** — with delegation the standard path the slope collapses to one; if noise ever bites anyway, calibrate on loop-context cost not raw points. (Parallel `/workflow` is genuinely decoupled — resolves in worktree contexts — so it alone skips calibration; pin `model:"sonnet"` on its `agent()` calls.) Codified in `docs/agent/backlog-workflow.md` → *Model routing* (#model-routing); close skill surfaces a model-usage suggestion at session close.
