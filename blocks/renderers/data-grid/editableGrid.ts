/**
 * The editable sub-pattern of the Data Grid block — the runtime twin of the editing contract the
 * navigation grid (renderDataGrid) composes with. APG documents an **editable** mode layered on the
 * SAME `role="grid"` navigation pattern: a focused data cell can drop into an editor, and while it is
 * editing the grid's cell navigation is suspended (arrows move the caret in the field, not the focus
 * between cells). This file owns the *mode model* of that sub-pattern — the pure engine plus the
 * conformance audit — exactly as renderDataGrid owns the navigation model.
 *
 * Two pieces, mirroring the navigation half:
 *   - `editAction(mode, key, cellRole)` — the pure, DOM-free engine: given the current mode, a key, and
 *     the role of the focused cell, return the mode transition. Enter / F2 on a `gridcell` enter edit;
 *     Enter commits; Escape cancels; a column header never edits. The behavior (DataGridEditBehavior)
 *     and the conformance suite both read this, so the mode model can't drift between them.
 *   - `auditEditableGrid(root, expectation)` — the structural audit: given the cell expected to be in
 *     edit mode (or null when navigating), assert exactly one editor input exists, it lives inside that
 *     data cell, and no column header is ever editable. Drives the demo badge and CI off one source.
 *
 * Web Everything is the standard: this owns the mode contract only. The **commit strategy** (write
 * in-place, optimistic, deferred to a server) is a Frontier UI / app concern — the behavior emits a
 * cancelable `grid-cell-edit-commit` as the named seam and writes in-place as the reference default.
 */

import type { AuditCheck, AuditResult, CellPosition } from './renderDataGrid';

/** The two modes the editable sub-pattern toggles between (APG's navigation/editing distinction). */
export type EditMode = 'navigating' | 'editing';

/**
 * The transition the mode engine yields for a key:
 *   - `enter`  — leave navigation, drop the focused data cell into an editor (Enter / F2).
 *   - `commit` — leave editing, keep the new value (Enter).
 *   - `cancel` — leave editing, restore the previous value (Escape).
 *   - `none`   — no mode change (every other key; while editing these reach the field as caret moves).
 */
export type EditAction = 'enter' | 'commit' | 'cancel' | 'none';

/** Keys that drop a focused data cell into edit mode — the APG editable-grid entry keys. */
export const EDIT_ENTER_KEYS = new Set(['Enter', 'F2']);
/** Keys that commit the editor and return to navigation. */
export const EDIT_COMMIT_KEYS = new Set(['Enter']);
/** Keys that cancel the editor (restoring the prior value) and return to navigation. */
export const EDIT_CANCEL_KEYS = new Set(['Escape']);

/** The ARIA role a cell must carry to be editable — data cells only; headers are labels, never edited. */
export const EDITABLE_CELL_ROLE = 'gridcell';

/** The editor kinds a column can declare (#158); `text` is the unconfigured default. */
export type EditorKind = 'text' | 'number' | 'date' | 'select';
export const EDITOR_KINDS: readonly EditorKind[] = ['text', 'number', 'date', 'select'];

/** DOM attributes that declare a cell's editor (per-column, read off the cell — DOM-driven like #159). */
export const EDITOR_KIND_ATTR = 'data-editor'; // text | number | date | select
export const EDITOR_OPTIONS_ATTR = 'data-editor-options'; // comma-separated, for kind="select"

/** Normalize a declared editor kind to a known one; anything unrecognized falls back to `text`. */
export function resolveEditorKind(raw: string | null | undefined): EditorKind {
  return EDITOR_KINDS.includes(raw as EditorKind) ? (raw as EditorKind) : 'text';
}

/** Does a rendered editor element match a declared kind? (`select` → `<select>`; else `<input type>`). */
export function editorMatchesKind(editor: Element | null, kind: EditorKind): boolean {
  if (!editor) return false;
  if (kind === 'select') return editor.tagName === 'SELECT';
  if (editor.tagName !== 'INPUT') return false;
  const type = (editor as HTMLInputElement).type;
  return kind === 'text' ? type === 'text' : type === kind; // number → "number", date → "date"
}

/**
 * The pure editable-grid mode engine: given the current mode, a key, the focused cell's role, and
 * whether that cell is read-only, return the mode transition. DOM-free and deterministic — the
 * behavior's keydown handlers and the conformance suite both call this, so the "Enter/F2 enter, Enter
 * commits, Escape cancels, headers and read-only cells never edit" model can't drift between them.
 * Unhandled keys return `none`.
 */
export function editAction(
  mode: EditMode,
  key: string,
  cellRole: string,
  readonly = false,
): EditAction {
  if (mode === 'navigating') {
    // Only an editable DATA cell drops into edit mode: a column header (a label) never does, and an
    // `aria-readonly` cell is announced + treated as non-editable (#159).
    return EDIT_ENTER_KEYS.has(key) && cellRole === EDITABLE_CELL_ROLE && !readonly ? 'enter' : 'none';
  }
  // mode === 'editing' — Enter keeps the value, Escape restores it; all else stays in the field.
  if (EDIT_COMMIT_KEYS.has(key)) return 'commit';
  if (EDIT_CANCEL_KEYS.has(key)) return 'cancel';
  return 'none';
}

