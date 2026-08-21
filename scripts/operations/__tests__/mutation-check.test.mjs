/**
 * @file mutation-check.test.mjs — the `mutation-check` declaration (#x4omld5).
 *
 * THE PROPERTY THIS OPERATION EXISTS FOR is that no path reaches `killed` on evidence that does not support
 * it. `killed` is a certification — it says "this guard defends what it claims to" — and every way of
 * reaching it wrongly is a way of certifying a vacuous test. So the bulk of this suite is the four
 * disqualifiers, each asserted to produce `unrun` and NOT `killed`.
 *
 * The operation's own subject matter makes one demand of its tests that is easy to miss: a test here that
 * could pass whether or not the logic works would be an especially poor joke. The `assessMutant` cases are
 * therefore driven by explicit probe fixtures with one field varied at a time, and the io transaction is
 * driven with injected `read`/`write`/`run` recorders so the restore is asserted as an OBSERVED write, not
 * inferred from a return value.
 */
import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import {
  assessMutant, shapeProbeFinding, mutationCheckOperation, MUTATION_CHECK_OP, MUTANT_OUTCOMES,
  MUTATION_PROBE_EFFECT,
} from '../mutation-check.mjs';
import { createMutationProbe, runSuite } from '../mutation-check-io.mjs';

/** A probe result for the HAPPY path — mutant applied, baseline green, mutant red. Vary one field per test. */
const probe = (over = {}) => shapeProbeFinding({
  target: 'src/thing.js',
  suite: 'src/__tests__/thing.test.ts',
  applied: true,
  occurrences: 1,
  baselineRan: true,
  baselineGreen: true,
  mutantRan: true,
  mutantGreen: false,
  killedBy: ['src/__tests__/thing.test.ts > the guard'],
  restored: true,
  detail: '1 failed | 6 passed',
  ...over,
});

describe('the verdict', () => {
  it('KILLED when the suite was green, the mutant applied, and the suite then went red', () => {
    const v = assessMutant(probe());
    expect(v.outcome).toBe('killed');
    expect(v.killed).toBe(true);
    expect(v.blocking).toBe(false);
    // It names WHICH guard caught it, so `killed` is attributable rather than merely asserted.
    expect(v.killedBy).toEqual(['src/__tests__/thing.test.ts > the guard']);
  });

  it('SURVIVED — and blocking — when the suite stayed green with the bug back in', () => {
    const v = assessMutant(probe({ mutantGreen: true }));
    expect(v.outcome).toBe('survived');
    expect(v.killed).toBe(false);
    // THE POINT OF THE OPERATION. A guard that cannot fail is counted as coverage, so it is worse than an
    // absent one; the verdict must say blocking rather than leave the caller to infer it.
    expect(v.blocking).toBe(true);
    expect(v.detail).toMatch(/VACUOUS/);
  });
});

/**
 * THE FOUR DISQUALIFIERS. Each one is a way the hand-rolled version of this procedure reported success
 * without having tested anything, and each must land on `unrun` — never `killed`, and never `survived`
 * either, because "we could not check" is not "we checked".
 */
