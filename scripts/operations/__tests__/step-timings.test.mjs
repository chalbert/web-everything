/**
 * @file step-timings.test.mjs — `stepTimings` rows, sourced from a clock the io shell reads and the engine
 *   never does (#3368).
 *
 * THREE LAYERS, THREE DESCRIBE BLOCKS. The pure core (`withStepStart`/`withStepFinish`/validation) is tested
 * in isolation first, because it is the part a caller must not be able to abuse (a fabricated finish, a
 * double-started row). Then `driveRun` (`cli-adapter.mjs`) is driven over the REAL four-kind fixture
 * declaration with a stubbed, deterministic clock, so the numbers in the assertions are exact rather than
 * "some positive number" — that is what pins Done-when #3 (a stubbed clock produces deterministic timings).
 * Finally `wakeRun` (`wake.mjs`) resolves a dispatch `driveRun` itself can only PARK on, proving the finish
 * stamp for a long-running effect lands on the waker's resolve path, not as an absent value.
 */

import { describe, it, expect } from 'vitest';

import { newRunRecord, validateRunRecord, withStepFinish, withStepStart } from '../run-record.mjs';
import { startRun } from '../engine.mjs';
import { createRegistry, op } from '../registry.mjs';
import { effect } from '../step-kinds.mjs';
import { inFlight } from '../effect-executor.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { driveRun } from '../cli-adapter.mjs';
import { wakeRun } from '../wake.mjs';
import { FIXTURE_JUDGE_ANSWER, FIXTURE_OP, fixtureRegistry } from '../__fixtures__/fixture-operation.mjs';

/** A clock that hands out strictly increasing epoch-ms readings, `stepMs` apart — deterministic, never real time. */
function stubClock(stepMs = 1000) {
  let t = 0;
  return () => { t += stepMs; return t; };
}

