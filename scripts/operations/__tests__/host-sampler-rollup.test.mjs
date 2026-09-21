import { describe, it, expect } from 'vitest';

import { buildDailyRollup } from '../host-sampler-retention.mjs';
import {
  EPISODE_DEFAULTS, PRESSURE_DEFAULTS, buildCapacityRollup, dist, lowDist, parseDuration, pressureSamples, regress, renderPressure, replayPressure, smoothedPressure,
} from '../host-sampler-rollup.mjs';
import { extractCapacity, groupSamples } from '../load-analysis.mjs';
import { parseTelemetryLines } from '../telemetry.mjs';

const T0 = Date.parse('2026-09-21T10:00:00.000Z');
const STEP = 30_000;

/** One schema-2 sample as telemetry events, with every value given explicitly so percentiles are known by construction. */
function capSample(i, o = {}) {
  const at = new Date(T0 + (o.atMs ?? i * STEP)).toISOString();
  const sample = `s${i}@${at}`;
  const base = { source: 'host-sampler', sample, mode: 'normal', interval_s: 30, schema: 2, quality: o.quality ?? 'ok' };
  const m = (name, value, attributes = {}) => ({ v: 1, event: 'metric', name, kind: 'sampler', value, unit: 'count', timestamp: at, attributes: { ...base, ...attributes }, resource: {} });
  const out = [m('host.cpu.load1', o.load1 ?? 4), m('host.cpu.count', 12)];
  if (o.busy != null) out.push(m('host.cpu.busy_pct', o.busy, { user_pct: o.busy - 5, sys_pct: 5, idle_pct: 100 - o.busy, window_s: 30, hw_ncpu: 12, core_busy_max: 90, cores_over90: 1 }));
  const cls = o.classes ?? {};
  const names = ['vitest', 'check-standards', 'verify-lane', 'playwright', 'eleventy-or-vite-dev', 'container', 'system-macos', 'vscode', 'claude-background-worker', 'other'];
  out.push(m('host.class.cpu_pct', 0, Object.fromEntries(names.map((k) => [`cpu.${k}`, cls[k]?.cpu ?? 0]))));
  out.push(m('host.class.count', 0, Object.fromEntries(names.map((k) => [`n.${k}`, cls[k]?.n ?? 0]))));
  out.push(m('host.class.mem_bytes', 0, Object.fromEntries(names.map((k) => [`mem.${k}`, cls[k]?.mem ?? 0]))));
  if (o.lanes) {
    const a = { share: 0.5, unlaned_cpu: 10 };
    for (const [k, v] of Object.entries(o.lanes)) { a[`cpu.${k}`] = v.cpu; a[`mem.${k}`] = v.mem; a[`n.${k}`] = v.n ?? 1; }
    out.push(m('lane.attribution.cpu_pct', 0, a));
  }
  if (o.roots != null) out.push(m('host.heavy.roots', o.roots, { by_class: 'vitest:1', unadmitted_cpu: o.unadmittedCpu ?? 0, unadmitted_n: o.unadmittedN ?? 0, held: o.held ?? 0, cap: 2 }));
  for (const h of o.holders ?? []) out.push(m('heavy.admission.holder', h.heldForS, { holder: h.id, cpu_pct: h.cpu, mem_bytes: h.mem ?? 0, procs: 3, classes: 'vitest:2', unslotted: false }));
  if (o.workers) {
    const a = { no_pid: 0 };
    for (const [k, v] of Object.entries(o.workers)) { a[`n.${k}`] = v.n; a[`cpu.${k}`] = v.cpu; a[`mem.${k}`] = v.mem ?? 0; a[`heavy_cpu.${k}`] = v.heavyCpu ?? 0; }
    out.push(m('host.workers.live', Object.values(o.workers).reduce((t, v) => t + v.n, 0), a));
  }
  for (const e of o.events ?? []) out.push(m('dispatch.worker.event', 1, { event: e.event, kind: e.kind, name: e.name, session_id: e.id, at: e.at, discovered: false }));
  if (o.leased != null) out.push(m('lane.pool.leased', o.leased));
  if (o.self) out.push(m('host.sampler.self', o.self.durationMs, { cpu_ms: o.self.cpuMs, cpu_ms_upper_bound: o.self.upper, heartbeat_gap_s: 30, heartbeat_missed_total: o.self.missed ?? 0 }));
  return out;
}
const events = (list) => list.flat();

