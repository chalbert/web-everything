/**
 * MasterDetailBehavior — reference runtime for the master-detail intent (#356). Coordinates a
 * collection (the master list) with a coupled detail region: selecting an item renders its detail,
 * manages focus flow and the detail's a11y region, and handles the empty state.
 *
 * It is a COORDINATOR, not a new picker: it **composes the shipping `SelectionBehavior`** block (it does
 * not reimplement selection) and leaves URL deep-linking to the consumer's router (compose, don't
 * duplicate). Pending detail renders toggle a `md-loading` class — the Loader-intent seam.
 */

import { SelectionBehavior } from '../selection/SelectionBehavior';

export type FocusFlow = 'retain' | 'advance';
export type EmptyState = 'placeholder' | 'collapse';

export interface MasterDetailOptions {
  /** CSS selector for the selectable master items, within the master element. */
  itemSelector: string;
  /** The coupled detail region. */
  detailEl: HTMLElement;
  /** Map a selected master item to the key its detail is rendered from. */
  keyOf: (item: HTMLElement) => string | null | undefined;
  /** Render the detail for a key into the region (sync or async). */
  renderDetail: (key: string, detailEl: HTMLElement) => void | Promise<void>;
  /** On select: keep focus on the list (`retain`, default) or move it to the detail (`advance`). */
  focusFlow?: FocusFlow;
  /** With nothing selected: show a placeholder (default) or hide the region. */
  emptyState?: EmptyState;
  /** Class the composed SelectionBehavior toggles on the selected item. */
  selectedClass?: string;
  /** Markup for the placeholder empty state. */
  placeholderHTML?: string;
  /** Accessible label for the detail region. */
  detailLabel?: string;
}

export class MasterDetailBehavior {
  private readonly selection: SelectionBehavior;

  constructor(
    private readonly master: HTMLElement,
    private readonly opts: MasterDetailOptions,
  ) {
    const { detailEl, detailLabel = 'Detail' } = opts;
    detailEl.setAttribute('role', 'region'); // the detail is a labelled region (master-detail a11y)
    if (!detailEl.getAttribute('aria-label')) detailEl.setAttribute('aria-label', detailLabel);
    this.showEmpty();

    // Compose the selection block — single-select over the master items.
    this.selection = new SelectionBehavior(master, {
      itemSelector: opts.itemSelector,
      selectedClass: opts.selectedClass ?? 'selected',
      onChange: (c) => { void this.onSelect(c.last); },
    });
  }

  private showEmpty(): void {
    const { detailEl, emptyState = 'placeholder', placeholderHTML } = this.opts;
    if (emptyState === 'collapse') { detailEl.hidden = true; return; }
    detailEl.hidden = false;
    detailEl.innerHTML = placeholderHTML ?? '<p class="md-empty">Select an item to see details.</p>';
  }

  private async onSelect(item: HTMLElement | null): Promise<void> {
    const { detailEl, keyOf, renderDetail, focusFlow = 'retain' } = this.opts;
    if (!item) { this.showEmpty(); return; }
    const key = keyOf(item);
    if (key == null) return;
    detailEl.hidden = false;
    detailEl.classList.add('md-loading'); // Loader seam: pending detail
    try {
      await renderDetail(String(key), detailEl);
    } finally {
      detailEl.classList.remove('md-loading');
    }
    if (focusFlow === 'advance') {
      detailEl.setAttribute('tabindex', '-1');
      detailEl.focus();
    }
    detailEl.dispatchEvent(new CustomEvent('detail-change', { bubbles: true, detail: { key } }));
  }

  /** Re-apply roving tabindex after the master list re-renders (delegates to the selection block). */
  refresh(): void {
    this.selection.refresh();
  }

  /** The composed selection block, exposed for callers that need direct access. */
  get selectionBehavior(): SelectionBehavior {
    return this.selection;
  }
}

/** No custom element — the coordinator is consumed directly. Kept for registration-symmetry. */
export function registerMasterDetail(): void {
  /* intentionally empty */
}
