/**
 * @file scripts/conveyor/__tests__/poc-branch-sync.test.mjs
 * @description Proof for the #3383 generalized POC-branch ↔ target sync, in three layers (mirrors
 *   `branch-sync.test.mjs`'s own shape, since this module reuses that one's retry/escalate core):
 *
 *   1. The PURE core ({@link safeBranchDirName}, {@link mergeCommitMessage}) — no git, no fs, no lock.
 *   2. The state machine ({@link syncOnePocBranchOnce}) against a FAKE git effect + a fake (always-granted, or
 *      deliberately-refused) lock — proves the lock-skip path, the race-on-push path, and that the SAME
 *      conflict/backoff/escalate behaviour `branch-sync.mjs#runSyncOnce` already proves is preserved here.
 *   3. REAL evidence against a REAL throwaway git fixture — a bare `origin` with two branches (`feature`
 *      standing in for a POC branch, `main` its target) — proving, with NO fakes at all: (a) a clean divergence
 *      merges automatically and the merge actually lands on the REMOTE ref (no working tree, no checkout
 *      anywhere in this process), and (b) a REAL colliding divergence is correctly bounded-retried and then
 *      escalates — never force-merged through.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { safeBranchDirName, mergeCommitMessage, syncOnePocBranchOnce, runPocBranchSync, DEFAULT_LOCK_WAIT_MS } from '../poc-branch-sync.mjs';

// ── 1. the pure core ─────────────────────────────────────────────────────────────────────────────────────────

describe('safeBranchDirName — the pure core', () => {
  it('passes a plain branch name through', () => {
    expect(safeBranchDirName('lane/mechanical-dispatcher')).toBe('lane_mechanical-dispatcher');
  });
  it('never throws on garbage, and never returns empty', () => {
    expect(safeBranchDirName(null)).toBe('unknown');
    expect(safeBranchDirName('')).toBe('unknown');
    expect(safeBranchDirName(undefined)).toBe('unknown');
  });
  it('strips path-unsafe characters', () => {
    expect(safeBranchDirName('a b/../c')).not.toMatch(/[\s/]/);
  });
});

describe('mergeCommitMessage — the pure core', () => {
  it('names both the target and the branch', () => {
    const msg = mergeCommitMessage('lane/mechanical-dispatcher', 'main');
    expect(msg).toContain('lane/mechanical-dispatcher');
    expect(msg).toContain('main');
  });
});

// ── 2. the state machine — fake git, fake lock, real temp-dir fs ───────────────────────────────────────────────

describe('syncOnePocBranchOnce — the state machine (fake git, fake lock)', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'we-poc-branch-sync-unit-')); });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

  const grantedLock = (fn) => ({ result: fn(), ran: true, held: true, contended: false, heldBy: null, reason: null });
  const entry = { branch: 'lane/demo', target: 'main' };

  function fakeRevListCount(args, count) {
    return { ok: true, stdout: `${count}\n`, stderr: '' };
  }

  function makeFakeGit({ conflictText = 'CONFLICT (content): Merge conflict in shared.txt', behind = 5 } = {}) {
    const calls = [];
    let text = conflictText;
    const git = (args) => {
      calls.push(args);
      const cmd = args[0];
      if (cmd === 'fetch') return { ok: true, stdout: '', stderr: '' };
      if (cmd === 'rev-parse') return { ok: true, stdout: args.includes('refs/remotes/origin/lane/demo') ? 'branchtip0000000000000000000000000000000\n' : 'targettip0000000000000000000000000000000\n', stderr: '' };
      if (cmd === 'rev-list') return fakeRevListCount(args, behind);
      if (cmd === 'merge-tree') return { ok: false, stdout: text, stderr: '' };
      throw new Error(`unexpected git call in this fake: ${args.join(' ')}`);
    };
    return { git, calls, setConflictText: (t) => { text = t; } };
  }

  it('a lock the caller could not win THIS TICK is reported as `locked`, never bypassed', () => {
    const refusedLock = (fn, opts) => ({ result: undefined, ran: false, held: false, contended: true, heldBy: 'someone-else', reason: 'contended' });
    const { git, calls } = makeFakeGit();
    const r = syncOnePocBranchOnce({
      entry, cwd: dir, git, now: 1000, withLock: refusedLock, appendLog: () => {},
    });
    expect(r).toMatchObject({ branch: 'lane/demo', status: 'locked', heldBy: 'someone-else' });
    expect(calls).toHaveLength(0); // never even attempted the fetch — the lock gate is BEFORE any git call
  });

  it('passes the SHORT tick-loop wait budget to the lock, never the lease-length spin poc-land.mjs uses', () => {
    const seen = [];
    const capturingLock = (fn, opts) => { seen.push(opts); return grantedLock(fn); };
    const { git } = makeFakeGit({ behind: 0 });
    syncOnePocBranchOnce({ entry, cwd: dir, git, now: 1000, withLock: capturingLock, appendLog: () => {} });
    expect(seen[0]).toMatchObject({ branch: 'lane/demo', waitMs: DEFAULT_LOCK_WAIT_MS });
    expect(seen[0].waitMs).toBeLessThan(60_000); // seconds, not the 20-minute POC_LAND_LEASE_MINUTES budget
  });

  it('nothing behind → fresh, no state written', () => {
    const { git } = makeFakeGit({ behind: 0 });
    const r = syncOnePocBranchOnce({ entry, cwd: dir, git, now: 1000, withLock: grantedLock, appendLog: () => {} });
    expect(r).toMatchObject({ branch: 'lane/demo', status: 'fresh', behind: 0 });
  });

  it('a first conflict records attempt 1, never escalates immediately', () => {
    const { git } = makeFakeGit();
    const notifies = [];
    const r = syncOnePocBranchOnce({
      entry, cwd: dir, git, now: 2000, withLock: grantedLock, notify: (e) => notifies.push(e), appendLog: () => {},
      maxAttempts: 3, backoff: { baseMs: 10, factor: 2, capMs: 100 },
      statePathOverride: undefined,
    });
    expect(r).toMatchObject({ branch: 'lane/demo', status: 'conflict', attempt: 1 });
    expect(notifies).toHaveLength(0);
  });

  it('the bounded-retry-then-escalate lifecycle, reusing branch-sync.mjs\'s own decision core', () => {
    const { git } = makeFakeGit();
    const notifies = [];
    const logLines = [];
    // A distinct cwd per test so each gets its own sidecar dir (`<cwd>/.git/poc-branch-sync/<branch>/…`).
    const cwd = join(dir, 'lifecycle');
    mkdirSync(cwd, { recursive: true });
    const common = {
      entry, cwd, git, withLock: grantedLock, notify: (e) => notifies.push(e), appendLog: (_p, l) => logLines.push(l),
      maxAttempts: 2, backoff: { baseMs: 1, factor: 2, capMs: 5 }, renagMs: 50, driftSweep: () => {},
    };
    let r = syncOnePocBranchOnce({ ...common, now: 1000 });
    expect(r).toMatchObject({ status: 'conflict', attempt: 1 });
    r = syncOnePocBranchOnce({ ...common, now: 1010 });
    expect(r).toMatchObject({ status: 'conflict', attempt: 2 });
    r = syncOnePocBranchOnce({ ...common, now: 1030 }); // attempt(2) >= maxAttempts(2) → escalate
    expect(r).toMatchObject({ status: 'escalated', attempt: 2, alerted: true });
    expect(notifies).toHaveLength(1);
    expect(logLines.some((l) => l.includes('ESCALATED'))).toBe(true);

    r = syncOnePocBranchOnce({ ...common, now: 1031 }); // same conflict, well within renag window
    expect(r).toMatchObject({ status: 'escalated', alerted: false });
    expect(notifies).toHaveLength(1); // not re-notified every tick
  });

  it('a push that races a concurrent update (non-fast-forward rejection) reports `race`, not `error` or `conflict`', () => {
    const calls = [];
    const raceGit = (args) => {
      calls.push(args[0]);
      if (args[0] === 'fetch') return { ok: true, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { ok: true, stdout: 'sometip0000000000000000000000000000000\n', stderr: '' };
      if (args[0] === 'rev-list') return { ok: true, stdout: '3\n', stderr: '' };
      if (args[0] === 'merge-tree') return { ok: true, stdout: 'sometreeoid\n', stderr: '' };
      if (args[0] === 'commit-tree') return { ok: true, stdout: 'newmergesha000000000000000000000000000\n', stderr: '' };
      if (args[0] === 'push') return { ok: false, stdout: '', stderr: '! [rejected]  (non-fast-forward)' };
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    };
    const r = syncOnePocBranchOnce({ entry, cwd: join(dir, 'race2'), git: raceGit, now: 1000, withLock: grantedLock, appendLog: () => {} });
    expect(r).toMatchObject({ branch: 'lane/demo', status: 'race', behind: 3 });
  });

  it('a clean probe builds a merge commit and pushes it — no `--force`, ever', () => {
    const calls = [];
    const cleanGit = (args) => {
      calls.push(args);
      if (args[0] === 'fetch') return { ok: true, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { ok: true, stdout: args.includes('refs/remotes/origin/lane/demo') ? 'branchtip00000000000000000000000000000\n' : 'targettip00000000000000000000000000000\n', stderr: '' };
      if (args[0] === 'rev-list') return { ok: true, stdout: '2\n', stderr: '' };
      if (args[0] === 'merge-tree') return { ok: true, stdout: 'sometreeoid\n', stderr: '' };
      if (args[0] === 'commit-tree') return { ok: true, stdout: 'newmergesha000000000000000000000000000\n', stderr: '' };
      if (args[0] === 'push') return { ok: true, stdout: '', stderr: '' };
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    };
    const r = syncOnePocBranchOnce({ entry, cwd: join(dir, 'clean1'), git: cleanGit, now: 1000, withLock: grantedLock, appendLog: () => {} });
    expect(r).toMatchObject({ branch: 'lane/demo', status: 'synced', sha: 'newmergesha000000000000000000000000000' });
    const pushCall = calls.find((c) => c[0] === 'push');
    expect(pushCall.join(' ')).not.toMatch(/--force|^\+/);
    expect(pushCall).toEqual(['push', 'origin', 'newmergesha000000000000000000000000000:refs/heads/lane/demo']);
  });
});

// ── runPocBranchSync — the per-registry fan-out ─────────────────────────────────────────────────────────────

describe('runPocBranchSync — the #3383 on/off knob gates every branch independently', () => {
  it('a branch with autoSync:false (or undecided, no env) is reported `disabled` and never synced', () => {
    const registry = { branches: [{ branch: 'lane/off', target: 'main', autoSync: false }] };
    const sync = () => { throw new Error('must not be called for a disabled branch'); };
    const results = runPocBranchSync({ registry, env: {}, sync });
    expect(results).toEqual([{ branch: 'lane/off', status: 'disabled' }]);
  });

  it('a branch with autoSync:true is synced, and one branch erroring never stops the rest', () => {
    const registry = { branches: [
      { branch: 'lane/a', target: 'main', autoSync: true },
      { branch: 'lane/b', target: 'main', autoSync: true },
    ] };
    const sync = ({ entry }) => {
      if (entry.branch === 'lane/a') throw new Error('boom');
      return { branch: entry.branch, status: 'fresh' };
    };
    const results = runPocBranchSync({ registry, env: {}, sync });
    expect(results[0]).toMatchObject({ branch: 'lane/a', status: 'error' });
    expect(results[1]).toEqual({ branch: 'lane/b', status: 'fresh' });
  });
});

// ── 3. REAL evidence — a real throwaway git fixture, no fakes, no network ──────────────────────────────────────

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let root;
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'we-poc-branch-sync-real-')); });
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

/** A bare `origin` plus a `main` (target) and `feature` (standing in for a POC branch) branch, seeded exactly
 *  like `branch-sync.test.mjs#buildConflictFixture` — both branches touch `shared.txt` so they collide once
 *  merged. Returns a CLONE checked out on an unrelated third branch (`scratch`) — proving this module needs NO
 *  particular branch checked out to sync `feature` against `main`; it operates entirely on
 *  `refs/remotes/origin/*` plumbing. */
