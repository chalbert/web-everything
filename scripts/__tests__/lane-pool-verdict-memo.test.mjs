/**
 * @file scripts/__tests__/lane-pool-verdict-memo.test.mjs
 * @description `lane-pool list --acquirable` must not re-prove, on every scan, that an UNLEASED lane holding work
 *   is not acquirable. Live 2026-09-26 22:37Z (load ~25, 133 lanes): the daemon smoke's `list --acquirable
 *   --no-cache --limit=1` overran its 120s budget at lane-47 because lanes 1..46 were unleased-with-work and each
 *   paid the full dirty/ahead proof (status ×2, rev-list, cherry, diff-tree | patch-id) again. The scan now
 *   memoizes NEGATIVE verdicts under a stat-only fingerprint. Real CLI, throwaway origin + pool, a PATH `git` shim
 *   that logs each call's cwd (same harness as lane-pool-list-cache.test.mjs).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, chmodSync, realpathSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-pool.mjs');
const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

let base, originDir, referenceDir, poolRoot, shimDir, traceLog;
const REPO = () => [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=memotest', '--branch=main', '--no-install', '--no-reap'];
const pool = () => join(poolRoot, 'memotest');
const lanePath = (n) => join(pool(), `lane-${n}`);
const MEMO = () => join(pool(), '.acquirable-verdict-memo.json');
const env = () => ({ ...process.env, LANE_POOL_ROOT: poolRoot, PATH: `${shimDir}:${process.env.PATH}`, GIT_TRACE_LOG: traceLog });
function runPool(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: env() });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
function list(extra = []) {
  const r = runPool(['list', '--acquirable', '--no-cache', '--json', ...REPO(), ...extra]);
  expect(r.code, r.err).toBe(0);
  return JSON.parse(r.out).map((p) => Number(basename(p).slice(5))).sort((a, b) => a - b);
}
const resetTrace = () => rmSync(traceLog, { force: true });
const gitCallsIn = (n) => {
  if (!existsSync(traceLog)) return [];
  const dir = realpathSync(lanePath(n));
  return readFileSync(traceLog, 'utf8').split('\n').filter(Boolean)
    .map((l) => l.split('\t')).filter(([cwd]) => cwd === dir || cwd.startsWith(`${dir}/`));
};
const dirty = (n) => writeFileSync(join(lanePath(n), 'file.txt'), 'v1\nUNCOMMITTED\n');
const commitAhead = (n) => {
  writeFileSync(join(lanePath(n), 'ahead.txt'), 'local only\n');
  git(['add', 'ahead.txt'], lanePath(n));
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'unpushed'], lanePath(n));
};

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-pool-memo-'));
  originDir = join(base, 'origin.git');
  referenceDir = join(base, 'reference');
  poolRoot = join(base, 'pool');
  shimDir = join(base, 'shim');
  traceLog = join(base, 'git-trace.log');
  mkdirSync(shimDir);
  writeFileSync(join(shimDir, 'git'), `#!/bin/sh\nprintf '%s\\t%s\\n' "$(pwd -P)" "$*" >> "$GIT_TRACE_LOG"\nexec "${REAL_GIT}" "$@"\n`);
  chmodSync(join(shimDir, 'git'), 0o755);
  git(['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
  git(['clone', '--quiet', originDir, referenceDir]);
  writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], referenceDir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], referenceDir);
  git(['push', '--quiet', 'origin', 'main'], referenceDir);
  expect(runPool(['provision', '--count=3', ...REPO()]).code).toBe(0);
});

afterEach(() => { rmSync(base, { recursive: true, force: true }); });

describe('list --acquirable: an unleased lane holding work is proven once, not on every scan', () => {
  it('a DIRTY lane: the second scan runs no git in it and still excludes it', () => {
    dirty(1);
    expect(list()).toEqual([2, 3]);
    expect(existsSync(MEMO())).toBe(true);
    resetTrace();
    expect(list()).toEqual([2, 3]);
    expect(gitCallsIn(1)).toEqual([]);
    expect(gitCallsIn(2).length).toBeGreaterThan(0); // clean lanes are still probed every time
  });

  it('an AHEAD (unpushed commit) lane: the second scan runs no git in it (no cherry / patch-id / ls-remote)', () => {
    commitAhead(1);
    expect(list()).toEqual([2, 3]);
    resetTrace();
    expect(list()).toEqual([2, 3]);
    expect(gitCallsIn(1)).toEqual([]);
  });

  it('--limit=1 reaches the first free lane without re-proving the held ones before it', () => {
    dirty(1);
    commitAhead(2);
    expect(list(['--limit=1'])).toEqual([3]);
    resetTrace();
    expect(list(['--limit=1'])).toEqual([3]);
    expect([...gitCallsIn(1), ...gitCallsIn(2)]).toEqual([]);
  });

  it('a git state change (reset clears the work) invalidates the entry — the lane is acquirable again', () => {
    dirty(1);
    commitAhead(2);
    expect(list()).toEqual([3]);
    git(['reset', '--hard', '--quiet', 'origin/main'], lanePath(1));
    git(['reset', '--hard', '--quiet', 'origin/main'], lanePath(2));
    expect(list()).toEqual([1, 2, 3]);
  });

  it('never memoizes a POSITIVE verdict: a clean lane dirtied later is seen on the next scan', () => {
    expect(list()).toEqual([1, 2, 3]);
    dirty(2);
    expect(list()).toEqual([1, 3]);
  });

  it('an expired entry (max age) is re-proven; --no-verdict-memo bypasses and writes nothing', () => {
    dirty(1);
    list();
    resetTrace();
    list(['--verdict-memo-max-age-ms=1']);
    expect(gitCallsIn(1).length).toBeGreaterThan(0);
    rmSync(MEMO(), { force: true });
    list(['--no-verdict-memo']);
    expect(existsSync(MEMO())).toBe(false);
  });

  it('refresh/provision drop the memo with the list cache', () => {
    dirty(1);
    list();
    expect(existsSync(MEMO())).toBe(true);
    expect(runPool(['refresh', ...REPO(), '--force']).code).toBe(0);
    expect(existsSync(MEMO())).toBe(false);
    expect(list()).toEqual([1, 2, 3]);
  });
});
