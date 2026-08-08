---
bornAs: x6x0kxz
kind: story
size: 2
parent: "2705"
status: open
blockedBy: ["2691", "xjnkr8p", "2721", "2732", "2726", "2729", "2723"]
scope: ["plateau-app:tests/visual/baselines/", "plateau-app:src/feature-tracker/feature-tracking.baselines.ts"]
dateOpened: "2026-07-27"
tags: []
---

# REFREEZE · #2691 feature-tier baseline refreeze milestone (R7) — human-gated

After #2691 lands the real feature tier, re-export every feature-tier-dependent baseline (scan rows, burn-up ceiling, rollup feature tier, DAG nodes, banner ranking) as an explicit, human-approved design change. Stale feature-epic baselines must not keep passing as conformant.

## Deliverable
A HUMAN-GATED milestone. After #2691 lands the real feature tier, re-export every feature-tier-dependent baseline as an explicit, approved design change (scan rows, burn-up ceiling, rollup feature tier, DAG nodes, banner ranking). Stale feature≈epic baselines must not keep passing as if conformant.

## FT cases → rendered=yes
Re-anchors existing yes cases to the feature tier (no new render).

## Scope
- `plateau-app:tests/visual/baselines/` (ft-*.png)
- `plateau-app:src/feature-tracker/feature-tracking.baselines.ts`

## Acceptance
The five #2691-touched surfaces are re-baselined together in both themes; the refreeze is an explicit approved-design-change commit (never silent); the post-refreeze golden-master passes; conformance now means feature-tier conformance. This is a human-approved design-change gate (R7).