describe('no path reaches `killed` on evidence that does not support it', () => {
  it('NOT-APPLIED: a `find` that matched nothing is `unrun`, not a killed mutant', () => {
    // The most likely operator error in this whole operation is a typo in `find`. The suite then runs against
    // the ORIGINAL file and reports exactly what it always reported. Reading that as `killed` would certify
    // the guard on a run that never touched the code — the single most dangerous direction to be wrong in.
    const v = assessMutant(probe({ applied: false, occurrences: 0, mutantGreen: false }));
    expect(v.outcome).toBe('unrun');
    expect(v.why).toBe('not-applied');
    expect(v.killed).toBe(false);
    // …and `unrun` BLOCKS. A caller gating on `blocking` must not read "not checked" as "fine".
    expect(v.blocking).toBe(true);
  });

  it('BASELINE-RED: red-before makes red-after meaningless', () => {
    const v = assessMutant(probe({ baselineGreen: false }));
    expect(v.outcome).toBe('unrun');
    expect(v.why).toBe('baseline-red');
  });

  it('SUITE-UNRUN: a runner that could not execute is not a green suite', () => {
    expect(assessMutant(probe({ baselineRan: false })).why).toBe('suite-unrun');
    expect(assessMutant(probe({ mutantRan: false })).why).toBe('suite-unrun');
  });

  it('NOT-RESTORED is checked FIRST, ahead of any result it would accompany', () => {
    // Ordering is the assertion. A run that killed its mutant but failed to put the file back must report the
    // dirty tree, because every later command in that checkout runs against sabotaged source — the caller
    // needs that before it needs the verdict.
    const v = assessMutant(probe({ restored: false }));
    expect(v.outcome).toBe('unrun');
    expect(v.why).toBe('not-restored');
    expect(v.dirty).toBe(true);
    expect(v.detail).toMatch(/still sabotaged/);
  });

  it('every outcome is one of the three declared ones', () => {
    for (const p of [probe(), probe({ mutantGreen: true }), probe({ applied: false }), probe({ restored: false })]) {
      expect(MUTANT_OUTCOMES).toContain(assessMutant(p).outcome);
    }
  });
});

describe('the probe shape is refused rather than guessed at', () => {
  it('refuses a probe that does not report `applied`', () => {
    // Without it, "the pattern matched nothing" and "the mutant was killed" arrive identically.
    const { applied, ...rest } = probe();
    expect(() => shapeProbeFinding(rest)).toThrow(/must report `applied`/);
  });

  it('refuses a non-object result', () => {
    for (const bad of [null, undefined, 'ok', 7]) expect(() => shapeProbeFinding(bad)).toThrow(/result object/);
  });
});

/**
 * THE TRANSACTION. Asserted through injected `read`/`write`/`run` recorders, so "it restored the file" is an
 * observed write of the original bytes rather than a claim the probe makes about itself.
 */
