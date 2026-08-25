/**
 * @file mutation-check-integration.test.mjs — the sabotage transaction against a REAL working tree.
 *
 * WHY A REAL TREE. `we:scripts/operations/mutation-check-io.mjs` deliberately writes a broken version of a
 * source file, runs a suite against it, and puts the bytes back. Its header says what is actually at stake:
 *
 *   *"The hand-rolled version of this procedure was a `python` heredoc that copied to `/tmp` and copied back
 *   on the last line — a run that died in between … left the mutant in the tree, which is exactly the kind of
 *   failure that then gets diagnosed for an hour as a real bug."*
 *
 * `./mutation-check.test.mjs` drives this with `read`/`write` injected as in-memory maps, which proves the
 * ORDER of the calls. It cannot prove the OUTCOME, because the outcome is a question about a filesystem: is
 * the developer's checkout clean afterwards? Here `read` and `write` are left at their `fs` defaults and the
 * answer is read out of a real `git status --porcelain`, which is how a person would actually notice.
 *
 * WHAT IS STILL INJECTED, and why that is not a cheat. `run` is the suite runner, and running a REAL vitest
 * inside a test would cost minutes per case for no added truth — the property under test is the FILE
 * TRANSACTION, not vitest. So `run` is a fake, and every fake here ASSERTS THE STATE OF THE REAL FILE at the
 * moment it is called: that is the seam where "did the mutant actually reach disk" becomes checkable, and an
 * in-memory `write` cannot answer it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createMutationProbe } from '../mutation-check-io.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

const TARGET = 'src/guard.mjs';
const ORIGINAL = 'export function guard(n) {\n  return n > 0;\n}\n';
const FIND = 'n > 0';
const REPLACE = 'true';

/** A runner that reports a green suite, and records what the file looked like while it ran. */
function greenRunner(seen) {
  return (_cmd, _args, opts) => {
    seen.push(readFileSync(join(opts.cwd, TARGET), 'utf8'));
    return 'Test Files  1 passed (1)\nTests  3 passed (3)\n';
  };
}

/** Set up a real checkout with the target committed, so `git status` has a baseline to compare against. */
async function withTarget(fn) {
  return withRealRepo(async (ctx) => {
    ctx.commit({ [TARGET]: ORIGINAL }, 'feat: the file under mutation');
    const abs = join(ctx.root, TARGET);
    const porcelain = () => ctx.git(['status', '--porcelain']).trim();
    expect(porcelain()).toBe('');
    return fn({ ...ctx, abs, porcelain });
  });
}

