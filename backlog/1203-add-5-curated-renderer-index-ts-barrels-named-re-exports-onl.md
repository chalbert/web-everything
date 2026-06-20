---
type: idea
workItem: story
size: 3
parent: "904"
locus: frontierui
status: resolved
blockedBy: ["1229", "1230"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: frontierui/blocks/renderers/data-table/index.ts
tags: []
---

# Add 5 curated renderer index barrels (named re-exports only) — #1164 graduation slice 1

Per the #1164 ruling (B): add a curated per-dir barrel (one per renderer, e.g. `fui:blocks/renderers/data-table/index.ts`) for collection-operations, data-grid, data-table, pagination, reorderable-list. NAMED re-exports only (never export *) — this is the anti-drift rule: a named export {X} from './leaf' is a TS error if the leaf drops X (compiler locks barrel→impl). Each barrel re-exports exactly the block's declared public surface. Foundational slice; locus frontierui.

## Progress (batch-2026-06-20-deck) — 2/5 delivered, 3/5 forked on export-shape drift

Delivered the 2 renderers whose FUI impl provides exactly the declared CEM public surface (clean named-re-export barrels, anti-drift compiler-locked):
- `fui:blocks/renderers/collection-operations/index.ts` → `{ CollectionOperationsModule, CollectionOperationsBehavior, registerCollectionOperations }`
- `fui:blocks/renderers/reorderable-list/index.ts` → `{ reduceReorder, reconcileOrder, announce, initialState }` + `{ renderReorderableList, auditReorderableList }`

FUI gate diagnosed: the 2 `check:standards` errors (`blocks/notification/`, `blocks/signature-pad/` catalog completeness) **pre-exist on HEAD** (prior #358/#386), not from these barrels — verified by stashing the barrels (errors unchanged). Not this item's stop.

### Surfaced fork (blocks the other 3) — contract↔impl export-shape drift
The remaining 3 renderers cannot get a clean barrel: re-exporting the declared names is a TS error (the leaf lacks them), and re-exporting the impl names trips the CEM↔barrel drift gate. The declared (CEM) surface vs the FUI impl:
- **data-table** — CEM `[DataTableModule, DataTableBehavior, registerDataTable]`; impl exports `DataTableBehavior`, **`DataTableElement`** (not `DataTableModule`), `registerDataTable`. → a `Module`-vs-`Element` rename reconciliation.
- **pagination** — CEM `[PaginationModule, PaginationBehavior, registerPagination]`; impl exports `PaginationBehavior`, **`PaginationElement`**, `registerPagination`. → same rename.
- **data-grid** — CEM `[DataGridModule, DataGridBehavior, registerDataGrid]`; impl has **none** of these — it is functional-only (`renderDataGrid`, `auditDataGrid`, `editableGrid` helpers, no custom-element class/register). → a genuine missing-surface gap, not a rename.

This is the **same class** as the open decision **#1165** (resolve export-shape-drift findings). The direction (rename impl `*Element`→`*Module` to match the collection-operations convention, vs. amend the CEM to `*Element`; and whether data-grid must grow the Module/Behavior/register triad) is a contract-vs-impl call — not made here. **Recommend folding these 3 into #1165's reconciliation, then the 3 barrels are a trivial follow-up.** Item left **open** (2/5 done).

## Completed 5/5 (batch-2026-06-20-1212-1213-1214-1216-1217)

The surfaced fork was resolved by decision **#1218** (A1 rename, B1 build), then the prerequisite builds landed this batch (**#1229** renamed data-table/pagination `*Element`→`*Module`; **#1230** built the `DataGridModule` triad + its barrel). With the impl names now matching the CEM, the remaining barrels are the trivial follow-up the note predicted:

- `fui:blocks/renderers/data-table/index.ts` — named re-export of `{ DataTableModule, DataTableBehavior, registerDataTable }`.
- `fui:blocks/renderers/pagination/index.ts` — named re-export of `{ PaginationModule, PaginationBehavior, registerPagination }`.
- data-grid barrel (`fui:blocks/renderers/data-grid/index.ts`) was delivered by #1230.

All 5 curated barrels (collection-operations, reorderable-list, data-table, pagination, data-grid) are now NAMED-only (compiler-locked anti-drift). `we:src/_data/blocks/{data-table,pagination,data-grid}.json` `implementedBy` now point at the barrels, so the export-shape gate **covers** them and they pass (un-coverable set 35→32). WE gate green. Foundational for flipping `EXPORT_SHAPE_ENFORCED`.
