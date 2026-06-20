---
type: decision
workItem: story
size: 2
parent: "904"
status: open
blockedBy: ["1204"]
dateOpened: "2026-06-20"
tags: []
---

# Resolve renderer Module export-shape drifts (DataTableModule/PaginationModule/DataGridModule absent)

Once #1164 coverage lands, the 8e arm surfaces 3 genuine renderer drifts: DataTableModule, PaginationModule, DataGridModule are declared in we:src/_data/blocks/<id>.json exports but exist NOWHERE in fui:blocks/ (grep=0, verified 2026-06-20); CollectionOperationsModule is present. Source-of-truth call per drift (mirror of #1165): either the we: contract over-declares the *Module name (correct exports to the real behavior surface) or the FUI impl is incomplete (file a locus:frontierui build). data-grid is a draft (leaf DataGridBehavior/registerDataGrid exist, not barrel-published). blockedBy #1204.
