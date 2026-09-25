/**
 * @file scripts/__tests__/lane-pool-reclaim.test.mjs
 * @description Proof of #3383 gap 2 (auto-reclaim) — the `reclaim` command in `scripts/lane-pool.mjs`, the
 *   MUTATION half of `lane-whois.mjs`'s read-only `finished-reclaimable` verdict. `reclaim --lane=N` resets ONE
 *   unleased lane to `origin/<branch>`, but only after its OWN re-check (never a caller's, possibly stale,
 *   verdict) proves every uncommitted/ahead change is still provably preserved right now. Real throwaway
 *   origin + reference checkout, private `LANE_POOL_ROOT` — same fixture shape as `lane-whois.test.mjs` and
 *   `lane-pool-trim.test.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const POOL_SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

let base, originDir, referenceDir, poolRoot, env;

function runPool(args) {
  const r = spawnSync('node', [POOL_SCRIPT, ...args], { encoding: 'utf8', cwd: referenceDir, env, timeout: 30_000, killSignal: 'SIGKILL' });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

const poolArgs = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=reclaimpool', '--branch=main', '--no-install'];
const lanePath = (n) => join(poolRoot, 'reclaimpool', `lane-${n}`);
const leaseMarker = (n) => join(lanePath(n), '.git', '.lane-lease');

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-reclaim-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');
  env = { ...process.env, LANE_POOL_ROOT: poolRoot, HOME: base };

  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);

  expect(runPool(['provision', '--count=3', ...poolArgs()]).code).toBe(0);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('lane-pool reclaim — BEFORE (the gap)', () => {
  it('a plain `release` frees the LEASE but never resets ahead/dirty content back to origin', () => {
    expect(runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    writeFileSync(join(lanePath(1), 'orphan.txt'), 'never pushed\n');
    expect(runPool(['release', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    // (documented, not the fix under test — `lane-pool.mjs` had no `reclaim` verb at all before this item; a
    // finished-but-dirty lane just sat there unusable until a human ran `git reset --hard` by hand.)
    expect(existsSync(join(lanePath(1), 'orphan.txt'))).toBe(true);
  });
});

describe('lane-pool reclaim — AFTER', () => {
  it('refuses a LIVE-leased lane outright, regardless of content', () => {
    expect(runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    const r = runPool(['reclaim', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/held/i);
    expect(existsSync(leaseMarker(1))).toBe(true); // untouched — never cleared a live hold
  });

  it('a clean, unleased lane (nothing to lose) is reclaimed — a no-op reset, lease marker cleared', () => {
    const r = runPool(['reclaim', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.reclaimed).toBe(true);
    expect(report.preserved).toBe(true);
    expect(existsSync(leaseMarker(1))).toBe(false);
  });

  it('dry-run NEVER writes a claim or resets — reports wouldReclaim with the same preservation proof', () => {
    expect(runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    expect(runPool(['release', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    const before = readFileSync(join(lanePath(1), 'file.txt'), 'utf8');
    const r = runPool(['reclaim', '--lane=1', '--dry-run', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.wouldReclaim).toBe(true);
    expect(report.reclaimed).toBe(false);
    expect(existsSync(leaseMarker(1))).toBe(false); // dry-run never even claims
    expect(readFileSync(join(lanePath(1), 'file.txt'), 'utf8')).toBe(before); // untouched
  });

  it('uncommitted content NOT provably preserved anywhere refuses the reclaim — never destroyed', () => {
    expect(runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    writeFileSync(join(lanePath(1), 'orphan.txt'), 'never pushed anywhere\n');
    expect(runPool(['release', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);

    const r = runPool(['reclaim', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0); // a refusal is a normal, successful report — never a crash
    const report = JSON.parse(r.out);
    expect(report.reclaimed).toBe(false);
    expect(report.preserved).toBe(false);
    expect(report.unpreservedFiles).toEqual(['orphan.txt']);
    expect(existsSync(join(lanePath(1), 'orphan.txt'))).toBe(true); // never destroyed
  });

  it('an ahead commit pushed to its own lane/* ref is provably preserved — reclaimed, reset to origin', () => {
    expect(runPool(['acquire', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);
    const dir = lanePath(1);
    writeFileSync(join(dir, 'work.txt'), 'landed via PR\n');
    git(['add', 'work.txt'], dir);
    git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'land work'], dir);
    git(['push', '--quiet', 'origin', 'HEAD:refs/heads/lane/9000-test'], dir);
    expect(runPool(['release', '--lane=1', '--session=s', ...poolArgs()]).code).toBe(0);

    const r = runPool(['reclaim', '--lane=1', '--json', ...poolArgs()]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.reclaimed).toBe(true);
    expect(report.preserved).toBe(true);
    expect(existsSync(join(dir, 'work.txt'))).toBe(false); // reset away — its content lives on lane/9000-test
    expect(existsSync(leaseMarker(1))).toBe(false);
    expect(git(['rev-parse', 'HEAD'], dir)).toBe(git(['rev-parse', 'origin/main'], dir));
  });

  it('reclaim never scans a whole pool — it always needs an explicit --lane', () => {
    const r = runPool(['reclaim', '--json', ...poolArgs()]);
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/--lane/);
  });
});
