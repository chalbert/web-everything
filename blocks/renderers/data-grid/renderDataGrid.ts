/**
 * Reference renderer for the Data Grid block — the runtime twin of the contract documented at
 * /blocks/data-grid/. It realizes the WAI-ARIA APG **Data Grid** keyboard model: `role="grid"`
 * tabular data with cell-level arrow-key navigation and a roving tabindex, off ONE shared source so
 * the demo (the Data Grid Playground) and CI (the conformance suite) exercise the exact same logic.
 *
 * This is the interactive twin of the read-only **Data Table** block (/blocks/data-table/): same
 * tabular shape, but a *different APG pattern*. Data Table is `role="table"` + click-to-sort
 * (`aria-sort`) — a read-and-reorder concern. Data Grid is `role="grid"` + arrow-key cell focus — a
 * navigate-the-cells concern. APG documents them separately, so they are **parallel blocks**, not a
 * sortable table "upgraded" in place (decision carried from backlog #115). The grid is the concrete
 * consumer of the Focus Delegation intent (/intents/focus-delegation/): strategy `roving`,
 * orientation `both`.
 *
 * Web Everything is the standard: this is a minimal, deterministic reference, NOT the production
 * implementation. Concrete strategies (virtualization, server paging, editable cells) live in
 * Frontier UI / are app-owned. Native DOM only — no framework.
 *
 * The keyboard model is consumed verbatim from the APG Data Grid recipe:
 *   - Arrow keys move focus ONE cell in that direction, clamping at the edges (orientation `both`).
 *   - Home / End jump to the first / last cell of the current row.
 *   - Ctrl+Home / Ctrl+End jump to the first cell of the first row / last cell of the last row.
 *   - PageUp / PageDown move up / down by `pageSize` rows (default 5), clamping.
 *   - The column-header row is itself navigable (arrow-up reaches the headers), so positions range
 *     over `1 (header) + dataRows` rows. Exactly one cell carries `tabindex="0"` (the active cell);
 *     every other cell is `tabindex="-1"` — the roving tabindex.
 */

export type Cell = string | number | null | undefined;
export type Row = Record<string, Cell>;

export interface GridColumn {
  field: string;
  label: string;
}

export interface DataGridConfig {
  columns: GridColumn[];
  /** Rows moved per PageUp / PageDown. Default 5. */
  pageSize?: number;
  caption?: string;
}

/** A cell's location in the grid. `row` 0 is the column-header row; data rows follow (1-based after). */
export interface CellPosition {
  row: number;
  col: number;
}

/** The grid's navigable extent — `rows` INCLUDES the header row. */
export interface GridDimensions {
  rows: number;
  cols: number;
}

/** The normalized key event the movement engine reads (decoupled from the DOM KeyboardEvent). */
export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export const DEFAULT_PAGE_SIZE = 5;
export const ORIGIN: CellPosition = { row: 0, col: 0 };

/** Total navigable rows (header + data) and columns for a row set + contract. */
export function dimensionsOf(rows: Row[], config: DataGridConfig): GridDimensions {
  return { rows: rows.length + 1, cols: config.columns.length };
}

function clamp(n: number, max: number): number {
  return n < 0 ? 0 : n > max ? max : n;
}

/**
 * The APG Data Grid movement engine: given the active cell and a key, return the NEW active cell.
 * Pure and DOM-free — the demo's keydown handler and the conformance suite both call this, so the
 * navigation can't drift between them. Unhandled keys return the same position (caller skips them).
 */
export function nextCellPosition(
  pos: CellPosition,
  input: KeyInput,
  dims: GridDimensions,
  pageSize: number = DEFAULT_PAGE_SIZE,
): CellPosition {
  const lastRow = dims.rows - 1;
  const lastCol = dims.cols - 1;
  const ctrl = !!input.ctrlKey || !!input.metaKey;

  switch (input.key) {
    case 'ArrowUp':
      return { row: clamp(pos.row - 1, lastRow), col: pos.col };
    case 'ArrowDown':
      return { row: clamp(pos.row + 1, lastRow), col: pos.col };
    case 'ArrowLeft':
      return { row: pos.row, col: clamp(pos.col - 1, lastCol) };
    case 'ArrowRight':
      return { row: pos.row, col: clamp(pos.col + 1, lastCol) };
    case 'Home':
      // Ctrl+Home → grid origin; Home → first cell of the current row.
      return ctrl ? { row: 0, col: 0 } : { row: pos.row, col: 0 };
    case 'End':
      // Ctrl+End → last cell of the last row; End → last cell of the current row.
      return ctrl ? { row: lastRow, col: lastCol } : { row: pos.row, col: lastCol };
    case 'PageUp':
      return { row: clamp(pos.row - pageSize, lastRow), col: pos.col };
    case 'PageDown':
      return { row: clamp(pos.row + pageSize, lastRow), col: pos.col };
    default:
      return pos;
  }
}

/** Do the keys land on the same cell? (lets a caller skip a no-op move — e.g. at an edge.) */
export function samePosition(a: CellPosition, b: CellPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

// ── Rendering — project the row set onto a native <table role="grid"> ─────────────────────────

function cellOf(root: HTMLElement, pos: CellPosition): HTMLElement | null {
  return root.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
}

/**
 * Set the roving tabindex so ONLY the cell at `active` is `tabindex="0"`; every other cell is `-1`.
 * Returns the now-focusable cell (or null if the position is out of range) so a caller can `.focus()`
 * it. Mutates in place — used by the live demo on each keystroke without re-rendering the table.
 */
export function setActiveCell(root: HTMLElement, active: CellPosition): HTMLElement | null {
  const cells = root.querySelectorAll<HTMLElement>('[role="gridcell"], [role="columnheader"]');
  let focusable: HTMLElement | null = null;
  cells.forEach((cell) => {
    const r = Number(cell.getAttribute('data-row'));
    const c = Number(cell.getAttribute('data-col'));
    const isActive = r === active.row && c === active.col;
    cell.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) focusable = cell;
  });
  return focusable;
}

