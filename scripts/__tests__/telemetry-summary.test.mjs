/**
 * @file telemetry-summary.test.mjs — proof of `scripts/lib/telemetry-summary.mjs`, the usage half of
 * `TelemetrySnapshot` v1 (backlog `xs0eutz`, epic `xjtmptc`).
 *
 * All fixtures are SYNTHETIC (no real emails/ids), shaped exactly like the real claude-otel-collector day
 * files: `{v, receivedAt, name, unit, value, attributes:{model, query_source, type, ...}}`, values are DELTAS.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  summarizeTelemetryUsage, modelFamily, roleOf, nextWeeklyRenewalUtc, previousWeeklyRenewalUtc,
  PLAN_WEEK_RENEWAL,
} from '../lib/telemetry-summary.mjs';

const MODULE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../lib/telemetry-summary.mjs');

const FAKE_ORG = 'org-fake-0001';
const FAKE_USER = 'fake-user-uuid-0001';
const FAKE_EMAIL = 'not-a-real-person@example.invalid';
const FAKE_SESSION_1 = 'session-fake-aaaa';
const FAKE_SESSION_2 = 'session-fake-bbbb';

/** A synthetic cost record. `iso` is `receivedAt`; `model`/`querySource` feed `attributes`. */
function costRec(iso, usd, model = 'claude-sonnet-5', querySource = 'main', sessionId = FAKE_SESSION_1) {
  return {
    v: 1, receivedAt: iso, name: 'claude_code.cost.usage', unit: 'USD', value: usd,
    attributes: {
      model, query_source: querySource, 'session.id': sessionId,
      'user.email': FAKE_EMAIL, 'organization.id': FAKE_ORG, 'user.id': FAKE_USER,
    },
  };
}

function tokenRec(iso, type, value, sessionId = FAKE_SESSION_1) {
  return {
    v: 1, receivedAt: iso, name: 'claude_code.token.usage', unit: 'tokens', value,
    attributes: {
      type, model: 'claude-sonnet-5', query_source: 'main', 'session.id': sessionId,
      'user.email': FAKE_EMAIL, 'organization.id': FAKE_ORG, 'user.id': FAKE_USER,
    },
  };
}

function countRec(iso, name, value, sessionId = FAKE_SESSION_1) {
  return {
    v: 1, receivedAt: iso, name, unit: name.includes('active_time') ? 's' : '', value,
    attributes: {
      model: 'claude-sonnet-5', query_source: 'main', 'session.id': sessionId,
      'user.email': FAKE_EMAIL, 'organization.id': FAKE_ORG, 'user.id': FAKE_USER,
    },
  };
}

