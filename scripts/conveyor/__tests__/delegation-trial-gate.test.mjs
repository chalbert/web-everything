import { describe, it, expect } from 'vitest';
import { isDelegationTripleGraduated } from '../delegation-trial-gate.mjs';

const triple = { provider: 'codex', model: 'gpt-6-astra', taskType: 'bugfix' };
const row = (day, extra = {}) => ({
  ...triple, dispatchKind: 'session-delegation', verifiedBy: 'independent-claude',
  outcome: 'landed', findings: null, scoredAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`, ...extra,
});
const informative = row(1, { findings: 'Review caught a quoting error' });
const clean = () => [2, 3, 4, 5, 6].map((day) => row(day));
const graduated = (records) => isDelegationTripleGraduated(triple, { records });

describe('session-delegation graduation (#3690)', () => {
  it('requires rows for this exact triple and dispatch kind', () => {
    expect(graduated([])).toBe(false);
    expect(isDelegationTripleGraduated(triple)).toBe(false);
    for (const field of ['provider', 'model', 'taskType', 'dispatchKind']) {
      expect(graduated([informative, ...clean()].map((r) => ({ ...r, [field]: 'other' })))).toBe(false);
    }
  });
  it('requires an earlier informative trial, not just five clean trials', () => {
    expect(graduated(clean())).toBe(false);
    expect(graduated([row(1, { findings: '  ' }), ...clean()])).toBe(false);
  });
  it('graduates with an informative trial and five trailing clean verified rows in time order', () => {
    expect(graduated([informative, ...clean()].reverse())).toBe(true);
    expect(graduated([informative, ...clean().map((r) => ({ ...r, verifiedBy: 'claude-subagent', findings: undefined }))])).toBe(true);
  });
  it('excludes other verifiers: neither breaking nor contributing to the streak or informative history', () => {
    const other = row(4, { verifiedBy: 'other', findings: 'Smoke finding', outcome: 'rejected' });
    expect(graduated([informative, ...clean(), other])).toBe(true);
    expect(graduated([informative, ...clean()])).toBe(true);
    expect(graduated([informative, ...clean().slice(1), { ...other, findings: null, outcome: 'landed' }])).toBe(false);
    expect(graduated([{ ...informative, verifiedBy: 'other' }, ...clean()])).toBe(false);
  });
  it('resets on the latest finding, reworked/rejected outcome, or non-null empty findings', () => {
    for (const extra of [{ findings: 'New finding' }, { outcome: 'reworked' }, { outcome: 'rejected' }, { findings: '' }]) {
      expect(graduated([informative, ...clean(), row(7, extra)])).toBe(false);
    }
  });
  it('recomputes after new rows without mutating the store', () => {
    const records = [informative, ...clean()].reverse();
    const before = structuredClone(records);
    expect(graduated(records)).toBe(true);
    expect(records).toEqual(before);
    records.push(row(7, { findings: 'Regression' }));
    expect(graduated(records)).toBe(false);
  });
});
