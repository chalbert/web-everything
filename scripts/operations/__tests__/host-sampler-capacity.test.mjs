import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSample, main, resetHardwareEmitted, runOnce, sampleToMetrics } from '../host-sampler.mjs';
import { buildDailyRollup } from '../host-sampler-retention.mjs';
import { pressureSamples, replayPressure } from '../host-sampler-rollup.mjs';
import { GUARD_TIERS } from '../host-sampler-retention.mjs';
import { parsePsWide } from '../host-sampler-extras.mjs';
import { METRIC_NAMES, METRIC_UNITS, MAX_LINE_BYTES, parseTelemetryLines, validateTelemetryEvent } from '../telemetry.mjs';
import { createFileTelemetryStore, newMetric, resourceAttributes, serializeTelemetryEvent } from '../telemetry-store.mjs';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const AT = new Date(NOW).toISOString();
const PS = [
  '  100     1  1.0   30000     15:00 node scripts/readiness/heavy-admission.mjs run -- npm run test:unit',
  '  101   100  0.5   10000     15:00 npm run test:unit',
  '  102   101 300.0  700000     14:00 node (vitest)',
  '  110     1 90.0  500000     10:00 node scripts/check-standards.mjs',
  '  120     1  2.0  300000  01-00:00 claude bg-spare --bg-spare /tmp/x.claim.sock',
  '  130     1 100.0  10000  21-00:00 /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/Support/fseventsd',
].join('\n');
const HOST = { load: [14.25, 10, 8], cpuCount: 12, freeBytes: 8e9, totalBytes: 64e9, hwNcpu: 12, physicalCpu: 12 };
const LANES = [{ pool: 'web-everything', lane: 'lane-3', path: '/w/.lanes/web-everything/lane-3', lease: null }];
const raw = (over = {}) => ({
  at: AT, nowMs: NOW, host: HOST, psRows: parsePsWide(PS), agents: { agents: [{ sessionId: 's1', name: 'build-1', kind: 'background', state: 'working', pid: 120, cwd: '/w/.lanes/web-everything/lane-3', startedAt: NOW - 5000 }], facts: {} },
  sessionsAgeS: 3, lanes: LANES, cwds: { 100: '/w/.lanes/web-everything/lane-3' }, extras: { mem: { availableBytes: 1e10 }, swap: { pressureLevel: 1 } },
  admission: { cap: 2, heldCount: 1, freeCount: 1, held: [{ slot: 0, owner: '/w/.lanes/web-everything/lane-3', pid: 100, heartbeatAt: new Date(NOW - 600_000).toISOString() }], waiting: [], staleWaiting: [{ owner: '/w/.lanes/web-everything/lane-27', pid: null, requestedAt: '2026-09-04T15:04:58.681Z' }] },
  probe: { spawnMs: 40, spinOvershootMs: 0 }, tier: GUARD_TIERS[0], mode: 'normal', intervalS: 30,
  hostCpu: { userPct: 50, sysPct: 20, nicePct: 0, idlePct: 30, busyPct: 70, coreBusyMax: 99, coresOver90: 2, cores: 12, windowS: 30, source: 'interval-delta' },
  workerState: { prev: {}, prevMs: NOW - 30_000 }, childFailed: [],
  ...over,
});

