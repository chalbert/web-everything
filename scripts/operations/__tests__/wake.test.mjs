/**
 * @file wake.test.mjs — the waker, and the observer half of the sink registry (#x0t9923, ruled by #3070).
 *
 * THE LOAD-BEARING TESTS are the fail-soft ones and the ordering one. A pass touches every parked run in the
 * store, so the interesting cases are not "an observer said applied" — they are "one run is broken and the
 * others still wake", and "the answer is persisted before anything that could crash".
 *
 * Nothing here spawns a process or touches disk: observers are stubs, the store is in memory, and the clock
 * is injected.
 */

import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects, inFlight, inFlightEntries } from '../effect-executor.mjs';
import { createEffectObserver, observeRun, planObservations, OBSERVATIONS, SKIPS } from '../effect-observer.mjs';
import { isParkedOnDispatch, renderPass, wakePass, wakeRun } from '../wake.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry, op } from '../registry.mjs';
import { confirm as confirmStep, effect, judge as judgeStep } from '../step-kinds.mjs';

const OP = 'fx-wake';
const KEY = 'run-w#0#0';
const NOTE = 'run-w#0#1';

/** One dispatch, then an ordinary effect after it — so "the run finishes what it was doing" is observable. */
function registryFor() {
  const r = createRegistry();
  r.register(op(OP, {
    input: { pr: { type: 'number', required: true } },
    go: effect({
      reads: ['input.pr'],
      effects: () => [
        { type: 'start.build', payload: {}, dispatch: true },
        { type: 'note.write', payload: {} },
      ],
    }),
  }));
  return r;
}

const registry = registryFor();
const SINKS = {
  'start.build': async () => inFlight({ handle: 'sess-abc', expectedBy: '2099-01-01T00:00:00.000Z' }),
  'note.write': async () => ({ ok: true }),
};

/** Drive a fresh run to its park. Returns the parked record and the store holding it. */
async function parked(id = 'run-w', sinks = SINKS) {
  const store = createMemoryRunStore();
  let run = advanceWhileRunning(startRun({ op: OP, id, input: { pr: 7 }, registry }), { registry });
  store.write(run);
  run = (await applyPendingEffects(run, { sinks, store })).run;
  expect(run.effects[0].status).toBe('in-flight');
  return { run, store };
}

const resolveFor = () => ({ registry, sinks: SINKS });

describe('planObservations — what a pass would do, before doing any of it', () => {
  it('observes an entry that is running and inside its deadline', async () => {
    const { run } = await parked();
    const plan = planObservations(run, { 'start.build': async () => ({ status: 'running' }) }, '2026-01-01T00:00:00.000Z');
    expect(plan.observe.map((e) => e.key)).toEqual([KEY]);
    expect(plan.skip).toEqual([]);
  });

  // OVERDUE IS STILL OBSERVED. Past its own estimate changes what a human is told, not what the machine asks —
  // an `expectedBy` is an estimate, and failing an entry on a clock alone would kill slow-but-healthy work.
  it('observes an OVERDUE entry too, rather than declaring it dead', async () => {
    const { run } = await parked();
    const plan = planObservations(run, { 'start.build': async () => ({ status: 'running' }) }, '2100-01-01T00:00:00.000Z');
    expect(inFlightEntries(run, '2100-01-01T00:00:00.000Z').overdue).toHaveLength(1);
    expect(plan.observe.map((e) => e.key)).toEqual([KEY]);
  });

  it('SKIPS a handle-less entry — there is nothing to poll, and guessing is the thing being avoided', async () => {
    const { run } = await parked('run-w', {
      'start.build': async () => { throw new Error('lost the child before it reported back'); },
      'note.write': SINKS['note.write'],
    });
    const plan = planObservations(run, { 'start.build': async () => ({ status: 'finished' }) });
    expect(plan.observe).toEqual([]);
    expect(plan.skip).toEqual([{ key: KEY, type: 'start.build', reason: SKIPS.NO_HANDLE }]);
  });

  it('SKIPS a type with no registered observer, and says which', async () => {
    const { run } = await parked();
    const plan = planObservations(run, {});
    expect(plan.observe).toEqual([]);
    expect(plan.skip).toEqual([{ key: KEY, type: 'start.build', reason: SKIPS.NO_OBSERVER }]);
  });
});

