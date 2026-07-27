---
bornAs: xya9syb
kind: story
size: 2
parent: "2606"
status: open
blockedBy: ["2661"]
dateOpened: "2026-07-27"
tags: []
scope:
  - we:scripts/conveyor/tick-core.mjs
  - we:scripts/conveyor/__tests__/tick-core.test.mjs
---

# Conveyor tick loop: emit ONE degraded-infra note from the clustered health signal

#2661 added a clustered degraded-infra signal (one entry per shared external cause) to the conveyor state read (health.degradedInfra), but no consumer reads it yet. The tick loop in we:scripts/conveyor/tick-core.mjs still derives operator notes only from the stalled list. Make it emit ONE degraded-infra note per cluster (cause + affected-lane count), distinct from a per-lane stall note. we:scripts/conveyor/status-board.mjs already collapses same-cause infra lanes into the #2660 OUTAGE banner (from per-lane infra detail), so this is the tick-note half. Scope: we:scripts/conveyor/tick-core.mjs plus its tests. Sliced out of #2661 to honor its finer-lease three-file lane scope.
