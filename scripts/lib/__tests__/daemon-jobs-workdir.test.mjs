/**
 * @file scripts/lib/__tests__/daemon-jobs-workdir.test.mjs
 * @description #4125 — where a job's code comes from: pinned snapshots (`readonly-tree`), own worktrees
 *   (`mutates-tree`), node_modules stores keyed by lockfile hash, and eviction down to 2 unreferenced. Every
 *   test builds a throwaway git repo under `mkdtemp`; nothing touches this checkout's own git state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  createWorkdirs, ensureSnapshot, ensureStore, ensureWorktree, evictUnreferenced, lockfileHash, ownWorktree, releaseWorktree,
  resolveCodeSha,
} from '../daemon-jobs-workdir.mjs';
import { daemonJobPaths } from '../daemon-jobs-io.mjs';
import { newJobRecord, withJob } from '../daemon-jobs.mjs';

const tmp = [];
function mkTmp(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmp.push(d);
  return d;
}
afterEach(() => { for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true }); });

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

/** A repo with a lockfile, one script, and an untracked node_modules holding a fake package. */
function makeRepo() {
  const repo = mkTmp('dj-repo-');
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'package.json'), '{"name":"x","version":"1.0.0"}\n');
  writeFileSync(join(repo, 'package-lock.json'), '{"lockfileVersion":3,"v":1}\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  mkdirSync(join(repo, 'scripts'));
  writeFileSync(join(repo, 'scripts', 'hello.mjs'), 'export const v = 1;\n');
  mkdirSync(join(repo, 'node_modules', 'fake-pkg'), { recursive: true });
  writeFileSync(join(repo, 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 42;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'one');
  return repo;
}

function commit(repo, file, text) {
  writeFileSync(join(repo, file), text);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', file);
  return resolveCodeSha(repo);
}

describe('readonly-tree: pinned code snapshots', () => {
  it('extracts the sha once, links node_modules to a store keyed by the lockfile, and reuses it', () => {
    const repo = makeRepo();
    const sha = resolveCodeSha(repo);
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    const snap = ensureSnapshot({ repoRoot: repo, codeSha: sha, snapshotsDir: paths.snapshots, storesDir: paths.stores });
    expect(snap.dir).toBe(join(paths.snapshots, sha));
    expect(snap.storeKey).toBe(lockfileHash(repo));
    expect(readFileSync(join(snap.dir, 'scripts', 'hello.mjs'), 'utf8')).toContain('v = 1');
    expect(lstatSync(join(snap.dir, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(realpathSync(join(snap.dir, 'node_modules'))).toBe(realpathSync(join(paths.stores, snap.storeKey, 'node_modules')));
    expect(readFileSync(join(snap.dir, 'node_modules', 'fake-pkg', 'index.js'), 'utf8')).toContain('42');

    // The clone moves on; the snapshot does not.
    commit(repo, 'scripts/hello.mjs', 'export const v = 2;\n');
    expect(readFileSync(join(snap.dir, 'scripts', 'hello.mjs'), 'utf8')).toContain('v = 1');

    // Reuse: no git, no copy the second time.
    const calls = [];
    const again = ensureSnapshot({ repoRoot: repo, codeSha: sha, snapshotsDir: paths.snapshots, storesDir: paths.stores, runFn: (...a) => calls.push(a) });
    expect(again).toEqual(snap);
    expect(calls).toEqual([]);
  });

  it('two shas with the same lockfile share one store; a lockfile change gets a new store', () => {
    const repo = makeRepo();
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    const a = ensureSnapshot({ repoRoot: repo, codeSha: resolveCodeSha(repo), snapshotsDir: paths.snapshots, storesDir: paths.stores });
    const b = ensureSnapshot({ repoRoot: repo, codeSha: commit(repo, 'scripts/other.mjs', 'x\n'), snapshotsDir: paths.snapshots, storesDir: paths.stores });
    expect(b.storeKey).toBe(a.storeKey);
    expect(readdirSync(paths.stores)).toEqual([a.storeKey]);
    // The lockfile changes: a new store, keyed by the new hash. The clone's lockfile matches it, so the store
    // is cloned from the clone's node_modules (installing it is the clone rebuild's job) — no npm ci.
    const npmCalls = [];
    const fakeRun = (cmd, args, opts) => {
      if (cmd === 'npm') { npmCalls.push(args); mkdirSync(join(opts.cwd, 'node_modules')); return ''; }
      const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
      if (r.status !== 0) throw new Error(r.stderr);
      return r.stdout.trim();
    };
    const sha3 = commit(repo, 'package-lock.json', '{"lockfileVersion":3,"v":2}\n');
    const c = ensureSnapshot({ repoRoot: repo, codeSha: sha3, snapshotsDir: paths.snapshots, storesDir: paths.stores, runFn: fakeRun });
    expect(c.storeKey).not.toBe(a.storeKey);
    expect(c.storeKey).toBe(lockfileHash(repo));
    expect(readdirSync(paths.stores).sort()).toEqual([a.storeKey, c.storeKey].sort());
    expect(existsSync(join(paths.stores, c.storeKey, 'node_modules', 'fake-pkg'))).toBe(true);
    expect(npmCalls).toEqual([]);
  });

  it('npm ci fills a store when the clone\'s lockfile differs', () => {
    const src = makeRepo();
    const other = mkTmp('dj-lock-');
    writeFileSync(join(other, 'package.json'), '{}\n');
    writeFileSync(join(other, 'package-lock.json'), '{"different":true}\n');
    const stores = mkTmp('dj-stores-');
    const calls = [];
    const nm = ensureStore({
      storesDir: stores, lockHash: lockfileHash(other), sourceRoot: src, lockSourceDir: other,
      runFn: (cmd, args, opts) => { calls.push(cmd); mkdirSync(join(opts.cwd, 'node_modules')); return ''; },
    });
    expect(calls).toEqual(['npm']);
    expect(existsSync(nm)).toBe(true);
    expect(existsSync(join(nm, 'fake-pkg'))).toBe(false);
  });

  it('refuses a missing sha, and leaves no half-built snapshot when the build fails', () => {
    const repo = makeRepo();
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    expect(() => ensureSnapshot({ repoRoot: repo, codeSha: null, snapshotsDir: paths.snapshots, storesDir: paths.stores })).toThrow(/pinned codeSha/);
    expect(() => ensureSnapshot({ repoRoot: repo, codeSha: 'deadbeef', snapshotsDir: paths.snapshots, storesDir: paths.stores })).toThrow(/git/);
    expect(readdirSync(paths.snapshots)).toEqual([]);
  });
});

describe('mutates-tree: the job gets its own worktree, never the clone', () => {
  it('adds a detached worktree at the sha and removes it on release', () => {
    const repo = makeRepo();
    const sha = resolveCodeSha(repo);
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    const wt = ensureWorktree({ repoRoot: repo, codeSha: sha, worktreesDir: paths.worktrees, storesDir: paths.stores, id: 'job-1' });
    expect(wt.dir).toBe(join(paths.worktrees, 'job-1'));
    expect(wt.cloneRoot).toBe(repo);
    expect(resolveCodeSha(wt.dir)).toBe(sha);
    expect(existsSync(join(wt.dir, 'node_modules', 'fake-pkg'))).toBe(true);
    // A retry at a newer sha replaces the stale worktree rather than running old code.
    const sha2 = commit(repo, 'scripts/two.mjs', '2\n');
    const wt2 = ensureWorktree({ repoRoot: repo, codeSha: sha2, worktreesDir: paths.worktrees, storesDir: paths.stores, id: 'job-1' });
    expect(resolveCodeSha(wt2.dir)).toBe(sha2);
    releaseWorktree({ repoRoot: repo, dir: wt2.dir });
    expect(existsSync(wt2.dir)).toBe(false);
    expect(git(repo, 'worktree', 'list')).not.toContain('job-1');
  });
});

describe('terminal cleanup only ever removes the job\'s own worktree', () => {
  it('releaseWorkdir refuses a recorded workdir that is not <worktrees>/<id>, and leaves that directory alone', () => {
    const repo = makeRepo();
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    const victim = mkTmp('dj-victim-');
    writeFileSync(join(victim, 'keep.txt'), 'x');
    const rec = (id, workdir) => withJob(newJobRecord({
      id, kind: 'noop-test', daemon: 't', module: 'm.mjs', codeMode: 'mutates-tree', codeSha: 'abc1234', now: new Date().toISOString(),
    }), { status: 'succeeded', workdir });
    const { releaseWorkdir } = createWorkdirs({ repoRoot: repo, paths });
    expect(() => releaseWorkdir(rec('job-1', victim))).toThrow(/not this job's own worktree/);
    expect(() => releaseWorkdir(rec('job-1', join(paths.worktrees, 'job-2')))).toThrow(/not this job's own worktree/);
    expect(existsSync(join(victim, 'keep.txt'))).toBe(true);
    expect(ownWorktree(paths, rec('job-1', join(paths.worktrees, 'job-1')))).toBe(join(paths.worktrees, 'job-1'));
  });

  it('a worktree is never made from a traversal id', () => {
    const repo = makeRepo();
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    expect(() => ensureWorktree({ repoRoot: repo, codeSha: resolveCodeSha(repo), worktreesDir: paths.worktrees, storesDir: paths.stores, id: '../escape' }))
      .toThrow(/invalid job id/);
  });
});

describe('eviction: unreferenced stores go, at most 2 kept', () => {
  it('evicts the oldest unreferenced snapshots and stores, never a referenced one, and sweeps abandoned temp builds', async () => {
    const paths = daemonJobPaths('t', mkTmp('dj-root-'));
    const mk = (dir, key, ageMs) => {
      mkdirSync(join(dir, key), { recursive: true });
      writeFileSync(join(dir, key, '.complete'), '{}');
      const t = new Date(Date.now() - ageMs);
      spawnSync('touch', ['-t', t.toISOString().replace(/[-:T]/g, '').slice(0, 12), join(dir, key, '.complete')]);
    };
    mk(paths.stores, 'h-old', 4 * 3600e3);
    mk(paths.stores, 'h-mid', 3 * 3600e3);
    mk(paths.stores, 'h-new', 2 * 3600e3);
    mk(paths.stores, 'h-live', 5 * 3600e3);
    mk(paths.snapshots, 'aaaaaaa', 3 * 3600e3);
    mk(paths.snapshots, 'bbbbbbb', 2 * 3600e3);
    mk(paths.snapshots, 'ccccccc', 1 * 3600e3);
    mkdirSync(join(paths.stores, '.tmp-h-x-1-1'));
    const live = withJob(newJobRecord({
      id: 'l', kind: 'noop-test', daemon: 't', module: 'm.mjs', codeMode: 'readonly-tree', codeSha: 'aaaaaaa', now: new Date().toISOString(),
    }), { status: 'running', handle: 'mac:1:x', storeKey: 'h-live' });
    const out = evictUnreferenced({ paths, records: [live], nowMs: Date.now() + 2 * 3600e3 });
    expect(out.stores.sort()).toEqual(['h-mid', 'h-old']);
    expect(readdirSync(paths.stores).sort()).toEqual(['h-live', 'h-new']);
    expect(out.snapshots).toEqual(['bbbbbbb']);
    expect(readdirSync(paths.snapshots).sort()).toEqual(['aaaaaaa', 'ccccccc']);
  });
});
