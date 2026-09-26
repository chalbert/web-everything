/**
 * @file scripts/lib/__tests__/daemon-rebuild-fallback.test.mjs
 * @description x5wbsbc (epic #4075) — the operator's fallback ruling ("fallback on last working version rather
 *   than block delivery"), covering the parts of `../daemon-rebuild.mjs` that `daemon-rebuild.test.mjs` (the
 *   pre-existing suite) does not: {@link candidateSmokeEnv} (the live-clone-derived env the candidate smoke
 *   runs with), the plain-main fallback (a), the pinned-overlay hold (b), the smoke-harness-broken control (c),
 *   the per-clone candidate lock, and {@link failsSameChecks}. Same fixture conventions as
 *   `daemon-rebuild.test.mjs` (real temp git fixtures, injected `runSmoke` stubs) — the helpers below are
 *   copied from that file rather than imported, per this card's instructions.
 */
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync,
} from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  rebuildClone, readRebuildState, candidateSmokeEnv, rebuildStatePath,
  candidateWorktreePath, failsSameChecks, DISPATCH_CWD_ROOT_ENV,
} from '../daemon-rebuild.mjs';
import { addOverlay, readOverlays, removeOverlay } from '../daemon-overlays.mjs';
import { defaultPoolRoot } from '../lane-pool-paths.mjs';
import { DISPATCH_CWD_ENV } from '../../operations/dispatch-lane-io.mjs';

// ── fixture helpers — copied from daemon-rebuild.test.mjs (never imported from it) ──────────────────────────

const tempDirs = [];

