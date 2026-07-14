---
bornAs: xdeemx9
kind: story
size: 3
parent: "2489"
status: resolved
scaffoldedBy: "slice-b-card"
dateScaffolded: "2026-07-14"
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — considered-never-merged detector + per-pass PR identity (slice B)

Slice B of the health & anomaly-detection epic (parent #2489). Adds per-pass PR identity to the drain
journal and a detector that names a SPECIFIC wedged PR. `parsePassResult` now records `consideredPrs`
(unique sorted union of PR nums a pass looked at, across all disposition buckets) and `deferredPrs` (the
blockedBy-deferred nums) on each history entry. A new `considered-never-merged` signal in `detectAnomalies`
flags a PR considered 20+ consecutive non-noop passes yet never landed (warn at 20, critical at 40) — unlike
STALL's aggregate view it names the culprit PR (the we #477 CI-churn signature). A PR counts only if
considered, NOT merged, NOT parked, NOT deferred — parked/deferred are explained non-landings owned by
`parked-stale` / `trailingStallRun` (a review:human or blockedBy PR must never read as wedged). Changes what
`parsePassResult` records, so the daemon needs a restart to begin populating the fields. Also lays the
`consideredPrs` groundwork for time-to-land (the item #2484 deferred to slice B). Built as plateau PR #37,
review-passed by a fresh-context 2-lens panel. Impl in plateau-app; WE holds zero impl (this card is the tracker).
