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

# Mint the imposter layout-role intent

Author the project-less `imposter` intent (we:src/_data/intents/imposter.json) per #1680: composition-intent = center a child over a positioning context. Candidate role; distinct from `modal`/`anchor` (behavior intents) — imposter is the arrangement, dialog semantics are an optional annotation (Fork-1a). FUI impl guidance: absolute / grid-stack. Renders at /intents/imposter/. Cite we:docs/agent/platform-decisions.md#layout-role-composition-intent.

## Progress (batch-2026-06-23-1725-1665)

Minted the `imposter` layout region-role intent:

- `we:src/_data/intents/imposter.json` — `layoutTier: region-role` (the #1705 convention), full dimensions + description HTML, `requiresCapabilities: []`. Identity = the composition-intent (the arrangement); CSS mechanism noted as an FUI impl seam per we:docs/agent/platform-decisions.md#layout-role-composition-intent.
- `we:src/_data/semantics/imposter.json` — matching glossary term (clears #1327 coverage).
- Renders at `/intents/imposter/`.

Definition-only (zero-impl rule exempts definitions). One of the #1680 core role set under epic #1704.