describe('observeRun — folding terminal answers into the record', () => {
  it('a `running` answer changes nothing', async () => {
    const { run } = await parked();
    const out = await observeRun(run, { observers: { 'start.build': async () => ({ status: 'running' }) } });
    expect(out.stillRunning).toEqual([KEY]);
    expect(out.resolved).toEqual([]);
    expect(out.run.effects[0].status).toBe('in-flight');
  });

  // THE TWO TERMINAL ANSWERS LAND IN DIFFERENT SLOTS, and that is the whole fix (PR #1186 rounds 1-2).
  it('`finished` records `applied` — the effect was "start the work", and it started', async () => {
    const { run } = await parked();
    const out = await observeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished', result: { exit: 1 }, error: 'the build died' }) },
    });
    // A FAILING build is still a finished dispatch. The outcome rides in `result`; the run advances with it.
    expect(out.run.effects[0]).toMatchObject({ status: 'applied', result: { exit: 1 }, error: 'the build died' });
    expect(out.resolved[0]).toMatchObject({ status: 'finished', recordedAs: 'applied' });
  });

  it('`never-started` records `failed` — nothing landed, so retrying is correct', async () => {
    const { run } = await parked();
    const out = await observeRun(run, {
      observers: { 'start.build': async () => ({ status: 'never-started', error: 'no such session' }) },
    });
    expect(out.run.effects[0]).toMatchObject({ status: 'failed', error: 'no such session' });
    expect(out.resolved[0]).toMatchObject({ status: 'never-started', recordedAs: 'failed' });
  });

  // The word that collided is gone from the vocabulary, so it cannot be answered by accident.
  it('REFUSES the word `failed`, which meant opposite things to an observer and to the executor', async () => {
    const { run } = await parked();
    const out = await observeRun(run, { observers: { 'start.build': async () => ({ status: 'failed' }) } });
    expect(out.run.effects[0].status).toBe('in-flight');
    expect(out.errors[0].error).toMatch(/expected one of/);
  });

  // FAIL-SOFT. The entry is still in-flight, which is the truth, and the next pass asks again.
  it('an observer that THROWS is reported and leaves its entry alone', async () => {
    const { run } = await parked();
    const out = await observeRun(run, {
      observers: { 'start.build': async () => { throw new Error('poll timed out'); } },
    });
    expect(out.errors[0]).toMatchObject({ key: KEY });
    expect(out.errors[0].error).toMatch(/poll timed out/);
    expect(out.run.effects[0].status).toBe('in-flight');
  });

  it('an observer answering outside the closed set is reported, not obeyed', async () => {
    const { run } = await parked();
    for (const bad of ['done', 'finished ', 'failed', null, undefined, 42]) {
      const out = await observeRun(run, { observers: { 'start.build': async () => ({ status: bad }) } });
      expect(out.run.effects[0].status).toBe('in-flight');
      expect(out.errors[0].error).toMatch(/expected one of/);
    }
    expect(OBSERVATIONS).toEqual(['running', 'finished', 'never-started']);
  });

  it('createEffectObserver validates its wiring at construction, not at the first pass', () => {
    expect(() => createEffectObserver({ observers: 'nope' })).toThrow(/must be an object or a Map/);
    expect(createEffectObserver({ observers: { b: () => {}, a: () => {} } }).types()).toEqual(['a', 'b']);
  });
});

