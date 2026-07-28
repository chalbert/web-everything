/**
 * @file scripts/readiness/__tests__/velocity-metrics.test.mjs
 * @description Unit proof of the VELOCITY-METRICS PRIMITIVE's PURE core (WE #2686). Drives every span / per-item /
 *   throughput / cycle-time / where-the-time-goes fn and the {@link rollUp} composer directly with PLAIN OBJECTS
 *   (NO real fs / git / clock — dates are injected `YYYY-MM-DD` / ISO strings). Pins the load-bearing guards:
 *   spans never go negative, the trailing window is a deterministic pure function of its inputs (default `asOf` =
 *   latest resolution), and the where-the-time-goes split is CURRENT-STATE + explicitly NOT time-weighted.
 */
import { describe, it, expect } from 'vitest';
import {
  DAY_MS,
  DEFAULT_WINDOW_DAYS,
  spanMs,
  spanDays,
  itemVelocity,
  latestResolved,
  throughput,
  percentile,
  cycleTimeStats,
  whereTheTimeGoes,
  rollUp,
} from '../velocity-metrics.mjs';

// A resolved item `days` long, resolved on `resolvedYmd`, `size` points.
const resolved = ({ num = 1, size = 3, started, resolvedYmd, opened, blockedBy }) => ({
  num,
  size,
  status: 'resolved',
  dateOpened: opened ?? null,
  dateStarted: started ?? null,
  dateResolved: resolvedYmd ?? null,
  blockedBy: blockedBy ?? [],
});

describe('spanMs / spanDays — null-tolerant, never-negative', () => {
  it('measures the ms/day span between two date strings', () => {
    expect(spanMs('2026-07-01', '2026-07-08')).toBe(7 * DAY_MS);
    expect(spanDays('2026-07-01', '2026-07-08')).toBe(7);
  });
  it('handles full ISO timestamps', () => {
    expect(spanMs('2026-07-01T00:00:00.000Z', '2026-07-01T12:00:00.000Z')).toBe(DAY_MS / 2);
  });
  it('is null when either boundary is missing or unparseable', () => {
    expect(spanMs(null, '2026-07-08')).toBeNull();
    expect(spanMs('2026-07-01', undefined)).toBeNull();
    expect(spanDays('not-a-date', '2026-07-08')).toBeNull();
  });
  it('is null (never negative) when b precedes a — out-of-order is bad data, not a span', () => {
    expect(spanMs('2026-07-08', '2026-07-01')).toBeNull();
    expect(spanDays('2026-07-08', '2026-07-01')).toBeNull();
  });
  it('is 0 for a same-day open→resolve (a real signal, not null)', () => {
    expect(spanDays('2026-07-01', '2026-07-01')).toBe(0);
  });
});

describe('itemVelocity — the per-item view', () => {
  it('derives cycle / wait / lead days and the status booleans', () => {
    const v = itemVelocity({
      num: 42, size: 5, status: 'resolved',
      dateOpened: '2026-07-01', dateStarted: '2026-07-03', dateResolved: '2026-07-10', blockedBy: [],
    });
    expect(v).toMatchObject({ num: 42, size: 5, resolved: true, active: false, blocked: false });
    expect(v.waitDays).toBe(2);   // opened→started
    expect(v.cycleDays).toBe(7);  // started→resolved
    expect(v.leadDays).toBe(9);   // opened→resolved
  });
  it('marks an active item with a non-empty blockedBy as blocked', () => {
    const v = itemVelocity({ num: 7, size: 3, status: 'active', blockedBy: [455] });
    expect(v).toMatchObject({ active: true, blocked: true, resolved: false });
  });
  it('yields null spans for a still-open / half-stamped item, never throwing', () => {
    const v = itemVelocity({ num: 9, size: 2, status: 'open', dateOpened: '2026-07-01' });
    expect(v.cycleDays).toBeNull();
    expect(v.leadDays).toBeNull();
    expect(v.blocked).toBe(false);
  });
  it('coerces a string size and tolerates a missing one', () => {
    expect(itemVelocity({ size: '8' }).size).toBe(8);
    expect(itemVelocity({}).size).toBe(0);
  });
});

describe('latestResolved — the deterministic default asOf', () => {
  it('returns the newest dateResolved as ISO', () => {
    const iso = latestResolved([
      resolved({ resolvedYmd: '2026-07-01' }),
      resolved({ resolvedYmd: '2026-07-20' }),
      resolved({ resolvedYmd: '2026-07-10' }),
    ]);
    expect(iso).toBe(new Date('2026-07-20').toISOString());
  });
  it('is null when nothing is resolved', () => {
    expect(latestResolved([{ status: 'open', dateResolved: null }])).toBeNull();
    expect(latestResolved([])).toBeNull();
  });
});

