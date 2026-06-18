---
type: issue
workItem: task
parent: "904"
status: open
locus: webeverything
blockedBy: ["916", "917", "918", "919", "920", "921", "922", "923", "924", "925"]
dateOpened: "2026-06-18"
tags: []
---

# Flip BLOCK_IMPL_DRIFT_ENFORCED=true once all 10 block impls exist

Flip BLOCK_IMPL_DRIFT_ENFORCED=false → true in we:scripts/check-standards-rules.mjs:1232 (validateBlockImplConformance) so a moved/deleted block impl hard-fails — the #726 plug analogue for blocks. Gated on all 10 FUI block impls existing (#916–#925); flipping earlier would hard-fail the gate on the 10 genuine gaps it was designed to warn-ahead on. locus webeverything. Slice of #904.
