/**
 * @file review-core.test.mjs — proof of the #2325 shared review-verdict core: the canonical `Finding` shape
 *   normalization, the `{findings, verdict}` derivation (humanRequired always wins; outstanding findings vs
 *   resolved-by-outcome), and the mandate-text builder every "read a diff, judge it" caller renders from.
 */
import { describe, it, expect } from 'vitest';
import {
  VERDICTS,
  DEFAULT_MANDATE,
  normalizeFinding,
  normalizeFindings,
  deriveVerdict,
  buildMandate,
} from '../review-core.mjs';

describe('normalizeFinding', () => {
  it('accepts a well-formed raw finding, coercing types', () => {
    const f = normalizeFinding({ file: 'a.mjs', summary: ' off-by-one ', line: '12', verdict: 'CONFIRMED' });
    expect(f).toEqual({ file: 'a.mjs', summary: 'off-by-one', line: 12, verdict: 'CONFIRMED' });
  });

  it('accepts the legacy `finding` field as summary (dismissal-record shape)', () => {
    expect(normalizeFinding({ finding: 'stale cache read' })).toEqual({ summary: 'stale cache read' });
  });

  it('drops an invalid verdict/outcome tag rather than passing it through', () => {
    const f = normalizeFinding({ summary: 'x', verdict: 'bogus', outcome: 'also-bogus' });
    expect(f).toEqual({ summary: 'x' });
  });

  it('returns null for non-objects and objects with no usable summary', () => {
    expect(normalizeFinding(null)).toBeNull();
    expect(normalizeFinding('a string')).toBeNull();
    expect(normalizeFinding({ file: 'a.mjs' })).toBeNull();
    expect(normalizeFinding({ summary: '   ' })).toBeNull();
  });
});

describe('normalizeFindings', () => {
  it('maps a mixed list, dropping anything unusable, never throwing', () => {
    const out = normalizeFindings([{ summary: 'a' }, null, 'garbage', { summary: 'b', line: 3 }, {}]);
    expect(out).toEqual([{ summary: 'a' }, { summary: 'b', line: 3 }]);
  });

  it('degrades a non-array to an empty list', () => {
    expect(normalizeFindings(undefined)).toEqual([]);
    expect(normalizeFindings({ not: 'an array' })).toEqual([]);
  });
});

describe('deriveVerdict', () => {
  it('accepts a clean diff — no findings', () => {
    expect(deriveVerdict({ findings: [] })).toBe(VERDICTS.ACCEPT);
    expect(deriveVerdict()).toBe(VERDICTS.ACCEPT);
  });

  it('needs changes when a fresh (no-outcome) finding is present — first-pass review', () => {
    expect(deriveVerdict({ findings: [{ summary: 'bug' }] })).toBe(VERDICTS.CHANGES);
  });

  it('accepts once every finding is resolved by outcome (fixed / no_change_needed)', () => {
    const findings = [
      { summary: 'a', outcome: 'fixed' },
      { summary: 'b', outcome: 'no_change_needed' },
    ];
    expect(deriveVerdict({ findings })).toBe(VERDICTS.ACCEPT);
  });

  it('a SKIPPED finding stays outstanding — still changes', () => {
    const findings = [{ summary: 'a', outcome: 'fixed' }, { summary: 'b', outcome: 'skipped' }];
    expect(deriveVerdict({ findings })).toBe(VERDICTS.CHANGES);
  });

  it('humanRequired ALWAYS wins, even over an empty findings list', () => {
    expect(deriveVerdict({ findings: [], humanRequired: true })).toBe(VERDICTS.NEEDS_HUMAN);
    expect(deriveVerdict({ findings: [{ summary: 'a', outcome: 'fixed' }], humanRequired: true }))
      .toBe(VERDICTS.NEEDS_HUMAN);
  });
});

describe('buildMandate', () => {
  it('defaults to the correctness mandate + diff-only isolation', () => {
    const text = buildMandate();
    expect(text).toContain(DEFAULT_MANDATE);
    expect(text).toContain('ONLY the diff');
    expect(text).toMatch(/Judge only/);
  });

  it('forbids checking out the PR branch in the shared tree (#2336)', () => {
    // The seed runs inside the drain's shared primary checkout; it must never move HEAD onto the PR branch.
    const text = buildMandate();
    expect(text).toMatch(/do NOT `git checkout`/);
    expect(text).toMatch(/throwaway `git clone`/);
  });

  it('joins a multi-mandate array (the #2285 v3 reviewer-panel shape)', () => {
    const text = buildMandate({ mandate: ['correctness', 'security', 'simplicity'] });
    expect(text).toContain('correctness, security, simplicity');
  });

  it('renders a custom contextIsolation label instead of the diff-only default', () => {
    const text = buildMandate({ contextIsolation: 'diff+pr-description' });
    expect(text).toContain('Context isolation: diff+pr-description');
    expect(text).not.toContain('ONLY the diff');
  });
});
