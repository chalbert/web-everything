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

# Mint the switcher layout-role intent

Author the project-less `switcher` intent (we:src/_data/intents/switcher.json) per #1680: composition-intent = flip horizontal<->vertical at a content-width threshold (no media breakpoint). Candidate role — distinct from stack/cluster (it auto-switches axis). FUI impl guidance: flex-wrap + min(). Renders at /intents/switcher/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `switcher` layout region-role intent:

- `we:src/_data/intents/switcher.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/switcher.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/switcher/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
