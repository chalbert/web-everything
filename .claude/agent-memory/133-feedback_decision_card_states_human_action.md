---
name: feedback_decision_card_states_human_action
description: "every decision card must plainly state what the HUMAN has to do (+ trigger for parked ones), never bury the call in analysis"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7a75f6d7-7d4d-4d9b-b104-84dffe04eea7
---

Every decision card I author must make the **human action explicit** — a short "What you have to
decide" line stating the one call in a sentence, not buried as prose inside the analysis/fork tables.

**Why:** the user reviews decisions externally; they want to see *what they have to do* at a glance,
without reverse-engineering it from the matrix. ("I always want external decision to know what I have
to do.")

**How to apply:** when isolating/splitting/authoring a `type:decision` card, include a crisp
**What you have to decide** section (the single ratifiable call). For a parked/`deferred` decision,
ALSO state the explicit **un-park trigger** — what external signal (e.g. funnel data) or event un-blocks
it — so it's clear there's nothing to do *yet* and exactly when there will be. Example: #1590 (carved
from #140). Related: [[feedback_collect_decision_residual_as_card]], [[feedback_decisions_are_workitems_not_plan_mode]].
