---
type: idea
workItem: story
size: 5
parent: "131"
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
graduatedTo: "blocks/data-grid/DataGridEditBehavior.ts (grid:cell-edit) + blocks/renderers/data-grid/editableGrid.ts; Data Grid block trait withEditableCells"
tags: [data-grid, a11y, keyboard, editing, apg]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Editable Data Grid cells — the APG editable-grid sub-pattern

The [Data Grid block](/blocks/data-grid/) (#123) realizes the **navigation** half of the WAI-ARIA APG
Data Grid pattern: `role="grid"` cell focus, roving tabindex, arrow/Home/End/Ctrl/Page movement. APG
also documents an **editable** mode the navigation grid composes with — and it is deliberately out of
scope for #123, which shipped read-only navigation.

Add cell editing as a distinct enhancement over the navigation contract:

- **Enter / F2** put the focused cell into edit mode (a text field inside the gridcell); **Escape**
  cancels and restores the value; **Enter** commits and returns focus to the cell.
- While editing, arrow keys move the caret **within** the field, not between cells — the grid's
  navigation is suspended until edit mode exits (APG's editing/navigation mode distinction).
- A committed value emits an observable change; the commit strategy (in-place, optimistic, deferred
  to a server) is a Frontier UI / app concern, named as a seam — the block owns only the mode model.
- Extend `auditDataGrid` (or a sibling audit) + the conformance demo with an editable fixture so the
  mode transitions and the "arrows edit the field, not the grid" invariant are CI-guarded, exactly as
  the navigation contract is.

Decide whether this is an option on the Data Grid block or its own composed block (mirror the
parallel-blocks vs. upgrade reasoning #123 settled for Data Table vs. Data Grid).

## Progress

**Status:** resolved
**Branch:** docs/standard-authoring-workflow (current)

**Decision (where editing lives):** a *separate composable behavior* `grid:cell-edit`, registered under
the **same** Data Grid block — NOT a new parallel block, and NOT an option folded into
`DataGridBehavior`. Reasoning, landing differently from #123 because the relationship is different:
- Data Table vs Data Grid are *different APG patterns* (`role=table`+aria-sort vs `role=grid`+roving
  focus) → parallel blocks.
- Editing is the *same* APG pattern (still the `role=grid` navigation grid) with an editing **mode**
  composed on top — APG documents it as the editable sub-pattern *of* the grid. So not a parallel block.
- Folding it into `DataGridBehavior` would thicken the navigation contract with an orthogonal mode
  concern. Composition-over-monolith → a distinct attribute layering on the same
  `<table role="grid" grid:cell-navigation grid:cell-edit>`; the nav behavior is untouched.

**Mode coordination (the "arrows edit the field, not the grid" invariant):** while editing, the edit
behavior's *input-level* keydown listener calls `stopPropagation()`, so the grid's nav keydown listener
(grid root, bubble phase) never sees the key — navigation is suspended with no coupling. Caret movement
is the input's default action, unaffected by stopPropagation.

**Commit-strategy seam:** commit emits a *cancelable* `grid-cell-edit-commit` ({ position, value,
previousValue }); default writes the value in-place. A host `preventDefault()`s to own the write
(optimistic/server) and the editor restores the previous value as the pending state. Block owns only the
mode model.

**Done:**
- Pure mode engine + audit — `blocks/renderers/data-grid/editableGrid.ts` (`editAction`,
  `auditEditableGrid`, `EDIT_*` keys, event-detail types).
- Behavior — `blocks/data-grid/DataGridEditBehavior.ts` (`grid:cell-edit`) + `registerDataGridEdit.ts`;
  wired into `plugs/bootstrap.ts`.
- Fixtures — `blocks/renderers/data-grid/__fixtures__/editable-grid-cases.ts` (enter→commit, F2→cancel,
  arrows-edit-field invariant, header-not-editable).
- Tests — `blocks/__tests__/unit/renderers/editable-grid.test.ts` (12) +
  `blocks/__tests__/unit/data-grid/DataGridEditBehavior.test.ts` (17); full suite 1547 pass / 7 skip.
- Demo — `demos/data-grid-demo.{ts,css,html}` extended with an editable section (fixture replay cards +
  a live editable grid); verified live in-browser (14/14 badges green, commit/cancel/header all correct,
  0 console errors).
- Docs — block page `data-grid.njk` (new "Editable cells" section + usage/scope), `blocks.json` (exports,
  `apgEditableGrid` standard, `editingComposesNotForks` decision, `withEditableCells` trait),
  `demos.json` description. `check:standards` 0 errors.

**Next:** none — resolved. Follow-ups filed as #157 (auto-upgrade e2e guard), #158 (typed editors +
validation), #159 (aria-readonly cell editability).

**Notes:** the navigation behavior (`grid:cell-navigation`) was left completely untouched — editing is a
decoupled second attribute, suspending navigation purely via the editor's `stopPropagation()`.
