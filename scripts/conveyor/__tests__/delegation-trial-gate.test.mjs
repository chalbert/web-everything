import { describe, it, expect } from 'vitest';
import { isDelegationTripleGraduated } from '../delegation-trial-gate.mjs';
import { DEFAULT_BACKDOWN_THRESHOLDS } from '../../lib/provider-routing.mjs';

const triple = { provider: 'codex', model: 'gpt-6-astra', taskType: 'bugfix' };
const row = (day, extra = {}) => ({
  ...triple, subjectClass: 'work-agent', dispatchKind: 'session-delegation', verifiedBy: 'independent-claude',
  outcome: 'landed', findings: null, informative: false,
  scoredAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`, ...extra,
});
// #3949 — informative is its OWN recorded field (rule 4; #3888), never inferred from `findings` text. This
// row is the positive control ONLY because `informative: true` is stamped, not because it carries prose.
const informative = row(1, { findings: 'Review caught a quoting error', informative: true });
const clean = () => [2, 3, 4, 5, 6].map((day) => row(day));
const graduated = (records) => isDelegationTripleGraduated(triple, { records });
const N = DEFAULT_BACKDOWN_THRESHOLDS.minCleanStreak;

describe('session-delegation graduation (#3690, re-derived via the shared predicate per #3949)', () => {
  it('requires rows for this exact triple and dispatch kind', () => {
    expect(graduated([])).toBe(false);
    expect(isDelegationTripleGraduated(triple)).toBe(false);
    for (const field of ['provider', 'model', 'taskType', 'dispatchKind']) {
      expect(graduated([informative, ...clean()].map((r) => ({ ...r, [field]: 'other' })))).toBe(false);
    }
  });

  it('requires an earlier informative trial (its own field), not just enough clean trials', () => {
    expect(graduated(clean())).toBe(false);
    // A findings STRING with no `informative: true` is never inferred as the positive control (rule 4).
    expect(graduated([row(1, { findings: 'looks like a real problem' }), ...clean()])).toBe(false);
  });

  it(`graduates with an informative trial and ${N} trailing clean verified rows in time order`, () => {
    expect(graduated([informative, ...clean()].reverse())).toBe(true);
    expect(graduated([informative, ...clean().map((r) => ({ ...r, verifiedBy: 'claude-subagent', findings: undefined }))])).toBe(true);
  });

  it('reads the shared DEFAULT_BACKDOWN_THRESHOLDS.minCleanStreak, not a private copy', () => {
    // The informative row is itself `outcome: 'landed'`, so it also counts toward the clean streak (only
    // `outcome` decides clean — see the dedicated test below); one fewer clean row here holds the TOTAL
    // (informative + short) one below the shared bar.
    const short = clean().slice(0, N - 2);
    expect(short.length).toBe(N - 2);
    expect(graduated([informative, ...short])).toBe(false);
  });

  it('a `landed` row with non-empty free-text findings still counts toward the streak — only outcome decides '
    + 'clean, matching provider-routing.mjs#isCleanRecord (the old local re-derivation reset on findings text '
    + 'alone, which is the exact defect #3949 fixes)', () => {
    const praised = row(7, { findings: 'Nice fix, one nit addressed inline' });
    expect(graduated([informative, ...clean(), praised])).toBe(true);
  });

  it('resets on a confirmed miss (reworked/rejected outcome) as the most recent verified trial', () => {
    for (const extra of [{ outcome: 'reworked' }, { outcome: 'rejected' }]) {
      expect(graduated([informative, ...clean(), row(7, extra)])).toBe(false);
    }
  });

  it('excludes other-verified rows: neither breaking nor contributing to the streak or informative history', () => {
    const other = row(4, { verifiedBy: 'other', findings: 'Smoke finding', outcome: 'rejected' });
    expect(graduated([informative, ...clean(), other])).toBe(true);
    expect(graduated([informative, ...clean()])).toBe(true);
    expect(graduated([{ ...informative, verifiedBy: 'other' }, ...clean()])).toBe(false);
  });

  it('recomputes after new rows without mutating the store', () => {
    const records = [informative, ...clean()].reverse();
    const before = structuredClone(records);
    expect(graduated(records)).toBe(true);
    expect(records).toEqual(before);
    records.push(row(7, { outcome: 'reworked' }));
    expect(graduated(records)).toBe(false);
  });

  it('keys the bar to subjectClass (#3801 Fork 3) — a role-subject row never counts toward a work-agent triple', () => {
    const roleRows = [informative, ...clean()].map((r) => ({ ...r, subjectClass: 'driver' }));
    expect(graduated(roleRows)).toBe(false);
  });

  it('ignores a mechanical-dispatch row for the same identity strings — different dispatchKind, different pool', () => {
    const mechanical = [informative, ...clean()].map((r) => ({ ...r, dispatchKind: 'fix' }));
    expect(graduated(mechanical)).toBe(false);
  });

  it('defaults subjectClass to work-agent when the caller omits it', () => {
    const { provider, model, taskType } = triple;
    expect(isDelegationTripleGraduated({ provider, model, taskType }, { records: [informative, ...clean()] })).toBe(true);
  });
});
