---
name: feedback_collect_decision_residual_as_card
description: "a decision's live residual (a future-revisit condition) gets collected as its OWN parked card with a trigger, never left as prose in the resolved item"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7c592f3b-e24c-4f31-bf6d-db735d7e0ade
---

When ratifying a `kind: decision` that carries a **live residual** — a future-revisit condition like "lean (a) now, revisit (b) iff X recurs" — **collect that residual as its own card** before resolving, never leave it only as prose in the resolved item. #1406 (marquee placement): Fork-1 chose the behavior-block on YAGNI, residual = "promote to a `region-select` intent iff a second recognizer shape (lasso/center-point) recurs" → carved parked #1463 with `parkedReason: deferred` + `relatedTo` lineage; user directive "fork 1 residual should be collected."

**Why:** a residual written only inside the item that resolves goes invisible the moment that item drops out of selection — a future session reasoning about the same axis never sees it (same failure mode as [[feedback_propose_memory_when_reframe_lands]]: captured-but-invisible). A standalone card keeps the open question first-class and selectable.

**How to apply:** carve the residual as a `kind: decision` card; **park it with a machine-readable reason** (`parkedReason: deferred`, or a real `blockedBy` if a concrete prereq exists) since it's gated on an external trigger, not a backlog edge — this keeps it out of the falsely-ready Tier-A pool; state the **trigger condition** explicitly (what concrete signal flips it open); set `relatedTo` to the parent decision; record the carve in the resolved item's Ruling section. Mirrors [[feedback_discovery_output_is_cards_only]] (durable work = cards) and the fork discipline in [[feedback_support_all_coherent_fork_existence_test]] / [[feedback_fork_not_a_prioritization_tool]].
