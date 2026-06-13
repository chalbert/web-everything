/**
 * Permanent conformance suite for the Data Table block (the playground's badges, in CI).
 *
 * Iterates the SHARED data-table fixtures and, per case, asserts the verified APG / Intl.Collator /
 * SQL-aggregate contract via the SAME audit the demo runs in the browser — so a regression in the
 * reference renderer or the contract turns this red. Plus targeted assertions for the cross-layer
 * rules (aria-sort marks one header, empties placed by SQL NULLS semantics, numeric ordering, group
 * summaries) and the pure aggregate/comparison helpers.
 *
 * See reports/2026-06-03-collection-operations-intent.md and /blocks/data-table/.
 */
import { describe, it, expect } from 'vitest';
import { dataTableCases } from '../../../renderers/data-table/__fixtures__/data-table-cases';
import {
  renderDataTable,
  auditDataTable,
  applyPipeline,
  aggregate,
  summaryText,
  nextSortState,
  sortStateOf,
  applySortClick,
  announce,
  type Row,
  type DataTableConfig,
} from '../../../renderers/data-table/renderDataTable';

const COLS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'team', label: 'Team', sortable: true },
  { field: 'salary', label: 'Salary', sortable: true },
  { field: 'location', label: 'Location' },
];

function rowOrder(root: HTMLElement, field: string): string[] {
  const colIndex = COLS.findIndex((c) => c.field === field);
  return Array.from(root.querySelectorAll('tbody tr'))
    .filter((tr) => !tr.classList.contains('group-row'))
    .map((tr) => tr.querySelectorAll('td')[colIndex]?.textContent ?? '');
}

