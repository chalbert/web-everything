/**
 * CollectionOperationsBehavior — the headless coordinator that owns one collection and runs the
 * WHOLE collection-operations pipeline (filter -> sort -> group -> **page**) over it, then hands the
 * current page slice to the data-table for rendering and the totals to the pagination block.
 *
 * The gap it closes (surfaced by the loan-origination app, #317): the data-table and pagination
 * blocks each own one stage — data-table does filter/sort/group, pagination does page — but no one
 * runs the pipeline *as a whole*. The contract is filter -> sort -> group -> page; the obvious
 * consumer wiring (page-then-render) puts sort *after* page, so clicking a header sorts only the
 * current page, not the whole book. This coordinator applies filter/sort/group across the **entire**
 * set first (via the data-table's verified `applyPipeline`), then windows the result — so order is
 * always collection-wide and the page is just the visible slice.
 *
 * It re-implements none of the contract: `applyPipeline` (whose `page` stage is intentionally a
 * no-op — "the Pagination block's job") owns filter/sort/group; this coordinator adds the page stage
 * (the slice) + the event wiring. Re-feeding the already-ordered page slice back through the
 * data-table is safe: filter/sort/group are idempotent on an already-processed slice, so the
 * data-table's own re-render preserves the collection-wide order instead of re-deriving a page-local
 * one. Per #452's ruling (A/A) this is a standalone headless behavior + an optional
 * `<collection-operations>` element wrapper — not a documented composition and not a rendered block.
 */

import {
  applyPipeline, aggregate,
  type Row, type DataTableConfig, type GroupResult,
} from '../data-table/renderDataTable';
import type { PageState } from '../pagination/renderPagination';

/** The materialised page window the coordinator emits on every recompute. */
export interface CollectionWindow {
  /** The current page's rows, in collection-wide pipeline order (filter -> sort -> group, then sliced). */
  pageRows: Row[];
  /**
   * The current page's rows re-projected into their groups, so a grouped data-table still shows the
   * right group headers for the slice. Each group's summary is recomputed over the *windowed* rows.
   */
  pageGroups: GroupResult[];
  /** Every group over the whole book (pre-page) — for a consumer that needs the full structure. */
  groups: GroupResult[];
  /** Pagination state to hand to the pagination block — total + pageCount materialised. */
  page: { pageIndex: number; pageSize: number; total: number; pageCount: number };
}

export interface CollectionOperationsOptions {
  /** The single collection the coordinator owns. */
  rows: Row[];
  /** The filter / sort / group config (the data-table's config shape; its `page` stage is unused here). */
  config: DataTableConfig;
  /** Rows per page. */
  pageSize: number;
  /** Initial 0-based page. Default 0. */
  pageIndex?: number;
  /** Called with the new window after every recompute (e.g. to re-slice the data-table + pagination). */
  onChange?: (window: CollectionWindow) => void;
  /**
   * Optional host. When given, the coordinator (a) dispatches a `collection-operations-change`
   * CustomEvent on it after every recompute, and (b) — unless `bindChildren` is false — listens for
   * bubbling `data-table-change` / `pagination-change` events from descendant blocks and routes them
   * back in, so nesting `<data-table>` + `<page-nav>` inside `<collection-operations>` wires itself.
   */
  host?: HTMLElement;
  /** Whether to auto-route descendant data-table/pagination events (requires `host`). Default true. */
  bindChildren?: boolean;
}

export class CollectionOperationsBehavior {
  private rows: Row[];
  private config: DataTableConfig;
  private pageIndex: number;
  private pageSize: number;
  private window!: CollectionWindow;
  private readonly onChange?: (window: CollectionWindow) => void;
  private readonly host?: HTMLElement;
  private readonly onChildEvent?: (e: Event) => void;

  constructor(opts: CollectionOperationsOptions) {
    this.rows = opts.rows;
    this.config = opts.config;
    this.pageSize = Math.max(1, opts.pageSize);
    this.pageIndex = Math.max(0, opts.pageIndex ?? 0);
    this.onChange = opts.onChange;
    this.host = opts.host;

    if (this.host && opts.bindChildren !== false) {
      // A data-table header click re-filters/-sorts/-groups the whole book (page resets to 0);
      // a pagination click only moves the window. Both bubble to the coordinator's host.
      this.onChildEvent = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (e.type === 'data-table-change' && detail?.config) this.setConfig(detail.config);
        else if (e.type === 'pagination-change' && detail?.state) this.setPage(detail.state.pageIndex);
      };
      this.host.addEventListener('data-table-change', this.onChildEvent);
      this.host.addEventListener('pagination-change', this.onChildEvent);
    }