describe('wakeRun — one pass over one run', () => {
  it('resolving the dispatch lets the run finish the rest of the step and complete', async () => {
    const { run, store } = await parked();
    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished', result: { exit: 0 } }) },
      store, registry, sinks: SINKS,
    });
    expect(report.resolved).toHaveLength(1);
    expect(report.advanced).toBe(true);
    expect(report.status).toBe('complete');
    expect(store.read('run-w').effects.map((e) => e.status)).toEqual(['applied', 'applied']);
  });

  it('leaves a still-running run exactly where it was, and spends no advance on it', async () => {
    const { run, store } = await parked();
    const writes = [];
    const spy = { read: store.read, write: (r) => { writes.push(r.id); return store.write(r); }, list: store.list };
    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'running' }) },
      store: spy, registry, sinks: SINKS,
    });
    expect(report.stillRunning).toEqual([KEY]);
    expect(report.advanced).toBe(false);
    expect(report.status).toBe('awaiting-effect');
    expect(writes).toEqual([]);
  });

  // THE ORDERING. An observation is the only record that the work finished — the observer may not be able to
  // answer twice — so it is persisted BEFORE anything that could crash.
  it('persists the resolution BEFORE advancing, so a crash in advance loses no answer', async () => {
    const { run, store } = await parked();
    const seen = [];
    const spy = {
      read: store.read,
      write: (r) => { seen.push(r.effects.map((e) => e.status).join(',')); return store.write(r); },
      list: store.list,
    };
    await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store: spy,
      registry,
      // A sink that throws mid-advance: the resolution must already be on disk by then.
      sinks: { ...SINKS, 'note.write': async () => { throw new Error('boom'); } },
    });
    expect(seen[0]).toBe('applied,declared');
    expect(store.read('run-w').effects[0].status).toBe('applied');
  });

  it('a sink failing during the advance is reported, not thrown', async () => {
    const { run, store } = await parked();
    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store,
      registry,
      sinks: { ...SINKS, 'note.write': async () => { throw new Error('boom'); } },
    });
    expect(report.errors.map((e) => e.error).join(' ')).toMatch(/boom/);
  });

  // A dispatch that starts another dispatch is legitimate — the pass stops and the next one picks it up.
  it('re-parks rather than looping when advancing reaches a NEW dispatch', async () => {
    const r = createRegistry();
    r.register(op('fx-chain', {
      input: { pr: { type: 'number', required: true } },
      one: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
      two: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
    }));
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: 'fx-chain', id: 'run-x', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: SINKS, store })).run;

    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store, registry: r, sinks: SINKS,
    });
    expect(report.status).toBe('awaiting-effect');
    expect(inFlightEntries(store.read('run-x')).running).toHaveLength(1);
  });
});