/**
 * Whether a cell is read-only — the editability declaration AT announces and the behavior gates on.
 * A cell's own `aria-readonly` wins (`"false"` is an explicit editable override); otherwise the grid's
 * `aria-readonly="true"` makes every cell read-only by default. DOM-reading (not pure), kept beside the
 * engine so the behavior and the audit resolve editability the one same way.
 */
export function cellIsReadonly(cell: HTMLElement, grid: HTMLElement | null): boolean {
  const own = cell.getAttribute('aria-readonly');
  if (own === 'true') return true;
  if (own === 'false') return false;
  return grid?.getAttribute('aria-readonly') === 'true';
}

// ── Event detail shapes — the observable change the editor emits (the commit-strategy seam) ──────

/** Detail for `grid-cell-edit-start` / `grid-cell-edit-cancel` — which cell entered/left edit mode. */
export interface GridCellEditDetail {
  position: CellPosition;
  /** The cell's value at the moment of the event (start: current; cancel: the restored value). */
  value: string;
}

/**
 * Detail for the cancelable `grid-cell-edit-commit` — the named commit-strategy seam. A host listens
 * to persist (optimistic / server) and may either:
 *   - `preventDefault()` to own the cell write itself (the reference default writes `value` in-place), or
 *   - `reject(message?)` to mark the value invalid — the editor stays open (the value did not pass
 *     validation), distinct from preventDefault which means "valid, I'll write it".
 */
export interface GridCellEditCommitDetail {
  position: CellPosition;
  value: string;
  previousValue: string;
  /** Reject the value as invalid: the editor stays open instead of committing (#158). */
  reject(message?: string): void;
}

/** Detail for `grid-cell-edit-invalid` — a commit that was blocked by native or host validation (#158). */
export interface GridCellEditInvalidDetail {
  position: CellPosition;
  value: string;
  message: string;
}

/** The class the behavior puts on the editor `<input>` — the audit's hook for "an editor is present". */
export const EDITOR_INPUT_CLASS = 'grid-cell-input';

// ── Conformance audit — the editable mode contract, checked by BOTH the demo badge and CI ────────

/** What the editable audit is told to expect: the cell in edit mode, or null when navigating. */
export interface EditableExpectation {
  editingAt: CellPosition | null;
}

/** Every editor element in the grid — an `<input>` OR a `<select>` (#158), keyed by the shared class. */
function editorElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`.${EDITOR_INPUT_CLASS}`));
}

/**
 * Audit a rendered grid against the editable mode contract for the expected state:
 *   - No column header is ever editable — there is never an editor inside `thead`.
 *   - Navigating (`editingAt: null`): no cell holds an editor input.
 *   - Editing (`editingAt` set): exactly one editor input exists, it lives inside the data cell at
 *     `editingAt`, and that cell is a `role="gridcell"` (not a header).
 * A bug in the mode wiring — an orphaned editor, an editor on a header, an editor on the wrong cell —
 * turns this red, exactly as `auditDataGrid` guards the navigation contract.
 */
export function auditEditableGrid(root: HTMLElement, expectation: EditableExpectation): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });

  const editors = editorElements(root);
  const headerEditors = Array.from(root.querySelectorAll(`thead .${EDITOR_INPUT_CLASS}`));
  add('no column header is editable (no editor in the header row)', headerEditors.length === 0);

  const { editingAt } = expectation;
  if (!editingAt) {
    add('navigating: no cell holds an editor', editors.length === 0);
    return { ok: checks.every((c) => c.pass), checks };
  }

  add('editing: exactly one editor is present', editors.length === 1);

  const editor = editors[0] ?? null;
  const cell = editor?.closest<HTMLElement>('[data-row][data-col]') ?? null;
  const atExpected =
    !!cell &&
    Number(cell.getAttribute('data-row')) === editingAt.row &&
    Number(cell.getAttribute('data-col')) === editingAt.col;
  add(`the editor is inside the active data cell (row ${editingAt.row}, col ${editingAt.col})`, atExpected);
  add('the edited cell is a role="gridcell" (not a header)', cell?.getAttribute('role') === EDITABLE_CELL_ROLE);
  add('the edited cell is not aria-readonly', !!cell && !cellIsReadonly(cell, cell.closest('[role="grid"]')));

  // The editor element matches the cell's declared kind (#158): select → <select>, else <input type>.
  const declaredKind = resolveEditorKind(cell?.getAttribute(EDITOR_KIND_ATTR));
  add(`the editor matches the cell's declared kind (${declaredKind})`, editorMatchesKind(editor, declaredKind));

  return { ok: checks.every((c) => c.pass), checks };
}
