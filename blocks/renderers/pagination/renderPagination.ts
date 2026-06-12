/**
 * Reference renderer for the Pagination block — the runtime twin of the contract documented at
 * /blocks/pagination/. It renders the paged controls the Collection Operations `page` stage
 * describes, with the *verified* WAI-ARIA APG accessibility contract, so the contract can be
 * exercised live (the Pagination Playground) and guarded in CI (the conformance suite) off ONE
 * shared source.
 *
 * Web Everything is the standard: this is a minimal, deterministic reference, NOT the production
 * implementation. Concrete strategies (a real URL-state provider, an alternate advance trigger,
 * windowing) live in Frontier UI. Native DOM only — no framework, no bootstrap.
 *
 * See reports/2026-06-03-pagination-standard-research.md for the verified claims this encodes:
 *   - a11y:  <nav aria-label="pagination"> landmark + aria-current="page" on the active link.
 *   - SEO:   self-canonical ?page=n <a href> links are the indexable default (urlSync:query-param);
 *            urlSync:none falls back to JS-only <button> controls (not crawlable).
 *   - axes:  pageMode (paged | append) × advance (manual | auto); infinite = append + auto (sentinel).
 *   - total: rangeLabel ('showing a–b of N') and jump-to-page need a total → offset/page only;
 *            a cursor protocol (no total/pageCount) forces prev-next.
 */

export type PageMode = 'paged' | 'append';
export type Advance = 'manual' | 'auto';
export type UrlSync = 'none' | 'query-param';
export type RangeLabel = 'none' | 'range';

export interface PageState {
  /** Zero-based index of the active page. */
  pageIndex: number;
  /** Items per slice. */
  pageSize: number;
  /** Total number of pages — absent under a cursor protocol (no total). */
  pageCount?: number;
  /** Total number of items — absent under a cursor protocol. */
  total?: number;
}

export interface PaginationOptions {
  mode: PageMode;
  advance: Advance;
  urlSync: UrlSync;
  rangeLabel: RangeLabel;
  /** aria-label for the navigation landmark (unique per landmark). Default 'pagination'. */
  label?: string;
}

const EN_DASH = '–';

/** Build a result-range label string: "Showing 21–40 of 500" (1-based, end clamped to total). */
export function rangeText(state: PageState): string {
  const start = state.pageIndex * state.pageSize + 1;
  const end = Math.min((state.pageIndex + 1) * state.pageSize, state.total ?? start);
  return `Showing ${start}${EN_DASH}${end} of ${state.total ?? '?'}`;
}

/**
 * The clause-joined screen-reader status announced on a page change — pagination's "Page N of M"
 * (#059 Fork 2), optionally extended with the visible range as a second clause ("Page 2 of 10;
 * Showing 21–40 of 500."). Shares the Data Table `announce()` shape (one polite region, a
 * `clause; clause; .` string) rather than inventing a second; the reusable seam is the pattern.
 *
 * Returns '' when there is nothing determinate to announce (a cursor protocol carries no page count
 * and no total, so there is no "of M" to state — announcing a bare "Page N" would be noise). The
 * announce-on-change wiring lives in PaginationBehavior, since a region re-created by a re-render
 * cannot announce; this function only computes the text.
 */
export function announcePagination(state: PageState, opts: PaginationOptions): string {
  const clauses: string[] = [];
  if (state.pageCount != null) clauses.push(`Page ${state.pageIndex + 1} of ${state.pageCount}`);
  if (opts.rangeLabel === 'range' && state.total != null) clauses.push(rangeText(state));
  return clauses.length ? clauses.join('; ') + '.' : '';
}

function a(href: string, text: string, current = false): HTMLAnchorElement {
  const el = document.createElement('a');
  el.setAttribute('href', href);
  if (current) el.setAttribute('aria-current', 'page');
  el.textContent = text;
  return el;
}

function btn(text: string, dataAction: string, opts: { current?: boolean; disabled?: boolean; page?: number } = {}): HTMLButtonElement {
  const el = document.createElement('button');
  el.setAttribute('type', 'button');
  el.setAttribute('data-action', dataAction);
  if (opts.page != null) el.setAttribute('data-page', String(opts.page));
  if (opts.current) el.setAttribute('aria-current', 'page');
  if (opts.disabled) el.setAttribute('aria-disabled', 'true');
  el.textContent = text;
  return el;
}

/**
 * Render the pagination controls for a page-state + contract. Returns a single root element:
 *   <div class="pagination" data-mode data-advance> [range status?] <nav | sentinel> </div>
 */
