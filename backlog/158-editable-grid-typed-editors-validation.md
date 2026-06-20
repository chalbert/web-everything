---
kind: story
size: 3
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: "block:data-grid"
tags: [data-grid, editing, validation, forms]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Typed cell editors + validation for the editable Data Grid

The editable sub-pattern (#132) always opens a plain `<input type="text">` for the focused cell. Real
grids edit typed columns — numbers, dates, enumerated values — and reject invalid input on commit. APG's
editable grid permits any editor (a select, a spinbutton) inside the gridcell while the cell keeps its
`role="gridcell"`.

Add an **editor-kind seam** to `grid:cell-edit` so a column declares its editor (text / number / date /
select-with-options) and a commit can be **rejected**:

- A per-column `editor` contract (the kind + options) chosen by `data-col`, defaulting to text — so the
  current behavior is the unconfigured case.
- Validation on commit: the existing cancelable `grid-cell-edit-commit` already lets a host
  `preventDefault()`; formalize a rejected-commit path that keeps the editor open (or re-opens) and
  surfaces the error, vs. the current "tear down + restore previous" on host-prevent.
- Keep the **mode model** here (which editor, valid/invalid); the **persistence** stays the Frontier UI
  commit-strategy seam. Extend `auditEditableGrid` + a fixture so "the editor matches the column kind"
  and "an invalid value does not commit" are CI-guarded.

## Progress

**Status:** resolved

**Done:**
- Editor-kind seam — DOM-driven (consistent with #159): a cell declares `data-editor` =
  `text` (default) / `number` / `date` / `select`, with `data-editor-options` for select and
  `required`/`min`/`max` passed through for native validation. `DataGridEditBehavior.#createEditor`
  builds the right `<input type>` or `<select>`. Pure helpers `resolveEditorKind` + `editorMatchesKind`
  in `fui:editableGrid.ts`.
- Validation path — commit now gates on native `checkValidity()` **and** a new
  `detail.reject(message?)` hook on the cancelable `grid-cell-edit-commit` (distinct from
  `preventDefault()` = "I own the write"). An invalid value on **Enter** keeps the editor open, marks it
  `aria-invalid`, and emits `grid-cell-edit-invalid`; typing clears the mark; **blur** on an invalid
  value cancels (restore) rather than trapping focus.
- Audit — `auditEditableGrid` generalized to count `<input>`+`<select>` editors and added "the editor
  matches the cell's declared kind".
- Fixtures — cases 6–8 (number commit, select commit, required-blocks-commit); harness + demo apply the
  `editors` declarations.
- Tests — engine (`resolveEditorKind`, `editorMatchesKind`) + audit kind-mismatch; behavior
  (number/select/fallback editors, required-rejects-empty, host `reject()`, type-clears-invalid,
  blur-invalid-cancels). Full suite 1570 pass / 7 skip; data-grid e2e 6/6.
- Demo — live editable grid now shows all four: Name=text, Team=select, Salary=required number
  (validation), Location=read-only; invalid editor styled + `grid-cell-edit-invalid` surfaced in the
  read-out. Verified live: 18/18 badges green, select/number/validation/readonly all correct, 0 errors.
- Docs — block page `we:data-grid.njk` (typed-editors + validation bullets), `fui:blocks.json` (exports,
  `apgEditableGrid` adoption, `withEditableCells` trait). `check:standards` 0 errors.

**Decision:** kept the editor declaration **DOM-driven** (`data-editor*` on the cell) rather than a
JS column-config object — same rationale as [#159](/backlog/159-editable-grid-cell-editability-aria/) (the grid reads
structure from the live DOM). Validation is **two-tier**: native constraint validation for the common
cases, plus a host `reject()` seam for custom rules — persistence itself stays the Frontier UI seam.

**Graduated to** `block:data-grid` — data-editor kinds (text/number/date/select) + validation seam in fui:blocks/renderers/data-grid/editableGrid.ts (resolveEditorKind/editorMatchesKind) + DataGridEditBehavior.
