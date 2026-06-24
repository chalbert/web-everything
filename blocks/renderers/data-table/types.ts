/**
 * Data Table block — the contract **types** (the WE-resident half of the #1467/#899 split).
 *
 * The runnable reference backend (`renderDataTable` + the filter/sort/group pipeline) and the verifier
 * (`auditDataTable` + golden-projection) were re-homed to Frontier UI / Plateau (#1355/#1531/#1660):
 * impl → FUI (`@frontierui/blocks/renderers/data-table`), conformance run → Plateau
 * (`plateau:src/conformance-engine/renderer-audit/`). WE keeps only the CONTRACT — these types + the
 * vector corpus (`__fixtures__/data-table-cases.ts`) + the committed goldens
 * (`__fixtures__/data-table-goldens.json`, schema-checked by `../golden-schema.ts`). See
 * `docs/agent/platform-decisions.md#constellation-placement`.
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
  /**
   * Optional **display** formatter for the cell (#368). Sorting/filtering/grouping always run on the
   * raw `field` value (so `Intl.Collator` natural order is unaffected) — `format` only changes what is
   * *rendered*. Return a `string` for text (currency/date via `Intl.NumberFormat`/`Intl.DateTimeFormat`,
   * native-first) — it is set as `textContent`, never `innerHTML`, so it is escape-safe — or return a
   * `Node` for a rich cell (a status chip from the status-indicator standard #354, a link). Presentation
   * only: it must not affect `aria-sort` or row order.
   */
  format?: (value: Cell, row: Row) => string | Node;
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
