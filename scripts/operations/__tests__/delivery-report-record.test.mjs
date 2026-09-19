/**
 * @file delivery-report-record.test.mjs — the pure delivery-report core (#3627 design prototype).
 */
import { describe, it, expect } from 'vitest';

import {
  DELIVERY_REPORT_VERSION,
  applyDeliveryUpdate,
  assertDeliveryReport,
  isValidDeliverySessionSlug,
  newDeliveryReport,
  parseDeliveryReport,
  serializeDeliveryReport,
  validateDeliveryReport,
  validateLearning,
} from '../delivery-report-record.mjs';

const fixedNow = () => '2026-09-08T00:00:00.000Z';

describe('newDeliveryReport', () => {
  it('produces exactly the documented `started` shape', () => {
    expect(newDeliveryReport({ session: 'deliver-3627', item: '3627', now: fixedNow })).toEqual({
      v: DELIVERY_REPORT_VERSION, session: 'deliver-3627', item: '3627',
      status: 'started', outcome: null, reason: null, filesTouched: null, learning: null,
      startedAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('refuses an invalid session slug', () => {
    for (const bad of ['../escape', 'a/b', '', '.', '..']) {
      expect(isValidDeliverySessionSlug(bad)).toBe(false);
      expect(() => newDeliveryReport({ session: bad, item: '1' })).toThrow(/invalid delivery-report session slug/);
    }
    expect(isValidDeliverySessionSlug('deliver-3627')).toBe(true);
  });

  it('refuses a missing item', () => {
    expect(() => newDeliveryReport({ session: 'deliver-1' })).toThrow(/requires `item`/);
  });
});

describe('applyDeliveryUpdate', () => {
  it('merges named fields and bumps updatedAt, leaving identity fields untouched', () => {
    const started = newDeliveryReport({ session: 'deliver-9', item: '9', now: fixedNow });
    const later = () => '2026-09-08T01:00:00.000Z';
    const done = applyDeliveryUpdate(started, { status: 'done', outcome: 'done', filesTouched: ['a.mjs'] }, later);
    expect(done).toEqual({ ...started, status: 'done', outcome: 'done', filesTouched: ['a.mjs'], updatedAt: '2026-09-08T01:00:00.000Z' });
    expect(done.startedAt).toBe(started.startedAt);
    expect(done.session).toBe('deliver-9');
  });

  it('leaves an unmentioned field alone', () => {
    const started = newDeliveryReport({ session: 'deliver-9', item: '9' });
    const patched = applyDeliveryUpdate(started, { outcome: 'blocked' });
    expect(patched.status).toBe('started');
  });
});

describe('validateLearning', () => {
  it('accepts null — a delivery agent with no generalizable friction reports nothing', () => {
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
    expect(validateLearning({ kind: 'doc-gap', summary: 'short', area: 'gate', suggestion: 'fix docs' }).ok).toBe(true);
  });
});

describe('validateDeliveryReport', () => {
  it('reports EVERY problem, not just the first', () => {
    const { ok, errors } = validateDeliveryReport({ v: 2, session: '', item: '', status: 'huh', outcome: 'nope', reason: 5, filesTouched: 'x', startedAt: 'later', updatedAt: 'later' });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'unsupported delivery report version 2',
      'missing or invalid `session`',
      'missing or invalid `item`',
      '`status` must be one of started/done',
      expect.stringMatching(/`outcome` must be null or one of/),
      '`reason` must be a string or null',
      '`filesTouched` must be an array of non-empty strings, or null',
      'missing or unparseable `startedAt`',
      'missing or unparseable `updatedAt`',
    ]));
  });

  it('accepts a well-formed started record', () => {
    expect(validateDeliveryReport(newDeliveryReport({ session: 'deliver-1', item: '1' })).ok).toBe(true);
  });

  it('accepts a well-formed `done` record with outcome `done` and no reason', () => {
    const record = applyDeliveryUpdate(newDeliveryReport({ session: 'deliver-1', item: '1' }), { status: 'done', outcome: 'done', filesTouched: ['a.mjs'] });
    expect(validateDeliveryReport(record).ok).toBe(true);
  });

  // The load-bearing rule from the design amendment: a hedge with no named reason is refused, not accepted.
  it.each(['blocked', 'needs-human-judgment'])('refuses a `done`-status report with outcome %s and no `reason`', (outcome) => {
    const record = applyDeliveryUpdate(newDeliveryReport({ session: 'deliver-1', item: '1' }), { status: 'done', outcome });
    const { ok, errors } = validateDeliveryReport(record);
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/requires a non-empty `reason`/)]));
  });

  it('accepts a `done`-status report with outcome `blocked` when `reason` names the blocker', () => {
    const record = applyDeliveryUpdate(newDeliveryReport({ session: 'deliver-1', item: '1' }), { status: 'done', outcome: 'blocked', reason: 'blockedBy 42 re-opened' });
    expect(validateDeliveryReport(record).ok).toBe(true);
  });

  it('is not an object at all', () => {
    expect(validateDeliveryReport(null).errors).toEqual(['delivery report must be an object']);
    expect(validateDeliveryReport([]).errors).toEqual(['delivery report must be an object']);
  });
});

describe('assertDeliveryReport', () => {
  it('throws carrying the errors', () => {
    expect(() => assertDeliveryReport({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trips a well-formed record', () => {
    const record = newDeliveryReport({ session: 'deliver-1', item: '1' });
    const parsed = parseDeliveryReport(serializeDeliveryReport(record));
    expect(parsed.ok).toBe(true);
    expect(parsed.record).toEqual(record);
  });

  it.each([
    ['empty', '', /is empty/],
    ['whitespace', '   \n', /is empty/],
    ['torn json', '{"v":1,"sess', /not parseable JSON/],
    ['a JSON array', '[]', /delivery report must be an object/],
    ['wrong shape', '{"hello":"world"}', /unsupported delivery report version/],
  ])('%s → corrupt, never silently absent', (_label, text, pattern) => {
    const parsed = parseDeliveryReport(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(parsed.reason).toMatch(pattern);
  });
});
