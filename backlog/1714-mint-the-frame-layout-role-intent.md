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

# Mint the frame layout-role intent

Author the project-less `frame` intent (we:src/_data/intents/frame.json) per #1680: composition-intent = crop media to a fixed aspect ratio. Identity = arrangement; FUI impl guidance: aspect-ratio + object-fit. Renders at /intents/frame/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `frame` layout region-role intent:

- `we:src/_data/intents/frame.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/frame.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/frame/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
