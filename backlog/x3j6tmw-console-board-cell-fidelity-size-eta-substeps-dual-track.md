---
kind: story
size: 5
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, card-fidelity, sized, two-track, v68-convergence, slice-2555]
---

# Console board cells show size/ETA + sub-steps + dual plan/spec track

The v68 cell packs the "where is this, and how long" reading into each card. The reworked cells are thinner:
they show the title, the sub-line, one leverage chip, and a single `plan …%` bar — and drop most of the v68
cell content. This weakens the time-as-geometry + two-track story the center is meant to tell.

## Measured evidence (v68 cell vs reworked cell)
- **Size / ETA label**: v68 shows `Σ N · ≈ Xm` on every cell (e.g. `Σ 5 · ≈ 45m`). The reworked cell shows no
  per-cell size/ETA label, though the `sizePts` is in the fixture.
- **Sub-step checklist**: v68 building cells show a short checklist of sub-steps (`✓ launch control`,
  `▸ proving R3 — refusal flow`, `○ repo gates → commit`). The reworked cell shows none.
- **Two-track progress**: v68 shows TWO bars per building cell — `plan 4/6` and `spec proven 2/5` — the
  plan-vs-spec-proven crossing. The reworked cell shows a single `plan …%` bar.
- **Sized mode**: v68's `▤ sized` mode makes cell height follow `Σ` so a column's length reads as run time,
  with per-lane / per-queue time footers (`≈ 72 min of agent time`, `queue ≈ 3.9 h + gate`). The reworked
  build shows the `sized` toggle but height does not visibly track `Σ`, and the time footers are absent.

## Scope
- Render the `Σ N · ≈ Xm` size/ETA label on each cell from `sizePts` (reuse the `laneEta` helper).
- Render the sub-step checklist rows (glyph + label) when a building card carries them.
- Render the dual plan / spec-proven progress tracks (two bars) per the v68 grammar.
- Make `▤ sized` mode scale cell height to `Σ`, and add the per-lane / per-queue time footers.

## Acceptance
A populated cell matches the v68 cell content: `Σ/ETA` label, sub-step checklist, dual plan/spec bars; `sized`
mode visibly scales height to `Σ` with lane/queue time footers. Judged against
`plateau-app:tests/visual/baselines/board.png` region-by-region.
