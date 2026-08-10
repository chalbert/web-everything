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
import { LEDGER_EFFECT_TYPE, applyPendingEffects, createEffectExecutor, notApplied } from '../effect-executor.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry, op } from '../registry.mjs';
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
