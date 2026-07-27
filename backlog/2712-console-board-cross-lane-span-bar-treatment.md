---
bornAs: xhxrsur
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, cross-lane-spans, dag, v68-convergence, slice-2555]
---

# Console board cross-lane spans dock as full-width span bars

A cross-lane span is an item that waits on more than one lease, so it can't sit in a single column and docks
below the board. v68 renders these as **full-width tinted span bars** with the lanes it waits on named inline
(`waits on lane-1 + lane-5 · overlaps two non-adjacent leases · starts when both free`), plus a distinct
**forced / degraded** variant (amber, `⚠ forced past the overlap …`). The reworked build renders the
`CROSS-LANE SPANS` section but draws the span item (`#2255`) as an ordinary bordered white **card**, not a
spanning bar — the visual identity that makes a span read as "this stretches under multiple lanes" is missing.

## Measured evidence
- v68: two spans dock as wide bars (`#2570` teal, `#1137` amber-forced), each spanning the board width with
  inline lane chips and the "starts when both free" / "parks for you if it fails" copy.
- Reworked build (PR #112, `SPANS` fixture): a `CROSS-LANE SPANS` heading over one plain card for `#2255` with
  `Core` / `Review` chips. It reads as a card in a list, not a span bar; there is no forced/degraded variant.

## Scope
- Render each span as a full-width span **bar** (the v68 treatment), with the waited-on lanes as inline chips
  and the "starts when all free" copy.
- Add the **forced / degraded** span variant (amber) with its conflict-resolution copy.
- Keep it data-driven from the `SPANS` fixture / read-model so it can't drift.

## Acceptance
The docked spans render as full-width tinted bars matching v68 (normal teal + forced amber), lane chips inline,
judged against `plateau-app:tests/visual/baselines/board.png`.
