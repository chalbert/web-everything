/**
 * @file wait-green.test.mjs — proof of the PURE `waitVerdict` verdict map (#2434). The `gh` poll + the sleeps
 *   are the CLI's concern; the (elapsed, timeout, check status) → terminal-verdict + exit-code decision is pure
 *   and unit-tested here against fixtures, no gh, no clock.
 */
import { describe, it, expect } from 'vitest';
import { waitVerdict, numericFlag } from '../wait-green.mjs';

describe('numericFlag — finite-or-default flag parse (#2482 finding 2)', () => {
  it('parses a finite numeric string', () => {
    expect(numericFlag('1200', 600)).toBe(1200);
    expect(numericFlag('30', 15)).toBe(30);
  });

  it('falls back on a non-finite parse (the operator-typo case that used to hang)', () => {
    expect(numericFlag('abc', 600)).toBe(600);   // Number('abc') === NaN → default (no forever-poll)
    expect(numericFlag('abc', 15)).toBe(15);      // → default (no setTimeout(NaN) busy-loop)
    expect(numericFlag(undefined, 600)).toBe(600); // absent flag
    expect(numericFlag('Infinity', 600)).toBe(600); // Infinity is not finite → default
  });

  it('falls back on a non-positive value too — the other busy-loop / immediate-timeout inputs', () => {
    expect(numericFlag('0', 15)).toBe(15);   // 0 interval → setTimeout(0) busy-loop → default
    expect(numericFlag('', 15)).toBe(15);     // Number('') === 0 → default
    expect(numericFlag('-5', 15)).toBe(15);   // negative → setTimeout(<0) fires immediately → default
    expect(numericFlag('-5', 600)).toBe(600); // negative timeout → immediate exit-3 → default
  });
});

describe('waitVerdict', () => {
  it('passed → exit 0, done (regardless of elapsed)', () => {
    expect(waitVerdict({ checkStatus: 'passed', elapsed: 3, timeout: 600 }))
      .toEqual({ verdict: 'passed', exit: 0, done: true });
  });

  it('failed → exit 2, done (never wait out a red check, even early)', () => {
    expect(waitVerdict({ checkStatus: 'failed', elapsed: 1, timeout: 600 }))
      .toEqual({ verdict: 'failed', exit: 2, done: true });
  });

  it('pending before the timeout → keep polling (done:false, no exit)', () => {
    expect(waitVerdict({ checkStatus: 'pending', elapsed: 30, timeout: 600 }))
      .toEqual({ verdict: 'pending', exit: null, done: false });
  });

  it('pending at/after the timeout → timed out, exit 3, done', () => {
    expect(waitVerdict({ checkStatus: 'pending', elapsed: 600, timeout: 600 }))
      .toEqual({ verdict: 'timeout', exit: 3, done: true });
    expect(waitVerdict({ checkStatus: 'pending', elapsed: 601, timeout: 600 }))
      .toEqual({ verdict: 'timeout', exit: 3, done: true });
  });

  it('a passed check at the timeout boundary still wins over the timeout', () => {
    expect(waitVerdict({ checkStatus: 'passed', elapsed: 600, timeout: 600 }))
      .toEqual({ verdict: 'passed', exit: 0, done: true });
  });

  it('an unknown/other status behaves like pending (waits, then times out)', () => {
    expect(waitVerdict({ checkStatus: 'unknown', elapsed: 5, timeout: 600 }).done).toBe(false);
    expect(waitVerdict({ checkStatus: 'unknown', elapsed: 700, timeout: 600 }).verdict).toBe('timeout');
  });

  it('is tolerant of a missing arg object (defaults elapsed/timeout to 0 → immediate timeout)', () => {
    expect(waitVerdict()).toEqual({ verdict: 'timeout', exit: 3, done: true });
  });
});
