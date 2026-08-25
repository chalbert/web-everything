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
import { readFileSync, writeFileSync } from 'node:fs';
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
   * A RUNNER THAT DIES is the ordinary case, and it must not cost the tree anything either. `runSuite`
   * SWALLOWS the runner's exception by design — a non-zero exit is the normal path for a red suite — so the
   * probe returns rather than throwing, and the restore happens on the happy path.
   *
   * NOTE FOR THE NEXT AUTHOR, learnt the hard way here: an `expect` inside the injected runner is VACUOUS
   * for exactly that reason — `runSuite`'s `catch` eats the AssertionError and the test passes regardless.
   * So the runner only RECORDS what it saw, and the assertion happens out here where it can actually fail.
   */
  it('a runner that dies leaves the tree clean, and the mutant really was on disk while it ran', async () => {
    await withTarget(async (ctx) => {
      const seen = [];
      const probe = createMutationProbe({
        run: (_c, _a, opts) => {
          seen.push(readFileSync(join(opts.cwd, TARGET), 'utf8'));
          if (seen.length === 1) return 'Tests  3 passed (3)\n';
          const e = new Error('the runner was killed');
          e.stdout = '';
          e.stderr = '';
          throw e;
        },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(seen).toEqual([ORIGINAL, ORIGINAL.replace(FIND, REPLACE)]);
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL);
      expect(ctx.porcelain()).toBe('');
      expect(out).toMatchObject({ restored: true, mutantRan: false, mutantGreen: false });
    });
  });

  /**
   * ★ THE FAILURE THE `finally` ACTUALLY EXISTS FOR, and the one case that can prove it is load-bearing.
   *
   * `runSuite` catches everything the RUNNER throws, so a dying runner never reaches the `finally` as an
   * exception — the test above passes with the restore on the happy path. The `finally` earns its keep on
   * the OTHER throw: the mutant WRITE itself tearing part-way (ENOSPC, a killed process between two
   * `write(2)`s), which propagates straight out of the `try`. That is the `python`-heredoc failure the
   * module's header describes: the run dies in between, and the mutant stays in the tree to be diagnosed
   * for an hour as a real bug.
   *
   * Verified: moving the restore out of the `finally` and onto the try's last line leaves this test — and
   * only this test — red, with the torn mutant still on disk.
   */
  it('a torn mutant write still leaves the tree clean — the `finally` is load-bearing', async () => {
    await withTarget(async (ctx) => {
      let writes = 0;
      const probe = createMutationProbe({
        run: () => 'Tests  3 passed (3)\n',
        write: (p, s) => {
          writes += 1;
          if (writes !== 1) { writeFileSync(p, s); return; }
          writeFileSync(p, s.slice(0, 12));            // part of the mutant lands …
          throw new Error('ENOSPC: no space left on device'); // … and then the write dies
        },
      });

      expect(() => probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' }))
        .toThrow(/ENOSPC/);

      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL);
      expect(ctx.porcelain()).toBe('');
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
   * A RESTORE THAT THROWS leaves the tree dirty, and the caller has to be TOLD — a dirty checkout nobody
   * knows about is the hour-long misdiagnosis this whole operation is a correction for.
   *
   * The failure is injected on the `write` seam rather than by chmod, because these suites run as root in CI
   * and a read-only file would not stop the write there — a fixture that only fails on some machines is
   * worse than no fixture. Everything else stays real, so `git status` can be asked what actually happened.
   */
  it('reports restored: false — and the tree really is dirty — when the restoring write throws', async () => {
    await withTarget(async (ctx) => {
      let writes = 0;
      const probe = createMutationProbe({
        run: () => 'Tests  3 passed (3)\n',
        write: (p, s) => { writes += 1; if (writes === 2) throw new Error('disk full'); writeFileSync(p, s); },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(out.restored).toBe(false);
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL.replace(FIND, REPLACE));
      expect(ctx.porcelain()).toBe(`M ${TARGET}`); // porcelain's leading status column, trimmed by the helper
    });
  });

  /**
   * ★ `restored` IS THE RE-READ, NOT THE ATTEMPT — and this is the case that can tell the two apart, because
   * here the restoring write SUCCEEDS and still leaves the wrong bytes. The docblock names exactly this:
   * *"a write that throws OR HALF-SUCCEEDS is precisely when the caller most needs to be told the tree is
   * dirty"*. A throwing write is caught by the `catch`; a half-succeeding one is caught only by reading the
   * file back.
   *
   * Replacing `restored = read(abs) === original` with `restored = true` reddens this and NOTHING else — the
   * throwing case above passes under that mutation, because it never reaches that line.
   */
  it('a restoring write that silently half-succeeds still reports restored: false', async () => {
    await withTarget(async (ctx) => {
      let writes = 0;
      const probe = createMutationProbe({
        run: () => 'Tests  3 passed (3)\n',
        // The RESTORE write returns normally but lands truncated bytes — a torn write, not an exception.
        write: (p, s) => { writes += 1; writeFileSync(p, writes === 2 ? s.slice(0, 10) : s); },
      });

      const out = probe({ cwd: ctx.root, target: TARGET, find: FIND, replace: REPLACE, suite: 'any' });

      expect(out.restored).toBe(false);
      expect(readFileSync(ctx.abs, 'utf8')).toBe(ORIGINAL.slice(0, 10));
      expect(ctx.porcelain()).toBe(`M ${TARGET}`);
    });
  });
});
