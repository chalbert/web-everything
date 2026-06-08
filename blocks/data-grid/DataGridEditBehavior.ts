/**
 * @file blocks/data-grid/DataGridEditBehavior.ts
 * @description The production CustomAttribute behavior for the Data Grid block's **editable** sub-pattern —
 * `grid:cell-edit`. It layers cell editing onto the SAME navigation grid that `grid:cell-navigation`
 * ([DataGridBehavior](./DataGridBehavior.ts)) drives, so a plain
 * `<table role="grid" grid:cell-navigation grid:cell-edit>` becomes both navigable and editable while
 * the two behaviors stay decoupled — this one never touches the roving tabindex or the movement engine.
 *
 * It is the runtime twin of the mode model in
 * [editableGrid](../renderers/data-grid/editableGrid.ts): it reads the pure `editAction` engine to
 * decide every transition, so the behavior cannot drift from the contract the conformance suite asserts.
 *
 * The keyboard model (APG editable Data Grid):
 *   - **Enter / F2** on a focused data cell put it into edit mode — a text `<input>` inside the gridcell,
 *     focused and selected.
 *   - While editing, **arrow keys move the caret within the field, not between cells** — the grid's
 *     navigation is suspended. The mechanism: the editor's own keydown listener `stopPropagation()`s, so
 *     the nav behavior's grid-level keydown listener never sees the key. Caret movement is the input's
 *     default action, unaffected by stopPropagation — no coupling between the two behaviors.
 *   - **Escape** cancels and restores the prior value; **Enter** commits and returns focus to the cell.
 *   - Blur (focus leaves the editor — e.g. clicking another cell) commits, the realistic default.
 *
 * The **commit strategy** is a named seam, not this block's concern: commit emits a *cancelable*
 * `grid-cell-edit-commit` (`{ position, value, previousValue }`). The reference default writes the value
 * in-place; a host `preventDefault()`s to own the write (optimistic / server) — the editor then restores
 * the previous value as the pending state until the host updates the cell. It also emits
 * `grid-cell-edit-start` and `grid-cell-edit-cancel` so a host surface can stay thin.
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import type { CellPosition } from '../renderers/data-grid/renderDataGrid';
import {
  editAction,
  cellIsReadonly,
  resolveEditorKind,
  EDITOR_INPUT_CLASS,
  EDITOR_KIND_ATTR,
  EDITOR_OPTIONS_ATTR,
  type GridCellEditCommitDetail,
  type GridCellEditDetail,
  type GridCellEditInvalidDetail,
} from '../renderers/data-grid/editableGrid';

/** An editor element — a typed `<input>` or a `<select>` (#158); both expose `.value`. */
type EditorElement = HTMLInputElement | HTMLSelectElement;

/** The live editing session — held only while a cell is in edit mode, null otherwise. */
interface EditSession {
  cell: HTMLElement;
  editor: EditorElement;
  position: CellPosition;
  previousValue: string;
}

export default class DataGridEditBehavior extends CustomAttribute {
  /** The active editing session, or null while navigating. */
  #session: EditSession | null = null;

  /** Whether a cell is currently in edit mode — exposed for hosts/tests. */
  get editing(): boolean {
    return this.#session !== null;
  }

  /** The cell currently in edit mode, or null while navigating — exposed for hosts/tests. */
  get editingAt(): CellPosition | null {
    return this.#session ? { ...this.#session.position } : null;
  }

