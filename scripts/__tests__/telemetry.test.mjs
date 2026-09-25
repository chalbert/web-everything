/**
 * @file telemetry.test.mjs — proof of `scripts/lib/telemetry.mjs`, backlog #4071's per-daemon/per-bot cost
 * summarizer. Fixtures are SYNTHETIC, shaped exactly like the real records this module reads: a
 * `claude-otel-collector` day-file record (`{v, receivedAt, name, unit, value, attributes}`) and a
 * `dispatch.worker.event`/`gh.throttle.*` delivery-telemetry metric line
 * (`{v, event:'metric', name, kind, value, unit, timestamp, attributes}` — see
 * `we:scripts/operations/telemetry.mjs#newMetric`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  DAEMON_ROLES, DISPATCH_KIND_TO_DAEMON, daemonForWorkerName, daemonForDispatchKind,
  buildSessionDaemonMap, summarizeCostByDaemon,
} from '../lib/telemetry.mjs';

const MODULE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../lib/telemetry.mjs');

const FAKE_ORG = 'org-fake-0001';
const FAKE_USER = 'fake-user-uuid-0001';
const FAKE_EMAIL = 'not-a-real-person@example.invalid';

function costRec(iso, usd, sessionId) {
  return {
    v: 1, receivedAt: iso, name: 'claude_code.cost.usage', unit: 'USD', value: usd,
    attributes: {
      model: 'claude-sonnet-5', query_source: 'main', 'session.id': sessionId,
      'user.email': FAKE_EMAIL, 'organization.id': FAKE_ORG, 'user.id': FAKE_USER,
    },
  };
}

function tokenRec(iso, type, value, sessionId) {
  return {
    v: 1, receivedAt: iso, name: 'claude_code.token.usage', unit: 'tokens', value,
    attributes: {
      type, model: 'claude-sonnet-5', query_source: 'main', 'session.id': sessionId,
      'user.email': FAKE_EMAIL, 'organization.id': FAKE_ORG, 'user.id': FAKE_USER,
    },
  };
}

/** A synthetic `dispatch.worker.event` sample — the join record (see file header). */
function workerEvent(iso, name, sessionId, kind = 'task') {
  return {
    v: 1, event: 'metric', name: 'dispatch.worker.event', kind: 'sampler', value: 1, unit: 'count', timestamp: iso,
    traceId: null,
    attributes: { at: iso, event: 'finish', kind, name, session_id: sessionId, source: 'host-sampler' },
    resource: {},
  };
}

function ghThrottleEvent(iso, name, kind) {
  return {
    v: 1, event: 'metric', name, kind, value: 1, unit: 'count', timestamp: iso, traceId: null,
    attributes: { op: 'pr view', attempt: 1 }, resource: {},
  };
}

