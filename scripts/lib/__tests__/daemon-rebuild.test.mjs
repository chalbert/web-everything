/**
 * @file scripts/lib/__tests__/daemon-rebuild.test.mjs
 * @description Module C (`../daemon-rebuild.mjs`) — real temp git repos throughout: a bare `origin.git`, a
 *   working `clone` (the thing under test, exactly the shape a real daemon clone has: on `main`, tracking
 *   `origin`), and throwaway "author" clones used only to push commits/branches from OUTSIDE the daemon clone's
 *   own working tree — the daemon clone itself must stay clean and on `main` for `findUnsafeLocalState` to pass,
 *   so no test ever runs a mutating git command directly against it except through `rebuildClone`/
 *   `dryRunRebuild` themselves (the two "dirty"/"local-commits" tests are the deliberate exceptions — they
 *   dirty the clone on purpose to prove it gets refused). `runSmoke` and `prState` are always injected fakes —
 *   this suite never spawns the real live smoke gate or a real `gh` call. Every state/lock/overlay dir is a
 *   fresh mkdtemp per fixture via `env`, never `~/.claude/*`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  planRebuild, findUnsafeLocalState, rebuildClone, dryRunRebuild, readRebuildState, rebuildStatePath,
} from '../daemon-rebuild.mjs';
import { addOverlay, readOverlays, overlayFilePath } from '../daemon-overlays.mjs';

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

/** A throwaway clone of `originDir`, used to push commits/branches without ever touching the daemon clone
 *  under test. Its parent dir is registered for cleanup (the clone itself doesn't need separate registration). */
