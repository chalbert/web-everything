---
kind: story
size: 3
parent: "904"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: frontierui/blocks/renderers/data-grid/index.ts
tags: []
---

# data-grid: build DataGridModule element triad wrapping grid:cell-navigation behavior (#1218 B1)

Per #1218 Fork B (ratified B1, applies the #1165 export-shape axis): data-grid declares the DataGridModule/DataGridBehavior/registerDataGrid triad but FUI built it attribute-first — a default-exported CustomAttribute (grid:cell-navigation) + registerDataGrid in fui:blocks/data-grid/, plus renderDataGrid/auditDataGrid helpers in fui:blocks/renderers/data-grid/, with NO *Module element. Build a thin DataGridModule custom element (extends HTMLElement) wrapping the existing behavior + render helper, surface the named triad to match siblings, and reconcile the split location/naming. The element is load-bearing (every sibling ships one; block is type:Module). Clears the 3rd export-shape warning #1218 tracks and unblocks the curated barrel (#1203).

## Delivered (batch-2026-06-20-1212-1213-1214-1216-1217)

Built the `DataGridModule` element + surfaced the CEM triad in a barrel; data-grid is now an export-shape-**covered** block (WE gate green) — it left the #1164 un-coverable set.

- `fui:blocks/renderers/data-grid/DataGridModule.ts` — thin `<we-data-grid>` element: `.rows`/`.config` props render via the shared `renderDataGrid` projector and attach `DataGridBehavior` (grid:cell-navigation) over the table (no new behavior — composes the existing engine + renderer). Plus `registerDataGrid(tag='we-data-grid')` registering the element, mirroring `registerDataTable`.
- `fui:blocks/renderers/data-grid/index.ts` (new barrel) — surfaces the triad `{ DataGridModule, DataGridBehavior, registerDataGrid }` at the WE-canonical `implementedBy` path, re-exporting `DataGridBehavior`/edit behavior from the sibling `blocks/data-grid/` (reconciling the split location into one contract barrel).
- **Naming reconciliation:** the old `registerDataGrid` (registered the *behavior* on a CustomAttributeRegistry, no consumers) → renamed `registerDataGridBehavior`; `registerDataGrid` now registers the *element* to match siblings. Updated the `registerDataGridEdit` doc-comment.
- `we:src/_data/blocks/data-grid.json` — `implementedBy` → the `fui:blocks/renderers/data-grid/index.ts` barrel so the export-shape gate covers the block (it now passes: declared triad ⊆ barrel).
- `fui:blocks/__tests__/unit/data-grid/DataGridModule.test.ts` — 5 tests (render, roving-tabindex nav, re-render, teardown, idempotent register). All 60 data-grid tests + typecheck green.

Completes #1218 (with #1229): all three export-shape findings on the data-* renderer blocks are reconciled, unblocking #1203's curated barrels.
