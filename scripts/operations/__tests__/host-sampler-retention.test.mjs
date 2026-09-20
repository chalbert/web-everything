import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { GUARD_TIERS, HYSTERESIS_BYTES, buildDailyRollup, escalationRow, guardTier, maybeEscalate, planRollover, rolloverDay, runRollover } from '../host-sampler-retention.mjs';
import { runOnce, sampleToMetrics, buildSample } from '../host-sampler.mjs';
import { readEvents } from '../load-report-cli.mjs';
import { parseTelemetryLines, validateTelemetryEvent } from '../telemetry.mjs';
import { createFileTelemetryStore } from '../telemetry-store.mjs';
import { parsePsWide } from '../host-sampler-extras.mjs';

const GIB = 1024 ** 3;
const NOW = Date.parse('2026-09-20T16:00:00.000Z');

describe('free-space guard table', () => {
  const name = (free, prev) => guardTier(free, prev).name;
  it('picks the tier from free space', () => {
    expect(name(104 * GIB)).toBe('full');
    expect(name(30 * GIB)).toBe('full');
    expect(name(30 * GIB - 1)).toBe('detail-off');
    expect(name(10 * GIB)).toBe('detail-off');
    expect(name(10 * GIB - 1)).toBe('minimal');
    expect(name(3 * GIB)).toBe('minimal');
    expect(name(3 * GIB - 1)).toBe('halt');
    expect(name(0)).toBe('halt');
  });
  it('unknown free space never silences the sampler', () => {
    expect(name(null)).toBe('full');
    expect(name(undefined)).toBe('full');
    expect(name(NaN)).toBe('full');
  });
  it('worse tiers apply at once; recovery needs the hysteresis margin', () => {
    expect(name(29 * GIB, 'full')).toBe('detail-off');
    expect(name(31 * GIB, 'detail-off')).toBe('detail-off'); // above 30 but inside the margin
    expect(name(30 * GIB + HYSTERESIS_BYTES, 'detail-off')).toBe('full');
  });
  it('the table sheds detail first, then families, then everything', () => {
    expect(GUARD_TIERS.map((t) => [t.name, t.detail, t.families, t.light])).toEqual([
      ['full', true, true, true], ['detail-off', false, true, true], ['minimal', false, false, true], ['halt', false, false, false],
    ]);
  });
});

const PS = ' 100 1 95.0 900000 05:00 node /w/x.js\n 110 1 40.0 500000 05:00 node (vitest)';
const HOST = { load: [14, 11, 9], cpuCount: 12, freeBytes: 2e9, totalBytes: 34e9 };
const ioFor = (over = {}) => ({
  nowMs: () => NOW, ps: () => PS, host: HOST, lanes: [], sessions: { agents: [], facts: {} }, state: {},
  admission: { cap: 2, heldCount: 0, freeCount: 2, held: [], waiting: [], staleWaiting: [] }, probe: { spawnMs: 40, spinOvershootMs: 0 },
  extras: { mem: { availableBytes: 1, compressedBytes: 2, wiredBytes: 3, activeBytes: 4, inactiveBytes: 5, pageins: 6, pageouts: 7, swapins: 8, swapouts: 9 }, swap: { swapUsedBytes: 0, swapTotalBytes: 0, pressureLevel: 1 }, io: null, therm: { cpuSpeedLimitPct: 100, schedulerLimitPct: 100, warned: false }, disk: { freeBytes: 5e10, usedPct: 11 } },
  cwds: () => ({}), ...over,
});