describe('percentile and regression helpers', () => {
  it('dist / lowDist use nearest rank on the sorted values and ignore junk', () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, null, NaN];
    expect(dist(v)).toEqual({ p50: 50, p90: 90, p99: 100, max: 100, n: 10 });
    expect(lowDist(v)).toEqual({ p50: 50, p10: 10, min: 10, n: 10 });
    expect(dist([])).toEqual({ p50: null, p90: null, p99: null, max: null, n: 0 });
  });
  it('regress recovers a known slope, intercept and r; no variance is null', () => {
    const xs = [0, 1, 2, 3, 4]; const ys = xs.map((x) => 3 + 2 * x);
    expect(regress(xs, ys)).toEqual({ slope: 2, intercept: 3, r: 1, n: 5 });
    expect(regress([1, 1, 1], [1, 2, 3]).slope).toBeNull();
    expect(regress([1], [1]).slope).toBeNull();
    expect(regress([0, 1, 2, 3], [5, 5, 5, 5]).r).toBeNull();
  });
});

describe('buildCapacityRollup — per hour, per class percentiles and host idle (fixture with known percentiles)', () => {
  // hour 10: 10 samples, vitest cpu 10..100, idle 90..0 stepping 10 (busy 10..100); hour 11: 10 samples vitest 200..
  const list = [];
  for (let i = 0; i < 10; i++) list.push(capSample(i, { busy: 10 * (i + 1), classes: { vitest: { cpu: 10 * (i + 1), n: 1, mem: 1000 * (i + 1) }, 'system-macos': { cpu: 100, n: 5, mem: 5000 } } }));
  for (let i = 0; i < 10; i++) list.push(capSample(120 + i, { atMs: 3_600_000 + i * STEP, busy: 20, classes: { vitest: { cpu: 200, n: 1, mem: 7 } } }));
  const r = buildCapacityRollup(groupSamples(events(list)));

  it('per hour and per family: p50/p90/p99/max of CPU and RSS', () => {
    const h10 = r.hourly['2026-09-21T10:00Z'];
    expect(h10.samples).toBe(10);
    expect(h10.families.vitest.cpu).toEqual({ p50: 50, p90: 90, p99: 100, max: 100, n: 10 });
    expect(h10.families.vitest.rssBytes).toMatchObject({ p50: 5000, p90: 9000, max: 10_000 });
    expect(h10.families['system-macos'].cpu.p50).toBe(100);
    expect(h10.families.vitest.presentShare).toBe(1);
    expect(r.hourly['2026-09-21T11:00Z'].families.vitest.cpu.max).toBe(200);
    expect(Object.keys(r.hourly)).toEqual(['2026-09-21T10:00Z', '2026-09-21T11:00Z']);
  });

  it('host idle p50/p10/min per hour', () => {
    // idle = 100 - busy = 90, 80, ... 0; sorted [0..90], nearest rank: p50 = 5th = 40, p10 = 1st = 0
    expect(r.hourly['2026-09-21T10:00Z'].hostIdlePct).toEqual({ p50: 40, p10: 0, min: 0, n: 10 });
    expect(r.hourly['2026-09-21T11:00Z'].hostIdlePct).toMatchObject({ p50: 80, min: 80 });
  });

  it('is deterministic and omits classes that never appear in the hour', () => {
    expect(JSON.stringify(buildCapacityRollup(groupSamples(events(list))))).toBe(JSON.stringify(r));
    expect(r.hourly['2026-09-21T10:00Z'].families).not.toHaveProperty('playwright');
    expect(r.schema).toBe(2);
    expect(r.thresholds.status).toBe('PROVISIONAL');
  });
});

