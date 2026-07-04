---
name: feedback_must_coland_size_can_be_double_count
description: "A repeatedly-inflated \"must-co-land / size-13\" can be a double-count of the co-land partner's scope; the /split lens re-investigates and may carve it back down"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8951ac77-f63e-4373-931d-22a0f5e9b045
---

A story whose size was bumped (e.g. 5→8→13) by successive pre-flights all citing "must co-land
with #X / blocked-in-fact" is NOT automatically correctly sized — the inflation can be an artifact
of **double-counting work that actually belongs to the co-land partner**, not real volume.

**Why:** pre-flights judge batch-eligibility ("can THIS item close solo?"), not seams. They legitimately
conclude "not solo-green" without ever asking whether the entangling scope is even this item's. #1494
("re-home backend + delete + keep verifier") was sized 13 / "must co-land with #1355" by three
pre-flights — but `/split 1494` found the size-13 came from #1494 re-stating the renderer **delete that
was already #1355's scope**. Carving the genuinely-#1494 parts (verifier→golden #1494, coordinator
delete #1521) and returning the delete to #1355 dissolved the "deadlock": two clean `blockedBy: []`
slices + one convergence point.

**How to apply:** when `/split` hits an item inflated by "must co-land" pre-flights, before accepting
the size, read the co-land partner's actual scope and test whether the entangling clause is
double-counted there. If it is, the honest split returns that clause to its real owner and the residual
carves into clean independent slices — the entanglement was bookkeeping, not coupling. This is the
inverse case of [[feedback_misflagged_batchable_fix_real_state]] (which inflates to encode real
non-batchability); here you legitimately deflate. Still gate on the fork-existence / [[feedback_skeptic_finding_is_a_hypothesis]] discipline — a double-count claim is itself a hypothesis to verify against both items' real trees.
