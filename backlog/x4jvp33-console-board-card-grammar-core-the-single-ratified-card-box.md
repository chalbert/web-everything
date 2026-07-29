---
kind: story
size: 5
parent: "2555"
status: open
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, card-grammar, canonical-2554, foundation, slice-2555]
---

# Console board card-grammar core — the single ratified card box + full state set

Build the ONE §6/#2554 ratified card box and the full state set every other board story leans on. Today no
open story delivers the card box itself: [#2710] and [#2712] both propose grammar that *diverges* from it (a
second progress bar; a full-width span bar), and [#2588]'s ready cards reuse it. This is the missing
foundation — file and build it first.

## Why (canonical gap)
The design-alignment committee (2026-07-28, against the canonical lane-board artifact) found `card-single-box`,
`card-floating-idpill`, `card-icon-leads-title`, `card-states`, `card-state-accent-rail`, and
`card-progress-bar` are all **UNOWNED** by any open story — yet they are the anatomy the whole board renders
from. Left unbuilt, each downstream story invents its own card chrome and they drift.

## Scope
- **One card box for ALL cards** (active, delivered, queue, ready, wait) — same border/radius/padding grammar;
  variants differ only by a left **state accent rail**, never a different box (`card-single-box`,
  `card-state-accent-rail`).
- **Floating `#id` pill** on the top border of the box (`card-floating-idpill`).
- **State icon leads the title** — the state's sprite glyph is the first inline element of the title line
  (`card-icon-leads-title`).
- **Single 6px state-colored progress bar** on in-progress cards; delivered / queue / wait cards carry none
  (`card-progress-bar`).
- **The full state set** — `build` (loader, "building · N%"), `deliver` (checkcheck, "merged", greyed once
  past the horizon), `human` (amber, "waiting on you"), `fail` (red), `wait` (waypoints, "waits #id",
  waits-purple — the canonical treatment for a multi-lease waiter), `queue` (muted qcard) — each with its
  ratified glyph + accent (`card-states`).
- Height encodes size intrinsically (see [#xgmio7d] legend rate); this story delivers the box, not the ruler.

## Where the code goes (locus)
Extends the card renderer under `plateau-app:src/backlog-view/` (the cells [#2584] renders), sourced from
`plateau-app:src/backlog-view/card-taxonomy.webcases.ts`. Reads the token foundation [#xzpkd8q] for the
state→color map + sprite.

## Acceptance
Every card on the board renders from one shared box component: floating `#id` pill, state-icon-led title,
optional single 6px state-colored bar, left state-accent rail — no second box grammar anywhere. All six states
render with their ratified glyph/accent, checked against the canonical §6/#2554 artifact (not the v68
`board.png`). Both themes render; `plateau-app` `npm test` + `we:` `check:standards` pass.
