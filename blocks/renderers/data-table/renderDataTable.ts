/**
 * Reference renderer for the Data Table block — the runtime twin of the contract documented at
 * /blocks/data-table/. It realizes the filter / sort / group stages of the Collection Operations
 * intent (the page stage is the separate Pagination block — compose, never merge), projecting the
 * intent's UX vocabulary onto the *verified* WAI-ARIA APG "Sortable Table" contract so it can be
 * exercised live (the Data Table Playground) and guarded in CI (the conformance suite) off ONE
 * shared source.
 *
 * Web Everything is the standard: this is a minimal, deterministic reference, NOT the production
 * implementation. Concrete strategies (a real comparator provider, server-delegated ORDER BY,
 * virtualization) live in Frontier UI / are app-owned. Native DOM only — no framework.
 *
 * The vocabulary is consumed verbatim from the intent, never reinvented:
 *   - sort:   sortDirection -> the native `aria-sort` attribute on the active column header
 *             (ascending | descending; an unsorted-but-sortable header is `none`, APG recipe);
 *             text comparison follows `Intl.Collator` (sensitivity / numeric / caseFirst /
 *             ignorePunctuation); emptyPlacement mirrors SQL NULLS FIRST/LAST.
 *   - filter: filterMatch (all = AND, any = OR) combines call-site predicates.
 *   - group:  groupSummary (count | sum | average | minimum | maximum) — the SQL aggregate names.
 *   - order:  the pipeline order is data (default filter -> sort -> group -> page).
 *
 * See reports/2026-06-03-collection-operations-intent.md for the verified claims this encodes.
 */

export type SortDirection = 'ascending' | 'descending';
export type Sensitivity = 'base' | 'accent' | 'case' | 'variant';
export type CaseFirst = 'upper' | 'lower' | 'false';
export type EmptyPlacement = 'first' | 'last';
export type FilterMatch = 'all' | 'any';
export type GroupSummaryFn = 'count' | 'sum' | 'average' | 'minimum' | 'maximum';
export type Operation = 'filter' | 'sort' | 'group' | 'page';

export type Cell = string | number | null | undefined;
export type Row = Record<string, Cell>;

export interface Column {
  field: string;
  label: string;
  /** Sortable columns get a button-wrapped header + an `aria-sort` state (APG). Default false. */
  sortable?: boolean;
}

export interface SortKey {
  field: string;
  direction: SortDirection;
  // Comparison preferences mirror Intl.Collator option names verbatim.
  sensitivity?: Sensitivity;
  numeric?: boolean; // natural numeric order: img2 before img10
  caseFirst?: CaseFirst;
  ignorePunctuation?: boolean;
  emptyPlacement?: EmptyPlacement; // default 'last'
}

export interface FilterPredicate {
  /** A short human label for the demo's contract line; not used by the engine. */
  label?: string;
  /** The predicate itself is call-site data — the intent owns only how predicates combine. */
  test: (row: Row) => boolean;
}

export interface GroupConfig {
  /** Column whose value partitions the rows into groups. */
  field: string;
  /** The aggregate shown per group, named after the SQL aggregate functions. */
  summary: GroupSummaryFn;
  /** Field the aggregate runs over (sum/average/minimum/maximum); ignored by count. */
  summaryField?: string;
}

export interface DataTableConfig {
  columns: Column[];
  /** Which stages run and in what order. Default ['filter','sort','group','page']. */
  order?: Operation[];
  filter?: { match: FilterMatch; predicates: FilterPredicate[] };
  sort?: { by: SortKey[]; keys: 'single' | 'multiple' };
  group?: GroupConfig;
  caption?: string;
}

export interface GroupResult {
  /** The group's key value, or null for the single ungrouped bucket. */
  key: string | null;
  rows: Row[];
  summary?: { fn: GroupSummaryFn; value: number };
}

export interface PipelineResult {
  groups: GroupResult[];
}

const DEFAULT_ORDER: Operation[] = ['filter', 'sort', 'group', 'page'];

function isEmpty(v: Cell): boolean {
  return v == null || v === '';
}