describe('module hygiene — pure, no node: imports', () => {
  it('imports no node: specifier', () => {
    const src = readFileSync(MODULE_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"]node:/);
  });
});

describe('daemonForWorkerName / DISPATCH_KIND_TO_DAEMON', () => {
  it('classifies each known session-slug kind into its owning daemon', () => {
    expect(daemonForWorkerName('review-2625')).toBe('review');
    expect(daemonForWorkerName('fix-2602')).toBe('fix-dispatch');
    expect(daemonForWorkerName('ci-heal-2643')).toBe('fix-dispatch');
    expect(daemonForWorkerName('conveyor-4071')).toBe('dispatcher');
    expect(daemonForWorkerName('prepare-4071')).toBe('dispatcher');
    expect(daemonForWorkerName('prepare-decision-4071')).toBe('dispatcher');
    expect(daemonForWorkerName('inspect-2625')).toBe('stuck-pr-inspector');
  });

  it('falls back to interactive for a name the slug grammar does not recognise — never a guess', () => {
    expect(daemonForWorkerName('lane-71-d4')).toBe('interactive');
    expect(daemonForWorkerName('webeverything')).toBe('interactive');
    expect(daemonForWorkerName(undefined)).toBe('interactive');
  });

  it('a cross-repo tag still resolves to the same daemon (review-pa-123)', () => {
    expect(daemonForWorkerName('review-pa-123')).toBe('review');
  });

  it('DAEMON_ROLES names all five daemons plus interactive/unattributed, exactly once', () => {
    expect(DAEMON_ROLES).toEqual([
      'review', 'fix-dispatch', 'dispatcher', 'stuck-pr-inspector', 'health-investigator', 'interactive', 'unattributed',
    ]);
    expect(new Set(DAEMON_ROLES).size).toBe(DAEMON_ROLES.length);
  });

  it('health-investigator is reserved — no live dispatch kind maps to it yet', () => {
    expect(Object.values(DISPATCH_KIND_TO_DAEMON)).not.toContain('health-investigator');
    expect(DAEMON_ROLES).toContain('health-investigator');
  });
});

describe('daemonForDispatchKind', () => {
  it('classifies a DISPATCH_KINDS value', () => {
    expect(daemonForDispatchKind('review')).toBe('review');
    expect(daemonForDispatchKind('fix')).toBe('fix-dispatch');
    expect(daemonForDispatchKind('build')).toBe('dispatcher');
  });
  it('returns null (never a guess) for an unclassified kind', () => {
    expect(daemonForDispatchKind('sampler')).toBeNull();
    expect(daemonForDispatchKind('unknown')).toBeNull();
    expect(daemonForDispatchKind(undefined)).toBeNull();
  });
});

describe('buildSessionDaemonMap', () => {
  it('joins a session id to its worker name\'s daemon, keeping the FIRST classification', () => {
    const events = [
      workerEvent('2026-09-25T00:00:00Z', 'review-2625', 'sess-aaaa'),
      workerEvent('2026-09-25T00:00:05Z', 'review-2625', 'sess-aaaa'), // repeat sample, same worker
      workerEvent('2026-09-25T00:00:10Z', 'fix-2602', 'sess-bbbb'),
    ];
    const map = buildSessionDaemonMap(events);
    expect(map.get('sess-aaaa')).toBe('review');
    expect(map.get('sess-bbbb')).toBe('fix-dispatch');
    expect(map.size).toBe(2);
  });

  it('ignores non-worker-event metrics and events with no session_id', () => {
    const events = [
      ghThrottleEvent('2026-09-25T00:00:00Z', 'gh.throttle.rate_limited', 'review'),
      { v: 1, event: 'metric', name: 'dispatch.worker.event', kind: 'sampler', attributes: { name: 'review-1' } },
    ];
    expect(buildSessionDaemonMap(events).size).toBe(0);
  });
});

describe('summarizeCostByDaemon — the fixture-session-to-daemon attribution pin (Done when #1)', () => {
  const NOW = '2026-09-25T12:00:00Z';

  it('attributes a fixture session\'s tokens and dollars to its daemon via the worker-event join', () => {
    const deliveryEvents = [
      workerEvent('2026-09-25T00:00:05Z', 'review-2625', 'sess-review'),
      workerEvent('2026-09-25T00:03:10Z', 'fix-2602', 'sess-fix'),
    ];
    const usageRecords = [
      costRec('2026-09-25T00:00:07Z', 0.50, 'sess-review'),
      tokenRec('2026-09-25T00:00:07Z', 'input', 1000, 'sess-review'),
      tokenRec('2026-09-25T00:00:07Z', 'output', 200, 'sess-review'),
      costRec('2026-09-25T00:03:12Z', 0.10, 'sess-fix'),
      costRec('2026-09-25T00:05:00Z', 0.02, 'sess-unknown'), // no worker-event sample — must NOT be guessed
    ];

    const out = summarizeCostByDaemon({ usageRecords, deliveryEvents, now: NOW, timezone: 'UTC' });

    expect(out.days).toHaveLength(1);
    const day = out.days[0];
    expect(day.day).toBe('2026-09-25');
    expect(day.daemons.review.usd).toBeCloseTo(0.50, 6);
    expect(day.daemons.review.tokens).toEqual({ input: 1000, output: 200, cacheRead: 0, cacheCreation: 0 });
    expect(day.daemons.review.sessions).toBe(1);
    expect(day.daemons['fix-dispatch'].usd).toBeCloseTo(0.10, 6);
    expect(day.daemons.unattributed.usd).toBeCloseTo(0.02, 6);
    expect(day.daemons.dispatcher.usd).toBe(0);
    expect(day.daemons['stuck-pr-inspector'].usd).toBe(0);
    expect(day.daemons['health-investigator'].usd).toBe(0);

    expect(out.sessionsAttributed).toBe(2);
    expect(out.sessionsUnattributed).toBe(1);
  });

  it('every day\'s daemon totals sum to that day\'s grand total exactly (to the cent)', () => {
    const deliveryEvents = [workerEvent('2026-09-25T00:00:05Z', 'review-2625', 'sess-review')];
    const usageRecords = [
      costRec('2026-09-25T00:00:07Z', 0.123456, 'sess-review'),
      costRec('2026-09-25T01:00:00Z', 0.5, 'sess-unknown'),
    ];
    const out = summarizeCostByDaemon({ usageRecords, deliveryEvents, now: NOW });
    const day = out.days[0];
    const sum = Object.values(day.daemons).reduce((s, d) => s + d.usd, 0);
    expect(sum).toBeCloseTo(0.623456, 6);
  });

  it('counts gh.throttle.* events per day, by the metric\'s own `kind` field', () => {
    const deliveryEvents = [
      ghThrottleEvent('2026-09-25T00:00:00Z', 'gh.throttle.rate_limited', 'review'),
      ghThrottleEvent('2026-09-25T00:00:01Z', 'gh.throttle.exhausted', 'review'),
      ghThrottleEvent('2026-09-25T00:00:02Z', 'gh.throttle.rate_limited', 'fix'),
      ghThrottleEvent('2026-09-25T00:00:03Z', 'gh.throttle.rate_limited', 'sampler'), // unclassified — dropped
    ];
    const out = summarizeCostByDaemon({ usageRecords: [], deliveryEvents, now: NOW });
    const day = out.days[0];
    expect(day.daemons.review.ghThrottleEvents).toBe(2);
    expect(day.daemons['fix-dispatch'].ghThrottleEvents).toBe(1);
    const total = Object.values(day.daemons).reduce((s, d) => s + d.ghThrottleEvents, 0);
    expect(total).toBe(3); // the sampler-kind event is never guessed into a named daemon
  });

  it('splits usage across multiple ET days present in the input', () => {
    const deliveryEvents = [
      workerEvent('2026-09-24T23:59:00Z', 'review-1', 'sess-a'),
      workerEvent('2026-09-25T00:01:00Z', 'review-2', 'sess-b'),
    ];
    const usageRecords = [
      costRec('2026-09-24T23:59:30Z', 1, 'sess-a'),
      costRec('2026-09-25T00:01:30Z', 2, 'sess-b'),
    ];
    const out = summarizeCostByDaemon({ usageRecords, deliveryEvents, now: NOW, timezone: 'UTC' });
    expect(out.days.map((d) => d.day)).toEqual(['2026-09-24', '2026-09-25']);
    expect(out.days[0].daemons.review.usd).toBe(1);
    expect(out.days[1].daemons.review.usd).toBe(2);
  });

  it('throws on an invalid `now`, never silently reports an empty snapshot', () => {
    expect(() => summarizeCostByDaemon({ now: 'not-a-date' })).toThrow(/not a valid date/);
  });

  it('is stable with no input at all', () => {
    expect(summarizeCostByDaemon({ now: NOW })).toEqual({ days: [], sessionsAttributed: 0, sessionsUnattributed: 0 });
  });
});
