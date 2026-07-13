/**
 * @file wait-green.test.mjs — proof of the PURE `waitVerdict` verdict map (#2434). The `gh` poll + the sleeps
 *   are the CLI's concern; the (elapsed, timeout, check status) → terminal-verdict + exit-code decision is pure
 *   and unit-tested here against fixtures, no gh, no clock.
 */
import { describe, it, expect } from 'vitest';
import { waitVerdict } from '../wait-green.mjs';

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
