---
bornAs: xhz1ogl
kind: story
size: 5
parent: "2555"
status: resolved
dateOpened: "2026-07-21"
dateResolved: "2026-07-21"
locus: plateau-app
tags: [plateau-loop, console, console-board, read-port, live, slice-2555]
---

# Drive the lane board from the live read port

The board renderer (#2584 cells · #2586 conveyor · #2585 leverage) is fully data-driven but was fed a
hardcoded `BOARD` fixture. This slice makes it LIVE: the board reads the real backlog through the served read
port and maps it to card-states, so it shows where each item actually is — the payoff that turns the converged
design surface into a real board.

## Scope (delivered)
- New adapter `plateau-app:src/backlog-view/lane-board-data.ts`: fetch `/api/backlog` (items) +
  `/api/backlog/overlay` (the live claimed / queued / PR state), translate each in-flight item's real signals
  into `CardSignals` and run `deriveCardState` (the #2552 read-model) → the card's UC-id / actor — a MAP, no
  taxonomy rule re-decoded. Group into lanes by the owning session / lane (else the drain); park parked items +
  open decisions (pool-capped); skip resolved; compute the ⚡ leverage from the real `blockedBy` graph.
- `mountLaneBoard` gains `pool` + `spans` params (the fixture stays the default); `plateau-app:src/main.ts`
  paints the fixture instantly, then upgrades to live data (idempotent re-mount), falling back to the fixture
  only on a fetch/parse failure — the surface never white-screens.
- The view codes only against the served read port (no bare CLI/disk from the render path).

## Acceptance
The `/console-board` surface renders the REAL backlog's working set — active/queued/landing cards grouped into
lanes, parked/decision items in the pool — with card-states derived by the read-model and real leverage;
verified against the live `webeverything` backlog; `plateau-app`'s `npm test` green.

## Not in scope (later slices)
- Live cross-lane SPAN computation (waits-on-multiple-leases from real blockedBy ≥ 2). The dock renders empty
  until then.
- Auto-refresh / live overlay polling (#2519).
- The scope-lease zone's live lease data (#2589, consuming the #2560 observer).
