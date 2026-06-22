/**
 * Permanent conformance suite for the Pagination block (the playground's badges, in CI).
 *
 * Per ratified #1467/#899: the verifier asserts the STORED golden output as data, NOT a live recompute.
 * Each case re-materializes a pagination root FROM its committed golden (`goldenToRoot`, the inverse of
 * the capture step) and runs `auditPagination(root, golden)` over it — GREEN WITHOUT a live WE render in
 * the assertion path, and `auditPagination` never calls `rangeText`/`renderPagination`. Plus a corpus-
 * completeness guard, a golden-drift guard, and targeted assertions for the cross-layer rules (cursor →
 * no jump-to-page, range label needs a total, infinite → sentinel not nav) read off the goldens.
 *
 * See reports/2026-06-03-pagination-standard-research.md and /blocks/pagination/.
 */
import { describe, it, expect } from 'vitest';
import { paginationCases } from '../../../renderers/pagination/__fixtures__/pagination-cases';
import {
  paginationGoldens,
  goldenFor,
  goldenToRoot,
  buildGoldens,
} from '../../../renderers/pagination/__fixtures__/pagination-goldens';
import { auditPagination, rangeText } from '../../../renderers/pagination/renderPagination';

describe('Pagination conformance — auditPagination reads the stored golden as DATA (#1467/#899)', () => {
  // Per ratified #1467/#899: the verifier asserts the STORED golden output, not a live recompute. Each
  // case re-materializes a pagination root FROM its committed golden (`goldenToRoot`, the inverse of the
  // capture step) and runs `auditPagination(root, golden)` over it — GREEN WITHOUT a live WE render in
  // the assertion path, and `auditPagination` never touches `rangeText`/`renderPagination`.
  for (const c of paginationCases) {
    it(`${c.title}: asserts the stored golden projection (no live render)`, () => {
      const golden = goldenFor(c.id);
      const root = goldenToRoot(golden);
      const result = auditPagination(root, golden);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it('every fixture case has a committed golden (the #899 vector corpus is complete)', () => {
    expect(paginationGoldens.map((g) => g.id).sort()).toEqual(paginationCases.map((c) => c.id).sort());
  });

  it('committed goldens do not drift — they equal a fresh capture from the reference renderer', () => {
    // The capture step (which DOES render) is authoritative ONCE; this guard keeps the frozen JSON in
    // sync with the renderer, mirroring the data-table golden drift test next door (#1494/#899).
    expect(paginationGoldens).toEqual(buildGoldens());
  });

  it('numbered paged: the golden carries a <nav aria-label="pagination"> landmark', () => {
    const g = goldenFor('numbered-seo');
    expect(g.hasNav).toBe(true);
    expect(g.navLabel).toBe('pagination');
  });

  it('numbered paged + query-param: active page is a self-canonical ?page=n <a> with aria-current', () => {
    const g = goldenFor('numbered-seo'); // pageIndex 1 → 1-based page 2
    expect(g.current).toHaveLength(1);
    expect(g.current[0].tag).toBe('A');
    expect(g.current[0].href).toBe('?page=2');
    expect(g.current[0].text).toBe('2');
    // The standard discourages rel=next/prev as primary machinery.
    expect(g.hasRelLink).toBe(false);
  });

  it('urlSync:none falls back to JS-only <button> controls (not crawlable)', () => {
    const g = goldenFor('numbered-no-urlsync');
    expect(g.current[0].tag).toBe('BUTTON');
    expect(g.current[0].href).toBeNull();
  });

  it('cursor protocol (no pageCount): prev/next only, no numbered links, no aria-current', () => {
    const g = goldenFor('cursor-prevnext');
    expect(g.gotoCount).toBe(0);
    expect(g.current).toHaveLength(0);
    expect(g.hasNav).toBe(true);
  });

  it('rangeLabel composes only with a known total; reads the correct slice', () => {
    const withTotal = goldenFor('numbered-range');
    expect(withTotal.rangeText).toBe('Showing 21–40 of 500');
    // The golden stores the slice text — the verifier never recomputes it. (No-total cases store null.)
    expect(goldenFor('numbered-seo').rangeText).toBeNull();
  });

  it('infinite scroll (append + auto): a scroll sentinel, no nav landmark', () => {
    const g = goldenFor('infinite');
    expect(g.hasNav).toBe(false);
    expect(g.hasSentinel).toBe(true);
    expect(g.sentinelAriaHidden).toBe(true);
  });

  it('load-more (append + manual): a nav landmark, no jump-to-page controls', () => {
    const g = goldenFor('load-more');
    expect(g.hasNav).toBe(true);
    expect(g.navLabel).toBe('pagination');
    expect(g.gotoCount).toBe(0);
  });

  it('rangeText helper: 1-based, end clamped to total (the compute that GENERATES the golden slice)', () => {
    // rangeText is no longer in the assertion path (the golden stores the slice); this guards the helper
    // the capture step uses to produce the committed golden text.
    expect(rangeText({ pageIndex: 0, pageSize: 20, total: 500 })).toBe('Showing 1–20 of 500');
    expect(rangeText({ pageIndex: 24, pageSize: 20, total: 500 })).toBe('Showing 481–500 of 500');
    expect(rangeText({ pageIndex: 2, pageSize: 20, total: 45 })).toBe('Showing 41–45 of 45'); // last partial page
  });
});
