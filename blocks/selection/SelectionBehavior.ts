/**
 * SelectionBehavior — a runtime for the `selection` intent (model / immediacy / variant / grouping).
 *
 * The selection intent had no shipping implementation (dropdown/droplist are draft with no sourcePath),
 * so unlike data-table/pagination there is no reference renderer to wrap — this builds the runtime from
 * the intent contract. It manages which item(s) in a host container are selected, over items matched by a
 * CSS selector, with: `aria-selected` projection, a roving `tabindex`, click + keyboard (Arrow/Home/End,
 * Enter/Space) selection, and a `selection-change` event. This is the `variant: item`, list-selection
 * realization (the dropdown/droplist blocks will compose it for listbox selection). First consumer: the
 * loan-origination pipeline's row → underwriting-trace master-detail (#317 / #374).
 */

export type SelectionModel = 'single' | 'multiple';

export interface SelectionOptions {
  /** CSS selector (scoped to the host) for the selectable items. */
  itemSelector: string;
  /** `single` (default) keeps at most one selected; `multiple` toggles. */
  model?: SelectionModel;
  /** Class set on selected items in addition to `aria-selected`. Default 'selected'. */
  selectedClass?: string;
  onChange?: (change: SelectionChange) => void;
}

export interface SelectionChange {
  selected: HTMLElement[];
  /** The item whose state just changed (selected or deselected), or null on clear. */
  last: HTMLElement | null;
}

export class SelectionBehavior {
  private readonly model: SelectionModel;
  private readonly itemSelector: string;
  private readonly selectedClass: string;
  private readonly onChange?: (c: SelectionChange) => void;
  private readonly onClick: (e: Event) => void;
  private readonly onKeydown: (e: Event) => void;

  constructor(private readonly host: HTMLElement, opts: SelectionOptions) {
    this.model = opts.model ?? 'single';
    this.itemSelector = opts.itemSelector;
    this.selectedClass = opts.selectedClass ?? 'selected';
    this.onChange = opts.onChange;

    this.onClick = (e: Event) => {
      const item = this.itemFrom(e.target as HTMLElement);
      if (item) this.choose(item);
    };
    this.onKeydown = (e: Event) => this.handleKey(e as KeyboardEvent);
    this.host.addEventListener('click', this.onClick);
    this.host.addEventListener('keydown', this.onKeydown);
    this.refreshRoving();
  }

  /** Live items matched in the host (re-queried so the behavior survives table re-renders). */
  items(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(this.itemSelector));
  }

  private itemFrom(target: HTMLElement | null): HTMLElement | null {
    const el = target?.closest<HTMLElement>(this.itemSelector) ?? null;
    return el && this.host.contains(el) ? el : null;
  }

  getSelected(): HTMLElement[] {
    return this.items().filter((el) => el.getAttribute('aria-selected') === 'true');
  }

  /** Select (single) or toggle (multiple) an item, projecting aria-selected + class, then announce. */
  choose(item: HTMLElement): void {
    if (this.model === 'single') {
      for (const el of this.items()) this.mark(el, el === item);
    } else {
      this.mark(item, item.getAttribute('aria-selected') !== 'true');
    }
    this.roveTo(item);
    this.emit(item);
  }

  clear(): void {
    for (const el of this.items()) this.mark(el, false);
    this.emit(null);
  }

  private mark(el: HTMLElement, selected: boolean): void {
    el.setAttribute('aria-selected', String(selected));
    el.classList.toggle(this.selectedClass, selected);
  }

  private emit(last: HTMLElement | null): void {
    const change: SelectionChange = { selected: this.getSelected(), last };
    this.onChange?.(change);
    this.host.dispatchEvent(new CustomEvent('selection-change', { bubbles: true, detail: change }));
  }

  // ── Roving tabindex + keyboard (the focus aspect of list selection) ──
  private refreshRoving(): void {
    const items = this.items();
    if (!items.length) return;
    const active = this.getSelected()[0] ?? items[0];
    for (const el of items) el.tabIndex = el === active ? 0 : -1;
  }

  private roveTo(item: HTMLElement): void {
    for (const el of this.items()) el.tabIndex = el === item ? 0 : -1;
  }

  /** Re-apply the roving tabindex after the host's items change (e.g. a table re-render). */
  refresh(): void { this.refreshRoving(); }

  private handleKey(e: KeyboardEvent): void {
    const items = this.items();
    const current = this.itemFrom(e.target as HTMLElement);
    if (!current || !items.length) return; // only act when focus is on a selectable item
    const i = items.indexOf(current);
    let next: HTMLElement | undefined;
    switch (e.key) {
      case 'ArrowDown': next = items[Math.min(i + 1, items.length - 1)]; break;
      case 'ArrowUp': next = items[Math.max(i - 1, 0)]; break;
      case 'Home': next = items[0]; break;
      case 'End': next = items[items.length - 1]; break;
      case 'Enter': case ' ': e.preventDefault(); this.choose(current); return;
      default: return;
    }
    if (next) {
      e.preventDefault();
      next.focus();
      this.choose(next); // immediacy: live — arrow movement commits the selection
    }
  }

  destroy(): void {
    this.host.removeEventListener('click', this.onClick);
    this.host.removeEventListener('keydown', this.onKeydown);
  }
}

export function registerSelection(_tag?: string): void { /* behavior is consumed directly; no custom element */ }
