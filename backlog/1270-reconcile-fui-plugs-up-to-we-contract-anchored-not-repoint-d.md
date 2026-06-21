---
kind: decision
size: 2
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
codifiedIn: one-off
tags: [plugs, dedup, drift, reconciliation, frontierui, contract-anchored, constellation-placement]
relatedProject: webplugs
---

# Reconcile FUI plugs UP to WE (contract-anchored) before finishing the #449/#1234 repoint — and how to reconcile

Carved out of epic [#1250](/backlog/1250-re-reconcile-fui-plugs-up-to-we-contract-anchored-add-a-real/) so the
ruling lives as a standalone decision rather than buried in an epic body. The canonical plugs home is
already FUI ([#606](/backlog/606-/) / [#817](/backlog/817-/)), but FUI has drifted **behind** `we:plugs/`
across ~11 of 14 domains (+2 WE-only: `webportals`, `webtraces`), so two questions had to be settled
before #1250's dedup could start: **(1)** which direction to reconcile, and **(2)** how.

## The fork (direction)

- **A — finish the #449/#1234 repoint now (WE imports `@frontierui/plugs`, delete `we:plugs/` per #1047).**
  *Broken:* a trial repoint regressed the analytics ([#1014](/backlog/1014-/) `UnknownTrackerError`) and
  webcontexts ([#1117](/backlog/1117-/) `resolveContext`) demos against stale FUI and had to be fully
  reverted. FUI is a **lossy subset**, so repointing-down loses working behavior and #1047 can't run.
- **B — reconcile FUI UP to WE first, then finish the repoint.** Bring FUI to parity per domain so it is a
  true superset; #1234 (the WE-side repoint) is `blockedBy` #1250; #1047 deletes `we:plugs/` last.

**Ruling — B**, user-confirmed 2026-06-20. The #606/#817 "FUI is the canonical plugs superset" premise had
decayed (WE stayed the de-facto dev tree, FUI fell behind, no working drift gate caught it); reconcile-up
restores the intended direction without regressing demos. Direction is settled — #1250 is pure execution,
no further decision needed.

## How to reconcile — two governing principles (user-set, 2026-06-20)

1. **Contract-anchored — WE-ahead ≠ WE-correct.** Do NOT blind-copy `we:plugs/<domain>` → FUI. For each
   domain the source of truth is its **contract + conformance vectors** (the `@webeverything/*` contract
   packages, `we:conformance-vectors/*`). Reconcile *both* impls to the contract; where WE and FUI
   disagree, the contract decides — WE's version may be the wrong one.
2. **Holes in contracts get FIXED, not worked around.** If reconciliation exposes a behavior the contract
   doesn't specify (a gap), fix the contract (add the spec/vector) — never paper over it in the impl.
   Contract completeness is part of #1250's deliverable, not a side effect.

## Lineage

- Affirms [#606](/backlog/606-/) / [#817](/backlog/817-/) (FUI canonical for plugs) — does not reverse them.
- Plugs analog of the blocks-side direction fork carved as [#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/) under epic #1245.
- Governs all per-domain reconciliation + drift-gate slices under epic #1250; **#1234 stays `blockedBy` #1250.**
