/**
 * @file effect-executor.test.mjs — idempotent replay over a GENUINE partial failure (#3032).
 *
 * THE LOAD-BEARING TESTS IN HERE are the partial-failure ones. A clean re-run proves almost nothing: the
 * interesting state is the half-done one, which is exactly #2964's defect — one logical act split across
 * two non-atomic writes, the first landed and the second not. So the fixture's effect step is that pair
 * (post the durable comment, then swap the label the drain acts on), and these tests break it in the
 * middle on purpose:
 *
 *   - the second effect fails → the first is NOT re-applied on replay, and the second IS retried;
 *   - the second effect's outcome is UNKNOWN → replay REFUSES rather than guessing, unless the effect
 *     declared itself idempotent;
 *   - an unknown effect type → NOTHING is applied, not even the effects before it.
 *
 * Nothing here spawns a process or opens a socket: the sinks are stubs and the store is in memory.
 */

import { describe, it, expect } from 'vitest';

import { advance, advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { LEDGER_EFFECT_TYPE, applyPendingEffects, createEffectExecutor, inFlight, inFlightEntries, notApplied, resolveInFlight } from '../effect-executor.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry, op } from '../registry.mjs';
import { driveRun, outcomePayload, renderOutcome } from '../cli-adapter.mjs';
import { effect } from '../step-kinds.mjs';
import { FIXTURE_JUDGE_ANSWER, FIXTURE_OP, fixtureRegistry } from '../__fixtures__/fixture-operation.mjs';

const registry = fixtureRegistry();

/** Drive the fixture up to its effect step: compute → judge (canned answer) → confirm (accept). */
function atEffectStep(id = 'run-fx') {
  let run = advanceWhileRunning(startRun({ op: FIXTURE_OP, id, input: { pr: 7 }, registry }), { registry });
  run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
  run = advanceWhileRunning(run, { registry, resume: { value: 'accept' } });
  expect(runStatus(run, { registry })).toBe('awaiting-effect');
  return run;
}

/** Recording sinks. `fail` names a type that throws; `certain` picks `notApplied` vs an indeterminate throw. */
function recordingSinks({ fail = null, certain = true } = {}) {
  const calls = [];
  const make = (type) => async (payload, ctx) => {
    calls.push({ type, key: ctx.key, payload });
    if (fail === type) {
      throw certain ? notApplied(`${type} refused before writing anything`) : new Error(`${type} timed out — outcome unknown`);
    }
    return { ok: true, type };
  };
  return { calls, sinks: { 'comment.post': make('comment.post'), 'label.swap': make('label.swap') } };
}

describe('the happy path', () => {
  it('applies every declared effect in declared order and lets the run complete', async () => {
    const store = createMemoryRunStore();
    const { calls, sinks } = recordingSinks();
    let run = atEffectStep();
    store.write(run);

    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.error).toBeNull();
    expect(outcome.applied).toEqual(['run-fx#3#0', 'run-fx#3#1']);
    expect(calls.map((c) => c.type)).toEqual(['comment.post', 'label.swap']);
    expect(calls[1].payload).toEqual({ pr: 7, label: 'review:accepted' });

    run = advance(outcome.run, { registry });
    expect(runStatus(run, { registry })).toBe('complete');
    expect(run.effects.every((e) => e.status === 'applied')).toBe(true);
    expect(run.effects[0].result).toEqual({ ok: true, type: 'comment.post' });
  });

  it('a clean replay applies NOTHING a second time', async () => {
    const store = createMemoryRunStore();
    const { calls, sinks } = recordingSinks();
    const run = atEffectStep();
    store.write(run);

    const first = await applyPendingEffects(run, { sinks, store });
    const second = await applyPendingEffects(first.run, { sinks, store });
    expect(calls).toHaveLength(2);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(['run-fx#3#0', 'run-fx#3#1']);
  });
});

