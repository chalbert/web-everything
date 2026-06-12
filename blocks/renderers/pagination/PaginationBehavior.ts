/**
 * PaginationBehavior — the consumable wrapper the pagination block declares
 * (`exports: ["PaginationBehavior", "registerPagination"]`) but had not yet shipped.
 *
 * The pure `renderPagination` reference renderer owns the verified a11y/SEO contract (the
 * `<nav aria-label="pagination">` landmark, `aria-current="page"`, range `role="status"`, load-more /
 * scroll-sentinel modes). This class wires it into a live control surface: it renders into a host,
 * delegates page-button / load-more clicks, advances the page state, re-renders, and emits a
 * `pagination-change` event (and an `onChange` callback) so a consumer can re-window its collection.
 * It re-implements none of the contract. First consumer: the loan-origination pipeline (#317).
 */

import {
  renderPagination, rangeText, announcePagination,
  type PageState, type PaginationOptions,
} from './renderPagination';

/**
 * Where focus lands after a page change — the autofocus-on-activation `landing` contract
 * (#059 Fork 1), composed (landing only, no trap). `heading` (default): the results region's
 * heading, made focusable via `tabindex="-1"` + `.focus()` (the WAI-ARIA APG answer for a surface
 * activation). `target`: an author-named element. `preserve`: stay on the control — the rapid-paging
 * opt-in, and the natural default for `load-more`. `auto`: defer to the browser (a full `?page=n`
 * reload handles focus itself).
 */
export type FocusLanding = 'heading' | 'target' | 'preserve' | 'auto';

export interface PaginationBehaviorOptions {
  state: PageState;
  options: PaginationOptions;
  /** Called with the new state after a page/load-more change (e.g. to re-slice the collection). */
  onChange?: (state: PageState, kind: 'goto' | 'load-more') => void;
  /** Focus landing after a `goto` page change. Default `heading`. `load-more` always preserves. */
  landing?: FocusLanding;
  /**
   * The results region a `heading` landing searches for its heading. Required to enable heading/
   * container landing — the behavior owns the pagination controls, not your layout, so it cannot
   * guess which region the page swap refreshed. When omitted, `heading` landing is a safe no-op.
   */
  results?: HTMLElement;
  /** The element focused when `landing === 'target'`. */
  focusTarget?: HTMLElement;
}