describe('heavy-burst episodes', () => {
  const list = [];
  for (let i = 0; i < 20; i++) {
    const hot = i >= 5 && i <= 8; // 4 hot samples
    list.push(capSample(i, {
      busy: hot ? 80 + i : 30, load1: hot ? 20 + i : 4,
      classes: hot ? { vitest: { cpu: 500, n: 2 }, 'check-standards': { cpu: 100, n: 1 }, 'system-macos': { cpu: 50, n: 3 } } : { 'system-macos': { cpu: 50, n: 3 } },
      holders: hot ? [{ id: 'slot-0:lane-3', heldForS: 100 + i, cpu: 550 }, { id: 'slot-1:lane-9', heldForS: 50, cpu: 10 }] : [],
      workers: { build: { n: hot ? 2 : 1, cpu: 4 }, review: { n: hot ? 3 : 0, cpu: 2 } },
      events: i === 6 ? [{ event: 'start', kind: 'review', name: 'review-1', id: 'r1', at: new Date(T0 + 6 * STEP).toISOString() }] : i === 8 ? [{ event: 'finish', kind: 'build', name: 'build-2', id: 'b2', at: new Date(T0 + 8 * STEP).toISOString() }] : [],
    }));
  }
  // a separate later spike on load alone (no true CPU): load1/core 2.0 for one sample
  list.push(capSample(40, { busy: 30, load1: 24, classes: { 'check-standards': { cpu: 200, n: 1 } } }));
  const r = buildCapacityRollup(groupSamples(events(list)));

  it('finds each episode with start, duration, peaks, the responsible class and holder, and the workers that overlapped', () => {
    expect(r.burstEpisodes).toHaveLength(2);
    const e = r.burstEpisodes[0];
    expect(e.start).toBe(new Date(T0 + 5 * STEP).toISOString());
    expect(e.samples).toBe(4);
    expect(e.durationS).toBe(120);
    expect(e.peakLoad1).toBe(28);
    expect(e.peakBusyPct).toBe(88);
    expect(e.responsibleClass).toBe('vitest');
    expect(e.responsibleHeavyClass).toBe('vitest');
    expect(e.responsibleShare).toBeCloseTo(500 / 650, 2);
    expect(e.topClasses.map((c) => c.class)).toEqual(['vitest', 'check-standards', 'system-macos']);
    expect(e.responsibleHolder).toBe('slot-0:lane-3');
    expect(e.workersLive).toEqual({ peak: 5, mean: 5, peakByKind: { build: 2, review: 3 } });
    expect(e.workerStarts).toBe(1);
    expect(e.workerFinishes).toBe(1);
  });

  it('a spike seen only in load1-per-core is an episode too', () => {
    const e = r.burstEpisodes[1];
    expect(e.peakLoad1).toBe(24);
    expect(e.responsibleClass).toBe('check-standards');
    expect(e.peakBusyPct).toBe(30);
  });

  it('the episode thresholds are the provisional pressure thresholds, named', () => {
    expect(EPISODE_DEFAULTS.busyPct).toBe(PRESSURE_DEFAULTS.holdBusyPct);
    expect(EPISODE_DEFAULTS.loadPerCore).toBe(PRESSURE_DEFAULTS.holdLoadPerCore);
  });
});

