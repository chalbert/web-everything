/**
 * @file scripts/readiness/__tests__/conveyor-instrument.test.mjs
 * @description Unit proof of the CONVEYOR WALL-CLOCK INSTRUMENT's PURE core (WE #2680, epic #2612 / program
 *   #2606). Drives every `phase*` / `sumPhase` / `poolSaturation` / `classifyRegime` fn and the top-level
 *   {@link instrumentConveyor} composer directly with PLAIN OBJECTS (NO real git / gh / fs / clock — timestamps
 *   are injected ISO strings). Pins the load-bearing round-2/round-4 guards: a missing dispatch signal degrades
 *   authoring to null + `needsDispatchInstrumentation` (never a fabricated number), and an UNDECOMPOSED authoring
 *   aggregate CANNOT be classified `authoring-bound` (it returns `authoring-bound-ambiguous`) so a coarse span
 *   never fires the wrong lever.
 */
import { describe, it, expect } from 'vitest';
import {
  spanMs,
  phaseAuthoring,
  phaseLand,
  phaseBreakdown,
  poolSaturation,
  sumPhase,
  classifyRegime,
  instrumentConveyor,
  DEFAULT_POLL_INTERVAL_S,
  DEFAULT_SATURATION_THRESHOLD,
} from '../conveyor-instrument.mjs';

// A helper: minutes → ms, so fixtures read in human units.
const MIN = 60_000;
// Build an ISO stamp `m` minutes after a fixed base epoch (deterministic, no clock).
const BASE = Date.parse('2026-07-27T00:00:00.000Z');
const at = (m) => new Date(BASE + m * MIN).toISOString();

describe('spanMs — the null-tolerant span primitive', () => {
  it('returns ms between two ISO stamps', () => {
    expect(spanMs(at(0), at(5))).toBe(5 * MIN);
  });
  it('is null when either boundary is missing / unparseable', () => {
    expect(spanMs(null, at(5))).toBeNull();
    expect(spanMs(at(0), undefined)).toBeNull();
    expect(spanMs('not-a-date', at(5))).toBeNull();
  });
  it('is null (never negative) when b precedes a', () => {
    expect(spanMs(at(5), at(0))).toBeNull();
  });
});

describe('phaseAuthoring — dispatch→first-commit, honestly ambiguous without a signal', () => {
  it('null + no-dispatch-signal when there is no dispatch stamp (a PR createdAt is AFTER authoring)', () => {
    expect(phaseAuthoring({ firstCommitAt: at(10) })).toEqual({
      ms: null, decomposed: false, setup: null, authoringNet: null, reason: 'no-dispatch-signal',
    });
  });
  it('null + no-first-commit when dispatched but no commit yet', () => {
    expect(phaseAuthoring({ dispatchedAt: at(0) })).toEqual({
      ms: null, decomposed: false, setup: null, authoringNet: null, reason: 'no-first-commit',
    });
  });
  it('an UNDECOMPOSED span (no setup mark) carries the span but flags reason:undecomposed', () => {
    expect(phaseAuthoring({ dispatchedAt: at(0), firstCommitAt: at(12) })).toEqual({
      ms: 12 * MIN, decomposed: false, setup: null, authoringNet: null, reason: 'undecomposed',
    });
  });
  it('DECOMPOSES into setup + authoringNet when a setup-done mark is present', () => {
    expect(phaseAuthoring({ dispatchedAt: at(0), setupDoneAt: at(3), firstCommitAt: at(12) })).toEqual({
      ms: 12 * MIN, decomposed: true, setup: 3 * MIN, authoringNet: 9 * MIN, reason: null,
    });
  });
});

describe('phaseLand — landWait split into pollGap (≤ interval) + landSerialization (excess)', () => {
  it('a short land wait is ALL poll gap, zero serialization', () => {
    expect(phaseLand({ readyAt: at(0), mergedAt: at(0.5) }, 60)).toEqual({
      landWait: 0.5 * MIN, pollGap: 0.5 * MIN, landSerialization: 0,
    });
  });
  it('a long land wait caps pollGap at the interval and attributes the rest to serialization', () => {
    // interval 60s = 1 min; a 5-min land wait → 1 min poll + 4 min serialization.
    expect(phaseLand({ readyAt: at(0), mergedAt: at(5) }, 60)).toEqual({
      landWait: 5 * MIN, pollGap: 1 * MIN, landSerialization: 4 * MIN,
    });
  });
  it('all-null when a land boundary is missing', () => {
    expect(phaseLand({ readyAt: at(0) }, 60)).toEqual({ landWait: null, pollGap: null, landSerialization: null });
  });
});