describe('throughput — resolved points/items per week over a trailing window', () => {
  const items = [
    resolved({ num: 1, size: 5, started: '2026-07-01', resolvedYmd: '2026-07-05' }),
    resolved({ num: 2, size: 3, started: '2026-07-10', resolvedYmd: '2026-07-18' }),
    resolved({ num: 3, size: 8, started: '2026-06-01', resolvedYmd: '2026-06-10' }), // outside a 14d window
    { num: 4, size: 13, status: 'active', dateResolved: null },                       // not resolved → excluded
  ];
  it('sums only resolved items inside (asOf-window, asOf], and rates per week', () => {
    const t = throughput(items, { windowDays: 14, asOf: '2026-07-18' });
    expect(t.points).toBe(8);  // #1 (5) + #2 (3); #3 is >14d before asOf; #4 unresolved
    expect(t.count).toBe(2);
    expect(t.weeks).toBe(2);
    expect(t.pointsPerWeek).toBe(4);
    expect(t.itemsPerWeek).toBe(1);
  });
  it('defaults asOf to the latest resolution — a pure function of the inputs, no clock', () => {
    const t = throughput(items, { windowDays: 28 });
    expect(t.asOf).toBe(new Date('2026-07-18').toISOString());
  });
  it('uses DEFAULT_WINDOW_DAYS when none is passed', () => {
    expect(throughput(items).windowDays).toBe(DEFAULT_WINDOW_DAYS);
  });
  it('returns a null-rate empty window when nothing is resolved', () => {
    const t = throughput([{ status: 'open', size: 3, dateResolved: null }]);
    expect(t).toMatchObject({ points: 0, count: 0, asOf: null, pointsPerWeek: null, itemsPerWeek: null });
  });
  it('degrades to an empty window (never throws) on a NaN window or unparseable asOf', () => {
    // `new Date(NaN).toISOString()` throws — the guard must catch bad window/asOf and return the empty shape.
    const bad = throughput(items, { windowDays: NaN });
    expect(bad).toMatchObject({ from: null, asOf: null, weeks: null, points: 0, pointsPerWeek: null });
    const badAsOf = throughput(items, { asOf: 'garbage' });
    expect(badAsOf).toMatchObject({ from: null, asOf: null, points: 0, pointsPerWeek: null });
    const badWin = throughput(items, { windowDays: -5, asOf: '2026-07-18' });
    expect(badWin.pointsPerWeek).toBeNull();
  });
  it('latestResolved default ignores a stray dateResolved on a non-resolved item', () => {
    // consistency guard: throughput sums only status:resolved, so the default asOf must too.
    const dirty = [
      resolved({ num: 1, size: 3, started: '2026-07-01', resolvedYmd: '2026-07-05' }),
      { num: 2, size: 5, status: 'active', dateResolved: '2026-12-31' }, // stray future stamp, not resolved
    ];
    const t = throughput(dirty, { windowDays: 28 });
    expect(t.asOf).toBe(new Date('2026-07-05').toISOString()); // anchored to the real resolution, not the stray
    expect(t.points).toBe(3);
  });
  it('excludes the lower window boundary and includes asOf itself (open-closed interval)', () => {
    const edge = [
      resolved({ num: 1, size: 2, started: '2026-07-01', resolvedYmd: '2026-07-04' }), // exactly window start → excluded
      resolved({ num: 2, size: 5, started: '2026-07-16', resolvedYmd: '2026-07-18' }), // == asOf → included
    ];
    const t = throughput(edge, { windowDays: 14, asOf: '2026-07-18' });
    expect(t.points).toBe(5);
    expect(t.count).toBe(1);
  });
});