function buildFixture(name, { colliding }) {
  const dir = join(root, name);
  const bare = join(dir, 'origin.git');
  const seed = join(dir, 'seed');
  mkdirSync(bare, { recursive: true });
  git(['init', '-q', '--bare'], bare);
  mkdirSync(seed, { recursive: true });
  git(['init', '-q'], seed);
  git(['config', 'user.email', 'test@example.com'], seed);
  git(['config', 'user.name', 'Test'], seed);
  git(['remote', 'add', 'origin', bare], seed);
  writeFileSync(join(seed, 'shared.txt'), 'base\n');
  git(['add', 'shared.txt'], seed);
  git(['commit', '-q', '-m', 'seed'], seed);
  git(['branch', '-M', 'main'], seed);
  git(['push', '-q', 'origin', 'main'], seed);
  git(['checkout', '-q', '-b', 'feature', 'main'], seed);

  writeFileSync(join(seed, 'f0.txt'), 'f0\n');
  git(['add', 'f0.txt'], seed);
  if (colliding) { writeFileSync(join(seed, 'shared.txt'), 'feature-version\n'); git(['add', 'shared.txt'], seed); }
  git(['commit', '-q', '-m', 'feature: f0'], seed);
  git(['push', '-q', 'origin', 'feature'], seed);

  git(['checkout', '-q', 'main'], seed);
  writeFileSync(join(seed, 'm0.txt'), 'm0\n');
  git(['add', 'm0.txt'], seed);
  if (colliding) { writeFileSync(join(seed, 'shared.txt'), 'main-version\n'); git(['add', 'shared.txt'], seed); }
  git(['commit', '-q', '-m', 'main: m0'], seed);
  git(['push', '-q', 'origin', 'main'], seed);

  // The clone the process under test runs FROM — deliberately on a THIRD, unrelated branch to prove this
  // module never needs `feature` or `main` checked out.
  git(['checkout', '-q', '-b', 'scratch', 'main'], seed);
  git(['push', '-q', 'origin', 'scratch'], seed);
  const clone = join(dir, 'clone');
  git(['clone', '-q', bare, clone]);
  git(['config', 'user.email', 'test@example.com'], clone);
  git(['config', 'user.name', 'Test'], clone);
  git(['checkout', '-q', 'scratch'], clone);
  return { dir, bare, seed, clone };
}

