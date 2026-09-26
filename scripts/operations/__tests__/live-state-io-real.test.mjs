/**
 * @file scripts/operations/__tests__/live-state-io-real.test.mjs
 * @description Card xvz55jf — the #2949 fidelity qualifier: real subprocess/disk/OS proof, separate from the
 *   filesystem-free injected-fakes suite in `live-state-io.test.mjs`. Every OTHER read this operation makes
 *   (daemon-status, heavy-queue, the health watch store, the GitHub App status file) already carries its own
 *   fidelity test in its owning module — this file exercises only the reads `live-state-io.mjs` itself adds:
 *   a real `lane-pool.mjs status --json` subprocess (run from THIS actual checkout against a PRIVATE pool of
 *   real git lane clones for the success path, and against a REAL `withRealRepo` git checkout with no origin
 *   for the failure path — `./helpers/real-repo.mjs`, #3264), a real jsonl file on the real disk of that same
 *   fixture for the drain-history tail, and real `os.loadavg`/`os.cpus`.
 */
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRealRepo } from './helpers/real-repo.mjs';
import { readOneLanePool, readDrainLastPass, readMachineLoad } from '../live-state-io.mjs';

/**
 * `lane-pool.mjs` refuses to resolve the REAL shared lane-pool root from inside a vitest worker
 * (`guardedPoolRoot`, `../../lib/lane-pool-paths.mjs#guardedPoolRoot`, #3383) unless a private
 * `LANE_POOL_ROOT` is passed. The real pool is also host state a CI runner does not have (PR #2736 went red on
 * exactly that: `total` was 0 on the runner), so every test here points the subprocess at a private pool under
 * its own fixture's temp dir — passed ONLY on this subprocess's own env, never globally.
 */
const execWithPool = (poolRoot) => (program, args, opts = {}) => execFileSync(program, args, { ...opts, env: { ...process.env, LANE_POOL_ROOT: poolRoot } });

/** The pool directory name `lane-pool.mjs` derives from this checkout's own origin URL (`web-everything`). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const poolName = () => basename(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()).replace(/\.git$/, '');

it('readOneLanePool runs a REAL lane-pool.mjs status --json subprocess against a real pool of real lane clones', () => (
  withRealRepo(async ({ tmp, root }) => {
    const poolRoot = join(tmp, 'lanes');
    const poolDir = join(poolRoot, poolName());
    mkdirSync(poolDir, { recursive: true });
    for (const n of [1, 2]) execFileSync('git', ['clone', '--quiet', root, join(poolDir, `lane-${n}`)]);
    // lane-2 carries an untracked file — a REAL dirty tree, so the clean/dirty split is proven on git's output.
    writeFileSync(join(poolDir, 'lane-2', 'scratch.txt'), 'dirty\n');
    const out = readOneLanePool('we', { execFn: execWithPool(poolRoot) });
    expect(out).toEqual({ repoKey: 'we', total: 2, free: 1, leased: 0, dirty: 1 });
  })
));

it('readOneLanePool degrades to an error row on a REAL subprocess failure against a REAL git checkout with no origin', () => (
  // `withRealRepo` (`./helpers/real-repo.mjs`, #3264) gives a REAL `git init` checkout with no remote —
  // `lane-pool.mjs status --repo=<path>` genuinely fails here (`resolveRepo()` cannot derive an origin URL),
  // which is a truer proof than a made-up nonexistent path: this is exactly the shape a lane clone whose
  // `origin` was never set would produce.
  withRealRepo(async ({ tmp, root }) => {
    const out = readOneLanePool('nowhere', { execFn: execWithPool(join(tmp, 'lanes')), repoPathArg: root });
    expect(out.error).toBeTruthy();
    expect(out.total).toBe(0);
  })
));

it('readDrainLastPass tails a REAL jsonl file on REAL disk (a real git checkout\'s own working tree, via withRealRepo)', () => (
  withRealRepo(async ({ root }) => {
    const path = join(root, 'history.jsonl');
    writeFileSync(path, `${JSON.stringify({ at: '2026-09-26T15:00:00.000Z', exit: 0, considered: 1, merged: 1 })}\n`
      + `${JSON.stringify({ at: '2026-09-26T15:01:00.000Z', exit: 0, considered: 2, merged: 0 })}\n`);
    const out = readDrainLastPass({ path });
    expect(out.lastPass).toEqual({ at: '2026-09-26T15:01:00.000Z', exit: 0, considered: 2, merged: 0 });
  })
));

it('readDrainLastPass reports {lastPass: null} for a REAL missing path, no fake fs involved', () => (
  withRealRepo(async ({ root }) => {
    expect(readDrainLastPass({ path: join(root, 'no-such-file.jsonl') })).toEqual({ lastPass: null });
  })
));

it('readMachineLoad reads REAL os.loadavg()/os.cpus() — finite, positive numbers on this real host', () => {
  const out = readMachineLoad();
  expect(out.loadavg).toHaveLength(3);
  expect(out.loadavg.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
  expect(out.cores).toBeGreaterThan(0);
});
