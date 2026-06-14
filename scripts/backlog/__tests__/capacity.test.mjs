// Tests for the points-budget capacity estimator (backlog #553): the context-weighted window mean and
// the stop-reason exclusion. Capacity-bound stops (budget/context) train the estimate; work-bound stops
// (empty-pool/fork/gate/manual) are recorded for audit but excluded, so an early non-budget cutoff can't
// drag the budget. Pure functions — no CLI/argv/file I/O.

import { describe, it, expect } from 'vitest';
import { trainsEstimate, capacityFromSamples, NON_TRAINING_STOPS, TRAINING_STOPS } from '../capacity.mjs';

describe('trainsEstimate', () => {
  it('capacity-bound stops train', () => {
    for (const r of TRAINING_STOPS) expect(trainsEstimate(r)).toBe(true);
  });
  it('work-bound stops do not train', () => {
    for (const r of NON_TRAINING_STOPS) expect(trainsEstimate(r)).toBe(false);
  });
  it('absent / unknown reason trains (fail-open, backward compatible)', () => {
    expect(trainsEstimate(undefined)).toBe(true);
    expect(trainsEstimate('')).toBe(true);
    expect(trainsEstimate('some-future-reason')).toBe(true);
  });
});

describe('capacityFromSamples', () => {
  it('is a context-weighted mean — high-context readings dominate', () => {
    // 100@10% and 200@90% → (100*10 + 200*90) / (10+90) = 19000/100 = 190.
    expect(capacityFromSamples([
      { impliedCapacity: 100, contextPct: 10 },
      { impliedCapacity: 200, contextPct: 90 },
    ])).toBe(190);
  });

  it('ignores excluded (work-bound) samples entirely', () => {
    // The excluded 40@50 must not pull the mean down off the single 120@30 training sample.
    expect(capacityFromSamples([
      { impliedCapacity: 120, contextPct: 30 },
      { impliedCapacity: 40, contextPct: 50, excluded: true },
    ])).toBe(120);
  });

  it('returns null when no training sample carries weight (caller falls back to prev)', () => {
    expect(capacityFromSamples([{ impliedCapacity: 99, contextPct: 30, excluded: true }])).toBeNull();
    expect(capacityFromSamples([{ impliedCapacity: 99, contextPct: 0 }])).toBeNull();
    expect(capacityFromSamples([])).toBeNull();
    expect(capacityFromSamples(undefined)).toBeNull();
  });

  it('converges toward the true value as consistent samples accumulate (unlike a fixed-α EMA)', () => {
    const at = (n) => capacityFromSamples(Array.from({ length: n }, () => ({ impliedCapacity: 100, contextPct: 30 })));
    expect(at(1)).toBe(100);
    expect(at(12)).toBe(100); // a true mean of identical readings is exact at any n — no permanent EMA lag
  });
});