describe('wakePass — one pass over the whole store', () => {
  it('ignores runs that are not parked on a dispatch', async () => {
    const { store } = await parked();
    const fresh = startRun({ op: OP, id: 'run-fresh', input: { pr: 7 }, registry });
    store.write(fresh);
    expect(isParkedOnDispatch(fresh)).toBe(false);

    const pass = await wakePass({
      store, observers: { 'start.build': async () => ({ status: 'running' }) }, resolveFor,
    });
    expect(pass.scanned).toBe(2);
    expect(pass.parked).toBe(1);
    expect(pass.runs.map((r) => r.runId)).toEqual(['run-w']);
  });

  // THE ONE THAT MATTERS FOR A TIMER JOB. One odd run must not stop the rest — a waker that dies on the first
  // unreadable record stops waking everything.
  it('one broken run does not stop the others', async () => {
    const a = await parked('run-a');
    const b = await parked('run-b');
    for (const id of b.store.list()) a.store.write(b.store.read(id));
    const store = {
      list: () => ['run-a', 'run-bad', 'run-b'],
      read: (id) => { if (id === 'run-bad') throw new Error('unreadable record'); return a.store.read(id); },
      write: a.store.write,
    };

    const pass = await wakePass({
      store, observers: { 'start.build': async () => ({ status: 'finished' }) }, resolveFor,
    });
    expect(pass.errors).toEqual([{ runId: 'run-bad', error: 'unreadable record' }]);
    expect(pass.runs.map((r) => r.runId).sort()).toEqual(['run-a', 'run-b']);
    expect(pass.runs.every((r) => r.resolved.length === 1)).toBe(true);
  });

  it('an unresolvable operation is reported against its run, and the pass continues', async () => {
    const { store } = await parked();
    const pass = await wakePass({
      store,
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      resolveFor: () => { throw new Error('no operation named "fx-wake"'); },
    });
    expect(pass.parked).toBe(1);
    expect(pass.errors[0]).toMatchObject({ runId: 'run-w' });
    expect(pass.runs).toEqual([]);
  });

  it('is quiet when nothing is parked — this runs on a timer', async () => {
    const store = createMemoryRunStore();
    store.write(startRun({ op: OP, id: 'run-idle', input: { pr: 7 }, registry }));
    const pass = await wakePass({ store, observers: {}, resolveFor });
    expect(renderPass(pass)).toEqual(['wake: 1 run(s) scanned, none parked on a dispatch.']);
  });

  it('names what it skipped, so an unwatched dispatch is visible rather than silently ignored', async () => {
    const { store } = await parked();
    const pass = await wakePass({ store, observers: {}, resolveFor });
    expect(renderPass(pass).join('\n')).toMatch(/SKIPPED run-w#0#0 \(no-observer\)/);
  });
});

/**
 * FINISHED WORK IS NEVER RE-DISPATCHED, BY ANY CALLER (PR #1186 rounds 1 and 2). The first cut let an
 * observer's "it failed" become the executor's `failed`, whose contract is "nothing landed, safe to retry",
 * and the waker re-ran the build on every tick. The second cut halted the WAKER — and the operator's
 * `--resume`, the only recovery the run's own output offers, re-ran it instead. Halting one caller cannot fix
 * a record that says the wrong thing, so these tests exercise BOTH callers.
 */
describe('finished work is never re-dispatched, by the waker or by a resume', () => {
  function countingSinks(calls) {
    return {
      'start.build': async () => { calls.push('dispatch'); return inFlight({ handle: 'sess-abc' }); },
      'note.write': async () => ({ ok: true }),
    };
  }

  async function parkedCounting(calls, id = 'run-w') {
    const sinks = countingSinks(calls);
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: OP, id, input: { pr: 7 }, registry }), { registry });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks, store })).run;
    return { run, store, sinks };
  }

  it('a build that RAN AND FAILED is not re-dispatched by the waker', async () => {
    const calls = [];
    const { store, sinks } = await parkedCounting(calls);
    expect(calls).toEqual(['dispatch']);
    const observers = { 'start.build': async () => ({ status: 'finished', result: { exit: 1 } }) };
    for (let i = 0; i < 4; i += 1) await wakeRun(store.read('run-w'), { observers, store, registry, sinks });
    expect(calls).toEqual(['dispatch']);
  });

  // THE ROUND-2 FINDING. Halting the waker was not enough — `--resume` is the recovery the run itself prints,
  // and it re-dispatched instead. Now there is nothing left to resume: the dispatch is `applied`, so the run
  // ran to completion and the executor refuses a replay outright.
  it('nor by the operator resuming, which is the recovery the run itself prints', async () => {
    const calls = [];
    const { store, sinks } = await parkedCounting(calls);
    await wakeRun(store.read('run-w'), {
      observers: { 'start.build': async () => ({ status: 'finished', result: { exit: 1 } }) },
      store, registry, sinks,
    });
    await expect(applyPendingEffects(store.read('run-w'), { sinks, store }))
      .rejects.toThrow(/not suspended on an effect step/);
    expect(calls).toEqual(['dispatch']);
  });

  it('the outcome is kept, so a declaration can act on a failing build', async () => {
    const calls = [];
    const { store, sinks } = await parkedCounting(calls);
    await wakeRun(store.read('run-w'), {
      observers: { 'start.build': async () => ({ status: 'finished', result: { exit: 1 }, error: 'tests red' }) },
      store, registry, sinks,
    });
    expect(store.read('run-w').effects[0]).toMatchObject({ status: 'applied', result: { exit: 1 }, error: 'tests red' });
  });

  it('the run still advances past a finished dispatch, failing outcome or not', async () => {
    const calls = [];
    const { run, store, sinks } = await parkedCounting(calls);
    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished', result: { exit: 1 } }) },
      store, registry, sinks,
    });
    expect(report.advanced).toBe(true);
    expect(report.status).toBe('complete');
  });

  // `never-started` is the one that SHOULD retry — nothing landed, which is exactly what the executor's
  // `failed` licenses. Pinned so the fix above is not mistaken for "never retry anything".
  it('but work that NEVER STARTED is re-dispatched, because nothing landed', async () => {
    const calls = [];
    const { store, sinks } = await parkedCounting(calls);
    await wakeRun(store.read('run-w'), {
      observers: { 'start.build': async () => ({ status: 'never-started', error: 'no such session' }) },
      store, registry, sinks,
    });
    // `failed` is the executor's "safe to retry", so the same pass re-enters the sink — which is correct
    // here and only here: the observer said nothing ran.
    expect(calls).toEqual(['dispatch', 'dispatch']);
    expect(store.read('run-w').effects[0].status).toBe('in-flight');
  });
});

/**
 * THE SAFETY PROPERTY THAT MATTERS MOST, and it was defended by a comment only (PR #1186 review, NB-1).
 * #3070 ruled the waker calls `advance` and nothing else. A confirm owed to a HUMAN must therefore survive a
 * pass untouched — the reviewer mutated the else-branch to auto-answer one and the whole suite stayed green,
 * because no `confirm` step appeared anywhere in this file.
 */