describe('the mutate → run → restore transaction', () => {
  const ORIGINAL = 'const cmp = (a, b) => compareIds(a, b);\n';
  const MUTATED = 'const cmp = (a, b) => Number(a) - Number(b);\n';

  /** A fake tree of one file, plus a suite runner scripted per call. */
  function harness({ file = ORIGINAL, results = [] } = {}) {
    const disk = { 'x/src/thing.js': file };
    const writes = [];
    let call = 0;
    const run = () => {
      const r = results[call++] ?? { out: ' Test Files  1 passed (1)\n      Tests  7 passed (7)\n', fail: false };
      if (r.fail) { const e = new Error('exit 1'); e.stdout = r.out; throw e; }
      return r.out;
    };
    const probeFn = createMutationProbe({
      read: (p) => disk[p],
      write: (p, s) => { disk[p] = s; writes.push(s); },
      run,
    });
    return { probeFn, disk, writes };
  }

  const RED = { out: ' Test Files  1 failed (1)\n      Tests  1 failed | 6 passed (7)\n', fail: true };
  const GREEN = { out: ' Test Files  1 passed (1)\n      Tests  7 passed (7)\n', fail: false };

  it('restores the ORIGINAL bytes, and the file on disk proves it', () => {
    const { probeFn, disk, writes } = harness({ results: [GREEN, RED] });
    const out = probeFn({ cwd: 'x', target: 'src/thing.js', find: 'compareIds(a, b)', replace: 'Number(a) - Number(b)', suite: 's' });

    expect(out.applied).toBe(true);
    expect(out.restored).toBe(true);
    expect(assessMutant(shapeProbeFinding(out)).outcome).toBe('killed');
    // TWO writes: the mutant, then the original back. The file ends as it started.
    expect(writes).toHaveLength(2);
    expect(writes[0]).toBe(MUTATED);
    expect(disk['x/src/thing.js']).toBe(ORIGINAL);
  });

  it('restores even when the suite run THROWS mid-transaction', () => {
    // The `finally` is the whole reason this is an operation rather than a heredoc. A run that dies between
    // mutate and restore used to leave the mutant in the tree, where it gets diagnosed later as a real bug.
    const disk = { 'x/src/thing.js': ORIGINAL };
    let call = 0;
    const probeFn = createMutationProbe({
      read: (p) => disk[p],
      write: (p, s) => { disk[p] = s; },
      run: () => {
        call += 1;
        if (call === 1) return GREEN.out;      // baseline
        throw Object.assign(new Error('runner exploded'), { stdout: '' }); // no summary line at all
      },
    });
    const out = probeFn({ cwd: 'x', target: 'src/thing.js', find: 'compareIds(a, b)', replace: 'Number(a) - Number(b)', suite: 's' });
    expect(disk['x/src/thing.js']).toBe(ORIGINAL); // put back regardless
    expect(out.restored).toBe(true);
    // A runner with no parseable output did not RUN — not a red suite, and so not a killed mutant.
    expect(out.mutantRan).toBe(false);
    expect(assessMutant(shapeProbeFinding(out)).why).toBe('suite-unrun');
  });

  it('never writes at all when the `find` text is absent', () => {
    const { probeFn, disk, writes } = harness();
    const out = probeFn({ cwd: 'x', target: 'src/thing.js', find: 'NOT PRESENT', replace: 'x', suite: 's' });
    expect(out.applied).toBe(false);
    expect(out.occurrences).toBe(0);
    expect(writes).toHaveLength(0);          // the tree was never touched
    expect(disk['x/src/thing.js']).toBe(ORIGINAL);
    expect(assessMutant(shapeProbeFinding(out)).why).toBe('not-applied');
  });

  it('never mutates when the baseline is already red — the cheap discovery comes first', () => {
    const { probeFn, writes } = harness({ results: [RED] });
    const out = probeFn({ cwd: 'x', target: 'src/thing.js', find: 'compareIds(a, b)', replace: 'Number(a) - Number(b)', suite: 's' });
    expect(out.applied).toBe(false);
    expect(writes).toHaveLength(0); // learned it without sabotaging the tree
    expect(assessMutant(shapeProbeFinding(out)).why).toBe('baseline-red');
  });
});

describe('runSuite tells "red" apart from "did not run"', () => {
  it('a suite matching no files did NOT run — it is not a failing suite', () => {
    // vitest exits non-zero here, so an exit-code-only reading would call this red, and a red mutant run
    // reads as a killed mutant. That is the collapse this operation is built to refuse.
    const r = runSuite({
      cwd: 'x',
      suite: 'nope',
      run: () => { throw Object.assign(new Error('exit 1'), { stdout: 'No test files found, exiting with code 1' }); },
    });
    expect(r.ran).toBe(false);
    expect(r.green).toBe(false);
  });

  it('a genuinely failing suite DID run', () => {
    const r = runSuite({
      cwd: 'x',
      suite: 's',
      run: () => { throw Object.assign(new Error('exit 1'), { stdout: '      Tests  1 failed | 6 passed (7)\n' }); },
    });
    expect(r.ran).toBe(true);
    expect(r.green).toBe(false);
  });

  /**
   * NAMES THE GUARD THAT CAUGHT IT — with the streams SPLIT the way vitest actually splits them.
   *
   * THREE WRONG CUTS PRECEDED THIS ONE, and the shape of the mistake is why this comment is long:
   *   1. `killedBy` was asserted from a hand-written fixture that already contained the answer, so it
   *      exercised none of the extraction;
   *   2. the extraction was then "fixed" for ANSI escapes — a guess, and wrong;
   *   3. the test was rewritten with the whole transcript in `stdout`, and PASSED against code that could
   *      never work, because the real defect was `stdout || stderr` SHORT-CIRCUITING.
   *
   * Each cut was shaped to the theory of the moment, so each cut agreed with it. What settled it was
   * printing the captured streams instead of reasoning about them. Hence the split below — summary on
   * stdout, `FAIL` block on stderr, copied from a real run. Merge them into one stream and this test stops
   * defending anything.
   */
  it('extracts failing test names when vitest SPLITS them across stdout and stderr', () => {
    const STDERR = 'Failed Tests 1\n\n'
      + ' FAIL  src/_data/__tests__/backlogGraph.test.ts > backlog dependency graph > the node and edge sorts BOTH use that total order\n'
      + "AssertionError: expected [ 'xb', '10' ] to deeply equal [ '002', '4' ]\n";
    const STDOUT = ' Test Files  1 failed (1)\n      Tests  1 failed | 6 passed (7)\n';
    const r = runSuite({
      cwd: 'x',
      suite: 's',
      run: () => { throw Object.assign(new Error('exit 1'), { stdout: STDOUT, stderr: STDERR }); },
    });
    expect(r.ran).toBe(true);    // the summary line lives on stdout
    expect(r.green).toBe(false);
    // …and the names live on stderr. A `||` between the streams reads the first and loses these entirely.
    expect(r.failures).toContain(
      'src/_data/__tests__/backlogGraph.test.ts > backlog dependency graph > the node and edge sorts BOTH use that total order',
    );
  });
});

