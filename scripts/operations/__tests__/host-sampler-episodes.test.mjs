import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { holderTable, sessionPidMap } from '../host-sampler-attribution.mjs';
import { REFERENCE_WORKLOADS, parseLevels, parseTimeOutput, planCalibration, runCalibration, slowdownCurve } from '../host-sampler-calibrate.mjs';
import {
  EPISODE_FIELDS, HARDWARE_KEYS, START_TOLERANCE_MS, episodeRecord, findHeavyRuns, hardwareProfileDue, nextWaiters, parseCpuTime, parseHardwareProfile, parsePsTimes, parseThreadCounts, stepEpisodes,
} from '../host-sampler-episodes.mjs';
import { LANE_LOAD, buildCapacityRollup, buildLaneLoadModel, concurrencyBin, readLaneLoadModel, renderLaneLoad, sufficiency } from '../host-sampler-rollup.mjs';
import { groupSamples } from '../load-analysis.mjs';
import { main } from '../host-sampler.mjs';
import { METRIC_NAMES, MAX_LINE_BYTES, parseTelemetryLines, validateTelemetryEvent } from '../telemetry.mjs';
import { newMetric, resourceAttributes, serializeTelemetryEvent } from '../telemetry-store.mjs';

const T0 = Date.parse('2026-09-21T12:00:00.000Z');
const row = (pid, ppid, pcpu, rssKb, command, etimeS) => ({ pid, ppid, pcpu, rssKb, command, etimeS });
const LANES = [
  { pool: 'web-everything', lane: 'lane-3', path: '/w/.lanes/web-everything/lane-3' },
  { pool: 'web-everything', lane: 'lane-30', path: '/w/.lanes/web-everything/lane-30' },
];

describe('BSD ps parsers', () => {
  it('cumulative CPU time: mm:ss.cc with minutes past 59, h:mm:ss and d-hh:mm:ss', () => {
    expect(parseCpuTime('339:00.01')).toBeCloseTo(20340.01, 2);
    expect(parseCpuTime('0:12.50')).toBe(12.5);
    expect(parseCpuTime('1:02:03')).toBe(3723);
    expect(parseCpuTime('2-01:00:00')).toBe(2 * 86400 + 3600);
    expect(parseCpuTime('abc')).toBeNull();
    expect(parsePsTimes('  100   0:12.50\n  101 339:00.01\ngarbage\n')).toEqual({ 100: 12.5, 101: 20340.01 });
  });
  it('thread counts are one line per thread', () => {
    expect(parseThreadCounts('  550\n  550\n  550\n  7\n\n')).toEqual({ 550: 3, 7: 1 });
    // the real `ps -M -o pid=` shape: header, then one full row per thread with the pid appended last
    const real = `USER   PID   TT   %CPU STAT PRI     STIME     UTIME COMMAND      \nroot   550   ??  100.0 R    49T  33:08.12 2230:54.68 /System   550\n       550         0.0 S    31T   0:00.00   0:00.00           550\n       550         0.0 S    31T   0:00.01   0:00.00           550\nme   7429   ??    0.0 S    31T   0:00.00   0:00.00 /bin/bash -c x   7429\n`;
    expect(parseThreadCounts(real)).toEqual({ 550: 3, 7429: 1 });
  });
});

describe('findHeavyRuns — one run per heavy root, its whole tree', () => {
  const rows = [
    row(100, 1, 1, 30_000, 'node scripts/readiness/heavy-admission.mjs run -- npm run test:unit', 60),
    row(101, 100, 0.5, 10_000, 'npm run test:unit', 60),
    row(102, 101, 300, 700_000, 'node (vitest)', 59),
    row(103, 101, 200, 600_000, 'node (vitest)', 59),
    row(110, 1, 90, 500_000, 'node scripts/check-standards.mjs', 5),
    row(120, 1, 30, 100_000, 'node scripts/readiness/verify-lane.mjs --lane=3', 30),
    row(121, 120, 250, 300_000, 'node (vitest)', 25),
    row(122, 120, 80, 200_000, 'node scripts/check-standards.mjs', 10),
    row(130, 1, 5, 1000, 'grep vitest /tmp/x', 1),
  ];
  const admission = { held: [{ slot: 0, owner: '/w/.lanes/web-everything/lane-3', pid: 100, heartbeatAt: new Date(T0 - 55_000).toISOString() }], waiting: [] };
  const roster = sessionPidMap([{ sessionId: 's', name: 'build-9', kind: 'background', pid: 120 }]);
  const runs = findHeavyRuns({ rows, lanes: LANES, cwds: { 100: '/w/.lanes/web-everything/lane-3', 110: '/w/.lanes/web-everything/lane-30', 120: '/w/.lanes/web-everything/lane-3' }, sessionByPid: roster, holders: holderTable({ admission, rows, nowMs: T0 }), nowMs: T0 });

  it('a vitest tree under an npm wrapper is ONE run; verify-lane owns the vitest and check-standards it spawns; grep is not a run', () => {
    expect(runs.map((r) => [r.rootPid, r.family])).toEqual([[101, 'vitest'], [110, 'check-standards'], [120, 'verify-lane']]);
    expect(runs[0].treePids).toEqual([101, 102, 103]);
    expect(runs[2].treePids).toEqual([120, 121, 122]);
    expect(runs[2].childFamilies).toEqual({ 'check-standards': 1, 'verify-lane': 1, vitest: 1 });
  });

  it('carries lane, session, holder, start (exact, from etime) and tree totals', () => {
    expect(runs[0]).toMatchObject({ lane: 'web-everything/lane-3', cpuPct: 500.5, procs: 3, startMs: T0 - 60_000, holder: { id: 'slot-0:lane-3' } });
    expect(runs[0].rssBytes).toBe((10_000 + 700_000 + 600_000) * 1024);
    expect(runs[1]).toMatchObject({ lane: 'web-everything/lane-30', holder: null, session: null });
    expect(runs[2].session).toEqual({ name: 'build-9', kind: 'build' });
  });
});

