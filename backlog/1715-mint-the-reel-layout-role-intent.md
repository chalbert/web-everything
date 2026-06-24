---
kind: task
parent: "1704"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1704
tags: []
---

# Mint the reel layout-role intent

Author the project-less `reel` intent (we:src/_data/intents/reel.json) per #1680: composition-intent = horizontally scrolling overflow strip. Candidate role — first confirm it earns role status via the role-vs-variant-vs-annotation test (already answered: distinct arrangement). FUI impl guidance: overflow + scroll-snap; optional `region` landmark. Renders at /intents/reel/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `reel` layout region-role intent:

- `we:src/_data/intents/reel.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/reel.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/reel/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
