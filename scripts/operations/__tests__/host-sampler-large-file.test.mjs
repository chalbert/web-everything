/**
 * A FULL DAY'S TELEMETRY FILE (epic #3383, 2026-09-21 crash): `host-sampler.mjs pressure` died with `RangeError: Maximum
 * call stack size exceeded` because `readPressureSamples` did `events.push(...parseTelemetryLines(<whole file>).events)`
 * on a 92 MB / 145k-record file, and `lane-load` swallowed the same RangeError into an empty model. These tests write a
 * REAL 200,000-record file at test time and drive the real readers and the real CLI over it.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { main } from '../host-sampler.mjs';
import { buildDailyRollup } from '../host-sampler-retention.mjs';
import { PRESSURE_DEFAULTS, buildCapacityRollup, pressureSamples, readLaneLoadModel, readPressureSamples, replayPressure, smoothedPressure } from '../host-sampler-rollup.mjs';
import { SPAN_SLACK_MS, linesBackward, linesForward, maxOf, minOf, parseEventsFromBuffer, readEventsFile, readEventsTail } from '../host-sampler-tail.mjs';
import { groupSamples } from '../load-analysis.mjs';
import { parseTelemetryLines } from '../telemetry.mjs';

const NOW = Date.parse('2026-09-21T23:00:00.000Z');
const DAY = '2026-09-21';
const SAMPLES = 50_000; // x 4 records = 200,000 records, one sample per second, the last one 10 s before NOW
const CORES = 10;
const HOT_FROM = NOW - 30 * 60_000; // the last 30 minutes are hot (busy 90, load1 20), everything before is cool (busy 20, load1 2)

const atOf = (i) => NOW - (SAMPLES - i) * 1000 - 10_000 + 1000;
const sampleLines = (i) => {
  const at = new Date(atOf(i)).toISOString();
  const hot = atOf(i) >= HOT_FROM;
  const attributes = { source: 'host-sampler', sample: `L${i}`, mode: 'burst', interval_s: 1, schema: 2, quality: 'ok' };
  const m = (name, value, extra = {}) => JSON.stringify({ v: 1, event: 'metric', name, kind: 'sampler', value, unit: 'count', timestamp: at, traceId: null, attributes: { ...attributes, ...extra }, resource: { host: 'Mac', pid: 1 } });
  return [m('host.cpu.load1', hot ? 20 : 2), m('host.cpu.count', CORES), m('host.cpu.busy_pct', hot ? 90 : 20, { user_pct: 80, sys_pct: 10, idle_pct: 10, window_s: 1, hw_ncpu: CORES }), m('lane.pool.leased', 3)];
};

let dir;
let file;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'hs-large-'));
  file = join(dir, `${DAY}.jsonl`);
  writeFileSync(file, '');
  for (let from = 0; from < SAMPLES; from += 5000) {
    const lines = [];
    for (let i = from; i < Math.min(SAMPLES, from + 5000); i++) for (const l of sampleLines(i)) lines.push(l);
    appendFileSync(file, `${lines.join('\n')}\n`);
  }
}, 60_000);
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });
afterEach(() => { vi.restoreAllMocks(); });

const timed = (fn) => { const t = performance.now(); const r = fn(); return [r, performance.now() - t]; };
const captureStdout = () => { const out = []; vi.spyOn(process.stdout, 'write').mockImplementation((s) => { out.push(String(s)); return true; }); return out; };

describe('readPressureSamples on a 200,000-record day file', () => {
  it('reads only the tail: no throw, the right records, a bounded line count, well under 2 s', () => {
    const leadMs = 6 * PRESSURE_DEFAULTS.windowMs;
    const [r, ms] = timed(() => readPressureSamples({ dir, nowMs: NOW, leadMs, windowMs: PRESSURE_DEFAULTS.windowMs }));
    expect(ms).toBeLessThan(2000);
    expect(r.files).toEqual([file]);
    // 70 min of span + the 2 min slack = 72 min x 60 s x 4 records; nowhere near the 200,000 in the file
    const spanRecords = (leadMs + PRESSURE_DEFAULTS.windowMs + SPAN_SLACK_MS) / 1000 * 4;
    expect(r.parsed).toBeLessThanOrEqual(spanRecords + 8);
    expect(r.scanned).toBeLessThanOrEqual(spanRecords + 100);
    expect(r.scanned).toBeLessThan(SAMPLES * 4 / 10);
    // the SAME records a whole-file read would keep for that span, in the same order
    const full = readEventsFile({ raw: file }).events;
    expect(full).toHaveLength(SAMPLES * 4);
    const floor = NOW - leadMs - PRESSURE_DEFAULTS.windowMs - SPAN_SLACK_MS;
    expect(r.events).toEqual(full.filter((e) => Date.parse(e.timestamp) >= floor && Date.parse(e.timestamp) <= NOW));
  });

  it('`pressure` over the file answers correctly and stays cheap (CLI, --json)', async () => {
    const out = captureStdout();
    const t = performance.now();
    expect(await main(['pressure', `--dir=${dir}`, `--at=${new Date(NOW).toISOString()}`, '--json'], {})).toBe(0);
    expect(performance.now() - t).toBeLessThan(2000);
    const r = JSON.parse(out.join(''));
    // samples at NOW-599 s .. NOW-10 s are inside the 10 m window, all hot
    expect(r).toMatchObject({ decision: 'hold', n: 590, p90CpuBusy: 90, p90Load1PerCore: 2, busySource: 'host-cpu', files: [file] });
    expect(r.transitions.length).toBeGreaterThanOrEqual(1);
    expect(r.sampleCount).toBeLessThan(SAMPLES);
  });

  it('the tail verdict equals the verdict over exactly the last window', () => {
    const { events } = readPressureSamples({ dir, nowMs: NOW, leadMs: 6 * PRESSURE_DEFAULTS.windowMs });
    const all = pressureSamples(events);
    const replay = replayPressure({ samples: all, now: NOW });
    const direct = smoothedPressure({ samples: all, now: NOW, hysteresis: { previous: 'hold' } });
    expect(replay.decision).toBe('hold');
    expect({ ...replay, transitions: undefined, sampleCount: undefined }).toEqual({ ...direct, transitions: undefined, sampleCount: undefined });
  });

  it('`--at` in the past skips the newer records: the cool period before the hot half hour admits', async () => {
    const out = captureStdout();
    const at = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(await main(['pressure', `--dir=${dir}`, `--at=${at}`, '--json'], {})).toBe(0);
    const r = JSON.parse(out.join(''));
    expect(r).toMatchObject({ decision: 'admit', n: 600, p90CpuBusy: 20, p90Load1PerCore: 0.2 });
  });

  it('an instant long after the last record reads (almost) nothing and admits on insufficient-data', () => {
    const [r, ms] = timed(() => readPressureSamples({ dir, nowMs: NOW + 3 * 86_400_000, leadMs: 3_600_000, windowMs: 600_000 }));
    expect(r.events).toEqual([]);
    expect(ms).toBeLessThan(500);
  });

  it('reads a gzipped day the same way (yesterday, when the lead-in reaches back over midnight)', () => {
    const gzDir = mkdtempSync(join(tmpdir(), 'hs-large-gz-'));
    try {
      const lines = Array.from({ length: 3000 }, (_, i) => sampleLines(i % SAMPLES)).flat();
      // 3,000 samples one second apart ending 23:59:50 on the 20th, then the 21st starts with a few samples
      const rebase = (l, base) => { const e = JSON.parse(l); e.timestamp = new Date(base + Number(/L(\d+)/.exec(e.attributes.sample)[1]) * 1000).toISOString(); return JSON.stringify(e); };
      const base20 = Date.parse('2026-09-20T23:00:10.000Z');
      writeFileSync(join(gzDir, '2026-09-20.jsonl.gz'), gzipSync(`${lines.map((l) => rebase(l, base20)).join('\n')}\n`));
      writeFileSync(join(gzDir, '2026-09-21.jsonl'), `${sampleLines(0).map((l) => rebase(l, Date.parse('2026-09-21T00:00:05.000Z'))).join('\n')}\n`);
      const now = Date.parse('2026-09-21T00:00:30.000Z');
      const r = readPressureSamples({ dir: gzDir, nowMs: now, leadMs: 3_600_000, windowMs: 600_000 });
      expect(r.files).toEqual([join(gzDir, '2026-09-20.jsonl.gz'), join(gzDir, '2026-09-21.jsonl')]);
      const times = r.events.map((e) => Date.parse(e.timestamp));
      expect(times.every((t) => t >= now - 4_200_000 - SPAN_SLACK_MS && t <= now)).toBe(true);
      expect(times).toEqual([...times].sort((a, b) => a - b)); // day order, then file order
      expect(r.events.length).toBe(3000 * 4 + 4); // the whole 50 min gz day is inside the 70 min span, plus the 21st
    } finally { rmSync(gzDir, { recursive: true, force: true }); }
  });
});

describe('the whole-file readers on the same 200,000-record file', () => {
  it('lane-load reads the day (it used to swallow the RangeError into an empty model) in bounded time', async () => {
    const [{ model, days }, ms] = timed(() => readLaneLoadModel({ dir, nowMs: NOW, days: 1 }));
    expect(days).toEqual([DAY]);
    expect(ms).toBeLessThan(20_000);
    expect(model.days).toBe(1); // the day had schema-2 samples: a swallowed error would have given 0 samples and `Math.max(1, 0)` anyway...
    expect(model.spanHours).toBeGreaterThan(13.8); // ...but only a real read sees the 50,000-sample (13.9 h) span
    expect(model.spanHours).toBeLessThan(14);
    expect(model.perLane).toBeDefined();
    const out = captureStdout();
    expect(await main(['lane-load', `--dir=${dir}`, '--days=1', '--json'], {})).toBe(0);
    expect(JSON.parse(out.join('')).spanHours).toBe(model.spanHours);
  }, 60_000);

  it('the daily rollup and the capacity rollup build over all 200,000 records', () => {
    const { events } = readEventsFile({ raw: file });
    const samples = groupSamples(events);
    expect(samples).toHaveLength(SAMPLES);
    const cap = buildCapacityRollup(samples);
    expect(cap).toMatchObject({ present: true, samples: SAMPLES });
    const daily = buildDailyRollup(events, { day: DAY });
    expect(daily.samples.total).toBe(SAMPLES);
    expect(daily.capacity.samples).toBe(SAMPLES);
  }, 120_000);

  it('a full read equals a whole-text parse (same records, same order, same corrupt count)', () => {
    const small = mkdtempSync(join(tmpdir(), 'hs-large-eq-'));
    try {
      const text = `${sampleLines(1).join('\n')}\nnot json\n\n{"v":2,"event":"metric"}\n${sampleLines(2).join('\n')}\n{"v":1,"event":"metric","name":"partial`;
      writeFileSync(join(small, 'a.jsonl'), text);
      const a = parseTelemetryLines(text);
      expect(readEventsFile({ raw: join(small, 'a.jsonl') })).toMatchObject({ events: a.events, corrupt: a.corrupt });
      expect(parseEventsFromBuffer(Buffer.from(text))).toEqual({ events: a.events, corrupt: a.corrupt });
      writeFileSync(join(small, 'b.jsonl.gz'), gzipSync(text));
      expect(readEventsFile({ gz: join(small, 'b.jsonl.gz') }).events).toEqual(a.events);
      expect(readEventsFile({ raw: join(small, 'missing.jsonl') })).toMatchObject({ events: [], found: false });
    } finally { rmSync(small, { recursive: true, force: true }); }
  });
});

describe('no whole-list spreads', () => {
  it('maxOf / minOf take a list far past the call-argument limit', () => {
    const big = Array.from({ length: 400_000 }, (_, i) => (i * 7919) % 400_009);
    expect(maxOf(big)).toBe(big.reduce((a, b) => (b > a ? b : a)));
    expect(minOf(big)).toBe(big.reduce((a, b) => (b < a ? b : a)));
    expect(maxOf([])).toBeNull();
  });

  it('smoothedPressure over 400,000 samples in one window does not throw', () => {
    const samples = Array.from({ length: 400_000 }, (_, i) => ({ atMs: NOW - 400_000 + i, busyPct: 10, load1: 1, cores: 10 }));
    const r = smoothedPressure({ samples, now: NOW, windowMs: 3_600_000 });
    expect(r).toMatchObject({ decision: 'admit', n: 400_000, p90CpuBusy: 10 });
  });

  it('replayPressure (now linear) gives exactly what the original quadratic replay gave', () => {
    const samples = Array.from({ length: 400 }, (_, i) => ({ atMs: NOW - (400 - i) * 20_000 + (i % 3) * 5, busyPct: (i * 37) % 100, load1: ((i * 13) % 30) / 2, cores: 10, busyEstimate: null }));
    samples.push({ ...samples[10] }, { ...samples[11] }); // duplicate timestamps
    const original = ({ samples: ss, windowMs = PRESSURE_DEFAULTS.windowMs, now, hysteresis = {} }) => {
      const sorted = ss.filter((s) => s.atMs <= now).sort((a, b) => a.atMs - b.atMs);
      let previous = hysteresis.previous ?? 'admit'; const transitions = [];
      for (const s of sorted) {
        const r = smoothedPressure({ samples: sorted, windowMs, now: s.atMs, hysteresis: { ...hysteresis, previous } });
        if (r.decision !== previous) transitions.push({ at: new Date(s.atMs).toISOString(), from: previous, to: r.decision, reason: r.reason });
        previous = r.decision;
      }
      return { ...smoothedPressure({ samples: sorted, windowMs, now, hysteresis: { ...hysteresis, previous } }), transitions, sampleCount: sorted.length };
    };
    for (const windowMs of [600_000, 120_000]) {
      const got = replayPressure({ samples, windowMs, now: NOW });
      expect(got).toEqual(original({ samples, windowMs, now: NOW }));
      expect(got.transitions.length).toBeGreaterThan(0);
    }
  });
});

describe('line iteration', () => {
  const src = (text) => { const buf = Buffer.from(text); return { size: buf.length, read: (pos, len) => buf.subarray(pos, pos + len), close: () => {} }; };
  const text = 'α,1\n\nβγ,2\r\nlast line without newline é';
  const expected = text.split('\n').filter((l) => l !== '');
  it('yields every line exactly once in both directions at any chunk size (multi-byte characters never split)', () => {
    for (const chunk of [1, 2, 3, 5, 7, 64, 1 << 20]) {
      expect([...linesForward(src(text), chunk)]).toEqual(expected);
      expect([...linesBackward(src(text), chunk)]).toEqual([...expected].reverse());
    }
    expect([...linesBackward(src(''))]).toEqual([]);
    expect([...linesForward(src('\n\n'))]).toEqual([]);
  });

  it('readEventsTail stops on a run of old lines but a lone out-of-order old line does not end it', () => {
    const small = mkdtempSync(join(tmpdir(), 'hs-large-ooo-'));
    try {
      const at = (min) => new Date(NOW - min * 60_000).toISOString();
      const rec = (min, n) => JSON.stringify({ v: 1, event: 'metric', name: 'host.cpu.load1', kind: 'sampler', value: n, unit: 'count', timestamp: at(min), attributes: {}, resource: {} });
      const lines = [rec(300, 1), rec(200, 2), rec(9, 3), rec(400, 4) /* a stray old line appended late */, rec(8, 5), rec(7, 6)];
      writeFileSync(join(small, 'x.jsonl'), `${lines.join('\n')}\n`);
      const r = readEventsTail({ raw: join(small, 'x.jsonl'), fromMs: NOW - 10 * 60_000, toMs: NOW });
      expect(r.events.map((e) => e.value)).toEqual([3, 5, 6]);
      // with a run of old lines the scan ends early, having parsed only the recent ones
      const many = [rec(500, 0), ...Array.from({ length: 200 }, (_, i) => rec(400 - i, 0)), rec(5, 7)];
      writeFileSync(join(small, 'y.jsonl'), `${many.join('\n')}\n`);
      const r2 = readEventsTail({ raw: join(small, 'y.jsonl'), fromMs: NOW - 10 * 60_000, toMs: NOW });
      expect(r2.events.map((e) => e.value)).toEqual([7]);
      expect(r2.scanned).toBeLessThan(80);
    } finally { rmSync(small, { recursive: true, force: true }); }
  });
});
