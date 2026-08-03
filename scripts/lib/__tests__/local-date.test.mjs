/**
 * @file local-date.test.mjs — proof of the #2747 operator-local date-only stamp helper.
 *
 * Three properties:
 *  1. `backlogTimeZone` honours an explicit `BACKLOG_TZ` pin, returns `undefined` (= host-local) when it is
 *     unset, IGNORES `TZ` entirely (Node already derives its local time from `TZ`), and THROWS on an
 *     invalid pin rather than silently discarding it.
 *  2. The default (unpinned) stamp always agrees with the process's OWN local clock — including for the
 *     POSIX/offset `TZ` spellings that an IANA-name round-trip mangles (#2747 review finding 1). The
 *     oracle here is `Date.getTimezoneOffset()` arithmetic, i.e. no `Intl` at all.
 *  3. `localDateString` formats a given instant as `YYYY-MM-DD` in the requested zone, landing on the
 *     OTHER side of a UTC calendar-day boundary for a UTC-behind zone (the exact failure this item fixes)
 *     and a UTC-ahead zone.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backlogTimeZone, localDateString, localToday, isValidTimeZone } from '../local-date.mjs';

describe('backlogTimeZone', () => {
  const saved = { BACKLOG_TZ: process.env.BACKLOG_TZ, TZ: process.env.TZ };
  afterEach(() => {
    for (const k of ['BACKLOG_TZ', 'TZ']) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  it('returns the explicit BACKLOG_TZ pin', () => {
    expect(backlogTimeZone({ BACKLOG_TZ: 'Pacific/Kiritimati' })).toBe('Pacific/Kiritimati');
  });

  it('returns undefined (host-local) when BACKLOG_TZ is unset or empty', () => {
    expect(backlogTimeZone({})).toBeUndefined();
    expect(backlogTimeZone({ BACKLOG_TZ: '' })).toBeUndefined();
  });

  it('IGNORES TZ — Node already derives its own local time from it, so a second rung could only disagree', () => {
    // #2747 review finding 4: a `TZ` rung can never change the answer for a valid IANA name, and for the
    // POSIX forms it CAN change it, it changes it to the wrong thing (finding 1). So there is no rung.
    expect(backlogTimeZone({ TZ: 'Pacific/Kiritimati' })).toBeUndefined();
    expect(backlogTimeZone({ TZ: 'GMT+5' })).toBeUndefined();
  });

  it('THROWS on an invalid BACKLOG_TZ instead of silently ignoring the pin (#2747 review finding 2)', () => {
    // The population that sets BACKLOG_TZ is exactly the population whose host zone is already wrong, so a
    // silently-dropped pin stamps wrong dates indefinitely with no evidence it was ever read.
    expect(() => backlogTimeZone({ BACKLOG_TZ: 'America/Toronoto' })).toThrow(/BACKLOG_TZ/);
    expect(() => backlogTimeZone({ BACKLOG_TZ: 'EST5EDT,M3.2.0,M11.1.0' })).toThrow(/BACKLOG_TZ/);
    expect(() => backlogTimeZone({ BACKLOG_TZ: 'GMT+5' })).toThrow(/BACKLOG_TZ/);
  });

  it('isValidTimeZone accepts IANA names and rejects the POSIX/typo forms Intl throws on', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('EST5EDT,M3.2.0,M11.1.0')).toBe(false); // the full POSIX TZ form
    expect(isValidTimeZone('GMT+5')).toBe(false);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

// #2747 review finding 1. The independent oracle is pure `Date` arithmetic — shift the epoch by the
// process's OWN reported local offset and slice the UTC ISO. No Intl, no zone name, so it cannot share a
// bug with the implementation. Each case runs in a CHILD process because `TZ` is only read at startup.
describe('the unpinned stamp never disagrees with the process\'s own local clock (#2747 review finding 1)', () => {
  // NOTE: `import.meta.url` is an http dev URL under this suite's happy-dom environment, so the module
  // under test is located from the repo root (vitest's cwd) instead.
  const MODULE_PATH = resolve(process.cwd(), 'scripts/lib/local-date.mjs');
  const MODULE_URL = JSON.stringify(pathToFileURL(MODULE_PATH).href);
  const ORACLE = 'new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)';
  const probe = (tz) => {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e',
      `import { localToday } from ${MODULE_URL};`
      + `process.stdout.write(JSON.stringify({ stamped: localToday(), local: ${ORACLE} }));`,
    ], { encoding: 'utf8', env: { ...process.env, TZ: tz, BACKLOG_TZ: '' } });
    return JSON.parse(out);
  };

  it('locates the module under test (guards the cwd assumption above)', () => {
    expect(existsSync(MODULE_PATH)).toBe(true);
  });

  // `GMT+5` is POSIX for UTC−5, but Intl normalises it to the zone named "+05:00" (UTC+5) — a 10-hour
  // error the old ladder adopted. `+05:00` is ignored by `Date` outright. `UTC+8`/`EST5` resolve to no
  // zone name at all, which the old ladder turned into the UTC backstop — the original #2747 defect.
  for (const tz of ['GMT+5', 'GMT-5', '+05:00', 'UTC+8', 'EST5', 'EST5EDT,M3.2.0,M11.1.0', 'America/Los_Angeles', 'Asia/Dubai', 'UTC']) {
    it(`TZ=${tz}`, () => {
      const { stamped, local } = probe(tz);
      expect(stamped).toBe(local);
    });
  }

  it('an invalid BACKLOG_TZ fails the process loudly rather than stamping a wrong date', () => {
    expect(() => execFileSync(process.execPath, ['--input-type=module', '-e',
      `import { localToday } from ${MODULE_URL};process.stdout.write(localToday());`,
    ], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, BACKLOG_TZ: 'America/Toronoto' } })).toThrow(/BACKLOG_TZ/);
  });
});

describe('localDateString / localToday', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDateString(new Date('2026-07-28T12:00:00Z'), 'UTC')).toBe('2026-07-28');
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

  it('the date shape does not depend on a locale default pattern (assembled from formatToParts)', () => {
    // A small-icu Node lacks sv-SE and would silently render MM/DD/YYYY under a locale-pattern approach.
    expect(localDateString(new Date('2026-01-09T12:00:00Z'), 'UTC')).toBe('2026-01-09');
  });

  it('an invalid explicit timeZone THROWS — it is never swapped for another zone (#2747 review finding 6)', () => {
    expect(() => localDateString(new Date('2026-07-28T12:00:00Z'), 'GMT+5')).toThrow();
  });

  it('a missing/invalid date argument THROWS rather than quietly formatting "now"', () => {
    expect(() => localDateString()).toThrow(TypeError);
    expect(() => localDateString(new Date('nonsense'))).toThrow(TypeError);
    expect(() => localDateString('2026-07-28')).toThrow(TypeError);
  });

  it('localToday returns a well-formed YYYY-MM-DD for the current instant', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