describe('a GENUINE partial failure — the #2964 shape', () => {
  it('halts at the failing effect, keeps the one that landed, and never attempts the next', async () => {
    const store = createMemoryRunStore();
    const { calls, sinks } = recordingSinks({ fail: 'label.swap' });
    const run = atEffectStep();
    store.write(run);

    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.applied).toEqual(['run-fx#3#0']);
    expect(outcome.halted.key).toBe('run-fx#3#1');
    expect(outcome.error.message).toMatch(/refused before writing anything/);
    expect(outcome.run.effects.map((e) => e.status)).toEqual(['applied', 'failed']);

    // The run does NOT move on. `advance` refuses to step past an effect step that has not fully landed.
    expect(advance(outcome.run, { registry })).toBe(outcome.run);
    expect(runStatus(outcome.run, { registry })).toBe('awaiting-effect');
  });

  it('replay re-applies ONLY the half that did not land, then completes', async () => {
    const store = createMemoryRunStore();
    const failing = recordingSinks({ fail: 'label.swap' });
    let run = atEffectStep();
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: failing.sinks, store })).run;
    expect(failing.calls.map((c) => c.type)).toEqual(['comment.post', 'label.swap']);

    // Whatever was wrong is fixed; a FRESH process would re-read this record from the store. Here the
    // cross-process version of the same replay lives in run-crosses-processes.test.mjs.
    const healthy = recordingSinks();
    const replay = await applyPendingEffects(store.read(run.id), { sinks: healthy.sinks, store });

    expect(healthy.calls.map((c) => c.type)).toEqual(['label.swap']); // the comment was NOT re-posted
    expect(replay.skipped).toEqual(['run-fx#3#0']);
    expect(replay.applied).toEqual(['run-fx#3#1']);
    expect(advance(replay.run, { registry }).cursor).toBe(4);
    expect(runStatus(advance(replay.run, { registry }), { registry })).toBe('complete');
  });

  it('the ordering guarantee: effect N+1 is never attempted while N has not landed', async () => {
    const store = createMemoryRunStore();
    const { calls, sinks } = recordingSinks({ fail: 'comment.post' });
    const run = atEffectStep();
    store.write(run);

    const outcome = await applyPendingEffects(run, { sinks, store });
    // The label swap — the half the drain acts on — was never even attempted, which is the property
    // #2964's hand-ordering was reaching for. Here it is structural, not a rule at the call site.
    expect(calls.map((c) => c.type)).toEqual(['comment.post']);
    expect(outcome.run.effects.map((e) => e.status)).toEqual(['failed', 'declared']);
  });

  it('the record persisted mid-failure says exactly what was attempted', async () => {
    const store = createMemoryRunStore();
    const { sinks } = recordingSinks({ fail: 'label.swap' });
    const run = atEffectStep();
    store.write(run);
    await applyPendingEffects(run, { sinks, store });

    const fromStore = store.read('run-fx');
    expect(fromStore.effects[0]).toMatchObject({ status: 'applied', type: 'comment.post' });
    expect(fromStore.effects[1]).toMatchObject({ status: 'failed', type: 'label.swap' });
    expect(fromStore.effects[1].error).toMatch(/refused before writing anything/);
  });
});