describe('withStepStart / withStepFinish — the pure core (#3368)', () => {
  const base = newRunRecord({ id: 'run-a', op: 'fx' });

  it('starts a step, recording only its name, index and start instant', () => {
    const run = withStepStart(base, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:00:00.000Z' });
    expect(run.stepTimings).toEqual([{ step: 'diff', stepIndex: 0, startedAt: '2026-08-27T00:00:00.000Z' }]);
  });

  it('is idempotent per stepIndex — re-entering an OPEN step does not double-stamp it', () => {
    const once = withStepStart(base, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:00:00.000Z' });
    const twice = withStepStart(once, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:05:00.000Z' });
    expect(twice).toBe(once); // unchanged reference — the second start never happened
    expect(twice.stepTimings).toHaveLength(1);
  });

  it('finishes the open row, computing a non-negative durationMs', () => {
    const started = withStepStart(base, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:00:00.000Z' });
    const finished = withStepFinish(started, { stepIndex: 0, at: '2026-08-27T00:00:02.500Z' });
    expect(finished.stepTimings).toEqual([
      { step: 'diff', stepIndex: 0, startedAt: '2026-08-27T00:00:00.000Z', finishedAt: '2026-08-27T00:00:02.500Z', durationMs: 2500 },
    ]);
  });

  // DONE-WHEN #1's OTHER HALF: a stepIndex with nothing open — never started, or already finished — gets NO
  // fabricated row. A halted run must show "started, no finish", never an invented finish.
  it('finishing a stepIndex that was never started leaves the run UNCHANGED — no fabricated row', () => {
    expect(withStepFinish(base, { stepIndex: 0, at: '2026-08-27T00:00:00.000Z' })).toBe(base);
  });

  it('finishing an ALREADY-finished stepIndex leaves the run unchanged — no double finish', () => {
    const started = withStepStart(base, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:00:00.000Z' });
    const finished = withStepFinish(started, { stepIndex: 0, at: '2026-08-27T00:00:01.000Z' });
    expect(withStepFinish(finished, { stepIndex: 0, at: '2026-08-27T00:00:09.000Z' })).toBe(finished);
  });

  it('starting a SECOND step opens its own row alongside the first, finished one', () => {
    const s1 = withStepFinish(withStepStart(base, { step: 'diff', stepIndex: 0, at: '2026-08-27T00:00:00.000Z' }), { stepIndex: 0, at: '2026-08-27T00:00:01.000Z' });
    const s2 = withStepStart(s1, { step: 'panel', stepIndex: 1, at: '2026-08-27T00:00:01.000Z' });
    expect(s2.stepTimings).toHaveLength(2);
    expect(s2.stepTimings[1]).toEqual({ step: 'panel', stepIndex: 1, startedAt: '2026-08-27T00:00:01.000Z' });
  });
});

describe('run-record validation — stepTimings whitelisted like telemetry, distinct from it', () => {
  it('a record with no stepTimings key at all is valid — tolerated absent, same as telemetry pre-#3368', () => {
    const record = newRunRecord({ id: 'run-a', op: 'fx' });
    delete record.stepTimings;
    expect(validateRunRecord(record).ok).toBe(true);
  });

  it('refuses a non-array stepTimings', () => {
    const record = { ...newRunRecord({ id: 'run-a', op: 'fx' }), stepTimings: 'nope' };
    expect(validateRunRecord(record).ok).toBe(false);
  });

  it('refuses a row missing a step name, an invalid stepIndex, or an unparseable startedAt', () => {
    const base = newRunRecord({ id: 'run-a', op: 'fx' });
    expect(validateRunRecord({ ...base, stepTimings: [{ stepIndex: 0, startedAt: '2026-08-27T00:00:00.000Z' }] }).ok).toBe(false);
    expect(validateRunRecord({ ...base, stepTimings: [{ step: 'diff', stepIndex: -1, startedAt: '2026-08-27T00:00:00.000Z' }] }).ok).toBe(false);
    expect(validateRunRecord({ ...base, stepTimings: [{ step: 'diff', stepIndex: 0, startedAt: 'not a date' }] }).ok).toBe(false);
  });

  it('refuses a finished row with no durationMs, or a negative one', () => {
    const base = newRunRecord({ id: 'run-a', op: 'fx' });
    const row = { step: 'diff', stepIndex: 0, startedAt: '2026-08-27T00:00:00.000Z', finishedAt: '2026-08-27T00:00:01.000Z' };
    expect(validateRunRecord({ ...base, stepTimings: [row] }).ok).toBe(false);
    expect(validateRunRecord({ ...base, stepTimings: [{ ...row, durationMs: -5 }] }).ok).toBe(false);
    expect(validateRunRecord({ ...base, stepTimings: [{ ...row, durationMs: 1000 }] }).ok).toBe(true);
  });
});

describe('driveRun stamps stepTimings from an INJECTED clock, never from `Date.now()` inside the engine (#3368)', () => {
  const registry = fixtureRegistry();

  it('a run halted mid-step (parked on a human confirm) records the started step with NO finish — Done-when #1', async () => {
    const clock = stubClock();
    const store = createMemoryRunStore();
    const run = startRun({ op: FIXTURE_OP, id: 'run-tm', input: { pr: 42 }, registry });
    store.write(run);

    const halted = await driveRun({ run, registry, store, sinks: {}, judge: async () => FIXTURE_JUDGE_ANSWER, clock });

    expect(halted.stopped).toBe('confirm'); // the fixture's `humanOk` step is addressed to a human — no auto-answer
    const { stepTimings } = halted.run;
    expect(stepTimings).toHaveLength(3); // diff, panel — both finished; humanOk — started, halted right there

    expect(stepTimings[0]).toEqual({ step: 'diff', stepIndex: 0, startedAt: '1970-01-01T00:00:01.000Z', finishedAt: '1970-01-01T00:00:02.000Z', durationMs: 1000 });
    expect(stepTimings[1]).toEqual({ step: 'panel', stepIndex: 1, startedAt: '1970-01-01T00:00:03.000Z', finishedAt: '1970-01-01T00:00:04.000Z', durationMs: 1000 });

    // THE HALTED STEP. Started, and — the whole point — NOT finished. A fabricated finish here would be
    // exactly the defect Done-when #1 rules out.
    expect(stepTimings[2]).toEqual({ step: 'humanOk', stepIndex: 2, startedAt: '1970-01-01T00:00:05.000Z' });
    expect(stepTimings[2].finishedAt).toBeUndefined();
    expect(stepTimings[2].durationMs).toBeUndefined();

    // Persisted, not just returned — a crashed/gone session leaves exactly this on disk for the next reader.
    expect(store.read('run-tm').stepTimings).toEqual(stepTimings);

    // RESUMING THE SAME CLOCK completes the run and finishes every remaining row, with the SAME deterministic
    // arithmetic — proving the timings are sourced from the injected clock end to end, not from wall time.
    const done = await driveRun({
      run: halted.run, registry, store, clock,
      judge: async () => FIXTURE_JUDGE_ANSWER,
      resume: { value: 'accept' },
      sinks: { 'comment.post': async () => ({ ok: true }), 'label.swap': async () => ({ ok: true }) },
    });
    expect(done.stopped).toBe('complete');
    expect(done.run.stepTimings).toHaveLength(4);
    expect(done.run.stepTimings.map((t) => t.step)).toEqual(['diff', 'panel', 'humanOk', 'land']);
    // Every row is now finished, with a non-negative duration — Done-when #1's "completed run" half.
    for (const row of done.run.stepTimings) {
      expect(row.finishedAt).toEqual(expect.any(String));
      expect(row.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(done.run.stepTimings[2]).toEqual({ step: 'humanOk', stepIndex: 2, startedAt: '1970-01-01T00:00:05.000Z', finishedAt: '1970-01-01T00:00:06.000Z', durationMs: 1000 });
    expect(done.run.stepTimings[3]).toEqual({ step: 'land', stepIndex: 3, startedAt: '1970-01-01T00:00:07.000Z', finishedAt: '1970-01-01T00:00:08.000Z', durationMs: 1000 });
  });

  it('a `--resume` process reading a suspended run does not double-stamp the step it resumes into', async () => {
    // A fresh `clock` (a NEW process would inject its own) — proves the idempotency guard, not the arithmetic.
    const store = createMemoryRunStore();
    const run = startRun({ op: FIXTURE_OP, id: 'run-tm2', input: { pr: 1 }, registry });
    store.write(run);
    const halted = await driveRun({ run, registry, store, sinks: {}, judge: async () => FIXTURE_JUDGE_ANSWER, clock: stubClock() });
    expect(halted.run.stepTimings).toHaveLength(3);

    const resumedTwice = await driveRun({
      run: halted.run, registry, store, clock: stubClock(500),
      judge: async () => FIXTURE_JUDGE_ANSWER,
      resume: { value: 'accept' },
      sinks: { 'comment.post': async () => ({ ok: true }), 'label.swap': async () => ({ ok: true }) },
    });
    // Exactly one row per step — the earlier `diff`/`panel` starts were never re-opened by the second process.
    expect(resumedTwice.run.stepTimings).toHaveLength(4);
    expect(resumedTwice.run.stepTimings.filter((t) => t.step === 'diff')).toHaveLength(1);
  });
});

describe('wake.mjs resolves a dispatch\'s FINISH stamp — driveRun can only start it (#3368)', () => {
  const DISPATCH_TIMING_OP = 'fx-dispatch-timing';
  function dispatchTimingRegistry() {
    const r = createRegistry();
    r.register(op(DISPATCH_TIMING_OP, {
      input: { pr: { type: 'number', required: true } },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
    }));
    return r;
  }
  const registry = dispatchTimingRegistry();
  const sinks = { 'start.build': async () => inFlight({ handle: 'sess-abc', expectedBy: '2099-01-01T00:00:00.000Z' }) };

  it('driveRun starts the step and parks with NO finish; wakeRun stamps the finish once the dispatch resolves', async () => {
    const clock = stubClock();
    const store = createMemoryRunStore();
    const run = startRun({ op: DISPATCH_TIMING_OP, id: 'run-dt', input: { pr: 7 }, registry });
    store.write(run);

    const parked = await driveRun({ run, registry, store, sinks, judge: async () => { throw new Error('no juror'); }, clock });
    expect(parked.stopped).toBe('effect-in-flight');
    expect(parked.run.stepTimings).toEqual([{ step: 'go', stepIndex: 0, startedAt: '1970-01-01T00:00:01.000Z' }]);

    // TIME PASSES — the dispatch this session started is gone; a later waker tick learns it is done.
    const report = await wakeRun(parked.run, {
      observers: { 'start.build': async () => ({ status: 'succeeded', result: { exit: 0 } }) },
      store, registry, sinks, now: new Date('2026-08-27T01:00:00.000Z'),
    });
    expect(report.status).toBe('complete');

    const record = store.read('run-dt');
    expect(record.stepTimings).toEqual([{
      step: 'go', stepIndex: 0, startedAt: '1970-01-01T00:00:01.000Z',
      finishedAt: '2026-08-27T01:00:00.000Z',
      durationMs: Date.parse('2026-08-27T01:00:00.000Z') - Date.parse('1970-01-01T00:00:01.000Z'),
    }]);
  });

  it('a run still parked (dispatch not yet resolved) gets no finish stamp from a wake pass', async () => {
    const clock = stubClock();
    const store = createMemoryRunStore();
    const run = startRun({ op: DISPATCH_TIMING_OP, id: 'run-dt2', input: { pr: 7 }, registry });
    store.write(run);
    const parked = await driveRun({ run, registry, store, sinks, judge: async () => { throw new Error('no juror'); }, clock });

    const report = await wakeRun(parked.run, {
      observers: { 'start.build': async () => ({ status: 'running' }) },
      store, registry, sinks, now: new Date('2026-08-27T01:00:00.000Z'),
    });
    expect(report.status).toBe('awaiting-effect');
    expect(store.read('run-dt2').stepTimings).toEqual([{ step: 'go', stepIndex: 0, startedAt: '1970-01-01T00:00:01.000Z' }]);
  });
});
