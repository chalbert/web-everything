---
bornAs: x59nmjh
kind: task
status: open
dateOpened: "2026-08-05"
blockedBy: ["2920"]
relatedTo: ["2452"]
tags: [lane-pool, infra]
---

# Stale-ahead fix reaches only acquire, not list/provision --acquirable (the dispatcher still sees a starved pool)

PR #1022 review finding 1, filed rather than bundled under the no-regression land bar. we:scripts/lane-pool.mjs has TWO builders of the {exists, lease, dirtyOrAhead} shape isLaneAcquirable consumes: the inline infoFor in cmdAcquire (which got the provably-pushed relaxation) and laneAcquirableInfo (which did not). laneAcquirableInfo is the only input to list --acquirable and provision --acquirable, and the conveyor tick plus the parallel workflow dispatcher pick lanes exclusively through those. Measured on the live pool: list --acquirable returns 1 lane of 38 while a replication of the fixed infoFor clears 14 of the 24 ahead lanes. NOT bundled because wiring the relaxation into list would make every conveyor tick pay the fan-out cost measured in the sibling item — a real regression on the hot path. Fix both together: collapse the two builders into one shared helper AND make containment answerable in one spawn per lane.