describe('phaseBreakdown — the per-item roll-up; total sums non-overlapping non-null phases', () => {
  it('sums authoring + firstCi + landWait (NOT pollGap/serialization again — landWait already contains them)', () => {
    const rec = {
      num: 42,
      dispatchedAt: at(0), setupDoneAt: at(2), firstCommitAt: at(10), // authoring 10m (setup 2 / net 8)
      ciStartedAt: at(10), ciCompletedAt: at(14),                     // firstCi 4m
      readyAt: at(14), mergedAt: at(19),                              // landWait 5m
    };
    const b = phaseBreakdown(rec, { intervalS: 60 });
    expect(b.num).toBe('42');
    expect(b.authoring.ms).toBe(10 * MIN);
    expect(b.authoring.decomposed).toBe(true);
    expect(b.firstCi).toBe(4 * MIN);
    expect(b.landWait).toBe(5 * MIN);
    expect(b.pollGap).toBe(1 * MIN);
    expect(b.landSerialization).toBe(4 * MIN);
    expect(b.total).toBe((10 + 4 + 5) * MIN);
  });
  it('a partial record under-populates rather than throwing (missing dispatch ⇒ null authoring, still totals the rest)', () => {
    const b = phaseBreakdown({ num: 7, ciStartedAt: at(0), ciCompletedAt: at(3), readyAt: at(3), mergedAt: at(4) });
    expect(b.authoring.ms).toBeNull();
    expect(b.authoring.reason).toBe('no-dispatch-signal');
    expect(b.firstCi).toBe(3 * MIN);
    expect(b.total).toBe((3 + 1) * MIN); // firstCi + landWait; authoring omitted
  });
});

describe('poolSaturation — fraction of the window with every lane busy', () => {
  it('width 1, two items with an idle GAP between them: the single lane is busy only outside the gap', () => {
    // [0,4] then [6,10] — a 2-min idle gap in a 10-min window. At width 1, "all lanes busy" = any item live, so
    // saturated = 8 min (the busy spans), fraction 0.8. The idle gap is what a width-bound pool would NOT have.
    const r = poolSaturation({ width: 1, intervals: [{ start: at(0), end: at(4) }, { start: at(6), end: at(10) }] });
    expect(r.peakConcurrency).toBe(1);
    expect(r.saturatedMs).toBe(8 * MIN);
    expect(r.saturatedFraction).toBeCloseTo(0.8, 6);
    expect(r.windowMs).toBe(10 * MIN);
  });
  it('width 2, three items overlapping in the middle ⇒ a saturated span and peak 3', () => {
    // [0,10], [2,8], [4,12] — at width 2, saturated whenever ≥2 are live: from t=2 to t=10.
    const r = poolSaturation({ width: 2, intervals: [{ start: at(0), end: at(10) }, { start: at(2), end: at(8) }, { start: at(4), end: at(12) }] });
    expect(r.peakConcurrency).toBe(3);
    expect(r.saturatedMs).toBe(8 * MIN); // t=2 → t=10
    expect(r.windowMs).toBe(12 * MIN);
    expect(r.saturatedFraction).toBeCloseTo((8 * MIN) / (12 * MIN), 6);
  });
  it('no width / no intervals ⇒ a null-ish verdict, never a divide-by-zero', () => {
    expect(poolSaturation({ width: 0, intervals: [{ start: at(0), end: at(5) }] }).saturatedFraction).toBeNull();
    expect(poolSaturation({ width: 2, intervals: [] }).saturatedFraction).toBeNull();
  });
});

describe('sumPhase — total + contributing-count, ignoring nulls', () => {
  it('sums a dotted phase field and counts only numeric contributors', () => {
    const bd = [
      { authoring: { ms: 3 * MIN } },
      { authoring: { ms: null } },
      { authoring: { ms: 5 * MIN } },
    ];
    expect(sumPhase(bd, 'authoring.ms')).toEqual({ sum: 8 * MIN, n: 2 });
  });
});

