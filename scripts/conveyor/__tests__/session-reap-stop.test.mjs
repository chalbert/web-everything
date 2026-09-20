/**
 * @file scripts/conveyor/__tests__/session-reap-stop.test.mjs
 * @description Unit proof of the session reaper's STOP MECHANICS (`session-reap-stop.mjs`): {@link stopSessionWithRetry}'s retry
 *   budget and backoff, with a fake `exec` and an injected `sleep` (no real `claude`, no wall-clock wait). The end-to-end
 *   stop behaviour through the real CLI is in `session-reap-stop-cli.test.mjs`. (Split out of `session-reaper.test.mjs`.)
 */
import { describe, it, expect } from 'vitest';
import { stopSessionWithRetry, STOP_RETRY_ATTEMPTS, STOP_RETRY_BACKOFF_MS } from '../session-reap-stop.mjs';

// ── stopSessionWithRetry — WE #3479, found live 2026-09-04: the ONE session-reaper.mjs mechanical-pass failure
//    `runner.log` recorded over a 190+-tick live overnight run traced to a per-candidate `claude stop` failure
//    tripping the WHOLE pass's exit code, undiagnosable only because `runQuiet`'s own truncation (see
//    `skills-src/conveyor/runner.mjs`'s `summarizeMechanicalPassError`) discarded the real error text. A live
//    concurrency stress test (25 concurrent `claude stop` + 10 concurrent `claude agents --json --all` calls,
//    repeated) never reproduced a hard failure, so the retry targets a real-but-rare transient class, not a
//    reproduced deterministic bug — this proves the RETRY mechanics in isolation with a fake `exec`. ───────────

describe('stopSessionWithRetry — recovers a transient `claude stop` failure instead of failing the whole pass', () => {
  function flakyExec(failTimes, { message = 'some transient CLI-internal lock' } = {}) {
    let calls = 0;
    const fn = (..._args) => {
      calls++;
      if (calls <= failTimes) {
        const e = new Error(`Command failed: claude stop`);
        e.stderr = message;
        throw e;
      }
      return 'stopped abcd1234\n';
    };
    Object.defineProperty(fn, 'calls', { get: () => calls });
    return fn;
  }

  it('succeeds on the first attempt when `claude stop` succeeds immediately — no retry, no sleep', () => {
    const exec = flakyExec(0);
    let slept = 0;
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: () => { slept++; } });
    expect(res).toEqual({ stopped: true, alreadyGone: false, output: 'stopped abcd1234\n' });
    expect(exec.calls).toBe(1);
    expect(slept).toBe(0);
  });

  it('recovers a transient failure that clears within the retry budget (fails once, succeeds on retry 2)', () => {
    const exec = flakyExec(1);
    const sleeps = [];
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: (ms) => sleeps.push(ms) });
    expect(res.stopped).toBe(true);
    expect(exec.calls).toBe(2);
    expect(sleeps).toEqual([STOP_RETRY_BACKOFF_MS[0]]); // one backoff wait, before the 2nd attempt
  });

  it(`still throws once ALL ${STOP_RETRY_ATTEMPTS} attempts fail — a genuine failure, not swallowed`, () => {
    const exec = flakyExec(STOP_RETRY_ATTEMPTS);
    const sleeps = [];
    expect(() => stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: (ms) => sleeps.push(ms) })).toThrow(/claude stop/);
    expect(exec.calls).toBe(STOP_RETRY_ATTEMPTS);
    expect(sleeps).toEqual(STOP_RETRY_BACKOFF_MS); // backed off before every retry, never after the last attempt
  });

  it('never retries an `alreadyGone` answer — that is not a failure, resolved on the first call', () => {
    let calls = 0;
    const exec = () => {
      calls++;
      const e = new Error('boom');
      e.stderr = "No job matching 'abcd1234'. Run 'claude agents' to list running sessions.";
      throw e;
    };
    let slept = 0;
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: () => { slept++; } });
    expect(res).toEqual({ stopped: true, alreadyGone: true, output: expect.stringContaining('No job matching') });
    expect(calls).toBe(1);
    expect(slept).toBe(0);
  });
});
