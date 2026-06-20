---
type: idea
workItem: story
size: 3
parent: "904"
locus: frontierui
status: open
blockedBy: ["1218"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
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
