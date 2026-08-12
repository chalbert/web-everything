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
import { effect } from '../step-kinds.mjs';

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
    const plan = planObservations(run, { 'start.build': async () => ({ status: 'applied' }) });
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

  it('an `applied` answer resolves the entry and carries the result', async () => {
    const { run } = await parked();
    const out = await observeRun(run, {
      observers: { 'start.build': async () => ({ status: 'applied', result: { exit: 0 } }) },
    });
    expect(out.resolved).toEqual([{ key: KEY, type: 'start.build', status: 'applied' }]);
    expect(out.run.effects[0]).toMatchObject({ status: 'applied', result: { exit: 0 } });
  });

  it('a `failed` answer resolves it to failed, which is retryable — the same thing `failed` already means', async () => {
    const { run } = await parked();
    const out = await observeRun(run, {
      observers: { 'start.build': async () => ({ status: 'failed', error: 'the build died' }) },
    });
    expect(out.run.effects[0]).toMatchObject({ status: 'failed', error: 'the build died' });
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
    for (const bad of ['done', 'applied ', null, undefined, 42]) {
      const out = await observeRun(run, { observers: { 'start.build': async () => ({ status: bad }) } });
      expect(out.run.effects[0].status).toBe('in-flight');
      expect(out.errors[0].error).toMatch(/expected one of/);
    }
    expect(OBSERVATIONS).toEqual(['running', 'applied', 'failed']);
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
      observers: { 'start.build': async () => ({ status: 'applied', result: { exit: 0 } }) },
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
      observers: { 'start.build': async () => ({ status: 'applied' }) },
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
      observers: { 'start.build': async () => ({ status: 'applied' }) },
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
      observers: { 'start.build': async () => ({ status: 'applied' }) },
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
      store, observers: { 'start.build': async () => ({ status: 'applied' }) }, resolveFor,
    });
    expect(pass.errors).toEqual([{ runId: 'run-bad', error: 'unreadable record' }]);
    expect(pass.runs.map((r) => r.runId).sort()).toEqual(['run-a', 'run-b']);
    expect(pass.runs.every((r) => r.resolved.length === 1)).toBe(true);
  });

  it('an unresolvable operation is reported against its run, and the pass continues', async () => {
    const { store } = await parked();
    const pass = await wakePass({
      store,
      observers: { 'start.build': async () => ({ status: 'applied' }) },
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
