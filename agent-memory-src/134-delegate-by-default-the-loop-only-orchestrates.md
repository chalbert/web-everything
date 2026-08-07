---
name: delegate-by-default-the-loop-only-orchestrates
description: Delegate by default — the Opus loop only orchestrates (talk · the call · choose+brief · below-floor work · the gate it reports), never switches its own model, and emits a TIER verdict at claim; the CALL is never delegated
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02098cc5-0786-41b4-a647-8c0ea561fa77
---

**The Opus main loop always orchestrates, never switches its own model, and delegates by default — running inline is what must qualify.** Five things stay inline; **anything not on that list is a spawn**:

1. **Talking to the human** — questions, decision presentations, the closing summary.
2. **The call** — the ruling itself, accepting / rejecting / reconciling what sub-agents return, and the **verdict half of a close-out review** — *including opening the diff it rules on*. A verdict formed on someone else's summary is their call wearing yours, and a summary cannot show what it left out.
3. **Choosing and briefing** — what to spawn, with what brief, in what order (including the claim's freshness re-read of the card, which is what *produces* the brief).
4. **Work below the spawn floor** — a state flip, a single in-context edit, the targeted spot-verify of a citation.
5. **The gate whose *pass* this loop reports** — it **runs the gate and reads the output**. Neither a sub-agent's word nor a green required check substitutes: [[verify-before-you-claim]] confirms *by content*, "not by an exit code" — and the close-out gate is partly an inspection (the backlog-count delta, the scoped error lines) that a status cannot carry. Scoped to *the loop that reports the pass*: a build agent runs the gate blocking inside its own lane clone.

The sharpest everyday case of "not on that list": **never read a file into the loop to *learn* something** — send Haiku and keep the pointer. The loop's only inline reads are the ones it must make to be accountable: the card (3), the artifact it rules on (2), the few lines confirming a citation (4).

**An absence is never accepted on a sub-agent's word.** "No other consumers", "no findings" — a spot-verify cannot confirm an absence (nothing to grep *for*), so either the loop establishes it itself over the artifact (no size escape: too big to read = split the change), or it stays **unverified** — which blocks **acting** on it, not just repeating it. Don't drop the compat shim on an unconfirmed "no other consumers".

**The call is never delegated — the work underneath it is.** Selection, the decision arc ([[feedback_decisions_are_workitems_not_plan_mode]]), slicing/splitting, preparing a fork, every close-out review: the *work* half (survey, draft the options, draft the breakdown, **find** the review findings) goes down at the **Opus tier**; the *call* half (which option, accept or bounce) is item 2. The old *"stays on Opus"* meant *stays inline* only because delegating once implied downgrading; [[always-set-subagent-model-explicitly]] severed those axes (2026-08-06, lineage #1855), so judgment-shaped work now leaves the loop and comes back for the call.

**The one override: a harness instruction wins.** Some sessions ship a system instruction forbidding the Agent tool unless the user asks. That outranks this rule — do not spawn in such a session (and pack a `/batch` conservatively there, since everything runs inline at the old cost; it is a plan-time haircut, never a new mid-batch stop).

**Canonical home: `docs/agent/backlog-workflow.md` → *Model routing* (`#model-routing`).** The five lanes above are the **recall copy** — a memory leaf has to stand alone at recall time, because the session that needs the rule may never open the doc. Everything *around* them is not duplicated here: the claim-time tier verdict, the grounding/citation protocol, return hygiene (#1861), the `/batch` calibration effects. **If the two ever disagree, the doc wins** — re-read it before acting on a boundary case. Boundaries: [[always-set-subagent-model-explicitly]] owns the Haiku/Sonnet/Opus ladder; [[right-size-the-panel-count-not-model-tier]] owns how many agents sit on the *same* question (a second opinion is a rung to earn — delegating one job to one sub-agent is not).