describe('Data Table reference renderer — verified contract', () => {
  for (const c of dataTableCases) {
    it(`${c.title}: passes the APG/Intl.Collator/aggregate audit`, () => {
      const root = renderDataTable(c.rows, c.config);
      const result = auditDataTable(root, c.rows, c.config);
      const failed = result.checks.filter((x) => !x.pass).map((x) => x.label);
      expect(failed, `failed checks: ${failed.join('; ')}`).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it('sortable headers wrap a <button> + carry aria-sort; non-sortable headers carry none', () => {
    const root = renderDataTable(COLS_ROWS, { columns: COLS, sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] } });
    const headers = Array.from(root.querySelectorAll('thead th'));
    // Active primary header.
    expect(headers[0].getAttribute('aria-sort')).toBe('ascending');
    expect(headers[0].querySelector('button')?.textContent).toBe('Name');
    // Other sortable headers are 'none'.
    expect(headers[1].getAttribute('aria-sort')).toBe('none');
    expect(headers[2].getAttribute('aria-sort')).toBe('none');
    // Non-sortable header has no aria-sort and no button.
    expect(headers[3].hasAttribute('aria-sort')).toBe(false);
    expect(headers[3].querySelector('button')).toBeNull();
  });

  it('exactly one header is aria-sort != none, even with a multi-key sort (APG: one at a time)', () => {
    const root = renderDataTable(COLS_ROWS, {
      columns: COLS,
      sort: { keys: 'multiple', by: [{ field: 'team', direction: 'ascending' }, { field: 'salary', direction: 'descending' }] },
    });
    const active = Array.from(root.querySelectorAll('thead th')).filter((h) => {
      const s = h.getAttribute('aria-sort');
      return s != null && s !== 'none';
    });
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('Team');
  });

  it('an unsorted sortable header is aria-sort="none" (APG: sortable-but-unsorted)', () => {
    const root = renderDataTable(COLS_ROWS, { columns: COLS });
    const sortStates = Array.from(root.querySelectorAll('thead th')).slice(0, 3).map((h) => h.getAttribute('aria-sort'));
    expect(sortStates).toEqual(['none', 'none', 'none']);
  });

  it('numeric ordering: img2 sorts before img10 (Intl.Collator numeric)', () => {
    const rows: Row[] = [{ level: 'img10' }, { level: 'img2' }, { level: 'img1' }];
    const cfg: DataTableConfig = { columns: [{ field: 'level', label: 'Level', sortable: true }], sort: { keys: 'single', by: [{ field: 'level', direction: 'ascending', numeric: true }] } };
    const order = applyPipeline(rows, cfg).groups[0].rows.map((r) => r.level);
    expect(order).toEqual(['img1', 'img2', 'img10']);
  });

  it('empty placement is direction-independent: NULLS LAST even when descending', () => {
    const rows: Row[] = [{ n: 3 }, { n: null }, { n: 1 }, { n: '' }];
    const cfg: DataTableConfig = { columns: [{ field: 'n', label: 'N', sortable: true }], sort: { keys: 'single', by: [{ field: 'n', direction: 'descending', emptyPlacement: 'last' }] } };
    const order = applyPipeline(rows, cfg).groups[0].rows.map((r) => r.n);
    expect(order).toEqual([3, 1, null, '']); // values descending, both empties trailing
  });

  it('empty placement NULLS FIRST puts empties ahead regardless of ascending', () => {
    const rows: Row[] = [{ n: 3 }, { n: null }, { n: 1 }];
    const cfg: DataTableConfig = { columns: [{ field: 'n', label: 'N', sortable: true }], sort: { keys: 'single', by: [{ field: 'n', direction: 'ascending', emptyPlacement: 'first' }] } };
    expect(applyPipeline(rows, cfg).groups[0].rows.map((r) => r.n)).toEqual([null, 1, 3]);
  });

  it('single vs multiple keys: single ignores the tiebreak key', () => {
    const rows: Row[] = [{ t: 'a', s: 1 }, { t: 'a', s: 9 }];
    const cols = [{ field: 't', label: 'T', sortable: true }, { field: 's', label: 'S', sortable: true }];
    const single = applyPipeline(rows, { columns: cols, sort: { keys: 'single', by: [{ field: 't', direction: 'ascending' }, { field: 's', direction: 'descending' }] } });
    expect(single.groups[0].rows.map((r) => r.s)).toEqual([1, 9]); // tiebreak ignored, stable original order
    const multi = applyPipeline(rows, { columns: cols, sort: { keys: 'multiple', by: [{ field: 't', direction: 'ascending' }, { field: 's', direction: 'descending' }] } });
    expect(multi.groups[0].rows.map((r) => r.s)).toEqual([9, 1]); // tiebreak applied
  });

  it('filterMatch all = AND, any = OR', () => {
    const rows: Row[] = [{ team: 'Eng', pay: 50 }, { team: 'Eng', pay: 200 }, { team: 'Sales', pay: 200 }];
    const cols = [{ field: 'team', label: 'Team' }, { field: 'pay', label: 'Pay' }];
    const preds = [
      { test: (r: Row) => r.team === 'Eng' },
      { test: (r: Row) => typeof r.pay === 'number' && r.pay >= 200 },
    ];
    const all = applyPipeline(rows, { columns: cols, filter: { match: 'all', predicates: preds } });
    expect(all.groups[0].rows).toHaveLength(1); // Eng AND >=200
    const any = applyPipeline(rows, { columns: cols, filter: { match: 'any', predicates: preds } });
    expect(any.groups[0].rows).toHaveLength(3); // Eng OR >=200
  });

  it('grouping partitions into one <tbody data-group> per group with a rowgroup summary', () => {
    const root = renderDataTable(COLS_ROWS, { columns: COLS, group: { field: 'team', summary: 'count' } });
    const bodies = root.querySelectorAll('tbody[data-group]');
    expect(bodies.length).toBe(2); // Eng, Sales
    const eng = root.querySelector('tbody[data-group="Eng"] .group-row th[scope="rowgroup"]');
    expect(eng?.textContent).toBe('Eng — count: 2');
  });

  it('aggregate: count / sum / average / minimum / maximum follow SQL semantics', () => {
    const rows: Row[] = [{ v: 10 }, { v: 20 }, { v: 30 }];
    expect(aggregate(rows, 'count')).toBe(3);
    expect(aggregate(rows, 'sum', 'v')).toBe(60);
    expect(aggregate(rows, 'average', 'v')).toBe(20);
    expect(aggregate(rows, 'minimum', 'v')).toBe(10);
    expect(aggregate(rows, 'maximum', 'v')).toBe(30);
    // Non-numeric / empty values are skipped; an all-empty group aggregates to 0.
    expect(aggregate([{ v: null }, { v: 'x' }], 'sum', 'v')).toBe(0);
  });

  it('summaryText: integers render bare, fractions to one decimal', () => {
    expect(summaryText('Eng', 'count', 3)).toBe('Eng — count: 3');
    expect(summaryText('Eng', 'average', 42.5)).toBe('Eng — average: 42.5');
  });

  it('pipeline order is honored: filter narrows before group counts', () => {
    const rows: Row[] = [{ team: 'Eng', ok: true }, { team: 'Eng', ok: false }, { team: 'Sales', ok: true }];
    const cfg: DataTableConfig = {
      columns: [{ field: 'team', label: 'Team' }],
      order: ['filter', 'group', 'page'],
      filter: { match: 'all', predicates: [{ test: (r) => r.ok === true }] },
      group: { field: 'team', summary: 'count' },
    };
    const groups = applyPipeline(rows, cfg).groups;
    // Only the ok rows survive: Eng x1, Sales x1.
    expect(groups.find((g) => g.key === 'Eng')?.summary?.value).toBe(1);
    expect(groups.find((g) => g.key === 'Sales')?.summary?.value).toBe(1);
  });
});

describe('Data Table interactive axis — sort-toggle cycle (backlog #115)', () => {
  it('nextSortState cycles none → ascending → descending → none', () => {
    expect(nextSortState('none')).toBe('ascending');
    expect(nextSortState('ascending')).toBe('descending');
    expect(nextSortState('descending')).toBe('none');
  });

  it('sortStateOf reports the primary key for its field, none for others', () => {
    const cfg: DataTableConfig = { columns: COLS, sort: { keys: 'single', by: [{ field: 'name', direction: 'descending' }] } };
    expect(sortStateOf(cfg, 'name')).toBe('descending');
    expect(sortStateOf(cfg, 'team')).toBe('none');
    expect(sortStateOf({ columns: COLS }, 'name')).toBe('none');
  });

  it('applySortClick walks the full cycle on the same header and clears at none', () => {
    let cfg: DataTableConfig = { columns: COLS }; // unsorted
    cfg = applySortClick(cfg, 'name');
    expect(cfg.sort).toEqual({ keys: 'single', by: [{ field: 'name', direction: 'ascending' }] });
    cfg = applySortClick(cfg, 'name');
    expect(cfg.sort?.by[0].direction).toBe('descending');
    cfg = applySortClick(cfg, 'name'); // third click clears the sort
    expect(cfg.sort).toBeUndefined();
  });

  it('applySortClick on a different header switches the active column to ascending', () => {
    const start: DataTableConfig = { columns: COLS, sort: { keys: 'single', by: [{ field: 'name', direction: 'descending' }] } };
    const next = applySortClick(start, 'team');
    expect(next.sort).toEqual({ keys: 'single', by: [{ field: 'team', direction: 'ascending' }] });
    // The source config is not mutated.
    expect(start.sort?.by[0].field).toBe('name');
  });

  it('the rendered aria-sort + audit follow the clicked config (end-to-end through the renderer)', () => {
    let cfg: DataTableConfig = { columns: COLS };
    cfg = applySortClick(cfg, 'salary'); // → salary ascending
    const root = renderDataTable(COLS_ROWS, cfg);
    const salaryHeader = Array.from(root.querySelectorAll('thead th'))[2];
    expect(salaryHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(auditDataTable(root, COLS_ROWS, cfg).ok).toBe(true);
  });
});

describe('Data Table live announcement — what a screen reader hears (backlog #115)', () => {
  it('sort-only: "Sorted by <label>, <direction>; N rows."', () => {
    const cfg: DataTableConfig = { columns: COLS, sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] } };
    expect(announce(COLS_ROWS, cfg)).toBe('Sorted by Name, ascending; 3 rows.');
  });

  it('unsorted: leads with "Not sorted"', () => {
    expect(announce(COLS_ROWS, { columns: COLS })).toBe('Not sorted; 3 rows.');
  });

  it('filtered: reports the narrowed "<shown> of <total> shown" count', () => {
    const cfg: DataTableConfig = {
      columns: COLS,
      filter: { match: 'all', predicates: [{ test: (r) => r.team === 'Eng' }] },
      sort: { keys: 'single', by: [{ field: 'salary', direction: 'descending' }] },
    };
    expect(announce(COLS_ROWS, cfg)).toBe('Sorted by Salary, descending; 2 of 3 shown.');
  });

  it('grouped: appends the group count', () => {
    const cfg: DataTableConfig = { columns: COLS, group: { field: 'team', summary: 'count' } };
    expect(announce(COLS_ROWS, cfg)).toBe('Not sorted; 3 rows; 2 groups.');
  });

  it('singular row/group wording', () => {
    const one: Row[] = [{ name: 'Solo', team: 'Eng', salary: 1, location: 'X' }];
    expect(announce(one, { columns: COLS })).toBe('Not sorted; 1 row.');
    expect(announce(one, { columns: COLS, group: { field: 'team', summary: 'count' } })).toBe('Not sorted; 1 row; 1 group.');
  });
});