describe('the mutate → run → restore transaction on a real checkout', () => {
  /**
   * THE MUTANT REALLY REACHES DISK, and the file really comes back. Both halves matter and only one of them
   * is obvious: a transaction that never wrote the mutant would also leave the tree clean, and would report
   * a "surviving mutant" for a mutation that was never applied — certifying a guard that was never tested.
   */
  it('writes the mutant for the run and restores the exact original bytes afterwards', async () => {
    await withTarget(async (ctx) => {
      const seen = [];
      const probe = createMutationProbe({ run: greenRunner(seen) });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      // Two runs: the baseline on the untouched file, then the mutant.
      expect(seen).toEqual([ORIGINAL, ORIGINAL.replace(FIND, REPLACE)]);
      expect(out).toMatchObject({ applied: true, occurrences: 1, baselineGreen: true, restored: true });
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL);
      expect(ctx.porcelain()).toBe('');
    });
  });

  /**
   * ★ THE FAILURE THE `finally` EXISTS FOR, made real. The runner THROWS while the mutant is on disk — the
   * stand-in for the killed process / container restart the header describes. The tree must still come back
   * clean, and `git status` is the witness a person would actually use.
   *
   * Moving the restore out of the `finally` and onto the try's happy path reddens this and nothing else.
   */
  it('restores the tree even when the runner throws mid-transaction', async () => {
    await withTarget(async (ctx) => {
      let calls = 0;
      const probe = createMutationProbe({
        run: (_c, _a, opts) => {
          calls += 1;
          if (calls === 1) return 'Tests  3 passed (3)\n';
          // The mutant is on disk RIGHT NOW — assert it, then die the way a killed runner dies.
          expect(readFileSync(join(opts.cwd, TARGET), 'utf8')).toBe(ORIGINAL.replace(FIND, REPLACE));
          const e = new Error('the runner was killed');
          e.stdout = '';
          e.stderr = '';
          throw e;
        },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL);
      expect(ctx.porcelain()).toBe('');
      expect(out.restored).toBe(true);
    });
  });

  /**
   * A RED BASELINE MUST NOT COST THE TREE ANYTHING. The baseline runs BEFORE the write precisely so
   * "we sabotaged your checkout to learn something we could have learned first" cannot happen — and the only
   * way to check that is to look at the checkout.
   *
   * Moving the baseline run to after the write reddens this: the file is dirty at the point the probe
   * returns `applied: false`.
   */
  it('a red baseline leaves the file untouched — nothing is ever written', async () => {
    await withTarget(async (ctx) => {
      const probe = createMutationProbe({
        run: () => { const e = new Error('red'); e.stdout = 'Tests  1 failed | 2 passed (3)\n'; e.stderr = ''; throw e; },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(out).toMatchObject({ applied: false, baselineRan: true, baselineGreen: false, restored: true });
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL);
      expect(ctx.porcelain()).toBe('');
    });
  });

  /** `find` text that is not present is `applied: false` with NOTHING run and nothing written — a probe that
   *  wrote an identical file would still dirty nothing, but it would also run the suite twice for no reason
   *  and report an occurrence count it did not have. */
  it('a `find` that matches nothing runs no suite and writes no bytes', async () => {
    await withTarget(async (ctx) => {
      let ran = 0;
      const probe = createMutationProbe({ run: () => { ran += 1; return 'Tests  3 passed (3)\n'; } });

      const out = probe({ cwd: ctx.root, target: TARGET, find: 'NOT IN THE FILE', replace: 'x', suite: 'any' });

      expect(ran).toBe(0);
      expect(out).toMatchObject({ applied: false, occurrences: 0, restored: true });
      expect(ctx.porcelain()).toBe('');
    });
  });

  /**
   * EVERY OCCURRENCE IS MUTATED, and the count is the real one. `original.split(find).join(replace)` replaces
   * all of them where a `String.replace` with a string pattern replaces only the first — a difference that is
   * invisible in an in-memory fixture with one occurrence and decides whether a mutant is actually a mutant.
   */
  it('mutates every occurrence, and restores every one of them', async () => {
    await withTarget(async (ctx) => {
      const many = 'a n > 0; b n > 0; c n > 0;\n';
      ctx.commit({ [TARGET]: many }, 'chore: three occurrences');
      const seen = [];
      const probe = createMutationProbe({ run: greenRunner(seen) });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(out.occurrences).toBe(3);
      expect(seen[1]).toBe('a true; b true; c true;\n');
      expect(readFileSync(ctx.abs, 'utf8')).toBe(many);
      expect(ctx.porcelain()).toBe('');
    });
  });

  /**
   * `restored` IS THE RE-READ, NOT THE ATTEMPT. Here the restoring write is made to fail, so the tree really
   * is left dirty — and the caller has to be TOLD, because a dirty checkout the caller does not know about is
   * the hour-long misdiagnosis this whole operation is a correction for.
   *
   * The failure is injected on the `write` seam rather than by chmod, because these suites run as root in CI
   * and a read-only file would not stop the write there — a fixture that only fails on some machines is worse
   * than no fixture.
   */
  it('reports restored: false — and the tree really is dirty — when the restoring write fails', async () => {
    await withTarget(async (ctx) => {
      const { writeFileSync } = await import('node:fs');
      let writes = 0;
      const probe = createMutationProbe({
        run: () => 'Tests  3 passed (3)\n',
        write: (p, s) => {
          writes += 1;
          if (writes === 2) throw new Error('disk full'); // the RESTORE write
          writeFileSync(p, s);
        },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(out.restored).toBe(false);
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL.replace(FIND, REPLACE));
      expect(ctx.porcelain()).toBe(`M ${TARGET}`); // porcelain's leading status column, trimmed by the helper
    });
  });
});