  connectedCallback(): void {
    this.target?.addEventListener('keydown', this.#onGridKeydown);
  }

  disconnectedCallback(): void {
    this.#teardown();
  }

  detachedCallback(): void {
    this.#teardown();
  }

  #teardown(): void {
    this.target?.removeEventListener('keydown', this.#onGridKeydown);
    if (this.#session) this.#destroyEditor();
  }

  // ── Enter edit mode — Enter / F2 on a focused data cell (grid-level keydown) ─────────────────────

  #onGridKeydown = (event: KeyboardEvent): void => {
    if (this.#session) return; // editing is driven by the editor's own listener, not the grid's
    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-row][data-col]');
    if (!cell || !this.target?.contains(cell)) return;
    const role = cell.getAttribute('role') ?? '';
    const readonly = cellIsReadonly(cell, this.target ?? null);
    if (editAction('navigating', event.key, role, readonly) !== 'enter') return;

    event.preventDefault();
    event.stopPropagation(); // keep the trigger key out of the nav behavior (which ignores it anyway)
    this.#enterEdit(cell);
  };

  #enterEdit(cell: HTMLElement): void {
    const position: CellPosition = {
      row: Number(cell.getAttribute('data-row')),
      col: Number(cell.getAttribute('data-col')),
    };
    const previousValue = cell.textContent ?? '';

    const editor = this.#createEditor(cell, previousValue);
    editor.setAttribute('aria-label', `Edit ${previousValue}`);
    editor.addEventListener('keydown', this.#onEditorKeydown);
    editor.addEventListener('blur', this.#onEditorBlur);
    editor.addEventListener('input', this.#onEditorInput);

    cell.textContent = '';
    cell.append(editor);
    this.#session = { cell, editor, position, previousValue };

    editor.focus();
    if (editor instanceof HTMLInputElement) editor.select();

    this.#emit('grid-cell-edit-start', { position, value: previousValue } satisfies GridCellEditDetail);
  }

  /**
   * Build the editor for a cell's declared kind (#158): `data-editor` chooses text (default) / number /
   * date / select. A `select` reads its options from `data-editor-options` (comma-separated); typed
   * inputs pass through native validation attributes (`required`, `min`, `max`) so commit can reject.
   */
  #createEditor(cell: HTMLElement, value: string): EditorElement {
    const kind = resolveEditorKind(cell.getAttribute(EDITOR_KIND_ATTR));

    if (kind === 'select') {
      const select = document.createElement('select');
      select.className = EDITOR_INPUT_CLASS;
      const options = (cell.getAttribute(EDITOR_OPTIONS_ATTR) ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      // Keep the current value selectable even if it is not among the declared options.
      if (value && !options.includes(value)) options.unshift(value);
      for (const o of options) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (o === value) opt.selected = true;
        select.append(opt);
      }
      return select;
    }

    const input = document.createElement('input');
    input.className = EDITOR_INPUT_CLASS;
    input.type = kind === 'text' ? 'text' : kind; // number → "number", date → "date" (native validity)
    input.value = value;
    if (cell.hasAttribute('data-editor-required')) input.required = true;
    const min = cell.getAttribute('data-editor-min');
    if (min != null) input.min = min;
    const max = cell.getAttribute('data-editor-max');
    if (max != null) input.max = max;
    return input;
  }

  // ── Editing — the editor's own keydown suspends grid navigation; Enter commits, Escape cancels ───

  #onEditorKeydown = (event: KeyboardEvent): void => {
    // Suspend the grid's navigation for EVERY key while editing: the nav behavior's grid-level keydown
    // listener never sees these, so arrows move the caret (the input's default action) not the focus.
    event.stopPropagation();

    const action = editAction('editing', event.key, ''); // role is irrelevant once editing
    if (action === 'commit') {
      event.preventDefault();
      this.#commit(true); // Enter on an invalid value keeps the editor open
    } else if (action === 'cancel') {
      event.preventDefault();
      this.#cancel();
    }
    // action === 'none' — leave the key to the field (caret movement, typing, select navigation).
  };

  /** Editing clears a prior invalid mark — the value changed, give it another chance on commit. */
  #onEditorInput = (): void => {
    this.#session?.editor.removeAttribute('aria-invalid');
  };

  /** Blur commits — but an invalid value on blur cancels (restore previous) rather than trapping focus. */
  #onEditorBlur = (): void => {
    if (this.#session) this.#commit(false);
  };

  // ── Commit / cancel — validate, then tear the editor down + write + announce ─────────────────────

  /**
   * Attempt to commit the editor's value. Validation gate (#158): a value failing native constraint
   * validation OR rejected by a host (`detail.reject()`) does not commit. `keepOpenIfInvalid` (true for
   * Enter) leaves the editor open and marked `aria-invalid`; false (blur) falls back to cancel so focus
   * is never trapped.
   */
  #commit(keepOpenIfInvalid: boolean): void {
    const session = this.#session;
    if (!session) return;
    const { cell, editor, position, previousValue } = session;
    const value = editor.value;

    const nativeInvalid = typeof editor.checkValidity === 'function' && !editor.checkValidity();
    let rejected = false;
    let rejectMessage = '';

    if (!nativeInvalid) {
      // The commit-strategy seam: a host may preventDefault to own the write (optimistic / server), or
      // reject() to mark the value invalid. The reference default writes in-place.
      const detail: GridCellEditCommitDetail = {
        position,
        value,
        previousValue,
        reject: (message = '') => {
          rejected = true;
          rejectMessage = message;
        },
      };
      const proceed = this.#emit('grid-cell-edit-commit', detail, true);
      if (!rejected) {
        this.#destroyEditor(); // clears #session BEFORE the blur fired by removal can re-enter
        cell.textContent = proceed ? value : previousValue;
        cell.focus();
        return;
      }
    }

    // Invalid — native constraint or host-rejected.
    if (keepOpenIfInvalid) {
      editor.setAttribute('aria-invalid', 'true');
      const message = nativeInvalid ? editor.validationMessage : rejectMessage || 'Invalid value';
      this.#emit('grid-cell-edit-invalid', { position, value, message } satisfies GridCellEditInvalidDetail);
      return; // keep editing
    }
    this.#cancel(); // blur path — don't trap focus on an invalid value
  }

  #cancel(): void {
    const session = this.#session;
    if (!session) return;
    const { cell, position, previousValue } = session;

    this.#destroyEditor();
    cell.textContent = previousValue;
    cell.focus();

    this.#emit('grid-cell-edit-cancel', { position, value: previousValue } satisfies GridCellEditDetail);
  }

  /** Remove the editor and end the session. Detaches listeners first so blur-on-removal can't re-enter. */
  #destroyEditor(): void {
    const session = this.#session;
    if (!session) return;
    this.#session = null;
    session.editor.removeEventListener('keydown', this.#onEditorKeydown);
    session.editor.removeEventListener('blur', this.#onEditorBlur);
    session.editor.removeEventListener('input', this.#onEditorInput);
    session.editor.remove();
  }

  /** Dispatch a bubbling CustomEvent on the grid; returns false when a cancelable event was prevented. */
  #emit(
    type: string,
    detail: GridCellEditDetail | GridCellEditCommitDetail | GridCellEditInvalidDetail,
    cancelable = false,
  ): boolean {
    const grid = this.target;
    if (!grid) return true;
    return grid.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable, detail }));
  }
}
