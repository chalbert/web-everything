/**
 * @file verify-integration.test.mjs — `verify`'s runner driving the REAL `we:scripts/verify-lane.mjs`.
 *
 * WHY A REAL SPAWN AND A REAL REPO. `we:scripts/operations/verify-io.mjs` exists to map one vocabulary onto
 * another: the home speaks in exit codes and marker statuses, and this maps them to `pass` / `fail` / `unrun`.
 * `./verify.test.mjs` proves the mapping over synthesized `{status, stdout}` objects, which is the right way
 * to reach every branch. What it cannot prove is that the home ever PRODUCES those objects — that the JSON on
 * stdout parses, that exit 3 really means what the mapping assumes, and above all that the marker is keyed to
 * a real HEAD.
 *
 * THAT LAST ONE IS THE POINT. The whole gate is "is there a green verdict FOR THIS COMMIT", and the header
 * says why the wide `unrun` bucket exists: *"a marker for a DIFFERENT commit … is not a verdict about this
 * one."* A commit moving is a git event. A stub's `sha` is a string somebody typed, and a string never stops
 * matching itself — so the one property the whole operation is built around is exactly the one a stub cannot
 * put under test.
 *
 * SECOND GEOMETRY, from the home's own notes: `.git` is a DIRECTORY in a clone and a FILE in a worktree, so
 * the marker is located with `git rev-parse --absolute-git-dir`. #2833 finding 4 records that the hardcoded
 * `join(REPO, '.git', …)` threw `ENOTDIR` in a worktree. A real `git worktree` is the only witness for that,
 * and `withRealRepo` can make one.
 *
 * COST. Each test spawns one or two real `node` processes with a trivial `--gate` (`true` / `false`), never a
 * suite runner. The file measures around a second in total; see the note on `VERIFY_TIMEOUT_MS` below for the
 * one thing that would change that.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { createChecksRunner } from '../verify-io.mjs';
import { DEFAULT_BRANCH, withRealRepo } from './helpers/real-repo.mjs';

/** The REAL runner — `spawn` left at its `spawnSync` default, so `verify-lane.mjs` genuinely executes. */
const runner = createChecksRunner();

/** One check of a checkout, returning the single check record the runner produces. */
const check = (cwd) => runner({ cwd, mode: 'check' }).checks[0];
/** One real verification with a trivial gate. `true` / `false` are the cheapest possible green / red. */
const verify = (cwd, gate) => runner({ cwd, mode: 'run', gate }).checks[0];

describe('verify — the real home, against a real checkout', () => {
  /**
   * NO MARKER IS `unrun`, NOT `fail`. `verify-lane check` exits 2 when its verdict is not ok — the same exit
   * code a RED gate uses — so a mapping that read the exit code alone would report a checkout nobody has
   * verified as a checkout whose suites FAILED. The header calls this out as the whole reason the mapping is
   * positive rather than negative, and only a real spawn shows that exit 2 genuinely arrives here.
   */
  it('a checkout with no marker is `unrun`, even though the home exits 2', async () => {
    await withRealRepo(async (ctx) => {
      const result = check(ctx.root);

      expect(result.outcome).toBe('unrun');
      expect(result.name).toBe('verify-lane:marker');
      expect(result.sha).toBe(ctx.head());
      expect(result.reason).toMatch(/marker status/);
    });
  });

  /** A real green: the home runs the gate, writes the marker, and a subsequent read-only `check` agrees with
   *  it. Two processes, one marker, no shared memory — which is the only way to know the marker round-trips
   *  through the filesystem rather than through a variable. */
  it('a real green verification is visible to a later, separate `check`', async () => {
    await withRealRepo(async (ctx) => {
      const ran = verify(ctx.root, 'true');
      expect(ran.outcome).toBe('pass');
      expect(ran.sha).toBe(ctx.head());

      const later = check(ctx.root);
      expect(later.outcome).toBe('pass');
      expect(later.sha).toBe(ctx.head());
    });
  });

  /**
   * ★ THE ONE A STUB CANNOT HOLD. A green marker, then a NEW COMMIT — and the verdict must fall back to
   * `unrun`, because it is a verdict about a commit that is no longer HEAD. The marker did not change; git
   * did. `pr-land`'s finish-guard is built on exactly this, and a mapping that returned `pass` here would
   * let a lane land on the strength of a verification of some earlier state of itself.
   */
  it('a green marker STOPS counting once HEAD moves', async () => {
    await withRealRepo(async (ctx) => {
      const verified = ctx.head();
      expect(verify(ctx.root, 'true').outcome).toBe('pass');

      ctx.commit({ 'src/new.ts': 'export const n = 1;\n' }, 'feat: a change made after the verification');
      expect(ctx.head()).not.toBe(verified);

      const after = check(ctx.root);
      expect(after.outcome).toBe('unrun');
      expect(after.sha).toBe(ctx.head());
    });
  });

  /** A red gate is a `fail` — an outcome somebody OBSERVED — and it is the only thing in this file that
   *  produces one. Kept next to the `unrun` cases so the boundary between "not verified" and "verified and
   *  broken" is visible in one place. */
  it('a gate that exits non-zero is `fail`, not `unrun`', async () => {
    await withRealRepo(async (ctx) => {
      const result = verify(ctx.root, 'false');

      expect(result.outcome).toBe('fail');
      expect(result.sha).toBe(ctx.head());
      expect(check(ctx.root).outcome).toBe('fail');
    });
  });

  /**
   * ★ THE WORKTREE GEOMETRY (#2833 finding 4). In a `git worktree`, `.git` is a FILE containing a pointer,
   * not a directory — so the marker lives in `<common>/.git/worktrees/<name>/`, which only
   * `git rev-parse --absolute-git-dir` can find. The hardcoded `join(REPO, '.git', …)` threw `ENOTDIR` here.
   *
   * This matters far beyond tidiness: lanes are checkouts, and a verification that cannot locate its own
   * marker in one reports `unrun` forever, so nothing a lane verifies is ever allowed to land.
   */
  it('verifies inside a real `git worktree`, where .git is a FILE', async () => {
    await withRealRepo(async (ctx) => {
      const wt = join(ctx.tmp, 'linked-worktree');
      ctx.git(['worktree', 'add', '--quiet', '-b', 'lane/linked', wt, DEFAULT_BRANCH]);
      // The geometry, asserted rather than assumed: this is a worktree, so `.git` is not a directory.
      expect(ctx.git(['rev-parse', '--absolute-git-dir'], { cwd: wt }).trim()).not.toBe(join(wt, '.git'));

      expect(verify(wt, 'true').outcome).toBe('pass');
      expect(check(wt).outcome).toBe('pass');
      // …and it is the WORKTREE's marker, not the main checkout's — the two are separate verdicts.
      expect(check(ctx.root).outcome).toBe('unrun');
    });
  });

  /**
   * A DIRECTORY THAT IS NOT A CHECKOUT is exit 3 — a usage/git error that writes NO marker — and must land as
   * `unrun`. It is the case that most tempts a `fail`, because something clearly went wrong; but nothing was
   * observed about any suite, and treating it as a red gate would send a person hunting for a broken test.
   */
  it('a directory that is not a git checkout is `unrun`, never `fail`', async () => {
    await withRealRepo(async (ctx) => {
      const notARepo = join(ctx.tmp, 'not-a-repo');
      mkdirSync(notARepo, { recursive: true });

      const result = check(notARepo);

      expect(result.outcome).toBe('unrun');
      expect(result.reason).toMatch(/no-head|could not resolve HEAD|usage\/git error/);
    });
  });
});