describe('reservation-inputs', () => {
  // 60 samples; review workers cycle 0..3, each costs exactly 2% CPU and 100 MB; vitest present in every 5th sample
  const list = [];
  for (let i = 0; i < 60; i++) {
    const rev = i % 4; const heavy = i % 5 === 0;
    list.push(capSample(i, {
      busy: 40, classes: { 'system-macos': { cpu: 100 + (i % 3), n: 4, mem: 4000 }, vscode: { cpu: 10, n: 2, mem: 1000 }, ...(heavy ? { vitest: { cpu: 300, n: 2, mem: 900 } } : {}) },
      roots: heavy ? 1 : 0, held: heavy ? 1 : 0, unadmittedN: i % 10 === 0 ? 1 : 0, unadmittedCpu: i % 10 === 0 ? 300 : 0,
      lanes: { 'web-everything/lane-1': { cpu: heavy ? 300 : 0.2, mem: 800 }, 'web-everything/lane-2': { cpu: 5, mem: 200 } }, leased: i % 3,
      workers: { review: { n: rev, cpu: 2 * rev, mem: 100 * rev }, build: { n: 1, cpu: 4, mem: 200 } },
      holders: heavy ? [{ id: 'slot-0:lane-1', heldForS: 60 + i, cpu: 300 }] : [],
    }));
  }
  const ri = buildCapacityRollup(groupSamples(events(list)))['reservation-inputs'];

  it('baseline system + VS Code from QUIET samples only (no heavy class, no dev server)', () => {
    expect(ri.baseline.totalSamples).toBe(60);
    expect(ri.baseline.quietSamples).toBe(48);
    expect(ri.baseline.systemPlusVscodeCpuPct).toMatchObject({ p50: 111, max: 112, n: 48 });
    expect(ri.baseline.systemPlusVscodeRssBytes.p50).toBe(5000);
    expect(ri.baseline.hostBusyPctWhenQuiet.p50).toBe(40);
  });

  it('per-worker marginal cost by kind: the regression recovers the known slope, with r and n', () => {
    const c = ri.perWorker.review.cpuPct;
    expect(c).toMatchObject({ verdict: 'ok', perWorker: 2, r: 1, n: 60 });
    expect(c.distinctCounts).toEqual([0, 1, 2, 3]);
    expect(c.meanPerWorker).toBe(2);
    expect(ri.perWorker.review.rssBytes).toMatchObject({ verdict: 'ok', perWorker: 100 });
  });

  it('says "not enough data" when n is small, or when the count never varied', () => {
    expect(ri.perWorker.build.cpuPct.verdict).toBe('not enough data'); // always exactly 1 build worker: no variation to regress
    expect(ri.perWorker.build.cpuPct.meanPerWorker).toBe(4);
    const few = buildCapacityRollup(groupSamples(events(list.slice(0, 10))))['reservation-inputs'].perWorker.review.cpuPct;
    expect(few).toMatchObject({ verdict: 'not enough data', n: 10 });
    expect(ri.perWorker.prepare.cpuPct.verdict).toBe('not enough data'); // never recorded
  });

  it('the heavy pool\'s demand: concurrent heavy commands, share above the cap, unadmitted share, hold time, per-class cost when present', () => {
    const p = ri.heavyPool;
    expect(p.admissionCap).toBe(2);
    expect(p.concurrentHeavyCommands).toMatchObject({ p50: 0, max: 1, n: 60 });
    expect(p.concurrencyShare).toEqual({ 0: 0.8, 1: 0.2 });
    expect(p.shareAboveCap).toBe(0);
    expect(p.unadmittedShare).toBe(0.1);
    expect(p.holdSecondsPerHolder.n).toBe(1);
    expect(p.holdSecondsPerHolder.max).toBe(60 + 55); // the LONGEST hold seen for slot-0:lane-1
    expect(p.perHeavyClass.vitest).toMatchObject({ presentSamples: 12 });
    expect(p.perHeavyClass.vitest.cpuPctWhenPresent.p50).toBe(300);
  });

  it('the lane count distribution and per-lane need', () => {
    const l = ri.lanes;
    expect(l.leased).toMatchObject({ max: 2, n: 60 });
    expect(l.leased.share).toEqual({ 0: 0.33, 1: 0.33, 2: 0.33 });
    expect(l.activeLanesPerSample).toMatchObject({ p50: 1, max: 2 }); // lane-2 always active, lane-1 only while heavy
    expect(l.perActiveLaneCpuPct.max).toBe(300);
    expect(l.perActiveLaneRssBytes.max).toBe(800);
  });

  it('a container class under the threshold does not spoil quiet; a busy one does', () => {
    const quietOne = capSample(0, { busy: 30, classes: { container: { cpu: 1, n: 6 }, 'system-macos': { cpu: 10, n: 1 } } });
    const busyOne = capSample(1, { busy: 30, classes: { container: { cpu: 80, n: 6 }, 'system-macos': { cpu: 10, n: 1 } } });
    expect(buildCapacityRollup(groupSamples(events([quietOne, busyOne])))['reservation-inputs'].baseline.quietSamples).toBe(1);
  });
});

