/**
 * @file telemetry-machine.test.mjs — proof of `scripts/lib/telemetry-machine.mjs`, the machine + sources
 * halves of `TelemetrySnapshot` v1 (backlog `xaxks4j`, epic `xjtmptc`).
 *
 * All fixtures are SYNTHETIC, shaped like the real host-sampler day-file records `{event:'metric', name,
 * value, timestamp}` and the real `<day>.rollup.json` shape (`load1`, `cores`, `capacity.hourly`).
 */
import { describe, it, expect } from 'vitest';
import {
  median, etDayHour, dayLabel, latestValue, memPressureLevel, computeMachineNow, todayHourlyBusyPct,
  shapeMachineDay, machineDays, sourceState, shapeSources, collectorHazards, SOURCE_IDS,
  CLAUDE_USAGE_STALE_MS, HOST_SAMPLER_STALE_MS, ROLLUP_STALE_MS,
} from '../lib/telemetry-machine.mjs';

const TZ = 'America/New_York';
const sample = (iso, value) => ({ timestamp: iso, value });

describe('median', () => {
  it('is null for no data — never a fake zero', () => {
    expect(median([])).toBeNull();
    expect(median([NaN, 'nope'])).toBeNull();
  });
  it('averages the middle two on an even count', () => {
    expect(median([1, 3])).toBe(2);
    expect(median([10, 1, 5])).toBe(5);
  });
});

describe('etDayHour / dayLabel', () => {
  it('reads the ET calendar day and hour from a UTC instant', () => {
    // 2026-09-23T11:40:00Z is 07:40 EDT (UTC-4) on the same calendar date.
    expect(etDayHour(new Date('2026-09-23T11:40:00Z'), TZ)).toEqual({ dayKey: '2026-09-23', hour: 7 });
    // Early UTC hours land on the PREVIOUS ET day.
    expect(etDayHour(new Date('2026-09-23T02:00:00Z'), TZ)).toEqual({ dayKey: '2026-09-22', hour: 22 });
  });
  it('labels a calendar date with its weekday', () => {
    expect(dayLabel('2026-09-22')).toBe('Tue Sep 22');
  });
});

describe('machine.now — latestValue, memPressureLevel, computeMachineNow', () => {
  it('latestValue picks the newest timestamp, not the largest value', () => {
    const samples = [sample('2026-09-23T10:00:00Z', 90), sample('2026-09-23T11:00:00Z', 12)];
    expect(latestValue(samples)).toBe(12);
    expect(latestValue([])).toBeNull();
    expect(latestValue([{ timestamp: 'not-a-date', value: 5 }])).toBeNull();
  });

  it('maps the observed pressure levels to their names, and refuses to guess an unseen one', () => {
    expect(memPressureLevel(1)).toBe('normal');
    expect(memPressureLevel(2)).toBe('warn');
    expect(memPressureLevel(4)).toBe('critical');
    expect(memPressureLevel(3)).toBe('critical'); // >=3 reads as "worse than warn"
    expect(memPressureLevel(0)).toBeNull();
    expect(memPressureLevel(-1)).toBeNull();
    expect(memPressureLevel(NaN)).toBeNull();
  });

  it('assembles now + cores, falling back to a rollup cores field only when no raw sample exists', () => {
    const out = computeMachineNow({
      busySamples: [sample('2026-09-23T11:00:00Z', 37)],
      sessionSamples: [sample('2026-09-23T11:00:00Z', 5)],
      pressureSamples: [sample('2026-09-23T11:00:00Z', 1)],
      coreSamples: [],
      fallbackCores: 12,
    });
    expect(out).toEqual({ now: { busyPct: 37, claudeSessions: 5, memPressure: 'normal' }, cores: 12 });

    const withRawCores = computeMachineNow({ coreSamples: [sample('2026-09-23T11:00:00Z', 8)], fallbackCores: 12 });
    expect(withRawCores.cores).toBe(8);

    const withNeither = computeMachineNow({});
    expect(withNeither).toEqual({ now: { busyPct: null, claudeSessions: null, memPressure: null }, cores: null });
  });
});

