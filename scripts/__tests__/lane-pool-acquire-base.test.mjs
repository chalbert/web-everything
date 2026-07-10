/**
 * @file scripts/__tests__/lane-pool-acquire-base.test.mjs
 * @description Proof of #2386 — `acquire --base=<ref>` lands the leased clone at a PREDECESSOR LANE'S TIP
 *   (an arbitrary ref, typically another lane's pushed `lane/*` branch) instead of `origin/<branch>`. This is
 *   the building block for overlap-stacked serial batches: a later lane's work can build on an earlier lane's
 *   not-yet-merged commits. Still a pool clone — the reset happens INSIDE the leased lane's own clone, same as
 *   the default path it replaces; the primary checkout is never touched (#2219/#104). These tests spawn the
 *   real CLI against a throwaway local origin + reference checkout (no network, no shared pool root) and
 *   assert: `--base=<ref>` (a bare branch name resolved via `origin/<ref>`) lands the clone at that ref's tip,
 *   content and all; a `--base` ref that isn't on origin hard-fails loud, touching nothing; and plain
 *   `acquire` (no `--base`) keeps landing on `origin/<branch>`, unchanged.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
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
  base = mkdtempSync(join(tmpdir(), 'lane-pool-acquire-base-'));
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
    ['provision', `--count=${count}`, `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install'],
    { LANE_POOL_ROOT: poolRoot },
  );
  expect(r.code).toBe(0);
}

// Simulate a predecessor lane: commit + push a `lane/*` branch to origin, distinct from `main`'s tip.
function pushPredecessorLaneRef(refName, fileContents) {
  const scratch = join(base, 'predecessor-scratch');
  git(['clone', '--quiet', originDir, scratch]);
  writeFileSync(join(scratch, 'file.txt'), fileContents);
  git(['add', 'file.txt'], scratch);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'predecessor lane tip'], scratch);
  git(['push', '--quiet', 'origin', `HEAD:refs/heads/${refName}`], scratch);
  return git(['rev-parse', 'HEAD'], scratch);
}

describe('lane-pool acquire --base=<ref> (#2386)', () => {
  it('lands the clone at the predecessor lane ref\'s tip, not origin/main', () => {
    provision(2);
    const predecessorSha = pushPredecessorLaneRef('lane/predecessor-42', 'predecessor-tip\n');

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--base=lane/predecessor-42', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    const info = JSON.parse(r.out);
    expect(info.base).toBe('lane/predecessor-42');
    const lane = info.path;

    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('predecessor-tip\n');
    expect(git(['rev-parse', 'HEAD'], lane)).toBe(predecessorSha);
  });

  it('also resolves a fully-qualified origin/<ref> the same way', () => {
    provision(2);
    pushPredecessorLaneRef('lane/predecessor-fq', 'fq-tip\n');

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--base=origin/lane/predecessor-fq', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    const lane = JSON.parse(r.out).path;
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('fq-tip\n');
  });

  it('hard-fails loud on a --base ref that does not exist on origin, touching nothing', () => {
    const lane = join(poolRoot, 'basetest', 'lane-1');
    provision(1);

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--base=lane/does-not-exist'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/--base=lane\/does-not-exist/);
    expect(r.err).toMatch(/does not resolve/);
    // The reset never ran — the lane's working tree is exactly as `provision` left it.
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('main-tip\n');

    // The failed acquire's lease claim (taken BEFORE ref resolution) is the same "leaves a lease behind on a
    // failed ready-phase step" behavior any acquire has always had (e.g. a `git fetch` failure) — release
    // --force is the documented escape hatch (#2337b), after which the lane is normally acquirable again.
    const rel = runPool(
      ['release', '--lane=1', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--force'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(rel.code).toBe(0);
    const retry = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(retry.code).toBe(0);
  });

  it('absent --base preserves current origin/<branch> behavior (unchanged)', () => {
    provision(1);
    pushPredecessorLaneRef('lane/irrelevant', 'should-not-be-used\n');

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    const info = JSON.parse(r.out);
    expect(info.base).toBeNull();
    expect(readFileSync(join(info.path, 'file.txt'), 'utf8')).toBe('main-tip\n');
  });

  // Regression: `--base=<branch-name>` MUST resolve via the freshly-fetched `origin/<ref>`, never via a
  // same-named LOCAL ref left over in the lane's own clone from a prior reset — `fetch` only updates
  // remote-tracking refs, so a same-named local branch (most obviously `main` itself) silently goes stale.
  // Caught live pre-fix: `--base=main` after `origin/main` advanced past the lane's last reset returned the
  // OLD content with no error, because the bare ref was tried (and resolved) before `origin/<ref>`.
  it('--base=main resolves via the freshly-fetched origin/main, not this lane\'s own stale local main', () => {
    provision(1);
    // First acquire lands the lane's local `main` at the CURRENT origin/main tip ("main-tip") — this is what a
    // same-named local ref would still point at below, if the resolver preferred it over `origin/main`.
    const first = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(first.code).toBe(0);
    const lane = JSON.parse(first.out).path;
    runPool(['release', '--lane=1', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main'], { LANE_POOL_ROOT: poolRoot });

    // Advance origin/main past the lane's last-seen tip.
    writeFileSync(join(referenceDir, 'file.txt'), 'main-advanced\n');
    git(['add', 'file.txt'], referenceDir);
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'main v2'], referenceDir);
    git(['push', '--quiet', 'origin', 'main'], referenceDir);

    const r = runPool(
      ['acquire', `--origin=${originDir}`, `--reference=${referenceDir}`, '--name=basetest', '--branch=main', '--no-install', '--base=main', '--json'],
      { LANE_POOL_ROOT: poolRoot },
    );
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).path).toBe(lane);
    expect(readFileSync(join(lane, 'file.txt'), 'utf8')).toBe('main-advanced\n'); // NOT the stale 'main-tip'
  });
});