/** Build a collator carrying only the options the sort key set (undefined -> engine default). */
function collatorFor(key: SortKey): Intl.Collator {
  const opts: Intl.CollatorOptions = {};
  if (key.sensitivity != null) opts.sensitivity = key.sensitivity;
  if (key.numeric != null) opts.numeric = key.numeric;
  if (key.caseFirst != null) opts.caseFirst = key.caseFirst;
  if (key.ignorePunctuation != null) opts.ignorePunctuation = key.ignorePunctuation;
  return new Intl.Collator(undefined, opts);
}

/** Compare two rows on one sort key. Empty placement is direction-independent (like SQL NULLS). */
function compareByKey(a: Row, b: Row, key: SortKey, collator: Intl.Collator): number {
  const av = a[key.field];
  const bv = b[key.field];
  const ea = isEmpty(av);
  const eb = isEmpty(bv);
  const placement = key.emptyPlacement ?? 'last';
  if (ea && eb) return 0;
  if (ea) return placement === 'first' ? -1 : 1;
  if (eb) return placement === 'first' ? 1 : -1;

  let c: number;
  if (typeof av === 'number' && typeof bv === 'number') c = av - bv;
  else c = collator.compare(String(av), String(bv));
  return key.direction === 'descending' ? -c : c;
}

/** Compute one group's aggregate. count uses row tally; the rest coerce summaryField to numbers. */
export function aggregate(rows: Row[], fn: GroupSummaryFn, field?: string): number {
  if (fn === 'count') return rows.length;
  const nums = rows
    .map((r) => (field != null ? Number(r[field]) : NaN))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return 0;
  switch (fn) {
    case 'sum':
      return nums.reduce((s, n) => s + n, 0);
    case 'average':
      return nums.reduce((s, n) => s + n, 0) / nums.length;
    case 'minimum':
      return Math.min(...nums);
    case 'maximum':
      return Math.max(...nums);
  }
}

/**
 * Apply the filter / sort / group stages in the configured order and return normalized groups.
 * The page stage is a no-op here — it is the Pagination block's job (compose, never merge).
 * This is the single source the renderer projects to the DOM and the audit recomputes against.
 */
export function applyPipeline(rows: Row[], config: DataTableConfig): PipelineResult {
  const order = config.order ?? DEFAULT_ORDER;
  let working = rows.slice();

  for (const stage of order) {
    if (stage === 'filter' && config.filter) {
      const { match, predicates } = config.filter;
      if (predicates.length > 0) {
        working = working.filter((row) =>
          match === 'all' ? predicates.every((p) => p.test(row)) : predicates.some((p) => p.test(row)),
        );
      }
    } else if (stage === 'sort' && config.sort && config.sort.by.length > 0) {
      const keys = config.sort.keys === 'single' ? config.sort.by.slice(0, 1) : config.sort.by;
      const collators = keys.map(collatorFor);
      // Array.prototype.sort is stable since ES2019.
      working.sort((a, b) => {
        for (let i = 0; i < keys.length; i++) {
          const c = compareByKey(a, b, keys[i], collators[i]);
          if (c !== 0) return c;
        }
        return 0;
      });
    }
    // group is materialized below, after the linear stages; page is delegated.
  }

  if (config.group) {
    const { field, summary, summaryField } = config.group;
    const order2: string[] = [];
    const buckets = new Map<string, Row[]>();
    for (const row of working) {
      const key = String(row[field] ?? '');
      if (!buckets.has(key)) {
        buckets.set(key, []);
        order2.push(key);
      }
      buckets.get(key)!.push(row);
    }
    return {
      groups: order2.map((key) => {
        const groupRows = buckets.get(key)!;
        return { key, rows: groupRows, summary: { fn: summary, value: aggregate(groupRows, summary, summaryField) } };
      }),
    };
  }

  return { groups: [{ key: null, rows: working }] };
}

