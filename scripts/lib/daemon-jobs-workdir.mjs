/**
 * @file scripts/lib/daemon-jobs-workdir.mjs
 * @description #4125 (statute `#daemon-jobs`, ruling 4120 Fork 2 (c)) — WHERE A JOB'S CODE COMES FROM.
 *
 * A job's code never changes under it. A kind declares one of two code modes:
 *   - `readonly-tree` — runs from a PINNED CODE SNAPSHOT: `git archive <codeSha>` extracted once per sha into
 *     `<daemon>/snapshots/<sha>/`, shared by every job pinned to that sha. The daemon clone can be rebuilt
 *     under a running job and the job does not notice.
 *   - `mutates-tree` — runs in ITS OWN working tree (`git worktree add --detach` at `codeSha`, normally the
 *     current `main`), never the daemon clone. The child holds the clone's shared (read) hold only while it
 *     runs (`daemon-job-runner.mjs`), because a worktree shares the clone's object database.
 *
 * NODE_MODULES STORES (ratify red-team finding 3). A snapshot or worktree gets `node_modules` as a symlink to
 * `<daemon>/stores/<lockHash>/node_modules`, keyed by the SHA-256 of `package-lock.json` — not by `codeSha`,
 * so the many shas that share a lockfile share one store. A store is filled by cloning the daemon clone's own
 * `node_modules` when the lockfile matches (`cp -c` = APFS clonefile, cheap), else by `npm ci`. A store (or a
 * snapshot) no live job references is evicted, keeping at most `STORE_KEEP` (`planStoreEviction`).
 *
 * Every build goes to a `.tmp-*` sibling and is renamed into place, so a daemon killed mid-build leaves only
 * a temp dir (swept on the next eviction), never a half-built snapshot that looks complete.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { STORE_KEEP, planStoreEviction, referencedStores } from './daemon-jobs.mjs';

const COMPLETE = '.complete';
const TMP_PREFIX = '.tmp-';
/** A temp build dir older than this is an abandoned build, not one in progress. */
const TMP_ABANDONED_MS = 60 * 60_000;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error || r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${(r.error?.message ?? r.stderr ?? '').toString().trim().slice(0, 400)}`);
  }
  return String(r.stdout ?? '').trim();
}

function tmpName(dir, key) {
  return join(dir, `${TMP_PREFIX}${key}-${process.pid}-${Date.now()}`);
}

/** The commit `ref` points at in `repoRoot`. */
export function resolveCodeSha(repoRoot, ref = 'HEAD') {
  return run('git', ['-C', repoRoot, 'rev-parse', '--verify', `${ref}^{commit}`]);
}

/** SHA-256 of `<dir>/package-lock.json` (first 16 hex chars), or `no-lockfile`. */
export function lockfileHash(dir) {
  const p = join(dir, 'package-lock.json');
  if (!existsSync(p)) return 'no-lockfile';
  return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
}

/**
 * Make sure `<storesDir>/<lockHash>/node_modules` exists. Filled from `sourceRoot/node_modules` when that
 * tree's lockfile hashes the same, else by `npm ci` against `lockSourceDir`'s package files.
 * @returns {string} the store's node_modules path
 */
export function ensureStore({ storesDir, lockHash, sourceRoot, lockSourceDir, runFn = run }) {
  const final = join(storesDir, lockHash);
  const nm = join(final, 'node_modules');
  if (existsSync(join(final, COMPLETE))) return nm;
  mkdirSync(storesDir, { recursive: true });
  const tmp = tmpName(storesDir, lockHash);
  mkdirSync(tmp, { recursive: true });
  try {
    const srcNm = sourceRoot ? join(sourceRoot, 'node_modules') : null;
    if (lockHash === 'no-lockfile') {
      mkdirSync(join(tmp, 'node_modules'));
    } else if (srcNm && existsSync(srcNm) && lockfileHash(sourceRoot) === lockHash) {
      const real = realpathSync(srcNm);
      const cloneFlag = process.platform === 'darwin' ? ['-c'] : [];
      try { runFn('cp', [...cloneFlag, '-R', real, join(tmp, 'node_modules')]); } catch {
        rmSync(join(tmp, 'node_modules'), { recursive: true, force: true });
        runFn('cp', ['-R', real, join(tmp, 'node_modules')]);
      }
    } else {
      for (const f of ['package.json', 'package-lock.json']) writeFileSync(join(tmp, f), readFileSync(join(lockSourceDir, f)));
      runFn('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: tmp });
    }
    writeFileSync(join(tmp, COMPLETE), `${JSON.stringify({ lockHash })}\n`);
    try { renameSync(tmp, final); } catch (e) {
      if (!existsSync(join(final, COMPLETE))) throw e; // a concurrent builder won the rename — use theirs
      rmSync(tmp, { recursive: true, force: true });
    }
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  return nm;
}

function linkStore(dir, storeNm) {
  const link = join(dir, 'node_modules');
  rmSync(link, { recursive: true, force: true });
  symlinkSync(storeNm, link, 'dir');
}

/**
 * The pinned snapshot of `codeSha` (built once, then reused). `repoRoot` is the daemon clone.
 * @returns {{dir:string, storeKey:string}}
 */
export function ensureSnapshot({ repoRoot, codeSha, snapshotsDir, storesDir, runFn = run }) {
  if (!/^[0-9a-f]{7,64}$/.test(codeSha ?? '')) throw new Error(`daemon-jobs: a readonly-tree job needs a pinned codeSha, got ${JSON.stringify(codeSha)}`);
  const final = join(snapshotsDir, codeSha);
  if (existsSync(join(final, COMPLETE))) {
    return { dir: final, storeKey: JSON.parse(readFileSync(join(final, COMPLETE), 'utf8')).storeKey };
  }
  mkdirSync(snapshotsDir, { recursive: true });
  const tmp = tmpName(snapshotsDir, codeSha);
  const tar = `${tmp}.tar`;
  mkdirSync(tmp, { recursive: true });
  try {
    try {
      runFn('git', ['-C', repoRoot, 'archive', '--format=tar', `--output=${tar}`, codeSha]);
      runFn('tar', ['-xf', tar, '-C', tmp]);
    } finally { rmSync(tar, { force: true }); }
    const storeKey = lockfileHash(tmp);
    linkStore(tmp, ensureStore({ storesDir, lockHash: storeKey, sourceRoot: repoRoot, lockSourceDir: tmp, runFn }));
    writeFileSync(join(tmp, COMPLETE), `${JSON.stringify({ codeSha, storeKey })}\n`);
    try { renameSync(tmp, final); } catch (e) {
      if (!existsSync(join(final, COMPLETE))) throw e;
      rmSync(tmp, { recursive: true, force: true });
    }
    return { dir: final, storeKey };
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

/**
 * A job's own working tree at `codeSha` — never the daemon clone. A worktree left by an earlier attempt of the
 * same job is reused only when it is still at `codeSha`; otherwise it is replaced.
 * @returns {{dir:string, storeKey:string, cloneRoot:string}}
 */
export function ensureWorktree({ repoRoot, codeSha, worktreesDir, storesDir, id, runFn = run }) {
  if (!/^[0-9a-f]{7,64}$/.test(codeSha ?? '')) throw new Error(`daemon-jobs: a mutates-tree job needs a codeSha, got ${JSON.stringify(codeSha)}`);
  const dir = join(worktreesDir, id);
  mkdirSync(worktreesDir, { recursive: true });
  if (existsSync(dir)) {
    let head = null;
    try { head = runFn('git', ['-C', dir, 'rev-parse', 'HEAD']); } catch { /* not a usable worktree */ }
    if (head !== codeSha) releaseWorktree({ repoRoot, dir, runFn });
  }
  if (!existsSync(dir)) runFn('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, codeSha]);
  const storeKey = lockfileHash(dir);
  linkStore(dir, ensureStore({ storesDir, lockHash: storeKey, sourceRoot: repoRoot, lockSourceDir: dir, runFn }));
  return { dir, storeKey, cloneRoot: repoRoot };
}

/** Remove a job's worktree (and its registration in the clone). */
export function releaseWorktree({ repoRoot, dir, runFn = run }) {
  try { runFn('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir]); } catch { /* not registered */ }
  rmSync(dir, { recursive: true, force: true });
  try { runFn('git', ['-C', repoRoot, 'worktree', 'prune']); } catch { /* best effort */ }
}

/** The finished (`.complete`) entries of a snapshot/store dir, with their mtimes. */
function completedEntries(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && existsSync(join(dir, n, COMPLETE)))
    .map((key) => ({ key, mtimeMs: statSync(join(dir, key, COMPLETE)).mtimeMs }));
}

function sweepAbandonedTmp(dir, nowMs) {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    if (!n.startsWith(TMP_PREFIX)) continue;
    try {
      if (nowMs - statSync(join(dir, n)).mtimeMs > TMP_ABANDONED_MS) rmSync(join(dir, n), { recursive: true, force: true });
    } catch { /* raced another sweeper */ }
  }
}

/**
 * Evict every store and snapshot no live job references, keeping at most `keep` of each.
 * @returns {{stores:string[], snapshots:string[]}} what was evicted
 */
export function evictUnreferenced({ paths, records, keep = STORE_KEEP, nowMs = Date.now() }) {
  const { storeKeys, snapshotKeys } = referencedStores(records);
  const out = { stores: [], snapshots: [] };
  for (const [dir, refs, bucket] of [[paths.snapshots, snapshotKeys, 'snapshots'], [paths.stores, storeKeys, 'stores']]) {
    sweepAbandonedTmp(dir, nowMs);
    const { evict } = planStoreEviction(completedEntries(dir), refs, { keep });
    for (const key of evict) {
      rmSync(join(dir, key), { recursive: true, force: true });
      out[bucket].push(key);
    }
  }
  return out;
}

/**
 * The daemon-side wiring: `prepareWorkdir`/`releaseWorkdir`/`evictStores` for {@link createJobDaemon}.
 * @param {{repoRoot:string, paths:object}} o
 */
export function createWorkdirs({ repoRoot, paths }) {
  return {
    prepareWorkdir: async (record) => (record.job.codeMode === 'mutates-tree'
      ? ensureWorktree({ repoRoot, codeSha: record.job.codeSha, worktreesDir: paths.worktrees, storesDir: paths.stores, id: record.id })
      : ensureSnapshot({ repoRoot, codeSha: record.job.codeSha, snapshotsDir: paths.snapshots, storesDir: paths.stores })),
    releaseWorkdir: (record) => releaseWorktree({ repoRoot, dir: record.job.workdir }),
    evictStores: (records) => evictUnreferenced({ paths, records }),
  };
}
