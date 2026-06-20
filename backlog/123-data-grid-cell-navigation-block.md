---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: block:data-grid
tags: [data-table, grid, a11y, keyboard, focus-delegation, block]
relatedProject: webblocks
crossRef: { url: /blocks/data-table/, label: Data Table block }
---

# Data Grid — `role="grid"` cell-level keyboard navigation as a distinct block

Carved out of [#115](/blocks/data-table/) (Data Table interactivity), which shipped click-to-sort
and live announcements but **deferred** the third, optional piece: `role="grid"` cell-level keyboard
navigation (arrow-key cell traversal, roving tabindex, Home/End/PageUp/PageDown per the WAI-ARIA APG
**Data Grid** pattern).

**Decision taken in #115:** this does **not** belong in the Data Table block. The read-only
*Sortable Table* (`role=table`, click-to-sort, `aria-sort`) and the interactive *Data Grid*
(`role=grid`, arrow-key cell focus) are two distinct APG patterns with different interaction models
and different a11y contracts — APG documents them separately. Folding grid navigation into the
Sortable Table block would conflate them. So this is its own block, composed onto the same collection
when arrow-key cell traversal is actually wanted.

Scope when picked up:

1. **Realize the APG Data Grid keyboard model** — roving tabindex over cells, arrow-key movement,
   Home/End/Ctrl+Home/Ctrl+End, and the `role="grid"` / `role="row"` / `role="gridcell"` structure.
2. **Compose [Focus Delegation](/intents/focus-delegation/)** for the focus-management half rather
   than reinventing it — the grid is a concrete consumer of that intent.
3. **Decide the relationship to Data Table** — can a Sortable Table be *upgraded* to a Data Grid
   (same rows/columns, added cell nav), or are they parallel blocks sharing the renderer/audit/
   fixtures? Mirror the shared-source / anti-drift split the Data Table block uses.
4. **Conformance demo + suite** — a live playground card whose arrow-key navigation re-runs an audit
   asserting the roving-tabindex + `role=grid` contract, exactly as the Data Table block does.

## Progress

- **Status:** resolved — Data Grid shipped as a parallel block mirroring the Data Table renderer/audit/fixture/playground pattern. Graduated to `block:data-grid`.
- **Branch:** docs/standard-authoring-workflow
- **Decisions taken:**
  - **Parallel block, not an upgrade of Data Table** (per #115's `sortableTableOverGrid` decision: distinct APG patterns). Self-contained `renderDataGrid` (grid-local `GridColumn`/`Row` types) rather than coupling to the sort-focused `renderDataTable`; cross-referenced in both descriptions.
  - **Composes Focus Delegation** (`strategy: roving`, `orientation: both`) — the grid is a concrete consumer of that intent. `implementsIntent: focus-delegation`.
  - **Header row is navigable** (APG Data Grid: arrow-up reaches column headers). Position model `{row,col}` over `1 (header) + dataRows` rows; movement clamps at edges.
  - **Keyboard model:** Arrows (1 cell, clamp), Home/End (row ends), Ctrl+Home/Ctrl+End (grid corners), PageUp/PageDown (±pageSize rows, default 5). Roving tabindex: exactly one cell `tabindex=0` (the active cell), all others `-1`.
- **Done (all 4 scope points):**
  - **Keyboard model** — `fui:blocks/renderers/data-grid/renderDataGrid.ts`: `nextCellPosition` (arrows clamp, Home/End, Ctrl+Home/End, PageUp/Down by pageSize), `renderDataGrid` (`role=grid`/`row`/`columnheader`/`gridcell` + `aria-rowcount`/`colcount`/`rowindex`/`colindex`), `setActiveCell` (roving tabindex), `auditDataGrid`.
  - **Composes Focus Delegation** — `roving` strategy, `orientation: both`; `implementsIntent`/`composesIntents: focus-delegation`.
  - **Relationship to Data Table decided** — parallel block (not an upgrade), per #115; cross-referenced both ways in the descriptions.
  - **Conformance demo + suite** — `fui:blocks/renderers/data-grid/__fixtures__/data-grid-cases.ts` (8 cases) shared by `we:blocks/__tests__/unit/renderers/data-grid.test.ts` (22 tests) and `demos/data-grid-demo.{html,ts,css}` (8 static cards + 1 live keyboard-nav card). Registered: `fui:blocks.json` entry, `we:block-descriptions/data-grid.njk`, `we:demos.json` playground.
  - **Green:** 22 data-grid tests + full suite 1418 pass; `check:standards` 0 errors; 11ty build wrote `/blocks/data-grid/` + `we:/demos/data-grid-demo.html`; playground e2e green on live :3000.
- **Leftovers captured:** [#131](/backlog/131-data-grid-cell-navigation-behavior/) (Frontier UI `grid:cell-navigation` behavior — graduate the inline demo wiring, scroll-into-view, `wrap` option), [#132](/backlog/132-editable-data-grid-cells/) (APG editable-grid sub-pattern).