describe('poc-branch-sync.mjs — REAL clean-merge-succeeds proof (no fakes, real remote)', () => {
  it('a clean divergence merges automatically and actually LANDS ON THE REMOTE — never touching the local working tree', async () => {
    const { clone, bare } = buildFixture('clean', { colliding: false });
    const entry = { branch: 'feature', target: 'main' };
    const beforeStatus = git(['status', '--porcelain'], clone).trim();

    const r = syncOnePocBranchOnce({ entry, cwd: clone, now: Date.now(), appendLog: () => {} });

    expect(r).toMatchObject({ branch: 'feature', status: 'synced' });
    expect(r.sha).toMatch(/^[0-9a-f]{40}$/);
    // The working tree of the CLONE (checked out on an unrelated branch, `scratch`) was never touched.
    expect(git(['status', '--porcelain'], clone).trim()).toBe(beforeStatus);
    expect(git(['branch', '--show-current'], clone).trim()).toBe('scratch');
    // The REMOTE `feature` branch (a bare repo — no working tree at all) actually advanced to the merge commit.
    const remoteFeatureTip = git(['rev-parse', 'feature'], bare).trim();
    expect(remoteFeatureTip).toBe(r.sha);
    // The merge commit really does carry both parents (the old feature tip and main's tip) — a genuine merge,
    // not a rewrite.
    const parents = git(['log', '-1', '--format=%P', remoteFeatureTip], bare).trim().split(' ');
    expect(parents).toHaveLength(2);
  });
});

