/**
 * @file scripts/lib/__tests__/daemon-self-sync.test.mjs
 * @description xv6fciw — the daemon clone self-sync. Pure decision + injected-git cases, plus one suite against
 *   REAL temporary git repos so the actual fetch/merge/abort commands are proven, not only mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  decideSelfSync, selfSyncCheckout, withSelfSync,
  DAEMON_SELF_SYNC_BRANCH_ENV, resolvePocSyncBranch, decidePocSelfSync, selfSyncCheckoutPoc,
} from '../daemon-self-sync.mjs';

describe('decideSelfSync — pure', () => {
  const base = { fetched: true, behind: 3, dirty: false, onBase: true };
  it('behind on a clean main → merge', () => expect(decideSelfSync(base).action).toBe('merge'));
  it('up to date → none', () => expect(decideSelfSync({ ...base, behind: 0 })).toEqual({ action: 'none', reason: 'up-to-date' }));
  it('a dirty tree is never touched', () => expect(decideSelfSync({ ...base, dirty: true })).toEqual({ action: 'skip', reason: 'dirty' }));
  it('not on main is never touched', () => expect(decideSelfSync({ ...base, onBase: false })).toEqual({ action: 'skip', reason: 'not-on-main' }));
  it('a failed fetch skips', () => expect(decideSelfSync({ ...base, fetched: false })).toEqual({ action: 'skip', reason: 'fetch-failed' }));
});

describe('selfSyncCheckout — injected git', () => {
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

  it('behind on a clean main → merges and reports the commit count', () => {
    const { run, calls } = runner();
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: true, commits: 2, reason: 'merged' });
    expect(calls.some((c) => c.startsWith('merge origin/main'))).toBe(true);
  });

  it('a merge conflict is ABORTED — the tree is left as it was', () => {
    const { run, calls } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(calls).toContain('merge --abort');
  });

  it('a dirty tree never reaches merge', () => {
    const { run, calls } = runner({ status: { status: 0, stdout: ' M file.txt\n' } });
    expect(selfSyncCheckout({ root: '/x', run }).reason).toBe('dirty');
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it('runs every git command in the given root', () => {
    const seen = [];
    selfSyncCheckout({ root: '/the/clone', run: (args, opts) => { seen.push(opts.cwd); return { status: 0, stdout: args[0] === 'symbolic-ref' ? 'main' : '0' }; } });
    expect(new Set(seen)).toEqual(new Set(['/the/clone']));
  });
});

describe('withSelfSync — restart INSTEAD of ticking when new code arrived', () => {
  it('merged → onRestart runs, the tick does not', async () => {
    const tick = vi.fn(); const onRestart = vi.fn(() => 'restarted');
    const w = withSelfSync({ tickOnce: tick }, { root: '/x', onRestart, sync: () => ({ merged: true, commits: 4, reason: 'merged' }), log: { error: vi.fn() } });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(tick).not.toHaveBeenCalled();
  });

  it('up to date → the tick runs and its result passes through', async () => {
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }) });
    await expect(w.tickOnce()).resolves.toBe('ticked');
  });

  it('a conflict still ticks (never worse than today) and says it needs a hand merge', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'conflict' }), log });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('needs a hand merge'));
  });
});

describe('selfSyncCheckout — REAL git (temp repos)', () => {
  let dir;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (cwd, file, text) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', `edit ${file}`); };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'self-sync-'));
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', 'origin.git', 'upstream');
    const up = join(dir, 'upstream');
    git(up, 'checkout', '-q', '-b', 'main');
    commit(up, 'a.txt', 'one\n');
    git(up, 'push', '-q', 'origin', 'main');
    git(dir, 'clone', '-q', '-b', 'main', 'origin.git', 'daemon');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('behind AND ahead (the real daemon-clone shape) → a real merge lands both', () => {
    const up = join(dir, 'upstream'); const d = join(dir, 'daemon');
    commit(d, 'local.txt', 'run-ahead fix\n'); // the clone is ahead
    commit(up, 'b.txt', 'two\n'); git(up, 'push', '-q', 'origin', 'main'); // and behind
    const r = selfSyncCheckout({ root: d, run: (args, opts) => {
      try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
    } });
    expect(r).toEqual({ merged: true, commits: 1, reason: 'merged' });
    expect(git(d, 'rev-list', '--count', 'HEAD..origin/main').trim()).toBe('0');
    expect(git(d, 'ls-files').split('\n')).toEqual(expect.arrayContaining(['b.txt', 'local.txt']));
  });

  it('a conflicting upstream change → merge aborted, tree and HEAD unchanged', () => {
    const up = join(dir, 'upstream'); const d = join(dir, 'daemon');
    commit(d, 'a.txt', 'daemon side\n');
    commit(up, 'a.txt', 'upstream side\n'); git(up, 'push', '-q', 'origin', 'main');
    const headBefore = git(d, 'rev-parse', 'HEAD').trim();
    const r = selfSyncCheckout({ root: d, run: (args, opts) => {
      try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
    } });
    expect(r.reason).toBe('conflict');
    expect(git(d, 'rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git(d, 'status', '--porcelain').trim()).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// POC MODE (#3383 daemon POC) — DAEMON_SELF_SYNC_BRANCH
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('resolvePocSyncBranch — pure', () => {
  it('unset env, no explicit option → null (default path)', () => expect(resolvePocSyncBranch({ env: {} })).toBeNull());
  it('blank env → null', () => expect(resolvePocSyncBranch({ env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: '   ' } })).toBeNull());
  it('env set → that branch', () => expect(resolvePocSyncBranch({ env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: 'lane/daemon-poc' } })).toBe('lane/daemon-poc'));
  it('an explicit option wins over env', () => expect(resolvePocSyncBranch({ pocBranch: 'lane/x', env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: 'lane/y' } })).toBe('lane/x'));
});

describe('decidePocSelfSync — pure', () => {
  const clean = { dirty: false, onBranch: true };
  const src = (behind) => ({ fetched: true, behind });
  it('behind on main only → merge main, not poc', () => {
    expect(decidePocSelfSync({ ...clean, main: src(2), poc: src(0) })).toEqual({ action: 'merge', reason: 'behind', mergeMain: true, mergePoc: false });
  });
  it('behind on poc only → merge poc, not main', () => {
    expect(decidePocSelfSync({ ...clean, main: src(0), poc: src(3) })).toEqual({ action: 'merge', reason: 'behind', mergeMain: false, mergePoc: true });
  });
  it('behind on both → merge both', () => {
    expect(decidePocSelfSync({ ...clean, main: src(1), poc: src(1) })).toEqual({ action: 'merge', reason: 'behind', mergeMain: true, mergePoc: true });
  });
  it('up to date on both → none', () => {
    expect(decidePocSelfSync({ ...clean, main: src(0), poc: src(0) })).toEqual({ action: 'none', reason: 'up-to-date', mergeMain: false, mergePoc: false });
  });
  it('a dirty tree is never touched, whatever either source reports', () => {
    expect(decidePocSelfSync({ dirty: true, onBranch: true, main: src(5), poc: src(5) })).toEqual({ action: 'skip', reason: 'dirty', mergeMain: false, mergePoc: false });
  });
  it('not on the poc branch is never touched', () => {
    expect(decidePocSelfSync({ dirty: false, onBranch: false, main: src(5), poc: src(5) })).toEqual({ action: 'skip', reason: 'not-on-branch', mergeMain: false, mergePoc: false });
  });
  it('both fetches failed → skip fetch-failed', () => {
    expect(decidePocSelfSync({ ...clean, main: { fetched: false, behind: 0 }, poc: { fetched: false, behind: 0 } })).toEqual({ action: 'skip', reason: 'fetch-failed', mergeMain: false, mergePoc: false });
  });
  it('one fetch failed, the other behind → still merges the one that fetched', () => {
    expect(decidePocSelfSync({ ...clean, main: { fetched: false, behind: 0 }, poc: src(2) })).toEqual({ action: 'merge', reason: 'behind', mergeMain: false, mergePoc: true });
  });
});

describe('selfSyncCheckoutPoc — injected git', () => {
  const runner = (overrides = {}) => {
    const calls = [];
    const run = (args) => {
      calls.push(args.join(' '));
      const key = args[0] === 'rev-list' ? 'rev-list' : args[0];
      const r = overrides[key];
      if (typeof r === 'function') return r(args);
      return r ?? { status: 0, stdout: key === 'symbolic-ref' ? 'lane/daemon-poc\n' : key === 'rev-list' ? '1\n' : '' };
    };
    return { run, calls };
  };

  it('requires a pocBranch', () => expect(() => selfSyncCheckoutPoc({ root: '/x', run: () => ({ status: 0, stdout: '' }) })).toThrow(/pocBranch/));

  it('behind on both, clean tree → merges both sources', () => {
    const { run, calls } = runner();
    expect(selfSyncCheckoutPoc({ root: '/x', pocBranch: 'lane/daemon-poc', run })).toEqual({ merged: true, commits: 2, reason: 'merged' });
    expect(calls.some((c) => c.startsWith('merge origin/main'))).toBe(true);
    expect(calls.some((c) => c.startsWith('merge origin/lane/daemon-poc'))).toBe(true);
  });

  it('a conflict on main STOPS the tick — poc is never attempted', () => {
    const { run, calls } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : args[1] === 'origin/main' ? { status: 1, stdout: '', stderr: 'CONFLICT' } : { status: 0, stdout: '' }) });
    expect(selfSyncCheckoutPoc({ root: '/x', pocBranch: 'lane/daemon-poc', run })).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(calls).toContain('merge --abort');
    expect(calls.some((c) => c.startsWith('merge origin/lane/daemon-poc'))).toBe(false);
  });

  it('main merges clean, poc conflicts → merged-partial (main progress is kept)', () => {
    const { run } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : args[1] === 'origin/main' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    expect(selfSyncCheckoutPoc({ root: '/x', pocBranch: 'lane/daemon-poc', run })).toEqual({ merged: true, commits: 1, reason: 'merged-partial' });
  });

  it('a dirty tree never reaches merge', () => {
    const { run, calls } = runner({ status: { status: 0, stdout: ' M file.txt\n' } });
    expect(selfSyncCheckoutPoc({ root: '/x', pocBranch: 'lane/daemon-poc', run }).reason).toBe('dirty');
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it('not on the poc branch is never touched', () => {
    const { run } = runner({ 'symbolic-ref': { status: 0, stdout: 'main\n' } });
    expect(selfSyncCheckoutPoc({ root: '/x', pocBranch: 'lane/daemon-poc', run }).reason).toBe('not-on-branch');
  });
});

describe('withSelfSync — POC mode dispatch', () => {
  it('DAEMON_SELF_SYNC_BRANCH set → routes through syncPoc, not sync', async () => {
    const tick = vi.fn(); const onRestart = vi.fn(() => 'restarted');
    const syncPoc = vi.fn(() => ({ merged: true, commits: 3, reason: 'merged' }));
    const sync = vi.fn();
    const w = withSelfSync({ tickOnce: tick }, {
      root: '/x', onRestart, sync, syncPoc, log: { error: vi.fn() },
      env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: 'lane/daemon-poc' },
    });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(syncPoc).toHaveBeenCalledWith({ root: '/x', base: 'main', pocBranch: 'lane/daemon-poc' });
    expect(sync).not.toHaveBeenCalled();
    expect(tick).not.toHaveBeenCalled();
  });

  it('unset env → routes through sync (default), not syncPoc — byte-identical to the pre-POC contract', async () => {
    const syncPoc = vi.fn();
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync, syncPoc, env: {} });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(sync).toHaveBeenCalledWith({ root: '/x' });
    expect(syncPoc).not.toHaveBeenCalled();
  });

  it('a merged-partial POC result still restarts, and logs that the other source needs a hand merge', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: vi.fn() }, {
      root: '/x', onRestart: vi.fn(() => 'restarted'), syncPoc: () => ({ merged: true, commits: 1, reason: 'merged-partial' }), log,
      env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: 'lane/daemon-poc' },
    });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('needs a hand merge'));
  });

  it('POC conflict still ticks (never worse than the default path)', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, {
      root: '/x', onRestart: vi.fn(), syncPoc: () => ({ merged: false, commits: 0, reason: 'conflict' }), log,
      env: { [DAEMON_SELF_SYNC_BRANCH_ENV]: 'lane/daemon-poc' },
    });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('needs a hand merge'));
  });
});

describe('selfSyncCheckoutPoc — REAL git (temp repos, two upstreams)', () => {
  let dir;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (cwd, file, text) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', `edit ${file}`); };
  const realRun = (args, opts) => {
    try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
    catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'self-sync-poc-'));
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', 'origin.git', 'upstream');
    const up = join(dir, 'upstream');
    git(up, 'checkout', '-q', '-b', 'main');
    commit(up, 'a.txt', 'one\n');
    git(up, 'push', '-q', 'origin', 'main');
    // lane/daemon-poc starts equal to main, then diverges with its own commit.
    git(up, 'push', '-q', 'origin', 'main:lane/daemon-poc');
    commit(up, 'poc-only.txt', 'poc side\n');
    git(up, 'push', '-q', 'origin', 'HEAD:lane/daemon-poc');
    git(up, 'reset', '-q', '--hard', 'origin/main'); // put upstream back on plain main for later commits
    git(dir, 'clone', '-q', '-b', 'main', 'origin.git', 'daemon');
    git(join(dir, 'daemon'), 'branch', '-q', 'lane/daemon-poc', 'origin/main');
    git(join(dir, 'daemon'), 'checkout', '-q', 'lane/daemon-poc');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('merges NEW commits from both origin/main and origin/lane/daemon-poc in one tick', () => {
    const up = join(dir, 'upstream'); const d = join(dir, 'daemon');
    commit(up, 'b.txt', 'two\n'); git(up, 'push', '-q', 'origin', 'main'); // main gets a new commit
    const r = selfSyncCheckoutPoc({ root: d, base: 'main', pocBranch: 'lane/daemon-poc', run: realRun });
    expect(r).toEqual({ merged: true, commits: 2, reason: 'merged' }); // 1 from main (b.txt) + 1 already on lane/daemon-poc (poc-only.txt)
    expect(git(d, 'rev-list', '--count', 'HEAD..origin/main').trim()).toBe('0');
    expect(git(d, 'rev-list', '--count', 'HEAD..origin/lane/daemon-poc').trim()).toBe('0');
    expect(git(d, 'ls-files').split('\n')).toEqual(expect.arrayContaining(['a.txt', 'b.txt', 'poc-only.txt']));
  });

  it('a conflicting origin/lane/daemon-poc change aborts cleanly — tree and HEAD unchanged', () => {
    const up = join(dir, 'upstream'); const d = join(dir, 'daemon');
    // Make the daemon clone's own tip conflict with what's already on lane/daemon-poc (poc-only.txt content).
    commit(d, 'poc-only.txt', 'daemon side, conflicting\n');
    const headBefore = git(d, 'rev-parse', 'HEAD').trim();
    const r = selfSyncCheckoutPoc({ root: d, base: 'main', pocBranch: 'lane/daemon-poc', run: realRun });
    expect(r.reason).toBe('conflict');
    expect(r.merged).toBe(false);
    expect(git(d, 'rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git(d, 'status', '--porcelain').trim()).toBe('');
  });
});
