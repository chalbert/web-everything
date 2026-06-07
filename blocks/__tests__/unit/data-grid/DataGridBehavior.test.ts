/**
 * Unit tests for DataGridBehavior — the production `grid:cell-navigation` attribute.
 *
 * The reference renderer's pure engine (`nextCellPosition`) and audit (`auditDataGrid`) are proven in
 * data-grid.test.ts. THIS suite proves the *attribute* drives that same contract: attach the behavior
 * to a real `<table role="grid">`, dispatch keystrokes, and assert it roves the tabindex, moves real
 * DOM focus, scrolls the active cell into view, lands where the engine says — and that the grid
 * `auditDataGrid`s clean through the behavior, not just through the renderer. Plus the opt-in `wrap`
 * the behavior layers over the clamping engine, click-to-focus, and the `grid-cell-change` event.
 *
 * See /blocks/data-grid/ and the Focus Delegation intent (/intents/focus-delegation/).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DataGridBehavior, { type GridCellChangeDetail } from '../../../data-grid/DataGridBehavior';
import {
  renderDataGrid,
  auditDataGrid,
  ORIGIN,
  type CellPosition,
  type DataGridConfig,
  type Row,
} from '../../../renderers/data-grid/renderDataGrid';
import { dataGridCases } from '../../../renderers/data-grid/__fixtures__/data-grid-cases';

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
// 6 data rows + header = 7 navigable rows, 4 columns → last cell is (6, 3).

/** Render a grid, attach the behavior (manual upgrade, like the bootstrap), return the handles. */
function createGrid(
  attrValue = '',
  config: DataGridConfig = CONFIG,
  rows: Row[] = PEOPLE,
): { root: HTMLTableElement; behavior: DataGridBehavior } {
  document.body.innerHTML = '';
  const root = renderDataGrid(rows, config, ORIGIN);
  root.setAttribute('grid:cell-navigation', attrValue);
  document.body.appendChild(root);

  const behavior = new DataGridBehavior({ name: 'grid:cell-navigation' });
  behavior.attach(root);
  behavior.isConnected = true;
  behavior.connectedCallback();
  return { root, behavior };
}

