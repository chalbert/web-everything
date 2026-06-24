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

# Mint the grid layout-role intent

Author the project-less `grid` intent (we:src/_data/intents/grid.json) per #1680: composition-intent = uniform responsive cells, fit-to-container. Identity = arrangement; FUI impl guidance: auto-fit minmax. Distinct from masonry (stays a separate role). Renders at /intents/grid/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `grid` layout region-role intent:

- `we:src/_data/intents/grid.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/grid.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/grid/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
