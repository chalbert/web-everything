/**
 * @file skills-src/conveyor/__tests__/runner-shutdown-live.test.mjs
 * @description LIVE-SUBPROCESS proof of the two halves of the conveyor runner's SHUTDOWN CONTRACT with
 *   `supervisor.mjs` — the pair of bugs found 2026-09-12 while the epic #3383 prototype branch was running:
 *
 *   (1) THE LEAKED SINGLETON LEASE. `runner.mjs` had ZERO signal handlers, so a SIGTERM — the exact signal
 *       `supervisor.mjs`'s own `shutdown` sends its child, and what a bare `kill` sends — killed it outright.
 *       `driveConveyor`'s `finally` (the only place the lease is released) never unwound, and the lease leaked
 *       for its full 15-minute TTL. `acquireRunnerLease` passes pidLiveness `'unknown'`, so there is no
 *       dead-pid fast path to rescue it: the lock dir just looks live. The user-visible damage is the restart
 *       storm, not the file — the next runner finds a live-looking lease, stands down in well under
 *       `DEFAULT_CRASH_THRESHOLD_MS`, and `classifyExit` scores that `'too-short'` ⇒ CRASH, so the supervisor
 *       backs off, doubles, and eventually fires `crash-loop-at-ceiling` for a conveyor that never crashed.
 *
 *   (2) THE FINAL `--json` EVENT LINE. `supervisor.mjs`'s `makeRealSpawnChild` parses `{event:'stopped',
 *       stoppedReason}` / `{event:'stood-down'}` off the runner's own stdout — the ONLY thing that tells
 *       #3406's idle-stop backoff apart from a polite stand-down (both exit 0). The shape is a cross-module
 *       contract, and a contract only one side can construct is a contract neither side can test.
 *
 * WHY LIVE, not a stub. Both bugs live exactly in what a stub replaces. The first is about whether a REAL
 * signal reaches a REAL handler before a REAL process dies — `vi.fn()` on `process.on` proves the handler was
 * registered, never that SIGTERM unwinds through it. The second is about whether the bytes one module writes
 * are the bytes the other module's parser accepts; the only honest way to check that is to run the real
 * producer into the real consumer. So these cases spawn actual `node` children and send them actual signals.
 * (Same reasoning `./dispatch-spawn-live.test.mjs`'s header gives for exercising a real subprocess path.)
 *
 * COSTS NOTHING AND TOUCHES NOTHING SHARED. No model runs, no `gh`, no git, no network. Every child drives an
 * injected stub tick (`tickOnce` returns a canned object, `sleep` parks forever) — the real tick core is never
 * reached — and every lease lives in a per-test `mkdtemp` lock root, NEVER the machine-global
 * `RUNNER_LOCK_ROOT` under `$HOME` that a developer's own runner is using.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readLockEntry } from '../../../scripts/readiness/file-locks.mjs';
import { RUNNER_LEASE_PATH, acquireRunnerLease } from '../runner-lock.mjs';
import { makeRealSpawnChild, classifyExit, DEFAULT_CRASH_THRESHOLD_MS } from '../supervisor.mjs';

/** Resolved off `process.cwd()` (the repo root under vitest), the convention every other live-subprocess test
 *  here uses — NOT `import.meta.url`, which vitest's SSR transform does not hand back as a `file:` URL. */
const RUNNER_PATH = resolve(process.cwd(), 'skills-src/conveyor/runner.mjs');

/** Generous but bounded — a `node` cold start on a loaded CI box, not a "hope it's done" sleep. Every wait
 *  below is EVENT-driven (a stdout line, an `exit`); this only bounds the failure mode. */
const LIVE_TIMEOUT_MS = 20_000;

// ── the harness child ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Source for a child that holds the REAL singleton lease through the REAL `driveConveyor`, parked in a tick
 * loop that never ends, and — in `handled` mode only — has the REAL `installShutdownHandlers` wired in.
 *
 * It imports the production module rather than re-implementing it, so the only difference between the
 * before-fix and after-fix cases below is the ONE line this repo's fix adds to `main()`. `sleep` parks the
 * loop after tick 1 with the lease held — the state a real resident runner spends ~120 s of every tick in,
 * and precisely when a shutdown signal actually arrives.
 *
 * The park is a REAL `setTimeout`, not a never-settling `new Promise(() => {})`. That distinction is load-
 * bearing and cost a debugging round: a bare pending promise refs nothing on the event loop, so Node finds
 * the loop empty and exits the child on its own (code 13, "unsettled top-level await") before any signal is
 * ever sent — which makes BOTH the before-fix and the after-fix case appear to leak, for a reason that has
 * nothing to do with signals. A timer keeps the process alive exactly as the production runner's own
 * `(ms) => new Promise((r) => setTimeout(r, ms))` sleep does.
 */
