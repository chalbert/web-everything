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
import { decideSelfSync, selfSyncCheckout, withSelfSync } from '../daemon-self-sync.mjs';

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
