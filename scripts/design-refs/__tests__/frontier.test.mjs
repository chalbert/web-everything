// Tests for the scheduled frontier re-benchmark harness (backlog #515, epic #490, #488 F5): the recurring
// layer over the #512 benchmark that records whether a newly-benchmarked candidate beats the bundled
// on-device default + the #192 freshness signal. Pure decision functions, fixture-tested — no model.

import { describe, it, expect } from 'vitest';
import {
  summarizeResult,
  beatsBundled,
  isOverdue,
  foldRun,
  formatStatus,
} from '../frontier.mjs';

const graduating = {
  agreement: { fraction: 0.97 },
  quarantineRecall: { overall: { fraction: 0.99 } },
  graduation: { pass: true },
};
const failing = {
  agreement: { fraction: 0.9 },
  quarantineRecall: { overall: { fraction: 0.99 } },
  graduation: { pass: false },
};

describe('summarizeResult', () => {
  it('reduces a benchmark result to the stored metric tuple', () => {
    expect(summarizeResult(graduating)).toEqual({
      verdictAgreement: 0.97,
      quarantineRecall: 0.99,
      graduated: true,
    });
    expect(summarizeResult({})).toEqual({ verdictAgreement: null, quarantineRecall: null, graduated: false });
  });
});

describe('beatsBundled', () => {
  const champ = { verdictAgreement: 0.95, quarantineRecall: 0.98, graduated: true };

  it('promotes the first graduating candidate when there is no champion', () => {
    const v = beatsBundled(summarizeResult(graduating), null);
    expect(v.beats).toBe(true);
    expect(v.reason).toMatch(/no bundled default/);
  });

  it('never promotes a non-graduating candidate', () => {
    expect(beatsBundled(summarizeResult(failing), null).beats).toBe(false);
    expect(beatsBundled(summarizeResult(failing), champ).beats).toBe(false);
  });

  it('promotes only on a verdict-agreement improvement that keeps quarantine-recall', () => {
    const better = { verdictAgreement: 0.97, quarantineRecall: 0.99, graduated: true };
    expect(beatsBundled(better, champ).beats).toBe(true);
    const sameAgreement = { verdictAgreement: 0.95, quarantineRecall: 0.99, graduated: true };
    expect(beatsBundled(sameAgreement, champ).beats).toBe(false);
  });

  it('refuses a candidate that regresses the asymmetric quarantine-recall floor', () => {
    const riskier = { verdictAgreement: 0.99, quarantineRecall: 0.97, graduated: true };
    const v = beatsBundled(riskier, champ);
    expect(v.beats).toBe(false);
    expect(v.reason).toMatch(/quarantine-recall/);
    expect(v.deltas.quarantineRecall).toBeCloseTo(-0.01);
  });
});

describe('isOverdue', () => {
  const now = Date.parse('2026-06-14T00:00:00.000Z');
  it('is overdue when never benchmarked or past the cadence horizon', () => {
    expect(isOverdue(null, 30, now)).toBe(true);
    expect(isOverdue('2026-04-01T00:00:00.000Z', 30, now)).toBe(true); // >30d ago
    expect(isOverdue('2026-06-01T00:00:00.000Z', 30, now)).toBe(false); // within 30d
    expect(isOverdue('not-a-date', 30, now)).toBe(true);
  });
});

describe('foldRun', () => {
  const nowIso = '2026-06-14T00:00:00.000Z';
  it('appends history, promotes a winning champion, and stamps lastBenchmarked', () => {
    const start = { cadenceDays: 30, lastBenchmarked: null, champion: null, runs: [] };
    const next = foldRun(start, { candidate: 'student-v1', result: graduating }, nowIso);
    expect(next.runs).toHaveLength(1);
    expect(next.lastBenchmarked).toBe(nowIso);
    expect(next.champion).toEqual({ id: 'student-v1', verdictAgreement: 0.97, quarantineRecall: 0.99 });
    expect(next.runs[0].beatsBundled).toBe(true);

    // A later, non-improving run is recorded but does NOT displace the champion (history preserved).
    const flat = foldRun(next, { candidate: 'student-v2', result: graduating }, '2026-07-01T00:00:00.000Z');
    expect(flat.runs).toHaveLength(2);
    expect(flat.champion.id).toBe('student-v1');
    expect(flat.runs[1].beatsBundled).toBe(false);
  });
});

describe('formatStatus', () => {
  it('flags overdue and reports the champion', () => {
    const now = Date.parse('2026-06-14T00:00:00.000Z');
    const overdue = formatStatus({ runs: [], lastBenchmarked: null, cadenceDays: 30 }, now);
    expect(overdue).toMatch(/OVERDUE/);
    expect(overdue).toMatch(/none \(API bridge is the default\)/);
  });
});
