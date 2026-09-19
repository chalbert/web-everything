/**
 * @file scripts/readiness/__tests__/couple-plan.test.mjs
 * @description Unit proof of the cross-locus couple CI-concurrency planner (#2684): the overlap-open order +
 *   WE stack-base decision, and the GUARDED skip-vs-rebase verdict for the WE half's post-impl-land re-CI.
 *   Every case is driven by INJECTED shas — the module touches no git — so the guard's fail-safe direction
 *   (skip only on positive proof of a clean fast-forward; rebase otherwise) is provable here.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  isSha, normSha, planCoupleOpen, decideWeReCi,
} from '../couple-plan.mjs';

// 40-hex shas (distinct) for the injected scenarios.
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const SHORT = 'abc1234'; // 7-hex — the shortest accepted object hash

describe('sha helpers', () => {
  it('accepts 7–64 hex, case-insensitively, and normalizes', () => {
    expect(isSha(A)).toBe(true);
    expect(isSha(SHORT)).toBe(true);
    expect(isSha('ABC1234')).toBe(true);
    expect(normSha('  ABC1234  ')).toBe('abc1234');
  });
  it('rejects non-hex, too-short, too-long, and non-strings', () => {
    expect(isSha('xyz1234')).toBe(false);   // non-hex
    expect(isSha('abc123')).toBe(false);    // 6 chars — too short
    expect(isSha('a'.repeat(65))).toBe(false); // 65 — too long
    expect(isSha('')).toBe(false);
    expect(isSha(undefined)).toBe(false);
    expect(isSha(123)).toBe(false);
    expect(normSha(123)).toBe('');
    expect(normSha(null)).toBe('');
  });
});

describe('planCoupleOpen — overlap-open order + WE stack-base', () => {
  it('stacks the WE half on the impl tip for a cross-locus couple (impl-first open)', () => {
    const p = planCoupleOpen({ implRepo: 'frontierui', implRef: 'lane/2684-fui', weRef: 'lane/2684-we', implTipSha: A });
    expect(p.weStacked).toBe(true);
    expect(p.stackBase).toBe(A);
    expect(p.concurrent).toBe(true); // both PRs open before either lands
    expect(p.openOrder.map((o) => o.role)).toEqual(['impl', 'we']); // impl-first / WE-last
    expect(p.openOrder[0]).toMatchObject({ repo: 'frontierui', ref: 'lane/2684-fui', role: 'impl' });
    expect(p.openOrder[1]).toMatchObject({ repo: 'we', ref: 'lane/2684-we', role: 'we' });
  });

  it('normalizes the injected impl tip sha into the stack base', () => {
    expect(planCoupleOpen({ implRepo: 'plateau-app', implTipSha: `  ${A.toUpperCase()} ` }).stackBase).toBe(A);
  });

  it('does NOT stack a single-locus item (impl repo == WE repo)', () => {
    const p = planCoupleOpen({ implRepo: 'we', weRepo: 'we', implTipSha: A });
    expect(p.weStacked).toBe(false);
    expect(p.stackBase).toBeNull();
    expect(p.reason).toMatch(/not a cross-locus couple/i);
  });

  it('FAIL-SAFE: no/invalid impl tip sha → WE opens off main (no stacking)', () => {
    for (const bad of [undefined, '', 'not-a-sha', 'abc123' /* too short */]) {
      const p = planCoupleOpen({ implRepo: 'frontierui', implTipSha: bad });
      expect(p.weStacked).toBe(false);
      expect(p.stackBase).toBeNull();
      expect(p.concurrent).toBe(true);
      expect(p.reason).toMatch(/no pinned impl tip sha/i);
    }
  });
});