function mktemp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function git(cwd, args) {
  return spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
}
function gitOk(cwd, args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

function makeAuthorClone(originDir) {
  const parent = mktemp('we-daemon-rebuild-fb-author-');
  const dir = join(parent, 'w');
  const r = spawnSync('git', ['clone', '-q', originDir, dir], {
    encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
  if (r.status !== 0) throw new Error(`clone failed: ${r.stderr}`);
  return dir;
}

function pushBranch(originDir, ref, mutate, { base = 'origin/main' } = {}) {
  const dir = makeAuthorClone(originDir);
  gitOk(dir, ['fetch', '-q', 'origin']);
  gitOk(dir, ['checkout', '-q', '-B', ref, base]);
  mutate(dir);
  gitOk(dir, ['add', '-A']);
  gitOk(dir, ['commit', '-q', '-m', `overlay: ${ref}`]);
  gitOk(dir, ['push', '-q', 'origin', `HEAD:refs/heads/${ref}`]);
  return gitOk(dir, ['rev-parse', 'HEAD']).trim();
}

function advanceMain(originDir, mutate) {
  return pushBranch(originDir, 'main', mutate, { base: 'origin/main' });
}

function writeFile(dir, name, content) {
  const full = join(dir, name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Fresh {origin (bare), clone (working tree under test), env} fixture — same shape as daemon-rebuild.test.mjs,
 *  but with LANE_POOL_ROOT / WE_DISPATCH_CWD_ROOT explicitly ABSENT so candidateSmokeEnv's own derivation
 *  (never an ambient override from this process's real env) is what a test observes. */
function makeFixture() {
  const base = mktemp('we-daemon-rebuild-fb-fixture-');
  const originDir = join(base, 'origin.git');
  const cloneDir = join(base, 'clone');
  mkdirSync(cloneDir, { recursive: true });
  gitOk(base, ['init', '--bare', '-q', originDir]);
  gitOk(cloneDir, ['init', '-q', '-b', 'main']);
  writeFile(cloneDir, 'README.md', 'init\n');
  gitOk(cloneDir, ['add', '-A']);
  gitOk(cloneDir, ['commit', '-q', '-m', 'init']);
  gitOk(cloneDir, ['remote', 'add', 'origin', originDir]);
  gitOk(cloneDir, ['push', '-q', '-u', 'origin', 'main']);
  gitOk(cloneDir, ['fetch', '-q', 'origin']);

  const stateDir = mktemp('we-daemon-rebuild-fb-state-');
  const lockDir = mktemp('we-daemon-rebuild-fb-lock-');
  const overlayDir = mktemp('we-daemon-rebuild-fb-overlay-');
  const env = {
    ...process.env,
    WE_DAEMON_STATE_DIR: stateDir,
    WE_DAEMON_CLONE_LOCK_ROOT: lockDir,
    WE_DAEMON_OVERLAY_DIR: overlayDir,
  };
  delete env.LANE_POOL_ROOT;
  delete env[DISPATCH_CWD_ROOT_ENV];
  return {
    base, originDir, cloneDir, stateDir, lockDir, overlayDir, env,
  };
}

function passSmoke() {
  return vi.fn(async () => ({ verdict: 'pass', attempts: 1, smoke: { results: [] } }));
}

// x5wbsbc — a smoke that fails ONLY the candidate carrying `file` and passes every other tree (in particular the
// last-good control the rebuild smokes before calling a failure a code regression).
function failsWhenFile(file, result) {
  return vi.fn(async ({ root }) => (existsSync(join(root, file))
    ? result
    : { verdict: 'pass', attempts: 1, smoke: { results: [] } }));
}

const LOCK_OPTS = { waitMs: 2000, pollMs: 20 };

beforeEach(() => {
  tempDirs.length = 0;
});

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

// ── a. candidateSmokeEnv — pure ─────────────────────────────────────────────────────────────────────────────

describe('candidateSmokeEnv', () => {
  it('names the same env var as dispatch-lane-io.mjs#DISPATCH_CWD_ENV', () => {
    expect(DISPATCH_CWD_ROOT_ENV).toBe('WE_DISPATCH_CWD_ROOT');
    expect(DISPATCH_CWD_ROOT_ENV).toBe(DISPATCH_CWD_ENV);
  });

  it('LANE_POOL_ROOT resolves from the LIVE clone path, not any candidate path', () => {
    const out = candidateSmokeEnv({ root: '/x/ws/wev-review-daemon', env: {} });
    expect(out.LANE_POOL_ROOT).toBe('/x/ws/.lanes');
  });

  it('an explicit LANE_POOL_ROOT already in env wins over derivation', () => {
    const out = candidateSmokeEnv({ root: '/x/ws/wev-review-daemon', env: { LANE_POOL_ROOT: '/custom/pool' } });
    expect(out.LANE_POOL_ROOT).toBe('/custom/pool');
  });

  it('WE_DISPATCH_CWD_ROOT defaults to <workspace>/.operations/dispatch', () => {
    const out = candidateSmokeEnv({ root: '/x/ws/wev-review-daemon', env: {} });
    expect(out[DISPATCH_CWD_ROOT_ENV]).toBe('/x/ws/.operations/dispatch');
  });

  it('an explicit WE_DISPATCH_CWD_ROOT already in env is kept', () => {
    const out = candidateSmokeEnv({
      root: '/x/ws/wev-review-daemon', env: { [DISPATCH_CWD_ROOT_ENV]: '/explicit/dispatch/root' },
    });
    expect(out[DISPATCH_CWD_ROOT_ENV]).toBe('/explicit/dispatch/root');
  });

  it('fills PATH/HOME when missing from env', () => {
    const out = candidateSmokeEnv({ root: '/x/ws/wev-review-daemon', env: { PATH: '', HOME: '' } });
    expect(out.PATH).toBeTruthy();
    expect(out.HOME).toBeTruthy();
  });

  it('carries an already-present PATH/HOME through untouched', () => {
    const out = candidateSmokeEnv({
      root: '/x/ws/wev-review-daemon', env: { PATH: '/only/here', HOME: '/only/home' },
    });
    expect(out.PATH).toBe('/only/here');
    expect(out.HOME).toBe('/only/home');
  });
});

// ── b. rebuildClone passes candidateSmokeEnv to runSmoke ────────────────────────────────────────────────────

describe('rebuildClone passes candidateSmokeEnv to runSmoke', () => {
  it("runSmoke's env.LANE_POOL_ROOT is derived from the clone root, not the state-dir candidate path", async () => {
    const {
      originDir, cloneDir, env, stateDir,
    } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'z.txt', 'z\n'));

    const calls = [];
    const runSmoke = vi.fn(async (args) => {
      calls.push(args);
      return { verdict: 'pass', attempts: 1, smoke: { results: [] } };
    });
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.adopted).toBe(true);
    expect(calls).toHaveLength(1);
    const expectedPool = defaultPoolRoot(cloneDir, {});
    expect(calls[0].env.LANE_POOL_ROOT).toBe(expectedPool);
    // the wrong (bug-shaped) derivation: resolving the pool from the candidate worktree path under stateDir.
    const wrongPool = defaultPoolRoot(candidateWorktreePath(cloneDir, env), {});
    expect(calls[0].env.LANE_POOL_ROOT).not.toBe(wrongPool);
    expect(calls[0].env.LANE_POOL_ROOT.startsWith(stateDir)).toBe(false);
  });
});

// ── c. plain-main fallback (a bad NON-pinned overlay) ───────────────────────────────────────────────────────

describe('smokeAndAdopt fallback-plain-main (x5wbsbc)', () => {
  it('a bad NON-pinned overlay: falls back to plain main, adopts it, drops the overlay, alerts both kinds', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    const prevHead = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();
    // Advance main PAST prevHead first, so plain main is a genuinely different (newer) tree than what the clone
    // is already sitting on — otherwise falling back to "plain main" would be a no-op move (see the sibling
    // test below for that case) rather than exercising the real reset --hard this test is about.
    const mainSha = advanceMain(originDir, (dir) => writeFile(dir, 'main-moved.txt', 'y\n'));
    expect(mainSha).not.toBe(prevHead);
    pushBranch(originDir, 'lane/bad', (dir) => writeFile(dir, 'bad.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/bad' }, { env });

    const runSmoke = failsWhenFile('bad.txt', {
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    });
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.reason).toBe('fallback-plain-main');
    expect(result.moved).toBe(true);
    expect(result.adopted).toBe(true);
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(mainSha);
    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(result.alerts.some((a) => a.kind === 'fallback-plain-main')).toBe(true);
    expect(result.alerts.some((a) => a.kind === 'overlay-dropped-smoke-failed')).toBe(true);
    expect(readRebuildState(cloneDir, env).held).toBeNull();
    expect(runSmoke).toHaveBeenCalledTimes(2); // A (main+overlay, fails) then B (plain main, passes)
  });

  it('main did not move and the clone is already adopted at main: no second smoke needed', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    const mainSha = gitOk(cloneDir, ['rev-parse', 'origin/main']).trim();

    // First call: nothing to build (clone already at main) — adopts via the up-to-date short-circuit.
    const first = await rebuildClone({
      root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(first.reason).toBe('up-to-date');
    expect(readRebuildState(cloneDir, env).adopted?.head).toBe(mainSha);

    pushBranch(originDir, 'lane/bad2', (dir) => writeFile(dir, 'bad2.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/bad2' }, { env });

    const runSmoke = failsWhenFile('bad2.txt', {
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    });
    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(second.reason).toBe('fallback-plain-main');
    // Plain main IS the tree the clone is already sitting on (main never moved) — nothing to reset, but the
    // overlay is still adopted-away (see finalizeRebuild's own "already-adopted" branch).
    expect(second.moved).toBe(false);
    expect(second.adopted).toBe(true);
    expect(runSmoke).toHaveBeenCalledTimes(1); // only A — B is skipped (plain main == prevHead == adopted head)
    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(mainSha);
  });
});

// ── d. pinned overlay + bad candidate + passing last-good control ──────────────────────────────────────────

describe('pinned overlay stays held on smoke-rejected when the last-good control passes', () => {
  it('holds the clone on last-good, records state.held, alerts daemon-held-on-last-good', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/pinned-bad', (dir) => writeFile(dir, 'pinned-bad.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/pinned-bad', pinned: true }, { env });
    const prevHead = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();

    const runSmoke = failsWhenFile('pinned-bad.txt', {
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    });
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.reason).toBe('smoke-rejected');
    expect(result.moved).toBe(false);
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(prevHead); // HEAD unchanged
    const state = readRebuildState(cloneDir, env);
    expect(state.held?.reason).toBe('smoke-rejected');
    expect(state.held?.lastGood).toBe(prevHead);
    expect(result.alerts.some((a) => a.kind === 'daemon-held-on-last-good')).toBe(true);
    // A (candidate) + C (last-good control) — no B: the overlay is pinned, so the plain-main fallback never runs.
    expect(runSmoke).toHaveBeenCalledTimes(2);
  });
});

