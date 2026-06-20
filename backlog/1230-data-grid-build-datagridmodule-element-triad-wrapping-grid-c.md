---
type: issue
workItem: story
size: 3
parent: "904"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# data-grid: build DataGridModule element triad wrapping grid:cell-navigation behavior (#1218 B1)

Per #1218 Fork B (ratified B1, applies the #1165 export-shape axis): data-grid declares the DataGridModule/DataGridBehavior/registerDataGrid triad but FUI built it attribute-first — a default-exported CustomAttribute (grid:cell-navigation) + registerDataGrid in fui:blocks/data-grid/, plus renderDataGrid/auditDataGrid helpers in fui:blocks/renderers/data-grid/, with NO *Module element. Build a thin DataGridModule custom element (extends HTMLElement) wrapping the existing behavior + render helper, surface the named triad to match siblings, and reconcile the split location/naming. The element is load-bearing (every sibling ships one; block is type:Module). Clears the 3rd export-shape warning #1218 tracks and unblocks the curated barrel (#1203).