describe('stepEpisodes — the edge-triggered episode builder over a fixture process table with start/end edges', () => {
  const tree = (extra = []) => [
    row(100, 1, 1, 30_000, 'node scripts/readiness/heavy-admission.mjs run -- npm run test:unit', 20),
    row(101, 100, 0.5, 10_000, 'npm run test:unit', 20),
    row(102, 101, 300, 700_000, 'node (vitest)', 19),
    ...extra,
  ];
  const checkStd = (etime) => row(110, 1, 90, 500_000, 'node scripts/check-standards.mjs', etime);
  const cwds = { 100: '/w/.lanes/web-everything/lane-3', 110: '/w/.lanes/web-everything/lane-30' };
  const admissionAt = (now) => ({ held: [{ slot: 0, owner: '/w/.lanes/web-everything/lane-3', pid: 100, heartbeatAt: new Date(now - 20_000).toISOString() }], waiting: [] });
  const runsAt = (rows, now) => findHeavyRuns({ rows, lanes: LANES, cwds, holders: holderTable({ admission: admissionAt(now), rows, nowMs: now }), nowMs: now });
  const ctx = (o = {}) => ({ activeLanes: 2, workersLive: 5, busyPct: 60, idlePct: 40, ...o });
  // the waiter that became the holder was seen waiting 30 s before it got its slot 20 s ago
  const waiters = { 100: T0 - 50_000 };

  // sample 1 (T0): vitest (20 s old) + check-standards (5 s old); sample 2 (+30 s): both, busier; sample 3 (+60 s): check-standards gone; sample 4 (+90 s): vitest gone
  const s1 = stepEpisodes({ prev: undefined, runs: runsAt(tree([checkStd(5)]), T0), probe: { cpu: { 101: 0.5, 102: 20, 110: 4 }, threads: { 102: 30, 101: 8, 110: 12 } }, ctx: ctx(), waiters, nowMs: T0, intervalS: 30 });
  const T1 = T0 + 30_000;
  const s2 = stepEpisodes({ prev: s1.next, runs: runsAt(tree([checkStd(5)]).map((r) => ({ ...r, etimeS: r.etimeS + 30 })), T1), probe: { cpu: { 101: 1, 102: 80, 110: 30 }, threads: { 102: 60, 101: 8, 110: 20 } }, ctx: ctx({ activeLanes: 3, busyPct: 90, idlePct: 10, workersLive: 7 }), waiters: {}, nowMs: T1, intervalS: 30 });
  const T2 = T0 + 60_000;
  const s3 = stepEpisodes({ prev: s2.next, runs: runsAt(tree().map((r) => ({ ...r, etimeS: r.etimeS + 60 })), T2), probe: { cpu: { 101: 2, 102: 140 }, threads: { 102: 40 } }, ctx: ctx({ activeLanes: 2, busyPct: 70 }), waiters: {}, nowMs: T2, intervalS: 30 });
  const T3 = T0 + 90_000;
  const s4 = stepEpisodes({ prev: s3.next, runs: [], probe: {}, ctx: ctx({ activeLanes: 1, busyPct: 20 }), waiters: {}, nowMs: T3, intervalS: 30 });

  it('the first sample records what is in flight and finishes nothing', () => {
    expect(s1.finished).toEqual([]);
    expect(Object.keys(s1.next)).toHaveLength(2);
    expect(Object.keys(s1.next).sort()).toEqual([`hr-101-${Math.round((T0 - 20_000) / 1000)}`, `hr-110-${Math.round((T0 - 5_000) / 1000)}`]);
    expect(s2.finished).toEqual([]);
  });

  it('an EDGE: the run that vanished is finished exactly once, with start, midpoint end, wall time and its own concurrency', () => {
    expect(s3.finished).toHaveLength(1);
    const e = s3.finished[0];
    expect(e).toMatchObject({ family: 'check-standards', lane: 'web-everything/lane-30', calibration: false, admitted: false, admission_holder: null, root_pid: 110 });
    expect(e.start).toBe(new Date(T0 - 5_000).toISOString());
    expect(e.end).toBe(new Date(T1 + 15_000).toISOString()); // last seen T1, first missed T2: the midpoint
    expect(e.wall_s).toBe(50);
    expect(e.end_uncertainty_s).toBe(15);
    expect(s4.finished).toHaveLength(1);
    expect(s4.finished[0].family).toBe('vitest');
    expect(s3.finished.concat(s4.finished).every((x) => x.start && x.end)).toBe(true);
  });

  it('CPU-seconds is the LARGER of the survivors\' cumulative CPU and the %cpu integral (both under-count); peak RSS, procs and threads are the tree maxima', () => {
    const v = s4.finished[0];
    expect(v.cpu_s_cumulative).toBe(142); // 101: 2 + 102: 140 (cumulative time of the survivors)
    expect(v.cpu_s_integral).toBe(180.3); // 300.5 % of a core x (30 s + 30 s)
    expect(v.cpu_s).toBe(180.3);
    expect(v.peak_procs).toBe(2); // the npm wrapper and the vitest worker (the admission wrapper above the root is the holder, not the run)
    expect(v.peak_threads).toBe(68); // s2: 60 + 8
    expect(v.peak_rss_bytes).toBe((10_000 + 700_000) * 1024);
    expect(v.peak_cpu_pct).toBe(300.5);
    expect(v.avg_cores).toBeCloseTo(180.3 / v.wall_s, 2);
  });

  it('is admitted through the pool and its admission WAIT is the gap between the waiting marker and the slot', () => {
    const v = s4.finished[0];
    expect(v).toMatchObject({ admitted: true, admission_holder: 'slot-0:lane-3', lane: 'web-everything/lane-3', admission_wait_s: 30 });
  });

  it('concurrency at start, at peak, time-weighted mean, active lanes, live workers, host busy/idle at start', () => {
    const v = s4.finished[0];
    expect(v).toMatchObject({ conc_start: 2, conc_peak: 2, active_lanes_start: 2, active_lanes_peak: 3, workers_start: 5, workers_peak: 7, busy_pct_start: 60, idle_pct_start: 40, busy_pct_peak: 90 });
    // beside the checker for T0..T1 (2 in flight, 30 s), alone for T1..T2 (1 in flight, 30 s): (2*30 + 1*30) / 60
    expect(v.conc_mean).toBeCloseTo(1.5, 2);
    const c = s3.finished[0];
    expect(c.conc_start).toBe(2);
  });

  it('a run already going before the sampler first saw it is flagged, its start still exact', () => {
    const r = stepEpisodes({ prev: undefined, runs: runsAt([checkStd(600)], T0), probe: {}, ctx: ctx(), nowMs: T0, intervalS: 30 });
    const fin = stepEpisodes({ prev: r.next, runs: [], probe: {}, ctx: ctx(), nowMs: T0 + 30_000, intervalS: 30 });
    expect(fin.finished[0]).toMatchObject({ started_before_first_seen: true, start: new Date(T0 - 600_000).toISOString() });
  });

  it('a REUSED pid with a different start is a different run', () => {
    const a = stepEpisodes({ prev: undefined, runs: runsAt([checkStd(100)], T0), probe: {}, ctx: ctx(), nowMs: T0, intervalS: 30 });
    const b = stepEpisodes({ prev: a.next, runs: runsAt([checkStd(2)], T0 + 30_000), probe: {}, ctx: ctx(), nowMs: T0 + 30_000, intervalS: 30 });
    expect(b.finished).toHaveLength(1);
    expect(Object.keys(b.next)).toHaveLength(1);
    expect(START_TOLERANCE_MS).toBeGreaterThan(0);
  });

  it('a run whose holder is INSIDE its tree is recorded as admitted', () => {
    const rows = [row(300, 1, 0, 1000, '/bin/bash -c eval node scripts/verify-lane.mjs check', 40), row(301, 300, 50, 50_000, 'node scripts/verify-lane.mjs check', 40)];
    const adm = { held: [{ slot: 1, owner: '/w/.lanes/web-everything/lane-3', pid: 301, heartbeatAt: new Date(T0 - 10_000).toISOString() }], waiting: [] };
    const [run] = findHeavyRuns({ rows, lanes: LANES, cwds: { 300: '/w/.lanes/web-everything/lane-3' }, holders: holderTable({ admission: adm, rows, nowMs: T0 }), nowMs: T0 });
    expect(run).toMatchObject({ rootPid: 300, family: 'verify-lane', holder: { id: 'slot-1:lane-3' } });
  });

  it('with no per-process CPU probe the CPU-seconds fall back to the integral of the tree %cpu', () => {
    const a = stepEpisodes({ prev: undefined, runs: runsAt([checkStd(10)], T0), probe: {}, ctx: ctx(), nowMs: T0, intervalS: 30 });
    const b = stepEpisodes({ prev: a.next, runs: runsAt([checkStd(40)], T0 + 30_000), probe: {}, ctx: ctx(), nowMs: T0 + 30_000, intervalS: 30 });
    const c = stepEpisodes({ prev: b.next, runs: [], probe: {}, ctx: ctx(), nowMs: T0 + 60_000, intervalS: 30 });
    expect(c.finished[0].cpu_s).toBe(27); // 90 % of one core x 30 s
    expect(c.finished[0].cpu_s_cumulative).toBe(0);
  });

  it('the record has the documented fields, fits one telemetry line, and is in the closed vocabulary', () => {
    for (const f of ['id', 'calibration', 'family', 'lane', 'session', 'worker_kind', 'start', 'end', 'wall_s', 'cpu_s', 'peak_rss_bytes', 'peak_procs', 'peak_threads', 'admitted', 'admission_wait_s', 'conc_start', 'conc_peak', 'active_lanes_start', 'workers_start', 'busy_pct_start', 'idle_pct_start']) expect(EPISODE_FIELDS).toContain(f);
    expect(METRIC_NAMES).toContain('heavy.run.episode');
    const rec = newMetric({ name: 'heavy.run.episode', kind: 'sampler', value: s4.finished[0].wall_s, unit: 'count', timestamp: new Date(T3).toISOString(), attributes: { source: 'host-sampler', sample: 'x', schema: 2, quality: 'ok', ...s4.finished[0] }, resource: resourceAttributes() });
    expect(validateTelemetryEvent(rec).ok).toBe(true);
    expect(Buffer.byteLength(serializeTelemetryEvent(rec))).toBeLessThan(MAX_LINE_BYTES);
    expect(serializeTelemetryEvent(rec)).not.toContain('_truncated');
  });

  it('nextWaiters keeps a marker for one more sample so the run that just got its slot can still read it', () => {
    const now = { waiting: [{ pid: 7, requestedAt: new Date(T0).toISOString() }] };
    const a = nextWaiters({}, now, T0);
    expect(a).toEqual({ 7: T0 });
    expect(nextWaiters(a, { waiting: [] }, T0 + 30_000)).toEqual({ 7: T0 });
    expect(nextWaiters(a, { waiting: [] }, T0 + 2 * 86_400_000)).toEqual({});
  });

  it('episodeRecord tolerates a bare state (defaults, no NaN)', () => {
    const r = episodeRecord({ id: 'x', startMs: T0, firstSeenMs: T0, lastSeenMs: T0, cpuByPid: {}, atStart: {}, peakOthers: 0, peakCpuPct: 0, peakRss: 0, peakProcs: 0, peakThreads: 0, cpuIntegralS: 0, concIntegral: 0, concDt: 0, samples: 0 }, { endedBetween: [T0, T0], intervalS: 30 });
    expect(r).toMatchObject({ wall_s: 0, cpu_s: 0, avg_cores: null, conc_mean: 1 });
    expect(Object.values(r).every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v))).toBe(true);
  });
});