describe('the indeterminate case — an attempt whose outcome is unknown', () => {
  it('the PERSISTED record already says `pending` at the moment the sink runs — so a crash mid-sink reads as indeterminate', async () => {
    // The mark-before-attempt is the whole three-state model: a process killed inside the sink leaves no
    // catch handler to record anything, so the only thing standing between a mid-sink SIGKILL and a silent
    // re-apply on replay is that the `pending` mark was DURABLE before the sink was called. Observe the
    // store from inside the sink — the exact state a crash at that instant would leave behind.
    const store = createMemoryRunStore();
    const seenByStore = [];
    const observe = async (_payload, ctx) => {
      seenByStore.push(store.read(ctx.runId).effects.find((e) => e.key === ctx.key).status);
      return { ok: true };
    };
    const run = atEffectStep('run-presink');
    store.write(run);
    await applyPendingEffects(run, { sinks: { 'comment.post': observe, 'label.swap': observe }, store });
    expect(seenByStore).toEqual(['pending', 'pending']);
  });

  it('marks the entry `pending`, not `failed`, when the sink throws without saying nothing landed', async () => {
    const store = createMemoryRunStore();
    const { sinks } = recordingSinks({ fail: 'comment.post', certain: false });
    const run = atEffectStep();
    store.write(run);
    const outcome = await applyPendingEffects(run, { sinks, store });
    expect(outcome.run.effects[0].status).toBe('pending');
  });

  it('REFUSES to replay a non-idempotent effect whose outcome is unknown', async () => {
    const store = createMemoryRunStore();
    const run = atEffectStep();
    store.write(run);
    await applyPendingEffects(run, { sinks: recordingSinks({ fail: 'comment.post', certain: false }).sinks, store });

    const healthy = recordingSinks();
    await expect(applyPendingEffects(store.read('run-fx'), { sinks: healthy.sinks, store }))
      .rejects.toThrow(/outcome is UNKNOWN — it is not declared idempotent, so replaying it could double-apply/);
    expect(healthy.calls).toEqual([]); // and nothing at all was applied
  });

  it('DOES replay an indeterminate effect that declared itself idempotent', async () => {
    const store = createMemoryRunStore();
    // Only the label swap is idempotent in the fixture, so break that one.
    const run = atEffectStep();
    store.write(run);
    await applyPendingEffects(run, { sinks: recordingSinks({ fail: 'label.swap', certain: false }).sinks, store });
    expect(store.read('run-fx').effects[1].status).toBe('pending');

    const healthy = recordingSinks();
    const replay = await applyPendingEffects(store.read('run-fx'), { sinks: healthy.sinks, store });
    expect(healthy.calls.map((c) => c.type)).toEqual(['label.swap']);
    expect(replay.run.effects.map((e) => e.status)).toEqual(['applied', 'applied']);
  });
});