export function renderPagination(state: PageState, opts: PaginationOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'pagination';
  root.setAttribute('data-mode', opts.mode);
  root.setAttribute('data-advance', opts.advance);

  // Result-range label — only valid with a known total (offset/page protocol).
  if (opts.rangeLabel === 'range' && state.total != null) {
    const status = document.createElement('p');
    status.className = 'pagination-range';
    status.setAttribute('role', 'status');
    status.textContent = rangeText(state);
    root.append(status);
  }

  // Infinite scroll = append + auto: no navigation landmark (nothing to navigate) — a scroll
  // sentinel the IntersectionObserver watches. The unreachable-footer harm is documented; auto is
  // never the default.
  if (opts.mode === 'append' && opts.advance === 'auto') {
    const sentinel = document.createElement('div');
    sentinel.className = 'pagination-sentinel';
    sentinel.setAttribute('data-role', 'scroll-sentinel');
    sentinel.setAttribute('aria-hidden', 'true');
    root.append(sentinel);
    return root;
  }

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', opts.label ?? 'pagination');

  if (opts.mode === 'append') {
    // Load-more (append + manual): one explicit control that grows the list.
    nav.append(btn('Load more', 'load-more'));
    root.append(nav);
    return root;
  }

  // paged: numbered when a total is known; prev/next-only under a cursor protocol.
  const active = state.pageIndex; // zero-based
  const useHref = opts.urlSync === 'query-param';
  const pageHref = (page1: number) => `?page=${page1}`;

  if (state.pageCount == null) {
    // Cursor protocol — no total, so no jump-to-page and no numbered links.
    nav.append(btn('Previous', 'prev', { disabled: active === 0 }));
    nav.append(btn('Next', 'next'));
    root.append(nav);
    return root;
  }

  // Numbered pagination over an offset/page protocol.
  const count = state.pageCount;
  const prevDisabled = active === 0;
  const nextDisabled = active >= count - 1;

  // Previous control.
  if (useHref && !prevDisabled) nav.append(a(pageHref(active), 'Previous'));
  else nav.append(btn('Previous', 'prev', { disabled: prevDisabled, page: active }));

  // Numbered page links 1..count.
  for (let i = 0; i < count; i++) {
    const page1 = i + 1;
    const isCurrent = i === active;
    if (useHref) nav.append(a(pageHref(page1), String(page1), isCurrent));
    else nav.append(btn(String(page1), 'goto', { current: isCurrent, page: page1 }));
  }

  // Next control.
  if (useHref && !nextDisabled) nav.append(a(pageHref(active + 2), 'Next'));
  else nav.append(btn('Next', 'next', { disabled: nextDisabled, page: active + 2 }));

  root.append(nav);
  return root;
}

// ── Conformance audit — the verified contract, checked by BOTH the demo badge and the CI suite ──

export interface AuditCheck {
  label: string;
  pass: boolean;
}
export interface AuditResult {
  ok: boolean;
  checks: AuditCheck[];
}

/**
 * Audit a rendered pagination root against the verified accessibility/SEO contract for its
 * contract options. Returns per-check results so the demo can show them and the suite can assert.
 */
export function auditPagination(root: HTMLElement, state: PageState, opts: PaginationOptions): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });

  const sentinel = root.querySelector('[data-role="scroll-sentinel"]');
  const nav = root.querySelector('nav');
  const range = root.querySelector('.pagination-range');
  const current = root.querySelectorAll('[aria-current="page"]');

  if (opts.mode === 'append' && opts.advance === 'auto') {
    add('append+auto renders a scroll sentinel', !!sentinel);
    add('sentinel is aria-hidden (not a nav landmark)', !!sentinel && sentinel.getAttribute('aria-hidden') === 'true');
    add('no empty nav landmark when there are no controls', !nav);
  } else {
    add('controls live in a <nav> landmark', !!nav);
    add('nav landmark has a unique aria-label', !!nav && !!nav.getAttribute('aria-label'));
  }

  if (opts.mode === 'paged' && state.pageCount != null) {
    add('exactly one aria-current="page" marks the active page', current.length === 1);
    const activeEl = current[0];
    add('active control reflects the active page number', !!activeEl && activeEl.textContent === String(state.pageIndex + 1));
    if (opts.urlSync === 'query-param') {
      add('paged links are self-canonical ?page=n <a href> (SEO default)', !!activeEl && activeEl.tagName === 'A' && (activeEl.getAttribute('href') || '').startsWith('?page='));
      add('no rel=next/prev emitted as primary machinery (deprecated)', !root.querySelector('[rel="next"],[rel="prev"]'));
    } else {
      add('urlSync:none falls back to JS-only <button> controls', !!activeEl && activeEl.tagName === 'BUTTON');
    }
  }

  if (opts.mode === 'paged' && state.pageCount == null) {
    add('cursor protocol shows prev/next only (no jump-to-page)', !!nav && nav.querySelectorAll('[data-action="goto"]').length === 0);
    add('cursor protocol marks no aria-current page (no total)', current.length === 0);
  }

  if (opts.rangeLabel === 'range') {
    const hasTotal = state.total != null;
    add('range label present only when a total is known', !!range === hasTotal);
    if (hasTotal) add('range label reads the correct slice', !!range && range.textContent === rangeText(state));
  }

  return { ok: checks.every((c) => c.pass), checks };
}
