---
type: idea
workItem: story
size: 3
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: "block:data-grid"
tags: [data-grid, editing, a11y, aria, apg]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Declare which Data Grid cells are editable (aria-readonly) and gate edit on it

The editable behavior (#132) lets Enter/F2 open an editor on **any** data cell (it only excludes column
headers). But a real grid mixes editable and read-only columns, and a screen-reader user has no way to
know which cells accept editing before trying. APG's editable Data Grid uses `aria-readonly` on the grid
or per cell to announce editability, and `aria-readonly="true"` cells should not enter edit mode.

Make editability **declared and announced**, not implicit:

- Honor `aria-readonly="true"` on a gridcell (or inherited from the grid / a column): such a cell does
  not enter edit mode on Enter/F2 — fold the check into the pure `editAction` engine alongside the
  existing "headers never edit" rule, so it stays the one source the audit asserts.
- Default editable cells to `aria-readonly="false"` (or leave the grid's setting authoritative) so AT
  announces "editable" and the contract is visible in the DOM.
- Extend `auditEditableGrid` + a fixture so "an aria-readonly cell does not open an editor" and "editable
  cells declare their editability" are CI-guarded, exactly as the navigation invariants are.

## Progress

**Status:** resolved

**Done:**
- Pure engine — `editAction(mode, key, cellRole, readonly = false)` now gates entry on `!readonly`
  alongside the headers-never-edit rule; new DOM helper `cellIsReadonly(cell, grid)` resolves the
  declaration (own `aria-readonly` wins; `"false"` is an explicit editable override; else inherit the
  grid's `aria-readonly="true"`). Both in `blocks/renderers/data-grid/editableGrid.ts`.
- Behavior — `DataGridEditBehavior` reads `cellIsReadonly` and passes `readonly` to `editAction`, so a
  read-only cell never opens an editor.
- Audit — `auditEditableGrid` adds "the edited cell is not aria-readonly".
- Fixture — new case 5 (read-only Salary cell, Enter/F2 do nothing); behavior harness applies the
  `readonly` cells; demo replay + live card mark the Salary column read-only with a visual cue.
- Tests — engine `editAction(readonly)`, `cellIsReadonly` (4), audit readonly check, behavior cell /
  grid-inherit / override cases. Editable suites 39 pass.

**Decision:** kept editability **DOM-driven** (authored `aria-readonly`), not a per-column config object
— consistent with the rest of the grid reading structure from the live DOM, and it leaves per-column
*editor kind* to [#158](/backlog/158-editable-grid-typed-editors-validation/). Did not auto-stamp every editable cell
with `aria-readonly="false"`: authoring stays authoritative, the behavior honors what's declared.

**Graduated to** `block:data-grid` — editAction(readonly) + cellIsReadonly() in blocks/renderers/data-grid/editableGrid.ts; DataGridEditBehavior gates on aria-readonly.
