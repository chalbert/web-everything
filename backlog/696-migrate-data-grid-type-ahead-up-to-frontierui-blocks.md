---
type: issue
workItem: story
size: 3
parent: "658"
status: open
blockedBy: ["693"]
dateOpened: "2026-06-15"
tags: []
---

# Migrate data-grid + type-ahead UP to @frontierui/blocks

S2c of #658. Migrate the data-grid (DataGridBehavior, DataGridEditBehavior, registerDataGrid, registerDataGridEdit) and type-ahead (TypeAheadBehavior, index, registerTypeAhead, types) families UP to @frontierui/blocks + their tests, byte-verified against WE's copies, WITHOUT deleting WE's copies (#170 guard). Add to the S1 exports map. Independent of S2a/S2b. Leaves both trees valid.
