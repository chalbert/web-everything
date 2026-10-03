/**
 * @file dispatch-lane-integration.test.mjs — the double-dispatch guard against a REAL run store on disk.
 *
 * WHAT THIS FILE DOES NOT COVER, and why that is not a gap being papered over: `dispatch-lane`'s one side
 * effect is starting a `claude` delivery agent, and its reader shells the conveyor tick core. Neither is a git
 * or filesystem effect this fixture can witness. The spawn is covered instead by
 * `./dispatch-spawn-live.test.mjs`, which starts a real process against a fake `claude` on `PATH`; this file
 * covers the one durable, on-disk thing the operation genuinely owns.
 *
 * THE GUARD, AND WHY IT NEEDS A REAL DIRECTORY. `inFlightDispatchesFor` answers *"did I already start an
 * agent for this item and never see it finish?"* out of the run store, and it is FAIL-SOFT PER RECORD: one
 * unreadable record is skipped and counted rather than wedging every dispatch. `./dispatch-lane.test.mjs`
 * proves that against a hand-written store whose `read` THROWS for one id — which is a MODEL of the real
 * store, and the model carries the load-bearing assumption:
 *
 *     *"the store REFUSES a corrupt record, so one bad file would otherwise wedge the whole operation"*
 *
 * If the real `createFileRunStore` returned `null` for a torn file instead of throwing, the fail-soft branch
 * would never execute, `unreadable` would always be `0`, and the verdict would report a confident clean guard
 * over a partial read. That model-versus-git mismatch is precisely #3264's shape, one layer down — so here
 * the store is the REAL one, the directory is a REAL directory, and the corrupt record is a REAL torn file.
 */
import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inFlightDispatchesFor, readTick, createDispatchObservers } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT, shapeDispatchRead } from '../dispatch-lane.mjs';
import { settleDispatchEffect } from '../deliver-item-settle.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

/**
 * A run record the REAL store will accept.
 *
 * FOUND BY RUNNING THIS, and worth stating: the equivalent fixture in `./dispatch-lane.test.mjs` is NOT a
 * valid run record — it carries no `v`, `input`, `cursor`, `findings` or `pending`, and its effect rows have
 * no `stepIndex`/`index`. Its hand-written store never notices, because a `read` that returns an object is
 * the whole model. `createFileRunStore().write` refuses it outright, naming all seven problems. That is not a
 * defect in that suite — its subject is the pure guard, not the store — but it does mean the on-disk shape
 * has never been exercised, which is the gap this file closes.
 */
const record = (id, num, status = 'in-flight') => ({
  v: 1,
  id,
  op: 'dispatch-lane',
  input: { num: String(num) },
  cursor: 2,
  findings: {},
  verdict: null,
  effects: [{
    key: `${id}#2#0`,
    stepIndex: 2,
    index: 0,
    type: DISPATCH_EFFECT,
    status,
    handle: `sess-${id}`,
    startedAt: '2026-08-13T09:00:00.000Z',
    expectedBy: '2026-08-13T10:30:00.000Z',
    payload: { num },
  }],
  telemetry: [],
  pending: null,
});

/** A REAL runs directory inside a real checkout — the same sidecar shape `we:.operations/runs/` has. */
async function withRunsDir(fn) {
  return withRealRepo(async (ctx) => {
    const dir = join(ctx.root, '.operations', 'runs');
    mkdirSync(dir, { recursive: true });
    return fn({ ...ctx, dir, store: createFileRunStore(dir) });
  });
}

describe('inFlightDispatchesFor against a real file-backed run store', () => {
  /** The baseline, written and read back through the real store: only THIS item's still-in-flight dispatch
   *  comes back, and the deadline `dispatchStillHolds` ages against rides the row. */
  it('finds this item\'s in-flight dispatch and nothing else', async () => {
    await withRunsDir(async (ctx) => {
      ctx.store.write(record('a', 3037, 'in-flight'));
      ctx.store.write(record('b', '0042', 'in-flight')); // a different item, padded spelling
      ctx.store.write(record('c', 3037, 'applied'));      // settled — no longer in flight

      const out = inFlightDispatchesFor('3037', { store: ctx.store });

      expect(out.runs.map((r) => r.runId)).toEqual(['a']);
      expect(out.runs[0]).toMatchObject({ startedAt: '2026-08-13T09:00:00.000Z', expectedBy: '2026-08-13T10:30:00.000Z' });
      expect(out.unreadable).toBe(0);
    });
  });

  /**
   * ★ THE ASSUMPTION THE STUBBED SUITE CANNOT CHECK. A genuinely TORN record file — the shape a process
   * killed mid-write leaves behind — must make the REAL store throw, so the fail-soft branch runs and the
   * caller is told the guard was partial.
   *
   * The alternative the model hides is not hypothetical: a store that answered `null` here would produce
   * `unreadable: 0` and a `runs` list missing the very dispatch the guard exists to notice — a confident
   * clean answer over an incomplete read, which is how two agents end up in one lane clone racing the same
   * working tree. Both halves are asserted: the good record is still found, AND the bad one is counted.
   */
  it('a genuinely torn record file is COUNTED as unreadable, not silently skipped', async () => {
    await withRunsDir(async (ctx) => {
      ctx.store.write(record('a', 3037, 'in-flight'));
      // A real half-written file: valid-looking JSON that stops mid-object, exactly as a killed writer leaves it.
      writeFileSync(join(ctx.dir, 'torn.json'), '{"op":"dispatch-lane","id":"torn","effects":[{"type":"dis');

      const out = inFlightDispatchesFor('3037', { store: ctx.store });

      expect(out.unreadable).toBe(1);
      expect(out.runs.map((r) => r.runId)).toEqual(['a']);
    });
  });

  /**
   * A file that PARSES but is not a run record is the other half of "unreadable", and it is the one a naive
   * `JSON.parse` in a `try` would wave through: nothing throws, the record shape is simply absent, and the
   * guard reads it as a run with no dispatch effects. Asserted here so "the store refuses it" stays a fact
   * about the store rather than an inference from the torn case above.
   */
  it('a well-formed JSON file that is not a run record is also refused', async () => {
    await withRunsDir(async (ctx) => {
      ctx.store.write(record('a', 3037, 'in-flight'));
      writeFileSync(join(ctx.dir, 'notarun.json'), JSON.stringify({ hello: 'world' }));

      const out = inFlightDispatchesFor('3037', { store: ctx.store });

      expect(out.unreadable).toBe(1);
      expect(out.runs.map((r) => r.runId)).toEqual(['a']);
    });
  });

  /** An empty runs directory is a clean zero, not a crash — the ordinary first-dispatch case, read off a
   *  directory that really exists and really holds nothing. */
  it('an empty runs directory is a clean zero', async () => {
    await withRunsDir(async (ctx) => {
      expect(inFlightDispatchesFor('3037', { store: ctx.store })).toEqual({ runs: [], unreadable: 0 });
    });
  });
});


