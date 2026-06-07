/**
 * Permanent conformance suite for the Data Grid block (the playground's badges, in CI).
 *
 * Iterates the SHARED data-grid fixtures and, per case, (1) folds the key sequence through the SAME
 * movement engine the demo uses and asserts it lands on the fixture's expected cell, then (2) renders
 * the grid at that cell and runs the SAME audit the demo runs in the browser — so a regression in the
 * reference renderer, the roving-tabindex logic, or the APG movement model turns this red. Plus
 * targeted assertions for each keyboard rule (arrows clamp, Home/End, Ctrl+Home/End, PageUp/Down) and
 * the roving-tabindex invariant under live cell moves.
 *
 * See /blocks/data-grid/ and the Focus Delegation intent (/intents/focus-delegation/).
 */
import { describe, it, expect } from 'vitest';
import { dataGridCases } from '../../../renderers/data-grid/__fixtures__/data-grid-cases';
import {
  renderDataGrid,
  auditDataGrid,
  nextCellPosition,
  dimensionsOf,
  setActiveCell,
  samePosition,
  ORIGIN,
  DEFAULT_PAGE_SIZE,
  type CellPosition,
  type DataGridConfig,
  type KeyInput,
  type Row,
} from '../../../renderers/data-grid/renderDataGrid';

const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120, location: 'Berlin' },
  { name: 'André', team: 'Design', salary: 95, location: 'Lyon' },
  { name: 'Aaron', team: 'Engineering', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', salary: 105, location: 'Paris' },
  { name: 'Dmitri', team: 'Engineering', salary: 90, location: 'Berlin' },
  { name: 'Émile', team: 'Sales', salary: 80, location: 'Lyon' },
];
const COLS: DataGridConfig['columns'] = [
  { field: 'name', label: 'Name' },
  { field: 'team', label: 'Team' },
  { field: 'salary', label: 'Salary (k)' },
  { field: 'location', label: 'Location' },
];
const CONFIG: DataGridConfig = { columns: COLS };
const DIMS = dimensionsOf(PEOPLE, CONFIG); // { rows: 7, cols: 4 }

/** Fold a key sequence through the movement engine, starting at the origin. */
function walk(keys: KeyInput[], dims = DIMS, pageSize = DEFAULT_PAGE_SIZE): CellPosition {
  return keys.reduce((pos, key) => nextCellPosition(pos, key, dims, pageSize), ORIGIN);
}

describe('Data Grid reference renderer — verified APG Data Grid contract', () => {
  for (const c of dataGridCases) {
    it(`${c.title}: key sequence lands on the expected cell and the grid audits clean`, () => {
      const landed = c.keys.reduce(
        (pos, key) => nextCellPosition(pos, key, dimensionsOf(c.rows, c.config), c.config.pageSize),
        ORIGIN,
      );
      expect(landed, 'movement engine landed elsewhere than the fixture expects').toEqual(c.expected);

      const root = renderDataGrid(c.rows, c.config, landed);
      const result = auditDataGrid(root, c.rows, c.config, landed);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }
});

describe('Data Grid structure & roving tabindex', () => {
  it('grounds in a native <table role="grid"> with role row/columnheader/gridcell', () => {
    const root = renderDataGrid(PEOPLE, CONFIG);
    expect(root.tagName).toBe('TABLE');
    expect(root.getAttribute('role')).toBe('grid');
    expect(root.querySelectorAll('[role="row"]').length).toBe(DIMS.rows); // header + 6 data
    expect(root.querySelectorAll('thead [role="columnheader"]').length).toBe(DIMS.cols);
    expect(root.querySelectorAll('tbody [role="gridcell"]').length).toBe(PEOPLE.length * DIMS.cols);
  });

  it('declares aria-rowcount / aria-colcount over the full extent (header included)', () => {
    const root = renderDataGrid(PEOPLE, CONFIG);
    expect(root.getAttribute('aria-rowcount')).toBe('7');
    expect(root.getAttribute('aria-colcount')).toBe('4');
  });

  it('renders exactly one tabindex="0" cell at the active position; all others -1', () => {
    const active = { row: 2, col: 1 };
    const root = renderDataGrid(PEOPLE, CONFIG, active);
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[role="gridcell"], [role="columnheader"]'));
    const focusable = cells.filter((c) => c.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0].getAttribute('data-row')).toBe('2');
    expect(focusable[0].getAttribute('data-col')).toBe('1');
    expect(cells.filter((c) => c.getAttribute('tabindex') === '-1')).toHaveLength(cells.length - 1);
  });

  it('setActiveCell moves the roving tabindex in place and returns the now-focusable cell', () => {
    const root = renderDataGrid(PEOPLE, CONFIG); // active at origin
    const moved = setActiveCell(root, { row: 3, col: 2 });
    expect(moved).not.toBeNull();
    expect(moved!.getAttribute('tabindex')).toBe('0');
    expect(moved!.textContent).toBe(String(PEOPLE[2].salary)); // grid row 3 = data row index 2
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));
    expect(focusable).toHaveLength(1);
    // The origin header is no longer focusable.
    expect(root.querySelector('[data-row="0"][data-col="0"]')!.getAttribute('tabindex')).toBe('-1');
  });

  it('renders a <caption> when the contract supplies one', () => {
    const root = renderDataGrid(PEOPLE, { columns: COLS, caption: 'Staff' });
    expect(root.querySelector('caption')?.textContent).toBe('Staff');
  });

  it('audit fails when the focusable cell is not where it is expected', () => {
    const root = renderDataGrid(PEOPLE, CONFIG, { row: 1, col: 1 });
    const result = auditDataGrid(root, PEOPLE, CONFIG, { row: 2, col: 2 });
    expect(result.ok).toBe(false);
  });
});