describe('classifyRegime — the binding-term verdict (the B/E/D go/no-go)', () => {
  const noSat = { saturatedFraction: null };
  const S = { setup: 0, authoringNet: 0, firstCi: 0, landSerialization: 0 };
  it('pool-saturation-bound wins first when the window is saturated past threshold (out of portfolio)', () => {
    const r = classifyRegime({ sums: { ...S, authoringNet: 100 }, authoringMeasuredN: 1, saturation: { saturatedFraction: 0.7 } });
    expect(r.regime).toBe('pool-saturation-bound');
    expect(r.inPortfolio).toBe(false);
  });
  it('firstCi largest ⇒ latency-bound (Lever E, in portfolio)', () => {
    const r = classifyRegime({ sums: { ...S, authoringNet: 1, firstCi: 100 }, authoringMeasuredN: 1, saturation: noSat });
    expect(r.regime).toBe('latency-bound');
    expect(r.binding).toBe('firstCi');
    expect(r.inPortfolio).toBe(true);
  });
  it('landSerialization largest ⇒ land-serialization-bound (Lever C premise)', () => {
    const r = classifyRegime({ sums: { ...S, landSerialization: 100 }, authoringMeasuredN: 1, saturation: noSat });
    expect(r.regime).toBe('land-serialization-bound');
  });
  it('authoringNet largest (decomposed) ⇒ authoring-bound (out of portfolio, authoring-time reduction)', () => {
    const r = classifyRegime({ sums: { ...S, setup: 10, authoringNet: 100, firstCi: 1 }, authoringMeasuredN: 3, saturation: noSat });
    expect(r.regime).toBe('authoring-bound');
    expect(r.binding).toBe('authoringNet');
    expect(r.needsDispatchInstrumentation).toBe(false);
  });
  it('BLOCKER-FIX: setup-heavy decomposed span ⇒ setup-bound, NOT authoring-bound (setup ≠ authoring)', () => {
    // authoringNet 9, firstCi 36, setup 170 — the wall is provisioning, not authoring or CI. Must not fold setup
    // into "authoring" and declare authoring-bound: the setup term wins on its own and routes to clone/env provisioning.
    const r = classifyRegime({ sums: { setup: 170, authoringNet: 9, firstCi: 36, landSerialization: 1 }, authoringMeasuredN: 2, saturation: noSat });
    expect(r.regime).toBe('setup-bound');
    expect(r.binding).toBe('setup');
    expect(r.inPortfolio).toBe(false);
    expect(r.note).toMatch(/clone\/pool provisioning/);
  });
  it('LOAD-BEARING round-4 guard: an undecomposed authoring mass that could dominate ⇒ authoring-bound-AMBIGUOUS', () => {
    const r = classifyRegime({ sums: { ...S, firstCi: 20, landSerialization: 10 }, undecomposedAuthoringSum: 100, authoringMeasuredN: 3, saturation: noSat });
    expect(r.regime).toBe('authoring-bound-ambiguous');
    expect(r.needsDispatchInstrumentation).toBe(true);
    expect(r.note).toMatch(/UNDECOMPOSED/);
  });
  it('a small undecomposed mass that CANNOT flip the ranking does not trip the guard', () => {
    const r = classifyRegime({ sums: { ...S, firstCi: 100 }, undecomposedAuthoringSum: 5, authoringMeasuredN: 3, saturation: noSat });
    expect(r.regime).toBe('latency-bound');
  });
  it('STRADDLE (re-review should-fix): coarse mass alone < winner, but coarse + decomposed authoringNet > winner ⇒ ambiguous', () => {
    // firstCi 55 is the largest term; the coarse span (50) alone is < 55 so the OLD guard let it through — but if
    // that 50 is really authoring it JOINS authoringNet(8) → 58 > 55, flipping the winner out of portfolio.
    const r = classifyRegime({ sums: { setup: 1, authoringNet: 8, firstCi: 55, landSerialization: 1 }, undecomposedAuthoringSum: 50, authoringMeasuredN: 1, saturation: noSat });
    expect(r.regime).toBe('authoring-bound-ambiguous');
    expect(r.needsDispatchInstrumentation).toBe(true);
  });
  it('an OUT-of-portfolio winner is NOT flipped to ambiguous by a coarse mass (go/no-go already out of portfolio)', () => {
    // authoringNet(100) already wins → authoring-bound; the coarse mass can only be more out-of-portfolio time.
    const r = classifyRegime({ sums: { setup: 1, authoringNet: 100, firstCi: 20, landSerialization: 1 }, undecomposedAuthoringSum: 30, authoringMeasuredN: 3, saturation: noSat });
    expect(r.regime).toBe('authoring-bound');
  });
  it('nothing measured but a dispatch signal is missing ⇒ ambiguous + needs instrumentation (never a false insufficient-data)', () => {
    const r = classifyRegime({ sums: { ...S }, authoringMeasuredN: 0, authoringMissingN: 4, saturation: noSat });
    expect(r.regime).toBe('authoring-bound-ambiguous');
    expect(r.needsDispatchInstrumentation).toBe(true);
  });
  it('a MEASURED term wins but authoring was never measured ⇒ verdict is PROVISIONAL (needsDispatchInstrumentation)', () => {
    const r = classifyRegime({ sums: { ...S, firstCi: 100, landSerialization: 1 }, authoringMeasuredN: 0, authoringMissingN: 3, saturation: noSat });
    expect(r.regime).toBe('latency-bound'); // still names the largest MEASURED term
    expect(r.needsDispatchInstrumentation).toBe(true); // …but flags that authoring is unseen
    expect(r.note).toMatch(/CAVEAT: authoring was NOT measured/);
  });
  it('a measured term wins AND authoring was measured (just smaller) ⇒ NOT provisional', () => {
    const r = classifyRegime({ sums: { setup: 2, authoringNet: 5, firstCi: 100, landSerialization: 1 }, authoringMeasuredN: 2, authoringMissingN: 0, saturation: noSat });
    expect(r.regime).toBe('latency-bound');
    expect(r.needsDispatchInstrumentation).toBe(false);
  });
  it('truly nothing measured (and no missing signal) ⇒ insufficient-data', () => {
    const r = classifyRegime({ sums: { ...S }, authoringMeasuredN: 0, authoringMissingN: 0, saturation: noSat });
    expect(r.regime).toBe('insufficient-data');
  });
});

