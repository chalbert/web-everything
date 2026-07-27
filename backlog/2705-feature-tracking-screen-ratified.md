---
bornAs: xb0m08l
kind: epic
parent: "2505"
status: open
blockedBy: ["2691"]
dateOpened: "2026-07-27"
tags: []
---

# Feature-tracking screen (RATIFIED)

The Plateau Loop feature-tracking screen, design RATIFIED: a master-detail operable screen — persistent fleet scan (features as one-line rows: kind, re-hued where-the-time-goes bar + numeric twin, %, velocity+trend, honest forecast word-chip, blocker flag) + a detail pane (velocity panel with throughput sparkline, cycle where-the-time-goes, burn-up capped at the unblocked ceiling with a hatched gated no-date band; feature to epic to slice rollup with connector rails; type-adaptive FILMSTRIP/ship-log markers) + a scoped one-hop dependency view with a fleet bottleneck banner.

The ratified interaction FRAME is MASTER-DETAIL (committee-chosen over expand-in-place and breadcrumb-zoom on three BUILT screens; usability 5 / product-owner 5 / a11y lifted). Honest-forecast invariant: velocity projections, never typed target dates; a blocked feature forecasts only its unblocked remainder, gated points named with NO date. This ships as the default "delivery" preset of a configurable per-level view (#2689).

BUILD-TIME CONDITIONS (not design flaws): back the rollup with the real feature tier (#2691) so epic point-totals reconcile to the feature total; velocity from #2686; forecast from #2687; design-increment filmstrip from #2688. Its full case space is specified by the case-taxonomy item (item 2 of this session, sibling to #2553). Blocked on #2691 (feature tier) — a read-only first slice over existing epic data (feature≈epic interim) can start before it lands; slice this epic next.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046
