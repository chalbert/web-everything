---
name: feedback_map_item_is_not_a_blocker
description: a reference/map item is never a valid blockedBy target — depend on the real decision/substrate it points to;
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f315e6c8-ca4e-4af1-be63-1e70a3e3b611
---

A durable **map / planning-artifact** item (a strategy matrix, a feature inventory, any card that
"stays the map, not a decision") **never resolves as a decision**, so it can never *unblock* anything.
Pointing a `blockedBy` edge at one creates a **permanent false blocker** — the dependent looks gated
forever while its real prerequisite goes unrecorded.

**Why:** depending on a *map* is not a real dependency. The map merely names the kernels/decisions; the
gate is one of those, not the map. A `blockedBy: <map>` silently mis-reports agent-readiness (the
dependent reads as gated, the true gate reads as unblocked) — uncaptured context wearing a green gate.

**How to apply:** when an item is `blockedBy` a map/reference card, repoint to the *real* gate —
- the **decision** carved out of the map (e.g. #1391/#1500 → #1590, the surface-bet decision, not the
  #140 matrix), or
- the **substrate** the dependent actually needs (e.g. #237 → the introspectable-app-model substrate;
  if it has no owning item, empty `blockedBy` and park via `childlessReason: blocked` rather than gate
  on the map).

When you **resolve a map epic**, audit its inbound `blockedBy` edges first (they'll otherwise become the
"resolved epic, dependent never unblocked" trap), and re-home any `parent:` children to a live umbrella
so they aren't orphaned under the resolved card. Related: [[feedback_misflagged_batchable_fix_real_state]],
[[feedback_fork_not_a_prioritization_tool]].