describe('todayHourlyBusyPct', () => {
  const DAY = '2026-09-23';
  const NOW = new Date('2026-09-23T15:00:00Z'); // 11:00 ET

  it('buckets by ET hour and medians within a bucket', () => {
    const samples = [
      sample('2026-09-23T14:00:00Z', 10), // 10:00 ET
      sample('2026-09-23T14:10:00Z', 30), // 10:00 ET
      sample('2026-09-23T14:20:00Z', 20), // 10:00 ET
    ];
    const out = todayHourlyBusyPct(samples, DAY, NOW, TZ);
    expect(out[10]).toBe(20); // median of [10,30,20]
  });

  it('marks hours after now as future (null), not as a gap', () => {
    const out = todayHourlyBusyPct([], DAY, NOW, TZ);
    expect(out[11]).toBe(null); // the current ET hour with no samples yet — a gap, still null
    expect(out[12]).toBe(null); // strictly future
    expect(out.length).toBe(24);
  });

  it('ignores samples from a different ET day', () => {
    const samples = [sample('2026-09-22T14:00:00Z', 99)]; // ET Sep 22, not Sep 23
    const out = todayHourlyBusyPct(samples, DAY, NOW, TZ);
    expect(out.every((v) => v === null)).toBe(true);
  });

  it('merges samples from more than one source (e.g. a rollup backfill plus today\'s raw tail)', () => {
    const fromRollup = [sample('2026-09-23T04:00:00Z', 50)]; // 00:00 ET
    const fromRawTail = [sample('2026-09-23T04:10:00Z', 70)]; // same ET hour
    const out = todayHourlyBusyPct([...fromRollup, ...fromRawTail], DAY, NOW, TZ);
    expect(out[0]).toBe(60); // median of [50, 70] regardless of which source each came from
  });
});

describe('machine.days — shapeMachineDay / machineDays', () => {
  const rollup = (day, p50, p90, max, cores = 12) => ({ day, cores, load1: { p50, p90, p99: p90, max } });

  it('shapes a rollup into a days[] entry', () => {
    expect(shapeMachineDay(rollup('2026-09-22', 11.9, 32.7, 104.4))).toEqual({
      day: '2026-09-22', label: 'Tue Sep 22', load1: { p50: 11.9, p90: 32.7, max: 104.4 },
    });
  });

  it('drops a malformed rollup rather than rendering a day with no numbers', () => {
    expect(shapeMachineDay(null)).toBeNull();
    expect(shapeMachineDay({})).toBeNull();
    expect(shapeMachineDay({ day: '2026-09-22' })).toEqual({
      day: '2026-09-22', label: 'Tue Sep 22', load1: { p50: null, p90: null, max: null },
    });
  });

  it('caps at 3 and filters out the malformed ones', () => {
    const out = machineDays([
      rollup('2026-09-22', 1, 2, 3), null, rollup('2026-09-21', 4, 5, 6),
      rollup('2026-09-20', 7, 8, 9), rollup('2026-09-19', 10, 11, 12),
    ]);
    expect(out.length).toBe(3);
    expect(out.map((d) => d.day)).toEqual(['2026-09-22', '2026-09-21', '2026-09-20']);
  });
});

