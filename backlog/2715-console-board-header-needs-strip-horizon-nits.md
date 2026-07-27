---
bornAs: xzb1yg6
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, header, needs-strip, delivery-horizon, a11y, v68-convergence, slice-2555]
---

# Console board header/needs-strip/horizon convergence nits

A cluster of small, region-local convergence nits found measuring the reworked board against v68. Each is
low-risk polish; grouped because they are all header / needs-strip / horizon chrome.

## Measured evidence + scope
- **Zero-count stalled pill (a11y — color-only cue)**: the needs-strip renders `0 stalled` with the amber `⚠`
  warning treatment even at count 0, so colour signals "attention" when there is none. Drop the warning
  cue (neutral treatment) when the count is 0 — don't rely on colour alone to say "fine".
- **Delivery-horizon label (visual)**: v68 labels the dashed horizon line
  (`delivery horizon — work rises past the line at merge`). The reworked build draws the dashed line but no
  label. Add the horizon label so the line reads as the delivery horizon, not an arbitrary divider.
- **Below-board chrome vs v68 framing (visual)**: the reworked build adds an `OFF-LANE POOL` section and an
  `All 37 card-states — reference` disclosure below the board that v68's framing doesn't include. Reconcile:
  either fold them behind a disclosure / move them so the at-a-glance board matches the v68 composition, or
  confirm they are intended below-the-fold and keep them out of the primary frame.

## Acceptance
The needs-strip shows no false warning cue at a 0 count; the delivery-horizon line carries its v68 label; the
below-board sections no longer intrude on the v68 at-a-glance framing. Judged against
`plateau-app:tests/visual/baselines/board.png`.