describe('selfOverhead and quality in the rollup', () => {
  it('reports the sampler\'s own cost as a share of one core, heartbeat and partial-quality counts', () => {
    const list = [];
    for (let i = 0; i < 11; i++) list.push(capSample(i, { busy: 10, quality: i === 3 ? 'partial' : 'ok', self: { durationMs: 200, cpuMs: 60, upper: 300, missed: i >= 7 ? 1 : 0 } }));
    const r = buildCapacityRollup(groupSamples(events(list)));
    expect(r.quality).toEqual({ partial: 1, total: 11 });
    expect(r.selfOverhead.durationMs.p50).toBe(200);
    expect(r.selfOverhead.cpuMsUpperBound.max).toBe(300);
    expect(r.selfOverhead.coreShare).toBeCloseTo((11 * 300) / (300_000 + 30_000), 2); // 11 samples x 300 ms over 330 s
    expect(r.selfOverhead.heartbeatMissedTotal).toBe(1);
  });
});

describe('schema back-compat: a schema-1 (old-format) day still rolls up', () => {
  const metric = (name, value, sample, at, attributes = {}) => ({ v: 1, event: 'metric', name, value, timestamp: at, attributes: { source: 'host-sampler', sample, mode: 'normal', interval_s: 30, ...attributes }, resource: {} });
  const old = [];
  for (let i = 0; i < 6; i++) {
    const at = new Date(T0 + i * STEP).toISOString();
    old.push(metric('host.cpu.load1', 5 + i, `o${i}`, at), metric('host.cpu.count', 12, `o${i}`, at), metric('host.family.cpu_pct', 0, `o${i}`, at, { 'cpu.vitest': 10 * i, 'cpu.other': 100 }));
  }
  const r = buildDailyRollup(old, { day: '2026-09-21' });

  it('keeps every v1 field and marks the capacity section absent instead of throwing', () => {
    expect(r.v).toBe(1);
    expect(r.schema).toBe(2);
    expect(r.samples.total).toBe(6);
    expect(r.load1.max).toBe(10);
    expect(r.families.vitest.cpu.max).toBe(50);
    expect(r.capacity).toEqual({ present: false, note: 'no schema-2 samples in this day' });
    expect(groupSamples(old).every((s) => s.cap === null)).toBe(true);
  });

  it('a MIXED day (old then new records) rolls up both halves', () => {
    const mixed = [...old, ...events([capSample(20, { busy: 50, classes: { vitest: { cpu: 10, n: 1 } } }), capSample(21, { busy: 60 })])];
    const m = buildDailyRollup(mixed, { day: '2026-09-21' });
    expect(m.samples.total).toBe(8);
    expect(m.capacity.present).toBe(true);
    expect(m.capacity.samples).toBe(2);
  });

  it('extractCapacity is null for a schema-1 sample', () => {
    expect(extractCapacity([metric('host.cpu.load1', 1, 's', 'x')])).toBeNull();
  });

  it('the rollup survives the JSON round trip the day file uses', () => {
    const text = `${events([capSample(0, { busy: 10 })]).map((e) => JSON.stringify(e)).join('\n')}\n`;
    const parsed = parseTelemetryLines(text).events;
    expect(buildDailyRollup(parsed, { day: '2026-09-21' }).capacity.present).toBe(true);
  });
});

