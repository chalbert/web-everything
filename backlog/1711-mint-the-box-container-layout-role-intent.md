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

# Mint the box (container) layout-role intent

Author the project-less `box` intent (we:src/_data/intents/box.json) per #1680: composition-intent = padded, max-measure container. Identity = arrangement; FUI impl guidance: padding / max-width + auto-margin. Optional `region` landmark when named. Renders at /intents/box/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `box` layout region-role intent:

- `we:src/_data/intents/box.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/box.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/box/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
