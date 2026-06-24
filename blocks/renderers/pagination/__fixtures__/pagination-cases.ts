/**
 * Shared pagination fixtures — the single source of the Pagination example cases for BOTH the
 * Pagination Playground demo and the conformance suite, so the demo's green badges are CI-backed
 * (the anti-drift split, mirroring the JSX/component fixtures).
 *
 * Each case pairs a page-state + contract options with the verified-contract invariant it proves.
 * This vector corpus is the WE-resident half of the #1467/#899 split: the renderer (`renderPagination`)
 * and the audit (`auditPagination`) were re-homed to Frontier UI / Plateau (#1531/#1660) and consume this
 * corpus from there. See reports/2026-06-03-pagination-standard-research.md.
 */
import type { PageState, PaginationOptions } from '../types';

export interface PaginationCase {
  id: string;
  title: string;
  note?: string;
  state: PageState;
  opts: PaginationOptions;
}

export const paginationCases: PaginationCase[] = [
  {
    id: 'numbered-seo',
    title: '1 · Numbered (paged + manual), URL-synced',
    note: 'The SEO-safe default: self-canonical ?page=n <a href> links inside a nav landmark, active page marked aria-current="page". Offset/page protocol (known total).',
    state: { pageIndex: 1, pageSize: 20, pageCount: 5, total: 100 },
    opts: { mode: 'paged', advance: 'manual', urlSync: 'query-param', rangeLabel: 'none' },
  },
  {
    id: 'numbered-range',
    title: '2 · Numbered + result-range label',
    note: 'Adds the "Showing 21–40 of 500" status. The range label needs a total, so it composes only over an offset/page protocol.',
    state: { pageIndex: 1, pageSize: 20, pageCount: 25, total: 500 },
    opts: { mode: 'paged', advance: 'manual', urlSync: 'query-param', rangeLabel: 'range' },
  },
  {
    id: 'numbered-no-urlsync',
    title: '3 · Numbered, JS-only (urlSync: none)',
    note: 'Without URL sync the controls fall back to <button> — interactive but not crawlable. The aria-current contract is unchanged.',
    state: { pageIndex: 0, pageSize: 10, pageCount: 4, total: 40 },
    opts: { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'none' },
  },
  {
    id: 'cursor-prevnext',
    title: '4 · Prev / Next (cursor protocol)',
    note: 'A cursor protocol has no total, so it gives up jump-to-page and the range label — structurally forcing prev/next. No aria-current page number.',
    state: { pageIndex: 0, pageSize: 20 },
    opts: { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'none' },
  },
  {
    id: 'load-more',
    title: '5 · Load-more (append + manual)',
    note: 'Append grows the list on an explicit click. Baymard’s e-commerce default — but only advisable with urlSync on, else the back button breaks.',
    state: { pageIndex: 0, pageSize: 20, pageCount: 10, total: 200 },
    opts: { mode: 'append', advance: 'manual', urlSync: 'query-param', rangeLabel: 'none' },
  },
  {
    id: 'infinite',
    title: '6 · Infinite scroll (append + auto)',
    note: 'Not a peer mode — append + auto. A scroll sentinel the IntersectionObserver watches; no nav landmark, since there are no controls. Carries the documented infinite-scroll harms, so never the default.',
    state: { pageIndex: 0, pageSize: 20 },
    opts: { mode: 'append', advance: 'auto', urlSync: 'query-param', rangeLabel: 'none' },
  },
];
