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
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { inFlightDispatchesFor } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
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