describe('the degraded rule — sourceState / shapeSources', () => {
  const NOW_MS = new Date('2026-09-23T12:00:00Z').getTime();

  it('claude-usage: silent > 15 min WITH sessions running is stale', () => {
    const lastAtMs = NOW_MS - (CLAUDE_USAGE_STALE_MS + 60_000);
    expect(sourceState({ id: 'claude-usage', lastAtMs, nowMs: NOW_MS, sessionsLive: 3 })).toBe('stale');
  });

  it('claude-usage: silent with 0 sessions running is ok — an idle laptop, not a gap', () => {
    const lastAtMs = NOW_MS - (CLAUDE_USAGE_STALE_MS + 60_000);
    expect(sourceState({ id: 'claude-usage', lastAtMs, nowMs: NOW_MS, sessionsLive: 0 })).toBe('ok');
  });

  it('claude-usage: within the window is ok regardless of session count', () => {
    expect(sourceState({ id: 'claude-usage', lastAtMs: NOW_MS - 60_000, nowMs: NOW_MS, sessionsLive: 5 })).toBe('ok');
  });

  it('host-sampler and rollups use their own (non-session-gated) staleness thresholds', () => {
    expect(sourceState({ id: 'host-sampler', lastAtMs: NOW_MS - (HOST_SAMPLER_STALE_MS + 1000), nowMs: NOW_MS }))
      .toBe('stale');
    expect(sourceState({ id: 'host-sampler', lastAtMs: NOW_MS - 1000, nowMs: NOW_MS })).toBe('ok');
    expect(sourceState({ id: 'rollups', lastAtMs: NOW_MS - (ROLLUP_STALE_MS + 1000), nowMs: NOW_MS })).toBe('stale');
    expect(sourceState({ id: 'rollups', lastAtMs: NOW_MS - 1000, nowMs: NOW_MS })).toBe('ok');
  });

  it('no data ever (`lastAtMs: null`) is ok, not stale — a fresh store, not a gap', () => {
    expect(sourceState({ id: 'claude-usage', lastAtMs: null, nowMs: NOW_MS, sessionsLive: 5 })).toBe('ok');
  });

  it('a missing directory reads `missing` and is named in `degraded`; the rest still renders', () => {
    const { sources, degraded } = shapeSources({
      'claude-usage': { lastAtMs: NOW_MS - 60_000, missing: false, root: '/a' },
      'host-sampler': { missing: true, root: '/does/not/exist' },
      rollups: { lastAtMs: NOW_MS - 60_000, missing: false, root: '/c' },
    }, NOW_MS, 0);
    expect(sources).toEqual(expect.arrayContaining(SOURCE_IDS.map((id) => expect.objectContaining({ id }))));
    const hostSampler = sources.find((s) => s.id === 'host-sampler');
    expect(hostSampler.state).toBe('missing');
    expect(hostSampler.lastAt).toBeNull();
    expect(degraded).toEqual(['host-sampler']);
    // A stale-but-readable source is NOT degraded — only a read failure is.
    const usage = sources.find((s) => s.id === 'claude-usage');
    expect(usage.state).toBe('ok');
  });

  it('a stale (but readable) source is reported in sources[] but never in degraded[]', () => {
    const { sources, degraded } = shapeSources({
      'claude-usage': { lastAtMs: NOW_MS - (CLAUDE_USAGE_STALE_MS + 60_000), missing: false, root: '/a' },
      'host-sampler': { lastAtMs: NOW_MS - 60_000, missing: false, root: '/b' },
      rollups: { lastAtMs: NOW_MS - 60_000, missing: false, root: '/c' },
    }, NOW_MS, 7);
    expect(sources.find((s) => s.id === 'claude-usage').state).toBe('stale');
    expect(degraded).toEqual([]);
  });

  it('every entry names its root, whatever its state', () => {
    const { sources } = shapeSources({
      'claude-usage': { lastAtMs: NOW_MS, missing: false, root: '/roots/claude-usage' },
      'host-sampler': { missing: true, root: '/roots/host-sampler' },
      rollups: { lastAtMs: NOW_MS, missing: false, root: '/roots/rollups' },
    }, NOW_MS, 0);
    expect(sources.map((s) => s.root)).toEqual(['/roots/claude-usage', '/roots/host-sampler', '/roots/rollups']);
  });
});

describe('the collector-restart hazard (#3739)', () => {
  it('is present only when the plist exists AND its script path does not', () => {
    expect(collectorHazards({ plistFound: true, scriptExists: false })).toEqual([
      { id: 'collector-restart', ref: 'WE #3739' },
    ]);
  });

  it('is absent when the script path exists', () => {
    expect(collectorHazards({ plistFound: true, scriptExists: true })).toEqual([]);
  });

  it('a missing plist is a different (unmodelled) problem, never this hazard', () => {
    expect(collectorHazards({ plistFound: false, scriptExists: null })).toEqual([]);
    expect(collectorHazards({ plistFound: false, scriptExists: false })).toEqual([]);
  });

  it('an undetermined script path (plutil and the regex both failed) is not claimed as a hazard', () => {
    expect(collectorHazards({ plistFound: true, scriptExists: null })).toEqual([]);
  });
});
