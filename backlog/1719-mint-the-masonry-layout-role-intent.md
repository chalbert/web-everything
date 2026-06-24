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

# Mint the masonry layout-role intent

Author the project-less `masonry` intent (we:src/_data/intents/masonry.json) per #1680: composition-intent = shortest-column packing. Candidate role; stays DISTINCT from grid (the #1680 load-bearing example — must not merge when CSS masonry ships). FUI impl guidance: grid masonry / CSS columns. Renders at /intents/masonry/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `masonry` layout region-role intent:

- `we:src/_data/intents/masonry.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/masonry.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/masonry/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
