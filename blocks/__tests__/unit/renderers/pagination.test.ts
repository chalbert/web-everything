/**
 * Permanent conformance suite for the Pagination block (the playground's badges, in CI).
 *
 * Iterates the SHARED pagination fixtures and, per case, asserts the verified accessibility/SEO
 * contract via the SAME audit the demo runs in the browser — so a regression in the reference
 * renderer or the contract turns this red. Plus targeted assertions for the cross-layer rules
 * (cursor → no jump-to-page, range label needs a total, infinite → sentinel not nav).
 *
 * See reports/2026-06-03-pagination-standard-research.md and /blocks/pagination/.
 */
import { describe, it, expect } from 'vitest';
import { paginationCases } from '../../../renderers/pagination/__fixtures__/pagination-cases';
import { renderPagination, auditPagination, rangeText } from '../../../renderers/pagination/renderPagination';

describe('Pagination reference renderer — verified contract', () => {
  for (const c of paginationCases) {
    it(`${c.title}: passes the a11y/SEO audit`, () => {
      const root = renderPagination(c.state, c.opts);
      const result = auditPagination(root, c.state, c.opts);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it('numbered paged: wraps controls in a <nav aria-label="pagination"> landmark', () => {
    const root = renderPagination({ pageIndex: 1, pageSize: 20, pageCount: 5, total: 100 }, { mode: 'paged', advance: 'manual', urlSync: 'query-param', rangeLabel: 'none' });
    const nav = root.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute('aria-label')).toBe('pagination');
  });

  it('numbered paged + query-param: active page is a self-canonical ?page=n <a> with aria-current', () => {
    const root = renderPagination({ pageIndex: 2, pageSize: 20, pageCount: 5, total: 100 }, { mode: 'paged', advance: 'manual', urlSync: 'query-param', rangeLabel: 'none' });
    const current = root.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].tagName).toBe('A');
    expect(current[0].getAttribute('href')).toBe('?page=3'); // pageIndex 2 → 1-based page 3
    expect(current[0].textContent).toBe('3');
    // The standard discourages rel=next/prev as primary machinery.
    expect(root.querySelector('[rel="next"],[rel="prev"]')).toBeNull();
  });

  it('urlSync:none falls back to JS-only <button> controls (not crawlable)', () => {
    const root = renderPagination({ pageIndex: 0, pageSize: 10, pageCount: 4, total: 40 }, { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'none' });
    expect(root.querySelector('a[href]')).toBeNull();
    const current = root.querySelector('[aria-current="page"]');
    expect(current!.tagName).toBe('BUTTON');
  });

  it('cursor protocol (no pageCount): prev/next only, no numbered links, no aria-current', () => {
    const root = renderPagination({ pageIndex: 0, pageSize: 20 }, { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'none' });
    expect(root.querySelectorAll('[data-action="goto"]')).toHaveLength(0);
    expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    expect(root.querySelector('[data-action="prev"]')).not.toBeNull();
    expect(root.querySelector('[data-action="next"]')).not.toBeNull();
  });

  it('rangeLabel composes only with a known total; reads the correct slice', () => {
    const withTotal = renderPagination({ pageIndex: 1, pageSize: 20, pageCount: 25, total: 500 }, { mode: 'paged', advance: 'manual', urlSync: 'query-param', rangeLabel: 'range' });
    const status = withTotal.querySelector('.pagination-range');
    expect(status).not.toBeNull();
    expect(status!.getAttribute('role')).toBe('status');
    expect(status!.textContent).toBe('Showing 21–40 of 500');

    // No total (cursor) → the range label is suppressed even when requested.
    const noTotal = renderPagination({ pageIndex: 0, pageSize: 20 }, { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' });
    expect(noTotal.querySelector('.pagination-range')).toBeNull();
  });

  it('infinite scroll (append + auto): a scroll sentinel, no nav landmark', () => {
    const root = renderPagination({ pageIndex: 0, pageSize: 20 }, { mode: 'append', advance: 'auto', urlSync: 'query-param', rangeLabel: 'none' });
    expect(root.querySelector('nav')).toBeNull();
    const sentinel = root.querySelector('[data-role="scroll-sentinel"]');
    expect(sentinel).not.toBeNull();
    expect(sentinel!.getAttribute('aria-hidden')).toBe('true');
  });

  it('load-more (append + manual): one Load more control inside the nav landmark', () => {
    const root = renderPagination({ pageIndex: 0, pageSize: 20, pageCount: 10, total: 200 }, { mode: 'append', advance: 'manual', urlSync: 'query-param', rangeLabel: 'none' });
    const nav = root.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav!.querySelector('[data-action="load-more"]')!.textContent).toBe('Load more');
  });

  it('rangeText: 1-based, end clamped to total', () => {
    expect(rangeText({ pageIndex: 0, pageSize: 20, total: 500 })).toBe('Showing 1–20 of 500');
    expect(rangeText({ pageIndex: 24, pageSize: 20, total: 500 })).toBe('Showing 481–500 of 500');
    expect(rangeText({ pageIndex: 2, pageSize: 20, total: 45 })).toBe('Showing 41–45 of 45'); // last partial page
  });
});
