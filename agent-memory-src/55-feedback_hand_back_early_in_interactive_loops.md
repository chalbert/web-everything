---
name: feedback_hand_back_early_in_interactive_loops
description: "In interactive/feedback-loop work, hand control back early — collect first, build only on explicit go; don't run design→build→commit before the user finishes input"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6408923e-f92c-48e7-a313-e59d640d587d
---

In an interactive or feedback-loop task (a skill the user drives, a page-by-page review, an open design discussion), hand control back to the user EARLY and often. Do not autonomously run the full design→build→validate→commit cycle before they have finished giving input.

**Why:** The user corrected this twice in one session (improve-explorer): on first invocation I went off and built+validated+committed a whole capability before they could speak; they wanted to drive. Pre-committing the wrong thing wastes their time and pre-empts their judgment. Their model: "anything I note is a call to action, not a thing to fix now — let's collect them" and "we don't have to run as soon as I mention a problem, would not be efficient."

**How to apply:** After loading just enough context, ASK before building. Treat each note as a logged call-to-action, not an immediate task. Collect into a scratchpad, batch into work items only when the user says the collection pass is done. Build a specific item only on an explicit "go." This is about interactive work specifically — a clearly-scoped autonomous task still runs to completion. Pairs with [[feedback_decisions_are_workitems_not_plan_mode]] (a surfaced fork → a decision item, not chat) and [[feedback_propose_memory_when_reframe_lands]].
