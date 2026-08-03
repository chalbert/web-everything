/**
 * @file local-date.test.mjs — proof of the #2747 operator-local date-only stamp helper: `resolveTimeZone`
 * honors `BACKLOG_TZ` over `TZ` over the host-resolved zone; `localDateString`/`localToday` format a given
 * instant as `YYYY-MM-DD` in the requested zone, correctly landing on the OTHER side of a UTC calendar-day
 * boundary for a UTC-behind zone (the exact failure this item fixes) and a UTC-ahead zone.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveTimeZone, localDateString, localToday, isValidTimeZone } from '../local-date.mjs';

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
    // #2747 review — the old assertion here was `localToday('UTC') === new Date().toISOString().slice(0,10)`,
    // which reads the clock TWICE and so is a genuine (if rare) flake across the UTC midnight boundary.
    // Sample the instant ONCE and run it through both paths: same property, zero race.
    const now = new Date();
    expect(localDateString(now, 'UTC')).toBe(now.toISOString().slice(0, 10));
  });
});

// #2747 review — the zone-validation hardening. `Intl` accepts IANA names only and throws RangeError on
// values that are perfectly legal in `TZ`, so the unvalidated version crashed every date-stamping script on
// such a host. These pin the degrade-don't-crash behaviour.
describe('resolveTimeZone / localDateString — invalid zones degrade, never throw (#2747 review)', () => {
  const saved = { BACKLOG_TZ: process.env.BACKLOG_TZ, TZ: process.env.TZ };
  afterEach(() => {
    for (const k of ['BACKLOG_TZ', 'TZ']) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  it('isValidTimeZone accepts IANA names and rejects the POSIX/offset/typo forms Intl throws on', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('EST5EDT,M3.2.0,M11.1.0')).toBe(false); // the full POSIX TZ form
    expect(isValidTimeZone('GMT+5')).toBe(false);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('a POSIX-form TZ is SKIPPED rather than crashing — resolution falls through to the next source', () => {
    delete process.env.BACKLOG_TZ;
    process.env.TZ = 'EST5EDT,M3.2.0,M11.1.0';
    expect(() => resolveTimeZone()).not.toThrow();
    expect(resolveTimeZone()).not.toBe('EST5EDT,M3.2.0,M11.1.0');
    expect(isValidTimeZone(resolveTimeZone())).toBe(true);
  });

  it('an invalid BACKLOG_TZ falls through to a valid TZ', () => {
    process.env.BACKLOG_TZ = 'Not/AZone';
    process.env.TZ = 'Asia/Dubai';
    expect(resolveTimeZone()).toBe('Asia/Dubai');
  });

  it('localDateString with an invalid explicit zone degrades to the resolved zone instead of throwing', () => {
    const d = new Date('2026-07-28T12:00:00Z');
    expect(() => localDateString(d, 'GMT+5')).not.toThrow();
    expect(localDateString(d, 'GMT+5')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('the date shape does not depend on a locale default pattern (assembled from formatToParts)', () => {
    // A small-icu Node lacks sv-SE and would silently render MM/DD/YYYY under the old implementation.
    expect(localDateString(new Date('2026-01-09T12:00:00Z'), 'UTC')).toBe('2026-01-09');
  });
});