describe('the declaration', () => {
  /**
   * THE PROBE IS AN `effect`, NOT A `compute`, AND THAT IS LOAD-BEARING — see its comment in the declaration.
   * `./http-adapter.mjs` derives its route table from step kinds, so a compute-only declaration is classed
   * read-only and served on GET; this one writes to a source file and spawns the test runner, which must not
   * be reachable that way. Asserting the KIND here is what stops a later "simplification" back to `compute`
   * from quietly re-opening that surface.
   */
  it('declares its probe as an EFFECT, so it is never served on the read-only GET surface', () => {
    const decl = mutationCheckOperation();
    const kinds = Object.fromEntries(decl.steps.map((s) => [s.name, s.step.kind]));
    expect(kinds.probe).toBe('effect');
    expect(kinds.assess).toBe('compute');
  });

  it('drives end to end through the engine and yields the verdict', async () => {
    const registry = createRegistry();
    registry.register(mutationCheckOperation());
    const sinks = {
      [MUTATION_PROBE_EFFECT]: async () => ({
        target: 't', suite: 's', applied: true, occurrences: 2,
        baselineRan: true, baselineGreen: true, mutantRan: true, mutantGreen: true, restored: true,
      }),
    };
    let run = advanceWhileRunning(startRun({
      op: MUTATION_CHECK_OP,
      id: 'run-mc',
      input: { checkout: '/x', target: 't', find: 'a', replace: 'b', suite: 's' },
      registry,
    }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));
    run = advanceWhileRunning(run, { registry });
    expect(run.verdict.outcome).toBe('survived');
    expect(run.verdict.blocking).toBe(true);
  });

  it('a failed probe effect yields NO verdict — it does not fall through to one', async () => {
    // An effect that failed leaves no result, and reducing that to `killed` or `survived` would be a verdict
    // about a run that never happened. The engine halts the run at the failed effect rather than advancing
    // to `assess`, so the guard inside `assess` is a backstop and this asserts the behaviour that actually
    // protects the caller: no verdict is produced at all.
    //
    // Written this way after the first cut asserted `assess` would THROW and it did not — the run simply
    // never got there. Asserting the mechanism I assumed, rather than the one that runs, would have been a
    // test that passes for a reason unrelated to its name.
    const registry = createRegistry();
    registry.register(mutationCheckOperation());
    const sinks = { [MUTATION_PROBE_EFFECT]: async () => { throw new Error('probe blew up'); } };
    let run = advanceWhileRunning(startRun({
      op: MUTATION_CHECK_OP, id: 'run-mc2',
      input: { checkout: '/x', target: 't', find: 'a', replace: 'b', suite: 's' },
      registry,
    }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));
    const after = advanceWhileRunning(run, { registry });
    expect(after.verdict ?? null).toBeNull();
    expect(after.effects.some((e) => e.status === 'applied')).toBe(false);
  });
});
