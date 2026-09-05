/**
 * @file scripts/conveyor/__tests__/branch-sync.test.mjs
 * @description Proof for the #3472 bounded-retry/escalate sync loop, in three layers:
 *
 *   1. The PURE core ({@link conflictSignature}, {@link decideEscalation}) on injected values — no git, no fs.
 *   2. The full retry/escalate STATE MACHINE ({@link runSyncOnce}) against a FAKE git effect + a REAL temp-dir
 *      filesystem for the state/alert JSON — proves the attempt-counting, backoff-waiting, escalation-dedup,
 *      and re-nag logic deterministically and fast, with an injected clock (no real sleeping).
 *   3. The CLI, against a REAL throwaway git fixture (mirrors `branch-drift.test.mjs`'s own `buildFixture`) —
 *      including the item's own Done-when shape: two branches whose commits are each individually in-scope
 *      (disjoint files) but collide once merged (both also edit `shared.txt`). Proves the CLI (a) never leaves
 *      the working tree in a conflicted state, (b) escalates exactly once — not every tick — once the attempt
 *      cap is hit, and (c) auto-resyncs the moment the upstream conflict is resolved, matching the item's
 *      "resolves automatically within its own retry policy, or surfaces durably" Done-when bar. This is the
 *      "run it against a REAL conflict scenario" proof, not just the pure logic in isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conflictSignature, decideEscalation, runSyncOnce } from '../branch-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SYNC_CLI = resolve(HERE, '..', 'branch-sync.mjs');

// ── 1. the pure core ─────────────────────────────────────────────────────────────────────────────────────────

describe('conflictSignature — the pure core', () => {
  it('is a stable, non-empty fingerprint of the same text', () => {
    const a = conflictSignature('CONFLICT (content): Merge conflict in shared.txt');
    const b = conflictSignature('CONFLICT (content): Merge conflict in shared.txt');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('differs for different conflict text', () => {
    expect(conflictSignature('conflict in a.txt')).not.toBe(conflictSignature('conflict in b.txt'));
  });

  it('blank/empty input → null (nothing to fingerprint)', () => {
    expect(conflictSignature('')).toBeNull();
    expect(conflictSignature('   \n  ')).toBeNull();
    expect(conflictSignature(undefined)).toBeNull();
  });
});

describe('decideEscalation — the pure core', () => {
  it('no signature → never fires', () => {
    expect(decideEscalation({ signature: null }).fire).toBe(false);
  });

  it('first-ever escalation (no lastAlert) fires', () => {
    const r = decideEscalation({ signature: 'abc123', lastAlert: null, nowMs: 1000 });
    expect(r.fire).toBe(true);
    expect(r.record).toEqual({ at: new Date(1000).toISOString(), signature: 'abc123' });
  });

  it('same signature, well within the re-nag window → does NOT re-fire', () => {
    const lastAlert = { at: new Date(1000).toISOString(), signature: 'abc123' };
    const r = decideEscalation({ signature: 'abc123', lastAlert, nowMs: 1000 + 1000, renagMs: 30 * 60_000 });
    expect(r.fire).toBe(false);
  });

  it('same signature, past the re-nag window → fires again', () => {
    const lastAlert = { at: new Date(1000).toISOString(), signature: 'abc123' };
    const r = decideEscalation({ signature: 'abc123', lastAlert, nowMs: 1000 + 60_000, renagMs: 30_000 });
    expect(r.fire).toBe(true);
  });

  it('a CHANGED signature fires immediately, ignoring the re-nag window', () => {
    const lastAlert = { at: new Date(1000).toISOString(), signature: 'abc123' };
    const r = decideEscalation({ signature: 'different', lastAlert, nowMs: 1000 + 1, renagMs: 30 * 60_000 });
    expect(r.fire).toBe(true);
  });
});

// ── 2. the retry/escalate state machine — fake git, real temp-dir fs, injected clock ──────────────────────────

describe('runSyncOnce — the retry/escalate state machine (fake git, real fs)', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'we-branch-sync-unit-')); });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

  /** A scripted git effect: always reports 5 commits behind / 0 ahead, and a merge-tree conflict whose text is
   *  swappable mid-test (to exercise a signature CHANGE). Records every call. */
  function makeFakeGit({ conflictText = 'CONFLICT (content): Merge conflict in shared.txt' } = {}) {
    const calls = [];
    let text = conflictText;
    const git = (args) => {
      calls.push(args);
      const cmd = args[0];
      if (cmd === 'fetch') return { ok: true, stdout: '', stderr: '' };
      if (cmd === 'rev-list') return { ok: true, stdout: '5\t0\n', stderr: '' };
      if (cmd === 'merge-tree') return { ok: false, stdout: text, stderr: '' };
      if (cmd === 'merge' && args.includes('--abort')) return { ok: true, stdout: '', stderr: '' };
      throw new Error(`unexpected git call in this fake: ${args.join(' ')}`);
    };
    return { git, calls, setConflictText: (t) => { text = t; } };
  }

  it('never touches the working tree on a conflicting probe — no `merge` (only `merge-tree`) is ever invoked past the first probe', () => {
    const { git, calls } = makeFakeGit();
    const notifies = [];
    runSyncOnce({
      cwd: dir, git, now: 1000, statePath: join(dir, 't1-state.json'), alertPath: join(dir, 't1-alert.json'),
      logPath: join(dir, 't1.log'), notify: (e) => notifies.push(e), appendLog: () => {}, maxAttempts: 3,
      backoff: { baseMs: 10, factor: 2, capMs: 100 },
    });
    expect(calls.some((a) => a[0] === 'merge' && !a.includes('--abort'))).toBe(false);
  });

  it('first conflict → attempt 1, no escalation yet', () => {
    const { git } = makeFakeGit();
    const notifies = [];
    const r = runSyncOnce({
      cwd: dir, git, now: 1000, statePath: join(dir, 't2-state.json'), alertPath: join(dir, 't2-alert.json'),
      logPath: join(dir, 't2.log'), notify: (e) => notifies.push(e), appendLog: () => {}, maxAttempts: 3,
      backoff: { baseMs: 10, factor: 2, capMs: 100 },
    });
    expect(r).toMatchObject({ status: 'conflict', attempt: 1 });
    expect(notifies).toHaveLength(0);
    expect(existsSync(join(dir, 't2-alert.json'))).toBe(false);
  });

  it('within the backoff window → waits (no attempt bump, no fs write needed)', () => {
    const { git } = makeFakeGit();
    const statePath = join(dir, 't3-state.json');
    const alertPath = join(dir, 't3-alert.json');
    const common = { cwd: dir, git, statePath, alertPath, logPath: join(dir, 't3.log'), appendLog: () => {}, maxAttempts: 3, backoff: { baseMs: 10, factor: 2, capMs: 100 } };
    runSyncOnce({ ...common, now: 1000 }); // attempt 1, nextRetryAt = 1010
    const r = runSyncOnce({ ...common, now: 1005 }); // still within the 10ms backoff
    expect(r.status).toBe('waiting');
    expect(JSON.parse(readFileSync(statePath, 'utf8')).attempt).toBe(1); // unchanged — a wait tick doesn't count as an attempt
  });

  it('the FULL escalation lifecycle: bounded retries → escalate once → dedup while stuck → re-nag after the window → resolves and clears', () => {
    const { git, setConflictText } = makeFakeGit();
    const notifies = [];
    const statePath = join(dir, 't4-state.json');
    const alertPath = join(dir, 't4-alert.json');
    const logLines = [];
    const common = {
      cwd: dir, git, statePath, alertPath, logPath: join(dir, 't4.log'),
      notify: (e) => notifies.push(e), appendLog: (_p, line) => logLines.push(line),
      maxAttempts: 3, backoff: { baseMs: 10, factor: 2, capMs: 100 }, renagMs: 50,
      driftSweep: () => {},
    };

    let r = runSyncOnce({ ...common, now: 1000 }); // attempt 1 (first failure)
    expect(r).toMatchObject({ status: 'conflict', attempt: 1 });

    r = runSyncOnce({ ...common, now: 1011 }); // backoff elapsed → retry → attempt 2
    expect(r).toMatchObject({ status: 'conflict', attempt: 2 });

    r = runSyncOnce({ ...common, now: 1032 }); // backoff elapsed → retry → attempt 3 == maxAttempts, but this
    // tick's retryDecision reads the PRE-bump attempt (2 < 3) so it still classifies as one more retry, bumping to 3.
    expect(r).toMatchObject({ status: 'conflict', attempt: 3 });
    expect(notifies).toHaveLength(0); // not escalated yet

    r = runSyncOnce({ ...common, now: 1100 }); // attempt (3) >= maxAttempts (3) → SURFACE → escalate
    expect(r).toMatchObject({ status: 'escalated', attempt: 3, alerted: true });
    expect(notifies).toHaveLength(1);
    expect(existsSync(alertPath)).toBe(true);
    expect(logLines.some((l) => l.includes('ESCALATED'))).toBe(true);

    r = runSyncOnce({ ...common, now: 1110 }); // still stuck, same signature, well within the 50ms re-nag window
    expect(r).toMatchObject({ status: 'escalated', alerted: false });
    expect(notifies).toHaveLength(1); // NOT re-notified — this is the "not every tick" property the item requires

    r = runSyncOnce({ ...common, now: 1170 }); // past the 50ms re-nag window, same conflict
    expect(r).toMatchObject({ status: 'escalated', alerted: true });
    expect(notifies).toHaveLength(2);

    setConflictText('CONFLICT (content): Merge conflict in a totally different file');
    r = runSyncOnce({ ...common, now: 1171 }); // signature CHANGED → fires immediately, ignoring the re-nag window
    expect(r).toMatchObject({ status: 'escalated', alerted: true });
    expect(notifies).toHaveLength(3);

    // Now the upstream conflict resolves (behind:0 from here on) — the loop must auto-clear, not stay "stuck".
    const resolvedGit = (args) => (args[0] === 'fetch' ? { ok: true, stdout: '', stderr: '' } : args[0] === 'rev-list' ? { ok: true, stdout: '0\t0\n', stderr: '' } : (() => { throw new Error('unexpected'); })());
    r = runSyncOnce({ ...common, git: resolvedGit, now: 1200 });
    expect(r).toMatchObject({ status: 'fresh' });
    expect(existsSync(statePath)).toBe(false);
    expect(existsSync(alertPath)).toBe(false);
  });

  it('offline (fetch fails) is a soft no-op, never a conflict/attempt', () => {
    const offlineGit = (args) => (args[0] === 'fetch' ? { ok: false, stdout: '', stderr: 'could not resolve host' } : (() => { throw new Error('should not reach past fetch'); })());
    const r = runSyncOnce({ cwd: dir, git: offlineGit, now: 1000, statePath: join(dir, 't5-state.json'), alertPath: join(dir, 't5-alert.json'), logPath: join(dir, 't5.log'), appendLog: () => {} });
    expect(r.status).toBe('offline');
    expect(existsSync(join(dir, 't5-state.json'))).toBe(false);
  });
});

