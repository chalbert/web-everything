---
bornAs: xm5ik4u
kind: story
size: 5
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, center, lane-windowing, canonical-2554, slice-2555]
---

# Console board center realizes ≥2 multi-lane columns at the ratified width

The center EXECUTION PLAN is the headline: several lanes stand side by side as full columns, the rest collapse
to strips, no sideways scroll. The reworked board realizes only **one** full column; a card-bearing "Review"
lane collapses to a strip. The intent (≥2 columns, card-priority windowing, no sideways scroll) is
canon-aligned — but the **method was stale**. Re-anchored 2026-07-28 off the v68 pixel baseline onto §6/#2554.

## Canonical alignment (what changed)
- **Hold column width at the ratified ~300px** (`center-multi-lane`). The stale plan narrowed `laneMin` (232)
  *below* 300 to fit two columns — that drives width the **wrong** way. Reach ≥2 columns instead by **trimming
  the side rails** (composer/legend left, ready-queue right) and/or the strip+arrow reserve in
  `computeCapacity` — never by shrinking the column.
- **Re-anchor acceptance** from `plateau-app:tests/visual/baselines/board.png` (v68) + its 0.09 delta to the
  canonical §6/#2554 reference; regenerate the baseline ([#2796]) before measuring delta.

## Scope (kept — aligned)
- Prioritize lanes **with live card stacks / active work** into the window; never collapse a card-bearing lane
  while placeholder-only lanes stay windowed (an additive, canon-aligned refinement of the strip-collapse rule).
- Reach **≥2 full ~300px lane columns** at 1440w by re-proportioning the rails / strip reserve — not `laneMin`.
- Keep the no-horizontal-scroll + resize-aware guarantees; verify at 1280 / 1440 / 1680 (vertical-strip
  collapse, never page widening).
- Vertical crossing + history within a column is [#2793]; this story owns the **columns**.

## Acceptance
Mounting `BOARD`/`POOL`/`SPANS` at 1440w renders **≥2 fixed-width (~300px) lane columns** with vertical
separators (both card-bearing lanes visible as columns, not strips), remaining lanes collapsed to strips, and a
single dashed lev-colored delivery horizon across all lanes — matching the **ratified** §6/#2554 grammar
(binding now, not "the v68 composition"). The pixel-**delta** comparison is **gated on** [#2796]
regenerating the baseline (retiring v68), per the scope note above — not measured against a canonical baseline
that does not yet exist. No horizontal scroll at any width. `plateau-app` `npm test` + `we:` `check:standards`
pass.
