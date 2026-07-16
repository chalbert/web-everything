---
bornAs: xwms7q8
kind: story
size: 8
parent: "2527"
status: resolved
dateOpened: "2026-07-16"
dateResolved: "2026-07-16"
graduatedTo: none
tags: [plateau-loop, build-queue, prioritization]
---

# Build-queue prioritization data model + engine (tier, LexoRank rank, WSJF score, readiness gate, aging, config)

The queue's ordering layer, per the ratified `we:backlog/2526-plateau-build-queue-prioritization-system-design-forks.md`. Adds three fields to a backlog item — a coarse `tier` (`pinned/normal/someday/won't`), a between-able `rank` (LexoRank / fractional index for O(1) drag-reorder), and raw score inputs (value / time-criticality / confidence) — plus a versioned config object (criteria + weights + aging rate). A WSJF-shaped engine computes `score = CostOfDelay / JobSize` (reusing existing `size`, `blockedBy`-graph, readiness), and a deterministic `next-to-build` = `filter(ready) → sort(tier, effectiveScore↓, rank, createdAt) → first`. Prioritization is strictly downstream of readiness — it never mutates `blockedBy`/readiness. Buildable now (no runner dependency).

**Acceptance:** item schema gains `tier` + `rank` + score-input fields (validated by the gate); a config object holds criteria/weights/aging (weights sum 100%, ≤5 criteria, none >50%); `we:scripts/backlog.mjs` gains verbs to set tier / rank (drag-reorder) / weights, refusing any write that would touch `blockedBy` or readiness; a pure `next-to-build(items, config)` returns the single highest-priority *ready* item deterministically, with aging preventing starvation and FIFO tie-break; unit tests cover the ordering, the readiness gate, aging, and LexoRank rebalance.