describe('hardware profile', () => {
  const APPLE = `hw.ncpu: 12
hw.physicalcpu: 12
hw.logicalcpu: 12
hw.perflevel0.physicalcpu: 8
hw.perflevel1.physicalcpu: 4
hw.memsize: 68719476736
hw.model: Mac14,6
machdep.cpu.brand_string: Apple M2 Max
kern.osproductversion: 26.6.2
kern.osversion: 25G83
`;
  const INTEL = `hw.ncpu: 16
hw.physicalcpu: 8
hw.logicalcpu: 16
hw.memsize: 34359738368
hw.model: MacBookPro16,1
machdep.cpu.brand_string: Intel(R) Core(TM) i9-9980HK CPU @ 2.40GHz
kern.osproductversion: 14.5
kern.osversion: 23F79
`;
  it('parses an Apple Silicon machine: cores, the performance/efficiency split, memory, chip, model, OS', () => {
    expect(parseHardwareProfile(APPLE)).toEqual({
      ncpu: 12, physicalCpu: 12, logicalCpu: 12, performanceCores: 8, efficiencyCores: 4, memBytes: 68_719_476_736, memGiB: 64, chip: 'Apple M2 Max', model: 'Mac14,6', osVersion: '26.6.2', osBuild: '25G83', architecture: 'apple-silicon',
    });
  });
  it('parses an Intel machine: no perflevel keys means a null split, hyperthreads show as ncpu > physical', () => {
    expect(parseHardwareProfile(INTEL)).toEqual({
      ncpu: 16, physicalCpu: 8, logicalCpu: 16, performanceCores: null, efficiencyCores: null, memBytes: 34_359_738_368, memGiB: 32, chip: 'Intel(R) Core(TM) i9-9980HK CPU @ 2.40GHz', model: 'MacBookPro16,1', osVersion: '14.5', osBuild: '23F79', architecture: 'intel',
    });
  });
  it('an unknown-oid line, blank input and junk are tolerated', () => {
    expect(parseHardwareProfile(`sysctl: unknown oid 'hw.nonexistent'\n${INTEL}`).ncpu).toBe(16);
    expect(parseHardwareProfile('')).toBeNull();
    expect(parseHardwareProfile(null)).toBeNull();
    expect(parseHardwareProfile('random: text')).toBeNull();
    expect(HARDWARE_KEYS).toEqual(expect.arrayContaining(['hw.ncpu', 'hw.memsize', 'hw.perflevel0.physicalcpu', 'hw.perflevel1.physicalcpu', 'machdep.cpu.brand_string']));
  });
  it('is due once per sampler start and once a day after', () => {
    expect(hardwareProfileDue({ emittedThisProcess: false, lastAtMs: T0, nowMs: T0 + 1000 })).toBe(true);
    expect(hardwareProfileDue({ emittedThisProcess: true, lastAtMs: T0, nowMs: T0 + 3_600_000 })).toBe(false);
    expect(hardwareProfileDue({ emittedThisProcess: true, lastAtMs: T0, nowMs: T0 + 25 * 3_600_000 })).toBe(true);
    expect(hardwareProfileDue({ emittedThisProcess: true, lastAtMs: undefined, nowMs: T0 })).toBe(true);
  });
});

