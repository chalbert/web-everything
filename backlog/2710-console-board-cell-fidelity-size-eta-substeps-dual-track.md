---
bornAs: x3j6tmw
kind: story
size: 5
parent: "2555"
status: open
blockedBy: ["2789"]
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, card-fidelity, canonical-2554, slice-2555]
---

# Console board cells show size/ETA + sub-steps within the ratified single-card grammar

A building cell should carry its "where is this, and how long" reading — but **inside** the ratified single card
box, not as the v68 two-bar / opt-in-sized chrome. Re-anchored 2026-07-28 off the superseded v68 baseline onto
the canonical §6/#2554 card grammar (committee finding: this story restored v68 cell features that fight the
single-bar / always-on-height rules).

## Canonical alignment (what changed)
- **One progress bar, not two.** v68 showed `plan 4/6` + `spec proven 2/5`; canon is a **single 6px
  state-colored bar** ([#2789] `card-progress-bar`). If a spec-proven signal is still wanted, express it
  within the single-bar grammar or refile it as a separately-ratified element — do **not** add a second bar.
- **Height encodes size always, not on a toggle.** v68 gated height=Σ behind `▤ sized`; canon makes cell/zone
  height follow size **intrinsically and always** (~9 min/pt, [#2794] `legend-size-rate`). Drop the toggle
  (or default it on).
- **Additive content fits the one box.** The `Σ N · ≈ Xm` size/ETA label and any sub-step rows must fit inside
  the single ratified card box ([#2789] `card-single-box`) alongside the state loader + "building · N%"
  label — not port v68 cell chrome verbatim.

## Scope
- Render the `Σ N · ≈ Xm` size/ETA label on each cell from `sizePts` (reuse the `laneEta` helper), inside the
  ratified card box.
- Optionally render short sub-step rows when a building card carries them, within the box.
- Ensure cell height tracks size by default (the geometry, not just a text label, carries the time reading).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` cell render (extends the [#2789] card box); helper reuse from
`plateau-app:src/backlog-view/lane-board-data.ts`.

## Acceptance
A populated building cell carries its `Σ/ETA` label (and optional sub-steps) inside the ONE ratified card box,
with a **single** state-colored progress bar and height that tracks size by default. Judged against the
**ratified** §6/#2554 card grammar (binding now). The canonical **visual baseline** that supersedes v68
`plateau-app:tests/visual/baselines/board.png` is the *pending* pixel oracle [#2796] freezes, so the
baseline comparison is **gated on that flip** — until [#2796] lands, verify against the ratified grammar +
fixtures (v68-divergent regions expected-red), not against a canonical baseline that does not yet exist. Both
themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
