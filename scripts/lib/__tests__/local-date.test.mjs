/**
 * @file local-date.test.mjs — proof of the #2747 operator-local date-only stamp helper: `resolveTimeZone`
 * honors `BACKLOG_TZ` over `TZ` over the host-resolved zone; `localDateString`/`localToday` format a given
 * instant as `YYYY-MM-DD` in the requested zone, correctly landing on the OTHER side of a UTC calendar-day
 * boundary for a UTC-behind zone (the exact failure this item fixes) and a UTC-ahead zone.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveTimeZone, localDateString, localToday } from '../local-date.mjs';

describe('resolveTimeZone', () => {
  const savedBacklogTz = process.env.BACKLOG_TZ;
  const savedTz = process.env.TZ;
  afterEach(() => {
    if (savedBacklogTz === undefined) delete process.env.BACKLOG_TZ; else process.env.BACKLOG_TZ = savedBacklogTz;
    if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz;
  });

  it('prefers BACKLOG_TZ over TZ', () => {
    process.env.BACKLOG_TZ = 'Pacific/Kiritimati';
    process.env.TZ = 'America/Los_Angeles';
    expect(resolveTimeZone()).toBe('Pacific/Kiritimati');
  });

  it('falls back to TZ when BACKLOG_TZ is unset', () => {
    delete process.env.BACKLOG_TZ;
    process.env.TZ = 'America/Los_Angeles';
    expect(resolveTimeZone()).toBe('America/Los_Angeles');
  });

  it('falls back to the host-resolved IANA zone when neither env is set', () => {
    delete process.env.BACKLOG_TZ;
    delete process.env.TZ;
    expect(resolveTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe('localDateString / localToday', () => {
  it('formats as YYYY-MM-DD', () => {
    const d = new Date('2026-07-28T12:00:00Z');
    expect(localDateString(d, 'UTC')).toBe('2026-07-28');
  });

  it('a UTC-behind zone reads the PRIOR calendar day during the evening UTC-tomorrow window (the reported failure)', () => {
    // 2026-07-28T02:00:00Z is already "tomorrow" in UTC, but still 2026-07-27 evening in a UTC-10 zone.
    const d = new Date('2026-07-28T02:00:00Z');
    expect(localDateString(d, 'UTC')).toBe('2026-07-28');
    expect(localDateString(d, 'Pacific/Honolulu')).toBe('2026-07-27'); // UTC-10, no DST
  });

  it('a UTC-ahead zone can read the NEXT calendar day while UTC is still on the prior one', () => {
    // 2026-07-27T22:00:00Z is still 2026-07-27 in UTC, but already 2026-07-28 in a UTC+4 zone.
    const d = new Date('2026-07-27T22:00:00Z');
    expect(localDateString(d, 'UTC')).toBe('2026-07-27');
    expect(localDateString(d, 'Asia/Dubai')).toBe('2026-07-28'); // UTC+4, no DST
  });

  it('localToday defaults to now() and a resolved zone, returning a well-formed YYYY-MM-DD', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localToday('UTC')).toBe(new Date().toISOString().slice(0, 10));
  });
});
