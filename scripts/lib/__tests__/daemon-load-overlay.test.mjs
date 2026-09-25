/**
 * @file scripts/lib/__tests__/daemon-load-overlay.test.mjs
 * @description #4044 Module E — the operator's manual "load this early" CLI. `--ref` REGISTERS the ref as a
 *   standing overlay (`daemon-overlays.mjs#addOverlay`) then runs a gated rebuild
 *   (`daemon-rebuild.mjs#rebuildClone`) — the same rebuild-fresh-from-main-plus-overlays → live-smoke →
 *   adopt/rollback path a daemon's own `daemon-self-sync.mjs#withSelfSync` runs every tick. `--dry-run` never
 *   writes the overlay list; it previews via `dryRunRebuild`'s own `extraOverlays` option instead.
 *
 * HISTORY (#3383, PR #2601 follow-up, 2026-09-24): the first cut called `daemon-self-sync.mjs#selfSyncCheckout`
 * directly with `--ref` spliced in as its own `base` — conflating the HOME branch with the ref being merged
 * in. That standalone merge path ({@link mergeOverlayRef}/{@link dryRunOverlay} below) is KEPT and exported
 * for back-compat and is still tested directly (real git, proving the conflict-abort fix) — but
 * `runDaemonLoadOverlay` no longer calls it, since a one-shot merge left no durable record for the NEXT
 * automatic rebuild (which rebuilds fresh from `origin/main` + the REGISTERED overlay list only) to keep.
 *
 * `runDaemonLoadOverlay`'s wiring tests inject `addOverlayFn`/`rebuild`/`dryRunRebuildFn` — no real git, no
 * real child process (those are `daemon-overlays.mjs`'s and `daemon-rebuild.mjs`'s own test suites' job).
 * `mergeOverlayRef`/`dryRunOverlay`'s own tests inject `run` (git) — proving the ACTUAL git sequence, including
 * one REAL-git suite (temp repos) for the conflict-abort behavior, since that is exactly the live bug.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runDaemonLoadOverlay, mergeOverlayRef, dryRunOverlay } from '../daemon-load-overlay.mjs';

describe('runDaemonLoadOverlay — wiring (injected addOverlayFn/rebuild/dryRunRebuildFn)', () => {
  it('requires --clone', async () => {
    await expect(runDaemonLoadOverlay({ clone: null, ref: 'lane/x' })).rejects.toThrow(/--clone/);
  });

  it('requires --ref', async () => {
    await expect(runDaemonLoadOverlay({ clone: '/some/clone', ref: null })).rejects.toThrow(/--ref/);
  });

  it('registers the overlay THEN rebuilds, in order', async () => {
    const order = [];
    const addOverlayFn = vi.fn(() => { order.push('addOverlay'); });
    const rebuild = vi.fn(async () => { order.push('rebuild'); return { moved: false, reason: 'up-to-date' }; });
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', ref: 'lane/x', addOverlayFn, rebuild });
    expect(order).toEqual(['addOverlay', 'rebuild']);
    expect(result).toMatchObject({ registered: true, mergedAnything: false, adopted: false, reason: 'up-to-date' });
  });

  it('an ADOPTED rebuild is reported adopted:true, with the new head', async () => {
    const addOverlayFn = vi.fn();
    const rebuild = vi.fn(async () => ({ moved: true, adopted: true, head: 'deadbeef', alerts: [] }));
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', ref: 'lane/x', addOverlayFn, rebuild });
    expect(result).toMatchObject({ mergedAnything: true, adopted: true, head: 'deadbeef' });
  });

  it('a REJECTED rebuild (smoke-rejected) is reported adopted:false, the reason surfaced', async () => {
    const addOverlayFn = vi.fn();
    const rebuild = vi.fn(async () => ({ moved: false, reason: 'smoke-rejected', rolledBack: true, alerts: [{ kind: 'smoke-rejected', detail: { failed: 'gh-api-repo' } }] }));
    const result = await runDaemonLoadOverlay({ clone: '/some/clone', ref: 'lane/x', addOverlayFn, rebuild });
    expect(result.adopted).toBe(false);
    expect(result.reason).toBe('smoke-rejected');
    expect(result.alerts[0].detail.failed).toBe('gh-api-repo');
  });

  it('addOverlayFn is called with the ref, pr, addedBy, and reason', async () => {
    const addOverlayFn = vi.fn();
    const rebuild = vi.fn(async () => ({ moved: false, reason: 'up-to-date' }));
    await runDaemonLoadOverlay({
      clone: '/some/clone', ref: 'lane/xkse05k-gh-app-shim-401-fallback', pr: 42, addedBy: 'nic', reason: 'early load', addOverlayFn, rebuild,
    });
    expect(addOverlayFn).toHaveBeenCalledWith('/some/clone', expect.objectContaining({
      ref: 'lane/xkse05k-gh-app-shim-401-fallback', pr: 42, addedBy: 'nic', reason: 'early load',
    }), expect.anything());
  });

  it('rebuild always runs with mainOnly:false — a manual overlay load is never the main-only case', async () => {
    const addOverlayFn = vi.fn();
    const rebuild = vi.fn(async () => ({ moved: false, reason: 'up-to-date' }));
    await runDaemonLoadOverlay({ clone: '/some/clone', ref: 'lane/x', addOverlayFn, rebuild });
    expect(rebuild).toHaveBeenCalledWith(expect.objectContaining({ mainOnly: false }));
  });

  it('--dry-run never calls addOverlayFn or rebuild at all', async () => {
    const addOverlayFn = vi.fn();
    const rebuild = vi.fn();
    const dryRunRebuildFn = vi.fn(async () => ({ dryRun: true, wouldDo: 'rebuild-and-smoke', plan: { finalSha: 'x' } }));
    const result = await runDaemonLoadOverlay({
      clone: '/some/clone', ref: 'lane/x', dryRun: true, addOverlayFn, rebuild, dryRunRebuildFn,
    });
    expect(addOverlayFn).not.toHaveBeenCalled();
    expect(rebuild).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
  });

  it('--dry-run appends the ref VIRTUALLY via extraOverlays, never writing it', async () => {
    const dryRunRebuildFn = vi.fn(async () => ({ dryRun: true, wouldDo: 'nothing' }));
    await runDaemonLoadOverlay({
      clone: '/some/clone', ref: 'lane/x', pr: 7, dryRun: true, dryRunRebuildFn,
    });
    expect(dryRunRebuildFn).toHaveBeenCalledWith(expect.objectContaining({
      root: '/some/clone', extraOverlays: [{ ref: 'lane/x', pr: 7 }],
    }));
  });
});

describe('mergeOverlayRef — injected git', () => {
  const runner = (overrides = {}) => {
    const calls = [];
    const run = (args) => {
      calls.push(args.join(' '));
      const key = args[0] === 'rev-list' ? 'rev-list' : args[0];
      const r = overrides[key];
      if (typeof r === 'function') return r(args);
      return r ?? { status: 0, stdout: key === 'symbolic-ref' ? 'main\n' : key === 'rev-list' ? '2\n' : '' };
    };
    return { run, calls };
  };

  it('on the home branch, clean, behind → fetches and merges the OVERLAY ref, not the home branch', () => {
    const { run, calls } = runner();
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/xkse05k-gh-app-shim-401-fallback', run });
    expect(r).toEqual({ merged: true, commits: 2, reason: 'merged' });
    expect(calls).toContain('fetch --quiet -- origin lane/xkse05k-gh-app-shim-401-fallback');
    expect(calls.some((c) => c.startsWith('merge origin/lane/xkse05k-gh-app-shim-401-fallback'))).toBe(true);
  });

  it('THE LIVE BUG: on `main` (the home branch), overlaying a DIFFERENT ref is never refused as not-on-base', () => {
    const { run } = runner(); // symbolic-ref reports 'main' by default
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/some-other-branch', homeBranch: 'main', run });
    expect(r.reason).not.toBe('not-on-base');
    expect(r.merged).toBe(true);
  });

  it('NOT on the home branch → not-on-base, never fetches', () => {
    const { run, calls } = runner({ 'symbolic-ref': { status: 0, stdout: 'some-other-branch\n' } });
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/x', homeBranch: 'main', run });
    expect(r).toEqual({ merged: false, commits: 0, reason: 'not-on-base' });
    expect(calls.some((c) => c.startsWith('fetch'))).toBe(false);
  });

  it('a dirty tree never reaches fetch or merge', () => {
    const { run, calls } = runner({ status: { status: 0, stdout: ' M file.txt\n' } });
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/x', run });
    expect(r.reason).toBe('dirty');
    expect(calls.some((c) => c.startsWith('fetch') || c.startsWith('merge'))).toBe(false);
  });

  it('a merge CONFLICT is ALWAYS aborted before returning — never left mid-merge', () => {
    const { run, calls } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/x', run });
    expect(r).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(calls).toContain('merge --abort');
  });

  it('already up to date on the overlay ref → reports it, never merges', () => {
    const { run, calls } = runner({ 'rev-list': { status: 0, stdout: '0\n' } });
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/x', run });
    expect(r).toEqual({ merged: false, commits: 0, reason: 'up-to-date' });
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it.each(['fetch', 'symbolic-ref', 'status'])('a failed/timed-out `%s` fails closed, never reaching merge', (site) => {
    const { run, calls } = runner({ [site]: { status: null, stdout: '', stderr: '', signal: 'SIGKILL' } });
    const r = mergeOverlayRef({ root: '/x', ref: 'lane/x', run });
    expect(r.merged).toBe(false);
    expect(['head-failed', 'status-failed', 'fetch-failed']).toContain(r.reason);
    expect(calls.some((c) => c.startsWith('merge') && !c.includes('--abort'))).toBe(false);
  });

  it('a `--ref` that looks like a git option is refused before any git runs (argv injection)', () => {
    expect(() => mergeOverlayRef({ root: '/x', ref: '--upload-pack=touch /tmp/pwned;', run: () => ({ status: 0, stdout: '' }) })).toThrow(/not a safe branch name/);
  });
});

describe('dryRunOverlay — injected git, never merges', () => {
  it('reports onHome/dirty/behind without ever calling merge', () => {
    const calls = [];
    const run = (args) => {
      calls.push(args.join(' '));
      if (args[0] === 'symbolic-ref') return { status: 0, stdout: 'main\n' };
      if (args[0] === 'status') return { status: 0, stdout: '' };
      if (args[0] === 'fetch') return { status: 0, stdout: '' };
      if (args[0] === 'rev-list') return { status: 0, stdout: '3\n' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'deadbeef\n' };
      return { status: 0, stdout: '' };
    };
    const r = dryRunOverlay({ root: '/x', ref: 'lane/x', run });
    expect(r).toEqual({ onHome: true, dirty: false, fetched: true, behind: 3, headSha: 'deadbeef', wouldMerge: true });
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it('not on home branch → wouldMerge:false, still read-only', () => {
    const run = (args) => {
      if (args[0] === 'symbolic-ref') return { status: 0, stdout: 'some-other\n' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'deadbeef\n' };
      return { status: 0, stdout: '' };
    };
    const r = dryRunOverlay({ root: '/x', ref: 'lane/x', run });
    expect(r.onHome).toBe(false);
    expect(r.wouldMerge).toBe(false);
  });
});

describe('mergeOverlayRef / dryRunOverlay — REAL git (temp repos), proving the conflict-abort fix live', () => {
  let dir;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (cwd, file, text) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', `edit ${file}`); };
  const realRun = (args, opts) => {
    try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
    catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'overlay-'));
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', 'origin.git', 'upstream');
    const up = join(dir, 'upstream');
    git(up, 'checkout', '-q', '-b', 'main');
    commit(up, 'a.txt', 'one\n');
    git(up, 'push', '-q', 'origin', 'main');
    // an overlay branch, diverged from main with its own commit
    git(up, 'checkout', '-q', '-b', 'lane/overlay');
    commit(up, 'overlay.txt', 'overlay side\n');
    git(up, 'push', '-q', 'origin', 'lane/overlay');
    git(up, 'checkout', '-q', 'main');
    // the daemon clone — stays on `main` throughout, exactly like the real incident
    git(dir, 'clone', '-q', '-b', 'main', 'origin.git', 'daemon');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('a clean overlay merges into `main` while the clone stays ON `main` the whole time', () => {
    const d = join(dir, 'daemon');
    const r = mergeOverlayRef({ root: d, ref: 'lane/overlay', homeBranch: 'main', run: realRun });
    expect(r).toEqual({ merged: true, commits: 1, reason: 'merged' });
    expect(git(d, 'symbolic-ref', '--short', 'HEAD').trim()).toBe('main');
    expect(git(d, 'ls-files')).toContain('overlay.txt');
    expect(git(d, 'status', '--porcelain').trim()).toBe('');
  });

  it('a CONFLICTING overlay is aborted — HEAD and the tree are exactly as before, never left mid-merge', () => {
    const d = join(dir, 'daemon');
    commit(d, 'overlay.txt', 'conflicting local content\n'); // conflicts with the overlay branch's own overlay.txt
    const headBefore = git(d, 'rev-parse', 'HEAD').trim();
    const r = mergeOverlayRef({ root: d, ref: 'lane/overlay', homeBranch: 'main', run: realRun });
    expect(r).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(git(d, 'rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git(d, 'status', '--porcelain').trim()).toBe(''); // NOT mid-merge — this is the live bug, fixed
    expect(existsSync(join(d, '.git', 'MERGE_HEAD'))).toBe(false);
  });

  it('--dry-run reports a real fetch + real ahead/behind count with NO merge ever attempted', () => {
    const d = join(dir, 'daemon');
    const headBefore = git(d, 'rev-parse', 'HEAD').trim();
    const preview = dryRunOverlay({ root: d, ref: 'lane/overlay', homeBranch: 'main', run: realRun });
    expect(preview.onHome).toBe(true);
    expect(preview.dirty).toBe(false);
    expect(preview.fetched).toBe(true);
    expect(preview.behind).toBe(1);
    expect(preview.wouldMerge).toBe(true);
    expect(git(d, 'rev-parse', 'HEAD').trim()).toBe(headBefore); // untouched
    expect(git(d, 'ls-files')).not.toContain('overlay.txt'); // not merged
  });
});
