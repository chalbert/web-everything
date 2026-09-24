/**
 * @file scripts/lib/__tests__/daemon-self-sync.test.mjs
 * @description xv6fciw — the daemon clone self-sync. Pure decision + injected-git cases, plus one suite against
 *   REAL temporary git repos so the actual fetch/merge/abort commands are proven, not only mocked.
 *
 * x3ecgta adds the per-clone reader/writer lock suites below: pure gate-decision cases, then a REAL-lock suite
 * (genuine `mkdir`/heartbeat/reclaim IO against a per-test temp `lockRootBase` — NEVER the real `~/.claude`
 * lock dirs) that proves the two invariants the ruling requires — "the tree never moves under a running tick"
 * and "two daemons never git-merge the same tree at once" — plus dead-holder (same-host PID) and TTL reclaim.
 * The pre-existing `selfSyncCheckout`/`withSelfSync` suites above/below are updated only where they now reach
 * the lock (the merge path, and every non-restart `withSelfSync` tick): they inject trivial always-ok fakes for
 * `acquireMoveLock`/`releaseMoveLock`/`acquireTickLock`/`releaseTickLock` (or a temp `lockRootBase` for the real
 * temp-repo suite) so they stay decoupled from — and never touch the fs for — this new lock, which is not what
 * they are testing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  decideSelfSync, selfSyncCheckout, withSelfSync,
  decideTickLockGate, decideMoveLockGate,
  acquireCloneTickLock, releaseCloneTickLock, acquireCloneMoveLock, releaseCloneMoveLock,
} from '../daemon-self-sync.mjs';

/** Trivial always-ok lock fakes for suites that exercise `selfSyncCheckout`/`withSelfSync` behavior UNRELATED
 *  to the new per-clone lock (they never touch the fs for it). */
const NOOP_MOVE_LOCK = { acquireMoveLock: () => ({ ok: true, reason: 'writer' }), releaseMoveLock: () => true };
const NOOP_TICK_LOCK = { acquireTickLock: () => ({ ok: true, reason: 'reader' }), releaseTickLock: () => true };

describe('decideSelfSync — pure', () => {
  const base = { fetched: true, behind: 3, dirty: false, onBase: true };
  it('behind on a clean main → merge', () => expect(decideSelfSync(base).action).toBe('merge'));
  it('up to date → none', () => expect(decideSelfSync({ ...base, behind: 0 })).toEqual({ action: 'none', reason: 'up-to-date' }));
  it('a dirty tree is never touched', () => expect(decideSelfSync({ ...base, dirty: true })).toEqual({ action: 'skip', reason: 'dirty' }));
  it('not on main is never touched', () => expect(decideSelfSync({ ...base, onBase: false })).toEqual({ action: 'skip', reason: 'not-on-main' }));
  it('a failed fetch skips', () => expect(decideSelfSync({ ...base, fetched: false })).toEqual({ action: 'skip', reason: 'fetch-failed' }));
  it('an unknown tree state (status failed) fails closed — never merges', () => expect(decideSelfSync({ ...base, dirty: null })).toEqual({ action: 'skip', reason: 'status-failed' }));
  it('an unknown distance (count failed) is count-failed, NEVER up-to-date', () => expect(decideSelfSync({ ...base, behind: null })).toEqual({ action: 'skip', reason: 'count-failed' }));
  it('an unknown branch (symbolic-ref failed) is head-failed, not not-on-main', () => expect(decideSelfSync({ ...base, onBase: null })).toEqual({ action: 'skip', reason: 'head-failed' }));
});

