/**
 * @file completion-record.test.mjs — the pure completion-record core (#3436).
 */
import { describe, it, expect } from 'vitest';

import {
  COMPLETION_RECORD_VERSION,
  applyCompletionUpdate,
  assertCompletionRecord,
  isValidSessionSlug,
  newCompletionRecord,
  parseCompletionRecord,
  serializeCompletionRecord,
  validateCompletionRecord,
} from '../completion-record.mjs';

const fixedNow = () => '2026-09-03T00:00:00.000Z';

describe('newCompletionRecord', () => {
  it('produces exactly the documented `started` shape', () => {
    expect(newCompletionRecord({ session: 'review-701', kind: 'review', pr: 701, now: fixedNow })).toEqual({
      v: COMPLETION_RECORD_VERSION, session: 'review-701', kind: 'review', pr: '701', item: null,
      status: 'started', outcome: null, verdict: null, label: null, runId: null,
      startedAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
    });
  });

  it('refuses an invalid session slug', () => {
    for (const bad of ['../escape', 'a/b', '', '.', '..']) {
      expect(isValidSessionSlug(bad)).toBe(false);
      expect(() => newCompletionRecord({ session: bad, kind: 'review' })).toThrow(/invalid completion session slug/);
    }
    expect(isValidSessionSlug('fix-1234')).toBe(true);
  });

  it('refuses a kind that is not review/fix', () => {
    expect(() => newCompletionRecord({ session: 'fix-1', kind: 'build' })).toThrow(/kind must be one of/);
  });
});

describe('applyCompletionUpdate', () => {
  it('merges named fields and bumps updatedAt, leaving identity fields untouched', () => {
    const started = newCompletionRecord({ session: 'fix-9', kind: 'fix', pr: 9, item: 42, now: fixedNow });
    const later = () => '2026-09-03T01:00:00.000Z';
    const done = applyCompletionUpdate(started, { status: 'done', outcome: 'gate-red' }, later);
    expect(done).toEqual({ ...started, status: 'done', outcome: 'gate-red', updatedAt: '2026-09-03T01:00:00.000Z' });
    expect(done.startedAt).toBe(started.startedAt);
    expect(done.session).toBe('fix-9');
  });

  it('leaves an unmentioned field alone', () => {
    const started = newCompletionRecord({ session: 'fix-9', kind: 'fix' });
    const patched = applyCompletionUpdate(started, { outcome: 'x' });
    expect(patched.status).toBe('started');
  });
});

describe('validateCompletionRecord', () => {
  it('reports EVERY problem, not just the first', () => {
    const { ok, errors } = validateCompletionRecord({ v: 2, session: '', kind: 'nope', status: 'huh', pr: 5, startedAt: 'later', updatedAt: 'later' });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'unsupported completion record version 2', 'missing or invalid `session`',
      '`kind` must be one of review/fix', '`pr` must be a string or null',
      '`status` must be one of started/done', 'missing or unparseable `startedAt`', 'missing or unparseable `updatedAt`',
    ]));
  });

  it('accepts a well-formed record', () => {
    expect(validateCompletionRecord(newCompletionRecord({ session: 'review-1', kind: 'review' })).ok).toBe(true);
  });

  it('is not an object at all', () => {
    expect(validateCompletionRecord(null).errors).toEqual(['completion record must be an object']);
    expect(validateCompletionRecord([]).errors).toEqual(['completion record must be an object']);
  });
});

describe('assertCompletionRecord', () => {
  it('throws carrying the errors', () => {
    expect(() => assertCompletionRecord({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });
});

describe('serialize / parse round-trip', () => {
  it('round-trips a well-formed record', () => {
    const record = newCompletionRecord({ session: 'review-1', kind: 'review', pr: 1 });
    const parsed = parseCompletionRecord(serializeCompletionRecord(record));
    expect(parsed.ok).toBe(true);
    expect(parsed.record).toEqual(record);
  });

  it.each([
    ['empty', '', /is empty/],
    ['whitespace', '   \n', /is empty/],
    ['torn json', '{"v":1,"sess', /not parseable JSON/],
    ['a JSON array', '[]', /completion record must be an object/],
    ['wrong shape', '{"hello":"world"}', /unsupported completion record version/],
  ])('%s → corrupt, never silently absent', (_label, text, pattern) => {
    const parsed = parseCompletionRecord(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(parsed.reason).toMatch(pattern);
  });
});
