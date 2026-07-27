---
bornAs: xm5ik4u
kind: story
size: 5
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, center, lane-windowing, v68-convergence, slice-2555]
---

# Console board center realizes v68 multi-lane columns (not one)

The center EXECUTION PLAN is the headline of the v68 mock: several lanes stand side by side as full columns,
each a stack of sized cells rising to the delivery horizon, with the lanes that don't fit collapsed to strips.
Measured against the ratified baseline (`plateau-app:tests/visual/baselines/board.png`, v68) with the
`BOARD`/`POOL`/`SPANS` fixtures mounted at 1440w, the reworked board realizes only **one** full lane column
("Core"); the second card-bearing lane ("Review", four live cards) collapses to a 30px strip. v68 shows **two
or more populated lane columns** before any strips.

## Measured evidence
- v68 target: two full lane columns (`LANE-1 CONSOLE TREE`, `LANE-2 SHORT TITLES`) side by side, then 7
  collapsed strips.
- Reworked build (PR #112 / plateau `xb5ma0r`, headless mount of `BOARD`/`POOL`/`SPANS` at 1440w): one wide
  "Core" column, then 9 strips (Review/Fan-out/Docs/Infra/CI-A/CI-B/Loop/Shipped/Explorer). The Review lane —
  which holds a rich four-card stack in the fixture — is hidden in a strip.
- Root cause: the center's measured width is ~780px (the composer + glossary rail on the left and the
  ready-to-queue rail on the right eat ~580px of the 1440). `computeCapacity(11 lanes, ~780, laneMin 232)`
  returns 1 — two 232px columns plus 9 strips plus arrows overrun 780px. So the multi-lane machinery is
  present in code (windowing, strips, horizon all work) but does not visually realize the v68 center at the
  target width. This is the biggest center-realization gap.

## Scope
- Prioritize lanes **with live card stacks / active work** into the window; never collapse a lane that holds a
  card stack while placeholder-only lanes stay windowed. (Windowing today is purely positional — first-N — so
  a card-bearing lane past the capacity edge disappears.)
- Re-proportion so **at least two full lane columns** show at 1440w: revisit `laneMin` (232 may be too wide for
  the real center width), the rail widths, and/or the strip/arrow reserve in `computeCapacity`, so the mock's
  two-columns-plus-strips composition is reachable.
- Keep the no-horizontal-scroll + resize-aware guarantees intact; verify at 1280 / 1440 / 1680.

## Acceptance
Mounting `BOARD`/`POOL`/`SPANS` at 1440w renders **≥2 full lane columns** (both card-bearing lanes visible as
columns, not strips), matching the v68 composition; the light comparator delta drops from the measured 0.09,
and the center region-shifts in the structural grid clear. No horizontal scroll at any width.