// ── the lane load model ─────────────────────────────────────────────────────────────────────────────────

const ep = (o) => ({ id: `e${Math.random()}`, calibration: false, family: 'vitest', lane: 'web-everything/lane-1', wall_s: 100, cpu_s: 300, avg_cores: 3, peak_cpu_pct: 450, peak_rss_bytes: 1e9, admitted: true, admission_wait_s: 0, conc_mean: 1, conc_start: 1, ...o });
/** A schema-2 sample carrying zero or more finished episodes. */
function sampleWith(i, { episodes = [], lanes, leased, roots, atMs } = {}) {
  const at = new Date(T0 + (atMs ?? i * 30_000)).toISOString();
  const base = { source: 'host-sampler', sample: `s${i}`, mode: 'normal', interval_s: 30, schema: 2, quality: 'ok' };
  const m = (name, value, attributes = {}) => ({ v: 1, event: 'metric', name, kind: 'sampler', value, unit: 'count', timestamp: at, attributes: { ...base, ...attributes }, resource: {} });
  const out = [m('host.cpu.load1', 4), m('host.cpu.count', 12), m('host.cpu.busy_pct', 40, { idle_pct: 60 }), m('host.class.cpu_pct', 0, { 'cpu.vitest': 0 }), m('host.class.count', 0, { 'n.vitest': 0 })];
  if (lanes) { const a = { share: 0.5, unlaned_cpu: 1 }; for (const [k, v] of Object.entries(lanes)) { a[`cpu.${k}`] = v.cpu; a[`mem.${k}`] = 1; a[`n.${k}`] = 1; a[`hcpu.${k}`] = v.heavy ?? 0; } out.push(m('lane.attribution.cpu_pct', 0, a)); }
  if (leased != null) out.push(m('lane.pool.leased', leased));
  if (roots != null) out.push(m('host.heavy.roots', roots, { by_class: '', unadmitted_cpu: 0, unadmitted_n: 0, held: 0, cap: 2 }));
  for (const e of episodes) out.push(m('heavy.run.episode', e.wall_s, e));
  return out;
}