describe('prepare terminal handoff on disk', () => {
  it('holds unchanged live work without planning, settles once, and recovers after a reader restart', async () => {
    await withRunsDir(async ({ store }) => {
      const run = record('dispatch-lane-original', '4594');
      run.effects[0].payload.launchKind = 'prepare-item';
      store.write(run);
      const runNode = vi.fn(() => { throw new Error('planner reached'); });
      const read = () => readTick({ num: '4594',
        listInFlightDispatches: key => inFlightDispatchesFor(key, { store }),
        listAgents: () => [{ sessionId: run.effects[0].handle }],
        recordLiveness: x => x, now: () => new Date('2026-08-13T09:01:00Z'), runNode,
      });
      for (let i = 0; i < 2; i++) {
        expect(shapeDispatchRead(read(), { num: '4594' })).toMatchObject({ dispatching: false });
      }
      expect(runNode).not.toHaveBeenCalled();
      const terminal = { runId: run.id, key: run.effects[0].key, status: 'applied', result: { outcome: 'prepare-completed' } };
      expect(settleDispatchEffect(terminal, { store })).toEqual({ settled: true });
      expect(settleDispatchEffect(terminal, { store })).toEqual({ settled: false, reason: 'already-applied' });
      // A fresh reader gets eligibility from disk, with no listing/clock cooldown.
      expect(() => read()).toThrow('planner reached');
      expect(runNode).toHaveBeenCalledTimes(1);
      expect(store.read(run.id).effects[0]).toMatchObject({ key: terminal.key, status: 'applied', result: terminal.result });
    });
  });
});


import { beginHealAttempt, bindHealAttempt, finishHealAttempt, observeHealAttempt, publishHealAttempt } from '../probation-heal-run.mjs';
import { observeRun } from '../effect-observer.mjs';
import { recordOwedWrite, clearOwedWrite } from '../../conveyor/ci-heal-owed.mjs';
import { countCiHealComments } from '../../conveyor/ci-heal-mark.mjs';

it('xp0lsdi: recovered heal failure persists a resolved finding, never an executor failure eligible for blind replay', async () => {
  await withRunsDir(async ctx => {
    const dir = join(ctx.root, '.operations', 'heal-attempts'), owedDir = join(ctx.root, '.operations', 'owed');
    const comments = [];
    const attempt = beginHealAttempt({ pr: 3373, headRefOid: 'b98e62d179c5326e64af41809e8b3c1f5ab6d432', sessionSlug: 'ci-heal-3373',
      runId: 'heal-run', effectKey: 'heal-run#2#0' }, { dir, now: () => '2026-10-01T00:00:00Z' });
    bindHealAttempt(attempt.attemptId, 'pid:43273', { dir });
    const run = record('heal-run', 4453);
    Object.assign(run.effects[0], { handle: 'pid:43273', payload: { launchKind: 'ci-heal', pr: 3373, repo: 'we' }, dispatch: { attemptId: attempt.attemptId } });
    ctx.store.write(run);
    const makeObservers = () => createDispatchObservers({ observeHeal: (id, options) => observeHealAttempt(id, { ...options, dir,
      isPidAlive: () => false, settle: (key, terminal) => finishHealAttempt(key, terminal, { dir,
        publish: row => publishHealAttempt(row, {
          readComments: () => comments, post: ({ body }) => comments.push({ body, author: { login: 'web-everything' } }),
          owe: rec => recordOwedWrite(rec, { dir: owedDir }), clear: rec => clearOwedWrite(rec, { dir: owedDir }),
        }),
      }),
    }) });
    const result = await observeRun(ctx.store.read('heal-run'), { observers: makeObservers() });
    expect(result.errors).toEqual([]);
    expect(result.resolved).toEqual([expect.objectContaining({ status: 'resolved', recordedAs: 'applied' })]);
    ctx.store.write(result.run);
    const saved = ctx.store.read('heal-run');
    expect(saved.effects[0]).toMatchObject({ status: 'applied', result: { outcome: 'executor-failed' }, error: expect.stringContaining('unknown') });
    expect((await observeRun(saved, { observers: makeObservers() })).resolved).toEqual([]);
    expect(countCiHealComments(comments)).toBe(1);
    const completion = JSON.parse(readFileSync(join(dir, 'completions', `ci-heal-${attempt.attemptId}.json`), 'utf8'));
    expect(completion).toMatchObject({ status: 'done', outcome: 'executor-failed', sessionId: attempt.attemptId });
  });
});