// ── e. smoke-harness-broken (the control fails identically) ────────────────────────────────────────────────

describe('smoke-harness-broken (x5wbsbc)', () => {
  it('rejects as smoke-harness-broken when the last-good control fails the same check, backs off, then retries', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/harness', (dir) => writeFile(dir, 'harness.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/harness', pinned: true }, { env }); // pinned: skip the plain-main fallback

    let t = 1_000_000;
    const runSmoke = vi.fn(async () => ({
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'harness-check', detail: 'boom' }] },
    }));

    const first = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS, now: () => t,
    });
    expect(first.reason).toBe('smoke-harness-broken');
    const state1 = readRebuildState(cloneDir, env);
    expect(state1.rejected?.harnessBroken).toBe(true);
    expect(state1.rejected?.retryAt).toBeTruthy();
    expect(state1.held?.reason).toBe('smoke-harness-broken');
    const callsAfterFirst = runSmoke.mock.calls.length;
    expect(callsAfterFirst).toBe(2); // A + C, no B (pinned)

    // New inputs (main moves again) — the backoff still applies even to a brand-new plan.
    advanceMain(originDir, (dir) => writeFile(dir, 'harness-main.txt', 'y\n'));
    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS, now: () => t,
    });
    expect(second.reason).toBe('smoke-harness-broken-backoff');
    expect(runSmoke.mock.calls.length).toBe(callsAfterFirst); // not called again

    t += 24 * 60 * 60_000; // comfortably past the default retry backoff (minutes, not hours)
    const third = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS, now: () => t,
    });
    expect(runSmoke.mock.calls.length).toBeGreaterThan(callsAfterFirst); // smoked again
    expect(third.reason).toBe('smoke-harness-broken');
    // The backoff GROWS on a repeat (attempts 2 => 2x the base delay), never pinned at the base delay.
    const state3 = readRebuildState(cloneDir, env);
    expect(state3.rejected.attempts).toBe(2);
    expect(Date.parse(state3.rejected.retryAt)).toBe(t + 2 * 5 * 60_000);
  });
});

