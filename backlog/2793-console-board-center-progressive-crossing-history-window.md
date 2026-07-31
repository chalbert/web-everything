---
bornAs: xgcfeto
kind: story
size: 5
parent: "2555"
status: resolved
blockedBy: ["2789"]
dateOpened: "2026-07-28"
dateStarted: "2026-07-31"
dateResolved: "2026-07-31"
graduatedTo: none
tags: [plateau-loop, console, console-board, center, delivery-horizon, conveyor, canonical-2554, slice-2555]
---

# Console board center — progressive-crossing history window

> **DELIVERED — plateau-app PR [#126](https://github.com/chalbert/plateau-app/pull/126).** Two genuine gaps
> remained against the canonical §6/#2554 center: `center-delivered-window`'s past-band clip is now a soft
> `mask-image` fade instead of a hard cut (still a fixed 52px window — never unbounded), and
> `center-idle-lane` now renders one dashed `idle — no active work` card (`renderIdleCard` in
> `plateau-app:src/backlog-view/lane-board.ts`) where a lane has no active work, instead of a blank column —
> plus a `boardSummary` fix so an idle lane never inflates the ◇ active-lane count. `center-greyed-history`
> was tightened to guarantee single-line (also hides `.lb-markers`/`.lb-substeps`/`.lb-infra-detail`, not
> just title/sub/bar). Verified already-conformant, no change needed: `center-canvas-no-box` (`.lb-center`
> carries no border/box-shadow), `center-progressive-crossing` (`Card.merged` + `cardGeometry` already
> cross cards at merge), and `center-single-horizon` (the fixed-height past band + uniform sticky heads
> already align one horizon across lanes; `#2586`/`#2789`/`#2795`/`#2713`/`#2715` had already landed the
> rest). Both themes reviewed by eye against the `?demo=1` fixture board (light + dark); `plateau-app npm
> test` green (119 files / 1680 tests) plus the `#2670` visual harness (4/4 green).

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