describe('the executor fails closed', () => {
  it('an unknown effect type applies NOTHING — not even the effects declared before it', async () => {
    const store = createMemoryRunStore();
    const { calls, sinks } = recordingSinks();
    const run = atEffectStep();
    store.write(run);
    delete sinks['label.swap'];

    await expect(applyPendingEffects(run, { sinks, store }))
      .rejects.toThrow(/no sink registered for effect type "label.swap".*refusing to apply any of this step's effects/s);
    expect(calls).toEqual([]);
  });

  it('names the #3007 ledger seam when the missing sink is the ledger one', async () => {
    const store = createMemoryRunStore();
    const r = createRegistry();
    r.register(op('ledger-op', { a: effect({ effects: () => [{ type: LEDGER_EFFECT_TYPE, payload: { pr: 1 } }] }) }));
    const run = advance(startRun({ op: 'ledger-op', id: 'run-ledger', registry: r }), { registry: r });
    store.write(run);
    await expect(applyPendingEffects(run, { sinks: {}, store }))
      .rejects.toThrow(/the seam for the #3007 verdict ledger, which is still open and is NOT implemented by this executor/);
  });

  it('refuses when the run is not suspended on an effect step at all', async () => {
    const store = createMemoryRunStore();
    const run = startRun({ op: FIXTURE_OP, id: 'run-notpending', input: { pr: 1 }, registry });
    await expect(applyPendingEffects(run, { sinks: {}, store })).rejects.toThrow(/nothing pending.*nothing to apply/s);
  });

  it('refuses a run record that does not validate, and a missing store', async () => {
    await expect(applyPendingEffects({}, { sinks: {}, store: createMemoryRunStore() })).rejects.toThrow(/is invalid/);
    await expect(applyPendingEffects(atEffectStep(), { sinks: {} })).rejects.toThrow(/needs a `store` handle/);
  });

  it('createEffectExecutor validates its wiring at construction, not at the first apply', () => {
    expect(() => createEffectExecutor({ sinks: 'nope', store: createMemoryRunStore() })).toThrow(/must be an object or a Map/);
    expect(() => createEffectExecutor({ sinks: {} })).toThrow(/needs a `store` handle/);
    expect(createEffectExecutor({ sinks: { b: () => {}, a: () => {} }, store: createMemoryRunStore() }).types()).toEqual(['a', 'b']);
  });

  it('accepts a Map of sinks as well as a plain object', async () => {
    const store = createMemoryRunStore();
    const seen = [];
    const sinks = new Map([
      ['comment.post', async () => { seen.push('comment.post'); }],
      ['label.swap', async () => { seen.push('label.swap'); }],
    ]);
    const run = atEffectStep();
    store.write(run);
    const outcome = await createEffectExecutor({ sinks, store }).apply(run);
    expect(seen).toEqual(['comment.post', 'label.swap']);
    expect(outcome.run.effects.every((e) => e.status === 'applied')).toBe(true);
    expect(outcome.run.effects[0].result).toBeNull(); // a sink returning undefined records null, not undefined
  });
});


/**
 * THE FOURTH STATE (#3073). `applied` means the sink RAN, not that the work it started FINISHED. For every
 * effect above, those were the same event; a DISPATCH — start a build, spawn a session — breaks that.
 *
 * Its own operation rather than the fixture, because the distinction is DECLARED: an effect says
 * `dispatch: true` and the executor writes `in-flight` BEFORE calling the sink. That ordering is the point —
 * learning it from the return value would leave a crash mid-dispatch recording running work as an unknown
 * outcome, which is the window the whole item exists to close.
 */
const DISPATCH_OP = 'fx-dispatch';

/** `start.build` dispatches and is NOT idempotent; `note.write` is an ordinary effect after it. */
function dispatchRegistry() {
  const r = createRegistry();
  r.register(op(DISPATCH_OP, {
    input: { pr: 'number' },
    go: effect({
      reads: ['input.pr'],
      effects: (view) => [
        { type: 'start.build', payload: { pr: view.input.pr }, dispatch: true },
        { type: 'note.write', payload: { pr: view.input.pr } },
      ],
    }),
  }));
  return r;
}

const dRegistry = dispatchRegistry();
const KEY = 'run-d#0#0';
const NOTE = 'run-d#0#1';

function atDispatchStep(id = 'run-d') {
  const run = advanceWhileRunning(startRun({ op: DISPATCH_OP, id, input: { pr: 7 }, registry: dRegistry }), { registry: dRegistry });
  expect(runStatus(run, { registry: dRegistry })).toBe('awaiting-effect');
  return run;
}

describe('in-flight: started on purpose, outcome arrives later', () => {
  /** @param {(payload, ctx) => any} build - what `start.build` does. */
  function sinks(build, calls = []) {
    return {
      calls,
      sinks: {
        'start.build': async (p, ctx) => { calls.push(ctx.key); return build(p, ctx); },
        'note.write': async (p, ctx) => { calls.push(ctx.key); return { ok: true }; },
      },
    };
  }

  it('records the dispatch as `in-flight`, not `applied`, with its handle, start time and deadline', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => inFlight({ handle: 'sess-abc', expectedBy: '2099-01-01T00:00:00.000Z' }));
    const run = atDispatchStep();
    store.write(run);

    const outcome = await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(outcome.run.effects.find((e) => e.key === KEY)).toMatchObject({
      status: 'in-flight', handle: 'sess-abc', expectedBy: '2099-01-01T00:00:00.000Z',
    });
    expect(Number.isNaN(Date.parse(outcome.run.effects[0].startedAt))).toBe(false);
    expect(outcome.inFlight).toEqual([KEY]);
    expect(outcome.error).toBeNull();
  });

  // THE ORDERING WINDOW, and the reason `dispatch` is declared rather than inferred. What the store holds at
  // the instant the sink is running is what a crash leaves behind — and for a dispatch it must already say
  // `in-flight`, never `pending`.
  it('the PERSISTED record says `in-flight` at the moment the sink runs, before it has returned anything', async () => {
    const store = createMemoryRunStore();
    let seenMidSink = null;
    const s = sinks(() => { seenMidSink = store.read('run-d').effects.find((e) => e.key === KEY); return inFlight({ handle: 'sess-abc' }); });
    const run = atDispatchStep();
    store.write(run);
    await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(seenMidSink.status).toBe('in-flight');
    expect(seenMidSink.handle).toBeNull(); // nothing can know the handle yet
  });

  // The ordering guarantee is about the WORK, not about the sink call returning.
  it('HALTS the batch — a later effect is not attempted while an earlier one is still going', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => inFlight({ handle: 'sess-abc' }));
    const run = atDispatchStep();
    store.write(run);
    await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(s.calls).toEqual([KEY]);
  });

  it('keeps the run suspended on the effect step — dispatch is not completion', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => inFlight({ handle: 'sess-abc' }));
    let run = atDispatchStep();
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: s.sinks, store })).run;
    expect(runStatus(run, { registry: dRegistry })).toBe('awaiting-effect');
    expect(advance(run, { registry: dRegistry })).toEqual(run);
  });

  // THE LOAD-BEARING ONE. An indeterminate `pending` entry is REFUSED on replay because re-running it might
  // double-apply; the effect here is likewise NOT idempotent. In-flight must not inherit that refusal —
  // doing so would strand every dispatch forever.
  it('a replay RESUMES an observable in-flight entry rather than refusing it, and never re-calls the sink', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => inFlight({ handle: 'sess-abc' }));
    let run = atDispatchStep();
    expect(run.effects.find((e) => e.key === KEY).idempotent).toBe(false);
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: s.sinks, store })).run;

    const replay = await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(replay.error).toBeNull();
    expect(replay.inFlight).toEqual([KEY]);
    expect(s.calls).toEqual([KEY]); // called once, not twice
  });

  // Reporting "still going" needs no sink — the sink's job was to START the work, and it did.
  it('reports an in-flight entry even when its sink is no longer registered', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => inFlight({ handle: 'sess-abc' }));
    let run = atDispatchStep();
    store.write(run);
    run = (await applyPendingEffects(run, { sinks: s.sinks, store })).run;
    const outcome = await applyPendingEffects(run, { sinks: { 'note.write': s.sinks['note.write'] }, store });
    expect(outcome.inFlight).toEqual([KEY]);
  });

  it('refuses an in-flight marker from an effect that was not declared `dispatch`', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => ({ ok: true }));
    s.sinks['note.write'] = async () => inFlight({ handle: 'sess-x' });
    const run = atDispatchStep();
    store.write(run);
    const outcome = await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(outcome.error.message).toMatch(/not declared `dispatch: true`/);
  });

  // A dispatch that turns out to finish synchronously is honestly `applied` — there is nothing left to observe.
  it('a dispatch sink that returns an ordinary value supersedes the pre-sink in-flight with `applied`', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => ({ exit: 0 }));
    const run = atDispatchStep();
    store.write(run);
    const outcome = await applyPendingEffects(run, { sinks: s.sinks, store });
    expect(outcome.applied).toEqual([KEY, NOTE]);
    expect(outcome.run.effects[0]).toMatchObject({ status: 'applied', result: { exit: 0 } });
  });

  it('refuses a handle that is missing or a number — a pid is not durable, the OS reuses it', () => {
    expect(() => inFlight({})).toThrow(/durable `handle`/);
    expect(() => inFlight({ handle: '  ' })).toThrow(/durable `handle`/);
    expect(() => inFlight({ handle: 12345 })).toThrow(/durable `handle`/);
    expect(() => inFlight({ handle: 'ok', expectedBy: 'soon' })).toThrow(/ISO timestamp/);
  });

  // The brand is a Symbol so an ordinary sink result cannot be mistaken for a dispatch.
  it('a plain object that merely looks like a marker is applied, not treated as in-flight', async () => {
    const store = createMemoryRunStore();
    const s = sinks(() => ({ handle: 'sess-x', expectedBy: null, inFlight: true }));
    const run = atDispatchStep();
    store.write(run);
    expect((await applyPendingEffects(run, { sinks: s.sinks, store })).applied).toEqual([KEY, NOTE]);
  });
});

