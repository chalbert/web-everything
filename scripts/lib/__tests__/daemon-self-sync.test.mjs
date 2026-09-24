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
import { decideSelfSync, selfSyncCheckout, withSelfSync, readHeadSha } from '../daemon-self-sync.mjs';
import { assertMainNotStale, isStaleMainRefusalMessage } from '../main-staleness.mjs';

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

  it('every git command carries a timeout + SIGKILL, defaulting to 60s', () => {
    const { run, opts } = runner();
    selfSyncCheckout({ root: '/x', run });
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o).toMatchObject({ cwd: '/x', timeout: 60_000, killSignal: 'SIGKILL' });
  });

  it('the timeout is overridable via timeoutMs, and reaches every call including merge --abort', () => {
    const { run, opts } = runner({ merge: (args) => (args[1] === '--abort' ? { status: 0, stdout: '' } : { status: 1, stdout: '', stderr: 'CONFLICT' }) });
    selfSyncCheckout({ root: '/x', run, timeoutMs: 5_000 });
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
    expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason: 'conflict' });
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
        expect(selfSyncCheckout({ root: '/x', run })).toEqual({ merged: false, commits: 0, reason });
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
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }) });
    await expect(w.tickOnce()).resolves.toBe('ticked');
  });

  it('a conflict still ticks (never worse than today) and says it needs a hand merge', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'conflict' }), log });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('needs a hand merge'));
  });

  it('a status-failed sync still ticks and is logged, not silent', async () => {
    const log = { error: vi.fn() };
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'status-failed' }), log });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('status-failed'));
  });

  for (const reason of ['fetch-failed', 'count-failed', 'head-failed']) {
    it(`a ${reason} sync still ticks and is logged, not silent`, async () => {
      const log = { error: vi.fn() };
      const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason }), log });
      await expect(w.tickOnce()).resolves.toBe('ticked');
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining(reason));
    });
  }

  it('an explicit timeoutMs is forwarded to the injected sync', async () => {
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const w = withSelfSync({ tickOnce: () => 'ticked' }, { root: '/x', onRestart: vi.fn(), sync, timeoutMs: 5_000 });
    await w.tickOnce();
    expect(sync).toHaveBeenCalledWith({ root: '/x', timeoutMs: 5_000 });
  });
});

// #3383 bug 1 — a tick that ITSELF hit the stale-main refusal (origin/main moved AFTER this tick-start sync,
// mid-tick, across a multi-repo loop) wasted the affected repo(s) this pass. Re-sync IMMEDIATELY when that
// happens, rather than let the daemon sleep the full interval and lose the SAME race again next tick.
describe('withSelfSync — mid-tick stale refusal reacts immediately (#3383 bug 1)', () => {
  it('a tick result flagged by hasStaleRefusal triggers an immediate re-sync + restart when it finds new commits', async () => {
    const onRestart = vi.fn(() => 'restarted');
    const tickResult = { refusals: [{ repo: 'chalbert/frontierui', kind: 'tick-failed', why: 'review-dispatch: ... STALE code from this checkout ... (#3439)' }] };
    const sync = vi.fn()
      .mockReturnValueOnce({ merged: false, commits: 0, reason: 'up-to-date' }) // tick-start sync: nothing to do yet
      .mockReturnValueOnce({ merged: true, commits: 1, reason: 'merged' }); // the immediate re-sync after the tick
    const w = withSelfSync({ tickOnce: () => tickResult }, {
      root: '/x', onRestart, sync, log: { error: vi.fn() },
      hasStaleRefusal: (r) => (r.refusals ?? []).some((x) => /STALE code from this checkout/.test(x.why)),
    });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(sync).toHaveBeenCalledTimes(2);
    expect(onRestart).toHaveBeenCalledWith({ merged: true, commits: 1, reason: 'merged' });
  });

  it('a flagged tick result whose immediate re-sync finds nothing new (a false-positive/self-resolved case) still returns the tick result, never worse than before', async () => {
    const tickResult = { refusals: [{ repo: 'x', kind: 'tick-failed', why: 'STALE code from this checkout' }] };
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const w = withSelfSync({ tickOnce: () => tickResult }, {
      root: '/x', onRestart: vi.fn(), sync,
      hasStaleRefusal: (r) => (r.refusals ?? []).length > 0,
    });
    await expect(w.tickOnce()).resolves.toBe(tickResult);
  });

  it('an UNFLAGGED tick result never triggers a second sync call at all (no hasStaleRefusal wired → byte-identical to today)', async () => {
    const sync = vi.fn(() => ({ merged: false, commits: 0, reason: 'up-to-date' }));
    const w = withSelfSync({ tickOnce: () => ({ ok: true }) }, { root: '/x', onRestart: vi.fn(), sync });
    await w.tickOnce();
    expect(sync).toHaveBeenCalledTimes(1);
  });
});