describe('APG Data Grid movement engine (nextCellPosition)', () => {
  it('arrow keys move one cell along each axis (orientation both)', () => {
    expect(nextCellPosition({ row: 2, col: 2 }, { key: 'ArrowUp' }, DIMS)).toEqual({ row: 1, col: 2 });
    expect(nextCellPosition({ row: 2, col: 2 }, { key: 'ArrowDown' }, DIMS)).toEqual({ row: 3, col: 2 });
    expect(nextCellPosition({ row: 2, col: 2 }, { key: 'ArrowLeft' }, DIMS)).toEqual({ row: 2, col: 1 });
    expect(nextCellPosition({ row: 2, col: 2 }, { key: 'ArrowRight' }, DIMS)).toEqual({ row: 2, col: 3 });
  });

  it('clamps at every edge rather than wrapping', () => {
    expect(nextCellPosition(ORIGIN, { key: 'ArrowUp' }, DIMS)).toEqual(ORIGIN);
    expect(nextCellPosition(ORIGIN, { key: 'ArrowLeft' }, DIMS)).toEqual(ORIGIN);
    const corner = { row: DIMS.rows - 1, col: DIMS.cols - 1 };
    expect(nextCellPosition(corner, { key: 'ArrowDown' }, DIMS)).toEqual(corner);
    expect(nextCellPosition(corner, { key: 'ArrowRight' }, DIMS)).toEqual(corner);
  });

  it('Home / End jump to the row ends; the row index is unchanged', () => {
    expect(nextCellPosition({ row: 3, col: 2 }, { key: 'Home' }, DIMS)).toEqual({ row: 3, col: 0 });
    expect(nextCellPosition({ row: 3, col: 1 }, { key: 'End' }, DIMS)).toEqual({ row: 3, col: DIMS.cols - 1 });
  });

  it('Ctrl/Meta + Home / End jump to the grid corners', () => {
    expect(nextCellPosition({ row: 4, col: 2 }, { key: 'Home', ctrlKey: true }, DIMS)).toEqual({ row: 0, col: 0 });
    expect(nextCellPosition({ row: 4, col: 2 }, { key: 'End', ctrlKey: true }, DIMS)).toEqual({ row: DIMS.rows - 1, col: DIMS.cols - 1 });
    // metaKey (mac) is treated the same as ctrlKey.
    expect(nextCellPosition({ row: 4, col: 2 }, { key: 'End', metaKey: true }, DIMS)).toEqual({ row: DIMS.rows - 1, col: DIMS.cols - 1 });
  });

  it('PageDown / PageUp move by pageSize rows and clamp', () => {
    expect(nextCellPosition(ORIGIN, { key: 'PageDown' }, DIMS, DEFAULT_PAGE_SIZE)).toEqual({ row: 5, col: 0 });
    expect(nextCellPosition({ row: 5, col: 0 }, { key: 'PageDown' }, DIMS, DEFAULT_PAGE_SIZE)).toEqual({ row: 6, col: 0 });
    expect(nextCellPosition({ row: 6, col: 3 }, { key: 'PageUp' }, DIMS, DEFAULT_PAGE_SIZE)).toEqual({ row: 1, col: 3 });
    expect(nextCellPosition({ row: 1, col: 3 }, { key: 'PageUp' }, DIMS, DEFAULT_PAGE_SIZE)).toEqual({ row: 0, col: 3 });
  });

  it('an unhandled key is a no-op (caller skips it)', () => {
    const pos = { row: 2, col: 2 };
    expect(nextCellPosition(pos, { key: 'a' }, DIMS)).toEqual(pos);
    expect(samePosition(nextCellPosition(pos, { key: 'Enter' }, DIMS), pos)).toBe(true);
  });

  it('walk() folds a sequence the same way the demo handler does', () => {
    expect(walk([{ key: 'ArrowDown' }, { key: 'ArrowRight' }, { key: 'End' }])).toEqual({ row: 1, col: 3 });
  });

  it('samePosition compares coordinates', () => {
    expect(samePosition({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe(true);
    expect(samePosition({ row: 1, col: 1 }, { row: 1, col: 2 })).toBe(false);
  });
});
