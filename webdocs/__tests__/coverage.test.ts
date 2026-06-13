/**
 * Doc-coverage metric (#469). Proves coverage over a generated DocsSite: documented = a page with ≥1
 * case; the `expected` surface widens the denominator to claimed-but-undocumented ids; vacuous-complete
 * for an empty surface.
 */
import { describe, it, expect } from 'vitest';
import { computeDocCoverage } from '../coverage';
import type { DocsSite } from '../generator';

const site = (pages: DocsSite['pages']): DocsSite => ({ id: 'x', name: 'X', pages });
const page = (blockId: string, n: number): DocsSite['pages'][number] => ({
  blockId,
  cases: Array.from({ length: n }, (_, i) => ({ id: `${i}.html`, title: `c${i}`, description: '', code: '' })),
});

describe('computeDocCoverage (#469)', () => {
  it('measures the site pages by default — a page with cases is documented, an empty one is not', () => {
    const r = computeDocCoverage(site([page('button', 2), page('select', 0), page('table', 1)]));
    expect(r).toMatchObject({ total: 3, documented: 2, undocumented: ['select'], totalCases: 3 });
    expect(r.coverage).toBeCloseTo(2 / 3);
  });

  it('an expected surface widens the denominator — a claimed id with no page is undocumented', () => {
    const r = computeDocCoverage(site([page('button', 1)]), ['button', 'select', 'table']);
    expect(r).toMatchObject({ total: 3, documented: 1, undocumented: ['select', 'table'] });
    expect(r.coverage).toBeCloseTo(1 / 3);
  });

  it('totalCases counts only the measured surface', () => {
    // 'table' has 5 cases but is outside the expected surface → not counted.
    const r = computeDocCoverage(site([page('button', 2), page('table', 5)]), ['button']);
    expect(r.totalCases).toBe(2);
    expect(r.documented).toBe(1);
  });

  it('full coverage reports coverage 1 with no gaps', () => {
    const r = computeDocCoverage(site([page('button', 1), page('select', 3)]));
    expect(r.coverage).toBe(1);
    expect(r.undocumented).toEqual([]);
  });

  it('an empty surface is vacuously complete (coverage 1, no divide-by-zero)', () => {
    expect(computeDocCoverage(site([]))).toMatchObject({ total: 0, documented: 0, coverage: 1, undocumented: [] });
  });

  it('undocumented ids are sorted for stable output', () => {
    const r = computeDocCoverage(site([]), ['zeta', 'alpha', 'mu']);
    expect(r.undocumented).toEqual(['alpha', 'mu', 'zeta']);
  });
});
