---
bornAs: x5njzar
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, lane-pool, canonical-2554, slice-2555]
---

# Console board Lane pool region conforms to canonical grammar

The board already renders an `OFF-LANE POOL` section below the board (noted in [#2715]). The canonical artifact
makes it a **first-class Lane pool region** at the top of the board — not a below-the-fold afterthought to fold
away. Conform the existing panel to the canonical grammar rather than hiding it.

## Why (canonical gap)
The committee (2026-07-28) found `pool-panel-chrome`, `pool-chip-stack`, `pool-stack-colors`, `pool-status-dot`,
and `pool-chip-scrollto` **UNOWNED**, and flagged [#2715]'s nit-3 (fold/hide the OFF-LANE POOL to match v68) as
a **regression** — the OFF-LANE POOL *is* the canonical Lane pool under a different name.

## Scope
- **Panel chrome** matching every canonical panel: grip · title ("Lane pool") · count ("N/M filled · X%") ·
  collapse · menu (`pool-panel-chrome`, shares [#2792] panel-consistency).
- **Per-lane composition stack** — each lane a compact vertical stack whose segments show its fill/composition
  (delivered / build / fail / human / review / queue), sized by proportion (`pool-chip-stack`).
- **Stack segment colors** drawn from the ratified state→color map (`pool-stack-colors`, reads [#2795]).
- **Status dot** per lane (build / stall / fail / degraded / review / idle); **idle lanes dashed**
  (`pool-status-dot`).
- **Scroll-to-lane** — clicking a pool chip scrolls/flashes its lane column in the center (a primary-outline
  flash, not a state color) (`pool-chip-scrollto`).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` (the existing OFF-LANE POOL render) + its data in
`plateau-app:src/backlog-view/lane-board-data.ts`.

## Acceptance
The Lane pool renders as a first-class panel with canonical chrome, a per-lane composition stack in ratified
state colors, a status dot (idle dashed), and click-to-scroll to the lane. **Not** folded away. Checked against
the canonical §6/#2554 artifact. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