describe('concurrency bins and slowdown math', () => {
  it('bins the time-weighted mean concurrency: 1, 2, 3, 4+ (floor 1)', () => {
    expect([0.4, 1, 1.4, 1.5, 2.4, 2.6, 3.5, 4, 9].map(concurrencyBin)).toEqual(['1', '1', '1', '2', '2', '3', '4+', '4+', '4+']);
  });

  const events = [];
  let i = 0;
  const add = (n, o) => { for (let k = 0; k < n; k++) events.push(sampleWith(i++, { episodes: [ep(o)] })); };
  add(6, { conc_mean: 1, wall_s: 100, cpu_s: 300 });
  add(6, { conc_mean: 2, wall_s: 150, cpu_s: 300 });
  add(3, { conc_mean: 3, wall_s: 210, cpu_s: 300 });
  add(5, { conc_mean: 4.2, wall_s: 300, cpu_s: 310 });
  add(5, { conc_mean: 1, family: 'check-standards', wall_s: 40, cpu_s: 60 }); // a second family with only a solo bin
  const model = buildLaneLoadModel({ samples: groupSamples(events.flat()), days: 1 });

  it('wall time per bin and the SLOWDOWN factor versus the solo baseline, with the sample count per bin', () => {
    const b = model.wallByConcurrency.vitest.bins;
    expect(b['1']).toMatchObject({ n: 6, slowdown: 1, wallS: { p50: 100 } });
    expect(b['2']).toMatchObject({ n: 6, slowdown: 1.5, wallS: { p50: 150 } });
    expect(b['4+']).toMatchObject({ n: 5, slowdown: 3 });
  });

  it('slowdown per unit of work removes the size difference (wall per CPU-second)', () => {
    const b = model.wallByConcurrency.vitest.bins;
    expect(b['2'].slowdownPerWork).toBe(1.5);
    expect(b['4+'].slowdownPerWork).toBe(2.9); // (300/310) / (100/300) = 2.903
  });

  it('says "not enough data" for a bin under 5 runs, and for a family with no solo baseline of its own', () => {
    expect(model.wallByConcurrency.vitest.bins['3']).toMatchObject({ n: 3, wallS: 'not enough data', slowdown: 'not enough data' });
    const cs = model.wallByConcurrency['check-standards'].bins;
    expect(cs['1'].slowdown).toBe(1);
    expect(cs['2']).toMatchObject({ n: 0, slowdown: 'not enough data' });
    expect(LANE_LOAD.minN).toBe(5);
  });

  it('per family: CPU-seconds per run, cores used, peak RSS, wall, admitted share, with a sufficiency line', () => {
    const v = model.perFamily.vitest;
    expect(v.runs).toBe(20);
    expect(v.cpuSecondsPerRun).toMatchObject({ p50: 300, p90: 310 });
    expect(v.peakCoresUsed.p50).toBe(4.5);
    expect(v.peakRssBytes.p50).toBe(1e9);
    expect(v.admittedShare).toBe(1);
    expect(v.sufficiency).toMatchObject({ n: 20, verdict: 'thin', days: 1 });
    expect(v.sufficiency.line).toContain('fewer than 3 days: preliminary');
    expect(model.perFamily['check-standards'].sufficiency.verdict).toBe('thin'); // 5 runs
  });

  it('sufficiency: not enough / thin / ok, and always says how many days', () => {
    expect(sufficiency(4, 5).verdict).toBe('not enough data');
    expect(sufficiency(29, 5).verdict).toBe('thin');
    expect(sufficiency(30, 5)).toMatchObject({ verdict: 'ok', line: 'n=30 samples over 5 days: ok' });
    expect(sufficiency(30, 1).line).toContain('preliminary');
  });

  it('CALIBRATION runs never mix into the real tables: they get their own', () => {
    const cal = [];
    for (let k = 0; k < 5; k++) cal.push(sampleWith(100 + k, { episodes: [ep({ calibration: true, lane: 'calibration', conc_mean: 1, wall_s: 50, cpu_s: 100 })] }));
    for (let k = 0; k < 5; k++) cal.push(sampleWith(110 + k, { episodes: [ep({ calibration: true, lane: 'calibration', conc_mean: 2, wall_s: 80, cpu_s: 100 })] }));
    const m = buildLaneLoadModel({ samples: groupSamples([...events.flat(), ...cal.flat()]), days: 1 });
    expect(m.heavyRuns).toEqual({ real: 25, calibration: 10 });
    expect(m.perFamily.vitest.runs).toBe(20);
    expect(m.calibration.vitest.bins['2']).toMatchObject({ n: 5, slowdown: 1.6 });
    expect(m.perLane).not.toHaveProperty('calibration');
  });
});