describe('runOnce honours the guard and never deletes history', () => {
  let dir; let state; let esc; let env;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hs-tel-')); state = mkdtempSync(join(tmpdir(), 'hs-state-')); esc = mkdtempSync(join(tmpdir(), 'hs-esc-'));
    env = { ...process.env, HOST_SAMPLER_DIR: state, WE_TELEMETRY: '1' };
  });
  afterEach(() => { for (const d of [dir, state, esc]) rmSync(d, { recursive: true, force: true }); });
  const names = (text) => new Set(parseTelemetryLines(text).events.map((e) => e.name));
  const run = (freeBytes) => runOnce({ env, store: createFileTelemetryStore({ dir }), rollover: false, io: ioFor({ freeBytes, escalationsDir: esc }) });

  it('full: per-process rows, extras and families are written and every record validates', async () => {
    const r = await run(104 * GIB);
    expect(r.tier).toBe('full');
    const text = readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8');
    const n = names(text);
    for (const want of ['host.process.entry.cpu_pct', 'host.mem.available_bytes', 'host.mem.pressure_level', 'host.disk.free_bytes', 'host.cpu.thermal_limit_pct', 'host.family.cpu_pct', 'host.cpu.load1']) expect(n).toContain(want);
    for (const e of parseTelemetryLines(text).events) expect(validateTelemetryEvent(e).ok).toBe(true);
    expect(readdirSync(esc)).toEqual([]); // no escalation at full
  });

  it('detail-off (< 30 GiB): per-process rows and extras stop, light metrics stay, one packet is filed', async () => {
    const r = await run(20 * GIB);
    expect(r.tier).toBe('detail-off');
    const n = names(readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8'));
    expect(n).not.toContain('host.process.entry.cpu_pct');
    expect(n).not.toContain('host.mem.available_bytes');
    for (const want of ['host.cpu.load1', 'host.probe.spawn_ms', 'host.family.cpu_pct', 'lane.pool.total', 'heavy.admission.cap']) expect(n).toContain(want);
    const packets = readdirSync(esc);
    expect(packets).toEqual(['host-sampler-disk-detail-off.json']);
    const packet = JSON.parse(readFileSync(join(esc, packets[0]), 'utf8'));
    expect(packet).toMatchObject({ id: 'host-sampler-disk-detail-off', kind: 'host-sampler-free-space', status: 'open' });
    await run(20 * GIB); // a second sample does not duplicate or churn the packet
    expect(readdirSync(esc)).toEqual(['host-sampler-disk-detail-off.json']);
  });

  it('minimal (< 10 GiB) writes only load, probes and memory; halt (< 3 GiB) writes nothing — neither touches existing files', async () => {
    const existing = join(dir, '2026-09-19.jsonl');
    writeFileSync(existing, '{"v":1,"event":"metric","name":"host.cpu.load1","value":1,"timestamp":"2026-09-19T00:00:00.000Z"}\n');
    const before = readFileSync(existing, 'utf8');
    const r = await run(5 * GIB);
    expect(r.tier).toBe('minimal');
    expect([...names(readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8'))].sort()).toEqual(['host.cpu.count', 'host.cpu.load1', 'host.cpu.load15', 'host.cpu.load5', 'host.mem.free_bytes', 'host.mem.total_bytes', 'host.probe.spawn_ms', 'host.probe.spin_overshoot_ms']);
    const sizeAfterMinimal = readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8').length;
    const h = await run(1 * GIB);
    expect(h).toMatchObject({ tier: 'halt', written: 0 });
    expect(readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8').length).toBe(sizeAfterMinimal); // nothing appended, nothing truncated
    expect(readFileSync(existing, 'utf8')).toBe(before);
    expect(readdirSync(dir).sort()).toEqual(['2026-09-19.jsonl', '2026-09-20.jsonl']);
    expect(readdirSync(esc).sort()).toEqual(['host-sampler-disk-halt.json', 'host-sampler-disk-minimal.json']);
  });

  it('sampleToMetrics of a halt sample is empty and of a minimal sample has no families', () => {
    const raw = { at: '2026-09-20T16:00:00.000Z', nowMs: NOW, host: HOST, psRows: parsePsWide(PS), agents: null, lanes: [], admission: null, probe: { spawnMs: 1, spinOvershootMs: 0 } };
    expect(sampleToMetrics(buildSample({ ...raw, tier: GUARD_TIERS[3] }))).toEqual([]);
    expect(sampleToMetrics(buildSample({ ...raw, tier: GUARD_TIERS[2] })).some((m) => m.name.startsWith('host.family'))).toBe(false);
  });

  it('escalation rows use the land-advance packet shape and maybeEscalate skips `full`', () => {
    expect(maybeEscalate({ tier: GUARD_TIERS[0], freeBytes: 100 * GIB, dir, escalationsDir: esc, now: NOW })).toBeNull();
    const row = escalationRow(GUARD_TIERS[1], 20 * GIB, dir);
    expect(row).toMatchObject({ packetId: 'host-sampler-disk-detail-off', kind: 'host-sampler-free-space', blockedBy: null });
    expect(row.evidence.join(' ')).toContain('never deleted');
  });
});

// ── rollover + rollup ──────────────────────────────────────────────────────────────────────────────────

const metric = (name, value, sample, at, attributes = {}) => JSON.stringify({ v: 1, event: 'metric', name, value, timestamp: at, attributes: { source: 'host-sampler', sample, mode: 'normal', interval_s: 30, ...attributes }, resource: {} });
const sampleLines = (i, at, { load, fam = {}, procs = [] }) => {
  const s = `s${i}`;
  return [
    metric('host.cpu.load1', load, s, at), metric('host.cpu.count', 12, s, at), metric('host.probe.spawn_ms', 40 + i, s, at), metric('host.probe.spin_overshoot_ms', i % 3, s, at),
    metric('host.family.cpu_pct', 0, s, at, Object.fromEntries(Object.entries(fam).map(([k, v]) => [`cpu.${k}`, v]))),
    metric('host.family.count', 0, s, at, Object.fromEntries(Object.entries(fam).map(([k]) => [`n.${k}`, 2]))),
    ...procs.map((p) => metric('host.process.entry.cpu_pct', p.cpu, s, at, { pid: p.pid, family: p.family, command: p.cmd, lane: p.lane ?? 'unattributed', session: p.session ?? 'unattributed', session_id: p.sid ?? null })),
  ];
};
const dayLines = () => {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const at = new Date(Date.parse('2026-09-19T10:00:00.000Z') + i * 30_000).toISOString();
    const hot = i >= 4 && i <= 7;
    out.push(...sampleLines(i, at, { load: hot ? 20 + i : 5, fam: { vitest: hot ? 300 + i : 10, 'dev-server': 200 }, procs: hot ? [{ cpu: 150, pid: 1, family: 'vitest', cmd: 'node (vitest)', lane: 'we/lane-9', session: 'fix-9', sid: 'sess-9' }, { cpu: 50, pid: 2, family: 'other', cmd: 'x' }] : [] }));
  }
  return out.join('\n') + '\n';
};

describe('buildDailyRollup', () => {
  const events = parseTelemetryLines(dayLines()).events;
  const r = buildDailyRollup(events, { day: '2026-09-19' });

  it('per-family cpu percentiles, sample counts, load and probe percentiles', () => {
    expect(r.samples).toEqual({ total: 12, sampler: 12, burst: 0 });
    expect(r.cores).toBe(12);
    expect(r.families.vitest.cpu).toMatchObject({ max: 307, p50: 10 });
    expect(r.families['dev-server'].cpu).toEqual({ p50: 200, p90: 200, p99: 200, max: 200 });
    expect(r.families.vitest).toMatchObject({ countMax: 2, samplesPresent: 12 });
    expect(r.load1.max).toBe(27);
    expect(r.probe.spawnMs.max).toBe(51);
  });

  it('merges consecutive over-cores samples into one busy window', () => {
    expect(r.busyWindows).toEqual([{ from: '2026-09-19T10:02:00.000Z', to: '2026-09-19T10:03:30.000Z', samples: 4, maxLoad1: 27 }]);
  });

  it('worst samples carry attribution and shares are reported with `unattributed` explicit', () => {
    expect(r.worst[0]).toMatchObject({ load1: 27 });
    expect(r.worst[0].topProcesses[0]).toMatchObject({ family: 'vitest', session: 'fix-9', lane: 'we/lane-9' });
    expect(r.attribution.topSessions[0].name).toBe('fix-9');
    expect(r.attribution.topLanes[0].name).toBe('we/lane-9');
    expect(r.attribution.sessionShare).toBe(0.75); // 150 of (150 + 50) per hot sample
  });

  it('is deterministic: same events, byte-identical JSON', () => {
    expect(JSON.stringify(buildDailyRollup(parseTelemetryLines(dayLines()).events, { day: '2026-09-19' }))).toBe(JSON.stringify(r));
  });
});

describe('planRollover / rolloverDay / runRollover', () => {
  let d;
  beforeEach(() => { d = mkdtempSync(join(tmpdir(), 'hs-roll-')); });
  afterEach(() => { rmSync(d, { recursive: true, force: true }); });
  const old = (name, text) => { const p = join(d, name); writeFileSync(p, text); const t = new Date(NOW - 5 * 3_600_000); utimesSync(p, t, t); return p; };

  it('plans only finished, quiet, unconverted days', () => {
    const f = (name, hoursAgo) => ({ name, mtimeMs: NOW - hoursAgo * 3_600_000 });
    const due = planRollover([
      f('2026-09-20.jsonl', 0.1), // today
      f('2026-09-19.jsonl', 0.1), // yesterday but written 6 min ago (quiet rule)
      f('2026-09-18.jsonl', 40), // due
      f('2026-09-17.jsonl', 60), f('2026-09-17.jsonl.gz', 60), // already converted
      f('2026-09-16.rollup.json', 60), f('notes.txt', 60),
    ], { nowMs: NOW });
    expect(due).toEqual(['2026-09-18']);
    // within the 1 h grace after midnight
    const quiet = { name: '2026-09-19.jsonl', mtimeMs: Date.parse('2026-09-19T20:00:00.000Z') };
    expect(planRollover([quiet], { nowMs: Date.parse('2026-09-20T00:30:00.000Z') })).toEqual([]);
    expect(planRollover([quiet], { nowMs: Date.parse('2026-09-20T01:05:00.000Z') })).toEqual(['2026-09-19']);
  });

  it('gzips byte-verified, writes the rollup, and only then replaces the raw file; readers still see every event', () => {
    const text = dayLines();
    old('2026-09-19.jsonl', text);
    const res = rolloverDay({ dir: d, day: '2026-09-19' });
    expect(res).toMatchObject({ ok: true, rawBytes: Buffer.byteLength(text) });
    expect(res.gzBytes).toBeLessThan(res.rawBytes);
    expect(existsSync(join(d, '2026-09-19.jsonl'))).toBe(false);
    expect(gunzipSync(readFileSync(join(d, '2026-09-19.jsonl.gz'))).toString('utf8')).toBe(text);
    const rollup = JSON.parse(readFileSync(join(d, '2026-09-19.rollup.json'), 'utf8'));
    expect(rollup).toMatchObject({ v: 1, day: '2026-09-19', samples: { total: 12 } });
    // history stays readable through the store and the report reader
    const viaStore = createFileTelemetryStore({ dir: d });
    expect(viaStore.days()).toEqual(['2026-09-19']);
    expect(viaStore.readDay('2026-09-19').events).toHaveLength(parseTelemetryLines(text).events.length);
    expect(readEvents(d)).toHaveLength(parseTelemetryLines(text).events.length);
  });

  it('gzip and rollup are deterministic across runs (same bytes)', () => {
    const text = dayLines();
    old('2026-09-19.jsonl', text);
    const a = rolloverDay({ dir: d, day: '2026-09-19', dryRun: true });
    const b = rolloverDay({ dir: d, day: '2026-09-19', dryRun: true });
    expect(a).toEqual(b);
    expect(gzipSync(Buffer.from(text), { level: 9 }).equals(gzipSync(Buffer.from(text), { level: 9 }))).toBe(true);
    expect(existsSync(join(d, '2026-09-19.jsonl'))).toBe(true); // dry run touched nothing
  });

  it('runRollover skips days the sampler never wrote unless `all`, and never touches today', () => {
    old('2026-09-18.jsonl', '{"v":1,"event":"metric","name":"host.cpu.load1","value":1,"timestamp":"2026-09-18T00:00:00.000Z"}\n');
    old('2026-09-19.jsonl', dayLines());
    const today = join(d, '2026-09-20.jsonl'); writeFileSync(today, dayLines());
    const r = runRollover({ dir: d, nowMs: NOW });
    expect(r.map((x) => x.day)).toEqual(['2026-09-19']);
    expect(existsSync(join(d, '2026-09-18.jsonl'))).toBe(true);
    expect(existsSync(today)).toBe(true);
    expect(runRollover({ dir: d, nowMs: NOW, all: true }).map((x) => x.day)).toEqual(['2026-09-18']);
  });

  it('a missing or unreadable raw file is reported, never thrown, and nothing is deleted', () => {
    expect(rolloverDay({ dir: d, day: '2026-01-01' })).toMatchObject({ ok: false });
    writeFileSync(join(d, 'keep.txt'), 'x');
    expect(rolloverDay({ dir: d, day: '2026-01-01' }).ok).toBe(false);
    expect(readdirSync(d)).toEqual(['keep.txt']);
  });
});