/** Dispatch a keydown on the grid (optionally with the ctrl modifier). */
function press(root: HTMLElement, key: string, mod?: 'ctrl' | 'meta'): void {
  root.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: mod === 'ctrl',
      metaKey: mod === 'meta',
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** The cell element at a position. */
function cellAt(root: HTMLElement, pos: CellPosition): HTMLElement | null {
  return root.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
}

describe('DataGridBehavior', () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView; stub it so the guard runs and we can assert calls.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('seeding', () => {
    it('seeds the roving tabindex at the origin (renderer-seeded cell)', () => {
      const { root, behavior } = createGrid();
      expect(behavior.active).toEqual(ORIGIN);
      const focusable = root.querySelectorAll('[tabindex="0"]');
      expect(focusable).toHaveLength(1);
      expect(focusable[0]).toBe(cellAt(root, ORIGIN));
    });

    it('honours an existing tabindex="0" cell when seeding', () => {
      document.body.innerHTML = '';
      const root = renderDataGrid(PEOPLE, CONFIG, { row: 2, col: 1 });
      root.setAttribute('grid:cell-navigation', '');
      document.body.appendChild(root);
      const behavior = new DataGridBehavior({ name: 'grid:cell-navigation' });
      behavior.attach(root);
      behavior.connectedCallback();
      expect(behavior.active).toEqual({ row: 2, col: 1 });
    });
  });

  describe('keyboard navigation moves real focus + the roving tabindex', () => {
    it('ArrowDown steps into the first data row and moves DOM focus', () => {
      const { root, behavior } = createGrid();
      press(root, 'ArrowDown');
      expect(behavior.active).toEqual({ row: 1, col: 0 });
      const cell = cellAt(root, { row: 1, col: 0 });
      expect(cell?.getAttribute('tabindex')).toBe('0');
      expect(document.activeElement).toBe(cell);
      expect(cellAt(root, ORIGIN)?.getAttribute('tabindex')).toBe('-1');
    });

    it('binds both axes (orientation both): Right then Down', () => {
      const { root, behavior } = createGrid();
      press(root, 'ArrowRight');
      press(root, 'ArrowDown');
      expect(behavior.active).toEqual({ row: 1, col: 1 });
    });

    it('Home / End jump to the row ends', () => {
      const { root, behavior } = createGrid();
      press(root, 'ArrowDown');
      press(root, 'End');
      expect(behavior.active).toEqual({ row: 1, col: 3 });
      press(root, 'Home');
      expect(behavior.active).toEqual({ row: 1, col: 0 });
    });

    it('Ctrl+End / Ctrl+Home jump to the grid corners (meta too)', () => {
      const { root, behavior } = createGrid();
      press(root, 'End', 'ctrl');
      expect(behavior.active).toEqual({ row: 6, col: 3 });
      press(root, 'Home', 'ctrl');
      expect(behavior.active).toEqual(ORIGIN);
      press(root, 'End', 'meta');
      expect(behavior.active).toEqual({ row: 6, col: 3 });
    });

    it('PageDown / PageUp move by a page and clamp', () => {
      const { root, behavior } = createGrid();
      press(root, 'PageDown');
      expect(behavior.active).toEqual({ row: 5, col: 0 });
      press(root, 'PageDown'); // clamps at the last row
      expect(behavior.active).toEqual({ row: 6, col: 0 });
    });

    it('reads page-size from the attribute', () => {
      const { root, behavior } = createGrid();
      root.setAttribute('page-size', '2');
      press(root, 'PageDown');
      expect(behavior.active).toEqual({ row: 2, col: 0 });
    });

    it('ignores non-navigation keys and calls preventDefault on handled ones', () => {
      const { root, behavior } = createGrid();
      press(root, 'a');
      expect(behavior.active).toEqual(ORIGIN);
      const evt = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      root.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
    });

    it('scrolls the active cell into view on each move', () => {
      const { root } = createGrid();
      press(root, 'ArrowDown');
      const cell = cellAt(root, { row: 1, col: 0 });
      expect(cell!.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    });
  });

  describe('clamp by default, wrap on opt-in', () => {
    it('clamps at the edges by default (no move, no event)', () => {
      const { root, behavior } = createGrid();
      const onChange = vi.fn();
      root.addEventListener('grid-cell-change', onChange);
      press(root, 'ArrowUp'); // already at top
      press(root, 'ArrowLeft'); // already at left
      expect(behavior.active).toEqual(ORIGIN);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('wraps last → first along each axis when grid:cell-navigation="wrap"', () => {
      const { root, behavior } = createGrid('wrap');
      press(root, 'ArrowUp'); // origin row → last row
      expect(behavior.active).toEqual({ row: 6, col: 0 });
      press(root, 'ArrowDown'); // last row → first row (0)
      expect(behavior.active).toEqual({ row: 0, col: 0 });
      press(root, 'ArrowLeft'); // origin col → last col
      expect(behavior.active).toEqual({ row: 0, col: 3 });
      press(root, 'ArrowRight'); // last col → first col
      expect(behavior.active).toEqual({ row: 0, col: 0 });
    });

    it('wrap is read live — toggling the attribute changes behavior without re-attach', () => {
      const { root, behavior } = createGrid('');
      expect(behavior.wrap).toBe(false);
      press(root, 'ArrowUp');
      expect(behavior.active).toEqual(ORIGIN); // clamped
      root.setAttribute('grid:cell-navigation', 'wrap');
      expect(behavior.wrap).toBe(true);
      press(root, 'ArrowUp');
      expect(behavior.active).toEqual({ row: 6, col: 0 }); // now wraps
    });
  });

  describe('click-to-focus', () => {
    it('clicking a cell makes it the active (roving) cell', () => {
      const { root, behavior } = createGrid();
      const target = cellAt(root, { row: 3, col: 2 })!;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(behavior.active).toEqual({ row: 3, col: 2 });
      expect(target.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('grid-cell-change event', () => {
    it('emits { from, to } on every committed move', () => {
      const { root } = createGrid();
      const details: GridCellChangeDetail[] = [];
      root.addEventListener('grid-cell-change', (e) =>
        details.push((e as CustomEvent<GridCellChangeDetail>).detail),
      );
      press(root, 'ArrowDown');
      press(root, 'ArrowRight');
      expect(details).toEqual([
        { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
        { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } },
      ]);
    });
  });

  describe('drives the SAME auditDataGrid green that the reference renderer does', () => {
    for (const c of dataGridCases) {
      it(`${c.title}: behavior lands on the expected cell and the grid audits clean`, () => {
        document.body.innerHTML = '';
        const root = renderDataGrid(c.rows, c.config, ORIGIN);
        root.setAttribute('grid:cell-navigation', '');
        document.body.appendChild(root);
        const behavior = new DataGridBehavior({ name: 'grid:cell-navigation' });
        behavior.attach(root);
        behavior.connectedCallback();

        for (const k of c.keys) {
          press(root, k.key, k.ctrlKey ? 'ctrl' : k.metaKey ? 'meta' : undefined);
        }

        expect(behavior.active, 'behavior landed elsewhere than the fixture expects').toEqual(c.expected);
        const result = auditDataGrid(root, c.rows, c.config, behavior.active);
        const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
        expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
        expect(result.ok).toBe(true);
      });
    }
  });

  describe('teardown', () => {
    it('stops handling keys after disconnect', () => {
      const { root, behavior } = createGrid();
      behavior.disconnectedCallback();
      press(root, 'ArrowDown');
      expect(behavior.active).toEqual(ORIGIN);
    });
  });
});