const DEFAULT_OPTIONS: PaginationOptions = { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' };

const SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';

export class PaginationBehavior {
  private state: PageState;
  private readonly options: PaginationOptions;
  private readonly onChange?: PaginationBehaviorOptions['onChange'];
  private readonly onClick: (e: Event) => void;
  private readonly landing?: FocusLanding;
  private readonly results?: HTMLElement;
  private readonly focusTarget?: HTMLElement;
  /** Persistent polite live region (#326): survives re-render so a page change actually announces.
   *  A region recreated by `replaceChildren` would not — SR announces mutations to a *present* region. */
  private readonly liveRegion: HTMLElement;
  /** The re-rendered controls subtree, kept separate from the persistent live region. */
  private readonly navHost: HTMLElement;

  constructor(private readonly host: HTMLElement, opts: PaginationBehaviorOptions) {
    this.state = { ...opts.state };
    this.options = { ...DEFAULT_OPTIONS, ...opts.options };
    this.onChange = opts.onChange;
    this.landing = opts.landing;
    this.results = opts.results;
    this.focusTarget = opts.focusTarget;

    this.liveRegion = document.createElement('p');
    this.liveRegion.className = 'pagination-live';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('style', SR_ONLY);
    this.navHost = document.createElement('div');
    this.host.append(this.liveRegion, this.navHost);

    this.onClick = (e: Event) => {
      const el = (e.target as HTMLElement).closest('[data-action]');
      const action = el?.getAttribute('data-action');
      if (!action) return;
      // The renderer emits 1-based page numbers in data-page (goto/prev/next); in cursor mode prev/next
      // carry no data-page, so step from the current index. load-more advances by one.
      const raw = el!.getAttribute('data-page');
      const page1 = raw != null ? Number(raw) : NaN;
      let target: number;
      if (action === 'goto') target = page1 - 1;
      else if (action === 'prev') target = Number.isInteger(page1) ? page1 - 1 : this.state.pageIndex - 1;
      else if (action === 'next' || action === 'load-more') target = Number.isInteger(page1) ? page1 - 1 : this.state.pageIndex + 1;
      else return;
      if (Number.isFinite(target)) this.goto(target, action === 'load-more' ? 'load-more' : 'goto');
    };
    this.host.addEventListener('click', this.onClick);
    this.render();
  }

  private clampedCount(): number {
    return this.state.pageCount ?? (this.state.total != null ? Math.max(1, Math.ceil(this.state.total / this.state.pageSize)) : Infinity);
  }

  private goto(pageIndex: number, kind: 'goto' | 'load-more'): void {
    const next = Math.max(0, Math.min(pageIndex, this.clampedCount() - 1));
    if (next === this.state.pageIndex && kind === 'goto') return;
    this.state = { ...this.state, pageIndex: next };
    this.render();
    // #326 — announce "Page N of M" on the change, via the persistent polite region.
    this.liveRegion.textContent = announcePagination(this.state, this.options);
    // #327 — move focus per the landing contract (load-more preserves: rapid-paging).
    this.applyLanding(kind);
    this.onChange?.(this.state, kind);
    this.host.dispatchEvent(new CustomEvent('pagination-change', { bubbles: true, detail: { state: this.state, kind } }));
  }

  private render(): void {
    this.navHost.replaceChildren(renderPagination(this.state, this.options));
  }

  /**
   * Compose the autofocus-on-activation `landing` contract (#059 Fork 1) after a page change.
   * `goto` defaults to `heading`; `load-more` always preserves (rapid paging). `heading`/`target`
   * make the destination programmatically focusable (`tabindex="-1"`) and focus it; `preserve`/`auto`
   * move nothing. A `heading` landing with no declared results region is a safe no-op.
   */
  private applyLanding(kind: 'goto' | 'load-more'): void {
    const landing: FocusLanding = kind === 'load-more' ? 'preserve' : this.landing ?? 'heading';
    if (landing === 'preserve' || landing === 'auto') return;
    let el: HTMLElement | null = null;
    if (landing === 'target') {
      el = this.focusTarget ?? null;
    } else if (landing === 'heading' && this.results) {
      el = this.results.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6,[role="heading"]') ?? this.results;
    }
    if (el) {
      el.setAttribute('tabindex', '-1');
      el.focus();
    }
  }

  /** Update the total (e.g. after a filter narrows the collection) and re-render, clamping the page. */
  setTotal(total: number): void {
    this.state = { ...this.state, total, pageCount: Math.max(1, Math.ceil(total / this.state.pageSize)) };
    if (this.state.pageIndex > this.clampedCount() - 1) this.state.pageIndex = this.clampedCount() - 1;
    this.render();
  }

  getState(): PageState { return this.state; }
  rangeText(): string { return rangeText(this.state); }

  destroy(): void { this.host.removeEventListener('click', this.onClick); this.host.replaceChildren(); }
}

/** Declarative consumable: a `<page-nav>` element driven by `.state` / `.options` JS properties. */
export class PaginationElement extends HTMLElement {
  private behavior?: PaginationBehavior;
  private _state: PageState = { pageIndex: 0, pageSize: 10 };
  private _options: PaginationOptions = DEFAULT_OPTIONS;

  set state(s: PageState) { this._state = s; this.sync(); }
  get state(): PageState { return this.behavior?.getState() ?? this._state; }
  set options(o: PaginationOptions) { this._options = o; this.sync(); }

  connectedCallback(): void { this.sync(); }
  disconnectedCallback(): void { this.behavior?.destroy(); this.behavior = undefined; }

  private sync(): void {
    if (!this.isConnected) return;
    this.behavior?.destroy();
    this.behavior = new PaginationBehavior(this, { state: this._state, options: this._options });
  }
}

export function registerPagination(tag = 'page-nav'): void {
  if (!customElements.get(tag)) customElements.define(tag, PaginationElement);
}