describe('per-lane load and the active-lanes x heavy-runs table', () => {
  const list = [];
  for (let i = 0; i < 20; i++) {
    const heavy = i < 8;
    list.push(sampleWith(i, {
      lanes: { 'web-everything/lane-1': { cpu: heavy ? 300 : 5, heavy: heavy ? 280 : 0 }, 'web-everything/lane-2': { cpu: 0.2 } },
      leased: i < 10 ? 2 : 1, roots: i < 4 ? 2 : i < 8 ? 1 : 0,
      episodes: i % 5 === 0 ? [ep({ lane: 'web-everything/lane-1' })] : [],
    }));
  }
  const m = buildLaneLoadModel({ samples: groupSamples(list.flat()), days: 1 });
  const l1 = m.perLane['web-everything/lane-1'];

  it('heavy runs per hour, heavy duty cycle and the lane\'s marginal host CPU in heavy versus light phases', () => {
    expect(l1.heavyRuns).toBe(4);
    expect(l1.activeHours).toBeCloseTo(20 * 30 / 3600, 2);
    expect(l1.heavyRunsPerActiveHour).toBe(24);
    expect(l1.heavyDutyCycle).toBe(0.4);
    expect(l1.marginalHostCpuPct).toMatchObject({ heavyPhaseP50: 300, lightPhaseP50: 5, heavyMinusLight: 295, heavySamples: 8, lightSamples: 12 });
    expect(l1.sufficiency.verdict).toBe('thin');
  });

  it('a lane that never exceeds the activity floor has no duty cycle rather than a made-up one', () => {
    const l2 = m.perLane['web-everything/lane-2'];
    expect(l2.heavyDutyCycle).toBeNull();
    expect(l2.sufficiency.verdict).toBe('not enough data');
  });

  it('the joint table: share of TIME in each cell of active lanes x concurrent heavy runs, with n', () => {
    const c = m.activeLanesByHeavyRuns.cells;
    expect(c['2']).toEqual({ 1: { n: 4, timeShare: 0.2 }, 2: { n: 4, timeShare: 0.2 }, 0: { n: 2, timeShare: 0.1 } });
    expect(c['1']).toEqual({ 0: { n: 10, timeShare: 0.5 } });
    const total = Object.values(c).flatMap((r) => Object.values(r)).reduce((t, x) => t + x.timeShare, 0);
    expect(total).toBeCloseTo(0.9 + 0.1 - 0.1 + 0.1, 1);
    expect(m.activeLanesByHeavyRuns.sufficiency.n).toBe(20);
  });

  it('is part of the daily rollup as reservation-inputs.lane-load-model and renders as text', () => {
    const r = buildCapacityRollup(groupSamples(list.flat()));
    expect(r['reservation-inputs']['lane-load-model'].heavyRuns.real).toBe(4);
    const text = renderLaneLoad(m);
    expect(text).toContain('lane load model: 4 heavy runs');
    expect(text).toContain('lane web-everything/lane-1');
    expect(text).toContain('active lanes x heavy runs');
  });
});

