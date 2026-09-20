/**
 * The regression fixture `__fixtures__/load-analysis/runner-audit.jsonl` is a trimmed copy of the real
 * `~/workspace/.operations/telemetry/2026-09-14..19.jsonl` runner metrics (150 ticks, 12 cores): only the names
 * the analysis reads (the files hold no `host.process.entry.*` rows). It exists so tonight's audit numbers stay reproducible after the live files are pruned.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUCKET_EDGES, analyzeLoad, bucketLabel, groupSamples, renderReport } from '../load-analysis.mjs';
import { parseTelemetryLines, percentile } from '../telemetry.mjs';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'load-analysis', 'runner-audit.jsonl');
const fixtureEvents = () => parseTelemetryLines(readFileSync(FIXTURE, 'utf8')).events;

describe('regression: reproduces the 2026-09 audit numbers from the runner files', () => {
  const r = analyzeLoad(fixtureEvents());

  it('150 samples on 12 cores; load1 > 12 in 20 of them; max 24.7', () => {
    expect(r.window.samples).toBe(150);
    expect(r.window.runner).toBe(150);
    expect(r.window.sampler).toBe(0);
    expect(r.cores).toBe(12);
    expect(r.overall.n).toBe(150);
    expect(r.overall.overCores).toBe(20);
    expect(r.overall.load1.max).toBeCloseTo(24.7, 1);
    expect(r.overall.load1.median).toBeGreaterThan(6);
    expect(r.overall.load1.median).toBeLessThan(8);
  });

  it('load1 median is 6-8 in EVERY leased-lane bucket — lane count does not predict load', () => {
    const buckets = r.buckets.leased;
    expect(buckets.map((b) => b.bucket)).toEqual(['0', '1-2', '3-5', '6-8', '9+']);
    for (const b of buckets) {
      expect(b.load1.median).toBeGreaterThan(5.9);
      expect(b.load1.median).toBeLessThan(7.3);
    }
    expect(buckets.reduce((s, b) => s + b.n, 0)).toBe(150);
  });

  it('dispatch: denied 179 records vs admitted 150 records', () => {
    expect(r.dispatch.admitted.records).toBe(150);
    expect(r.dispatch.denied.records).toBe(179);
    expect(r.dispatch.denied.sum).toBe(252);
  });

  it('heavy.admission.waiting > 0 in 150/150 legacy samples (the metric bug this slice fixes)', () => {
    expect(r.heavyAdmission).toEqual({ waitingSamplesAboveZero: 150, samplesWithMetric: 150 });
  });

  it('the worst six samples lead with the 24.66 tick and carry top families/processes', () => {
    expect(r.worst).toHaveLength(6);
    expect(r.worst[0].load1).toBeCloseTo(24.66, 1);
    expect(r.worst.map((w) => w.load1)).toEqual([...r.worst.map((w) => w.load1)].sort((a, b) => b - a));
    expect(r.worst[0].topFamilies[0].name).toBe('other');
    // the 09-14..19 files hold no per-process rows (`host.process.entry.*` was never written), so only families
    expect(r.worst.every((w) => w.topFamilies.length > 0 && w.topProcesses.length === 0)).toBe(true);
  });

  it('sessions and heavy dimensions are honestly absent for legacy data', () => {
    expect(r.missing.sessions).toBe(150);
    expect(r.missing.heavy).toBe(150);
    expect(r.buckets.sessions).toEqual([]);
    expect(r.coverage.sufficient).toBe(false);
  });

  it('renders text with the headline numbers', () => {
    const text = renderReport(r);
    expect(text).toContain('150 samples');
    expect(text).toContain('> cores in 20/150');
    expect(text).toContain('NOT yet enough');
  });
});

describe('bucketLabel', () => {
  it('labels ranges and the open-ended top bucket', () => {
    expect(bucketLabel(0, BUCKET_EDGES.sessions)).toBe('0');
    expect(bucketLabel(2, BUCKET_EDGES.sessions)).toBe('1-2');
    expect(bucketLabel(9, BUCKET_EDGES.sessions)).toBe('6-9');
    expect(bucketLabel(400, BUCKET_EDGES.sessions)).toBe('10+');
    expect(bucketLabel(3, BUCKET_EDGES.heavy)).toBe('3-4');
    expect(bucketLabel(2, BUCKET_EDGES.heavy)).toBe('2');
  });
});

const m = (name, value, sample, extra = {}, t = '2026-09-20T10:00:00.000Z') => ({
  v: 1, event: 'metric', name, value, timestamp: t, attributes: { source: 'host-sampler', sample, ...extra }, resource: {},
});
const sampleEvents = (i, { load, cores = 12, sessions, heavyVitest = 0, heavyPw = 0, leased = 0, spawn = 40, spin = 0 }) => {
  const sample = `s${i}`;
  const t = new Date(Date.parse('2026-09-20T00:00:00.000Z') + i * 30 * 60_000).toISOString();
  return [
    m('host.cpu.load1', load, sample, {}, t), m('host.cpu.count', cores, sample, {}, t),
    m('host.probe.spawn_ms', spawn, sample, {}, t), m('host.probe.spin_overshoot_ms', spin, sample, {}, t),
    m('host.sessions.live', sessions, sample, {}, t),
    m('host.family.count', heavyVitest + heavyPw, sample, { 'n.vitest': heavyVitest, 'n.playwright': heavyPw }, t),
    m('host.family.cpu_pct', 100, sample, { 'cpu.vitest': 300, 'cpu.dev-server': 90, 'cpu.other': 5 }, t),
    m('lane.pool.leased', leased, sample, {}, t),
  ];
};

describe('analyzeLoad — buckets, percentiles, shares (sampler records)', () => {
  const events = [
    ...sampleEvents(0, { load: 4, sessions: 0, leased: 0 }),
    ...sampleEvents(1, { load: 6, sessions: 1, heavyVitest: 1, leased: 1 }),
    ...sampleEvents(2, { load: 13, sessions: 2, heavyVitest: 2, leased: 2, spawn: 90, spin: 12 }),
    ...sampleEvents(3, { load: 19, sessions: 4, heavyVitest: 2, heavyPw: 1, leased: 4, spawn: 300, spin: 80 }),
    ...sampleEvents(4, { load: 30, sessions: 7, heavyVitest: 3, heavyPw: 2, leased: 7, spawn: 500, spin: 200 }),
  ];
  const r = analyzeLoad(events);

  it('groups by the shared `sample` id even though timestamps differ', () => {
    const shifted = events.map((e, i) => ({ ...e, timestamp: new Date(Date.parse(e.timestamp) + i).toISOString() }));
    expect(groupSamples(shifted)).toHaveLength(5);
  });

  it('buckets live sessions', () => {
    const by = Object.fromEntries(r.buckets.sessions.map((b) => [b.bucket, b]));
    expect(Object.keys(by)).toEqual(['0', '1-2', '3-5', '6-9']);
    expect(by['1-2'].n).toBe(2);
    expect(by['1-2'].load1.max).toBe(13);
    expect(by['1-2'].shareOverCores).toBe(0.5);
    expect(by['6-9'].load1).toEqual({ median: 30, p90: 30, max: 30 });
    expect(by['6-9'].shareOver1_5x).toBe(1);
  });

  it('buckets heavy processes as vitest + playwright', () => {
    const by = Object.fromEntries(r.buckets.heavy.map((b) => [b.bucket, b]));
    expect(by['0'].n).toBe(1);
    expect(by['1'].n).toBe(1);
    expect(by['2'].n).toBe(1);
    expect(by['3-4'].n).toBe(1);
    expect(by['5+'].n).toBe(1);
    expect(by['5+'].probe).toMatchObject({ spawnP90: 500, spinP90: 200 });
  });

  it('uses nearest-rank percentiles and the 1x / 1.5x core thresholds', () => {
    expect(r.overall.load1).toEqual({ median: 13, p90: 30, max: 30 });
    expect(percentile([4, 6, 13, 19, 30], 0.5)).toBe(13);
    expect(r.overall.overCores).toBe(3); // 13, 19, 30 > 12
    expect(r.overall.over1_5x).toBe(2); // 19, 30 > 18
    expect(r.overall.shareOver1_5x).toBe(0.4);
  });

  it('a `cores` override changes the thresholds', () => {
    expect(analyzeLoad(events, { cores: 4 }).overall.overCores).toBe(4);
  });

  it('worst samples name their top families from the per-family record', () => {
    expect(r.worst[0]).toMatchObject({ load1: 30, sessions: 7, heavy: 5 });
    expect(r.worst[0].topFamilies.map((f) => f.name)).toEqual(['vitest', 'dev-server', 'other']);
  });

  it('coverage requires >= 48 h of sampler data including a busy window', () => {
    expect(r.coverage.sufficient).toBe(false);
    const long = [];
    for (let i = 0; i < 100; i++) long.push(...sampleEvents(i, { load: i === 50 ? 20 : 5, sessions: 1 }));
    expect(analyzeLoad(long).coverage).toMatchObject({ sufficient: true, busySamplerSamples: 1 });
    const calm = [];
    for (let i = 0; i < 100; i++) calm.push(...sampleEvents(i, { load: 5, sessions: 1 }));
    expect(analyzeLoad(calm).coverage.sufficient).toBe(false);
  });

  it('--since drops earlier events', () => {
    const cut = analyzeLoad(events, { sinceMs: Date.parse('2026-09-20T00:45:00.000Z') });
    expect(cut.window.samples).toBe(3);
  });

  it('a sample without a metric is excluded from that dimension only and counted as missing', () => {
    const noSessions = events.filter((e) => !(e.name === 'host.sessions.live' && e.attributes.sample === 's2'));
    const x = analyzeLoad(noSessions);
    expect(x.missing.sessions).toBe(1);
    expect(x.overall.n).toBe(5);
  });
});