    this.recompute();
  }

  /** Run the full pipeline over the whole collection, then window it. Idempotent. */
  private recompute(): void {
    // 1. filter -> sort -> group across the WHOLE set (the data-table's verified pipeline).
    const { groups } = applyPipeline(this.rows, this.config);
    // 2. Flatten into the single collection-wide presentation order.
    const ordered: Row[] = groups.flatMap((g) => g.rows);
    const total = ordered.length;
    const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
    // 3. Clamp the page into range (a filter may have shrunk the book under the current page).
    if (this.pageIndex > pageCount - 1) this.pageIndex = pageCount - 1;
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    // 4. The page stage: the visible slice of the collection-wide order.
    const pageRows = ordered.slice(start, end);
    // 5. Re-project the slice into its groups so a grouped table keeps correct headers.
    const pageGroups = this.windowGroups(groups, start, end);

    this.window = {
      pageRows,
      pageGroups,
      groups,
      page: { pageIndex: this.pageIndex, pageSize: this.pageSize, total, pageCount },
    };
    this.onChange?.(this.window);
    this.host?.dispatchEvent(
      new CustomEvent('collection-operations-change', { bubbles: true, detail: { window: this.window } }),
    );
  }

  /**
   * Slice the flattened [start, end) window back into per-group buckets. Groups are contiguous in the
   * flattened order, so we walk them tracking a running global offset and keep each group's overlap
   * with the window. A group's summary is recomputed over the rows actually shown (honest partial
   * totals); `count` summaries reflect the windowed tally, the rest re-aggregate over `summaryField`.
   */
  private windowGroups(groups: GroupResult[], start: number, end: number): GroupResult[] {
    const out: GroupResult[] = [];
    let offset = 0;
    for (const g of groups) {
      const gStart = offset;
      const gEnd = offset + g.rows.length;
      offset = gEnd;
      const from = Math.max(start, gStart);
      const to = Math.min(end, gEnd);
      if (to <= from) continue; // group entirely outside the window
      const rows = g.rows.slice(from - gStart, to - gStart);
      const windowed: GroupResult = { key: g.key, rows };
      if (g.summary) {
        windowed.summary = {
          fn: g.summary.fn,
          value: aggregate(rows, g.summary.fn, this.config.group?.summaryField),
        };
      }
      out.push(windowed);
    }
    return out;
  }

  /** Replace the filter/sort/group config and recompute. Resets to page 0 unless `keepPage` is set. */
  setConfig(config: DataTableConfig, { keepPage = false }: { keepPage?: boolean } = {}): void {
    this.config = config;
    if (!keepPage) this.pageIndex = 0;
    this.recompute();
  }

  /** Move the window to a 0-based page (clamped on recompute). */
  setPage(pageIndex: number): void {
    this.pageIndex = Math.max(0, pageIndex);
    this.recompute();
  }

  /** Change the page size and recompute from page 0. */
  setPageSize(pageSize: number): void {
    this.pageSize = Math.max(1, pageSize);
    this.pageIndex = 0;
    this.recompute();
  }

  /** Replace the underlying collection (e.g. after a server fetch) and recompute, clamping the page. */
  setRows(rows: Row[]): void {
    this.rows = rows;
    this.recompute();
  }

  /** The current materialised window. */
  getWindow(): CollectionWindow { return this.window; }

  /**
   * The pagination block's `PageState` for the current window — hand this straight to a
   * PaginationBehavior so its range label / page count reflect the whole book, not the page.
   */
  getPageState(): PageState {
    const { pageIndex, pageSize, total, pageCount } = this.window.page;
    return { pageIndex, pageSize, total, pageCount };
  }

  destroy(): void {
    if (this.host && this.onChildEvent) {
      this.host.removeEventListener('data-table-change', this.onChildEvent);
      this.host.removeEventListener('pagination-change', this.onChildEvent);
    }
  }
}

/**
 * Declarative consumable: a headless `<collection-operations>` element driven by `.rows` / `.config`
 * / `.pageSize` JS properties. It renders nothing of its own (not a rendered block) — it coordinates
 * descendant `<data-table>` + `<page-nav>` elements via their bubbling change events and emits
 * `collection-operations-change` carrying the window a consumer applies. Mirrors DataTableElement /
 * PaginationElement.
 */
export class CollectionOperationsElement extends HTMLElement {
  private behavior?: CollectionOperationsBehavior;
  private _rows: Row[] = [];
  private _config?: DataTableConfig;
  private _pageSize = 10;

  set rows(rows: Row[]) { this._rows = rows; this.sync(); }
  get rows(): Row[] { return this._rows; }
  set config(config: DataTableConfig) { this._config = config; this.sync(); }
  get config(): DataTableConfig | undefined { return this._config; }
  set pageSize(n: number) { this._pageSize = Math.max(1, n); this.sync(); }
  get pageSize(): number { return this._pageSize; }

  /** The current window, once connected + configured. */
  get window(): CollectionWindow | undefined { return this.behavior?.getWindow(); }

  connectedCallback(): void { this.sync(); }
  disconnectedCallback(): void { this.behavior?.destroy(); this.behavior = undefined; }

  private sync(): void {
    if (!this.isConnected || !this._config) return;
    this.behavior?.destroy();
    this.behavior = new CollectionOperationsBehavior({
      rows: this._rows,
      config: this._config,
      pageSize: this._pageSize,
      host: this,
    });
  }
}

export function registerCollectionOperations(tag = 'collection-operations'): void {
  if (!customElements.get(tag)) customElements.define(tag, CollectionOperationsElement);
}