const harnessSource = (mode) => `
import { driveConveyor, installShutdownHandlers } from ${JSON.stringify(RUNNER_PATH)};
const [lockRoot, owner] = process.argv.slice(2);
${mode === 'handled' ? 'installShutdownHandlers({ lockRoot, owner });' : '/* NO signal handler — the pre-fix runner */'}
const pending = driveConveyor({
  lockRoot, owner,
  buildEffects: () => ({
    tickOnce: () => ({ decisions: { idleStop: false }, nextState: {} }),
    sleep: () => new Promise((r) => setTimeout(r, 3_600_000)),  // parked, lease held, event loop REF'd
    maxTicks: Infinity,
  }),
});
// \`driveConveyor\` acquires the lease SYNCHRONOUSLY before its first await, so by the time this line runs the
// lock dir is on disk — the parent may signal the moment it reads this.
process.stdout.write('ready\\n');
await pending;
`;

/** Spawn a harness child and resolve once it has announced `ready` (⇒ the lease is on disk). */
function startHarness(dir, mode, lockRoot, owner) {
  const path = join(dir, `harness-${mode}.mjs`);
  writeFileSync(path, harnessSource(mode));
  const child = spawn(process.execPath, [path, lockRoot, owner], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (b) => { stderr += String(b); });
  const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));
  const ready = new Promise((res, rej) => {
    let buf = '';
    child.stdout.on('data', (b) => { buf += String(b); if (buf.includes('ready')) res(); });
    // A child that dies before announcing readiness must FAIL the test loudly with its stderr, never hang
    // until the suite-level timeout kills the whole file with no diagnosis.
    child.on('exit', () => rej(new Error(`harness exited before ready; stderr:\n${stderr}`)));
  });
  return { child, ready, exited, stderrOf: () => stderr };
}

describe('runner shutdown (LIVE) — a SIGTERM must release the singleton lease, not leak it for the TTL', () => {
  let dir; let root;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'runner-sigterm-'));
    root = mkdtempSync(join(tmpdir(), 'runner-sigterm-lock-'));
  });
  afterEach(() => {
    for (const d of [dir, root]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
  });

  it('REGRESSION (the pre-fix runner): with NO signal handler, SIGTERM leaks the lease', async () => {
    const h = startHarness(dir, 'unhandled', root, 'LEAKY');
    await h.ready;
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('LEAKY'); // lease held, as a live runner holds it

    h.child.kill('SIGTERM');
    await h.exited;

    // THE BUG, reproduced: the process is gone and its lease is still on disk, owned by a dead pid. This is
    // byte-for-byte the stale lock dir found live on the dev machine (pid dead, heartbeat 6.5 h old) — the
    // ONLY thing that expires it is the 15-minute TTL.
    expect(readLockEntry(root, RUNNER_LEASE_PATH)).not.toBeNull();
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('LEAKY');
  }, LIVE_TIMEOUT_MS);

  it('FIXED: with the handler installed, SIGTERM RELEASES the lease before the process dies', async () => {
    const h = startHarness(dir, 'handled', root, 'CLEAN');
    await h.ready;
    expect(readLockEntry(root, RUNNER_LEASE_PATH).owner).toBe('CLEAN');

    h.child.kill('SIGTERM');
    const { signal } = await h.exited;

    expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull(); // released — no TTL wait, no stale dir
    // …and it still dies BY THE SIGNAL. This is the half a `process.exit(0)` handler would silently break:
    // `classifyExit` short-circuits on `signal` before it ever reads the code, so exiting 0 here would
    // reclassify every killed runner as a clean exit. Releasing the lease must not move the exit semantics.
    expect(signal).toBe('SIGTERM');
    expect(classifyExit({ code: null, signal, ranMs: 10_000 })).toEqual({ kind: 'crash', reason: 'signal:SIGTERM' });
    expect(h.stderrOf()).toMatch(/SIGTERM — singleton lease released/);
  }, LIVE_TIMEOUT_MS);

  it('FIXED: SIGINT (a foreground Ctrl-C) releases it too', async () => {
    const h = startHarness(dir, 'handled', root, 'CLEAN-INT');
    await h.ready;
    h.child.kill('SIGINT');
    const { signal } = await h.exited;
    expect(signal).toBe('SIGINT');
    expect(readLockEntry(root, RUNNER_LEASE_PATH)).toBeNull();
  }, LIVE_TIMEOUT_MS);

  it('THE SYMPTOM: after a handled SIGTERM the very next runner ACQUIRES — before the fix it stood down', async () => {
    // What an operator actually hit: restart the conveyor after a kill and the fresh runner exits instantly,
    // which the supervisor reads as a crash. Asserted at the seam that decides it — `acquireRunnerLease`.
    const leaky = startHarness(dir, 'unhandled', root, 'OLD-LEAKY');
    await leaky.ready;
    leaky.child.kill('SIGTERM');
    await leaky.exited;
    // Pre-fix: the successor loses the race against a corpse's lease and must stand down.
    expect(acquireRunnerLease(root, 'SUCCESSOR')).toMatchObject({ ok: false, heldBy: 'OLD-LEAKY' });

    rmSync(root, { recursive: true, force: true });          // fresh root — the two cases must not share a lease

    const clean = startHarness(dir, 'handled', root, 'NEW-CLEAN');
    await clean.ready;
    clean.child.kill('SIGTERM');
    await clean.exited;
    // Post-fix: the successor wins the lease immediately, so it drives instead of exiting in <3 s.
    expect(acquireRunnerLease(root, 'SUCCESSOR')).toMatchObject({ ok: true });
  }, LIVE_TIMEOUT_MS);
});

