---
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, composer, new-work, v68-convergence, slice-2555]
---

# Console board new-work composer uses the v68 segmented story/epic/decision control

The v68 NEW WORK composer is compact: a 3-way **segmented toggle** `[ story | epic | decision ]` at the top,
then a Title field, then a `feature / epic` + `blockedBy #` row. The reworked composer instead uses a
`KIND` **dropdown** (`<select>`) and adds fields v68 doesn't show (a `size — points` field, a
`digest — one line` field, a `Create draft` button), making the rail denser and visually different from the
mock.

## Measured evidence
- v68: segmented pill toggle (story/epic/decision) + Title + feature/epic + blockedBy. No size/digest fields
  in the composer face.
- Reworked build (PR #112): `NEW WORK` → `KIND` select → Title → size → feature/epic + blockedBy → digest →
  `Create draft`. The segmented control is replaced by a dropdown; extra fields add density. This is a
  region-shift in the left-rail structural grid vs v68.

## Scope
- Replace the `KIND` dropdown with the v68 **segmented story/epic/decision toggle** (keyboard-operable).
- Trim the composer face to the v68 field set (Title + feature/epic + blockedBy); move any extra capture
  (size/digest) out of the first-glance face or behind a disclosure, matching the mock's density.
- Keep the lane→PR filing wiring intact (never writes main).

## Acceptance
The composer's first-glance layout matches v68 (segmented toggle + the mock's field set), judged against
`plateau-app:tests/visual/baselines/board.png`; the left-rail region-shifts clear.
