/**
 * Shared Data Table fixtures — the single source of the example cases for BOTH the Data Table
 * Playground demo and the conformance suite, so the demo's green badges are CI-backed (the
 * anti-drift split, mirroring the pagination / JSX / component fixtures).
 *
 * Each case pairs a row set + a Collection Operations contract (the filter / sort / group subset)
 * with the verified-contract invariant it proves. This vector corpus is the WE-resident half of the
 * #1467/#899 split: the renderer (`renderDataTable`) and the audit (`auditDataTable`) were re-homed to
 * Frontier UI / Plateau (#1355/#1660) and consume this corpus from there. The page stage is the
 * separate Pagination block — out of scope here (compose, never merge).
 */
import type { DataTableConfig, Row } from '../types';

export interface DataTableCase {
  id: string;
  title: string;
  note?: string;
  rows: Row[];
  config: DataTableConfig;
}

// A small employee corpus — enough to exercise text/numeric sort, empties, filtering, and grouping.
const PEOPLE: Row[] = [
  { name: 'Bianca', team: 'Engineering', level: 'img10', salary: 120, location: 'Berlin' },
  { name: 'andré', team: 'Design', level: 'img2', salary: 95, location: '' },
  { name: 'Aaron', team: 'Engineering', level: 'img2', salary: 110, location: 'Oslo' },
  { name: 'Chloé', team: 'Design', level: 'img10', salary: 105, location: 'Paris' },
  { name: 'Dmitri', team: 'Engineering', level: 'img2', salary: null, location: 'Berlin' },
  { name: 'Émile', team: 'Sales', level: 'img2', salary: 80, location: 'Lyon' },
];

const COLUMNS = [
  { field: 'name', label: 'Name', sortable: true },
  { field: 'team', label: 'Team', sortable: true },
  { field: 'salary', label: 'Salary (k)', sortable: true },
  { field: 'location', label: 'Location' }, // non-sortable: proves no aria-sort leaks onto it
];

export const dataTableCases: DataTableCase[] = [
  {
    id: 'sort-text-asc',
    title: '1 · Sort by name, ascending (Intl.Collator)',
    note: 'The active header projects aria-sort="ascending"; the other sortable headers are aria-sort="none"; the non-sortable Location header carries none. Locale-aware comparison via Intl.Collator (accent sensitivity), so andré/Émile sort by base letter.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending', sensitivity: 'accent' }] },
    },
  },
  {
    id: 'sort-numeric',
    title: '2 · Numeric ordering (img2 before img10)',
    note: 'numeric:true gives natural numeric order so embedded numbers compare by value — img2 sorts before img10, not lexicographically. Adopts the Intl.Collator numeric option verbatim.',
    rows: PEOPLE,
    config: {
      columns: [
        { field: 'name', label: 'Name', sortable: true },
        { field: 'level', label: 'Level', sortable: true },
      ],
      sort: { keys: 'single', by: [{ field: 'level', direction: 'ascending', numeric: true }] },
    },
  },
  {
    id: 'sort-empty-last',
    title: '3 · Descending salary, empties last (SQL NULLS LAST)',
    note: 'salary descending, but the missing salary (Dmitri) lands LAST regardless of direction — emptyPlacement mirrors SQL NULLS FIRST/LAST and is direction-independent.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      sort: { keys: 'single', by: [{ field: 'salary', direction: 'descending', emptyPlacement: 'last' }] },
    },
  },
  {
    id: 'sort-multi-key',
    title: '4 · Multi-key sort — team then salary',
    note: 'sortKeys:multiple stacks keys: rows order by team ascending, ties broken by salary descending. aria-sort still marks only the PRIMARY header (team) — APG allows one sorted header at a time.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      sort: {
        keys: 'multiple',
        by: [
          { field: 'team', direction: 'ascending' },
          { field: 'salary', direction: 'descending', emptyPlacement: 'last' },
        ],
      },
    },
  },
  {
    id: 'filter-all',
    title: '5 · Filter — match all (AND)',
    note: 'Two predicates combined with filterMatch:all — only Engineering rows with salary ≥ 110 survive. The predicates are call-site data; the intent owns only how they combine.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      filter: {
        match: 'all',
        predicates: [
          { label: 'team = Engineering', test: (r) => r.team === 'Engineering' },
          { label: 'salary ≥ 110', test: (r) => typeof r.salary === 'number' && r.salary >= 110 },
        ],
      },
      sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] },
    },
  },
  {
    id: 'filter-any',
    title: '6 · Filter — match any (OR)',
    note: 'Same two predicates combined with filterMatch:any — a row survives if it is Engineering OR earns ≥ 110. A strictly larger set than match-all.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      filter: {
        match: 'any',
        predicates: [
          { label: 'team = Engineering', test: (r) => r.team === 'Engineering' },
          { label: 'salary ≥ 110', test: (r) => typeof r.salary === 'number' && r.salary >= 110 },
        ],
      },
    },
  },
  {
    id: 'group-count',
    title: '7 · Group by team, count summary',
    note: 'Rows partition into one <tbody> per team; each group leads with a rowgroup summary row showing the count aggregate (SQL COUNT). Default pipeline order filter → sort → group → page.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] },
      group: { field: 'team', summary: 'count' },
    },
  },
  {
    id: 'group-average',
    title: '8 · Group by team, average salary',
    note: 'The group summary runs an average over salary (SQL AVG). Aggregate names follow SQL — the nearest cross-platform standard, since the web has none.',
    rows: PEOPLE,
    config: {
      columns: COLUMNS,
      group: { field: 'team', summary: 'average', summaryField: 'salary' },
    },
  },
];