/**
 * A LOST HANDLE IS NOT "STILL RUNNING". In-flight is resumable because it can be OBSERVED; with no handle it
 * cannot be, so it has degraded into the same "might have started, cannot check" that `pending` means, and
 * gets the same refusal. Without this, a dispatch whose process died before reporting its handle reads as
 * healthy work forever.
 */
describe('a dispatch that loses its handle degrades to unknown', () => {
  async function handleless(idempotent = false) {
    const r = createRegistry();
    r.register(op('fx-lost', {
      input: { pr: 'number' },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true, idempotent }] }),
    }));
    const store = createMemoryRunStore();
    const calls = [];
    // Throws WITHOUT `notApplied` — the sink cannot say whether it started anything.
    const sinks = { 'start.build': async () => { calls.push('start.build'); throw new Error('lost the child before it reported back'); } };
    let run = advanceWhileRunning(startRun({ op: 'fx-lost', id: 'run-l', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks, store })).run;
    return { run, store, sinks, calls, r };
  }

  it('stays in-flight with a null handle and the error, rather than reading as failed', async () => {
    const { run } = await handleless();
    expect(run.effects[0]).toMatchObject({ status: 'in-flight', handle: null });
    expect(run.effects[0].error).toMatch(/lost the child/);
  });

  it('is reported as UNKNOWN, never as running', async () => {
    const { run } = await handleless();
    const split = inFlightEntries(run, '2026-01-01T00:00:00.000Z');
    expect(split.unknown.map((e) => e.key)).toEqual(['run-l#0#0']);
    expect(split.running).toEqual([]);
    expect(split.overdue).toEqual([]);
  });

  it('REFUSES on replay, exactly as an indeterminate `pending` does', async () => {
    const { run, store, sinks } = await handleless();
    await expect(applyPendingEffects(run, { sinks, store })).rejects.toThrow(/dispatched but has NO handle/);
  });

  it('is re-dispatched instead when the effect declared itself idempotent', async () => {
    const { run, store, sinks, calls } = await handleless(true);
    await applyPendingEffects(run, { sinks, store });
    expect(calls).toEqual(['start.build', 'start.build']);
  });

  // A sink that KNOWS nothing started still says so the ordinary way, and gets `failed` — retryable.
  it('a dispatch sink that says nothing started is `failed`, not in-flight', async () => {
    const r = createRegistry();
    r.register(op('fx-refused', {
      input: { pr: 'number' },
      go: effect({ reads: ['input.pr'], effects: () => [{ type: 'start.build', payload: {}, dispatch: true }] }),
    }));
    const store = createMemoryRunStore();
    const sinks = { 'start.build': async () => { throw notApplied('no worker available'); } };
    let run = advanceWhileRunning(startRun({ op: 'fx-refused', id: 'run-r', input: { pr: 7 }, registry: r }), { registry: r });
    store.write(run);
    run = (await applyPendingEffects(run, { sinks, store })).run;
    expect(run.effects[0].status).toBe('failed');
    expect(inFlightEntries(run).unknown).toEqual([]);
  });
});