// #3383 bug 2 — two daemons (review-daemon and reconcile-fix-dispatch-daemon) run from ONE shared dedicated
// clone. Whichever self-syncs FIRST merges and restarts (the existing `r.merged` branch above); the other used
// to see `up-to-date` (someone else already brought the checkout current) and tick on forever against its own
// now-stale in-memory code. Recording the HEAD sha at boot and restarting on ANY drift — not only a merge THIS
// process performed — closes that gap for whichever process didn't do the merging.
describe('withSelfSync — restarts on ANY HEAD drift since boot, not only its own merge (#3383 bug 2)', () => {
  it('HEAD moved (a sibling process merged first) → restarts even though THIS process\'s own sync found nothing to merge', async () => {
    const onRestart = vi.fn(() => 'restarted');
    const tick = vi.fn();
    const readHead = vi.fn().mockReturnValueOnce('sha-boot').mockReturnValueOnce('sha-after-sibling-merge');
    const w = withSelfSync({ tickOnce: tick }, {
      root: '/x', onRestart, sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }),
      readHead, log: { error: vi.fn() },
    });
    await expect(w.tickOnce()).resolves.toBe('restarted');
    expect(tick).not.toHaveBeenCalled();
    expect(onRestart).toHaveBeenCalledWith(expect.objectContaining({ merged: false, reason: 'head-moved' }));
  });

  it('HEAD unchanged since boot → ticks normally', async () => {
    const readHead = vi.fn().mockReturnValue('sha-boot'); // same value every read
    const w = withSelfSync({ tickOnce: () => 'ticked' }, {
      root: '/x', onRestart: vi.fn(), sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }), readHead,
    });
    await expect(w.tickOnce()).resolves.toBe('ticked');
  });

  it('an unreadable HEAD (readHead returns null) never falsely restarts — skips the drift check, fails safe', async () => {
    const onRestart = vi.fn();
    const readHead = vi.fn(() => null);
    const w = withSelfSync({ tickOnce: () => 'ticked' }, {
      root: '/x', onRestart, sync: () => ({ merged: false, commits: 0, reason: 'up-to-date' }), readHead,
    });
    await expect(w.tickOnce()).resolves.toBe('ticked');
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('this process\'s OWN merge still restarts via the existing merged branch (unchanged)', async () => {
    const onRestart = vi.fn(() => 'restarted');
    const readHead = vi.fn(() => 'irrelevant'); // merged branch returns before HEAD drift is ever checked
    const w = withSelfSync({ tickOnce: vi.fn() }, {
      root: '/x', onRestart, sync: () => ({ merged: true, commits: 3, reason: 'merged' }), readHead,
    });
    await expect(w.tickOnce()).resolves.toBe('restarted');
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

// #3383 bug 1 — REALISTIC end-to-end simulation of the live 2026-09-23 incident: a bare "origin", a dedicated
// daemon clone that has ALREADY self-synced once before (so it carries a local-only merge commit and is
// DIVERGED from origin — exactly the real daemon clone's shape per the live log), then a genuine multi-repo
// tick during which origin/main is pushed to MID-TICK (a drain landing something while the tick is still
// running its later repos) — proving the fix syncs and restarts instead of refusing. No mocked git anywhere in
// this block: `withSelfSync`'s real default `sync` (`selfSyncCheckout`, which itself defaults to the real
// `gitRun`) runs against real temp repos, and `assertMainNotStale`'s own real default `checkStaleness` does too.
describe('withSelfSync — REAL git, bug 1 mid-tick race end-to-end (#3383)', () => {
  let dir;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (cwd, file, text) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', `edit ${file}`); };

  // Repo-LOCAL identity (not the host's global ~/.gitconfig, which CI runners don't carry) — the SUT's own
  // `selfSyncCheckout` merge call (`withSelfSync`'s default, un-injected `sync`) runs plain `git merge`
  // with no identity flags of its own, exactly as it does in real production use; local config is what makes
  // that succeed on any host, not a machine-specific global default this test would otherwise depend on.
  const setLocalIdentity = (cwd) => { git(cwd, 'config', 'user.name', 't'); git(cwd, 'config', 'user.email', 't@t'); };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'self-sync-bug1-'));
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', 'origin.git', 'upstream');
    setLocalIdentity(join(dir, 'upstream'));
    commit(join(dir, 'upstream'), 'a.txt', 'one\n');
    git(join(dir, 'upstream'), 'push', '-q', 'origin', 'main');
    git(dir, 'clone', '-q', '-b', 'main', 'origin.git', 'daemon');
    setLocalIdentity(join(dir, 'daemon'));
    // Give the daemon clone a LOCAL-ONLY commit, exactly like the real dedicated clone accumulates over time
    // (its own prior self-sync merges and other locally-committing passes never get pushed anywhere) — the
    // clone is now permanently DIVERGED (ahead of origin), which is exactly why the live daemon's every
    // subsequent staleness read as "diverged", never a plain fast-forwardable "behind" (see
    // we:scripts/lib/main-staleness.mjs's own classifyStaleness: a diverged tree can never auto-ff, it can
    // only warn/refuse — matching the live log's "DIVERGED (N local commit(s) ahead of origin/main)").
    commit(join(dir, 'daemon'), 'local-only.txt', 'a local commit never pushed anywhere\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('BEFORE the fix (no hasStaleRefusal wired): the mid-tick refusal is just absorbed and lost for the tick', async () => {
    const daemon = join(dir, 'daemon'); const up = join(dir, 'upstream');
    const onRestart = vi.fn(() => 'restarted');
    let mainRefusalMessage = null;
    const tick = () => {
      // repo 1 of 3: nothing owed, fine.
      // repo 2 of 3: origin/main is pushed to MID-TICK (a drain landing something while THIS tick still runs) —
      // the exact race from the live incident. The dispatch chokepoint (assertMainNotStale) is real, not mocked.
      commit(up, 'mid-tick.txt', 'landed while the tick was running\n');
      git(up, 'push', '-q', 'origin', 'main');
      try {
        assertMainNotStale(daemon);
        throw new Error('test setup bug: expected assertMainNotStale to refuse (checkout should be diverged+behind)');
      } catch (e) {
        mainRefusalMessage = e.message;
      }
      // repo 3 of 3 would refuse identically — matches the live log's "all 3 repos refused this way".
      return { refusals: [{ repo: 'chalbert/frontierui', kind: 'tick-failed', why: mainRefusalMessage }] };
    };
    const w = withSelfSync({ tickOnce: tick }, { root: daemon, onRestart, log: { error: vi.fn() } }); // no hasStaleRefusal — today's behavior
    const result = await w.tickOnce();
    expect(mainRefusalMessage).toMatch(/STALE code from this checkout/);
    expect(result.refusals).toHaveLength(1); // the tick's refusal is returned as-is — nothing reacted to it
    expect(onRestart).not.toHaveBeenCalled(); // BUG: still diverged+behind; next tick will lose the same race
    expect(git(daemon, 'rev-list', '--count', `HEAD..origin/main`).trim()).not.toBe('0'); // still behind
  });

  it('AFTER the fix (hasStaleRefusal wired): the SAME mid-tick refusal triggers an immediate sync + restart', async () => {
    const daemon = join(dir, 'daemon'); const up = join(dir, 'upstream');
    const onRestart = vi.fn((r) => ({ restarted: true, ...r }));
    let mainRefusalMessage = null;
    const tick = () => {
      commit(up, 'mid-tick.txt', 'landed while the tick was running\n');
      git(up, 'push', '-q', 'origin', 'main');
      try {
        assertMainNotStale(daemon);
        throw new Error('test setup bug: expected assertMainNotStale to refuse (checkout should be diverged+behind)');
      } catch (e) {
        mainRefusalMessage = e.message;
      }
      return { refusals: [{ repo: 'chalbert/frontierui', kind: 'tick-failed', why: mainRefusalMessage }] };
    };
    const w = withSelfSync({ tickOnce: tick }, {
      root: daemon, onRestart, log: { error: vi.fn() },
      hasStaleRefusal: (r) => (r.refusals ?? []).some((x) => isStaleMainRefusalMessage(x.why)),
    });
    const result = await w.tickOnce();
    expect(mainRefusalMessage).toMatch(/STALE code from this checkout/);
    expect(result).toMatchObject({ restarted: true, merged: true }); // onRestart ran instead of the tick result passing through
    expect(onRestart).toHaveBeenCalledTimes(1);
    // The checkout is now caught up — the SAME repo that just refused would NOT refuse again immediately.
    expect(git(daemon, 'rev-list', '--count', 'HEAD..origin/main').trim()).toBe('0');
    expect(() => assertMainNotStale(daemon)).not.toThrow();
    expect(git(daemon, 'ls-files')).toContain('mid-tick.txt');
  });
});

// #3383 bug 2 — REAL git test with two independent daemon "processes" (their whole self-sync decision logic,
// not mocked) sharing ONE clone directory, matching the live incident exactly (review-daemon and
// reconcile-fix-dispatch-daemon both run from /Users/nicolasgilbert/workspace/wev-review-daemon). Whichever
// self-syncs first merges and restarts (unchanged, pre-existing behavior); THE FIX proves the other one — which
// finds the checkout already "up-to-date" and would previously have ticked on forever against its own stale
// in-memory code — ALSO decides to restart.
describe('withSelfSync — REAL git, two processes sharing one clone (#3383 bug 2)', () => {
  let dir;
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (cwd, file, text) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', `edit ${file}`); };

  // See the bug-1 describe block above for why this is repo-local, not the host's global git identity.
  const setLocalIdentity = (cwd) => { git(cwd, 'config', 'user.name', 't'); git(cwd, 'config', 'user.email', 't@t'); };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'self-sync-bug2-'));
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
    git(dir, 'clone', '-q', 'origin.git', 'upstream');
    setLocalIdentity(join(dir, 'upstream'));
    commit(join(dir, 'upstream'), 'a.txt', 'one\n');
    git(join(dir, 'upstream'), 'push', '-q', 'origin', 'main');
    // ONE shared clone — both "processes" below point at this exact directory, mirroring the real incident.
    git(dir, 'clone', '-q', '-b', 'main', 'origin.git', 'shared');
    setLocalIdentity(join(dir, 'shared'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('the daemon that did NOT merge still decides to restart, because HEAD moved out from under it', async () => {
    const shared = join(dir, 'shared'); const up = join(dir, 'upstream');
    // Two "processes" boot at the same moment, before either has ticked — each records its own boot HEAD sha
    // (identical, since neither has done anything yet), exactly like two real OS processes starting up.
    const tickReviewDaemon = vi.fn(() => 'review-ticked');
    const tickFixDaemon = vi.fn(() => 'fix-ticked');
    const onRestartReview = vi.fn(() => 'review-restarted');
    const onRestartFix = vi.fn(() => 'fix-restarted');
    const reviewDaemon = withSelfSync({ tickOnce: tickReviewDaemon }, { root: shared, onRestart: onRestartReview, log: { error: vi.fn() } });
    const fixDaemon = withSelfSync({ tickOnce: tickFixDaemon }, { root: shared, onRestart: onRestartFix, log: { error: vi.fn() } });

    // main moves (a drain lands a PR) — the ordinary trigger for a self-sync.
    commit(up, 'b.txt', 'two\n');
    git(up, 'push', '-q', 'origin', 'main');

    // The review daemon's tick fires FIRST (real race): it self-syncs, merges for real, restarts.
    await expect(reviewDaemon.tickOnce()).resolves.toBe('review-restarted');
    expect(tickReviewDaemon).not.toHaveBeenCalled();
    expect(onRestartReview).toHaveBeenCalledTimes(1);
    expect(git(shared, 'ls-files')).toContain('b.txt'); // the merge really landed on disk

    // The fix daemon's tick fires next, against the SAME now-current clone. Its OWN self-sync finds
    // `behind: 0` (someone else already brought it current) — the exact "up-to-date" case that used to mean
    // "keep running on stale in-memory code forever". Proven here: it restarts anyway, because HEAD no longer
    // matches the sha it recorded at its own boot.
    await expect(fixDaemon.tickOnce()).resolves.toBe('fix-restarted');
    expect(tickFixDaemon).not.toHaveBeenCalled();
    expect(onRestartFix).toHaveBeenCalledTimes(1);
  });
});
