---
bornAs: xzsx09z
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-20"
tags: [plateau-loop, console, console-board, scope-lease, lane-zones, slice-2555]
---

# Console board scope-lease zone — per-lane cells on the cards

Slimmed from the original size-5 slice. The live scope-lease **zone** (a below-board section rendering the live
breach + overlap picture from the #2560 collector, plus the `⚙` policy control) already SHIPPED — carved out to
its own resolved story (`plateau-app:src/backlog-view/lease-zone.ts`, see the console-board live-lease-zone
story). What remains here is the ONE genuinely-unbuilt piece: drawing the live breach / overlap state as cells
ON the actual lane cards, not only as the summary section.

## Scope (remaining)
- Render a lane's live conflict state on its card in the lane column: a breach-paused cell (`octagon-alert`,
  UC-A4) when the lane's observed scope drifted past its declared scope; an overlap-hold cell (`layers`, UC-B2)
  / forced cell (`fast-forward`, UC-B3) when its scope overlaps a rival lane. The card glyphs already exist in
  the taxonomy + read-model (#2552/#2584); this wires the LIVE picture onto them.

## Blocked on — a lane↔card identity map (the real gap)
The live picture (`GET /api/scope-lease`) keys each lease by its **lane-pool** lane + `.lane-lease` marker
session; the board groups cards by the **backlog claim** session (from `we:claims.json`). Those two session
identities are NOT the same, so today a breach on pool-lane N can't be attributed to a specific board card. This
slice needs a durable pool-lane → building-item map (e.g. via `we:scripts/lane-pool.mjs` `map` /
`plateau-app:.claude/lane-ports.json`) before the per-card wiring is meaningful. Until then the below-board section is the
honest surface.

## Dropped as superseded (was in the original #2589)
- The four per-lane vertical bands (running · ready · purgatory · next-sprint) and the overtake affordance —
  superseded by the shipped conveyor (#2586), cross-lane spans (#2585), and the live lane cards. Not rebuilding
  them as a second layout of the same column.

## Acceptance
A lane whose live lease breached / overlaps shows the ratified conflict cell on its own card (correct glyph +
red/amber tone), driven by the live `/api/scope-lease` picture through a real pool-lane ↔ card map; both themes;
`plateau-app` `backlog-view` suite green.

## Glyph note (from the per-icon decisions mock)
Breach = `octagon-alert` matches the jury lean. `layers` (overlap) is jury-flagged a weak metaphor (a
two-overlapping-circles / `blend` glyph is wanted but not yet in the sprite); the mock also leans forced → `zap`,
but `zap` is the leverage mark, so `fast-forward` is used to avoid the collision. Reconcile when a glyph ruling
lands.