describe('resolving in-flight work when it reports back', () => {
  async function dispatched(expectedBy = '2020-01-01T00:00:00.000Z') {
    const store = createMemoryRunStore();
    const sinks = {
      'start.build': async () => inFlight({ handle: 'sess-abc', expectedBy }),
      'note.write': async () => ({ ok: true }),
    };
    let run = atDispatchStep();
    store.write(run);
    run = (await applyPendingEffects(run, { sinks, store })).run;
    return { run, store, sinks };
  }

  it('resolving to `applied` lets the rest of the step run and the run complete', async () => {
    const { run, store, sinks } = await dispatched();
    const resolved = resolveInFlight(run, KEY, { status: 'applied', result: { exit: 0 } });
    expect(resolved.effects[0]).toMatchObject({ status: 'applied', result: { exit: 0 } });
    store.write(resolved);
    const outcome = await applyPendingEffects(resolved, { sinks, store });
    expect(outcome.applied).toEqual([NOTE]);
    expect(runStatus(advanceWhileRunning(outcome.run, { registry: dRegistry }), { registry: dRegistry })).toBe('complete');
  });

  it('resolving to `failed` leaves it retryable, which is what `failed` already means', async () => {
    const { run } = await dispatched();
    expect(resolveInFlight(run, KEY, { status: 'failed', error: 'the build died' }).effects[0])
      .toMatchObject({ status: 'failed', error: 'the build died' });
  });

  // Guessing at an unknown outcome is what the `pending` refusal exists to prevent; this is the same refusal
  // reached from the other side.
  it('REFUSES to resolve anything that is not in-flight, and refuses a non-terminal status', async () => {
    const { run, store, sinks } = await dispatched();
    const done = (await applyPendingEffects(resolveInFlight(run, KEY, { status: 'applied' }), { sinks, store })).run;
    expect(() => resolveInFlight(done, NOTE, { status: 'applied' })).toThrow(/is `applied`, not `in-flight`/);
    expect(() => resolveInFlight(run, 'nope', { status: 'applied' })).toThrow(/has no effect/);
    expect(() => resolveInFlight(run, KEY, { status: 'in-flight' })).toThrow(/terminal status/);
  });

  // RUNNING vs OVERDUE is the distinction a waker needs, and the reason `expectedBy` is recorded at all.
  it('splits observable in-flight work into running and overdue by its own deadline', async () => {
    const { run } = await dispatched();
    expect(inFlightEntries(run, '2019-01-01T00:00:00.000Z').running.map((e) => e.key)).toEqual([KEY]);
    expect(inFlightEntries(run, '2019-01-01T00:00:00.000Z').overdue).toEqual([]);
    expect(inFlightEntries(run, '2021-01-01T00:00:00.000Z').overdue.map((e) => e.key)).toEqual([KEY]);
  });

  // Unbounded work is honestly unbounded. Inventing a deadline would turn every long job into a false alarm.
  it('counts work with no expectedBy as running however old it is', async () => {
    const { run } = await dispatched(null);
    expect(inFlightEntries(run, '2999-01-01T00:00:00.000Z').overdue).toEqual([]);
    expect(inFlightEntries(run, '2999-01-01T00:00:00.000Z').running).toHaveLength(1);
  });

  it('needs a valid instant rather than silently comparing against NaN', async () => {
    const { run } = await dispatched();
    expect(() => inFlightEntries(run, 'whenever')).toThrow(/valid instant/);
  });
});