// ── f. single flight — #2731's build lease covers the WHOLE fallback (A, B, C), not just the first smoke ──────

describe('single-flight build lease across the fallback (x5wbsbc on #2731)', () => {
  const writeBuilding = (cloneDir, env, building) => {
    const file = rebuildStatePath(cloneDir, env);
    mkdirSync(dirname(file), { recursive: true });
    const cur = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    writeFileSync(file, JSON.stringify({ ...cur, building }));
  };

  it('a live sibling lease returns rebuild-in-progress without smoking', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'lock1.txt', 'x\n'));
    writeBuilding(cloneDir, env, {
      token: 'sib', pid: process.ppid, host: hostname(), startedAt: new Date().toISOString(), path: '/nonexistent',
    });
    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(result.reason).toBe('rebuild-in-progress');
    expect(runSmoke).not.toHaveBeenCalled();
  });

  it('a dead-pid lease is taken over and the build adopts', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'lock2.txt', 'x\n'));
    writeBuilding(cloneDir, env, {
      token: 'dead', pid: 999999, host: hostname(), startedAt: new Date().toISOString(), path: '/nonexistent',
    });
    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(result.adopted).toBe(true);
    expect(runSmoke).toHaveBeenCalledTimes(1);
    expect(readRebuildState(cloneDir, env).building).toBeNull();
  });

  it('the lease stays held through the plain-main and last-good smokes, and is released at the end', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/lease-bad', (dir) => writeFile(dir, 'lease-bad.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/lease-bad', pinned: true }, { env });
    const heldDuring = [];
    const runSmoke = vi.fn(async ({ root }) => {
      heldDuring.push(!!readRebuildState(cloneDir, env).building);
      return existsSync(join(root, 'lease-bad.txt'))
        ? { verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] } }
        : { verdict: 'pass', attempts: 1, smoke: { results: [] } };
    });
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(result.reason).toBe('smoke-rejected');
    expect(heldDuring).toEqual([true, true]); // candidate + last-good control, both under the lease
    expect(readRebuildState(cloneDir, env).building).toBeNull();
  });
});

// ── g. adoption after a hold clears state.held ──────────────────────────────────────────────────────────────

describe('an adoption after a hold clears state.held', () => {
  it('clears state.held once a later rebuild actually adopts', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/heldbad', (dir) => writeFile(dir, 'heldbad.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/heldbad', pinned: true }, { env });

    const failing = failsWhenFile('heldbad.txt', {
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    });
    const held = await rebuildClone({
      root: cloneDir, env, runSmoke: failing, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(held.reason).toBe('smoke-rejected');
    expect(readRebuildState(cloneDir, env).held).not.toBeNull();

    // Simulate the fix that would let a later tick adopt: drop the bad overlay and move main again.
    removeOverlay(cloneDir, 'lane/heldbad', { env });
    advanceMain(originDir, (dir) => writeFile(dir, 'fixed.txt', 'y\n'));

    const adopted = await rebuildClone({
      root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(adopted.moved).toBe(true);
    expect(adopted.adopted).toBe(true);
    expect(readRebuildState(cloneDir, env).held).toBeNull();
  });
});

// ── h. failsSameChecks — pure ────────────────────────────────────────────────────────────────────────────────

describe('failsSameChecks', () => {
  it('true when the control fails every check the candidate failed', () => {
    const candidate = [{ name: 'a' }, { name: 'b' }];
    const control = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    expect(failsSameChecks(candidate, control)).toBe(true);
  });

  it('false when the control is missing one of the candidate\'s failed checks', () => {
    const candidate = [{ name: 'a' }, { name: 'b' }];
    const control = [{ name: 'a' }];
    expect(failsSameChecks(candidate, control)).toBe(false);
  });

  it('false when the control fails a disjoint set of checks', () => {
    expect(failsSameChecks([{ name: 'a' }], [{ name: 'b' }])).toBe(false);
  });

  it('false when the candidate has no failures at all (nothing to compare)', () => {
    expect(failsSameChecks([], [{ name: 'a' }])).toBe(false);
  });

  it('false when the control is empty/absent, whatever the candidate failed', () => {
    expect(failsSameChecks([{ name: 'a' }], [])).toBe(false);
    expect(failsSameChecks([{ name: 'a' }], null)).toBe(false);
    expect(failsSameChecks([{ name: 'a' }], undefined)).toBe(false);
  });
});
