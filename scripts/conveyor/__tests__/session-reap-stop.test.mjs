/**
 * @file scripts/conveyor/__tests__/session-reap-stop.test.mjs
 * @description Unit proof of the session reaper's STOP MECHANICS (`session-reap-stop.mjs`): {@link stopSessionWithRetry}'s retry
 *   budget and backoff, with a fake `exec` and an injected `sleep` (no real `claude`, no wall-clock wait). The end-to-end
 *   stop behaviour through the real CLI is in `session-reap-stop-cli.test.mjs`. (Split out of `session-reaper.test.mjs`.)
 */
import { describe, it, expect } from 'vitest';
import {
  stopSessionWithRetry, STOP_RETRY_ATTEMPTS, STOP_RETRY_BACKOFF_MS,
  STOP_CONFIRM_WAIT_MS, STOP_MAX_RETRIES, TERMINAL_ROW_STATES, isTerminalRow, partitionAlreadyTerminal, parseConfirmWaitMs, runStopPass,
} from '../session-reap-stop.mjs';

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

// ── #3744 — a stop is only reported done when the re-read registry bears it out; a terminal session is never re-stopped. ──
//    Injected runner, listing reader and clock throughout: no real `claude`, and no real sleep.

const cand = (id, state = 'working') => ({ session: { id, sessionId: `${id}-full-uuid`, kind: 'background', state, name: `conveyor-${id}` }, reason: 'pid-dead' });
const row = (id, state) => ({ id, sessionId: `${id}-full-uuid`, kind: 'background', state });

/** A pass harness: records every stop call and every sleep, and serves the listings in order (the last one repeats). */
function harness(listings, { failStopFor = new Set() } = {}) {
  const stops = [];
  const sleeps = [];
  let reads = 0;
  return {
    stops, sleeps,
    get reads() { return reads; },
    opts: {
      stopOne: (c) => { stops.push(c.session.id); if (failStopFor.has(c.session.id)) throw new Error('stop failed'); return { alreadyGone: false }; },
      listAgents: () => { const l = listings[Math.min(reads, listings.length - 1)]; reads++; if (l instanceof Error) throw l; return l; },
      sleep: (ms) => sleeps.push(ms),
    },
  };
}

describe('#3744 defaults — named, bounded, overridable', () => {
  it('waits 5 s before the confirming re-read and retries an unconfirmed stop at most twice', () => {
    expect(STOP_CONFIRM_WAIT_MS).toBe(5000);
    expect(STOP_MAX_RETRIES).toBe(2);
  });

  it('the terminal set is exactly done / stopped / failed', () => {
    expect([...TERMINAL_ROW_STATES].sort()).toEqual(['done', 'failed', 'stopped']);
    expect(['done', 'stopped', 'failed'].map((state) => isTerminalRow({ state }))).toEqual([true, true, true]);
    expect(['working', 'blocked', undefined].map((state) => isTerminalRow({ state }))).toEqual([false, false, false]);
    expect(isTerminalRow(null)).toBe(false);
  });

  it('parseConfirmWaitMs: a non-negative number wins; anything else falls back to the default', () => {
    expect(parseConfirmWaitMs('0')).toBe(0);
    expect(parseConfirmWaitMs('250')).toBe(250);
    expect([undefined, true, '', 'abc', '-5', NaN].map(parseConfirmWaitMs)).toEqual(Array(6).fill(STOP_CONFIRM_WAIT_MS));
  });

  it('the pass waits the injected time, not the default', () => {
    const h = harness([[]]);
    runStopPass({ candidates: [cand('a1')], ...h.opts, confirmWaitMs: 7 });
    expect(h.sleeps).toEqual([7]);
    const d = harness([[]]);
    runStopPass({ candidates: [cand('a1')], ...d.opts });
    expect(d.sleeps).toEqual([STOP_CONFIRM_WAIT_MS]);
  });
});

