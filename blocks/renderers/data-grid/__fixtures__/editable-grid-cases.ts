/**
 * Shared editable-grid fixtures — the single source of the editing example cases for BOTH the Data Grid
 * Playground demo and the conformance suite, so the demo's green badges are CI-backed (the anti-drift
 * split, mirroring data-grid-cases.ts for the navigation half).
 *
 * Each case seeds focus on a starting cell, replays a script of keystrokes (and simulated typing)
 * through the REAL `grid:cell-navigation` + `grid:cell-edit` behaviors, and pins the end state: the
 * mode (navigating / editing), the navigation focus (proving the grid did NOT move while editing — the
 * "arrows edit the field, not the grid" invariant), and the edited cell's text after. The pure mode
 * engine (`editAction`) and the audit (`auditEditableGrid`) are the one shared source both surfaces run.
 */
import type { CellPosition, DataGridConfig, Row } from '../renderDataGrid';
import type { EditMode } from '../editableGrid';

/** One replay step: a keydown (on whatever is focused) or simulated typing into the editor field. */
export type EditStep = { key: string } | { type: string };

export interface EditableCase {
  id: string;
  title: string;
  note?: string;
  rows: Row[];
  config: DataGridConfig;
  /** The cell focused before the script runs (the active/roving cell). */
  start: CellPosition;
  /** Cells marked `aria-readonly="true"` before the script runs (editability declaration, #159). */
  readonly?: CellPosition[];
  /** Per-cell editor declarations applied before the script runs (typed editors, #158). */
  editors?: { at: CellPosition; kind: string; options?: string; required?: boolean }[];
  /** Keystrokes + typing replayed from `start`, in order. */
  steps: EditStep[];
  /** The mode the grid should be in after the script. */
  expectedMode: EditMode;
  /** Where navigation focus should still be — proves the grid did not move while editing. */
  expectedActive: CellPosition;
  /**
   * The resulting value at `start`: when the case ends NAVIGATING, the cell's committed/restored text;
   * when it ends EDITING (the editor is still open), the editor field's live value.
   */
  expectedText: string;
}

// The same employee corpus the navigation fixtures use — 6 data rows + header = 7 rows, 4 columns.
const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120, location: 'Berlin' },
  { name: 'André', team: 'Design', salary: 95, location: 'Lyon' },
  { name: 'Aaron', team: 'Engineering', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', salary: 105, location: 'Paris' },
  { name: 'Dmitri', team: 'Engineering', salary: 90, location: 'Berlin' },
  { name: 'Émile', team: 'Sales', salary: 80, location: 'Lyon' },
];

const COLUMNS: DataGridConfig['columns'] = [
  { field: 'name', label: 'Name' },
  { field: 'team', label: 'Team' },
  { field: 'salary', label: 'Salary (k)' },
  { field: 'location', label: 'Location' },
];

const CONFIG: DataGridConfig = { columns: COLUMNS };

export const editableCases: EditableCase[] = [
  {
    id: 'enter-commit',
    title: '1 · Enter to edit, type, Enter to commit',
    note: 'Enter on a focused data cell opens a text field seeded with the cell value; typing replaces it; Enter commits the new value and returns focus to the cell. Bianca’s Name (1,0) becomes “Beatriz”.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 1, col: 0 },
    steps: [{ key: 'Enter' }, { type: 'Beatriz' }, { key: 'Enter' }],
    expectedMode: 'navigating',
    expectedActive: { row: 1, col: 0 },
    expectedText: 'Beatriz',
  },
  {
    id: 'f2-escape-cancel',
    title: '2 · F2 to edit, type, Escape to cancel',
    note: 'F2 also opens the editor (APG’s alternate entry key). Escape cancels — the typed value is discarded and the cell’s original text is restored. The Team cell (2,1) stays “Design”.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 2, col: 1 },
    steps: [{ key: 'F2' }, { type: 'Marketing' }, { key: 'Escape' }],
    expectedMode: 'navigating',
    expectedActive: { row: 2, col: 1 },
    expectedText: 'Design',
  },
  {
    id: 'arrows-edit-field',
    title: '3 · Arrows edit the field, not the grid',
    note: 'The invariant: while editing, ArrowRight / ArrowLeft move the caret WITHIN the field — navigation is suspended, so the active cell does not move and the grid stays in edit mode. Focus remains on (3,2); no commit yet.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 3, col: 2 },
    steps: [{ key: 'Enter' }, { key: 'ArrowRight' }, { key: 'ArrowLeft' }, { key: 'ArrowDown' }],
    expectedMode: 'editing',
    expectedActive: { row: 3, col: 2 },
    expectedText: '110', // Aaron's salary — unchanged: still editing, nothing committed
  },
  {
    id: 'header-not-editable',
    title: '4 · A column header is never editable',
    note: 'Enter / F2 on a column header (row 0) do nothing — headers are labels, not data. The grid stays in navigation mode with no editor, and the header text is untouched.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 0, col: 0 },
    steps: [{ key: 'Enter' }, { key: 'F2' }],
    expectedMode: 'navigating',
    expectedActive: { row: 0, col: 0 },
    expectedText: 'Name',
  },
  {
    id: 'readonly-not-editable',
    title: '5 · An aria-readonly cell is never editable',
    note: 'A data cell marked aria-readonly="true" (announced to AT as read-only) does not open an editor on Enter / F2 — the grid stays navigating and the value is untouched. Here the Salary cell (1,2) is read-only.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 1, col: 2 },
    readonly: [{ row: 1, col: 2 }],
    steps: [{ key: 'Enter' }, { key: 'F2' }],
    expectedMode: 'navigating',
    expectedActive: { row: 1, col: 2 },
    expectedText: '120', // Bianca's salary — unchanged, no editor opened
  },
  {
    id: 'number-editor-commit',
    title: '6 · A number editor commits a typed value',
    note: 'A column can declare data-editor="number" — Enter opens a native number field. Typing a valid number and Enter commits it. Bianca’s Salary (1,2) becomes 125.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 1, col: 2 },
    editors: [{ at: { row: 1, col: 2 }, kind: 'number' }],
    steps: [{ key: 'Enter' }, { type: '125' }, { key: 'Enter' }],
    expectedMode: 'navigating',
    expectedActive: { row: 1, col: 2 },
    expectedText: '125',
  },
  {
    id: 'select-editor-commit',
    title: '7 · A select editor commits a chosen option',
    note: 'data-editor="select" with data-editor-options opens a dropdown of the allowed values; choosing one and Enter commits it. Bianca’s Team (1,1) changes from Engineering to Sales.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 1, col: 1 },
    editors: [{ at: { row: 1, col: 1 }, kind: 'select', options: 'Engineering,Design,Sales' }],
    steps: [{ key: 'Enter' }, { type: 'Sales' }, { key: 'Enter' }],
    expectedMode: 'navigating',
    expectedActive: { row: 1, col: 1 },
    expectedText: 'Sales',
  },
  {
    id: 'validation-blocks-commit',
    title: '8 · An invalid value does not commit',
    note: 'A required number editor rejects an empty value: clearing the field and pressing Enter does NOT commit — the editor stays open (marked aria-invalid) and the cell value is unchanged until a valid value is entered.',
    rows: PEOPLE,
    config: CONFIG,
    start: { row: 1, col: 2 },
    editors: [{ at: { row: 1, col: 2 }, kind: 'number', required: true }],
    steps: [{ key: 'Enter' }, { type: '' }, { key: 'Enter' }],
    expectedMode: 'editing', // commit blocked — still editing
    expectedActive: { row: 1, col: 2 },
    expectedText: '', // the editor's (invalid, empty) value
  },
];
