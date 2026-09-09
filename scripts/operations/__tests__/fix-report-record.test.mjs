/**
 * @file fix-report-record.test.mjs — the pure fix-report core (#xu2pp2m, downstream of #3627's
 * `delivery-report-record.mjs`).
 */
import { describe, it, expect } from 'vitest';

import {
  FIX_REPORT_VERSION,
  applyFixUpdate,
  assertFixReport,
  isValidFixSessionSlug,
  newFixReport,
  parseFixReport,
  serializeFixReport,
  validateFixReport,
  validateLearning,
} from '../fix-report-record.mjs';

const fixedNow = () => '2026-09-09T00:00:00.000Z';

describe('newFixReport', () => {
  it('produces exactly the documented `started` shape', () => {
    expect(newFixReport({ session: 'fix-2108', pr: '2108', item: '3629', now: fixedNow })).toEqual({
      v: FIX_REPORT_VERSION, session: 'fix-2108', pr: '2108', item: '3629',
      status: 'started', outcome: null, reason: null, filesTouched: null, learning: null,
      startedAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z',
    });
  });

  it('defaults item to null when omitted — unlike a delivery report, item is optional for a fix', () => {
    expect(newFixReport({ session: 'fix-2108', pr: '2108', now: fixedNow }).item).toBe(null);
  });

  it('refuses an invalid session slug', () => {
    for (const bad of ['../escape', 'a/b', '', '.', '..']) {
      expect(isValidFixSessionSlug(bad)).toBe(false);
      expect(() => newFixReport({ session: bad, pr: '1' })).toThrow(/invalid fix-report session slug/);
    }
    expect(isValidFixSessionSlug('fix-2108')).toBe(true);
  });

  it('refuses a missing pr — unlike item, pr is required (a fix always targets an existing PR)', () => {
    expect(() => newFixReport({ session: 'fix-1' })).toThrow(/requires `pr`/);
  });
});

describe('applyFixUpdate', () => {
  it('merges named fields and bumps updatedAt, leaving identity fields untouched', () => {
    const started = newFixReport({ session: 'fix-9', pr: '9', now: fixedNow });
    const later = () => '2026-09-09T01:00:00.000Z';
    const done = applyFixUpdate(started, { status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'] }, later);
    expect(done).toEqual({ ...started, status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'], updatedAt: '2026-09-09T01:00:00.000Z' });
    expect(done.startedAt).toBe(started.startedAt);
    expect(done.session).toBe('fix-9');
    expect(done.pr).toBe('9');
  });

  it('leaves an unmentioned field alone', () => {
    const started = newFixReport({ session: 'fix-9', pr: '9' });
    const patched = applyFixUpdate(started, { outcome: 'blocked' });
    expect(patched.status).toBe('started');
  });
});

describe('validateLearning', () => {
  it('accepts null — a fix agent with no generalizable friction reports nothing', () => {
    expect(validateLearning(null)).toEqual({ ok: true, errors: [] });
  });

  it('requires all four fields when a learning IS given', () => {
    const { ok, errors } = validateLearning({ kind: 'friction' });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      '`learning.summary` is required and must be a non-empty string',
      '`learning.area` is required and must be a non-empty string',
      '`learning.suggestion` is required and must be a non-empty string',
    ]));
  });

  it('rejects an unknown kind and an over-length summary', () => {
    const { ok, errors } = validateLearning({ kind: 'nope', summary: 'x'.repeat(241), area: 'a', suggestion: 's' });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/`learning\.kind` must be one of/),
      '`learning.summary` must be at most 240 chars',
    ]));
  });

  it('accepts a well-formed learning', () => {
    expect(validateLearning({ kind: 'doc-gap', summary: 'short', area: 'rearm', suggestion: 'fix docs' }).ok).toBe(true);
  });
});

describe('validateFixReport', () => {
  it('reports EVERY problem, not just the first', () => {
    const { ok, errors } = validateFixReport({ v: 2, session: '', pr: '', item: 5, status: 'huh', outcome: 'nope', reason: 5, filesTouched: 'x', startedAt: 'later', updatedAt: 'later' });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'unsupported fix report version 2',
      'missing or invalid `session`',
      'missing or invalid `pr`',
      '`item` must be a string or null',
      '`status` must be one of started/done',
      expect.stringMatching(/`outcome` must be null or one of/),
      '`reason` must be a string or null',
      '`filesTouched` must be an array of non-empty strings, or null',
      'missing or unparseable `startedAt`',
      'missing or unparseable `updatedAt`',
    ]));
  });

  it('accepts a well-formed started record', () => {
    expect(validateFixReport(newFixReport({ session: 'fix-1', pr: '1' })).ok).toBe(true);
  });

  it('accepts a well-formed `done` record with outcome `fixed` and no reason', () => {
    const record = applyFixUpdate(newFixReport({ session: 'fix-1', pr: '1' }), { status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'] });
    expect(validateFixReport(record).ok).toBe(true);
  });

  // The load-bearing rule, mirrors delivery-report-record.mjs's own: a hedge with no named reason is refused.
  it.each(['blocked', 'escalated-needs-judgment', 'escalated-conflict'])('refuses a `done`-status report with outcome %s and no `reason`', (outcome) => {
    const record = applyFixUpdate(newFixReport({ session: 'fix-1', pr: '1' }), { status: 'done', outcome });
    const { ok, errors } = validateFixReport(record);
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/requires a non-empty `reason`/)]));
  });

  it('accepts a `done`-status report with outcome `escalated-conflict` when `reason` names the overlap', () => {
    const record = applyFixUpdate(newFixReport({ session: 'fix-1', pr: '1' }), { status: 'done', outcome: 'escalated-conflict', reason: 'main rewrote the same lines' });
    expect(validateFixReport(record).ok).toBe(true);
  });

  it('is not an object at all', () => {
    expect(validateFixReport(null).errors).toEqual(['fix report must be an object']);
    expect(validateFixReport([]).errors).toEqual(['fix report must be an object']);
  });
});

describe('assertFixReport', () => {
  it('throws carrying the errors', () => {
    expect(() => assertFixReport({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trips a well-formed record', () => {
    const record = newFixReport({ session: 'fix-1', pr: '1' });
    const parsed = parseFixReport(serializeFixReport(record));
    expect(parsed.ok).toBe(true);
    expect(parsed.record).toEqual(record);
  });

  it.each([
    ['empty', '', /is empty/],
    ['whitespace', '   \n', /is empty/],
    ['torn json', '{"v":1,"sess', /not parseable JSON/],
    ['a JSON array', '[]', /fix report must be an object/],
    ['wrong shape', '{"hello":"world"}', /unsupported fix report version/],
  ])('%s → corrupt, never silently absent', (_label, text, pattern) => {
    const parsed = parseFixReport(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(parsed.reason).toMatch(pattern);
  });
});