describe('lane-load CLI (real files, real reader)', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hs-laneload-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks(); });
  it('reads the last N day files (raw or gzipped) and builds ONE model across them', async () => {
    const { writeFileSync } = await import('node:fs');
    const { gzipSync } = await import('node:zlib');
    const day = (d, n) => Array.from({ length: n }, (_, i) => sampleWith(i, { atMs: i * 30_000, episodes: [ep({ conc_mean: 1 })] }).map((e) => JSON.stringify({ ...e, timestamp: new Date(Date.parse(`${d}T10:00:00.000Z`) + i * 30_000).toISOString(), attributes: { ...e.attributes, sample: `${d}#${i}` } })).join('\n')).join('\n');
    writeFileSync(join(dir, '2026-09-20.jsonl.gz'), gzipSync(`${day('2026-09-20', 6)}\n`));
    writeFileSync(join(dir, '2026-09-21.jsonl'), `${day('2026-09-21', 6)}\n`);
    const { model, days } = readLaneLoadModel({ dir, nowMs: Date.parse('2026-09-21T23:00:00.000Z'), days: 7 });
    expect(days).toEqual(['2026-09-20', '2026-09-21']);
    expect(model.days).toBe(2);
    expect(model.perFamily.vitest.runs).toBe(12);
    expect(model.perFamily.vitest.sufficiency.days).toBe(2);
    const out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; });
    expect(await main(['lane-load', `--dir=${dir}`, '--days=1', '--json'], {})).toBe(0);
    expect(JSON.parse(out.join('')).days).toBeGreaterThanOrEqual(1);
  });
  it('an empty directory is an empty model, not an error', () => {
    expect(readLaneLoadModel({ dir: join(dir, 'none'), nowMs: T0 }).model.heavyRuns).toEqual({ real: 0, calibration: 0 });
  });
});

// ── the calibration hook, with a FAKE runner ────────────────────────────────────────────────────────────

