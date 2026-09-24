/**
 * @file scripts/__tests__/lane-pool-acquire-vanished-lane.test.mjs
 * @description Proof of #xixn30q — `acquire` must SKIP a lane whose directory/`.git` disappeared out from
 *   under it (e.g. a race with `trim` deleting it, or any other external removal) rather than crashing the
 *   whole process with an uncaught `ENOENT`. Live-caught: wev-review-daemon session review-2549 (33f5d292,
 *   2026-09-24 13:15 ET) hit exactly this — `tryClaimLane`'s create-or-fail lease write only special-cased
 *   `EEXIST`, so a lane removed between `existingLanes`/`infoFor`'s read and the write's attempt threw ENOENT
 *   uncaught. These tests spawn the real CLI against a throwaway local origin + pool root (no network, no
 *   shared pool) and delete a provisioned lane's `.git` directly (standing in for a concurrent `trim`) to
 *   reproduce the BEFORE crash, then prove the fix: `acquire` skips the vanished lane and claims the next one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runPool(args, extraEnv = {}) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

let base, originDir, referenceDir, poolRoot;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-acquire-vanished-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'main-tip\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'main v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

function provision(count) {
  const r = runPool(
    ['provision', `--count=${count}`, `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=vanishtest', '--branch=main', '--no-install'],
    { LANE_POOL_ROOT: poolRoot },
  );
  expect(r.code).toBe(0);
}

describe('lane-pool acquire vs a vanished lane (#xixn30q)', () => {
  it('BEFORE (regression guard): a lane deleted between the read and the claim used to crash acquire — this proves it no longer does', () => {
    provision(2);
    // Stand in for a concurrent `trim` (or any other external removal) deleting lane-1's `.git` AFTER
    // `existingLanes`/`infoFor` would have seen it as a live, acquirable candidate, but BEFORE `tryClaimLane`'s
    // write. Removing just `.git` (not the whole dir) reproduces the exact ENOENT the live incident hit:
    // `LEASE_MARKER` lives under `<lane>/.git/`, so the parent directory the write needs is gone.
    rmSync(join(poolRoot, 'vanishtest', 'lane-1', '.git'), { recursive: true, force: true });

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=vanishtest', '--branch=main', '--no-install', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );

    // Must not crash (no uncaught exception / nonzero exit from a thrown ENOENT) and must NOT hand back the
    // vanished lane — it should skip straight to lane-2, the only real candidate left.
    expect(r.code).toBe(0);
    expect(r.err).not.toMatch(/ENOENT/);
    const info = JSON.parse(r.out);
    expect(info.lane).toBe(2);
  });

  it('still fails loud (not crashes) when EVERY lane has vanished', () => {
    provision(1);
    rmSync(join(poolRoot, 'vanishtest', 'lane-1', '.git'), { recursive: true, force: true });

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=vanishtest', '--branch=main', '--no-install', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );

    expect(r.code).not.toBe(0);
    expect(r.err).not.toMatch(/ENOENT/); // a clean "no free lane" refusal, never an uncaught throw
    expect(r.err).toMatch(/no free lane/i);
  });
});