describe('schema 2 records', () => {
  const metrics = sampleToMetrics(buildSample(raw()));
  const byName = (n) => metrics.filter((m) => m.name === n);

  it('are additive: every schema-1 metric is still emitted with the same value, plus the schema-2 ones', () => {
    const v1 = sampleToMetrics(buildSample(raw())).map((m) => m.name);
    for (const n of ['host.cpu.load1', 'host.family.cpu_pct', 'lane.pool.leased', 'heavy.admission.cap', 'host.mem.available_bytes']) expect(v1).toContain(n);
    for (const n of ['host.cpu.busy_pct', 'host.class.cpu_pct', 'host.class.count', 'host.class.mem_bytes', 'lane.attribution.cpu_pct', 'host.heavy.roots', 'heavy.admission.holder', 'heavy.admission.stale_markers', 'host.workers.live', 'dispatch.worker.event']) expect(v1, n).toContain(n);
  });

  it('every record is in the closed vocabulary, valid, under the line cap, and stamped schema 2 + quality', () => {
    for (const m of metrics) {
      expect(METRIC_NAMES).toContain(m.name);
      expect(METRIC_UNITS).toContain(m.unit);
      expect(m.attributes).toMatchObject({ schema: 2, source: 'host-sampler' });
      expect(['ok', 'partial']).toContain(m.attributes.quality);
      const rec = newMetric({ name: m.name, kind: 'sampler', value: m.value, unit: m.unit, timestamp: AT, attributes: m.attributes, resource: resourceAttributes() });
      expect(validateTelemetryEvent(rec).ok, m.name).toBe(true);
      expect(Buffer.byteLength(serializeTelemetryEvent(rec)), m.name).toBeLessThan(MAX_LINE_BYTES);
      expect(serializeTelemetryEvent(rec)).not.toContain('_truncated');
    }
  });

  it('carry the true host CPU with hw.ncpu, the per-class figures, the lane, holder, stale markers and the worker start event', () => {
    expect(byName('host.cpu.busy_pct')[0]).toMatchObject({ value: 70, unit: 'percent', attributes: { user_pct: 50, sys_pct: 20, idle_pct: 30, ncpu: 12, hw_ncpu: 12, window_s: 30, cpu_source: 'interval-delta' } });
    expect(byName('host.class.cpu_pct')[0].attributes).toMatchObject({ 'cpu.vitest': 300.5, 'cpu.check-standards': 90, 'cpu.system-macos': 100, 'cpu.claude-background-worker': 2 });
    expect(byName('host.class.count')[0].attributes['n.vitest']).toBe(2); // the npm wrapper and the vitest worker
    expect(byName('lane.attribution.cpu_pct')[0].attributes).toMatchObject({ 'cpu.web-everything/lane-3': 303.5, 'n.web-everything/lane-3': 4 });
    expect(byName('host.heavy.roots')[0]).toMatchObject({ value: 2, attributes: { by_class: 'check-standards:1,vitest:1', unadmitted_n: 1, held: 1, cap: 2 } });
    expect(byName('heavy.admission.holder')[0]).toMatchObject({ value: 600, attributes: { holder: 'slot-0:lane-3', pid: 100, alive: true, procs: 3, cpu_pct: 301.5 } });
    expect(byName('heavy.admission.stale_markers')[0]).toMatchObject({ value: 1, attributes: { flagged: 'stale-not-deleted' } });
    expect(byName('heavy.admission.stale_markers')[0].attributes.owners).toContain('lane-27@2026-09-04');
    expect(byName('host.workers.live')[0]).toMatchObject({ value: 1, attributes: { 'n.build': 1 } });
    // first sample after a prev of {} : the roster row is new, started 5 s ago => a real (not discovered) start
    expect(byName('dispatch.worker.event')[0].attributes).toMatchObject({ event: 'start', kind: 'build', name: 'build-1', discovered: false });
  });

  it('a sample whose probe failed is flagged `partial` with the probe named', () => {
    const s = buildSample(raw({ hostCpu: null, childFailed: ['lsof'] }));
    expect(s.quality).toBe('partial');
    expect(s.failedProbes).toEqual(['host-cpu', 'lsof']);
    expect(sampleToMetrics(s)[0].attributes.quality).toBe('partial');
  });

  it('respect the guard tiers: minimal keeps only the original light metrics, detail-off keeps classes but not per-process rows', () => {
    const minimal = new Set(sampleToMetrics(buildSample(raw({ tier: GUARD_TIERS[2] }))).map((m) => m.name));
    expect([...minimal].filter((n) => /^(host\.class|lane\.attribution|host\.heavy|host\.workers|host\.sampler|host\.cpu\.busy)/.test(n))).toEqual([]);
    const detailOff = new Set(sampleToMetrics(buildSample(raw({ tier: GUARD_TIERS[1] }))).map((m) => m.name));
    expect(detailOff.has('host.class.cpu_pct')).toBe(true);
    expect(detailOff.has('host.process.entry.cpu_pct')).toBe(false);
  });

  it('is deterministic: the same raw facts give byte-identical schema-2 samples', () => {
    expect(JSON.stringify(sampleToMetrics(buildSample(raw())))).toBe(JSON.stringify(sampleToMetrics(buildSample(raw()))));
  });

  it('an OLD-shaped raw (none of the schema-2 inputs) still builds and emits without throwing', () => {
    const { hostCpu, workerState, childFailed, ...oldRaw } = raw();
    const s = buildSample({ ...oldRaw, agents: null, admission: null });
    expect(() => sampleToMetrics(s)).not.toThrow();
    expect(s.workers).toBeNull();
    expect(sampleToMetrics(s).some((m) => m.name === 'host.cpu.busy_pct')).toBe(false);
  });
});