describe('partitionAlreadyTerminal — a finished session gets no stop call', () => {
  it('a 700-row plan makes stop calls only for the live rows', () => {
    const reap = [
      ...Array.from({ length: 571 }, (_, i) => cand(`d${i}`, 'done')),
      ...Array.from({ length: 60 }, (_, i) => cand(`s${i}`, 'stopped')),
      ...Array.from({ length: 60 }, (_, i) => cand(`f${i}`, 'failed')),
      ...Array.from({ length: 9 }, (_, i) => cand(`w${i}`, 'working')),
    ];
    expect(reap).toHaveLength(700);
    const { live, alreadyTerminal } = partitionAlreadyTerminal(reap);
    expect(alreadyTerminal).toHaveLength(691);
    expect(live.map((r) => r.session.id)).toEqual(Array.from({ length: 9 }, (_, i) => `w${i}`));
    const h = harness([[]]);
    runStopPass({ candidates: live, ...h.opts, confirmWaitMs: 0 });
    expect(h.stops).toHaveLength(9);
    expect(h.stops.some((id) => /^[dsf]/.test(id))).toBe(false);
  });

  it('tolerates a missing or empty plan', () => {
    expect(partitionAlreadyTerminal(undefined)).toEqual({ live: [], alreadyTerminal: [] });
    expect(partitionAlreadyTerminal([])).toEqual({ live: [], alreadyTerminal: [] });
  });
});

describe('runStopPass — confirm against the re-read registry', () => {
  it('a lagging listing (row still `working` after a "successful" stop) is UNCONFIRMED, never stopped', () => {
    const h = harness([[row('lag1', 'working')]]);
    const out = runStopPass({ candidates: [cand('lag1')], ...h.opts, confirmWaitMs: 0 });
    expect(out.confirmed).toEqual([]);
    expect(out.unconfirmed.map((c) => c.session.id)).toEqual(['lag1']);
    expect(out.failed).toEqual([]);
  });

  it('a row that is gone from the re-read is confirmed', () => {
    const h = harness([[row('other', 'working')]]);
    const out = runStopPass({ candidates: [cand('gone1')], ...h.opts, confirmWaitMs: 0 });
    expect(out.confirmed.map((c) => c.session.id)).toEqual(['gone1']);
    expect(out.unconfirmed).toEqual([]);
    expect(h.stops).toEqual(['gone1']);
  });

  it.each(['done', 'stopped', 'failed'])('a row that reads `%s` after the stop is confirmed', (state) => {
    const h = harness([[row('t1', state)]]);
    const out = runStopPass({ candidates: [cand('t1')], ...h.opts, confirmWaitMs: 0 });
    expect(out.confirmed).toHaveLength(1);
    expect(out.unconfirmed).toEqual([]);
  });

  it('matches the row on the full sessionId when the short id is absent from the re-read', () => {
    const h = harness([[{ sessionId: 'x1-full-uuid', kind: 'background', state: 'working' }]]);
    const out = runStopPass({ candidates: [cand('x1')], ...h.opts, confirmWaitMs: 0 });
    expect(out.unconfirmed).toHaveLength(1);
  });

  it('ONE re-read when everything confirms — no retry, no second read', () => {
    const h = harness([[]]);
    const out = runStopPass({ candidates: [cand('a1'), cand('a2')], ...h.opts, confirmWaitMs: 0 });
    expect(out.confirmed).toHaveLength(2);
    expect(h.reads).toBe(1);
    expect(h.stops).toEqual(['a1', 'a2']);
    expect(out.retried).toBe(0);
  });

  it('mixed: the confirmed one is reported apart from the unconfirmed one', () => {
    const h = harness([[row('stuck1', 'working'), row('ok1', 'done')]]);
    const out = runStopPass({ candidates: [cand('ok1'), cand('stuck1')], ...h.opts, confirmWaitMs: 0, maxRetries: 0 });
    expect(out.confirmed.map((c) => c.session.id)).toEqual(['ok1']);
    expect(out.unconfirmed.map((c) => c.session.id)).toEqual(['stuck1']);
  });

  it('nothing stopped ⇒ no wait and no registry read at all', () => {
    const h = harness([[]]);
    const out = runStopPass({ candidates: [], ...h.opts });
    expect(h.reads).toBe(0);
    expect(h.sleeps).toEqual([]);
    expect(out).toMatchObject({ stopped: [], failed: [], confirmed: [], unconfirmed: [], retried: 0, readError: null });
  });
});