/** Format a group summary cell: "Engineering — count: 3" / "… — average: 42.5". */
export function summaryText(groupKey: string, fn: GroupSummaryFn, value: number): string {
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${groupKey} — ${fn}: ${v}`;
}

// ── Interactive axis — the sort-toggle cycle + live announcement (pure, shared by demo & CI) ──
//
// The static projection above is verified; this is the *live wiring* (backlog #115). It stays here,
// next to the renderer/audit, so the demo's clickable card and the conformance suite drive the EXACT
// same logic — the anti-drift rule the static contract already follows. The DOM event listeners that
// call these live in the demo (or an app); these functions are framework-free and side-effect-free.

/** A sortable header's three observable states — the two `aria-sort` directions plus unsorted. */
export type SortState = SortDirection | 'none';

/** The APG header-click cycle: none → ascending → descending → none. */
export function nextSortState(current: SortState): SortState {
  return current === 'none' ? 'ascending' : current === 'ascending' ? 'descending' : 'none';
}

/** A field's current sort state per the config's primary key (only one header sorts at a time). */
export function sortStateOf(config: DataTableConfig, field: string): SortState {
  const primary = config.sort?.by?.[0];
  return primary && primary.field === field ? primary.direction : 'none';
}

/**
 * Return a NEW config reflecting a click on `field`'s header — the interactive (single-key) sort.
 * Advances that field through nextSortState; landing on 'none' clears the sort. Everything else
 * (columns, filter, group, order, caption) is preserved; the config is not mutated in place.
 */
export function applySortClick(config: DataTableConfig, field: string): DataTableConfig {
  const next = nextSortState(sortStateOf(config, field));
  const { sort: _drop, ...rest } = config;
  if (next === 'none') return rest;
  return { ...rest, sort: { keys: 'single', by: [{ field, direction: next }] } };
}

/**
 * The screen-reader text announced after an interaction re-runs the pipeline — what a user hears on
 * sortchange / filterchange / groupchange. Composed of `clause; clause; ….` so it reads as one terse
 * status: the sort state, the visible-vs-total count (narrowed when filtered), and the group count.
 *
 * This is the Data Table analogue of pagination's "page 2 of 10" (backlog #059): both want ONE polite
 * live region carrying a clause-joined status string, so they share this shape rather than inventing
 * two. The reusable seam is the pattern (region + clause string), not this exact wording.
 */
export function announce(rows: Row[], config: DataTableConfig): string {
  const result = applyPipeline(rows, config);
  const shown = result.groups.reduce((n, g) => n + g.rows.length, 0);
  const total = rows.length;
  const clauses: string[] = [];

  const primary = config.sort?.by?.[0];
  if (primary) {
    const label = config.columns.find((c) => c.field === primary.field)?.label ?? primary.field;
    clauses.push(`Sorted by ${label}, ${primary.direction}`);
  } else {
    clauses.push('Not sorted');
  }

  clauses.push(shown < total ? `${shown} of ${total} shown` : `${shown} ${shown === 1 ? 'row' : 'rows'}`);

  if (config.group) {
    const n = result.groups.length;
    clauses.push(`${n} ${n === 1 ? 'group' : 'groups'}`);
  }

  return clauses.join('; ') + '.';
}

function th(column: Column, sort: DataTableConfig['sort']): HTMLTableCellElement {
  const cell = document.createElement('th');
  cell.setAttribute('scope', 'col');
  if (column.sortable) {
    // APG Sortable Table: a button inside the header toggles sort; aria-sort holds the state.
    const primary = sort?.by?.[0];
    const isActive = !!primary && primary.field === column.field;
    cell.setAttribute('aria-sort', isActive ? primary!.direction : 'none');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('data-action', 'sort');
    button.setAttribute('data-field', column.field);
    button.textContent = column.label;
    cell.append(button);
  } else {
    cell.textContent = column.label;
  }
  return cell;
}

function dataRow(row: Row, columns: Column[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const col of columns) {
    const td = document.createElement('td');
    td.textContent = String(row[col.field] ?? '');
    tr.append(td);
  }
  return tr;
}

/**
 * Render the data table for a row set + contract. Returns a single <table> root:
 *   <table data-order> <caption?> <thead><tr><th scope=col [aria-sort] [button]></tr></thead>
 *     <tbody> [group summary <tr>?] <tr><td>…</tr>* </tbody>*  </table>
 */
export function renderDataTable(rows: Row[], config: DataTableConfig): HTMLTableElement {
  const result = applyPipeline(rows, config);
  const table = document.createElement('table');
  table.className = 'data-table';
  table.setAttribute('data-order', (config.order ?? DEFAULT_ORDER).join('>'));
  if (config.filter) table.setAttribute('data-filter-match', config.filter.match);

  if (config.caption) {
    const caption = document.createElement('caption');
    caption.textContent = config.caption;
    table.append(caption);
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const col of config.columns) headRow.append(th(col, config.sort));
  thead.append(headRow);
  table.append(thead);

  const colCount = config.columns.length;
  for (const group of result.groups) {
    const tbody = document.createElement('tbody');
    if (group.key != null && group.summary) {
      tbody.setAttribute('data-group', group.key);
      const summaryRow = document.createElement('tr');
      summaryRow.className = 'group-row';
      const header = document.createElement('th');
      header.setAttribute('scope', 'rowgroup');
      header.setAttribute('colspan', String(colCount));
      header.textContent = summaryText(group.key, group.summary.fn, group.summary.value);
      summaryRow.append(header);
      tbody.append(summaryRow);
    }
    for (const row of group.rows) tbody.append(dataRow(row, config.columns));
    table.append(tbody);
  }

  return table;
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
 * Audit a rendered data-table root against the verified APG / Intl.Collator / SQL-aggregate
 * contract for its config. Recomputes the expected pipeline result and asserts the DOM *projection*
 * (native table grounding, aria-sort state, row order, filter narrowing, group summaries) reflects
 * it — so a bug in the projection turns this red.
 */
export function auditDataTable(root: HTMLElement, rows: Row[], config: DataTableConfig): AuditResult {
  const checks: AuditCheck[] = [];
  const add = (label: string, pass: boolean) => checks.push({ label, pass });
  const expected = applyPipeline(rows, config);

  // ── Native grounding (APG Sortable Table) ──
  add('renders a native <table>', root.tagName === 'TABLE');
  const headers = Array.from(root.querySelectorAll('thead th'));
  add('every column header is a <th scope="col">', headers.length === config.columns.length && headers.every((h) => h.getAttribute('scope') === 'col'));

  // ── Sort a11y: aria-sort state per the APG recipe ──
  const sortedCount = headers.filter((h) => {
    const s = h.getAttribute('aria-sort');
    return s != null && s !== 'none';
  }).length;
  add('exactly one header is aria-sort != none when a sort is active', sortedCount === (config.sort && config.sort.by.length ? 1 : 0));

  config.columns.forEach((col, i) => {
    const header = headers[i];
    if (!header) return;
    if (col.sortable) {
      const button = header.querySelector('button');
      add(`sortable header "${col.label}" wraps its label in a <button>`, !!button && button.textContent === col.label);
      const primary = config.sort?.by?.[0];
      const expectState = primary && primary.field === col.field ? primary.direction : 'none';
      add(`sortable header "${col.label}" has aria-sort="${expectState}"`, header.getAttribute('aria-sort') === expectState);
    } else {
      add(`non-sortable header "${col.label}" carries no aria-sort`, !header.hasAttribute('aria-sort'));
    }
  });

  // ── Row order / filter narrowing — compare the rendered data rows to the expected sequence ──
  const renderedRows = Array.from(root.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('group-row'));
  const expectedRows = expected.groups.flatMap((g) => g.rows);
  add('rendered data-row count matches the filtered/grouped result', renderedRows.length === expectedRows.length);

  const cellText = (tr: Element) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent).join('');
  const expectedText = expectedRows.map((row) => config.columns.map((c) => String(row[c.field] ?? '')).join(''));
  const orderMatches = renderedRows.length === expectedText.length && renderedRows.every((tr, i) => cellText(tr) === expectedText[i]);
  add('rendered row order matches the configured sort pipeline', orderMatches);

  // ── Group summaries ──
  if (config.group) {
    const bodies = Array.from(root.querySelectorAll('tbody[data-group]'));
    add('one <tbody> per group', bodies.length === expected.groups.length);
    const summariesOk = expected.groups.every((g) => {
      const body = root.querySelector(`tbody[data-group="${g.key}"]`);
      const summaryCell = body?.querySelector('.group-row th[scope="rowgroup"]');
      return !!summaryCell && summaryCell.textContent === summaryText(g.key!, g.summary!.fn, g.summary!.value);
    });
    add('each group renders the correct SQL-aggregate summary', summariesOk);
  }

  return { ok: checks.every((c) => c.pass), checks };
}