describe('REAL run: the sampler, the rollup and the `pressure` CLI over a temp directory (no live telemetry touched)', () => {
  let dir; let stateDir; let env;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hs-cap-tel-'));
    stateDir = mkdtempSync(join(tmpdir(), 'hs-cap-state-'));
    env = { ...process.env, HOST_SAMPLER_DIR: stateDir, WE_TELEMETRY: '1', OPERATION_TELEMETRY_DIR: dir };
    resetHardwareEmitted();
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); rmSync(stateDir, { recursive: true, force: true }); vi.restoreAllMocks(); });

  it('takes real samples (real ps, kernel CPU ticks, sysctl, vm_stat, lsof, lane and admission reads), then the real rollup and pressure CLI read them', async () => {
    const store = createFileTelemetryStore({ dir });
    let last;
    for (let i = 0; i < 6; i++) {
      // only the claude roster is injected (a hermetic stand-in: this test must not need the `claude` binary)
      last = await runOnce({ env, store, rollover: false, io: { sessions: { agents: [], facts: {} } } });
      expect(last.failed).toBe(0);
    }
    const day = last.file.replace(/^.*\//, '').replace('.jsonl', '');
    const text = readFileSync(last.file, 'utf8');
    const events = parseTelemetryLines(text).events;

    // the second and later samples measure host CPU over the WHOLE inter-sample window (kernel tick deltas)
    const busy = events.filter((e) => e.name === 'host.cpu.busy_pct');
    expect(busy).toHaveLength(6);
    expect(busy[0].attributes.cpu_source).toBe('short-window');
    expect(busy[1].attributes.cpu_source).toBe('interval-delta');
    for (const b of busy) {
      expect(b.value).toBeGreaterThanOrEqual(0);
      expect(b.value).toBeLessThanOrEqual(100);
      expect(b.attributes.user_pct + b.attributes.sys_pct + b.attributes.idle_pct + b.attributes.nice_pct).toBeGreaterThan(99);
      expect(b.attributes.ncpu).toBe(b.attributes.hw_ncpu);
    }
    const self = events.filter((e) => e.name === 'host.sampler.self');
    expect(self).toHaveLength(6);
    expect(self.every((e) => e.value > 0 && e.attributes.cpu_ms >= 0 && e.attributes.child_calls > 0)).toBe(true);
    expect(self[1].attributes.heartbeat_gap_s).toBeGreaterThanOrEqual(0);

    // the REAL rollup
    const rollup = buildDailyRollup(events, { day });
    expect(rollup.capacity.present).toBe(true);
    expect(rollup.capacity.samples).toBe(6);
    expect(Object.values(rollup.capacity.hourly)[0].hostIdlePct.n).toBe(6);
    expect(rollup.capacity.selfOverhead.cpuMsUpperBound.n).toBe(6);
    expect(rollup.capacity['reservation-inputs'].baseline.totalSamples).toBe(6);
    expect(rollup.capacity['reservation-inputs']['lane-load-model']).toMatchObject({ days: 1, heavyRuns: { real: expect.any(Number), calibration: 0 } });
    const hw = events.filter((e) => e.name === 'host.hardware.profile');
    expect(hw).toHaveLength(1); // once per sampler process start, not per sample
    expect(hw[0].attributes).toMatchObject({ ncpu: busy[0].attributes.ncpu });
    expect(hw[0].attributes.mem_bytes).toBeGreaterThan(1e9);
    expect(rollup.capacity.hardware.chip).toBe(hw[0].attributes.chip);
    expect(rollup.families).toBeDefined(); // the schema-1 sections are still there

    // the REAL pressure CLI, over the same directory
    const out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; });
    expect(await main(['pressure', `--dir=${dir}`, '--json'], env)).toBe(0);
    const r = JSON.parse(out.join(''));
    expect(r).toMatchObject({ n: 6, busySource: 'host-cpu', provisional: true });
    expect(['admit', 'hold']).toContain(r.decision);
    expect(r.p90CpuBusy).toBeGreaterThanOrEqual(0);
    expect(r.thresholds.holdBusyPct).toBe(75);
    // the same file, replayed in-process, agrees with the CLI
    expect(replayPressure({ samples: pressureSamples(events), now: Date.now() }).n).toBeGreaterThanOrEqual(6);

    out.length = 0;
    expect(await main(['pressure', `--dir=${dir}`], env)).toBe(0);
    expect(out.join('')).toMatch(/^pressure .*->\s+(ADMIT|HOLD)/);
    expect(await main(['pressure', `--dir=${dir}`, '--window=banana'], env)).toBe(2);
    // `--at` replays a finished file as of an instant: 10 minutes later the same file is stale-data, at its own last sample it is not
    out.length = 0;
    await main(['pressure', `--dir=${dir}`, '--json', `--at=${new Date(Date.now() + 3_600_000).toISOString()}`], env);
    expect(JSON.parse(out.join('')).reason).toContain('insufficient-data');
    expect(await main(['pressure', `--dir=${dir}`, '--at=not-a-time'], env)).toBe(2);
  }, 60_000);

  it('pressure over an empty directory admits with an insufficient-data reason (never errors)', async () => {
    const out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; });
    expect(await main(['pressure', `--dir=${join(dir, 'nothing-here')}`, '--json'], env)).toBe(0);
    expect(JSON.parse(out.join(''))).toMatchObject({ decision: 'admit', n: 0 });
  });

  it('pressure reads an old (schema-1) day file through the per-process estimate', async () => {
    const lines = [];
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      const at = new Date(now - (8 - i) * 30_000).toISOString();
      const m = (name, value, attributes = {}) => JSON.stringify({ v: 1, event: 'metric', name, kind: 'sampler', value, unit: 'count', timestamp: at, attributes: { source: 'host-sampler', sample: `o${i}`, mode: 'normal', interval_s: 30, ...attributes }, resource: {} });
      lines.push(m('host.cpu.load1', 20), m('host.cpu.count', 12), m('host.family.cpu_pct', 0, { 'cpu.vitest': 1000 }));
    }
    mkdirSync(dir, { recursive: true });
    // utc-day-slice-ok: the test writes the same UTC-keyed day file the sampler does
    writeFileSync(join(dir, `${new Date(now).toISOString().slice(0, 10)}.jsonl`), `${lines.join('\n')}\n`);
    const out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; });
    await main(['pressure', `--dir=${dir}`, '--json'], env);
    expect(JSON.parse(out.join(''))).toMatchObject({ decision: 'hold', busySource: 'ps-sum-estimate', n: 8 });
  });
});