const COLS_ROWS: Row[] = [
  { name: 'Bianca', team: 'Eng', salary: 120, location: 'Berlin' },
  { name: 'Aaron', team: 'Eng', salary: 110, location: 'Oslo' },
  { name: 'Émile', team: 'Sales', salary: 80, location: 'Lyon' },
];

describe('Data Table per-column cell formatter (#368)', () => {
  const rows: Row[] = [
    { name: 'Aaron', salary: 502024 },
    { name: 'Bianca', salary: 80500 },
  ];

  it('a string formatter renders formatted text while sort stays on the raw value', () => {
    const usd = (v: import('../../../renderers/data-table/renderDataTable').Cell) =>
      `$${Number(v).toLocaleString('en-US')}`;
    const config: DataTableConfig = {
      columns: [
        { field: 'name', label: 'Name', sortable: true },
        { field: 'salary', label: 'Salary', sortable: true, format: usd },
      ],
      sort: { keys: 'single', by: [{ field: 'salary', direction: 'ascending' }] },
    };
    const table = renderDataTable(rows, config);
    const salaryCells = Array.from(table.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelectorAll('td')[1]?.textContent,
    );
    // Ascending by RAW number → 80500 before 502024, even though displayed formatted.
    expect(salaryCells).toEqual(['$80,500', '$502,024']);
    // The audit (which recomputes the pipeline) stays green with a formatter present.
    expect(auditDataTable(table, rows, config).ok).toBe(true);
  });

  it('a Node formatter renders a rich cell (the node is appended, not stringified)', () => {
    const chip = (v: import('../../../renderers/data-table/renderDataTable').Cell) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = String(v);
      return span;
    };
    const config: DataTableConfig = {
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'salary', label: 'Salary', format: chip },
      ],
    };
    const table = renderDataTable(rows, config);
    const firstSalaryCell = table.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
    expect(firstSalaryCell.querySelector('span.chip')).not.toBeNull();
    expect(auditDataTable(table, rows, config).ok).toBe(true);
  });

  it('a string formatter is escape-safe — HTML is set as text, never parsed', () => {
    const evil = () => '<img src=x onerror=alert(1)>';
    const config: DataTableConfig = {
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'salary', label: 'Salary', format: evil },
      ],
    };
    const table = renderDataTable(rows, config);
    const cell = table.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
    expect(cell.querySelector('img')).toBeNull(); // not parsed into a live element
    expect(cell.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('a column with no formatter renders the raw value as before (back-compat)', () => {
    const config: DataTableConfig = { columns: [{ field: 'name', label: 'Name' }, { field: 'salary', label: 'Salary' }] };
    const table = renderDataTable(rows, config);
    const cell = table.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
    expect(cell.textContent).toBe('502024');
  });
});