describe('selfSyncCheckout — injected git', () => {
  const runner = (overrides = {}) => {
    const calls = [];
    const opts = [];
    const run = (args, o) => {
      calls.push(args.join(' '));
      opts.push(o);
      const key = args[0] === 'rev-list' ? 'rev-list' : args[0];
      const r = overrides[key];
      if (typeof r === 'function') return r(args);
      return r ?? { status: 0, stdout: key === 'symbolic-ref' ? 'main\n' : key === 'rev-list' ? '2\n' : '' };
    };
    return { run, calls, opts };
  };

  it('behind on a clean main → merges and reports the commit count', () => {
    const { run, calls } = runner();
    expect(selfSyncCheckout({ root: '/x', run, ...NOOP_MOVE_LOCK })).toEqual({ merged: true, commits: 2, reason: 'merged' });
    expect(calls.some((c) => c.startsWith('merge origin/main'))).toBe(true);
  });

  it('a merge conflict is ABORTED — the tree is left as it was', () => {
    const { run, calls } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    expect(selfSyncCheckout({ root: '/x', run, ...NOOP_MOVE_LOCK })).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(calls).toContain('merge --abort');
  });

  it('a writer-lock refusal is its own reason, NEVER treated as a merge conflict', () => {
    const { run, calls } = runner();
    const acquireMoveLock = () => ({ ok: false, reason: 'tick-in-progress', heldBy: ['host:123'] });
    expect(selfSyncCheckout({ root: '/x', run, acquireMoveLock, releaseMoveLock: () => true }))
      .toEqual({ merged: false, commits: 0, reason: 'tick-in-progress' });
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
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

  it('every git command carries a timeout + SIGKILL, defaulting to 60s', () => {
    const { run, opts } = runner();
    selfSyncCheckout({ root: '/x', run, ...NOOP_MOVE_LOCK });
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o).toMatchObject({ cwd: '/x', timeout: 60_000, killSignal: 'SIGKILL' });
  });

  it('the timeout is overridable via timeoutMs, and reaches every call including merge --abort', () => {
    const { run, opts } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    selfSyncCheckout({ root: '/x', run, timeoutMs: 5_000, ...NOOP_MOVE_LOCK });
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o).toMatchObject({ timeout: 5_000, killSignal: 'SIGKILL' });
  });

  it('a timed-out fetch (null status, like a killed spawnSync) is treated as fetch-failed, never reaching merge', () => {
    const { run, calls } = runner({ fetch: { status: null, stdout: '', stderr: '', signal: 'SIGKILL' } });
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'fetch-failed' });
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it('a timed-out merge (null status) is ABORTED and reported the same as any other failed merge', () => {
    const { run, calls } = runner({
      merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: null, stdout: '', stderr: '', signal: 'SIGKILL' }),
    });
    expect(selfSyncCheckout({ root: '/x', run, ...NOOP_MOVE_LOCK })).toEqual({ merged: false, commits: 0, reason: 'conflict' });
    expect(calls).toContain('merge --abort');
  });

  it('a timed-out git status is NOT read as a clean tree — skips as status-failed, never reaching merge', () => {
    const { run, calls } = runner({ status: { status: null, stdout: '', stderr: '', signal: 'SIGKILL' } });
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'status-failed' });
    expect(calls.some((c) => c.startsWith('merge'))).toBe(false);
  });

  it('a failed git status in gitRun\'s real shape (status 1, empty stdout) also skips as status-failed', () => {
    const { run } = runner({ status: { status: 1, stdout: '', stderr: 'fatal' } });
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'status-failed' });
  });

  it('a rev-list that "succeeds" but prints no number is count-failed, not up-to-date', () => {
    for (const stdout of ['', 'garbage\n']) {
      const { run } = runner({ 'rev-list': { status: 0, stdout } });
      expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'count-failed' });
    }
  });

  // Every git call site fed a timed-out (killed) or failed result: none may ever end in `merged: true`, AND each
  // must surface as its own distinct failure reason — never `up-to-date` (or any other success-looking reason).
  const TIMED_OUT = { status: null, stdout: '', stderr: '', signal: 'SIGKILL' };
  const FAILED = { status: 1, stdout: '', stderr: 'fatal' };
  const EXPECTED = { fetch: 'fetch-failed', 'rev-list': 'count-failed', 'symbolic-ref': 'head-failed', status: 'status-failed', merge: 'conflict' };
  for (const [site, reason] of Object.entries(EXPECTED)) {
    for (const [shape, result] of [['timed-out', TIMED_OUT], ['failed', FAILED]]) {
      it(`a ${shape} \`${site}\` never leads to merged:true and reports ${reason}`, () => {
        const { run } = runner({ [site]: result });
        expect(selfSyncCheckout({ root: '/x', run, ...NOOP_MOVE_LOCK })).toEqual({ merged: false, commits: 0, reason });
      });
    }
  }
});

