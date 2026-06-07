/**
 * Shared Data Grid fixtures — the single source of the example cases for BOTH the Data Grid
 * Playground demo and the conformance suite, so the demo's green badges are CI-backed (the
 * anti-drift split, mirroring the data-table / pagination / JSX fixtures).
 *
 * Each case pairs a row set + a grid contract with a key sequence from the origin and the cell that
 * sequence should land on — proving one rule of the APG Data Grid keyboard model (arrow movement,
 * Home/End, Ctrl+Home/End, PageUp/Down, edge clamping). The renderer (renderDataGrid), the movement
 * engine (nextCellPosition), and the audit (auditDataGrid) are the one shared source both surfaces
 * run.
 */
import type { DataGridConfig, Row, CellPosition, KeyInput } from '../renderDataGrid';

export interface DataGridCase {
  id: string;
  title: string;
  note?: string;
  rows: Row[];
  config: DataGridConfig;
  /** Keys pressed from the origin (the top-left header cell). */
  keys: KeyInput[];
  /** Where that sequence should leave focus — double-entry against the movement engine. */
  expected: CellPosition;
}

// A small employee corpus — 6 data rows + the header row = 7 navigable grid rows, 4 columns.
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

const k = (key: string, mod?: 'ctrl'): KeyInput => (mod === 'ctrl' ? { key, ctrlKey: true } : { key });

export const dataGridCases: DataGridCase[] = [
  {
    id: 'origin',
    title: '1 · Initial focus — top-left header cell',
    note: 'On render, exactly one cell is tabindex="0": the origin (row 0, col 0), a column header. The header row is itself navigable per the APG Data Grid pattern. Every other cell is tabindex="-1" — the roving tabindex.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [],
    expected: { row: 0, col: 0 },
  },
  {
    id: 'arrow-into-data',
    title: '2 · Arrow Down — into the first data row',
    note: 'ArrowDown moves focus one cell down: from the Name header (0,0) onto the first data cell (1,0). Roving tabindex follows — the new cell becomes tabindex="0", the header drops to -1.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('ArrowDown')],
    expected: { row: 1, col: 0 },
  },
  {
    id: 'arrow-diagonal',
    title: '3 · Right then Down — two-dimensional movement (orientation both)',
    note: 'The grid binds all four arrows (Focus Delegation orientation:both). Right then Down walks from (0,0) → (0,1) → (1,1): the Team column, first data row.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('ArrowRight'), k('ArrowDown')],
    expected: { row: 1, col: 1 },
  },
  {
    id: 'home-end-row',
    title: '4 · Home / End — jump to the row ends',
    note: 'From a mid-row cell, End jumps to the last cell of that row and Home to the first. Here: Down to (1,0), Right to (1,1), End → (1,3) Location, Home → (1,0) Name. Home/End stay within the row.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('ArrowDown'), k('ArrowRight'), k('End'), k('Home')],
    expected: { row: 1, col: 0 },
  },
  {
    id: 'ctrl-end',
    title: '5 · Ctrl+End — jump to the last cell of the last row',
    note: 'Ctrl+End jumps to the grid’s far corner: the last data row, last column (6,3) — Émile’s Location — regardless of the current cell.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('ArrowDown'), k('End', 'ctrl')],
    expected: { row: 6, col: 3 },
  },
  {
    id: 'ctrl-home',
    title: '6 · Ctrl+Home — jump back to the grid origin',
    note: 'From anywhere, Ctrl+Home returns to the top-left header cell (0,0). Here from the far corner (via Ctrl+End) straight back to origin.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('End', 'ctrl'), k('Home', 'ctrl')],
    expected: { row: 0, col: 0 },
  },
  {
    id: 'page-down-clamp',
    title: '7 · PageDown — move by a page, clamping at the last row',
    note: 'PageDown moves down by pageSize rows (default 5). From origin (0,0): one PageDown → (5,0); a second clamps at the last row (6,0) rather than overshooting. PageUp is the mirror.',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('PageDown'), k('PageDown')],
    expected: { row: 6, col: 0 },
  },
  {
    id: 'edge-clamp',
    title: '8 · Edge clamp — movement stops at the boundary',
    note: 'At the origin, ArrowUp and ArrowLeft have nowhere to go: focus clamps and stays at (0,0). The APG model clamps at the ends (this grid does not wrap).',
    rows: PEOPLE,
    config: { columns: COLUMNS },
    keys: [k('ArrowUp'), k('ArrowLeft'), k('ArrowUp')],
    expected: { row: 0, col: 0 },
  },
];
