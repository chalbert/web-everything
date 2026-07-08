/**
 * @file scripts/__tests__/lane-pool-refresh-guard.test.mjs
 * @description Proof of the #2267 dirty-or-ahead guard in `scripts/lane-pool.mjs`. `refreshLane()` used to
 *   unconditionally `git reset --hard` + `git clean -fd` every lane on `refresh`/`provision`, silently
 *   destroying a concurrent session's uncommitted edits or locally-committed-but-unpushed work. These tests
 *   spawn the real CLI against a throwaway local origin + reference checkout (no network, no shared pool
 *   root) and assert: a dirty lane is left untouched; an ahead (unpushed-commit) lane is left untouched; a
 *   clean/up-to-date lane still fast-forwards; and `--force` restores the old unconditional reset.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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
  base = mkdtempSync(join(tmpdir(), 'lane-pool-guard-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

function provisionOne() {
  const r = runPool(
    ['provision', '--count=1', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
    { LANE_POOL_ROOT: poolRoot },
  );
  expect(r.code).toBe(0);
  return join(poolRoot, 'guardtest', 'lane-1');
}

describe('lane-pool refresh/provision dirty-or-ahead guard (#2267)', () => {
  it('SKIPS a DIRTY lane (uncommitted edit survives a refresh)', () => {
    const lane = provisionOne();
    writeFileSync(join(lane, 'file.txt'), 'v1\nUNCOMMITTED EDIT\n');

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/SKIPPED \(dirty\/ahead/);
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toContain('UNCOMMITTED EDIT');
  });

  it('SKIPS an AHEAD lane (locally-committed-but-unpushed commit survives a refresh)', () => {
    const lane = provisionOne();
    writeFileSync(join(lane, 'file.txt'), 'v1\nlocal commit\n');
    git(['add', 'file.txt'], lane);
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'unpushed'], lane);
    const headBefore = git(['rev-parse', 'HEAD'], lane);

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/SKIPPED \(dirty\/ahead/);
    expect(git(['rev-parse', 'HEAD'], lane)).toBe(headBefore); // local commit NOT reset away
  });

  it('still refreshes a CLEAN, up-to-date lane normally (no skip)', () => {
    const lane = provisionOne();
    // Push a new commit to origin so the lane is behind (not dirty, not ahead).
    writeFileSync(join(referenceDir, 'file.txt'), 'v2\n');
    git(['add', 'file.txt'], referenceDir);
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v2'], referenceDir);
    git(['push', '--quiet', 'origin', 'main'], referenceDir);

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).not.toMatch(/SKIPPED/);
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('v2\n');
  });

  it('--force restores the unconditional reset, discarding a dirty edit', () => {
    const lane = provisionOne();
    writeFileSync(join(lane, 'file.txt'), 'v1\nUNCOMMITTED EDIT\n');

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install', '--force'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).not.toMatch(/SKIPPED/);
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('v1\n');
  });

  // #2329 — the incident that triggered this verification was purely UNTRACKED work (freshly scaffolded
  // backlog files, never `git add`ed), not a modification of a tracked file. `laneDirtyOrAhead` runs
  // `git status --porcelain` WITHOUT `--untracked-files=no`, so untracked files count (uncommitted > 0) and
  // the un-forced refresh MUST skip. This pins that the un-forced guard genuinely protects untracked-only work.
  it('SKIPS a lane whose ONLY change is UNTRACKED (never git-added) work (#2329)', () => {
    const lane = provisionOne();
    writeFileSync(join(lane, 'scaffolded-untracked.md'), '# not yet added\n');

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/SKIPPED \(dirty\/ahead/);
    expect(readFileSync(join(lane, 'scaffolded-untracked.md'), 'utf8')).toContain('not yet added');
  });

  // #2329 / #2275 — a LIVE lease (what `acquire` stamps) is the primary protection: a non-forced refresh must
  // skip a leased lane BEFORE it even looks at dirty/ahead, so a consumer's untracked work is safe for the
  // lease TTL. Verifies acquire leaves a live lease that refresh honors (candidate root-cause 1 in the item).
  it('SKIPS a LEASED lane on a non-forced refresh, untracked work survives (acquire left a live lease)', () => {
    provisionOne();
    const acq = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install', '--no-reset'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(acq.code).toBe(0);
    const lane = acq.out.trim().split('\n').pop();
    writeFileSync(join(lane, 'untracked-during-lease.txt'), 'consumer work\n');

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/SKIPPED/);
    expect(readFileSync(join(lane, 'untracked-during-lease.txt'), 'utf8')).toContain('consumer work');
  });

  // #2329 — CHARACTERIZATION of the residual data-loss path (the item's open decision): `--force` overrides
  // BOTH the lease skip AND the dirty/ahead skip, so it silently eats a LEASED lane's untracked work. This
  // locks the CURRENT behaviour as the baseline the follow-up policy decision moves against — it is the only
  // path (besides an expired/absent lease) that reproduces the 2026-07-07 loss; the un-forced path is safe.
  it('--force DOES eat a leased lane\'s untracked work (the residual policy gap, characterized)', () => {
    provisionOne();
    const acq = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install', '--no-reset'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(acq.code).toBe(0);
    const lane = acq.out.trim().split('\n').pop();
    writeFileSync(join(lane, 'untracked-eaten.txt'), 'lost on --force\n');

    const r = runPool(
      ['refresh', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install', '--force'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).not.toMatch(/SKIPPED/);
    expect(existsSync(join(lane, 'untracked-eaten.txt'))).toBe(false); // silently discarded — the known gap
  });

  it('provision also honors the guard for an already-existing dirty lane', () => {
    const lane = provisionOne();
    writeFileSync(join(lane, 'file.txt'), 'v1\nUNCOMMITTED EDIT\n');

    const r = runPool(
      ['provision', '--count=1', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=guardtest', '--branch=main', '--no-install'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).toMatch(/SKIPPED \(dirty\/ahead/);
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toContain('UNCOMMITTED EDIT');
  });
});
