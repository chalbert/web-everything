/**
 * @file skills-src/conveyor/__tests__/supervisor-launcher.integration.test.mjs
 * @description Prevention owed by round 2 of PR #2472's review (see supervisor-launcher.mjs's own header,
 *   "CORRECTED PREMISE #3"): every OTHER test of this launcher (supervisor-launcher.test.mjs) injects a fake
 *   `spawnChild`/`runLoop`, so none of them ever exercised the REAL `classifyExit`/`decideRestart` (reused
 *   from supervisor.mjs) or the REAL `runPeriodicSupervisorLoop` against a real one-shot script's real exit —
 *   the exact gap the review named. This file drives {@link launchEntry} with NO injected `spawnChild` and NO
 *   injected `runLoop`; the only things it overrides are FILE-SYSTEM PATHS (`root`, `logRoot`, `lockRoot`,
 *   pointed at an isolated temp dir instead of the shared production one) and small pacing NUMBERS
 *   (`intervalMs`, `baseBackoffMs`, `maxBackoffMs`, `maxRestarts`) so the suite stays fast and hermetic —
 *   never a fake of the actual restart/backoff/lease LOGIC under test.
 *
 * REALISTIC FIXTURE, NOT A REAL PASS SCRIPT. None of the 15 real {@link DAEMON_MANIFEST} entries
 * (branch-drift.mjs, ci-queue-watch.mjs, …) are safe to actually spawn in a test — every one shells real git
 * state and/or the real `gh` CLI, so a real invocation is slow, non-deterministic, and can make real network
 * calls this suite must never depend on. Instead this file reuses the SAME real-subprocess technique
 * supervisor.test.mjs's own `makeRealSpawnChild` suite already established: pass `-e` as the "script" (so
 * `resolveScriptPath` — given `root: ''` — resolves it to the literal string `'-e'`, unchanged) and a small
 * inline snippet as `args`, which `makeRealSpawnChild` spawns as `node -e "<snippet>"` — a REAL, independent
 * OS child process with a REAL, controllable exit code and REAL elapsed time, exactly the class of fact
 * `classifyExit` and this launcher's own lease-taking care about. This is the "realistic fixture standing in"
 * the review's own remedy explicitly sanctions in place of a real manifest entry.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchEntry } from '../supervisor-launcher.mjs';
import { passDaemonLeaseKey } from '../pass-daemon.mjs';
import { runnerLeaseStatus } from '../runner-lock.mjs';

const tempDirs = [];
function freshTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) { try { rmSync(tempDirs.pop(), { recursive: true, force: true }); } catch { /* best-effort cleanup */ } }
});

/** One real, deterministic, fast, network-free "one-shot pass" target — the fixture standing in for a real
 *  DAEMON_MANIFEST entry (see this file's own header for why a real one is not test-safe). `root: ''` makes
 *  `resolveScriptPath('-e', { root: '' })` resolve to the literal `'-e'` (verified: `join('', '-e') === '-e'`),
 *  exactly what `makeRealSpawnChild` needs to spawn `node -e "<snippet>"`. */
function oneShotTarget({ name, snippet, intervalMs }) {
  return { name, script: '-e', args: [snippet], intervalMs };
}

