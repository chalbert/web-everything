/**
 * Unit tests for the editable Data Grid mode model — the pure `editAction` engine and the
 * `auditEditableGrid` conformance audit (the editing twin of data-grid.test.ts for navigation).
 *
 * These prove the contract in isolation, DOM-free where possible: Enter/F2 enter edit only on a data
 * cell, Enter commits, Escape cancels, a column header never edits; and the audit goes green only when
 * the editor is the single input inside the expected data cell (red on an orphaned editor, an editor on
 * a header, or an editor on the wrong cell). The behavior (DataGridEditBehavior) is proven to DRIVE this
 * same contract in DataGridEditBehavior.test.ts. See /blocks/data-grid/.
 */
import { describe, it, expect } from 'vitest';
import {
  editAction,
  auditEditableGrid,
  cellIsReadonly,
  resolveEditorKind,
  editorMatchesKind,
  EDIT_ENTER_KEYS,
  EDITOR_INPUT_CLASS,
} from '../../../renderers/data-grid/editableGrid';
import { renderDataGrid, type DataGridConfig, type Row } from '../../../renderers/data-grid/renderDataGrid';

const ROWS: Row[] = [
  { name: 'Bianca', team: 'Engineering' },
  { name: 'André', team: 'Design' },
];
const CONFIG: DataGridConfig = { columns: [{ field: 'name', label: 'Name' }, { field: 'team', label: 'Team' }] };

describe('editAction — the pure editable-grid mode engine', () => {
  describe('navigating', () => {
    it('Enter / F2 on a data cell enter edit mode', () => {
      expect(editAction('navigating', 'Enter', 'gridcell')).toBe('enter');
      expect(editAction('navigating', 'F2', 'gridcell')).toBe('enter');
    });

    it('a column header never enters edit mode', () => {
      expect(editAction('navigating', 'Enter', 'columnheader')).toBe('none');
      expect(editAction('navigating', 'F2', 'columnheader')).toBe('none');
    });

    it('a read-only data cell never enters edit mode (#159)', () => {
      expect(editAction('navigating', 'Enter', 'gridcell', true)).toBe('none');
      expect(editAction('navigating', 'F2', 'gridcell', true)).toBe('none');
      // readonly defaults false → an unmarked cell still edits
      expect(editAction('navigating', 'Enter', 'gridcell')).toBe('enter');
    });

    it('every other key is a no-op while navigating', () => {
      for (const key of ['ArrowDown', 'a', 'Escape', 'Tab', 'Home']) {
        expect(editAction('navigating', key, 'gridcell')).toBe('none');
      }
    });

    it('EDIT_ENTER_KEYS is exactly Enter + F2', () => {
      expect([...EDIT_ENTER_KEYS].sort()).toEqual(['Enter', 'F2']);
    });
  });

  describe('editing', () => {
    it('Enter commits, Escape cancels', () => {
      expect(editAction('editing', 'Enter', 'gridcell')).toBe('commit');
      expect(editAction('editing', 'Escape', 'gridcell')).toBe('cancel');
    });

    it('arrow keys are no-ops (they reach the field as caret moves, not mode changes)', () => {
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'x']) {
        expect(editAction('editing', key, 'gridcell')).toBe('none');
      }
    });

    it('F2 does not re-trigger while already editing', () => {
      expect(editAction('editing', 'F2', 'gridcell')).toBe('none');
    });
  });
});

describe('cellIsReadonly — the editability declaration (#159)', () => {
  function cellInGrid(gridReadonly?: string, cellReadonly?: string): { cell: HTMLElement; grid: HTMLElement } {
    const grid = renderDataGrid(ROWS, CONFIG, { row: 0, col: 0 });
    if (gridReadonly != null) grid.setAttribute('aria-readonly', gridReadonly);
    const cell = grid.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')!;
    if (cellReadonly != null) cell.setAttribute('aria-readonly', cellReadonly);
    return { cell, grid };
  }

  it('a plain cell is editable (not read-only)', () => {
    const { cell, grid } = cellInGrid();
    expect(cellIsReadonly(cell, grid)).toBe(false);
  });

  it('a cell aria-readonly="true" is read-only', () => {
    const { cell, grid } = cellInGrid(undefined, 'true');
    expect(cellIsReadonly(cell, grid)).toBe(true);
  });

  it('inherits a grid-level aria-readonly="true"', () => {
    const { cell, grid } = cellInGrid('true');
    expect(cellIsReadonly(cell, grid)).toBe(true);
  });

  it('a cell aria-readonly="false" overrides a read-only grid', () => {
    const { cell, grid } = cellInGrid('true', 'false');
    expect(cellIsReadonly(cell, grid)).toBe(false);
  });
});