describe('decideWeReCi — guarded skip-vs-rebase', () => {
  it.each([
    [A.slice(0, 7), A, A],
    [A, A.slice(0, 7), A],
    [A, A, A.slice(0, 7)],
    [A.slice(0, 7), A.slice(0, 12), A],
    ['A'.repeat(64), '  AAAAAAA  ', 'a'.repeat(32)],
  ])('accepts compatible abbreviations: base=%s landed=%s main=%s', (stackedBaseSha, landedImplSha, mainTipSha) => {
    const v = decideWeReCi({ stackedBaseSha, landedImplSha, mainTipSha });
    expect(v.verdict).toBe('ff-skip');
    expect(v.skipReCi).toBe(true);
    expect(v.reason).not.toMatch(/squash-merge|re-stack|advanced past/i);
  });

  it('does not let an abbreviated landed sha hide conflicting base and main suffixes', () => {
    const v = decideWeReCi({ stackedBaseSha: A, landedImplSha: A.slice(0, 7), mainTipSha: `${A.slice(0, 7)}${B.slice(7)}` });
    expect(v.verdict).toBe('rebase');
    expect(v.reason).toMatch(/advanced past/i);
  });

  it.each(['', 'a'.repeat(6), 'a'.repeat(65), 'aaaaaag', null, 1234567])('rejects invalid hashes even when other inputs share their prefix: %s', (bad) => {
    for (const key of ['stackedBaseSha', 'landedImplSha', 'mainTipSha']) {
      expect(decideWeReCi({ stackedBaseSha: A, landedImplSha: A, mainTipSha: A, [key]: bad }).verdict).toBe('rebase');
    }
  });

  it('prints ff-skip through the CLI for an abbreviated stacked base', () => {
    const output = execFileSync(process.execPath, [
      resolve('scripts/readiness/couple-plan.mjs'),
      `--stacked-base=${A.slice(0, 7)}`, `--landed-impl=${A}`, `--main-tip=${A}`,
    ], { encoding: 'utf8' });
    expect(JSON.parse(output)).toMatchObject({ verdict: 'ff-skip', skipReCi: true });
  });

  it('FF-SKIP only on a provable clean fast-forward: landed impl == stacked base == main', () => {
    const v = decideWeReCi({ stackedBaseSha: A, landedImplSha: A, mainTipSha: A });
    expect(v.verdict).toBe('ff-skip');
    expect(v.skipReCi).toBe(true);
    expect(v.reason).toMatch(/clean fast-forward/i);
  });

  it('is case/whitespace-insensitive on the FF match', () => {
    const v = decideWeReCi({ stackedBaseSha: `  ${A.toUpperCase()} `, landedImplSha: A, mainTipSha: A });
    expect(v.verdict).toBe('ff-skip');
  });

  it('SQUASH-merge: landed impl sha ≠ stacked base → rebase', () => {
    const v = decideWeReCi({ stackedBaseSha: A, landedImplSha: B, mainTipSha: B });
    expect(v.verdict).toBe('rebase');
    expect(v.skipReCi).toBe(false);
    expect(v.reason).toMatch(/squash-merge or review:changes/i);
  });

  it('review:changes re-stack (base superseded) is the same landed≠base fallback', () => {
    // impl bounced and re-stacked → the WE half stacked on the OLD tip (A); impl landed as the new tip (C).
    const v = decideWeReCi({ stackedBaseSha: A, landedImplSha: C, mainTipSha: C });
    expect(v.verdict).toBe('rebase');
  });

  it('main advanced past the impl land (another couple landed between) → rebase', () => {
    const v = decideWeReCi({ stackedBaseSha: A, landedImplSha: A, mainTipSha: B });
    expect(v.verdict).toBe('rebase');
    expect(v.reason).toMatch(/advanced past/i);
  });

  it('FAIL-SAFE: WE half was not stacked (no stacked-base sha) → rebase', () => {
    const v = decideWeReCi({ stackedBaseSha: undefined, landedImplSha: A, mainTipSha: A });
    expect(v.verdict).toBe('rebase');
    expect(v.reason).toMatch(/not overlap-stacked/i);
  });

  it('FAIL-SAFE: any missing/malformed sha → rebase (never skip on incomplete proof)', () => {
    expect(decideWeReCi({ stackedBaseSha: A, landedImplSha: '', mainTipSha: A }).verdict).toBe('rebase');
    expect(decideWeReCi({ stackedBaseSha: A, landedImplSha: A, mainTipSha: 'nope' }).verdict).toBe('rebase');
    expect(decideWeReCi({}).verdict).toBe('rebase');
    expect(decideWeReCi().verdict).toBe('rebase');
  });
});