describe('calibrate (fake runner: the real one is never started)', () => {
  const fake = () => {
    const calls = [];
    // 1 copy takes 100 s; k concurrent copies take 100 * k^0.5 s each (a made-up contention curve)
    const runner = async (job) => { calls.push(job); return { wallS: Math.round(100 * Math.sqrt(job.level)), userS: 280, sysS: 20, maxRssBytes: 1e9, exitCode: 0 }; };
    return { runner, calls };
  };

  it('parseLevels validates; level 1 is always in the plan (it is the solo baseline)', () => {
    expect(parseLevels('1,2,3,4')).toEqual([1, 2, 3, 4]);
    expect(parseLevels('4, 2,2')).toEqual([2, 4]);
    for (const bad of ['', '0', '9', '1,x', '1.5', undefined]) expect(parseLevels(bad)).toBeNull();
    const p = planCalibration({ family: 'vitest', levels: [2, 4] });
    expect(p.levels).toEqual([1, 2, 4]);
    expect(p.totalRuns).toBe(1 + 2 + 4);
    expect(p.directories).toBe(4);
    expect(planCalibration({ family: 'nope', levels: [1] }).error).toContain('unknown family');
    expect(REFERENCE_WORKLOADS.vitest.name).toMatch(/-v\d+$/);
  });

  it('DEFAULTS TO A DRY RUN: without --yes, or with --dry-run, the runner is never called and the plan is printed', async () => {
    for (const o of [{}, { yes: false, dryRun: false }, { yes: true, dryRun: true }, { dryRun: true }]) {
      const f = fake();
      const r = await runCalibration({ family: 'vitest', levels: [1, 2], runner: f.runner, ...o });
      expect(r.ran).toBe(false);
      expect(f.calls).toHaveLength(0);
      expect(r.text).toContain('DRY RUN');
    }
  });

  it('with --yes it runs each level (k copies together, each in its own directory) and prints the slowdown curve', async () => {
    const f = fake(); const written = []; const cleaned = [];
    let t = T0;
    const r = await runCalibration({
      family: 'vitest', levels: [1, 2, 4], yes: true, dryRun: false, runner: f.runner, prepareDir: (i) => `/tmp/cal-${i}`, cleanupDir: (d) => cleaned.push(d), now: () => (t += 1000), record: (rec) => written.push(rec),
    });
    expect(r.ran).toBe(true);
    expect(f.calls).toHaveLength(1 + 2 + 4);
    expect(f.calls.filter((c) => c.level === 4).map((c) => c.cwd).sort()).toEqual(['/tmp/cal-0', '/tmp/cal-1', '/tmp/cal-2', '/tmp/cal-3']);
    expect(cleaned.sort()).toEqual(['/tmp/cal-0', '/tmp/cal-1', '/tmp/cal-2', '/tmp/cal-3']);
    expect(written).toHaveLength(7);
    expect(written.every((w) => w.calibration === true && w.lane === 'calibration' && w.workload === REFERENCE_WORKLOADS.vitest.name)).toBe(true);
    expect(written[0]).toMatchObject({ family: 'vitest', conc_mean: 1, wall_s: 100, cpu_s: 300, admitted: false });
    expect(r.curve.map((c) => [c.concurrency, c.n, c.wallS, c.slowdown])).toEqual([[1, 1, 100, 1], [2, 2, 141, 1.41], [4, 4, 200, 2]]);
    expect(r.text).toContain('slowdown');
  });

  it('slowdownCurve compares wall AND wall-per-CPU-second with the solo level', () => {
    const recs = [{ conc_mean: 1, wall_s: 100, cpu_s: 300, avg_cores: 3, peak_rss_bytes: 1 }, { conc_mean: 2, wall_s: 200, cpu_s: 400, avg_cores: 2, peak_rss_bytes: 1 }];
    expect(slowdownCurve(recs)).toEqual([
      { concurrency: 1, n: 1, wallS: 100, slowdown: 1, slowdownPerWork: 1, avgCores: 3, peakRssBytes: 1 },
      { concurrency: 2, n: 1, wallS: 200, slowdown: 2, slowdownPerWork: 1.5, avgCores: 2, peakRssBytes: 1 },
    ]);
  });

  it('parses the macOS `/usr/bin/time -l` block', () => {
    const t = parseTimeOutput('        1.17 real         0.64 user         0.32 sys\n           273448960  maximum resident set size\n');
    expect(t).toEqual({ realS: 1.17, userS: 0.64, sysS: 0.32, maxRssBytes: 273_448_960 });
    expect(parseTimeOutput('nothing')).toBeNull();
  });

  describe('through the CLI', () => {
    let dir; let prev;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hs-cal-')); prev = process.env.OPERATION_TELEMETRY_DIR; process.env.OPERATION_TELEMETRY_DIR = dir; });
    afterEach(() => { if (prev === undefined) delete process.env.OPERATION_TELEMETRY_DIR; else process.env.OPERATION_TELEMETRY_DIR = prev; rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks(); });

    it('without --yes: prints the plan, calls nothing, writes nothing', async () => {
      const f = fake(); const out = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; });
      expect(await main(['calibrate', '--family=vitest', '--concurrency=1,2,3,4'], {}, { runner: f.runner })).toBe(0);
      expect(f.calls).toHaveLength(0);
      expect(out.join('')).toContain('DRY RUN');
      expect(await main(['calibrate', '--family=vitest', '--concurrency=1,2', '--yes', '--dry-run'], {}, { runner: f.runner })).toBe(0);
      expect(f.calls).toHaveLength(0);
    });

    it('rejects a bad family or level list', async () => {
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      expect(await main(['calibrate', '--family=vitest', '--concurrency=0'], {})).toBe(2);
      expect(await main(['calibrate', '--family=cobol', '--concurrency=1,2'], {})).toBe(2);
    });

    it('with --yes and a fake runner: writes calibration episode records the rollup keeps apart', async () => {
      const f = fake();
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      expect(await main(['calibrate', '--family=vitest', '--concurrency=1,2', '--yes'], {}, { runner: f.runner, prepareDir: (i) => `/tmp/x-${i}`, cleanupDir: () => {} })).toBe(0);
      expect(f.calls).toHaveLength(3);
      const files = (await import('node:fs')).readdirSync(dir);
      const events = parseTelemetryLines(readFileSync(join(dir, files[0]), 'utf8')).events;
      expect(events).toHaveLength(9); // per run: the episode + the host load1 and core count it travels with
      const epis = events.filter((e) => e.name === 'heavy.run.episode');
      expect(epis).toHaveLength(3);
      expect(epis.every((e) => e.attributes.calibration === true && e.attributes.mode === 'calibration')).toBe(true);
      expect(events.every((e) => validateTelemetryEvent(e).ok)).toBe(true);
      const model = buildLaneLoadModel({ samples: groupSamples(events), days: 1 });
      expect(model.heavyRuns).toEqual({ real: 0, calibration: 3 });
      expect(model.perFamily).toEqual({});
    });
  });
});
