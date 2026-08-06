---
name: delegate-by-default-main-loop-orchestrates
description: Delegate by default — running inline is what must qualify; the main loop only talks, decides, briefs, and flips cheap state
metadata:
  type: feedback
---

**Delegation is the default path, not the exception.** Push as much work as possible into subagents and
keep the main Opus loop **purely orchestrating**. Only four things run inline:

1. **Talking to the user** — questions, decision presentations, the closing summary. Never delegated.
2. **Deciding** — the ruling itself, and accepting / rejecting / reconciling what subagents return.
3. **Choosing and briefing** — what to spawn, with what brief, in what order.
4. **Work below the spawn floor** — a state flip or single edit where everything needed is *already* in
   context and a fresh agent's load would cost more than the work itself.

Everything else is a spawn: reading, searching, implementing, testing, reviewing, red-teaming, researching,
verifying, running gates. In particular — **never read a file into the main loop just to answer a
question**; send Haiku and keep the pointer, not the file.

**Why:** the old bias (*"Sonnet is the path an item must affirmatively qualify for; anything ambiguous stays
on Opus"* — [[feedback_model_routing_opus_loop_sonnet_execute]]) was written when *delegate* implicitly meant
*downgrade*, so the risk it guarded was a cheap model writing a bad ruling. [[always-set-subagent-model-explicitly]]
severed those two axes: hard work now goes to an **Opus subagent**, not a cheap one. With tier chosen per job,
delegating costs quality nothing and buys context isolation, parallelism, and a main loop that stays lean
enough to hold the whole arc. The gate's original argument no longer applies, so the bias inverts:
**inline is what must qualify now.**

**How to apply:**

- **Route the tier, not the decision to delegate.** "Should this be a subagent?" is almost always yes; the
  real question is *which tier*, answered by [[always-set-subagent-model-explicitly]] on the shape of the
  return (Haiku = pointers · Sonnet = execution to spec · Opus = judgment · never Fable).
- **Fan out.** Independent work spawns **concurrently in a single message**, never one after another.
- **Stay grounded without reading.** Every return carries `file:line` citations for its load-bearing claims.
  When the loop is about to *act* on one, spot-verify with a targeted grep/read of a few lines — never
  re-derive the whole thing ([[verify-before-you-claim]]; a subagent return is a lead, not a fact). For a
  **high-leverage** return, the verifier is a **second independent subagent**, not the loop.
- **Hand-back stays control-flow.** A subagent that hits a real fork stops and returns it; it never decides
  ([[feedback_hand_back_early_in_interactive_loops]]). That is what routes judgment back to the loop —
  delegating the *work* never delegates the *call*.
- **Every spawn carries the return-hygiene contract** (`docs/agent/backlog-workflow.md` → *Model routing*):
  the final message IS the return value — no fabricated specifics, uncertainty flagged, ranked list over
  prose, no file dumps.

**The one override: a harness instruction wins.** Some sessions ship a system instruction forbidding the
Agent tool unless the user asks for it. That instruction outranks this rule — do not spawn in such a
session. This is the default everywhere else, not a licence to override the harness.
