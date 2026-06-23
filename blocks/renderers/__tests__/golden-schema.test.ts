/**
 * Renderer golden schema (#1660, #1566 Fork 1a) — WE's data-only validation suite.
 *
 * WE keeps the declarative renderer-conformance contract (the golden corpus + its schema). This suite is
 * the "golden schema-validity + corpus completeness" check #1566 Fork 1a names: every committed golden in
 * `{data-table,pagination}/__fixtures__/*-goldens.json` must satisfy the schema, and the validator must
 * reject a malformed golden (so the Plateau verifier can trust the corpus without defensive parsing).
 */
import { describe, it, expect } from 'vitest';
import {
  GoldenSchemaError,
  assertDataTableGoldens,
  assertPaginationGoldens,
} from '../golden-schema';
import dataTableGoldens from '../data-table/__fixtures__/data-table-goldens.json';
import paginationGoldens from '../pagination/__fixtures__/pagination-goldens.json';

describe('renderer golden schema (#1660)', () => {
  it('every committed data-table golden is schema-valid', () => {
    expect(() => assertDataTableGoldens(dataTableGoldens)).not.toThrow();
    expect(dataTableGoldens.length).toBeGreaterThan(0);
  });

  it('every committed pagination golden is schema-valid', () => {
    expect(() => assertPaginationGoldens(paginationGoldens)).not.toThrow();
    expect(paginationGoldens.length).toBeGreaterThan(0);
  });

  it('rejects an empty corpus (completeness)', () => {
    expect(() => assertDataTableGoldens([])).toThrow(GoldenSchemaError);
    expect(() => assertPaginationGoldens([])).toThrow(GoldenSchemaError);
  });

  it('rejects a data-table golden whose rowCount disagrees with rows.length', () => {
    const bad = [{ id: 'x', rootTag: 'TABLE', headers: [], rows: [['a']], rowCount: 2, groups: [{ key: null, summaryText: null }] }];
    expect(() => assertDataTableGoldens(bad)).toThrow(/rowCount/);
  });

  it('rejects duplicate golden ids', () => {
    const dupe = [
      { id: 'dup', rootTag: 'DIV', mode: 'paged', advance: 'replace', hasNav: false, navLabel: null, hasSentinel: false, sentinelAriaHidden: false, current: [], gotoCount: 0, hasRelLink: false, rangeText: null },
      { id: 'dup', rootTag: 'DIV', mode: 'paged', advance: 'replace', hasNav: false, navLabel: null, hasSentinel: false, sentinelAriaHidden: false, current: [], gotoCount: 0, hasRelLink: false, rangeText: null },
    ];
    expect(() => assertPaginationGoldens(dupe)).toThrow(/duplicate golden id/);
  });

  it('rejects a pagination golden missing a boolean axis', () => {
    const bad = [{ id: 'x', rootTag: 'DIV', mode: 'paged', advance: 'replace', navLabel: null, hasSentinel: false, sentinelAriaHidden: false, current: [], gotoCount: 0, hasRelLink: false, rangeText: null }];
    expect(() => assertPaginationGoldens(bad)).toThrow(/hasNav/);
  });
});