describe('instrumentConveyor — end-to-end pure composition against plain objects', () => {
  it('a decomposed sample where authoring dominates classifies authoring-bound with per-item + aggregate detail', () => {
    const records = [
      { num: 1, dispatchedAt: at(0), setupDoneAt: at(2), firstCommitAt: at(30), ciStartedAt: at(30), ciCompletedAt: at(34), readyAt: at(34), mergedAt: at(35) },
      { num: 2, dispatchedAt: at(0), setupDoneAt: at(1), firstCommitAt: at(25), ciStartedAt: at(25), ciCompletedAt: at(28), readyAt: at(28), mergedAt: at(29) },
    ];
    const report = instrumentConveyor({ records, pool: { width: 4, intervals: records.map((r) => ({ start: r.dispatchedAt, end: r.mergedAt })) } });
    expect(report.generatedFor).toBe(2);
    expect(report.perItem).toHaveLength(2);
    expect(report.aggregate.sums.authoring.sum).toBe((30 + 25) * MIN);
    expect(report.aggregate.authoringDecomposedN).toBe(2);
    expect(report.aggregate.authoringMissingN).toBe(0);
    expect(report.regime.regime).toBe('authoring-bound');
    expect(report.config.intervalS).toBe(DEFAULT_POLL_INTERVAL_S);
  });
  it('BLOCKER-FIX end-to-end: setup-dominant decomposed records classify setup-bound, not authoring-bound', () => {
    // Big lane-clone/env setup (20 min), tiny actual authoring (2 min), modest CI (4 min). The wall is provisioning.
    const records = [
      { num: 1, dispatchedAt: at(0), setupDoneAt: at(20), firstCommitAt: at(22), ciStartedAt: at(22), ciCompletedAt: at(26), readyAt: at(26), mergedAt: at(27) },
      { num: 2, dispatchedAt: at(0), setupDoneAt: at(18), firstCommitAt: at(19), ciStartedAt: at(19), ciCompletedAt: at(22), readyAt: at(22), mergedAt: at(23) },
    ];
    const report = instrumentConveyor({ records });
    expect(report.aggregate.sums.setup.sum).toBe((20 + 18) * MIN);
    expect(report.aggregate.sums.authoringNet.sum).toBe((2 + 1) * MIN);
    expect(report.regime.regime).toBe('setup-bound');
    expect(report.regime.inPortfolio).toBe(false);
  });
  it('a sample with NO dispatch signals surfaces the ambiguity — authoring null, needsDispatchInstrumentation', () => {
    const records = [
      { num: 5, ciStartedAt: at(0), ciCompletedAt: at(4), readyAt: at(4), mergedAt: at(6) },
      { num: 6, ciStartedAt: at(0), ciCompletedAt: at(3), readyAt: at(3), mergedAt: at(20) }, // 17m land wait → serialization dominates
    ];
    const report = instrumentConveyor({ records });
    expect(report.aggregate.authoringMissingN).toBe(2);
    expect(report.aggregate.sums.authoring.n).toBe(0);
    // land serialization is the only large term here → land-serialization-bound, but the missing-signal flag rides along.
    expect(report.regime.regime).toBe('land-serialization-bound');
    expect(report.regime.needsDispatchInstrumentation).toBe(true); // provisional: authoring unseen
    expect(report.perItem.every((b) => b.authoring.ms === null)).toBe(true);
  });
  it('defaults: empty input is a clean insufficient-data report, never a throw', () => {
    const report = instrumentConveyor({});
    expect(report.generatedFor).toBe(0);
    expect(report.regime.regime).toBe('insufficient-data');
    expect(report.config.saturationThreshold).toBe(DEFAULT_SATURATION_THRESHOLD);
  });
});
