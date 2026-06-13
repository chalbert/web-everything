/**
 * Permanent conformance suite for the Collection Operations coordinator (the headless block that
 * runs filter -> sort -> group -> **page** over one collection).
 *
 * The bug it exists to prevent: sort-after-page (page-local order). These tests assert the
 * coordinator sorts/filters/groups the WHOLE book first and only then windows it — so paging then
 * sorting yields collection-wide order, the total/pageCount reflect the whole book, and a grouped
 * page keeps correct (windowed) group headers.
 *
 * See #369 / #452 and /blocks/data-table/ + /blocks/pagination/ (the two stage-owning blocks).
 */
import { describe, it, expect } from 'vitest';
import {
  CollectionOperationsBehavior,
  type CollectionWindow,
} from '../../../renderers/collection-operations/CollectionOperationsBehavior';
import type { Row, DataTableConfig } from '../../../renderers/data-table/renderDataTable';

const COLS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'score', label: 'Score', sortable: true },
];

/** 25 rows with descending insertion order so an ascending sort is a real reorder, not a no-op. */
const ROWS: Row[] = Array.from({ length: 25 }, (_, i) => ({ name: `row-${24 - i}`, score: 24 - i }));

const sortAsc: DataTableConfig = {
  columns: COLS,
  sort: { keys: 'single', by: [{ field: 'score', direction: 'ascending' }] },
};

describe('CollectionOperationsBehavior — whole-book pipeline then page', () => {
  it('sorts the WHOLE collection before windowing (not page-local)', () => {
    let win!: CollectionWindow;
    const co = new CollectionOperationsBehavior({
      rows: ROWS,
      config: sortAsc,
      pageSize: 10,
      onChange: (w) => { win = w; },
    });
    // Page 0 of an ascending sort over the whole book: the 10 smallest scores, in order.
    expect(win.pageRows.map((r) => r.score)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(win.page.total).toBe(25);
    expect(win.page.pageCount).toBe(3);

    // Move to page 1 — must be the NEXT slice of the collection-wide order, never a re-sort of page 1.
    co.setPage(1);
    expect(win.pageRows.map((r) => r.score)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

    // Last page is the remainder, clamped — not a full page.
    co.setPage(2);
    expect(win.pageRows.map((r) => r.score)).toEqual([20, 21, 22, 23, 24]);
  });

  it('sorting AFTER paging re-windows from collection-wide order (the #369 bug fix)', () => {
    let win!: CollectionWindow;
    const co = new CollectionOperationsBehavior({
      rows: ROWS,
      config: { columns: COLS }, // unsorted: insertion order (score 24..0)
      pageSize: 10,
      onChange: (w) => { win = w; },
    });
    co.setPage(2); // sit on the last page first…
    // …then change the sort. A naive page-then-sort would sort only page 2; we reset + re-window.
    co.setConfig(sortAsc);
    expect(win.page.pageIndex).toBe(0); // a sort/filter change resets to page 0
    expect(win.pageRows.map((r) => r.score)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('a filter shrinks the whole book and clamps an out-of-range page', () => {
    let win!: CollectionWindow;
    const co = new CollectionOperationsBehavior({
      rows: ROWS,
      config: sortAsc,
      pageSize: 10,
      pageIndex: 2,
      onChange: (w) => { win = w; },
    });
    expect(win.page.pageIndex).toBe(2);
    // Keep only scores < 5 → 5 rows → one page; the page index clamps from 2 to 0.
    co.setConfig({
      ...sortAsc,
      filter: { match: 'all', predicates: [{ test: (r: Row) => Number(r.score) < 5 }] },
    });
    expect(win.page.total).toBe(5);
    expect(win.page.pageCount).toBe(1);
    expect(win.page.pageIndex).toBe(0);
    expect(win.pageRows.map((r) => r.score)).toEqual([0, 1, 2, 3, 4]);
  });

  it('windows groups for the page and recomputes per-group summaries over shown rows', () => {
    // 6 rows across two teams; group by team with a count summary, 4 per page.
    const rows: Row[] = [
      { team: 'a', score: 1 }, { team: 'a', score: 2 }, { team: 'a', score: 3 },
      { team: 'b', score: 4 }, { team: 'b', score: 5 }, { team: 'b', score: 6 },
    ];
    let win!: CollectionWindow;
    const co = new CollectionOperationsBehavior({
      rows,
      config: {
        columns: [{ field: 'team', label: 'Team' }, { field: 'score', label: 'Score' }],
        group: { field: 'team', summary: 'count' },
      },
      pageSize: 4,
      onChange: (w) => { win = w; },
    });
    // Full book: group a (3) + group b (3).
    expect(win.groups.map((g) => [g.key, g.rows.length])).toEqual([['a', 3], ['b', 3]]);
    // Page 0 (4 rows): all of a (3) + first of b (1). Summaries reflect the windowed counts.
    expect(win.pageGroups.map((g) => [g.key, g.rows.length, g.summary?.value])).toEqual([
      ['a', 3, 3],
      ['b', 1, 1],
    ]);
    // Page 1: the remaining 2 of group b.
    co.setPage(1);
    expect(win.pageGroups.map((g) => [g.key, g.rows.length, g.summary?.value])).toEqual([['b', 2, 2]]);
  });

  it('routes descendant data-table / pagination events through a host', () => {
    const host = document.createElement('div');
    let win!: CollectionWindow;
    new CollectionOperationsBehavior({
      rows: ROWS,
      config: { columns: COLS },
      pageSize: 10,
      host,
      onChange: (w) => { win = w; },
    });
    // A pagination-change bubbling to the host moves the window.
    host.dispatchEvent(new CustomEvent('pagination-change', { detail: { state: { pageIndex: 1, pageSize: 10 } } }));
    expect(win.page.pageIndex).toBe(1);
    // A data-table-change re-runs the pipeline over the whole book and resets to page 0.
    host.dispatchEvent(new CustomEvent('data-table-change', { detail: { config: sortAsc } }));
    expect(win.page.pageIndex).toBe(0);
    expect(win.pageRows.map((r) => r.score)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('getPageState materialises total + pageCount for the pagination block', () => {
    const co = new CollectionOperationsBehavior({ rows: ROWS, config: sortAsc, pageSize: 10 });
    expect(co.getPageState()).toEqual({ pageIndex: 0, pageSize: 10, total: 25, pageCount: 3 });
  });
});