describe('poc-branch-sync.mjs — REAL conflict-escalates proof (no fakes, real remote, never force-merges)', () => {
  it('a real colliding divergence is bounded-retried then escalates — the remote branch is NEVER force-pushed through the conflict', async () => {
    const { clone, bare } = buildFixture('conflict', { colliding: true });
    const entry = { branch: 'feature', target: 'main' };
    const featureTipBefore = git(['rev-parse', 'feature'], bare).trim();
    const notifies = [];
    const common = {
      entry, cwd: clone, appendLog: () => {}, notify: (e) => notifies.push(e),
      maxAttempts: 2, backoff: { baseMs: 1, factor: 2, capMs: 5 },
    };

    const r1 = syncOnePocBranchOnce({ ...common, now: 1000 });
    expect(r1).toMatchObject({ branch: 'feature', status: 'conflict', attempt: 1 });
    // The remote branch has NOT moved — no force-merge, no partial write.
    expect(git(['rev-parse', 'feature'], bare).trim()).toBe(featureTipBefore);

    const r2 = syncOnePocBranchOnce({ ...common, now: 2000 }); // backoff (≤5ms) long elapsed
    expect(r2).toMatchObject({ branch: 'feature', status: 'conflict', attempt: 2 });
    expect(git(['rev-parse', 'feature'], bare).trim()).toBe(featureTipBefore);

    const r3 = syncOnePocBranchOnce({ ...common, now: 3000 }); // attempt(2) >= maxAttempts(2) → escalate
    expect(r3).toMatchObject({ branch: 'feature', status: 'escalated', alerted: true });
    expect(notifies).toHaveLength(1);
    expect(notifies[0].body).toMatch(/feature/);
    // STILL untouched on the remote — escalating never means "force it through anyway".
    expect(git(['rev-parse', 'feature'], bare).trim()).toBe(featureTipBefore);
    const alertPath = join(clone, '.git', 'poc-branch-sync', 'feature', 'alert.json');
    expect(existsSync(alertPath)).toBe(true);
    const alert = JSON.parse(readFileSync(alertPath, 'utf8'));
    expect(alert.signature).toMatch(/^[0-9a-f]{12}$/);

    const r4 = syncOnePocBranchOnce({ ...common, now: 3001 }); // same conflict, well within the default re-nag window
    expect(r4).toMatchObject({ branch: 'feature', status: 'escalated', alerted: false });
    expect(notifies).toHaveLength(1); // not re-notified every tick
  });
});