describe('the waker hands back every suspend that is not an effect', () => {
  /** A dispatch, then a confirm addressed to a human. */
  function humanRegistry() {
    const r = createRegistry();
    r.register(op('fx-human', {
      input: { pr: { type: 'number', required: true } },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
      ok: confirmStep({ reads: ['input.pr'], asks: () => 'Land it?', of: () => 'human', options: ['accept', 'changes'] }),
    }));
    return r;
  }

  it('leaves a HUMAN-addressed confirm suspended, and answers nothing', async () => {
    const r = humanRegistry();
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: 'fx-human', id: 'run-h', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: SINKS, store })).run;

    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store, registry: r, sinks: SINKS,
    });
    expect(report.status).toBe('awaiting-confirm');
    const after = store.read('run-h');
    expect(after.pending).toMatchObject({ kind: 'confirm', of: 'human' });
    expect(after.findings.ok).toBeUndefined(); // nothing answered it
  });

  // NB2-1: the first fix pinned ONE shape, so two other auto-answers still slipped past the whole suite —
  // an AGENT-addressed confirm, and a judge step, which is the worse of the two because answering it invents
  // a verdict without ever spawning a juror.
  it('leaves an AGENT-addressed confirm suspended too — the waker answers no confirm at all', async () => {
    const r = createRegistry();
    r.register(op('fx-agent', {
      input: { pr: { type: 'number', required: true } },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
      ok: confirmStep({ reads: ['input.pr'], asks: () => 'Land it?', of: () => 'agent', options: ['accept', 'changes'] }),
    }));
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: 'fx-agent', id: 'run-a', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: SINKS, store })).run;

    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store, registry: r, sinks: SINKS,
    });
    expect(report.status).toBe('awaiting-confirm');
    expect(store.read('run-a').findings.ok).toBeUndefined();
  });

  it('leaves a JUDGE step suspended — answering it would invent a verdict with no juror', async () => {
    const r = createRegistry();
    r.register(op('fx-judge', {
      input: { pr: { type: 'number', required: true } },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
      look: judgeStep({
        reads: ['input.pr'],
        request: () => ({
          mandate: 'judge it',
          input: 'x',
          shape: { type: 'object', properties: { verdict: { type: 'string' } }, required: ['verdict'] },
        }),
      }),
    }));
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: 'fx-judge', id: 'run-j', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: SINKS, store })).run;

    const report = await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store, registry: r, sinks: SINKS,
    });
    expect(report.status).toBe('awaiting-judge');
    expect(store.read('run-j').findings.look).toBeUndefined();
  });

  // The no-progress break: without it the loop burns all 64 turns and writes the record on each one.
  it('stops as soon as advancing makes no progress, rather than spending the whole turn cap', async () => {
    const r = humanRegistry();
    const store = createMemoryRunStore();
    let run = advanceWhileRunning(startRun({ op: 'fx-human', id: 'run-h', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: SINKS, store })).run;

    let writes = 0;
    const spy = { read: store.read, write: (x) => { writes += 1; return store.write(x); }, list: store.list };
    await wakeRun(run, {
      observers: { 'start.build': async () => ({ status: 'finished' }) },
      store: spy, registry: r, sinks: SINKS,
    });
    // The resolution, then the one advance that reaches the confirm. Not 64.
    expect(writes).toBeLessThanOrEqual(3);
  });
});

describe('wakePass is fail-soft at its own front door', () => {
  it('a store whose list() throws is reported, not thrown', async () => {
    const store = { list: () => { throw new Error('store offline'); }, read: () => null, write: () => {} };
    const pass = await wakePass({ store, observers: {}, resolveFor });
    expect(pass.errors).toEqual([{ error: 'store offline' }]);
    expect(pass.scanned).toBe(0);
    expect(pass.runs).toEqual([]);
  });
});

describe('wakePass survives a store that answers oddly', () => {
  it('a list() that RETURNS a non-array is reported, not thrown (NB2-2)', async () => {
    for (const bad of [null, undefined, 'run-a', 42, {}]) {
      const store = { list: () => bad, read: () => null, write: () => {} };
      const pass = await wakePass({ store, observers: {}, resolveFor });
      expect(pass.errors).toHaveLength(1);
      expect(pass.errors[0].error).toMatch(/not an array/);
      expect(pass.runs).toEqual([]);
    }
  });
});
