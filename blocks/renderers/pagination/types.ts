/**
 * Pagination block — the contract **types** (the WE-resident half of the #1467/#899 split).
 *
 * The runnable reference backend (`renderPagination` + `rangeText`/`announcePagination`) and the verifier
 * (`auditPagination` + golden-projection) were re-homed to Frontier UI / Plateau (#1531/#1660): impl → FUI
 * (`@frontierui/blocks/renderers/pagination`), conformance run → Plateau
 * (`plateau:src/conformance-engine/renderer-audit/auditPagination.ts`). WE keeps only the CONTRACT —
 * these types + the vector corpus (`__fixtures__/pagination-cases.ts`) + the committed goldens
 * (`__fixtures__/pagination-goldens.json`, schema-checked by `../golden-schema.ts`). See
 * `docs/agent/platform-decisions.md#constellation-placement`.
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

