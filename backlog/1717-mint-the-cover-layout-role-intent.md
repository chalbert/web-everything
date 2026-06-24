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

# Mint the cover layout-role intent

Author the project-less `cover` intent (we:src/_data/intents/cover.json) per #1680: composition-intent = full-height focal child between optional header/footer. Candidate role — confirm earns-role test first (already answered: distinct arrangement). FUI impl guidance: flex-col + margin-auto. Renders at /intents/cover/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `cover` layout region-role intent:

- `we:src/_data/intents/cover.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/cover.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/cover/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
