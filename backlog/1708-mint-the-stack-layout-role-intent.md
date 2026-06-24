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

# Mint the stack layout-role intent

Author the project-less `stack` intent (we:src/_data/intents/stack.json) per the #1680 taxonomy: composition-intent = even-spaced vertical flow of siblings. Identity is the arrangement, not the CSS (FUI impl guidance: margin-flow / flex-col + gap). Dimensions per the established intent pattern (e.g. gap scale, recursion). Renders at /intents/stack/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `stack` layout region-role intent:

- `we:src/_data/intents/stack.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/stack.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/stack/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
