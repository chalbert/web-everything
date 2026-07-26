---
bornAs: xxxj0s7
kind: story
size: 5
parent: "2555"
scope: ["plateau-app:src/backlog-view/", "we:scripts/conveyor/"]
status: resolved
dateOpened: "2026-07-24"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: [conveyor, ui, infra]
---

# Conveyor UI: surface infra-blocked lanes distinctly — outage banner, retry state, resume action

The console lane board (and the `we:scripts/conveyor/status-board.mjs` text mirror) must render an `infra-blocked` card/lane state that reads **distinctly** from a review-park or a stall. Today all three collapse into one "something's wrong" look, so an operator watching the board sees a scary stall where the truth is "paused on GitHub, retrying."

## Build

Render the `infra-blocked` state with its own affordances:

- The **failure class** (e.g. "GitHub outage"), not a generic stall.
- The **retry attempt count** and a **next-retry countdown**.
- A **resume affordance** so the operator can nudge a retry by hand.
- A single **"outside dependency degraded — N lanes waiting" banner** rather than N separate alarms, so a widespread outage reads as one event.

Consumes the #2641 ledger / conveyor read model (the `infra-blocked` state that plateau-app:src/backlog-view/ and the text mirror both render).

## Acceptance

- An `infra-blocked` lane is visually distinct from a review-park and from a stall, on both the board and the text mirror.
- The retry attempt + countdown + resume action are visible on the card.
- Multiple lanes down on the same cause collapse into one banner, not N alarms.
