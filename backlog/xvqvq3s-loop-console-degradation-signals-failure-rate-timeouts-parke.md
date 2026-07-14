---
kind: story
size: 2
parent: "2489"
status: resolved
scaffoldedBy: "slice-c-card"
dateScaffolded: "2026-07-14"
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — degradation signals (failure-rate, timeouts, parked-staleness)

Slice C of the health & anomaly-detection epic (parent #2489). Extends `detectAnomalies`
([#2488](/backlog/2488-loop-console-detectanomalies-core-stall-zero-merge-with-read/)) with three
degradation signals over the pass history — all within the 20-row live status tail, so they fire
from the CLI and console with no wider read and no daemon restart (pure read-side): **elevated
failure-rate** (repeated `exit ≠ 0` drain-fails — warn 3/10, critical 6/10), **repeated timeouts**
(killed/timed-out passes, `exit === null` — warn 3/10), and **parked-staleness** (an agent-clearable
`review:pending` PR unreviewed 20+ consecutive passes — the clearing panel isn't coming;
`review:human` parks excluded per INVARIANT 2). The console (slice D #2490) renders the new anomaly
types automatically. Impl in plateau-app; WE holds zero impl (this card is the tracker).