describe('smoothedPressure — the smoothed brake with hysteresis', () => {
  const NOW = T0 + 60 * 60_000;
  /** n samples ending at NOW, spaced 30 s, all with the given busy and load1-per-core (12 cores). */
  const flat = (n, busy, loadPerCore) => Array.from({ length: n }, (_, i) => ({ atMs: NOW - (n - 1 - i) * STEP, busyPct: busy, load1: loadPerCore * 12, cores: 12 }));

  it('ENTER: hold when the window p90 busy exceeds the hold threshold, with the numbers in the verdict', () => {
    const r = smoothedPressure({ samples: flat(20, 80, 0.5), now: NOW });
    expect(r).toMatchObject({ decision: 'hold', p90CpuBusy: 80, p90Load1PerCore: 0.5, n: 20, busySource: 'host-cpu' });
    expect(r.reason).toContain('p90 host busy 80% > 75%');
    expect(r.pressure).toBeCloseTo(80 / 75, 2);
  });

  it('ENTER on load alone: p90 load1 per core over 1.5 holds even when busy is low', () => {
    const r = smoothedPressure({ samples: flat(20, 40, 1.8), now: NOW });
    expect(r.decision).toBe('hold');
    expect(r.reason).toContain('load1/core 1.8 > 1.5');
  });

  it('admit under both thresholds', () => {
    const r = smoothedPressure({ samples: flat(20, 50, 0.9), now: NOW });
    expect(r).toMatchObject({ decision: 'admit', p90CpuBusy: 50 });
    expect(r.reason).toContain('under thresholds');
  });

  it('STAY: between the enter and leave thresholds a held brake stays held, a released one stays admitted', () => {
    const between = flat(20, 68, 1.2); // above release (60 / 1.0), below hold (75 / 1.5)
    expect(smoothedPressure({ samples: between, now: NOW, hysteresis: { previous: 'hold' } })).toMatchObject({ decision: 'hold' });
    expect(smoothedPressure({ samples: between, now: NOW, hysteresis: { previous: 'hold' } }).reason).toContain('hysteresis');
    expect(smoothedPressure({ samples: between, now: NOW, hysteresis: { previous: 'admit' } }).decision).toBe('admit');
  });

  it('LEAVE: a held brake releases only when BOTH busy and load are under the lower thresholds', () => {
    expect(smoothedPressure({ samples: flat(20, 55, 0.8), now: NOW, hysteresis: { previous: 'hold' } })).toMatchObject({ decision: 'admit' });
    expect(smoothedPressure({ samples: flat(20, 55, 0.8), now: NOW, hysteresis: { previous: 'hold' } }).reason).toContain('released');
    expect(smoothedPressure({ samples: flat(20, 55, 1.2), now: NOW, hysteresis: { previous: 'hold' } }).decision).toBe('hold'); // load still above release
    expect(smoothedPressure({ samples: flat(20, 65, 0.8), now: NOW, hysteresis: { previous: 'hold' } }).decision).toBe('hold'); // busy still above release
  });

  it('NEVER from a single reading: one spike in the window does not hold, and too few samples is insufficient-data', () => {
    const s = flat(20, 30, 0.4); s[19] = { ...s[19], busyPct: 100, load1: 60 };
    expect(smoothedPressure({ samples: s, now: NOW })).toMatchObject({ decision: 'admit', p90CpuBusy: 30 });
    const one = smoothedPressure({ samples: flat(1, 100, 5), now: NOW });
    expect(one.decision).toBe('admit');
    expect(one.reason).toContain('insufficient-data');
    expect(smoothedPressure({ samples: [], now: NOW })).toMatchObject({ decision: 'admit', pressure: null, n: 0 });
  });

  it('only the last windowMs counts (default 10 minutes); older samples are ignored', () => {
    const old = flat(20, 95, 3).map((s) => ({ ...s, atMs: s.atMs - 30 * 60_000 }));
    expect(smoothedPressure({ samples: [...old, ...flat(20, 30, 0.3)], now: NOW }).decision).toBe('admit');
    expect(smoothedPressure({ samples: [...old, ...flat(20, 30, 0.3)], now: NOW, windowMs: 60 * 60_000 }).decision).toBe('hold');
  });

  it('a dead sampler cannot wedge the brake: stale data admits (fail open)', () => {
    const r = smoothedPressure({ samples: flat(20, 95, 3), now: NOW + 20 * 60_000, windowMs: 40 * 60_000 });
    expect(r.decision).toBe('admit');
    expect(r.reason).toContain('stale-data');
  });

  it('a schema-1 sample with no true CPU falls back to the per-process estimate, flagged in busySource', () => {
    const s = flat(20, null, 0.5).map((x) => ({ ...x, busyPct: null, busyEstimate: 90 }));
    expect(smoothedPressure({ samples: s, now: NOW })).toMatchObject({ decision: 'hold', busySource: 'ps-sum-estimate' });
  });

  it('replayPressure chains the hysteresis state through the whole file and lists every transition', () => {
    const cold = Array.from({ length: 20 }, (_, i) => ({ atMs: T0 + i * STEP, busyPct: 30, load1: 4, cores: 12 }));
    const hot = Array.from({ length: 40 }, (_, i) => ({ atMs: T0 + (20 + i) * STEP, busyPct: 90, load1: 24, cores: 12 }));
    const cool = Array.from({ length: 60 }, (_, i) => ({ atMs: T0 + (60 + i) * STEP, busyPct: 50, load1: 6, cores: 12 }));
    const r = replayPressure({ samples: [...cold, ...hot, ...cool], now: T0 + 119 * STEP });
    expect(r.decision).toBe('admit');
    expect(r.transitions.map((t) => t.to)).toEqual(['hold', 'admit']);
    expect(r.transitions[0].from).toBe('admit');
    expect(r.sampleCount).toBe(120);
    // mid-way (still inside the hot stretch) the brake is held
    expect(replayPressure({ samples: [...cold, ...hot, ...cool], now: T0 + 59 * STEP }).decision).toBe('hold');
  });

  it('thresholds are named, provisional constants matching the brief: hold >75% or >1.5, release <60% and <1.0, 10 min', () => {
    expect(PRESSURE_DEFAULTS).toMatchObject({ holdBusyPct: 75, holdLoadPerCore: 1.5, releaseBusyPct: 60, releaseLoadPerCore: 1.0, windowMs: 600_000 });
    expect(Object.isFrozen(PRESSURE_DEFAULTS)).toBe(true);
  });

  it('parseDuration and the rendering', () => {
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('45')).toBe(45_000);
    expect(parseDuration('soon')).toBeNull();
    const text = renderPressure(smoothedPressure({ samples: flat(20, 80, 0.5), now: NOW }));
    expect(text).toContain('HOLD');
    expect(text).toContain('PROVISIONAL');
  });

  it('pressureSamples reads the true CPU when recorded and the estimate for a schema-1 sample', () => {
    const metric = (name, value, sample, at, attributes = {}) => ({ v: 1, event: 'metric', name, value, timestamp: at, attributes: { source: 'host-sampler', sample, ...attributes }, resource: {} });
    const at = new Date(T0).toISOString();
    const ps = pressureSamples([...capSample(0, { busy: 42, load1: 6 }), metric('host.cpu.load1', 12, 'old', new Date(T0 + STEP).toISOString()), metric('host.cpu.count', 12, 'old', new Date(T0 + STEP).toISOString()), metric('host.family.cpu_pct', 0, 'old', new Date(T0 + STEP).toISOString(), { 'cpu.vitest': 360 })]);
    expect(ps[0]).toMatchObject({ atMs: Date.parse(at), busyPct: 42, load1: 6, cores: 12, busyEstimate: null });
    expect(ps[1]).toMatchObject({ busyPct: null, busyEstimate: 30 });
  });
});