function makeAuthorClone(originDir) {
  const parent = mktemp('we-daemon-rebuild-author-');
  const dir = join(parent, 'w');
  const r = spawnSync('git', ['clone', '-q', originDir, dir], {
    encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
  if (r.status !== 0) throw new Error(`clone failed: ${r.stderr}`);
  return dir;
}

/** Push one new commit onto `ref` (created from `base`, default `origin/main`) via a throwaway author clone.
 *  Returns the pushed commit sha. */
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

/** Advance `main` on origin with one new commit via a throwaway author clone. */
function advanceMain(originDir, mutate) {
  return pushBranch(originDir, 'main', mutate, { base: 'origin/main' });
}

function deleteBranch(originDir, ref) {
  const dir = makeAuthorClone(originDir);
  gitOk(dir, ['push', '-q', 'origin', '--delete', ref]);
}

function writeFile(dir, name, content) {
  const full = join(dir, name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Fresh {origin (bare), clone (working tree under test), env} fixture. The clone starts on `main`, clean,
 *  tracking `origin`, one commit. Every per-clone state/lock/overlay dir is a fresh mkdtemp threaded via `env`. */
function makeFixture() {
  const base = mktemp('we-daemon-rebuild-fixture-');
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
  gitOk(cloneDir, ['fetch', '-q', 'origin']); // guarantee refs/remotes/origin/main exists locally

  const stateDir = mktemp('we-daemon-rebuild-state-');
  const lockDir = mktemp('we-daemon-rebuild-lock-');
  const overlayDir = mktemp('we-daemon-rebuild-overlay-');
  const env = {
    ...process.env,
    WE_DAEMON_STATE_DIR: stateDir,
    WE_DAEMON_CLONE_LOCK_ROOT: lockDir,
    WE_DAEMON_OVERLAY_DIR: overlayDir,
  };
  return { base, originDir, cloneDir, stateDir, lockDir, overlayDir, env };
}

function passSmoke() {
  return vi.fn(async () => ({ verdict: 'pass', attempts: 1, smoke: { results: [] } }));
}

// Short lock waits — no reader ever contends in this suite, so acquireWrite should always succeed immediately,
// but keep the budget small regardless per the design spec's "use short lock waits in tests".
const LOCK_OPTS = { waitMs: 2000, pollMs: 20 };

beforeEach(() => {
  tempDirs.length = 0;
});

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe('rebuildClone', () => {
  it('applies a clean overlay', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/clean-a', (dir) => writeFile(dir, 'a.txt', 'hello a\n'));
    addOverlay(cloneDir, { ref: 'lane/clean-a' }, { env });

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(true);
    expect(result.adopted).toBe(true);
    expect(runSmoke).toHaveBeenCalledTimes(1);
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(result.head);
    expect(existsSync(join(cloneDir, 'a.txt'))).toBe(true);
    expect(readOverlays(cloneDir, { env }).map((o) => o.ref)).toEqual(['lane/clean-a']);

    const state = readRebuildState(cloneDir, env);
    expect(state.adopted?.head).toBe(result.head);
  });

  it('removes an overlay whose content already landed on main in a different (squashed) form', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/squashed', (dir) => writeFile(dir, 'squash.txt', 'same content\n'));
    // main picks up the SAME content plus an unrelated change in ONE commit — a different patch-id than the
    // overlay's own commit, so `git cherry` will NOT see it as upstream-equivalent; only the tree-equality
    // fallback (planRebuild step 5) catches this.
    advanceMain(originDir, (dir) => {
      writeFile(dir, 'squash.txt', 'same content\n');
      writeFile(dir, 'unrelated.txt', 'noise\n');
    });
    addOverlay(cloneDir, { ref: 'lane/squashed' }, { env });

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(true);
    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(result.alerts.some((a) => a.kind === 'overlay-auto-dropped' && a.detail?.reason === 'in-main')).toBe(true);
    expect(existsSync(join(cloneDir, 'unrelated.txt'))).toBe(true);
    expect(existsSync(join(cloneDir, 'squash.txt'))).toBe(true);
  });

  it('drops a conflicting overlay but still applies a clean one, and the conflicting ref stays in the list', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    writeFile(cloneDir, 'shared.txt', 'original\n');
    gitOk(cloneDir, ['add', '-A']);
    gitOk(cloneDir, ['commit', '-q', '-m', 'seed shared.txt']);
    gitOk(cloneDir, ['push', '-q', 'origin', 'main']);

    pushBranch(originDir, 'lane/conflict', (dir) => writeFile(dir, 'shared.txt', 'overlay change\n'));
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.txt', 'main change\n'));
    pushBranch(originDir, 'lane/clean-b', (dir) => writeFile(dir, 'b.txt', 'hello b\n'));

    addOverlay(cloneDir, { ref: 'lane/conflict' }, { env });
    addOverlay(cloneDir, { ref: 'lane/clean-b' }, { env });

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(true);
    const refs = readOverlays(cloneDir, { env }).map((o) => o.ref);
    expect(refs).toEqual(['lane/conflict', 'lane/clean-b']); // conflict stays in the list, unchanged position
    expect(result.alerts.some((a) => a.kind === 'overlay-conflict-dropped')).toBe(true);
    expect(existsSync(join(cloneDir, 'b.txt'))).toBe(true);
  });

  it('removes an overlay whose PR is MERGED', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/merged-pr', (dir) => writeFile(dir, 'c.txt', 'hello c\n'));
    addOverlay(cloneDir, { ref: 'lane/merged-pr', pr: 42 }, { env });

    const runSmoke = passSmoke();
    const prState = vi.fn(async (pr) => (pr === 42 ? 'MERGED' : null));
    const result = await rebuildClone({ root: cloneDir, env, runSmoke, prState, lockOpts: LOCK_OPTS });

    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(result.alerts.some((a) => a.kind === 'overlay-auto-dropped' && a.detail?.reason === 'pr-merged')).toBe(true);
    expect(existsSync(join(cloneDir, 'c.txt'))).toBe(false);
  });

  it('removes an overlay whose ref was deleted on origin', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/gone', (dir) => writeFile(dir, 'd.txt', 'hello d\n'));
    addOverlay(cloneDir, { ref: 'lane/gone' }, { env });
    deleteBranch(originDir, 'lane/gone');

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(result.alerts.some((a) => a.kind === 'overlay-auto-dropped' && a.detail?.reason === 'ref-gone')).toBe(true);
    expect(existsSync(join(cloneDir, 'd.txt'))).toBe(false);
  });

  it('refuses a dirty tree (uncommitted change to a TRACKED file) without touching anything', async () => {
    const { cloneDir, env } = makeFixture();
    writeFile(cloneDir, 'README.md', 'oops uncommitted edit\n'); // README.md is tracked (see makeFixture)
    const headBefore = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('dirty');
    expect(runSmoke).not.toHaveBeenCalled();
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(headBefore);
    expect(readFileSync(join(cloneDir, 'README.md'), 'utf8')).toBe('oops uncommitted edit\n');
  });

  it('an untracked, non-ignored file never blocks the rebuild — it adopts and the file survives untouched', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/clean-stray', (dir) => writeFile(dir, 'stray-overlay.txt', 'hello\n'));
    addOverlay(cloneDir, { ref: 'lane/clean-stray' }, { env });
    writeFile(cloneDir, 'stray.txt', 'untracked and harmless\n');

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(true);
    expect(result.adopted).toBe(true);
    expect(result.reason).not.toBe('dirty');
    expect(result.reason).not.toBe('untracked-collision');
    expect(existsSync(join(cloneDir, 'stray.txt'))).toBe(true);
    expect(readFileSync(join(cloneDir, 'stray.txt'), 'utf8')).toBe('untracked and harmless\n');
    expect(result.alerts.some((a) => a.kind === 'untracked-kept'
      && a.detail?.paths?.includes('stray.txt'))).toBe(true);
  });

  it('an untracked file colliding with a path the new main adds refuses with untracked-collision', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    const headBefore = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();
    advanceMain(originDir, (dir) => writeFile(dir, 'newfile.txt', 'from main\n'));
    writeFile(cloneDir, 'newfile.txt', 'local untracked content\n');

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('untracked-collision');
    expect(result.untracked).toEqual(['newfile.txt']);
    expect(runSmoke).not.toHaveBeenCalled();
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(headBefore);
    expect(readFileSync(join(cloneDir, 'newfile.txt'), 'utf8')).toBe('local untracked content\n');
    expect(result.alerts.some((a) => a.kind === 'untracked-collision'
      && a.detail?.paths?.includes('newfile.txt'))).toBe(true);
  });

  it('refuses a local unpushed commit', async () => {
    const { cloneDir, env } = makeFixture();
    writeFile(cloneDir, 'local-only.txt', 'local\n');
    gitOk(cloneDir, ['add', '-A']);
    gitOk(cloneDir, ['commit', '-q', '-m', 'local commit never pushed']);
    const headBefore = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('local-commits');
    expect(runSmoke).not.toHaveBeenCalled();
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(headBefore);
  });

  it('smoke "code" restores HEAD, records the rejection, and the next call short-circuits without smoking', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/broken', (dir) => writeFile(dir, 'broken.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/broken' }, { env });
    const prevHead = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();

    const runSmoke = vi.fn(async () => ({
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    }));
    const first = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(first.reason).toBe('smoke-rejected');
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(prevHead);
    expect(readRebuildState(cloneDir, env).rejected).toBeTruthy();

    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(second.reason).toBe('still-rejected');
    expect(runSmoke).toHaveBeenCalledTimes(1); // not called again
  });

  it('smoke "transient" restores HEAD, never records a rejection, and re-runs smoke next call', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/flaky', (dir) => writeFile(dir, 'flaky.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/flaky' }, { env });
    const prevHead = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();

    const runSmoke = vi.fn(async () => ({
      verdict: 'transient', attempts: 3, smoke: { results: [{ ok: false, name: 'x', detail: 'ETIMEDOUT' }] },
    }));
    const first = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(first.reason).toBe('smoke-transient');
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(prevHead);
    expect(readRebuildState(cloneDir, env).rejected).toBeNull();

    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(second.reason).toBe('smoke-transient');
    expect(runSmoke).toHaveBeenCalledTimes(2); // re-ran, not short-circuited
  });

  it('is deterministic — the same inputs twice yield up-to-date and the identical finalSha', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/det', (dir) => writeFile(dir, 'det.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/det' }, { env });

    const runSmoke = passSmoke();
    const first = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(first.moved).toBe(true);

    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(second.moved).toBe(false);
    expect(second.reason).toBe('up-to-date');
    expect(second.plan.finalSha).toBe(first.head);
  });

  it('recovers a stale index.lock and proceeds', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'e.txt', 'x\n'));
    const lockPath = join(cloneDir, '.git', 'index.lock');
    writeFileSync(lockPath, '');
    const oldSeconds = Date.now() / 1000 - 3600;
    utimesSync(lockPath, oldSeconds, oldSeconds);

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.alerts.some((a) => a.kind === 'index-lock-recovered')).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
    expect(result.moved).toBe(true);
  });

  // Advisory 2026-09-25 (PR #2625): a corrupt overlay file read as "no overlays", so the next rebuild silently
  // built main alone and dropped every registered fix, with no alert anywhere.
  it('a corrupt overlay-state file refuses the rebuild with an alert, never builds main alone', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/kept', (dir) => writeFile(dir, 'kept.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/kept' }, { env });
    const first = await rebuildClone({ root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS });
    expect(first.adopted).toBe(true);
    const headBefore = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();
    advanceMain(originDir, (dir) => writeFile(dir, 'main-next.txt', 'y\n'));
    writeFileSync(overlayFilePath(cloneDir, env), '{ not json');

    const runSmoke = passSmoke();
    const result = await rebuildClone({ root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('overlay-state-corrupt');
    expect(result.alerts.some((a) => a.kind === 'overlay-state-corrupt')).toBe(true);
    expect(runSmoke).not.toHaveBeenCalled();
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(headBefore);
    expect(existsSync(join(cloneDir, 'kept.txt'))).toBe(true);
    expect(readFileSync(overlayFilePath(cloneDir, env), 'utf8')).toBe('{ not json'); // left for a person to inspect

    const preview = await dryRunRebuild({ root: cloneDir, env, prState: async () => null });
    expect(preview.overlayStateCorrupt).toBe(true);
    expect(preview.wouldDo).toBe('refuse');
  });

  // Advisory 2026-09-25 (PR #2625): a kept untracked file was reported only on ticks that moved the tree, so it
  // could sit in the clone through every no-op tick with no signal.
  it('a kept untracked file is re-reported on every tick, including an up-to-date one', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/tick', (dir) => writeFile(dir, 'tick.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/tick' }, { env });
    writeFile(cloneDir, 'planted.txt', 'untracked\n');
    const opts = { root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS };
    expect((await rebuildClone(opts)).adopted).toBe(true);

    const second = await rebuildClone(opts);
    expect(second.reason).toBe('up-to-date');
    expect(second.alerts.some((a) => a.kind === 'untracked-kept' && a.detail?.paths?.includes('planted.txt'))).toBe(true);
    expect(existsSync(join(cloneDir, 'planted.txt'))).toBe(true);
  });

  it('mainOnly ignores every overlay', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/refused', (dir) => writeFile(dir, 'f.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/refused' }, { env });

    const runSmoke = passSmoke();
    const result = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, mainOnly: true, lockOpts: LOCK_OPTS,
    });

    expect(result.alerts.some((a) => a.kind === 'overlays-refused-main-only')).toBe(true);
    expect(existsSync(join(cloneDir, 'f.txt'))).toBe(false);
    expect(readOverlays(cloneDir, { env })).toHaveLength(1); // never removed — just ignored this pass
    expect(runSmoke).not.toHaveBeenCalled(); // main alone == current HEAD already, nothing to build
  });

  // Module E follow-up (#4044) — an already-ADOPTED overlay's own commit becomes unreachable from any remote
  // ref once its PR is squash-merged (a different sha lands on main) AND its origin branch is deleted for
  // cleanup — exactly the shape a normal squash-merge-and-delete-branch PR leaves behind. Before `knownInputs`
  // fed the adopted state's own shas into `findUnsafeLocalState`, that orphaned commit (reachable from HEAD via
  // the earlier rebuild's merge commit, but from no remaining remote-tracking ref) looked exactly like a real
  // local commit and froze the rebuild with `local-commits`, forever, on a perfectly safe clone.
  it('an adopted overlay squash-merged + branch-deleted on origin is auto-dropped next rebuild — never refused as local-commits', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/squash-drop', (dir) => writeFile(dir, 'squash-drop.txt', 'overlay content\n'));
    addOverlay(cloneDir, { ref: 'lane/squash-drop' }, { env });

    const runSmoke = passSmoke();
    const first = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(first.moved).toBe(true);
    expect(first.adopted).toBe(true);
    expect(existsSync(join(cloneDir, 'squash-drop.txt'))).toBe(true);

    // Origin: the overlay's content lands on main as a squash (a NEW, different commit than the overlay's own),
    // then its own branch is deleted — the overlay's original commit is now reachable from HEAD (via the first
    // rebuild's merge commit) but from no remaining remote-tracking ref at all.
    advanceMain(originDir, (dir) => writeFile(dir, 'squash-drop.txt', 'overlay content\n'));
    deleteBranch(originDir, 'lane/squash-drop');

    const second = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(second.reason).not.toBe('local-commits');
    expect(second.moved).toBe(true);
    expect(readOverlays(cloneDir, { env })).toEqual([]);
    expect(second.alerts.some((a) => a.kind === 'overlay-auto-dropped' && a.detail?.reason === 'ref-gone')).toBe(true);
    expect(existsSync(join(cloneDir, 'squash-drop.txt'))).toBe(true);
    // Lands on PLAIN main — no overlay merge commit left in the picture.
    expect(gitOk(cloneDir, ['rev-parse', 'HEAD']).trim()).toBe(gitOk(cloneDir, ['rev-parse', 'origin/main']).trim());
  });

  /** Seed `state.quarantine` exactly as a failed rollback leaves it (rebuildClone's own state file). */
  function seedQuarantine(cloneDir, env, prevHead) {
    const file = rebuildStatePath(cloneDir, env);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ quarantine: { prevHead, reason: 'smoke-code-rollback-failed' } }));
  }

  it('recovers from quarantine even when a harmless untracked file sits in the tree', async () => {
    const { cloneDir, env } = makeFixture();
    seedQuarantine(cloneDir, env, gitOk(cloneDir, ['rev-parse', 'HEAD']).trim());
    writeFile(cloneDir, 'daemon-sidecar.json', '{}\n'); // untracked, not ignored, absent from prevHead's tree

    const result = await rebuildClone({
      root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.reason).not.toBe('quarantined');
    expect(readRebuildState(cloneDir, env).quarantine).toBeNull();
    expect(readFileSync(join(cloneDir, 'daemon-sidecar.json'), 'utf8')).toBe('{}\n'); // kept, never deleted
  });

  it('stays quarantined when a tracked file is dirty', async () => {
    const { cloneDir, env } = makeFixture();
    seedQuarantine(cloneDir, env, gitOk(cloneDir, ['rev-parse', 'HEAD']).trim());
    writeFile(cloneDir, 'README.md', 'local edit\n');

    const result = await rebuildClone({
      root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.reason).toBe('quarantined');
    expect(readRebuildState(cloneDir, env).quarantine).not.toBeNull();
    expect(readFileSync(join(cloneDir, 'README.md'), 'utf8')).toBe('local edit\n');
  });

  it('stays quarantined rather than let the recovery reset overwrite an untracked file prevHead has content at', async () => {
    const { cloneDir, env } = makeFixture();
    writeFile(cloneDir, 'collide.txt', 'tracked at prevHead\n');
    gitOk(cloneDir, ['add', '-A']);
    gitOk(cloneDir, ['commit', '-q', '-m', 'add collide.txt']);
    const prevHead = gitOk(cloneDir, ['rev-parse', 'HEAD']).trim();
    gitOk(cloneDir, ['rm', '-q', 'collide.txt']);
    gitOk(cloneDir, ['commit', '-q', '-m', 'drop collide.txt']);
    gitOk(cloneDir, ['push', '-q', 'origin', 'main']);
    seedQuarantine(cloneDir, env, prevHead);
    writeFile(cloneDir, 'collide.txt', 'untracked local content\n');

    const result = await rebuildClone({
      root: cloneDir, env, runSmoke: passSmoke(), prState: async () => null, lockOpts: LOCK_OPTS,
    });

    expect(result.reason).toBe('quarantined');
    expect(readRebuildState(cloneDir, env).quarantine).not.toBeNull();
    expect(readFileSync(join(cloneDir, 'collide.txt'), 'utf8')).toBe('untracked local content\n');
  });
});