// ── 3. the CLI — a REAL throwaway git conflict fixture, no network ─────────────────────────────────────────────

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const runOnce = (cwd, extra = []) => JSON.parse(execFileSync('node', [SYNC_CLI, 'once', '--json', ...extra], { cwd, encoding: 'utf8' }));

let root;
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'we-branch-sync-cli-')); });
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

/** Build the #3472 incident shape: a bare `origin`, `main`, and a long-lived `feature` branch (standing in for
 *  `lane/mechanical-dispatcher`) that each commit to DIFFERENT files (individually in-scope) but ALSO both
 *  edit `shared.txt` to different content (colliding once merged) — the exact fixture pattern
 *  `branch-drift.test.mjs`'s own `buildFixture` uses for the identical incident. Returns a clone checked out
 *  on `feature` — the scratch checkout this loop runs inside. */
function buildConflictFixture(name) {
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
  writeFileSync(join(seed, 'shared.txt'), 'branch-version\n');
  git(['add', 'shared.txt'], seed);
  git(['commit', '-q', '-m', 'feature: f0 + shared edit'], seed);
  git(['push', '-q', 'origin', 'feature'], seed);

  git(['checkout', '-q', 'main'], seed);
  writeFileSync(join(seed, 'm0.txt'), 'm0\n');
  git(['add', 'm0.txt'], seed);
  writeFileSync(join(seed, 'shared.txt'), 'main-version\n');
  git(['add', 'shared.txt'], seed);
  git(['commit', '-q', '-m', 'main: m0 + shared edit'], seed);
  git(['push', '-q', 'origin', 'main'], seed);

  const clone = join(dir, 'clone');
  git(['clone', '-q', bare, clone]);
  git(['checkout', '-q', 'feature'], clone);
  return { dir, bare, seed, clone };
}