describe('typed editor kinds (#158)', () => {
  it('resolveEditorKind normalizes known kinds and falls back to text', () => {
    expect(resolveEditorKind('number')).toBe('number');
    expect(resolveEditorKind('date')).toBe('date');
    expect(resolveEditorKind('select')).toBe('select');
    expect(resolveEditorKind('text')).toBe('text');
    expect(resolveEditorKind('bogus')).toBe('text');
    expect(resolveEditorKind(null)).toBe('text');
  });

  it('editorMatchesKind checks tag/type against the declared kind', () => {
    const number = document.createElement('input');
    number.type = 'number';
    const text = document.createElement('input');
    const select = document.createElement('select');
    expect(editorMatchesKind(number, 'number')).toBe(true);
    expect(editorMatchesKind(number, 'text')).toBe(false);
    expect(editorMatchesKind(text, 'text')).toBe(true);
    expect(editorMatchesKind(select, 'select')).toBe(true);
    expect(editorMatchesKind(select, 'number')).toBe(false);
    expect(editorMatchesKind(null, 'text')).toBe(false);
  });
});

describe('auditEditableGrid — the editable mode contract', () => {
  function grid(): HTMLTableElement {
    return renderDataGrid(ROWS, CONFIG, { row: 0, col: 0 });
  }
  function putEditor(root: HTMLElement, selector: string): HTMLInputElement {
    const cell = root.querySelector<HTMLElement>(selector)!;
    cell.textContent = '';
    const input = document.createElement('input');
    input.className = EDITOR_INPUT_CLASS;
    cell.append(input);
    return input;
  }

  it('navigating: passes when no editor is present, fails when one is orphaned', () => {
    const root = grid();
    expect(auditEditableGrid(root, { editingAt: null }).ok).toBe(true);

    putEditor(root, '[data-row="1"][data-col="0"]');
    expect(auditEditableGrid(root, { editingAt: null }).ok).toBe(false);
  });

  it('editing: passes when the single editor is inside the expected data cell', () => {
    const root = grid();
    putEditor(root, '[data-row="1"][data-col="0"]');
    expect(auditEditableGrid(root, { editingAt: { row: 1, col: 0 } }).ok).toBe(true);
  });

  it('editing: fails when the editor is on a different cell than expected', () => {
    const root = grid();
    putEditor(root, '[data-row="1"][data-col="0"]');
    expect(auditEditableGrid(root, { editingAt: { row: 2, col: 1 } }).ok).toBe(false);
  });

  it('fails when a column header carries an editor', () => {
    const root = grid();
    putEditor(root, 'thead [data-row="0"][data-col="0"]');
    const result = auditEditableGrid(root, { editingAt: { row: 0, col: 0 } });
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.label.includes('no column header is editable'))?.pass).toBe(false);
  });

  it('editing: fails when the editor sits inside an aria-readonly cell (#159)', () => {
    const root = grid();
    const cell = root.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')!;
    cell.setAttribute('aria-readonly', 'true');
    putEditor(root, '[data-row="1"][data-col="0"]');
    const result = auditEditableGrid(root, { editingAt: { row: 1, col: 0 } });
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.label.includes('not aria-readonly'))?.pass).toBe(false);
  });

  it('editing: fails when the editor does not match the cell\'s declared kind (#158)', () => {
    const root = grid();
    const cell = root.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')!;
    cell.setAttribute('data-editor', 'number'); // declares number…
    putEditor(root, '[data-row="1"][data-col="0"]'); // …but a plain text input is present
    const result = auditEditableGrid(root, { editingAt: { row: 1, col: 0 } });
    expect(result.ok).toBe(false);
    expect(result.checks.find((c) => c.label.includes('declared kind'))?.pass).toBe(false);
  });

  it('editing: fails when two editors are present', () => {
    const root = grid();
    putEditor(root, '[data-row="1"][data-col="0"]');
    putEditor(root, '[data-row="2"][data-col="1"]');
    expect(auditEditableGrid(root, { editingAt: { row: 1, col: 0 } }).ok).toBe(false);
  });
});
