/**
 * DataTableBehavior — the consumable wrapper the data-table block declares
 * (`exports: ["DataTableBehavior", "registerDataTable"]`) but had not yet shipped.
 *
 * The pure reference renderer (`renderDataTable`) and its helpers (`applySortClick`, `announce`,
 * `applyPipeline`) own the verified collection-operations contract (APG Sortable Table, aria-sort,
 * Intl.Collator). This class wires them into a live, interactive surface a consumer can mount and
 * drive: it renders into a host, manages a polite live region for sort announcements, delegates
 * header-button clicks to `applySortClick`, and re-renders — without re-implementing any of the
 * contract. It is the block's first-consumer-facing API; the loan-origination exercise app (#317)
 * is its first enterprise consumer.
 */

import {
  renderDataTable, applySortClick, announce,
  type Row, type DataTableConfig,
} from './renderDataTable';

export interface DataTableBehaviorOptions {
  rows: Row[];
  config: DataTableConfig;
  /** Called after each sort change with the new config (e.g. to drive a Loader re-fetch). */
  onChange?: (config: DataTableConfig) => void;
}

export class DataTableBehavior {
  private rows: Row[];
  private config: DataTableConfig;
  private readonly onChange?: (config: DataTableConfig) => void;
  private readonly live: HTMLElement;
  private readonly onClick: (e: Event) => void;

  constructor(private readonly host: HTMLElement, opts: DataTableBehaviorOptions) {
    this.rows = opts.rows;
    this.config = opts.config;
    this.onChange = opts.onChange;

    // One polite live region per host announces sort/filter changes (announce() owns the wording).
    this.live = document.createElement('div');
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.live.className = 'data-table-live';
    this.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';

    this.onClick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('button[data-action="sort"]');
      const field = btn?.getAttribute('data-field');
      if (!field) return;
      this.config = applySortClick(this.config, field);
      this.render();
      this.live.textContent = announce(this.rows, this.config);
      this.onChange?.(this.config);
      // Re-emit as a DOM event so a consumer can hook re-fetch/pagination without a callback.
      this.host.dispatchEvent(new CustomEvent('data-table-change', { bubbles: true, detail: { config: this.config } }));
    };

    this.host.addEventListener('click', this.onClick);
    this.render();
  }

  /** Render the current (rows, config) into the host via the verified reference renderer. */
  private render(): void {
    this.host.replaceChildren(renderDataTable(this.rows, this.config), this.live);
  }

  /** Replace the data (e.g. after a Loader fetch) and re-render. */
  setRows(rows: Row[]): void { this.rows = rows; this.render(); }

  /** Replace the config (columns/sort/filter/group) and re-render. */
  setConfig(config: DataTableConfig): void { this.config = config; this.render(); }

  getConfig(): DataTableConfig { return this.config; }

  destroy(): void { this.host.removeEventListener('click', this.onClick); this.host.replaceChildren(); }
}

/**
 * The declarative consumable: a `<data-table>` custom element whose `.rows` / `.config` JS properties
 * drive a DataTableBehavior over itself. Config carries call-site predicates/comparators, so it is a
 * JS property, not an attribute. Idempotent registration.
 */
export class DataTableElement extends HTMLElement {
  private behavior?: DataTableBehavior;
  private _rows: Row[] = [];
  private _config?: DataTableConfig;

  set rows(rows: Row[]) { this._rows = rows; this.sync(); }
  get rows(): Row[] { return this._rows; }
  set config(config: DataTableConfig) { this._config = config; this.sync(); }
  get config(): DataTableConfig | undefined { return this._config; }

  connectedCallback(): void { this.sync(); }
  disconnectedCallback(): void { this.behavior?.destroy(); this.behavior = undefined; }

  private sync(): void {
    if (!this.isConnected || !this._config) return;
    this.behavior?.destroy();
    this.behavior = new DataTableBehavior(this, { rows: this._rows, config: this._config });
  }
}

export function registerDataTable(tag = 'data-table'): void {
  if (!customElements.get(tag)) customElements.define(tag, DataTableElement);
}
