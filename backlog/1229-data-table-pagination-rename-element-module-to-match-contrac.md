---
type: issue
workItem: story
size: 2
parent: "904"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: frontierui/blocks/renderers/index.ts
tags: []
---

# data-table + pagination: rename *Element → *Module to match contract (#1218 A1)

Per #1218 Fork A (ratified A1, applies the #1165 export-shape axis): the data-table and pagination renderer element classes ship as DataTableElement/PaginationElement (both extends HTMLElement) but the we: CEM contract + the *Module family convention (CollectionOperationsModule) + type:Module declare *Module. Rename the impl class + register* default-tag references + tests in fui:blocks/renderers/data-table/ and fui:blocks/renderers/pagination/ and the fui:blocks/renderers/index.ts re-export. Mechanical, no behavior change; clears 2 of the 3 export-shape warnings #1218 tracks and unblocks the curated barrels (#1203).

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Renamed `DataTableElement`→`DataTableModule` and `PaginationElement`→`PaginationModule` across all 13 references in 5 files (zero residual; custom-element **tag** strings untouched — class names only):
- `fui:blocks/renderers/data-table/DataTableBehavior.ts` (class decl + `customElements.define`), `fui:blocks/renderers/pagination/PaginationBehavior.ts` (same).
- `fui:blocks/renderers/index.ts` aggregate re-export (the surfaced barrel — now matches the WE CEM `exports` `["DataTableModule",…]` / `["PaginationModule",…]`).
- `fui:demos/loan-origination/app.ts` + `fui:demos/auto-insurance/app.ts` type references.

Pure rename, no behavior change. Typecheck clean; **full FUI suite green (2229 passed, 0 failed)**. Surfaces the `*Module` names matching the contract so #1203's curated barrels re-export cleanly. (data-table/pagination are #1164 non-barrel renderer dirs, so the WE export-shape gate tracks them via #1218, not a per-block barrel warning.) The 2 FUI `check:standards` errors (notification/signature-pad completeness) pre-exist on HEAD (#358/#386).
