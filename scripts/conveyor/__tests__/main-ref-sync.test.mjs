/**
 * @file scripts/conveyor/__tests__/main-ref-sync.test.mjs
 * @description Proof for `we:scripts/conveyor/main-ref-sync.mjs` (epic #3383) — the pass that keeps a
 *   checkout's LOCAL `main` ref fast-forwarded to `origin/main`, closing the real gap found 2026-09-14:
 *   `assertMainNotStale` (`we:scripts/operations/review-dispatch.mjs`) refuses BOTH fix and review dispatch
 *   whenever local `main` is behind `origin/main`, and nothing kept it fresh on a checkout whose own work
 *   happens on a different branch.
 *
 *   1. The PURE core ({@link shouldSyncMainRef}) on injected values — no git.
 *   2. The IO shell ({@link readCurrentBranch}, {@link syncMainRef}) against REAL throwaway git fixtures (an
 *      "origin" bare repo + a clone), mirroring `we:scripts/conveyor/__tests__/branch-drift.test.mjs`'s own
 *      `mkdtemp` + real `git init` pattern — proving a real fast-forward happens, that it never touches the
 *      working tree, and that it refuses harmlessly when `main` is the checked-out branch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shouldSyncMainRef, readCurrentBranch, syncMainRef } from '../main-ref-sync.mjs';

// ── 1. the pure core ─────────────────────────────────────────────────────────────────────────────────────────

describe('shouldSyncMainRef — the pure core', () => {
  it('true for any branch other than main', () => {
    expect(shouldSyncMainRef({ currentBranch: 'lane/mechanical-dispatcher' })).toBe(true);
    expect(shouldSyncMainRef({ currentBranch: 'lane/3016-x' })).toBe(true);
  });

  it('false when main IS the checked-out branch — git itself would refuse the fetch', () => {
    expect(shouldSyncMainRef({ currentBranch: 'main' })).toBe(false);
  });

  it('a null/empty/unreadable branch is treated as "not main" — the safe direction (worst case, one refused fetch)', () => {
    expect(shouldSyncMainRef({ currentBranch: null })).toBe(true);
    expect(shouldSyncMainRef({})).toBe(true);
    expect(shouldSyncMainRef({ currentBranch: '' })).toBe(true);
    expect(shouldSyncMainRef({ currentBranch: '  ' })).toBe(true);
  });
});

// ── 2. the IO shell — real throwaway git fixtures ───────────────────────────────────────────────────────────

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

describe('syncMainRef / readCurrentBranch — real git fixtures', () => {
  let root, originDir, cloneDir;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'main-ref-sync-'));
    originDir = join(root, 'origin.git');
    cloneDir = join(root, 'clone');

    // A real bare "origin" with a real main branch.
    sh('git', ['init', '--bare', '-b', 'main', originDir]);
    const seedDir = join(root, 'seed');
    sh('git', ['clone', originDir, seedDir]);
    sh('git', ['-C', seedDir, 'config', 'user.email', 'test@example.com']);
    sh('git', ['-C', seedDir, 'config', 'user.name', 'test']);
    sh('git', ['-C', seedDir, 'commit', '--allow-empty', '-m', 'main: initial']);
    sh('git', ['-C', seedDir, 'push', 'origin', 'main']);

    // A real clone that checks out a DIFFERENT branch — the driver-checkout shape this pass exists for.
    sh('git', ['clone', originDir, cloneDir]);
    sh('git', ['-C', cloneDir, 'config', 'user.email', 'test@example.com']);
    sh('git', ['-C', cloneDir, 'config', 'user.name', 'test']);
    sh('git', ['-C', cloneDir, 'checkout', '-b', 'lane/mechanical-dispatcher', 'main']);

    // Advance origin's main WITHOUT the clone ever fetching it — reproduces the real 33h/161-commit gap at
    // fixture scale: the clone's local `main` ref now points at a commit origin/main has moved past.
    sh('git', ['-C', seedDir, 'commit', '--allow-empty', '-m', 'main: a later commit the clone has not seen']);
    sh('git', ['-C', seedDir, 'push', 'origin', 'main']);
  });

  afterAll(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort cleanup */ } });

  it('readCurrentBranch reads the real checked-out branch', () => {
    expect(readCurrentBranch({ cwd: cloneDir })).toBe('lane/mechanical-dispatcher');
  });

  it('the clone\'s local main starts BEHIND origin/main — the real gap this pass exists to close', () => {
    const localMain = sh('git', ['-C', cloneDir, 'rev-parse', 'main']).trim();
    const originMain = sh('git', ['-C', originDir, 'rev-parse', 'main']).trim();
    expect(localMain).not.toBe(originMain);
  });

  it('syncMainRef fast-forwards local main to match origin/main, checked out to a DIFFERENT branch', () => {
    const result = syncMainRef({ cwd: cloneDir });
    expect(result).toMatchObject({ attempted: true, synced: true, currentBranch: 'lane/mechanical-dispatcher' });
    const localMain = sh('git', ['-C', cloneDir, 'rev-parse', 'main']).trim();
    const originMain = sh('git', ['-C', originDir, 'rev-parse', 'main']).trim();
    expect(localMain).toBe(originMain);
  });

  it('never touches the working tree — the checked-out branch stays exactly where it was', () => {
    const before = sh('git', ['-C', cloneDir, 'rev-parse', 'lane/mechanical-dispatcher']).trim();
    const branchBefore = readCurrentBranch({ cwd: cloneDir });
    syncMainRef({ cwd: cloneDir });
    const after = sh('git', ['-C', cloneDir, 'rev-parse', 'lane/mechanical-dispatcher']).trim();
    const branchAfter = readCurrentBranch({ cwd: cloneDir });
    expect(after).toBe(before);
    expect(branchAfter).toBe(branchBefore);
  });

  it('refuses harmlessly when main IS the checked-out branch — no fetch attempted, never throws', () => {
    const mainCheckout = join(root, 'clone-on-main');
    sh('git', ['clone', originDir, mainCheckout]); // clones default to `main` checked out
    const result = syncMainRef({ cwd: mainCheckout });
    expect(result).toEqual({
      attempted: false, synced: false, currentBranch: 'main',
      reason: 'main is the currently checked-out branch — the normal checkout flow already keeps it fresh',
    });
  });

  it('a genuinely unreadable cwd (not a git repo) is reported, never thrown', () => {
    const notGit = join(root, 'not-a-repo');
    sh('mkdir', ['-p', notGit]);
    expect(() => syncMainRef({ cwd: notGit })).not.toThrow();
    const result = syncMainRef({ cwd: notGit });
    expect(result.currentBranch).toBeNull();
    expect(result.synced).toBe(false);
  });

  it('a second sync is idempotent — already fresh, still succeeds, ref unchanged', () => {
    const before = sh('git', ['-C', cloneDir, 'rev-parse', 'main']).trim();
    const result = syncMainRef({ cwd: cloneDir });
    expect(result.synced).toBe(true);
    const after = sh('git', ['-C', cloneDir, 'rev-parse', 'main']).trim();
    expect(after).toBe(before);
  });
});

describe('syncMainRef — injected run() failure paths (no real subprocess)', () => {
  it('a fetch failure is reported, never thrown — observability only, matches every sibling mechanical pass', () => {
    const run = (cmd, args) => {
      if (args.includes('rev-parse')) return 'lane/mechanical-dispatcher\n';
      throw new Error('fatal: unable to access origin — offline');
    };
    const result = syncMainRef({ cwd: '/fake/checkout', run });
    expect(result.attempted).toBe(true);
    expect(result.synced).toBe(false);
    expect(result.error).toContain('unable to access origin');
  });

  it('an unreadable current-branch read still lets the pass run (treated as "not main")', () => {
    const run = (cmd, args) => {
      if (args.includes('rev-parse') && args.includes('HEAD')) throw new Error('not a git repository');
      return ''; // the fetch call, if reached, "succeeds"
    };
    const result = syncMainRef({ cwd: '/fake/checkout', run });
    expect(result.currentBranch).toBeNull();
    expect(result.attempted).toBe(true);
    expect(result.synced).toBe(true);
  });
});
