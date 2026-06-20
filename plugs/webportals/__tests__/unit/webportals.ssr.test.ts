/**
 * Unit tests for the Web Portals SSR-contract conformance kit (backlog #1151, slice of #1001). Proves the
 * WE-owned vectors are internally consistent and the reference relocate oracle is deterministic — so an
 * external server/hydration impl can be graded against the same frozen expectation. Web Portals ships NO
 * SSR runtime; this exercises the contract's vectors + oracle, not a server.
 */
import { describe, it, expect } from 'vitest';
import {
  SSR_PORTAL_VECTORS,
  checkVector,
  relocatePortals,
  extractPortalBlocks,
  validateEmit,
  normalizeMarkup,
} from '../../conformance/ssrVectors';

describe('SSR-contract vectors — every canonical vector conforms', () => {
  for (const vector of SSR_PORTAL_VECTORS) {
    it(`"${vector.name}" passes every clause`, () => {
      const verdict = checkVector(vector);
      const failed = verdict.checks.filter((c) => !c.ok);
      expect(failed, failed.map((c) => `${c.clause}: ${c.detail}`).join(' | ')).toEqual([]);
      expect(verdict.ok).toBe(true);
      expect(verdict.label).toBe('ssr-contract');
    });
  }
});

describe('relocatePortals — the reference hydration relocate', () => {
  it('moves logical-position content into the empty target container', () => {
    const emit =
      '<main><!--portal:t--><p data-portal="t">x</p><!--/portal:t--></main>' +
      '<aside><div data-portal-target="t"></div></aside>';
    expect(normalizeMarkup(relocatePortals(emit))).toBe(
      normalizeMarkup('<main></main><aside><div data-portal-target="t"><p data-portal="t">x</p></div></aside>'),
    );
  });

  it('orders multiple portals to one target by logical source order (clause 4)', () => {
    const emit =
      '<!--portal:t--><i data-portal="t">1</i><!--/portal:t-->' +
      '<!--portal:t--><i data-portal="t">2</i><!--/portal:t-->' +
      '<div data-portal-target="t"></div>';
    const blocks = extractPortalBlocks(emit);
    expect(blocks.map((b) => b.inner)).toEqual(['<i data-portal="t">1</i>', '<i data-portal="t">2</i>']);
    expect(normalizeMarkup(relocatePortals(emit))).toBe(
      normalizeMarkup('<div data-portal-target="t"><i data-portal="t">1</i><i data-portal="t">2</i></div>'),
    );
  });

  it('is idempotent — a second relocate is a no-op (no blocks remain)', () => {
    const once = relocatePortals(SSR_PORTAL_VECTORS[0].emit);
    expect(relocatePortals(once)).toBe(once);
  });

  it('is deterministic — same emit always relocates to byte-identical markup (#463)', () => {
    const { emit } = SSR_PORTAL_VECTORS[2];
    expect(relocatePortals(emit)).toBe(relocatePortals(emit));
  });
});

describe('validateEmit — structural invariants (clauses 1+2)', () => {
  it('flags a missing empty target container', () => {
    const emit = '<!--portal:t--><p data-portal="t">x</p><!--/portal:t-->';
    const { ok, problems } = validateEmit(emit);
    expect(ok).toBe(false);
    expect(problems.join(' ')).toMatch(/no EMPTY data-portal-target/);
  });

  it('flags content whose root lacks the data-portal attribute', () => {
    const emit = '<!--portal:t--><p>x</p><!--/portal:t--><div data-portal-target="t"></div>';
    const { ok, problems } = validateEmit(emit);
    expect(ok).toBe(false);
    expect(problems.join(' ')).toMatch(/no content root carrying data-portal/);
  });

  it('accepts a well-formed single-portal emit', () => {
    expect(validateEmit(SSR_PORTAL_VECTORS[0].emit).ok).toBe(true);
  });
});
