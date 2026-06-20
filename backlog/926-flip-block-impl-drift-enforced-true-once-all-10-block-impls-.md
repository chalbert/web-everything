---
kind: task
parent: "904"
status: resolved
locus: webeverything
blockedBy: ["916", "917", "918", "919", "920", "921", "922", "923", "924", "925"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Flip BLOCK_IMPL_DRIFT_ENFORCED=true once all 10 block impls exist

Flip BLOCK_IMPL_DRIFT_ENFORCED=false → true in we:scripts/check-standards-rules.mjs:1232 (validateBlockImplConformance) so a moved/deleted block impl hard-fails — the #726 plug analogue for blocks. Gated on all 10 FUI block impls existing (#916–#925); flipping earlier would hard-fail the gate on the 10 genuine gaps it was designed to warn-ahead on. locus webeverything. Slice of #904.

## Done (batch-2026-06-18)

All 10 FUI block impls (#916–#925) landed in this same batch, and the WE gate showed **zero**
unresolved-`implementedBy` warnings — so the warn-ahead window is closed. Flipped
`BLOCK_IMPL_DRIFT_ENFORCED` `false → true` in `we:scripts/check-standards-rules.mjs:1232`
(`validateBlockImplConformance`): a WE block contract whose `implementedBy` points at a moved/deleted
FUI impl now **hard-fails** (the #726 plug analogue for blocks). Verified the flip adds **0 errors**
(the only remaining WE-gate error is a concurrent session's untracked `reports/` file — not this change).