/**
 * THE DRIVER HAS TO BE ABLE TO STOP (PR #1180 review, blocking 1). The executor recorded a dispatch perfectly
 * and `driveRun` could not express it: an in-flight halt returns `error: null`, so the `awaiting-effect` branch
 * fell through to `advance`, which returns the run UNCHANGED (in-flight counts as unapplied, by design). The
 * loop then spun to `maxTurns` and threw a runaway-loop error — the CLI exited 1 and the HTTP adapter 500'd on
 * the one operation this whole epic exists to reach.
 *
 * These drive the REAL adapter, so a regression shows up here rather than in production.
 */
describe('driveRun parks on a dispatch instead of spinning', () => {
  const dispatchSinks = (calls = []) => ({
    calls,
    sinks: {
      'start.build': async (p, ctx) => { calls.push(ctx.key); return inFlight({ handle: 'sess-abc', expectedBy: '2099-01-01T00:00:00.000Z' }); },
      'note.write': async (p, ctx) => { calls.push(ctx.key); return { ok: true }; },
    },
  });

  it('returns `effect-in-flight` rather than throwing a runaway-loop error', async () => {
    const store = createMemoryRunStore();
    const { sinks, calls } = dispatchSinks();
    const run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);

    const outcome = await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } });
    expect(outcome.stopped).toBe('effect-in-flight');
    expect(outcome.error).toBeNull();
    expect(outcome.inFlight).toEqual([KEY]);
    expect(calls).toEqual([KEY]); // the later effect was NOT attempted
  });

  // A dispatch is a SUCCESSFUL stop. Exiting 1 would tell every caller that starting long work is an error.
  it('renders as exit 0, naming the handle and the deadline an observer needs', async () => {
    const store = createMemoryRunStore();
    const { sinks } = dispatchSinks();
    const run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);
    const outcome = await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } });

    const { code, lines } = renderOutcome({ outcome });
    expect(code).toBe(0);
    const text = lines.join('\n');
    expect(text).toMatch(/PARKED/);
    expect(text).toMatch(/sess-abc/);
    expect(text).toMatch(/2099-01-01/);
    expect(renderOutcome({ outcome, json: true }).code).toBe(0);
  });

  it('puts the in-flight keys in the machine-readable payload, so nothing re-scans the record', async () => {
    const store = createMemoryRunStore();
    const { sinks } = dispatchSinks();
    const run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);
    const outcome = await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } });
    expect(outcomePayload(outcome).inFlight).toEqual([KEY]);
    // Stable shape: the field is present even when nothing is in flight.
    expect(outcomePayload({ run, stopped: 'complete' }).inFlight).toEqual([]);
  });

  // Re-driving reports the same park and does not start the work a second time.
  it('a re-drive parks again without re-dispatching', async () => {
    const store = createMemoryRunStore();
    const { sinks, calls } = dispatchSinks();
    let run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);
    run = (await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } })).run;
    const again = await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } });
    expect(again.stopped).toBe('effect-in-flight');
    expect(calls).toEqual([KEY]);
  });

  // Once the work reports back, the SAME driver finishes the run — the park was a pause, not a dead end.
  it('resolving the entry lets the next drive complete the run', async () => {
    const store = createMemoryRunStore();
    const { sinks } = dispatchSinks();
    let run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);
    run = (await driveRun({ run, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } })).run;

    const resolved = resolveInFlight(run, KEY, { status: 'applied', result: { exit: 0 } });
    store.write(resolved);
    const done = await driveRun({ run: resolved, registry: dRegistry, store, sinks, judge: async () => { throw new Error('no juror'); } });
    expect(done.stopped).toBe('complete');
    expect(done.applied).toEqual([NOTE]);
  });
});

