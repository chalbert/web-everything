---
bornAs: xyp34m5
kind: task
status: open
relatedTo: ["1245", "1770"]
scope: ["we:blocks/router/"]
dateOpened: "2026-08-17"
tags: [constellation, placement, zero-impl, debt]
---

# Blocks/router (2,843 lines) is one of the last three named families #1245's own plan never finished slicing

**Correction, 2026-08-17: an earlier version of this item wrongly claimed #1245 reads `status: resolved`.**
Verified directly against `backlog/1245-*.md`: it is genuinely `status: open`, `childlessReason: blocked`,
`blockedBy: [1353]` — #1245 was never falsely marked done. The real, corrected finding: #1245's plan named 16
debt-root families to slice out of `we:blocks/` to Frontier UI, and — checked directly against the tree, not
against #1245's own child-item bookkeeping — **13 of the 16 are already deleted**. Only three remain:
`we:blocks/router/`, `we:blocks/resource-loader/`, `we:blocks/renderers/`. Router is the largest and the one
#1245's own plan calls out as safe to delete right now (point 4 of its "Re-scoped plan": *"its WE copy... already
landed FUI-side (the 2026-06-20 hotfix), so deleting `we:blocks/router/` is now safe"*) — 2,843 lines across
19 files, including a 741-line types+fixtures cluster and a 619-line `we:blocks/router/RouteViewElement.ts`,
still fully present despite the plan itself saying the deletion is already unblocked.

## Why this is a real gap, not a nicety

Surfaced during the 2026-08-17 prep pass on #1770 (constellation-placement audit). #1245's `blockedBy: [1353]`
is itself stale — #1353 resolved 2026-06-27 — so the item is likely just sitting unclaimed on a dead block
rather than genuinely obstructed. This is a much narrower, more mundane gap than the original (wrong) framing
of this item suggested: not a false-completion claim, just three named debt families — one of them explicitly
declared safe to remove — sitting on a stale blocker nobody has re-checked.

## Done when

1. **Executable** — `we:blocks/router/` is sliced to Frontier UI per #1245's own already-declared-safe plan
   (verified by its absence, or the WE-resident copy shrinking to a thin reference fixture matching the shape
   of the 13 already-completed families), and #1245's stale `blockedBy: [1353]` edge is dropped or re-pointed
   at whatever, if anything, still genuinely blocks `resource-loader`/`renderers`.
