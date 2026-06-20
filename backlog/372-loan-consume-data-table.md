---
kind: story
size: 3
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:data-table"
tags: [exercise-app, loan-origination, data-table, collection-operations, consumption-slice]
---

# Loan pipeline consumes the Data Table block (+ built its behavior)

Consumption slice of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). The data-table
block declared `DataTableBehavior`/`registerDataTable` but never shipped them; this slice **built both**
over the verified `renderDataTable` (click-to-sort + announce + `<data-table>` element, with tests),
**flipped data-table draft→active**, and refactored the loan pipeline onto `<data-table>`. Also satisfies
the `collection-operations` intent (via the active block). **Resolved**: data-table + collection-operations
read `conformant`. Surfaced gap: per-column cell formatter ([#368]).