describe('module hygiene — pure, no node: imports', () => {
  it('imports no node: specifier', () => {
    const src = readFileSync(MODULE_PATH, 'utf8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    expect(importLines.length).toBe(0); // the module is fully self-contained — zero imports of any kind
    expect(src).not.toMatch(/from\s+['"]node:/);
  });
});

describe('modelFamily / roleOf', () => {
  it('buckets model ids by substring family, else other', () => {
    expect(modelFamily('claude-opus-4-5')).toBe('opus');
    expect(modelFamily('claude-sonnet-5')).toBe('sonnet');
    expect(modelFamily('claude-haiku-4-5')).toBe('haiku');
    expect(modelFamily('claude-mystery-9')).toBe('other');
    expect(modelFamily(undefined)).toBe('other');
  });

  it('buckets query_source into the three known roles, else other', () => {
    expect(roleOf('main')).toBe('main');
    expect(roleOf('subagent')).toBe('subagent');
    expect(roleOf('auxiliary')).toBe('auxiliary');
    expect(roleOf('something-else')).toBe('other');
    expect(roleOf(undefined)).toBe('other');
  });
});

// The plan week spans the 2026 fall-back DST transition (clocks fall back 1h at 2026-11-01 02:00 America/
// New_York, i.e. 2026-11-01T06:00:00Z). `now` = Tue 2026-11-03 12:00 ET (EST, UTC-5).
const NOW_DST = new Date('2026-11-03T17:00:00.000Z');

describe('the plan week — DST-safe boundaries', () => {
  it('previousWeeklyRenewalUtc/nextWeeklyRenewalUtc land on Friday 16:00 zone-local, both sides of fall-back', () => {
    const start = previousWeeklyRenewalUtc(NOW_DST, PLAN_WEEK_RENEWAL);
    const end = nextWeeklyRenewalUtc(NOW_DST, PLAN_WEEK_RENEWAL);
    // Fri 2026-10-30 16:00 EDT (UTC-4) = 2026-10-30T20:00:00Z
    expect(start.toISOString()).toBe('2026-10-30T20:00:00.000Z');
    // Fri 2026-11-06 16:00 EST (UTC-5, already past fall-back) = 2026-11-06T21:00:00Z
    expect(end.toISOString()).toBe('2026-11-06T21:00:00.000Z');
  });

  it('produces 8 ET calendar day slots, Fri through Fri, with partial markers on the boundary days', () => {
    const out = summarizeTelemetryUsage({ records: [], now: NOW_DST });
    expect(out.week.days).toHaveLength(8);
    expect(out.week.days[0].day).toBe('2026-10-30');
    expect(out.week.days[0].label).toBe('Fri');
    expect(out.week.days[0].partial).toBe('from 4 PM');
    expect(out.week.days[7].day).toBe('2026-11-06');
    expect(out.week.days[7].partial).toBe('to 4 PM');
    for (let i = 1; i < 7; i += 1) expect(out.week.days[i].partial).toBeNull();
  });

  it('marks days after "now" as future, with no data', () => {
    const out = summarizeTelemetryUsage({ records: [], now: NOW_DST });
    // now is 2026-11-03 (Tue) — Wed/Thu/Fri (indices 4,5,6... actually 2026-11-04,05,06) are future
    const byDay = Object.fromEntries(out.week.days.map((d) => [d.day, d]));
    expect(byDay['2026-11-03'].future).toBe(false); // today itself is present, not future
    expect(byDay['2026-11-04'].future).toBe(true);
    expect(byDay['2026-11-06'].future).toBe(true);
  });
});

describe('week totals — records before the window, families, roles, gap days', () => {
  const records = [
    // Before the window entirely (Thu 2026-10-29) — must be excluded from every total.
    costRec('2026-10-29T12:00:00.000Z', 999, 'claude-opus-4-5', 'main'),
    // On the boundary Friday but BEFORE 4 PM ET (2026-10-30T19:00Z = 15:00 EDT) — still last week, excluded.
    costRec('2026-10-30T19:00:00.000Z', 500, 'claude-opus-4-5', 'main'),
    // On the boundary Friday AFTER 4 PM ET (2026-10-30T21:00Z = 17:00 EDT) — inside the window.
    costRec('2026-10-30T21:00:00.000Z', 1.5, 'claude-opus-4-5', 'main'),
    // A UTC-midnight record that belongs to the PREVIOUS ET day: 2026-10-31T04:00:00Z is EDT-4 -> 2026-10-30
    // 00:00 local... use a value that's unambiguous: 2026-10-31T00:30:00Z (EDT -4) = 2026-10-30 20:30 ET,
    // i.e. UTC calendar date is the 31st but the ET calendar day is the 30th.
    costRec('2026-10-31T00:30:00.000Z', 2.25, 'claude-sonnet-5', 'subagent', FAKE_SESSION_2),
    // Sat 2026-10-31 — one model per family plus an unknown one, one role per known value plus an unknown one.
    costRec('2026-10-31T15:00:00.000Z', 10, 'claude-opus-4-5', 'main'),
    costRec('2026-10-31T15:05:00.000Z', 20, 'claude-sonnet-5', 'subagent'),
    costRec('2026-10-31T15:10:00.000Z', 5, 'claude-haiku-4-5', 'auxiliary'),
    costRec('2026-10-31T15:15:00.000Z', 3, 'claude-mystery-9', 'something-else'),
    // Sun 2026-11-01 (the actual fall-back day, 2am local repeats) — after the window's own conversion this
    // is well inside the plan week; give it a small amount to prove the transition day itself is still summed.
    costRec('2026-11-01T18:00:00.000Z', 7, 'claude-sonnet-5', 'main'),
    // Mon 2026-11-02 — deliberately ZERO records: the gap day.
    // After the window entirely (Sat 2026-11-07, after the renewal) — must be excluded.
    costRec('2026-11-07T13:00:00.000Z', 111, 'claude-opus-4-5', 'main'),
  ];

  const out = summarizeTelemetryUsage({ records, now: NOW_DST });

  it('excludes records outside the window (before start, after end, and the pre-4PM boundary-day record)', () => {
    // 1.5 (boundary Fri) + 2.25 (UTC-midnight, previous ET day) + 10+20+5+3 (Sat) + 7 (Sun, DST day) = 48.75
    expect(out.week.totalUsd).toBeCloseTo(48.75, 6);
  });

  it('files the UTC-midnight record under the correct ET day (the 30th, not the 31st)', () => {
    const oct30 = out.week.days.find((d) => d.day === '2026-10-30');
    // 1.5 (post-4PM boundary record) + 2.25 (UTC-midnight record) = 3.75, all sonnet+opus split correctly
    expect(oct30.usd.opus).toBeCloseTo(1.5, 6);
    expect(oct30.usd.sonnet).toBeCloseTo(2.25, 6);
  });

  it('byModel sums opus/sonnet/haiku/other and equals totalUsd', () => {
    expect(out.week.byModel.opus).toBeCloseTo(1.5 + 10, 6);
    expect(out.week.byModel.sonnet).toBeCloseTo(2.25 + 20 + 7, 6);
    expect(out.week.byModel.haiku).toBeCloseTo(5, 6);
    expect(out.week.byModel.other).toBeCloseTo(3, 6);
    const sum = out.week.byModel.opus + out.week.byModel.sonnet + out.week.byModel.haiku + out.week.byModel.other;
    expect(sum).toBeCloseTo(out.week.totalUsd, 6);
  });

  it('byRole sums main/subagent/auxiliary/other and equals totalUsd', () => {
    expect(out.week.byRole.main).toBeCloseTo(1.5 + 10 + 7, 6);
    expect(out.week.byRole.subagent).toBeCloseTo(2.25 + 20, 6);
    expect(out.week.byRole.auxiliary).toBeCloseTo(5, 6);
    expect(out.week.byRole.other).toBeCloseTo(3, 6);
    const sum = out.week.byRole.main + out.week.byRole.subagent + out.week.byRole.auxiliary + out.week.byRole.other;
    expect(sum).toBeCloseTo(out.week.totalUsd, 6);
  });

  it('names the zero-record ET day (Mon) as a gap, usd:null, excluded from totalUsd, and not marked future', () => {
    const mon = out.week.days.find((d) => d.day === '2026-11-02');
    expect(mon.usd).toBeNull();
    expect(mon.future).toBe(false);
    expect(out.week.incomplete).toContain('Mon');
    expect(out.week.incomplete.toLowerCase()).toContain('no data');
  });

  it('future days also have usd:null but are never named in incomplete', () => {
    const wed = out.week.days.find((d) => d.day === '2026-11-04');
    expect(wed.usd).toBeNull();
    expect(wed.future).toBe(true);
    expect(out.week.incomplete).not.toContain('Wed');
  });
});

describe('previousWeek comparability', () => {
  it('is NOT comparable when the store\'s earliest record does not predate the previous window\'s own start', () => {
    // Earliest record is inside the CURRENT week only — previous week (Oct 23 16:00 -> Oct 30 16:00 ET) has
    // no coverage at all.
    const out = summarizeTelemetryUsage({
      records: [costRec('2026-10-31T15:00:00.000Z', 10)],
      now: NOW_DST,
    });
    expect(out.week.previousWeek.comparable).toBe(false);
    expect(out.week.previousWeek.reason).toMatch(/usage data starts/i);
  });

  it('IS comparable when the earliest record predates the previous window\'s start, and totals that window', () => {
    const records = [
      // Well before the previous window even starts (2026-10-23T20:00:00Z).
      costRec('2026-10-15T12:00:00.000Z', 1, 'claude-sonnet-5', 'main'),
      // Inside the previous week (Oct 23 16:00 ET -> Oct 30 16:00 ET).
      costRec('2026-10-24T15:00:00.000Z', 4, 'claude-opus-4-5', 'main'),
      costRec('2026-10-29T15:00:00.000Z', 6, 'claude-opus-4-5', 'main'),
      // Inside the current week (should not leak into previousWeek's total).
      costRec('2026-10-31T15:00:00.000Z', 999, 'claude-opus-4-5', 'main'),
    ];
    const out = summarizeTelemetryUsage({ records, now: NOW_DST });
    expect(out.week.previousWeek).toEqual({ comparable: true, totalUsd: expect.any(Number) });
    expect(out.week.previousWeek.totalUsd).toBeCloseTo(10, 6);
  });

  it('reports "no usage data recorded yet" when there are no records at all', () => {
    const out = summarizeTelemetryUsage({ records: [], now: NOW_DST });
    expect(out.week.previousWeek).toEqual({ comparable: false, reason: 'no usage data recorded yet' });
  });
});

describe('cacheHitPct = cacheRead / (cacheRead + cacheCreation + input), null when the denominator is 0', () => {
  it('computes the ratio for today, excluding output from the denominator', () => {
    const iso = NOW_DST.toISOString().slice(0, 10) + 'T15:00:00.000Z';
    const records = [
      tokenRec(iso, 'input', 100),
      tokenRec(iso, 'output', 500), // must NOT appear in the denominator
      tokenRec(iso, 'cacheRead', 300),
      tokenRec(iso, 'cacheCreation', 100),
    ];
    const out = summarizeTelemetryUsage({ records, now: NOW_DST });
    expect(out.today.cacheHitPct).toBeCloseTo(300 / (300 + 100 + 100), 10);
    expect(out.today.tokens).toEqual({ input: 100, output: 500, cacheRead: 300, cacheCreation: 100 });
  });

  it('is null when there are no cache/input tokens today', () => {
    const out = summarizeTelemetryUsage({ records: [], now: NOW_DST });
    expect(out.today.cacheHitPct).toBeNull();
  });
});

describe('today — commits, lines changed, sessions, active hours', () => {
  it('sums the day\'s delta counters for the ET day "now" falls on', () => {
    const day = NOW_DST.toISOString().slice(0, 10); // 2026-11-03
    const records = [
      countRec(`${day}T14:00:00.000Z`, 'claude_code.commit.count', 3),
      countRec(`${day}T15:00:00.000Z`, 'claude_code.commit.count', 2),
      countRec(`${day}T14:00:00.000Z`, 'claude_code.lines_of_code.count', 120),
      countRec(`${day}T14:00:00.000Z`, 'claude_code.session.count', 1),
      countRec(`${day}T14:00:00.000Z`, 'claude_code.active_time.total', 3600),
      countRec(`${day}T14:30:00.000Z`, 'claude_code.active_time.total', 1800),
      // A different (previous) ET day — must not leak into today's totals.
      countRec('2026-11-02T14:00:00.000Z', 'claude_code.commit.count', 50),
    ];
    const out = summarizeTelemetryUsage({ records, now: NOW_DST });
    expect(out.today.commits).toBe(5);
    expect(out.today.linesChanged).toBe(120);
    expect(out.today.sessions).toBe(1);
    expect(out.today.activeHours).toBeCloseTo(1.5, 10);
  });
});

describe('last10 — 10 trailing ET days ending today, independent of the plan-week window', () => {
  it('has 10 entries ending on today, each carrying its own usd (null when no cost record that day)', () => {
    const records = [
      costRec('2026-11-03T14:00:00.000Z', 9, 'claude-sonnet-5', 'main'), // today
      costRec('2026-10-25T14:00:00.000Z', 4, 'claude-opus-4-5', 'main'), // 9 days ago — inside last10
    ];
    const out = summarizeTelemetryUsage({ records, now: NOW_DST });
    expect(out.last10).toHaveLength(10);
    expect(out.last10[9].day).toBe('2026-11-03');
    expect(out.last10[9].usd).toBeCloseTo(9, 6);
    expect(out.last10[0].day).toBe('2026-10-25');
    expect(out.last10[0].usd).toBeCloseTo(4, 6);
    // A day with no cost record at all (but is within range) reports usd: null, never 0.
    const noCostDay = out.last10.find((d) => d.day === '2026-10-26');
    expect(noCostDay.usd).toBeNull();
  });
});

describe('no identity ever reaches the output (allowlist projection)', () => {
  it('a serialised snapshot contains none of the fixtures\' identity strings', () => {
    const records = [
      costRec('2026-10-31T15:00:00.000Z', 10, 'claude-opus-4-5', 'main', FAKE_SESSION_1),
      costRec('2026-10-31T15:05:00.000Z', 5, 'claude-sonnet-5', 'subagent', FAKE_SESSION_2),
      tokenRec('2026-11-03T14:00:00.000Z', 'input', 10, FAKE_SESSION_1),
    ];
    const out = summarizeTelemetryUsage({ records, now: NOW_DST });
    const json = JSON.stringify(out);
    for (const needle of [FAKE_ORG, FAKE_USER, FAKE_EMAIL, FAKE_SESSION_1, FAKE_SESSION_2]) {
      expect(json).not.toContain(needle);
    }
  });
});
