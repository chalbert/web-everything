---
bornAs: xzsx09z
kind: story
size: 2
parent: "2555"
status: resolved
dateOpened: "2026-07-20"
dateResolved: "2026-07-21"
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

## Delivered (plateau-app PR #95)
The lane↔card identity join was solved via the existing lane-ports registry (`plateau-app:.claude/lane-ports.json`,
written by `we:scripts/lane-pool.mjs` `map`, mapping item→`{lane}`):
- **Server** (`plateau-app:vite.config.mts`) reads the registry tolerantly, inverts it to lane→item-nums, and
  STAMPS each `/api/scope-lease` lease with `items[]` / each overlap with `aItems[]`/`bItems[]`.
- **Client** (`plateau-app:src/backlog-view/lane-board-data.ts`) reads the stamps in `buildBoard` and feeds the
  three read-model signal fields the taxonomy already maps — `build.pausedReason='scope-breach'` → **UC-A4**
  (breach, `octagon-alert`), `forcedPastOverlap` → **UC-B3** (forced, `fast-forward`), `overlapsLane` → **UC-B2**
  (overlap, `layers`). Pure wiring — no new render code; `deriveCardState` precedence picks the state.

Breach and forced are gated on the card actually building (both are mid-build states), so a stale / co-mapped
registry entry can't mis-render a parked/queued card as a build-interrupt. Overlap (UC-B2) is a queued state and
stays masked below building. Back-compat: the common case (empty/absent registry, clean or 502 picture) stamps
nothing and the board is byte-identical. Sighted all three cells in light + dark; regression tests cover the
flips, the non-building gate, no-conflict byte-identical, empty stamps, and numeric-normalized matching.

The `blend` overlap glyph remains a separate glyph-ruling follow-up (below); `layers` is the current taxonomy
glyph and is used as-is.

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