describe('percentile — nearest-rank', () => {
  it('picks the nearest-rank value and clamps the ends', () => {
    const s = [1, 2, 3, 4, 5];
    expect(percentile(s, 0.85)).toBe(5);
    expect(percentile(s, 0.5)).toBe(3);
    expect(percentile(s, 0)).toBe(1);
  });
  it('is null on an empty array', () => {
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('cycleTimeStats — the started→resolved distribution', () => {
  it('summarises n / mean / median / p85 / min / max over resolved items with a cycle span', () => {
    const items = [
      resolved({ num: 1, started: '2026-07-01', resolvedYmd: '2026-07-03' }), //  2d
      resolved({ num: 2, started: '2026-07-01', resolvedYmd: '2026-07-05' }), //  4d
      resolved({ num: 3, started: '2026-07-01', resolvedYmd: '2026-07-11' }), // 10d
    ];
    const c = cycleTimeStats(items);
    expect(c.n).toBe(3);
    expect(c.minDays).toBe(2);
    expect(c.maxDays).toBe(10);
    expect(c.medianDays).toBe(4);
    expect(c.meanDays).toBeCloseTo((2 + 4 + 10) / 3);
    expect(c.p85Days).toBe(10);
  });
  it('averages the two middle values for an even count', () => {
    const items = [
      resolved({ num: 1, started: '2026-07-01', resolvedYmd: '2026-07-03' }), // 2d
      resolved({ num: 2, started: '2026-07-01', resolvedYmd: '2026-07-07' }), // 6d
    ];
    expect(cycleTimeStats(items).medianDays).toBe(4); // (2+6)/2
  });
  it('ignores unresolved items and resolved items missing a start stamp', () => {
    const items = [
      resolved({ num: 1, started: '2026-07-01', resolvedYmd: '2026-07-03' }),
      resolved({ num: 2, started: null, resolvedYmd: '2026-07-05' }),        // no start → no cycle
      { num: 3, size: 3, status: 'active', dateStarted: '2026-07-01' },      // not resolved
    ];
    expect(cycleTimeStats(items).n).toBe(1);
  });
  it('is all-null when nothing qualifies', () => {
    expect(cycleTimeStats([])).toMatchObject({ n: 0, meanDays: null, medianDays: null, p85Days: null });
  });
});

describe('whereTheTimeGoes — CURRENT-STATE point-share of active WIP', () => {
  const items = [
    { num: 1, size: 5, status: 'active', blockedBy: [] },     // in-flight
    { num: 2, size: 3, status: 'active', blockedBy: [99] },   // blocked
    { num: 3, size: 8, status: 'active', blockedBy: [] },     // in-flight
    { num: 4, size: 2, status: 'resolved', blockedBy: [] },   // not WIP → ignored
    { num: 5, size: 13, status: 'open', blockedBy: [] },      // not WIP → ignored
  ];
  it('splits only active points into in-flight vs currently-blocked', () => {
    const w = whereTheTimeGoes(items);
    expect(w.wipItems).toBe(3);
    expect(w.wipPoints).toBe(16);        // 5 + 3 + 8
    expect(w.inFlightPoints).toBe(13);   // 5 + 8
    expect(w.blockedPoints).toBe(3);
    expect(w.inFlightShare).toBeCloseTo(13 / 16);
    expect(w.blockedShare).toBeCloseTo(3 / 16);
  });
  it('labels the basis current-state and flags that it is NOT time-weighted (the honesty boundary)', () => {
    const w = whereTheTimeGoes(items);
    expect(w.basis).toBe('current-state');
    expect(w.note).toMatch(/NOT time-weighted/);
    expect(w.note).toMatch(/status-transition history/);
  });
  it('yields null shares when there is no WIP', () => {
    const w = whereTheTimeGoes([{ num: 1, size: 3, status: 'resolved', blockedBy: [] }]);
    expect(w).toMatchObject({ wipPoints: 0, inFlightShare: null, blockedShare: null });
  });
});

describe('rollUp — the composed report', () => {
  const items = [
    resolved({ num: 1, size: 5, started: '2026-07-01', resolvedYmd: '2026-07-05', opened: '2026-06-30' }),
    resolved({ num: 2, size: 3, started: '2026-07-10', resolvedYmd: '2026-07-18', opened: '2026-07-08' }),
    { num: 3, size: 8, status: 'active', blockedBy: [], dateResolved: null },
    { num: 4, size: 2, status: 'active', blockedBy: [1], dateResolved: null },
    { num: 5, size: 13, status: 'open', blockedBy: [], dateResolved: null },
    { num: 6, size: 1, status: 'parked', blockedBy: [], dateResolved: null },
  ];
  it('bundles counts + throughput + cycleTime + whereTheTimeGoes + perItem', () => {
    const r = rollUp(items, { windowDays: 28, asOf: '2026-07-18' });
    expect(r.counts).toEqual({ total: 6, resolved: 2, active: 2, open: 1, parked: 1 });
    expect(r.throughput.points).toBe(8);
    expect(r.cycleTime.n).toBe(2);
    expect(r.whereTheTimeGoes.wipPoints).toBe(10); // 8 + 2 active
    expect(r.perItem).toHaveLength(6);
    expect(r.perItem[0]).toMatchObject({ num: 1, cycleDays: 4 });
  });
  it('tolerates an empty / non-array input without throwing', () => {
    expect(rollUp([]).counts.total).toBe(0);
    expect(rollUp(undefined).counts.total).toBe(0);
    expect(rollUp(null).throughput.pointsPerWeek).toBeNull();
  });
});