/**
 * TWO PLACES REPORTED A DRIVE-LOCAL NUMBER AS A PROPERTY OF THE RECORD (PR #1180 review, findings 1 and 4).
 * Both surface on the RE-DRIVE — the path the park message itself steers the operator onto — so the wrong
 * answer is the one they actually see.
 */
describe('a parked run reports the same thing on every route', () => {
  const dispatchSinks = () => ({
    'start.build': async () => inFlight({ handle: 'sess-abc' }),
    'note.write': async () => ({ ok: true }),
  });
  const judge = async () => { throw new Error('no juror'); };

  it('outcomePayload derives inFlight from the RECORD, so a read with no drive behind it still reports it', async () => {
    const store = createMemoryRunStore();
    const sinks = dispatchSinks();
    let run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    store.write(run);
    run = (await driveRun({ run, registry: dRegistry, store, sinks, judge })).run;

    // The shape a read route builds: no drive, so nothing to pass in.
    expect(outcomePayload({ run, stopped: null, error: null, applied: [] }).inFlight).toEqual([KEY]);
  });

  it('still reports [] when nothing is in flight, so the shape stays stable', () => {
    const run = startRun({ op: DISPATCH_OP, id: 'run-d', input: { pr: 7 }, registry: dRegistry });
    expect(outcomePayload({ run, stopped: 'complete' }).inFlight).toEqual([]);
  });

  // The park line used to count what THIS drive applied, so a re-drive said "0 effect(s) landed" about a
  // record holding one.
  it('the park message counts landed effects from the record, on the first drive and on a re-drive', async () => {
    const r = createRegistry();
    r.register(op('fx-two', {
      input: { pr: { type: 'number', required: true } },
      go: effect({
        reads: ['input.pr'],
        effects: () => [
          { type: 'note.write', payload: {} },
          { type: 'start.build', payload: {}, dispatch: true },
        ],
      }),
    }));
    const store = createMemoryRunStore();
    const sinks = dispatchSinks();
    let run = startRun({ op: 'fx-two', id: 'run-c', input: { pr: 7 }, registry: r });
    store.write(run);

    const first = await driveRun({ run, registry: r, store, sinks, judge });
    expect(renderOutcome({ outcome: first }).lines.join('\n')).toMatch(/1 effect\(s\) have landed/);

    const again = await driveRun({ run: first.run, registry: r, store, sinks, judge });
    expect(renderOutcome({ outcome: again }).lines.join('\n')).toMatch(/1 effect\(s\) have landed/);
  });
});
