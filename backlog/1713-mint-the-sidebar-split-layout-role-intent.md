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

# Mint the sidebar (split) layout-role intent

Author the project-less `sidebar` intent (we:src/_data/intents/sidebar.json) per #1680: composition-intent = fixed + fluid columns that collapse when narrow. Identity = arrangement; FUI impl guidance: flex-basis + grow + wrap. The draggable boundary is the existing `resizable` intent (#1384); landmark navigation|complementary optional. Renders at /intents/sidebar/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `sidebar` layout region-role intent:

- `we:src/_data/intents/sidebar.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/sidebar.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/sidebar/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
