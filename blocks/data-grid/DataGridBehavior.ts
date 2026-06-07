/**
 * @file blocks/data-grid/DataGridBehavior.ts
 * @description The production CustomAttribute behavior for the Data Grid block — `grid:cell-navigation`.
 *
 * The reference renderer ([renderDataGrid](../renderers/data-grid/renderDataGrid.ts)) projects a row
 * set onto a native `<table role="grid">` and ships the *pure* movement engine (`nextCellPosition`),
 * the roving-tabindex projector (`setActiveCell`), and the conformance audit (`auditDataGrid`). The
 * conformance demo wired those into a live grid INLINE. This behavior **graduates that inline wiring**
 * into a real attribute, so a plain `<table role="grid" grid:cell-navigation>` becomes keyboard-navigable
 * on its own — the contract holds through the attribute, not just the demo.
 *
 * It is the concrete consumer of the Focus Delegation intent (/intents/focus-delegation/): strategy
 * `roving`, orientation `both`. The keyboard model is read verbatim from the shared engine, so the
 * behavior cannot drift from the renderer the conformance suite asserts against.
 *
 * Usage:
 * ```html
 * <table role="grid" grid:cell-navigation>…</table>      <!-- clamp at edges (default) -->
 * <table role="grid" grid:cell-navigation="wrap">…</table> <!-- last → first on the arrows -->
 * ```
 *
 * Config (read fresh on each move, so a host can toggle it live and a windowed grid can grow/shrink):
 *   - value token `wrap` — opt-in: an arrow at an edge moves to the opposite edge instead of clamping.
 *     Off by default (the reference engine clamps; the behavior layers wrapping on top, per the block
 *     page's "clamp, not wrap is the default" contract).
 *   - `page-size` attribute — rows per PageUp/PageDown; default 5 (matches the engine).
 *
 * Each move scrolls the active cell into view — free for real DOM focus today, but required the moment
 * the grid is windowed/virtualized and the target row may not be realized. It emits `grid-cell-change`
 * (`{ from, to }`) so a host surface (the demo's read-out + live audit) can stay thin.
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import {
  nextCellPosition,
  setActiveCell,
  samePosition,
  DEFAULT_PAGE_SIZE,
  ORIGIN,
  type CellPosition,
  type GridDimensions,
  type KeyInput,
} from '../renderers/data-grid/renderDataGrid';

/** The keys the grid binds — everything else falls through to the page. */
const NAV_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Detail for the `grid-cell-change` event the behavior emits on every committed move. */
export interface GridCellChangeDetail {
  from: CellPosition;
  to: CellPosition;
}

export default class DataGridBehavior extends CustomAttribute {
  /** The active (roving `tabindex="0"`) cell. Seeded on connect; updated on every committed move. */
  #active: CellPosition = ORIGIN;

  /** The current active cell — exposed for hosts/tests. */
  get active(): CellPosition {
    return { ...this.#active };
  }

  /** Whether opt-in wrapping is enabled (read live from the attribute value). */
  get wrap(): boolean {
    const value = this.target?.getAttribute(this.name) ?? '';
    return value.split(/[\s,]+/).includes('wrap');
  }

  /** Rows moved per PageUp/PageDown (read live from `page-size`; default 5). */
  get pageSize(): number {
    const raw = Number(this.target?.getAttribute('page-size'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PAGE_SIZE;
  }

  connectedCallback(): void {
    const grid = this.target;
    if (!grid) return;
    this.#seedActive();
    grid.addEventListener('keydown', this.#onKeydown);
    grid.addEventListener('click', this.#onClick);
  }

  disconnectedCallback(): void {
    this.#teardown();
  }

  detachedCallback(): void {
    this.#teardown();
  }

  #teardown(): void {
    this.target?.removeEventListener('keydown', this.#onKeydown);
    this.target?.removeEventListener('click', this.#onClick);
  }

  // ── Dimensions read from the live DOM ──────────────────────────────────────────────────────────
  // Derived from the rendered structure (not a config object) so the behavior survives windowing:
  // rows = every role="row" (header + data), cols = the column-header cells. Matches `dimensionsOf`.

  #dimensions(): GridDimensions {
    const grid = this.target;
    if (!grid) return { rows: 0, cols: 0 };
    return {
      rows: grid.querySelectorAll('[role="row"]').length,
      cols: grid.querySelectorAll('[role="columnheader"]').length,
    };
  }

  // ── Seed the roving tabindex ───────────────────────────────────────────────────────────────────

  #seedActive(): void {
    const grid = this.target;
    if (!grid) return;
    // Honour an existing tabindex="0" cell (the renderer seeds one); else seed the origin.
    const existing = grid.querySelector<HTMLElement>(
      '[role="gridcell"][tabindex="0"], [role="columnheader"][tabindex="0"]',
    );
    this.#active = existing
      ? { row: Number(existing.getAttribute('data-row')), col: Number(existing.getAttribute('data-col')) }
      : { ...ORIGIN };
    setActiveCell(grid, this.#active);
  }

  // ── Keyboard navigation — read the shared engine, layer opt-in wrap, move real focus ────────────

  #onKeydown = (event: KeyboardEvent): void => {
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault(); // arrows/Page would scroll; Home/End would jump the page

    const dims = this.#dimensions();
    const input: KeyInput = { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey };
    let next = nextCellPosition(this.#active, input, dims, this.pageSize);

    // Wrap is a behavior-layer concern over the clamping engine: an arrow that produced no move
    // (clamped at an edge) instead jumps to the opposite edge along that axis.
    if (this.wrap && ARROW_KEYS.has(event.key) && samePosition(next, this.#active)) {
      next = this.#wrapped(event.key, dims);
    }

    this.#moveTo(next, true);
  };

  /** The opposite-edge target for an arrow that clamped, when wrapping is enabled. */
  #wrapped(key: string, dims: GridDimensions): CellPosition {
    const lastRow = dims.rows - 1;
    const lastCol = dims.cols - 1;
    switch (key) {
      case 'ArrowUp':
        return { row: lastRow, col: this.#active.col };
      case 'ArrowDown':
        return { row: 0, col: this.#active.col };
      case 'ArrowLeft':
        return { row: this.#active.row, col: lastCol };
      case 'ArrowRight':
        return { row: this.#active.row, col: 0 };
      default:
        return this.#active;
    }
  }

  // ── Click-to-focus — clicking a cell makes it the active (roving) cell ──────────────────────────

  #onClick = (event: MouseEvent): void => {
    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-row][data-col]');
    if (!cell || !this.target?.contains(cell)) return;
    this.#moveTo(
      { row: Number(cell.getAttribute('data-row')), col: Number(cell.getAttribute('data-col')) },
      true,
    );
  };

  // ── Commit a move: rove the tabindex, focus + scroll into view, announce ───────────────────────

  #moveTo(next: CellPosition, focus: boolean): void {
    const grid = this.target;
    if (!grid || samePosition(next, this.#active)) return; // edge clamp / same cell — nothing to do

    const from = this.#active;
    this.#active = next;
    const cell = setActiveCell(grid, next);
    if (cell && focus) {
      cell.focus();
      // Required once the grid is windowed (the active row may not be realized); harmless otherwise.
      if (typeof cell.scrollIntoView === 'function') {
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    grid.dispatchEvent(
      new CustomEvent<GridCellChangeDetail>('grid-cell-change', {
        bubbles: true,
        detail: { from, to: next },
      }),
    );
  }
}