describe('runStopPass — the bounded, in-memory retry list', () => {
  it('an unconfirmed stop is retried at most STOP_MAX_RETRIES times, then reported', () => {
    const h = harness([[row('lag1', 'working')]]);
    const out = runStopPass({ candidates: [cand('lag1')], ...h.opts, confirmWaitMs: 5 });
    expect(h.stops).toEqual(['lag1', 'lag1', 'lag1']); // 1 stop + 2 retries, never a 4th
    expect(h.reads).toBe(3);
    expect(h.sleeps).toEqual([5, 5, 5]);
    expect(out.retried).toBe(2);
    expect(out.unconfirmed.map((c) => c.session.id)).toEqual(['lag1']);
  });

  it('a retry that the registry then bears out is confirmed, and only the still-listed ones are re-stopped', () => {
    const h = harness([[row('a', 'working'), row('b', 'working')], [row('b', 'working')], []]);
    const out = runStopPass({ candidates: [cand('a'), cand('b')], ...h.opts, confirmWaitMs: 0 });
    expect(out.confirmed.map((c) => c.session.id)).toEqual(['a', 'b']);
    expect(out.unconfirmed).toEqual([]);
    expect(h.stops).toEqual(['a', 'b', 'a', 'b', 'b']);
    expect(out.retried).toBe(3);
  });

  it('honours an override of the retry bound', () => {
    const h = harness([[row('lag1', 'working')]]);
    runStopPass({ candidates: [cand('lag1')], ...h.opts, confirmWaitMs: 0, maxRetries: 0 });
    expect(h.stops).toEqual(['lag1']);
    expect(h.reads).toBe(1);
  });

  it('a retry whose stop call throws leaves the session unconfirmed, and the pass still ends', () => {
    let calls = 0;
    const out = runStopPass({
      candidates: [cand('lag1')],
      stopOne: () => { if (++calls > 1) throw new Error('boom'); return {}; },
      listAgents: () => [row('lag1', 'working')],
      sleep: () => {},
      confirmWaitMs: 0,
    });
    expect(out.unconfirmed).toHaveLength(1);
    expect(calls).toBe(3);
  });
});

describe('runStopPass — failures and an unreadable registry', () => {
  it('a stop that throws is reported in `failed`, never confirmed, and does not block the rest', () => {
    const h = harness([[]], { failStopFor: new Set(['bad1']) });
    const out = runStopPass({ candidates: [cand('bad1'), cand('ok1')], ...h.opts, confirmWaitMs: 0 });
    expect(out.failed.map((f) => f.candidate.session.id)).toEqual(['bad1']);
    expect(out.confirmed.map((c) => c.session.id)).toEqual(['ok1']);
  });

  it('every stop failing ⇒ no re-read (nothing to verify)', () => {
    const h = harness([[]], { failStopFor: new Set(['bad1']) });
    runStopPass({ candidates: [cand('bad1')], ...h.opts, confirmWaitMs: 0 });
    expect(h.reads).toBe(0);
  });

  it('a re-read that throws makes every pending stop unconfirmed and stops retrying — it never claims confirmation', () => {
    const h = harness([new Error('claude agents unreadable\nsecond line')]);
    const out = runStopPass({ candidates: [cand('a1'), cand('a2')], ...h.opts, confirmWaitMs: 0 });
    expect(out.readError).toBe('claude agents unreadable');
    expect(out.confirmed).toEqual([]);
    expect(out.unconfirmed).toHaveLength(2);
    expect(h.stops).toEqual(['a1', 'a2']); // no retry without a listing to verify against
  });
});
