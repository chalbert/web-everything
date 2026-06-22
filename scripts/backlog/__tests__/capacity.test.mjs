// Tests for the pooled affine context-cost estimator (backlog #1505). The estimate is a Deming/EIV fit
// of `context% = overhead + cost·points` over EVERY sample's raw (points, contextPct) — capacity-bound
// and work-bound alike (stop-reason is audit metadata only; the old exclusion gate is gone, since
// work-bound is the common case and discarding it starved the estimate). The budget is the largest P
// under a context ceiling minus a data-driven residual margin. Pure functions — no CLI/argv/file I/O.

import { describe, it, expect } from 'vitest';
import { fitAffineCost, budgetFromFit, impliedCapacity, isKnownStopReason, KNOWN_STOP_REASONS } from '../capacity.mjs';

describe('isKnownStopReason (the CLI fail-closed guard, #968)', () => {
  it('every recognised stop reason is known', () => {
    for (const r of ['budget', 'context', 'empty-pool', 'empty', 'fork', 'gate', 'manual', 'abort', 'outgrew'])
      expect(isKnownStopReason(r)).toBe(true);
  });
  it('a typo or un-listed token is not known (so the CLI rejects it)', () => {
    expect(isKnownStopReason('some-future-reason')).toBe(false);
    expect(isKnownStopReason('outgrwe')).toBe(false); // transposed typo of outgrew
    expect(isKnownStopReason('')).toBe(false);
  });
  it('KNOWN_STOP_REASONS holds both capacity-bound and work-bound reasons', () => {
    expect(KNOWN_STOP_REASONS.has('context')).toBe(true);
    expect(KNOWN_STOP_REASONS.has('empty-pool')).toBe(true);
  });
});

describe('fitAffineCost', () => {
  it('recovers a known affine line (overhead + cost·points), noise-free', () => {
    // y = 20 + 0.5x exactly → Deming returns the generating line.
    const samples = [10, 30, 50, 70, 90].map((x) => ({ points: x, contextPct: 20 + 0.5 * x }));
    const fit = fitAffineCost(samples);
    expect(fit.overhead).toBeCloseTo(20, 6);
    expect(fit.cost).toBeCloseTo(0.5, 6);
    expect(fit.n).toBe(5);
    expect(fit.residualStd).toBeCloseTo(0, 6);
  });

  it('uses EVERY sample regardless of stop-reason or legacy excluded/impliedCapacity fields', () => {
    // The same line, but most points are tagged work-bound + excluded (the old gate would drop them).
    const onLine = (x, extra) => ({ points: x, contextPct: 20 + 0.5 * x, ...extra });
    const fit = fitAffineCost([
      onLine(10, { stopReason: 'empty-pool', excluded: true, impliedCapacity: 999 }),
      onLine(30, { stopReason: 'fork', excluded: true }),
      onLine(50, { stopReason: 'manual', excluded: true }),
      onLine(70, { stopReason: 'empty-pool', excluded: true }),
      onLine(90, { stopReason: 'context' }),
    ]);
    expect(fit.overhead).toBeCloseTo(20, 6);
    expect(fit.cost).toBeCloseTo(0.5, 6);
    expect(fit.n).toBe(5); // all five counted, not just the one capacity-bound stop
  });

  it('returns null when underdetermined (fewer than 2 usable tuples, or no points spread)', () => {
    expect(fitAffineCost([{ points: 40, contextPct: 50 }])).toBeNull();
    expect(fitAffineCost([])).toBeNull();
    expect(fitAffineCost(undefined)).toBeNull();
    // No spread in points → slope unidentifiable.
    expect(fitAffineCost([{ points: 40, contextPct: 40 }, { points: 40, contextPct: 60 }])).toBeNull();
  });

  it('rejects a non-positive association (cost must be > 0)', () => {
    // context falls as points rise → not a coherent cost curve; reject so the caller falls back.
    expect(fitAffineCost([
      { points: 10, contextPct: 80 }, { points: 50, contextPct: 60 }, { points: 90, contextPct: 40 },
    ])).toBeNull();
  });

  it('skips malformed/non-positive tuples', () => {
    const fit = fitAffineCost([
      { points: 10, contextPct: 25 }, { points: 50, contextPct: 45 }, { points: 90, contextPct: 65 },
      { points: 0, contextPct: 30 }, { points: 40, contextPct: 0 }, { points: 'x', contextPct: 50 },
    ]);
    expect(fit.n).toBe(3);
  });
});

describe('budgetFromFit', () => {
  const fit = { overhead: 20, cost: 0.5, residualStd: 4, n: 12 };

  it('solves (ceiling − overhead − k·residualStd) / cost', () => {
    // (80 − 20 − 1·4) / 0.5 = 56 / 0.5 = 112.
    expect(budgetFromFit(fit, { ceiling: 80, k: 1 })).toBe(112);
  });

  it('a tighter fit (smaller residualStd) spends more of the ceiling', () => {
    const tight = budgetFromFit({ ...fit, residualStd: 0 }, { ceiling: 80, k: 1 });
    const noisy = budgetFromFit({ ...fit, residualStd: 20 }, { ceiling: 80, k: 1 });
    expect(tight).toBeGreaterThan(noisy);
  });

  it('returns null on a missing/degenerate fit or no headroom', () => {
    expect(budgetFromFit(null, { ceiling: 80, k: 1 })).toBeNull();
    expect(budgetFromFit({ overhead: 20, cost: 0 }, { ceiling: 80, k: 1 })).toBeNull();
    // overhead alone exceeds the ceiling → no headroom.
    expect(budgetFromFit({ overhead: 90, cost: 0.5, residualStd: 0 }, { ceiling: 80, k: 1 })).toBeNull();
  });
});

describe('impliedCapacity', () => {
  it('is points at 100% context = (100 − overhead) / cost', () => {
    expect(impliedCapacity({ overhead: 20, cost: 0.5 })).toBe(160);
  });
  it('returns null on a missing/degenerate fit', () => {
    expect(impliedCapacity(null)).toBeNull();
    expect(impliedCapacity({ overhead: 20, cost: 0 })).toBeNull();
  });
});