describe('REAL heavy-run episode: a real process that classifies as check-standards, seen by the real sampler, ends, and is recorded', () => {
  let dir; let stateDir; let env; let child;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hs-ep-tel-'));
    stateDir = mkdtempSync(join(tmpdir(), 'hs-ep-state-'));
    env = { ...process.env, HOST_SAMPLER_DIR: stateDir, WE_TELEMETRY: '1', OPERATION_TELEMETRY_DIR: dir };
  });
  afterEach(() => { try { child?.kill('SIGKILL'); } catch { /* gone */ } rmSync(dir, { recursive: true, force: true }); rmSync(stateDir, { recursive: true, force: true }); });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  it('start edge -> in flight -> end edge gives one episode with a real start, wall time, CPU-seconds and RSS', async () => {
    // A harmless stand-in: a node process that burns ~1.5 s of CPU then idles. Its command line carries `check-standards.mjs`,
    // so the class table calls it a check-standards run; nothing heavy is actually started.
    // Started through a shell that exits, so the stand-in is reparented to launchd: under THIS vitest process it would be a
    // child of another heavy run (`node (vitest)`), correctly not a root of its own.
    const started = await new Promise((resolve) => {
      const sh = spawn('/bin/sh', ['-c', `${process.execPath} -e 'const t=Date.now();while(Date.now()-t<1500){};setTimeout(()=>{},60000)' check-standards.mjs >/dev/null 2>&1 & echo $!`], { stdio: ['ignore', 'pipe', 'ignore'] });
      let out = ''; sh.stdout.on('data', (d) => { out += d; }); sh.on('close', () => resolve(Number(out.trim())));
    });
    child = { pid: started, kill: (sig) => process.kill(started, sig) };
    await sleep(1800);
    const store = createFileTelemetryStore({ dir });
    const io = { sessions: { agents: [], facts: {} } };
    const a = await runOnce({ env, store, rollover: false, io });
    expect(a.sample.heavyRuns).toBeGreaterThanOrEqual(1);
    expect(a.sample.episodes).toEqual([]); // still running: nothing recorded yet
    child.kill('SIGKILL');
    await sleep(700);
    const b = await runOnce({ env, store, rollover: false, io });
    const mine = b.sample.episodes.filter((e) => e.root_pid === child.pid);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ family: 'check-standards', calibration: false, admitted: false, lane: 'unattributed', peak_procs: 1 });
    expect(mine[0].wall_s).toBeGreaterThan(1.5);
    expect(mine[0].cpu_s).toBeGreaterThan(1); // read from the real `ps time` column
    expect(mine[0].peak_rss_bytes).toBeGreaterThan(10e6);
    expect(mine[0].conc_start).toBeGreaterThanOrEqual(1);
    expect(mine[0].peak_threads).toBeGreaterThanOrEqual(1);
    // and it reached the file as a valid record the rollup reads
    const events = parseTelemetryLines(readFileSync(b.file, 'utf8')).events;
    const rec = events.filter((e) => e.name === 'heavy.run.episode' && e.attributes.root_pid === child.pid);
    expect(rec).toHaveLength(1);
    expect(validateTelemetryEvent(rec[0]).ok).toBe(true);
    const day = b.file.replace(/^.*\//, '').replace('.jsonl', '');
    const laneLoad = buildDailyRollup(events, { day }).capacity['reservation-inputs']['lane-load-model'];
    expect(laneLoad.perFamily['check-standards'].runs).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
