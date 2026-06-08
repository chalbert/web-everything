/**
 * Unit tests for DataGridEditBehavior — the production `grid:cell-edit` attribute, the editable
 * sub-pattern layered on the navigation grid.
 *
 * The pure mode engine (`editAction`) and the audit (`auditEditableGrid`) are proven in
 * editable-grid.test.ts. THIS suite proves the *attribute* drives that contract on a real
 * `<table role="grid">` with BOTH behaviors attached (`grid:cell-navigation` + `grid:cell-edit`):
 * Enter/F2 open an editor seeded with the cell value; while editing, arrow keys move the caret and the
 * grid does NOT navigate (the "arrows edit the field, not the grid" invariant); Enter commits, Escape
 * restores; the commit-strategy seam (`grid-cell-edit-commit`) fires and a host can preventDefault to
 * own the write; headers never edit; blur commits. Plus the shared fixtures, replayed end-to-end and
 * audited clean. See /blocks/data-grid/.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DataGridBehavior from '../../../data-grid/DataGridBehavior';
import DataGridEditBehavior from '../../../data-grid/DataGridEditBehavior';
import {
  renderDataGrid,
  ORIGIN,
  type CellPosition,
  type DataGridConfig,
  type Row,
} from '../../../renderers/data-grid/renderDataGrid';
import {
  auditEditableGrid,
  EDITOR_INPUT_CLASS,
  type GridCellEditCommitDetail,
} from '../../../renderers/data-grid/editableGrid';
import { editableCases } from '../../../renderers/data-grid/__fixtures__/editable-grid-cases';

const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120, location: 'Berlin' },
  { name: 'André', team: 'Design', salary: 95, location: 'Lyon' },
  { name: 'Aaron', team: 'Engineering', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', salary: 105, location: 'Paris' },
];
const CONFIG: DataGridConfig = {
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'team', label: 'Team' },
    { field: 'salary', label: 'Salary (k)' },
    { field: 'location', label: 'Location' },
  ],
};

interface Handles {
  root: HTMLTableElement;
  nav: DataGridBehavior;
  edit: DataGridEditBehavior;
}

/** Render a grid at `active`, attach BOTH behaviors, focus the active cell, return the handles. */
function createGrid(active: CellPosition = ORIGIN, rows: Row[] = PEOPLE, config = CONFIG): Handles {
  document.body.innerHTML = '';
  const root = renderDataGrid(rows, config, active);
  root.setAttribute('grid:cell-navigation', '');
  root.setAttribute('grid:cell-edit', '');
  document.body.appendChild(root);

  const nav = new DataGridBehavior({ name: 'grid:cell-navigation' });
  nav.attach(root);
  nav.isConnected = true;
  nav.connectedCallback();

  const edit = new DataGridEditBehavior({ name: 'grid:cell-edit' });
  edit.attach(root);
  edit.isConnected = true;
  edit.connectedCallback();

  cellAt(root, active)?.focus();
  return { root, nav, edit };
}

function cellAt(root: HTMLElement, pos: CellPosition): HTMLElement | null {
  return root.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
}

function editor(root: HTMLElement): (HTMLInputElement & HTMLSelectElement) | null {
  return root.querySelector(`.${EDITOR_INPUT_CLASS}`);
}