describe('branch-sync.mjs CLI — real fixture repo, real merge-tree, real merge (#3472)', () => {
  it('the incident shape: bounded retries → escalates exactly once → working tree NEVER left conflicted → auto-resyncs once upstream resolves', () => {
    const { clone, seed } = buildConflictFixture('incident');
    const alertPath = join(clone, '.git', 'branch-sync-alert.json');
    const extra = ['--base=main', '--ref-name=main-fresh', '--max-attempts=2', '--base-ms=1', '--cap-ms=5'];

    const clean = () => {
      // --untracked-files=no: the loop's own sync.log is expected clutter; what matters is no STAGED/modified
      // tracked change (i.e. never mid-merge).
      const status = git(['status', '--porcelain', '--untracked-files=no'], clone);
      expect(status.trim()).toBe(''); // never left mid-merge
      expect(existsSync(join(clone, '.git', 'MERGE_HEAD'))).toBe(false);
    };

    const r1 = runOnce(clone, extra);
    expect(r1.status).toBe('conflict');
    expect(r1.attempt).toBe(1);
    clean();
    expect(existsSync(alertPath)).toBe(false);

    const r2 = runOnce(clone, extra); // backoff (≤2ms) has long since elapsed by the time this subprocess spawns
    expect(r2.status).toBe('conflict');
    expect(r2.attempt).toBe(2);
    clean();

    const r3 = runOnce(clone, extra); // attempt (2) >= maxAttempts (2) → escalate
    expect(r3.status).toBe('escalated');
    expect(r3.alerted).toBe(true);
    clean();
    expect(existsSync(alertPath)).toBe(true);
    const alert = JSON.parse(readFileSync(alertPath, 'utf8'));
    expect(alert.signature).toMatch(/^[0-9a-f]{12}$/);

    const r4 = runOnce(clone, extra); // still stuck, same conflict — must NOT re-notify every tick
    expect(r4.status).toBe('escalated');
    expect(r4.alerted).toBe(false);
    clean();

    // Resolve it upstream: main's shared.txt now matches feature's — a real, human-plausible resolution (e.g.
    // main reverted the colliding edit). Pushed from the untouched `seed` checkout.
    git(['checkout', '-q', 'main'], seed);
    writeFileSync(join(seed, 'shared.txt'), 'branch-version\n');
    git(['add', 'shared.txt'], seed);
    git(['commit', '-q', '-m', 'main: resolve the shared.txt collision'], seed);
    git(['push', '-q', 'origin', 'main'], seed);

    const r5 = runOnce(clone, extra); // now a clean merge is possible again
    expect(r5.status).toBe('synced');
    expect(existsSync(join(clone, '.git', 'branch-sync-state.json'))).toBe(false);
    expect(existsSync(alertPath)).toBe(false); // escalation record cleared — no longer stuck
    clean();
    // HEAD actually advanced (both m0.txt and the resolving commit landed).
    expect(existsSync(join(clone, 'm0.txt'))).toBe(true);
  });

  it('a clean, non-colliding divergence merges on the FIRST tick — no state/alert file ever created', () => {
    const dir = join(root, 'clean');
    const bare = join(dir, 'origin.git');
    const seed = join(dir, 'seed');
    mkdirSync(bare, { recursive: true });
    git(['init', '-q', '--bare'], bare);
    mkdirSync(seed, { recursive: true });
    git(['init', '-q'], seed);
    git(['remote', 'add', 'origin', bare], seed);
    writeFileSync(join(seed, 'shared.txt'), 'base\n');
    git(['add', 'shared.txt'], seed);
    git(['commit', '-q', '-m', 'seed'], seed);
    git(['branch', '-M', 'main'], seed);
    git(['push', '-q', 'origin', 'main'], seed);
    git(['checkout', '-q', '-b', 'feature', 'main'], seed);
    writeFileSync(join(seed, 'f0.txt'), 'f0\n');
    git(['add', 'f0.txt'], seed);
    git(['commit', '-q', '-m', 'feature: f0'], seed);
    git(['push', '-q', 'origin', 'feature'], seed);
    git(['checkout', '-q', 'main'], seed);
    writeFileSync(join(seed, 'm0.txt'), 'm0\n');
    git(['add', 'm0.txt'], seed);
    git(['commit', '-q', '-m', 'main: m0'], seed);
    git(['push', '-q', 'origin', 'main'], seed);

    const clone = join(dir, 'clone');
    git(['clone', '-q', bare, clone]);
    git(['checkout', '-q', 'feature'], clone);

    const r = runOnce(clone, ['--base=main', '--ref-name=main-fresh']);
    expect(r.status).toBe('synced');
    expect(existsSync(join(clone, 'm0.txt'))).toBe(true);
    expect(existsSync(join(clone, '.git', 'branch-sync-state.json'))).toBe(false);
    expect(existsSync(join(clone, '.git', 'branch-sync-alert.json'))).toBe(false);
  });

  it('nothing to sync (already fresh) is a clean no-op', () => {
    const dir = join(root, 'fresh');
    const bare = join(dir, 'origin.git');
    const seed = join(dir, 'seed');
    mkdirSync(bare, { recursive: true });
    git(['init', '-q', '--bare'], bare);
    mkdirSync(seed, { recursive: true });
    git(['init', '-q'], seed);
    git(['remote', 'add', 'origin', bare], seed);
    writeFileSync(join(seed, 'shared.txt'), 'base\n');
    git(['add', 'shared.txt'], seed);
    git(['commit', '-q', '-m', 'seed'], seed);
    git(['branch', '-M', 'main'], seed);
    git(['push', '-q', 'origin', 'main'], seed);
    const clone = join(dir, 'clone');
    git(['clone', '-q', bare, clone]);

    const r = runOnce(clone, ['--base=main', '--ref-name=main-fresh']);
    expect(r).toMatchObject({ status: 'fresh', behind: 0 });
  });
});
