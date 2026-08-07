---
name: feedback_model_routing_opus_loop_sonnet_execute
description: Delegate by default — the Opus loop only orchestrates (talk · decide · brief · below-floor edits · the close-out gate), never switches its own model, and emits a TIER verdict at claim; the CALL is never delegated
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02098cc5-0786-41b4-a647-8c0ea561fa77
---

**The Opus main loop always orchestrates and never switches its own model — and it delegates by default.** Delegation is the standard path; **running inline is what must qualify.** Only these stay inline:

1. **Talking to the user** — questions, decision presentations, the closing summary.
2. **Deciding** — the ruling itself, and accepting / rejecting / reconciling what sub-agents return.
3. **Choosing and briefing** — what to spawn, with what brief, in what order. This *includes the claim's own freshness re-read of the card*: that read is what produces the brief and the tier verdict, so it is orchestration, not delegated work.
4. **Work below the spawn floor** — a state flip or single edit where everything needed is *already* in context and a fresh agent's load would cost more than the work itself.
5. **The close-out gate** — the loop runs it itself. [[verify-before-you-claim]] forbids reporting *passed* on a sub-agent's word, so the pass the loop reports must be one the loop saw. (A sub-agent may run gates inside its own loop; that never substitutes for the loop's own run.)

Everything else is a spawn: reading, searching, implementing, testing, reviewing, red-teaming, researching, investigating. In particular — **never read a file into the main loop just to answer a question**; send Haiku and keep the pointer, not the file.

**The call is never delegated.** Selection, the decision arc, slicing/splitting, [[feedback_decisions_are_workitems_not_plan_mode]], preparing a fork, every close-out review — those are item 2 above. The *work* underneath them goes down.

> **The gate inverted (2026-08-06):** this rule originally made Sonnet *"the path an item must affirmatively qualify for; anything ambiguous stays on Opus."* That gate existed because *delegate* once implicitly meant *downgrade*, so the risk it guarded was a cheap model writing a bad ruling; [[always-set-subagent-model-explicitly]] severed those two axes, so hard work now goes to an **Opus sub-agent** instead of staying inline. With tier chosen per job, delegating costs quality nothing and buys context isolation, parallelism, and a loop lean enough to hold the whole arc — so the bias inverts. What survives unchanged: the loop never switches its own model, and it never delegates the **call**.

**Why:** spend Opus tokens only where judgment lives, without losing quality. From the user's seat nothing changes — same Opus session, same skills as-is; routing is a step inside the skill, never a model they pick.

**How to apply.** The routing verdict is emitted **at claim**, folded into the freshness re-read the claim already does (re-validate the possibly-stale card against the current tree — [[feedback_prepared_means_dor_not_ratified_directly]]). Never self-rate "is this hard"; decide on card signals. The verdict answers **which tier**, not whether to spawn at all:

- **Sonnet** when the card is prepared/DoR or mechanically clear · still holds against the current tree (no drift) · bounded blast radius (single locus, no contract/shared-gate/cross-repo seam) · small `size`. The re-validated card *is* the brief.
- **Opus sub-agent** when the claim re-read finds **drift** (a stale card no longer matching the tree is judgment again), or the work is judgment-shaped. It leaves the loop the same way — what makes it Opus is the tier, not staying inline.
- **Inline** only below the spawn floor: a trivial one-liner the loop is already positioned for, where a fresh agent's context load costs more than the work.

Bias: when torn between tiers, **go up** — over-spending costs a few tokens, under-spending writes a bad ruling. Escalation up is control-flow, not a score: a sub-agent hitting a real fork **stops and hands back** ([[feedback_hand_back_early_in_interactive_loops]]), never decides it. Delegating the *work* never delegates the *call*.

- **Fan out independent work — that is not a panel.** Independent jobs spawn **concurrently in a single message**, never one after another. Putting a *second* agent on the *same* question (a verifier over another's return, a second opinion) is a different lever entirely: that is a panel rung, governed by [[right-size-the-panel-count-not-model-tier]] — default zero, name the rung, **ask before climbing**, never a silent upgrade.
- **Stay grounded without reading.** Every return carries `file:line` citations for its load-bearing claims. When the loop is about to *act* on one, spot-verify with a targeted grep/read of a few lines — never re-derive the whole thing ([[verify-before-you-claim]]; a sub-agent return is a lead, not a fact). That spot-check is the loop's own work, below the spawn floor. A **second independent verifier sub-agent** for a high-leverage return is available but **opt-in** — it is a panel rung, so right-size it out loud first; it is never automatic.
- **Every spawn carries the return-hygiene contract** (`docs/agent/backlog-workflow.md` → *Model routing*): the final message IS the return value — no fabricated specifics, uncertainty flagged, ranked list over prose, no file dumps.

**The one override: a harness instruction wins.** Some sessions ship a system instruction forbidding the Agent tool unless the user asks for it. That instruction outranks this rule — do not spawn in such a session. Delegate-by-default is the default everywhere else, not a licence to override the harness.

**Batch calibration:** delegation does NOT break serial-`/batch` calibration. The loop still does claim→brief→summary→review per item in sequence, so its context grows roughly linearly in items, just a gentler slope — calibration stays valid and `capacityPoints` simply **re-converges upward = bigger batches**. The EMA re-learns over a few sessions; the only transient is a safe under-shoot. The old mixed-mode caveat (bimodal cost-per-point when some items delegate and some don't) is **retired by delegate-by-default** — with delegation the standard path the slope collapses to one; if noise ever bites anyway, calibrate on loop-context cost not raw points. (Parallel `/workflow` is genuinely decoupled — resolves in worktree contexts — so it alone skips calibration; pin `model:"sonnet"` on its `agent()` calls.) Codified in `docs/agent/backlog-workflow.md` → *Model routing* (#model-routing); close skill surfaces a model-usage suggestion at session close.