/** Dispatch a keydown on whatever is focused (cell or editor), bubbling — like a real keystroke. */
function press(key: string): void {
  const target = (document.activeElement as HTMLElement) ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** Simulate typing into the open editor. */
function type(value: string): void {
  (document.activeElement as HTMLInputElement).value = value;
}

describe('DataGridEditBehavior', () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView; the nav behavior calls it on each move.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('entering edit mode', () => {
    it('Enter on a focused data cell opens an editor seeded + selected with the cell value', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      press('Enter');
      expect(edit.editing).toBe(true);
      expect(edit.editingAt).toEqual({ row: 1, col: 0 });
      const input = editor(root)!;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Bianca');
      expect(document.activeElement).toBe(input);
    });

    it('F2 also opens the editor', () => {
      const { root, edit } = createGrid({ row: 1, col: 1 });
      press('F2');
      expect(edit.editing).toBe(true);
      expect(editor(root)!.value).toBe('Engineering');
    });

    it('a column header never enters edit mode', () => {
      const { root, edit } = createGrid({ row: 0, col: 0 });
      press('Enter');
      press('F2');
      expect(edit.editing).toBe(false);
      expect(editor(root)).toBeNull();
    });

    it('an aria-readonly cell does not enter edit mode', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      cellAt(root, { row: 1, col: 0 })!.setAttribute('aria-readonly', 'true');
      press('Enter');
      press('F2');
      expect(edit.editing).toBe(false);
      expect(editor(root)).toBeNull();
    });

    it('a grid-level aria-readonly="true" makes every cell read-only by default', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      root.setAttribute('aria-readonly', 'true');
      press('Enter');
      expect(edit.editing).toBe(false);
    });

    it('a cell aria-readonly="false" overrides a read-only grid (explicit editable)', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      root.setAttribute('aria-readonly', 'true');
      cellAt(root, { row: 1, col: 0 })!.setAttribute('aria-readonly', 'false');
      press('Enter');
      expect(edit.editing).toBe(true);
    });

    it('emits grid-cell-edit-start with the position + current value', () => {
      const { root } = createGrid({ row: 2, col: 3 });
      const starts: unknown[] = [];
      root.addEventListener('grid-cell-edit-start', (e) => starts.push((e as CustomEvent).detail));
      press('Enter');
      expect(starts).toEqual([{ position: { row: 2, col: 3 }, value: 'Lyon' }]);
    });
  });

  describe('the "arrows edit the field, not the grid" invariant', () => {
    it('while editing, arrow keys do NOT move the navigation focus and stay in edit mode', () => {
      const { root, nav, edit } = createGrid({ row: 1, col: 0 });
      press('Enter');
      const input = editor(root)!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(edit.editing).toBe(true);
      expect(nav.active).toEqual({ row: 1, col: 0 }); // grid did not navigate
    });

    it('the editor stops keydown propagation so the nav behavior never sees the key', () => {
      const { root } = createGrid({ row: 1, col: 0 });
      press('Enter');
      const onGrid = vi.fn();
      root.addEventListener('keydown', onGrid); // a grid-level listener like the nav behavior's
      editor(root)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(onGrid).not.toHaveBeenCalled();
    });
  });

  describe('committing', () => {
    it('Enter commits the new value in-place and returns focus to the cell', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      press('Enter');
      type('Beatriz');
      press('Enter');
      expect(edit.editing).toBe(false);
      const cell = cellAt(root, { row: 1, col: 0 })!;
      expect(cell.textContent).toBe('Beatriz');
      expect(editor(root)).toBeNull();
      expect(document.activeElement).toBe(cell);
    });

    it('emits cancelable grid-cell-edit-commit with { position, value, previousValue }', () => {
      const { root } = createGrid({ row: 1, col: 0 });
      const commits: GridCellEditCommitDetail[] = [];
      root.addEventListener('grid-cell-edit-commit', (e) =>
        commits.push((e as CustomEvent<GridCellEditCommitDetail>).detail),
      );
      press('Enter');
      type('Beatriz');
      press('Enter');
      expect(commits).toHaveLength(1);
      expect(commits[0]).toMatchObject({ position: { row: 1, col: 0 }, value: 'Beatriz', previousValue: 'Bianca' });
      expect(typeof commits[0].reject).toBe('function');
    });

    it('a host preventDefault on commit owns the write — the cell restores the previous (pending) value', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      root.addEventListener('grid-cell-edit-commit', (e) => e.preventDefault());
      press('Enter');
      type('Beatriz');
      press('Enter');
      expect(edit.editing).toBe(false);
      // Host took over the write; the editor tore down restoring the previous value as the pending state.
      expect(cellAt(root, { row: 1, col: 0 })!.textContent).toBe('Bianca');
    });

    it('blur commits the value (clicking away)', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      press('Enter');
      type('Beatriz');
      editor(root)!.dispatchEvent(new FocusEvent('blur'));
      expect(edit.editing).toBe(false);
      expect(cellAt(root, { row: 1, col: 0 })!.textContent).toBe('Beatriz');
    });
  });

  describe('cancelling', () => {
    it('Escape restores the previous value and returns focus to the cell', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      press('Enter');
      type('Beatriz');
      press('Escape');
      expect(edit.editing).toBe(false);
      const cell = cellAt(root, { row: 1, col: 0 })!;
      expect(cell.textContent).toBe('Bianca');
      expect(document.activeElement).toBe(cell);
    });

    it('emits grid-cell-edit-cancel with the restored value, and no commit fires', () => {
      const { root } = createGrid({ row: 1, col: 0 });
      const cancels: unknown[] = [];
      const commits: unknown[] = [];
      root.addEventListener('grid-cell-edit-cancel', (e) => cancels.push((e as CustomEvent).detail));
      root.addEventListener('grid-cell-edit-commit', (e) => commits.push((e as CustomEvent).detail));
      press('Enter');
      type('Beatriz');
      press('Escape');
      expect(cancels).toEqual([{ position: { row: 1, col: 0 }, value: 'Bianca' }]);
      expect(commits).toEqual([]);
    });
  });

  describe('typed editors + validation (#158)', () => {
    it('data-editor="number" opens a native number input', () => {
      const { root } = createGrid({ row: 1, col: 2 });
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor', 'number');
      press('Enter');
      const ed = editor(root)!;
      expect(ed.tagName).toBe('INPUT');
      expect(ed.type).toBe('number');
    });

    it('data-editor="select" opens a <select> of the declared options, current value selected', () => {
      const { root } = createGrid({ row: 1, col: 1 });
      const cell = cellAt(root, { row: 1, col: 1 })!;
      cell.setAttribute('data-editor', 'select');
      cell.setAttribute('data-editor-options', 'Engineering,Design,Sales');
      press('Enter');
      const ed = editor(root)!;
      expect(ed.tagName).toBe('SELECT');
      expect(ed.value).toBe('Engineering');
      expect(Array.from(ed.options).map((o) => o.value)).toEqual(['Engineering', 'Design', 'Sales']);
    });

    it('an unknown data-editor falls back to a text input', () => {
      const { root } = createGrid({ row: 1, col: 0 });
      cellAt(root, { row: 1, col: 0 })!.setAttribute('data-editor', 'bogus');
      press('Enter');
      expect(editor(root)!.type).toBe('text');
    });

    it('a required editor rejects an empty value on Enter — stays open + aria-invalid, no commit', () => {
      const { root, edit } = createGrid({ row: 1, col: 2 });
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor', 'number');
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor-required', '');
      const commits: unknown[] = [];
      const invalids: unknown[] = [];
      root.addEventListener('grid-cell-edit-commit', (e) => commits.push((e as CustomEvent).detail));
      root.addEventListener('grid-cell-edit-invalid', (e) => invalids.push((e as CustomEvent).detail));
      press('Enter');
      editor(root)!.value = '';
      press('Enter');
      expect(edit.editing).toBe(true); // still editing
      expect(editor(root)!.getAttribute('aria-invalid')).toBe('true');
      expect(commits).toEqual([]); // never committed
      expect(invalids).toHaveLength(1);
    });

    it('a host reject() on commit keeps the editor open (distinct from preventDefault)', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      root.addEventListener('grid-cell-edit-commit', (e) => {
        (e as CustomEvent<{ reject: (m?: string) => void }>).detail.reject('nope');
      });
      press('Enter');
      type('whatever');
      press('Enter');
      expect(edit.editing).toBe(true);
      expect(cellAt(root, { row: 1, col: 0 })!.querySelector('.grid-cell-input')).not.toBeNull();
    });

    it('typing clears a prior aria-invalid mark, then a valid Enter commits', () => {
      const { root, edit } = createGrid({ row: 1, col: 2 });
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor', 'number');
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor-required', '');
      press('Enter');
      editor(root)!.value = '';
      press('Enter'); // rejected → aria-invalid
      expect(editor(root)!.getAttribute('aria-invalid')).toBe('true');
      editor(root)!.value = '130';
      editor(root)!.dispatchEvent(new Event('input', { bubbles: true })); // clears the mark
      press('Enter'); // now valid → commits
      expect(edit.editing).toBe(false);
      expect(cellAt(root, { row: 1, col: 2 })!.textContent).toBe('130');
    });

    it('blur with an invalid value cancels (restores previous) rather than trapping focus', () => {
      const { root, edit } = createGrid({ row: 1, col: 2 });
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor', 'number');
      cellAt(root, { row: 1, col: 2 })!.setAttribute('data-editor-required', '');
      press('Enter');
      editor(root)!.value = '';
      editor(root)!.dispatchEvent(new FocusEvent('blur'));
      expect(edit.editing).toBe(false);
      expect(cellAt(root, { row: 1, col: 2 })!.textContent).toBe('120'); // restored
    });
  });

  describe('teardown', () => {
    it('stops opening editors after disconnect', () => {
      const { root, edit } = createGrid({ row: 1, col: 0 });
      edit.disconnectedCallback();
      press('Enter');
      expect(edit.editing).toBe(false);
      expect(editor(root)).toBeNull();
    });
  });

  describe('drives the shared fixtures + audits clean', () => {
    for (const c of editableCases) {
      it(`${c.title}`, () => {
        const { root, nav, edit } = createGrid(c.start, c.rows, c.config);
        for (const pos of c.readonly ?? []) {
          cellAt(root, pos)!.setAttribute('aria-readonly', 'true');
        }
        for (const e of c.editors ?? []) {
          const cell = cellAt(root, e.at)!;
          cell.setAttribute('data-editor', e.kind);
          if (e.options) cell.setAttribute('data-editor-options', e.options);
          if (e.required) cell.setAttribute('data-editor-required', '');
        }
        for (const step of c.steps) {
          if ('key' in step) press(step.key);
          else type(step.type);
        }

        expect(edit.editing, 'ended in the wrong mode').toBe(c.expectedMode === 'editing');
        expect(nav.active, 'navigation focus moved unexpectedly').toEqual(c.expectedActive);

        if (c.expectedMode === 'editing') {
          expect(editor(root)!.value).toBe(c.expectedText);
          const result = auditEditableGrid(root, { editingAt: edit.editingAt });
          expect(result.ok, result.checks.filter((x) => !x.pass).map((x) => x.label).join('; ')).toBe(true);
        } else {
          expect(cellAt(root, c.start)!.textContent).toBe(c.expectedText);
          const result = auditEditableGrid(root, { editingAt: null });
          expect(result.ok, result.checks.filter((x) => !x.pass).map((x) => x.label).join('; ')).toBe(true);
        }
      });
    }
  });
});
