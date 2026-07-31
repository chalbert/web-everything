---
bornAs: x3j6tmw
kind: story
size: 5
parent: "2555"
status: resolved
blockedBy: ["2789"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-31"
dateResolved: "2026-07-31"
graduatedTo: none
scope: ["plateau-app:src/backlog-view/lane-board.ts", "plateau-app:src/backlog-view/lane-board.css", "plateau-app:src/backlog-view/conveyor.ts"]
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

## Resolution (2026-07-31) — plateau-app #125

A step-0 audit against fresh `plateau-app` main found the single progress bar was **already canon**: [#2789]
gates the one 6px bar on the `build` state-bucket, not touched here beyond a doc-comment reference. The
genuine gap was narrower than the v68-re-anchor framing implied: height and the `Σ n · ≈Nm` size/ETA label
were still gated behind the `▤ sized` toggle (default OFF), fighting the "height encodes size always, not on
a toggle" rule.

Delivered in `plateau-app:src/backlog-view/conveyor.ts` + `plateau-app:src/backlog-view/lane-board.ts`
(+ `plateau-app:src/backlog-view/lane-board.css`, + tests):
- `cardGeometry()` now computes `heightPx`/`chip`/`oversize` in **every** mode — only the vertical offset
  (rise-by-progress in `flow` vs pinned-to-0 + queue order in `sized`) still differs by mode. Kept the
  `flow`/`sized` mode distinction itself (a separate, already-ratified #2586/§3i-v28 delivery-horizon
  feature, not itself in this item's scope) — only removed what fought canon: the mode-gating on
  height/chip.
- `renderCard()` applies `min-height` + renders `.lb-sizechip` whenever cell geometry exists, unconditional
  on mode; still suppressed for a merged/past card (fixed-height clipped past band, pre-existing guard).
- New optional `Card.subSteps` renders short sub-step rows inside the SAME ratified box for a building card
  that carries them, gated on the same `build` bucket as the progress bar — additive, one demo fixture card
  proves the mechanism (no live backlog data source for sub-steps yet; out of this item's scope to invent
  one).

Verified: `plateau-app npm run test` 119 files / 1680 tests green. Visual self-review (flow + sized mode,
light + dark theme) on a scratch dev port confirms single bar, height-tracks-size, and the Σ/ETA + sub-steps
rendering inside the one box, by eye. No committed canonical baseline yet ([#2796] pending, per this item's
own acceptance text) — a documented skip, not a false-fail. `plateau-app` PR
[#125](https://github.com/chalbert/plateau-app/pull/125), `ready-to-merge`. No new entity spawned — this
extended the existing #2789 renderer in place.