// ── (2) the final `--json` line, producer → real consumer ──────────────────────────────────────────────────

describe('runner final event line (LIVE) — the real producer feeding supervisor.mjs\'s real stdout parser', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'runner-event-line-')); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });

  /**
   * Spawn, through `supervisor.mjs`'s OWN `makeRealSpawnChild`, a child whose only job is to write the line
   * `runner.mjs`'s OWN `finalEventLine` produces for `outcome`. Neither side is restated in a fixture: the
   * bytes come from the real runner export, the parse comes from the real supervisor export. If either half
   * renames `stoppedReason`, changes `event`, or stops writing the line, this goes red.
   */
  const spawnEmitting = (outcome, extraStdout = '') => {
    const path = join(dir, 'emit.mjs');
    writeFileSync(path, `
import { finalEventLine } from ${JSON.stringify(RUNNER_PATH)};
${extraStdout}
process.stdout.write(finalEventLine(JSON.parse(process.argv[2])) + '\\n');
`);
    return makeRealSpawnChild({ runnerPath: path, extraArgs: [JSON.stringify(outcome)], onChild: () => {} })();
  };

  it('an IDLE-STOP surfaces as stoppedReason "idle-stop", which classifyExit reads as a clean idle-stop', async () => {
    const res = await spawnEmitting({ started: true, stoppedReason: 'idle-stop', ticks: 4 });
    expect(res.stoppedReason).toBe('idle-stop');
    // …and that is what actually engages #3406's idle backoff, the whole reason the line exists.
    expect(classifyExit({ code: res.code, signal: res.signal, ranMs: DEFAULT_CRASH_THRESHOLD_MS + 1, stoppedReason: res.stoppedReason }))
      .toEqual({ kind: 'clean', reason: 'idle-stop' });
  }, LIVE_TIMEOUT_MS);

  it('a STAND-DOWN-on-a-held-lease surfaces as stoppedReason "stand-down" (restart promptly, do NOT back off)', async () => {
    const res = await spawnEmitting({ started: false, heldBy: 'Mac:1234:conveyor-runner' });
    expect(res.stoppedReason).toBe('stand-down');
    expect(classifyExit({ code: res.code, signal: res.signal, ranMs: DEFAULT_CRASH_THRESHOLD_MS + 1, stoppedReason: res.stoppedReason }))
      .toEqual({ kind: 'clean', reason: 'stand-down' });
  }, LIVE_TIMEOUT_MS);

  it('the final line survives a stream of preceding tick lines (it is parsed LAST, not first)', async () => {
    // A real run writes one `{tick, ...}` line per tick before the final event; the parser must not let those
    // overwrite or pre-empt the event it is waiting for.
    const ticks = 'for (let t = 0; t < 3; t++) process.stdout.write(JSON.stringify({ tick: t, counts: {} }) + "\\n");';
    const res = await spawnEmitting({ started: true, stoppedReason: 'idle-stop', ticks: 3 }, ticks);
    expect(res.stoppedReason).toBe('idle-stop');
  }, LIVE_TIMEOUT_MS);

  it('a MAX-TICKS / LEASE-LOST stop stays the plain clean exit — no new reason invented', async () => {
    const res = await spawnEmitting({ started: true, stoppedReason: 'lease-lost', ticks: 9 });
    expect(res.stoppedReason).toBe('lease-lost'); // carried faithfully…
    // …but classifyExit deliberately buckets anything that is not idle-stop/stand-down as plain `exit:0`.
    expect(classifyExit({ code: res.code, signal: res.signal, ranMs: DEFAULT_CRASH_THRESHOLD_MS + 1, stoppedReason: res.stoppedReason }))
      .toEqual({ kind: 'clean', reason: 'exit:0' });
  }, LIVE_TIMEOUT_MS);
});
