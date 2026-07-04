---
name: feedback_accepted_low_is_story_not_decision
description: "accepted-but-low ⇒ low-pri STORY (not lingering decision); real dependency ⇒ filed blocker card, not a body note"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 21891097-3147-4002-a1ce-7efe3c3c7a12
---

When a candidate is **accepted but deprioritized**, it becomes a **low-priority story**, not a lingering open decision: change `kind: decision → kind: story` (+ a `size`), keep `status: open` + `priority: low`. The user's rule, verbatim: "should not stay as decision, open to work but low priority so they won't be picked up too soon." And a real dependency gets a **filed blocker card** the item `blockedBy`'s — "I do prefer real blocker card" — never just a prose note.

**Why:** an `open` decision sits in the decision queue (reads as "still to decide"); a low-pri story is *workable but ranks low*, which is what "accepted, later" actually means. A dependency stated only in body prose is invisible to the readiness ranker — it mis-reports as agent-ready.

**How to apply:** for accepted-low candidates, flip kind→story + `priority: low` (the body keeps its original rationale as the low-pri justification). For a real gap, scaffold the prerequisite (e.g. a type-only contract slice) and set `blockedBy: ["<NNN>"]` — even when the gate was a resolved *decision* with `graduatedTo: none` (a ruled-but-unbuilt capability is a real gap, not a false edge; see [[feedback_resolved_blocker_can_be_false_edge]]). Established on #1632–#1652: filed #1699 (webpermissions contract → #1695) and #1700 (webcontexts seam-contract → #1697). Extends [[feedback_soft_deferred_parks_retired]]; pairs with [[feedback_resolve_go_opens_next_step]].
