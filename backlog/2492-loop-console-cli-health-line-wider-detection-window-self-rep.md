---
bornAs: xexm9so
kind: story
size: 1
parent: "2489"
status: resolved
scaffoldedBy: "slice-e-cards"
dateScaffolded: "2026-07-14"
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — CLI health line + wider detection window (self-report on the terminal)

Slice E, part 1 of the health & anomaly-detection epic (parent #2489). The CLI `status` is the surface
the operator hand-grepped last arc to find the we #477 70-min deadlock — make it self-report. Human
`status` now prints a `health:` line (✓ healthy / ▲ degraded / ✗ STUCK) plus each active anomaly, under
the all-green `daemon state:` counters. Both status paths read a wider (~50-row) history tail so the STALL
signal can escalate to `critical`/stuck (unreachable from the old 20-row tail); `buildStatusReport` caps its
`history` display back to 20 so the console table is unchanged. `plateau:tools/drain-daemon/cli.mjs`-only +
`buildStatusReport` (fresh process, not the resident daemon) → live on primary sync, no daemon restart. Split
from the launchd desktop alert (slice E part 2), which touches the daemon. Impl in plateau-app; WE holds zero
impl (this card is the tracker).