describe('launchEntry — INTEGRATION: real spawnChild + real runLoop + real lease, nothing injected but paths/numbers', () => {
  it('a clean real exit paces the NEXT real spawn by the entry\'s own intervalMs — never an immediate respawn', async () => {
    const lockRoot = freshTempDir('conveyor-launcher-lease-');
    const logRoot = freshTempDir('conveyor-launcher-log-');
    const spawnAt = [];
    const makeLog = () => (entry) => { if (entry.event === 'spawn') spawnAt.push(Date.now()); };

    const intervalMs = 800;
    const out = await launchEntry(
      oneShotTarget({ name: 'integration-clean-oneshot', snippet: 'process.exit(0)', intervalMs }),
      { root: '', logRoot, lockRoot, makeLog, maxRestarts: 2 },
    );

    expect(out.stoppedReason).toBe('max-restarts');
    expect(spawnAt).toHaveLength(2);
    const gap = spawnAt[1] - spawnAt[0];
    // The pre-fix defect: supervisor.mjs's own decideRestart gives an ordinary clean exit delayMs:0, so the
    // second spawn would follow the first almost instantly (a gap of a few ms, bounded only by process-launch
    // speed) — completely ignoring intervalMs. A real fix must make that gap AT LEAST intervalMs (minus a
    // small allowance for timer/scheduler jitter, never for the whole interval being skipped).
    expect(gap).toBeGreaterThanOrEqual(intervalMs - 50);
  }, 20_000); // two real `node -e` spawns + a real 800ms wait; generous headroom over supervisor.test.mjs's
  // own documented "~5s under a loaded environment" real-spawn cost.

  it('a genuine crash (real non-zero exit) still gets classifyExit/decideRestart\'s real backoff — never confused with interval pacing', async () => {
    const lockRoot = freshTempDir('conveyor-launcher-lease-');
    const logRoot = freshTempDir('conveyor-launcher-log-');
    const spawnAt = [];
    const exitKinds = [];
    const makeLog = () => (entry) => {
      if (entry.event === 'spawn') spawnAt.push(Date.now());
      if (entry.event === 'exit') exitKinds.push(entry.kind);
    };

    // intervalMs is deliberately HUGE relative to the crash backoff below — if the real crash exit were ever
    // misclassified as a clean one-shot completion, the observed gap would be ~intervalMs (60s), not ~baseBackoffMs
    // (150ms), and this test would time out well before that, failing loudly rather than silently passing wrong.
    const out = await launchEntry(
      oneShotTarget({ name: 'integration-crash-oneshot', snippet: 'process.exit(1)', intervalMs: 60_000 }),
      { root: '', logRoot, lockRoot, makeLog, maxRestarts: 2, baseBackoffMs: 150, maxBackoffMs: 150 },
    );

    expect(out.stoppedReason).toBe('max-restarts');
    expect(exitKinds).toEqual(['crash', 'crash']);
    expect(spawnAt).toHaveLength(2);
    const gap = spawnAt[1] - spawnAt[0];
    expect(gap).toBeGreaterThanOrEqual(150 - 50);
    expect(gap).toBeLessThan(10_000); // nowhere near the 60s interval — proves the crash path, not the clean path, paced this
  }, 20_000);

  it('genuinely takes and releases a REAL, disk-backed pass-daemon-compatible lease for the run\'s whole lifetime', async () => {
    // Cross-process contention (two real OS processes racing for the SAME real lease) is exactly what
    // pass-daemon.mjs's own real invocation and this launcher's own real invocation would do in production —
    // but simulating TWO independent process identities inside one Node test process collides with the
    // owner-naming scheme's own real granularity (host+pid+name), which is by design cross-process, not
    // cross-call-within-one-process. So this test instead proves the REAL lease genuinely exists on disk
    // (never a no-op) for the run's whole lifetime and is genuinely gone after — the same fact a real
    // concurrent pass-daemon.mjs --pass=<name> would itself observe and be denied by, mid-run.
    const lockRoot = freshTempDir('conveyor-launcher-lease-');
    const logRoot = freshTempDir('conveyor-launcher-log-');
    const name = 'integration-lease-lifetime';
    const key = passDaemonLeaseKey(name);

    expect(runnerLeaseStatus(lockRoot, { key }).held).toBe(false); // nothing before the run starts

    const launchPromise = launchEntry(
      oneShotTarget({ name, snippet: 'process.exit(0)', intervalMs: 2_000 }),
      { root: '', logRoot, lockRoot, maxRestarts: 2 },
    );
    await new Promise((r) => setTimeout(r, 300)); // give it time to spawn once and enter its intervalMs wait
    const midRun = runnerLeaseStatus(lockRoot, { key });
    expect(midRun.held).toBe(true); // the REAL lease is genuinely held while this entry is mid-run

    const out = await launchPromise;
    expect(out.stoppedReason).toBe('max-restarts');
    expect(runnerLeaseStatus(lockRoot, { key }).held).toBe(false); // released, never leaked, once the run stops
  }, 20_000);
});
