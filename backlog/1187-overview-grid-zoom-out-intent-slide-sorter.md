---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:overview-grid"
relatedProject: webintents
tags: [deck, overview, grid, webintents]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Overview / grid zoom-out intent — slide-sorter

A spatial **slide-sorter intent** — zoom out to a grid of slides, scale, select, drag-reorder — distinct from `navigation` (it's spatial, not hierarchical/lateral). Composes `collection-operations`; homed in **webintents**. *New contract.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `overview-grid` in **webintents** (`we:src/_data/intents/overview-grid.json`): the spatial slide-sorter (zoom out → grid → select-to-jump, optional drag-reorder) with `grouping` (flat/sectioned) + `reorder` (none/drag) axes. Explicitly distinct from Navigation (spatial, not hierarchical); composes collection-operations + the #1180 document model. Auto-renders at `/intents/overview-grid/`.
