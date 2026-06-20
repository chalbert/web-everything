---
type: issue
workItem: story
size: 2
parent: "904"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# data-table + pagination: rename *Element → *Module to match contract (#1218 A1)

Per #1218 Fork A (ratified A1, applies the #1165 export-shape axis): the data-table and pagination renderer element classes ship as DataTableElement/PaginationElement (both extends HTMLElement) but the we: CEM contract + the *Module family convention (CollectionOperationsModule) + type:Module declare *Module. Rename the impl class + register* default-tag references + tests in fui:blocks/renderers/data-table/ and fui:blocks/renderers/pagination/ and the fui:blocks/renderers/index.ts re-export. Mechanical, no behavior change; clears 2 of the 3 export-shape warnings #1218 tracks and unblocks the curated barrels (#1203).