/**
 * Render the data grid for a row set + contract. Returns a single <table role="grid"> root:
 *   <table role="grid" aria-rowcount aria-colcount> <caption?>
 *     <thead><tr role="row" aria-rowindex="1"><th role="columnheader" tabindex data-row=0 data-col></tr></thead>
 *     <tbody><tr role="row" aria-rowindex>*<td role="gridcell" tabindex data-row data-col></tr>*</tbody>
 *   </table>
 * The cell at `active` (default the origin header cell) is the single `tabindex="0"` (roving).
 */
export function renderDataGrid(
  rows: Row[],
  config: DataGridConfig,
  active: CellPosition = ORIGIN,
): HTMLTableElement {
  const dims = dimensionsOf(rows, config);
  const table = document.createElement('table');
  table.className = 'data-grid';
  table.setAttribute('role', 'grid');
  table.setAttribute('aria-rowcount', String(dims.rows));
  table.setAttribute('aria-colcount', String(dims.cols));

  if (config.caption) {
    const caption = document.createElement('caption');
    caption.textContent = config.caption;
    table.append(caption);
  }

  const isActive = (r: number, c: number) => r === active.row && c === active.col;

  // Header row — role="row" of role="columnheader" cells, navigable as grid row 0.
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('role', 'row');
  headRow.setAttribute('aria-rowindex', '1');
  config.columns.forEach((col, c) => {
    const th = document.createElement('th');
    th.setAttribute('role', 'columnheader');
    th.setAttribute('data-row', '0');
    th.setAttribute('data-col', String(c));
    th.setAttribute('aria-colindex', String(c + 1));
    th.setAttribute('tabindex', isActive(0, c) ? '0' : '-1');
    th.textContent = col.label;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  // Data rows — role="row" of role="gridcell" cells. Grid row index = data index + 1 (header is 0).
  const tbody = document.createElement('tbody');
  rows.forEach((row, i) => {
    const r = i + 1;
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('aria-rowindex', String(r + 1)); // aria-rowindex is 1-based incl. the header
    config.columns.forEach((col, c) => {
      const td = document.createElement('td');
      td.setAttribute('role', 'gridcell');
      td.setAttribute('data-row', String(r));
      td.setAttribute('data-col', String(c));
      td.setAttribute('aria-colindex', String(c + 1));
      td.setAttribute('tabindex', isActive(r, c) ? '0' : '-1');
      td.textContent = String(row[col.field] ?? '');
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);

  return table;
}

// ── Conformance audit — the verified contract, checked by BOTH the demo badge and the CI suite ──

export interface AuditCheck {
  label: string;
  pass: boolean;
}
export interface AuditResult {
  ok: boolean;
  checks: AuditCheck[];
}

/**
 * Audit a rendered data-grid root against the verified APG Data Grid contract for its config + the
 * expected active cell: native grounding (`role=grid` / `row` / `columnheader` / `gridcell`), the
 * full row/column structure, and the roving-tabindex invariant — exactly one cell is `tabindex="0"`
 * and it is the cell at `active`; every other cell is `tabindex="-1"`. A bug in the projection or
 * the roving logic turns this red.
 */
export function auditDataGrid(
  root: HTMLElement,
  rows: Row[],
  config: DataGridConfig,
  active: CellPosition = ORIGIN,
): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });
  const dims = dimensionsOf(rows, config);

  // ── Native grounding (APG Data Grid) ──
  add('renders a native <table role="grid">', root.tagName === 'TABLE' && root.getAttribute('role') === 'grid');

  const gridRows = Array.from(root.querySelectorAll('[role="row"]'));
  add('every row carries role="row" (header + data rows)', gridRows.length === dims.rows);

  const headerCells = Array.from(root.querySelectorAll('thead [role="columnheader"]'));
  add('every column header is role="columnheader"', headerCells.length === dims.cols);

  const dataCells = Array.from(root.querySelectorAll('tbody [role="gridcell"]'));
  add('every data cell is role="gridcell"', dataCells.length === rows.length * dims.cols);

  add('aria-rowcount / aria-colcount declare the full extent',
    root.getAttribute('aria-rowcount') === String(dims.rows) && root.getAttribute('aria-colcount') === String(dims.cols));

  // ── Roving tabindex (the heart of the contract) ──
  const allCells = Array.from(root.querySelectorAll<HTMLElement>('[role="gridcell"], [role="columnheader"]'));
  const focusable = allCells.filter((c) => c.getAttribute('tabindex') === '0');
  add('exactly one cell is tabindex="0" (roving tabindex)', focusable.length === 1);
  add('every other cell is tabindex="-1"',
    allCells.filter((c) => c.getAttribute('tabindex') === '-1').length === allCells.length - 1);

  const activeCell = focusable[0];
  const activeAtExpected = !!activeCell
    && Number(activeCell.getAttribute('data-row')) === active.row
    && Number(activeCell.getAttribute('data-col')) === active.col;
  add(`the focusable cell is the active cell (row ${active.row}, col ${active.col})`, activeAtExpected);

  return { ok: checks.every((c) => c.pass), checks };
}