describe('withSelfSync — restart INSTEAD of ticking when new code arrived', () => {
  it('merged → onRestart runs, the tick does not', async () => {
    const tick = vi.fn(); const onRestart = vi.fn(() => 'restarted');
    const w = withSelfSync({ tickOnce: tick }, { root: '/x', onRestart, sync: () => ({ merged: true, commits: 4, reason: 'merged' }), log: { error: vi.fn() } });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(tick).not.toHaveBeenCalled();
  });

  it('up to date → the tick runs and its result passes through', async () => {
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }), ...NOOP_TICK_LOCK });
    await expect(w.tickOnce()).resolves.toBe('ticked');
  });

  it('a conflict still ticks (never worse than today) and says it needs a hand merge', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'conflict' }), log, ...NOOP_TICK_LOCK });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('needs a hand merge'));
  });

  it('a status-failed sync still ticks and is logged, not silent', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'status-failed' }), log, ...NOOP_TICK_LOCK });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('status-failed'));
  });

  for (const reason of ['fetch-failed', 'count-failed', 'head-failed']) {
    it(`a ${reason} sync still ticks and is logged, not silent`, async () => {
      const log = { error: vi.fn() };
      const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason }), log, ...NOOP_TICK_LOCK });
      await expect(w.tickOnce()).resolves.toBe('ticked');
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining(reason));
    });
  }

  for (const [reason, phrase] of [['tick-in-progress', 'sibling daemon'], ['concurrent-mover', 'another process']]) {
    it(`a ${reason} sync still ticks and is logged, not silent (the merge-side lock refusal)`, async () => {
      const log = { error: vi.fn() };
      const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason }), log, ...NOOP_TICK_LOCK });
      await expect(w.tickOnce()).resolves.toBe('ticked');
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining(phrase));
    });
  }

  it('an explicit timeoutMs is forwarded to the injected sync', async () => {
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync, timeoutMs: 5_000, ...NOOP_TICK_LOCK });
    await w.tickOnce();
    expect(sync).toHaveBeenCalledWith({ root: '/x', timeoutMs: 5_000 });
  });

  it('a writer active RIGHT NOW skips the entire tick (never partially reads a moving tree)', async () => {
    const tick = vi.fn(() => 'ticked');
    const log = { error: vi.fn() };
    const acquireTickLock = () => ({ ok: false, reason: 'writer-active', heldBy: 'host:99' });
    const w = withSelfSync({ tickOnce: tick }, {
      root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }), log,
      acquireTickLock, releaseTickLock: () => true,
    });
    const result = await w.tickOnce();
    expect(tick).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: 'writer-active' });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('writer-active'));
  });

  it('the reader (tick) lock is released even when the tick body throws', async () => {
    const release = vi.fn(() => true);
    const w = withSelfSync({ tickOnce: () => { throw new Error('boom'); } }, {
      root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }),
      acquireTickLock: () => ({ ok: true, reason: 'reader' }), releaseTickLock: release,
    });
    await expect(w.tickOnce()).rejects.toThrow('boom');
    expect(release).toHaveBeenCalled();
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
    const r = selfSyncCheckout({ root: d, lock: { lockRootBase: join(dir, '.locks') }, run: (args, opts) => {
      try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
    } });
    expect(r).toEqual({ merged: true, commits: 1, reason: 'merged' });
    expect(git(d, 'rev-list', '--count', 'HEAD..origin/main').trim()).toBe('0');
    expect(git(d, 'ls-files').split('\n')).toEqual(expect.arrayContaining(['b.txt', 'local.txt']));
    // the real move-lock is taken and released around the real merge — nothing left held afterward.
    expect(acquireCloneMoveLock(d, 'proof', { lockRootBase: join(dir, '.locks') })).toMatchObject({ ok: true });
  });

  it('a conflicting upstream change → merge aborted, tree and HEAD unchanged', () => {
    const up = join(dir, 'upstream'); const d = join(dir, 'daemon');
    commit(d, 'a.txt', 'daemon side\n');
    commit(up, 'a.txt', 'upstream side\n'); git(up, 'push', '-q', 'origin', 'main');
    const headBefore = git(d, 'rev-parse', 'HEAD').trim();
    const r = selfSyncCheckout({ root: d, lock: { lockRootBase: join(dir, '.locks') }, run: (args, opts) => {
      try { return { status: 0, stdout: execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { status: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }; }
    } });
    expect(r.reason).toBe('conflict');
    expect(git(d, 'rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git(d, 'status', '--porcelain').trim()).toBe('');
  });
});

// ── x3ecgta: the per-clone reader/writer lock — pure gate decisions ────────────────────────────────────────
describe('decideTickLockGate / decideMoveLockGate — pure', () => {
  const nowMs = 1_000_000;

  it('no writer at all → a tick may start', () => {
    expect(decideTickLockGate({ writerEntry: null, nowMs })).toEqual({ ok: true, reason: 'clear' });
  });

  it('a LIVE writer blocks a new tick', () => {
    const writerEntry = { owner: 'host:1', heartbeatAt: new Date(nowMs).toISOString() };
    expect(decideTickLockGate({ writerEntry, nowMs, writerPidLiveness: 'alive' }))
      .toEqual({ ok: false, reason: 'writer-active', heldBy: 'host:1' });
  });

  it('a writer whose lease EXPIRED never blocks a tick', () => {
    const writerEntry = { owner: 'host:1', heartbeatAt: new Date(nowMs - 20 * 60_000).toISOString() }; // 20 min old
    expect(decideTickLockGate({ writerEntry, nowMs, leaseMinutes: 15 })).toEqual({ ok: true, reason: 'clear' });
  });

  it('a writer whose PID is PROVABLY DEAD never blocks a tick, even within the TTL', () => {
    const writerEntry = { owner: 'host:1', heartbeatAt: new Date(nowMs).toISOString() };
    expect(decideTickLockGate({ writerEntry, nowMs, writerPidLiveness: 'dead' })).toEqual({ ok: true, reason: 'clear' });
  });

  it('no readers at all → a mover may start', () => {
    expect(decideMoveLockGate({ readerEntries: [], nowMs })).toEqual({ ok: true, reason: 'clear' });
  });

  it('ANY live reader blocks the mover — the tree never moves under a running tick', () => {
    const readerEntries = [{ owner: 'host:2', heartbeatAt: new Date(nowMs).toISOString() }];
    expect(decideMoveLockGate({ readerEntries, nowMs, readerPidLivenessOf: () => 'alive' }))
      .toEqual({ ok: false, reason: 'tick-in-progress', heldBy: ['host:2'] });
  });

  it('a dead/expired reader never blocks the mover, but a live sibling among several still does', () => {
    const dead = { owner: 'host:dead', heartbeatAt: new Date(nowMs).toISOString() };
    const expired = { owner: 'host:expired', heartbeatAt: new Date(nowMs - 20 * 60_000).toISOString() };
    const live = { owner: 'host:live', heartbeatAt: new Date(nowMs).toISOString() };
    const readerPidLivenessOf = (e) => (e.owner === 'host:dead' ? 'dead' : 'alive');
    expect(decideMoveLockGate({ readerEntries: [dead, expired, live], nowMs, leaseMinutes: 15, readerPidLivenessOf }))
      .toEqual({ ok: false, reason: 'tick-in-progress', heldBy: ['host:live'] });
  });
});

// ── x3ecgta: the per-clone reader/writer lock — REAL fs IO, two simulated daemons on ONE clone ────────────────
// Genuine `mkdir`/heartbeat/reclaim IO against a per-test temp `lockRootBase` (never the real ~/.claude lock
// dirs). This is the "run 2 simulated daemons on one clone" proof: daemon A is the mover, daemon B is a tick.
describe('acquireCloneTickLock / acquireCloneMoveLock — real lock IO, two simulated daemons on one clone', () => {
  let lockRootBase;
  const ROOT = '/simulated/shared/clone'; // never actually read as a directory — only its resolved string is hashed
  beforeEach(() => { lockRootBase = mkdtempSync(join(tmpdir(), 'self-sync-lock-')); });
  afterEach(() => rmSync(lockRootBase, { recursive: true, force: true }));

  it('THE RACE THIS CARD FIXES: while daemon B is mid-tick, daemon A (the mover) is refused — never a race', () => {
    const tickB = acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase });
    expect(tickB.ok).toBe(true); // B is mid-tick, holding the shared reader lease

    const moveA = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase });
    expect(moveA).toEqual({ ok: false, reason: 'tick-in-progress', heldBy: ['daemonB'] }); // A must NOT move the tree

    expect(releaseCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toBe(true); // B's tick ends
    const moveA2 = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase });
    expect(moveA2).toEqual({ ok: true, reason: 'writer' }); // now A may move it
    expect(releaseCloneMoveLock(ROOT, 'daemonA', { lockRootBase })).toBe(true);
  });

  it('the reverse: while daemon A is mid-move, daemon B is refused a NEW tick — the tree never moves under a running tick', () => {
    const moveA = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase });
    expect(moveA).toEqual({ ok: true, reason: 'writer' });

    const tickB = acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase });
    expect(tickB).toEqual({ ok: false, reason: 'writer-active', heldBy: 'daemonA' });

    expect(releaseCloneMoveLock(ROOT, 'daemonA', { lockRootBase })).toBe(true);
    const tickB2 = acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase });
    expect(tickB2).toEqual({ ok: true, reason: 'reader' });
    expect(releaseCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toBe(true);
  });

  it('two movers never overlap — a second mover is refused while the first still holds the writer lease', () => {
    const moveA = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase });
    expect(moveA).toEqual({ ok: true, reason: 'writer' });

    const moveC = acquireCloneMoveLock(ROOT, 'daemonC', { lockRootBase });
    expect(moveC).toEqual({ ok: false, reason: 'concurrent-mover', heldBy: 'daemonA' });
  });

  it('two ticks (readers) coexist freely — the shared hold never blocks a sibling tick', () => {
    expect(acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toEqual({ ok: true, reason: 'reader' });
    expect(acquireCloneTickLock(ROOT, 'daemonC', { lockRootBase })).toEqual({ ok: true, reason: 'reader' });
  });

  it('a DIFFERENT clone (a different root) never contends with this one', () => {
    expect(acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase })).toEqual({ ok: true, reason: 'writer' });
    expect(acquireCloneTickLock('/a/totally/different/clone', 'daemonB', { lockRootBase })).toEqual({ ok: true, reason: 'reader' });
  });

  it('AFTER: a dead reader (a real, provably-gone same-host PID) is reclaimed at once — never waits out the TTL', () => {
    // A real short-lived child process, waited out, so its pid is PROVABLY gone (never a mocked liveness verdict).
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = child.pid;
    expect(deadPid).toBeGreaterThan(0);
    // The STORED owner must be a real SAME-HOST identity (`host:pid`, exactly what `defaultLockOwner()` mints
    // for a real daemon) — the fast path only probes an owner recorded on THIS host (see the file header).
    const crashedOwner = `${hostname()}:${deadPid}`;

    // Seed a reader entry as if daemonB's tick had SIGKILLed mid-tick without releasing — heartbeat fresh, well
    // within the 15-minute TTL, so ONLY the pid-dead fast path can reclaim this, never the lease clock.
    const before = acquireCloneTickLock(ROOT, crashedOwner, { lockRootBase, pid: deadPid, nowMs: Date.now() });
    expect(before.ok).toBe(true);

    // dead reader IS reclaimed at once: the mover's PID-liveness probe (default `defaultProbePidLiveness`) sees
    // ESRCH for `deadPid` on this host and drops it from the "live readers" scan, well within the TTL.
    const mover = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase, nowMs: Date.now() });
    expect(mover).toEqual({ ok: true, reason: 'writer' });
    expect(releaseCloneMoveLock(ROOT, 'daemonA', { lockRootBase })).toBe(true);
  });

  it('AFTER (TTL fallback): a stale reader past the lease, with an UNKNOWN-liveness pid, is still reclaimed', () => {
    const past = Date.now() - 20 * 60_000; // 20 minutes ago, past the 15-minute default lease
    // owner string is a different host — the fast path never even looks at the pid (see the file header).
    const before = acquireCloneTickLock(ROOT, 'other-host:4242', { lockRootBase, nowMs: past });
    expect(before.ok).toBe(true);
    const mover = acquireCloneMoveLock(ROOT, 'daemonA', { lockRootBase, nowMs: Date.now() });
    expect(mover).toEqual({ ok: true, reason: 'writer' }); // reclaimed via the TTL floor, not the pid fast path
    expect(releaseCloneMoveLock(ROOT, 'daemonA', { lockRootBase })).toBe(true);
  });

  it('a dead mover (writer) never blocks a fresh tick — pid-dead fast reclaim on the writer side too', () => {
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = child.pid;
    const crashedOwner = `${hostname()}:${deadPid}`;
    const moveA = acquireCloneMoveLock(ROOT, crashedOwner, { lockRootBase, pid: deadPid, nowMs: Date.now() });
    expect(moveA.ok).toBe(true); // A "crashed" mid-move without releasing

    const tickB = acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase, nowMs: Date.now() });
    expect(tickB).toEqual({ ok: true, reason: 'reader' }); // reclaimed at once, never stuck for the TTL
    expect(releaseCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toBe(true);
  });

  it('re-acquiring your OWN tick lease is a heartbeat refresh, not a refusal', () => {
    expect(acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toEqual({ ok: true, reason: 'reader' });
    expect(acquireCloneTickLock(ROOT, 'daemonB', { lockRootBase })).toEqual({ ok: true, reason: 'reader' });
  });
});