describe('dryRunRebuild', () => {
  it('leaves the clone byte-identical and reports the plan', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/preview', (dir) => writeFile(dir, 'g.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/preview' }, { env });
    advanceMain(originDir, (dir) => writeFile(dir, 'h.txt', 'y\n'));

    const snapshot = () => {
      const gitDir = join(cloneDir, '.git');
      let objectsCount = 0;
      const walk = (d) => {
        let entries;
        try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (entry.name === 'info' || entry.name === 'pack') continue;
          const p = join(d, entry.name);
          if (entry.isDirectory()) walk(p); else objectsCount += 1;
        }
      };
      walk(join(gitDir, 'objects'));
      const indexPath = join(gitDir, 'index');
      const fetchHeadPath = join(gitDir, 'FETCH_HEAD');
      return {
        head: gitOk(cloneDir, ['rev-parse', 'HEAD']).trim(),
        forEachRef: gitOk(cloneDir, ['for-each-ref']),
        objectsCount,
        indexMtime: existsSync(indexPath) ? statSync(indexPath).mtimeMs : null,
        fetchHeadPresent: existsSync(fetchHeadPath),
        fetchHeadMtime: existsSync(fetchHeadPath) ? statSync(fetchHeadPath).mtimeMs : null,
      };
    };

    const before = snapshot();
    const result = await dryRunRebuild({ root: cloneDir, env, prState: async () => null });
    const after = snapshot();

    expect(after).toEqual(before);
    expect(result.dryRun).toBe(true);
    expect(result.onMain).toBe(true);
    expect(result.unsafe.safe).toBe(true);
    expect(result.plan.ok).toBe(true);
    expect(result.wouldDo).toBe('rebuild-and-smoke');
    expect(result.overlays.map((o) => o.ref)).toEqual(['lane/preview']);
  });

  it('reports "nothing" when there is nothing to build', async () => {
    const { cloneDir, env } = makeFixture();
    const result = await dryRunRebuild({ root: cloneDir, env, prState: async () => null });
    expect(result.wouldDo).toBe('nothing');
    expect(result.plan.finalSha).toBe(result.head);
  });

  // Module E (#4044) — daemon-load-overlay.mjs's own `--dry-run` previews "what if I registered this ref too"
  // without ever writing the overlay list.
  it('extraOverlays are appended after the stored list, fed into the plan, and NEVER written to disk', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/virtual', (dir) => writeFile(dir, 'virtual.txt', 'x\n'));
    expect(readOverlays(cloneDir, { env })).toEqual([]);

    const result = await dryRunRebuild({
      root: cloneDir, env, prState: async () => null, extraOverlays: [{ ref: 'lane/virtual', pr: null }],
    });

    expect(result.wouldDo).toBe('rebuild-and-smoke');
    expect(result.plan.applied.map((a) => a.ref)).toEqual(['lane/virtual']);
    expect(result.overlays.map((o) => o.ref)).toEqual(['lane/virtual']);
    expect(readOverlays(cloneDir, { env })).toEqual([]); // still never written
  });

  it('reports stillRejected + "nothing (still-rejected)" when the plan matches the last recorded rejection', async () => {
    const { originDir, cloneDir, env } = makeFixture();
    pushBranch(originDir, 'lane/rejected', (dir) => writeFile(dir, 'rejected.txt', 'x\n'));
    addOverlay(cloneDir, { ref: 'lane/rejected' }, { env });

    const runSmoke = vi.fn(async () => ({
      verdict: 'code', attempts: 1, smoke: { results: [{ ok: false, name: 'x', detail: 'boom' }] },
    }));
    const rebuildResult = await rebuildClone({
      root: cloneDir, env, runSmoke, prState: async () => null, lockOpts: LOCK_OPTS,
    });
    expect(rebuildResult.reason).toBe('smoke-rejected');

    const preview = await dryRunRebuild({ root: cloneDir, env, prState: async () => null });
    expect(preview.stillRejected).toBe(true);
    expect(preview.wouldDo).toBe('nothing (still-rejected)');
    expect(preview.state.rejected).toBeTruthy();
  });
});

describe('findUnsafeLocalState / planRebuild (pure core)', () => {
  function gitFor(cwd) {
    return (args) => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
      return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
    };
  }

  it('findUnsafeLocalState reports safe on a clean tree with nothing local', () => {
    const { cloneDir } = makeFixture();
    expect(findUnsafeLocalState({ git: gitFor(cloneDir) })).toEqual({ safe: true, untracked: [] });
  });

  it('findUnsafeLocalState reports untracked paths without them affecting safe', () => {
    const { cloneDir } = makeFixture();
    writeFile(cloneDir, 'loose.txt', 'x\n');
    expect(findUnsafeLocalState({ git: gitFor(cloneDir) })).toEqual({ safe: true, untracked: ['loose.txt'] });
  });

  it('planRebuild reports main-unresolved when mainRef does not exist', async () => {
    const { cloneDir } = makeFixture();
    const plan = await planRebuild({
      git: gitFor(cloneDir), headSha: 'deadbeef', mainRef: 'origin/does-not-exist', overlays: [],
    });
    expect(plan).toEqual({ ok: false, reason: 'main-unresolved' });
  });
});
