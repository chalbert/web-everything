---
bornAs: xgcfeto
kind: story
size: 5
parent: "2555"
status: open
blockedBy: ["2789"]
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, center, delivery-horizon, conveyor, canonical-2554, slice-2555]
---

# Console board center — progressive-crossing history window

Realize the canonical center's time axis: the delivered pile crossing a single delivery horizon, with a faded
day-folded history window. This is distinct from [#2713] (which realizes ≥2 lane *columns*) — this story owns
the **vertical crossing + history** within each lane.

## Why (canonical gap)
The committee found `center-canvas-no-box`, `center-progressive-crossing`, `center-delivered-window`,
`center-greyed-history`, and `center-idle-lane` **UNOWNED**. The center is the headline of the board; its
crossing/history behavior has no owner.

## Scope
- **Transparent canvas** — the execution plan is the central screen, not a boxed panel: no card border/shadow
  around the whole center (`center-canvas-no-box`).
- **Progressive crossing** — items rise as they progress and **cross the single delivery horizon at merge**;
  above the horizon is the past, below is active + queue (`center-progressive-crossing`).
- **Delivered window** — the delivered pile sits directly on the active zone and extends up into a masked
  fade; windowed so it never grows unbounded (`center-delivered-window`).
- **Greyed history** — merged/delivered cells above the horizon are demoted: greyed, low-attention,
  single-line (`center-greyed-history`, reads [#2789] deliver state).
- **Idle-lane placeholder** — a lane with no active work shows the dashed idle-card, not an empty column
  (`center-idle-lane`).
- **One horizon across all lanes** at a single fixed y (coordinate with [#2715] horizon label /
  `center-single-horizon`).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` center render + `plateau-app:src/backlog-view/lane-board.css`
zone/mask geometry.

## Acceptance
Each lane column renders a transparent canvas with a delivered pile fading up above one shared horizon, active
+ queue below, greyed single-line history, and a dashed idle placeholder where a lane is idle — matching the
canonical §6/#2554 artifact. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
