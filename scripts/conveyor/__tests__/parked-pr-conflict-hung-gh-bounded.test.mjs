/**
 * @file scripts/conveyor/__tests__/parked-pr-conflict-hung-gh-bounded.test.mjs
 * @description Proof of the #x5n4zn3 fix for a REAL conveyor pass, not just `we:scripts/lane-pool.mjs`:
 *   `defaultListParkedPrs`'s `gh pr list` call here was completely bare — no timeout at all — before this
 *   item. A wedged `gh` (network stall, GitHub-side hang) used to block this ONE pass indefinitely; #3383's own
 *   incident narrative names the identically-shaped symptom (`spawnSync claude ETIMEDOUT` logged from a
 *   different, already-timed-out call) as the failure signature this rollout targets across every conveyor
 *   pass, not just lane-pool.
 *
 * REAL PROCESS, REAL HANG. A shim `gh` on `PATH` (ahead of any real one) traps and IGNORES `SIGTERM` and sleeps
 * forever, so this proves the fix's `killSignal: 'SIGKILL'` specifically — not just "some timeout exists". Runs
 * the EXPORTED, already-tested `defaultListParkedPrs` directly (its default `exec`, no fakes), exactly the code
 * path the live daemon calls every tick.
 *
 * NO risky in-process SIGTERM-only case here — see `we:scripts/__tests__/lane-pool-hung-git-bounded.test.mjs`'s
 * header for why: `execFileSync`/`spawnSync` cannot return while a SIGTERM-ignoring child holds its stdio open,
 * so simulating "before the fix" live would hang the test WORKER itself, not just fail one test. The
 * before/after was proven by hand instead (see the PR body): against the pre-patch bare call, the shim `gh`
 * was still alive and the driver still blocked past a 10s check; against the patched call here, it rejects in
 * ~3s with `spawnSync gh ETIMEDOUT` and nothing is left running.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = resolve(HERE, '..', 'parked-pr-conflict-watch.mjs');
const DRIVER = resolve(HERE, '..', '..', '..', 'scripts');

/** True while `pid` is still alive. */
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

let base, shimDir;

afterEach(() => {
  // Belt-and-suspenders, mirrors `lane-pool-hung-git-bounded.test.mjs`'s own afterEach: SIGKILL is always
  // effective, so this can never itself hang even if the fix under test ever regressed.
  if (shimDir) { try { execFileSync('pkill', ['-KILL', '-f', join(shimDir, 'gh')]); } catch { /* nothing to reap */ } }
  if (base) rmSync(base, { recursive: true, force: true });
  base = undefined;
  shimDir = undefined;
});

/** Write a `gh` shim that traps SIGTERM and hangs forever on ANY invocation, recording its own pid first. */
function installHangingGhShim(pidFile) {
  base = mkdtempSync(join(tmpdir(), 'parked-pr-hung-gh-'));
  shimDir = join(base, 'shimbin');
  mkdirSync(shimDir, { recursive: true });
  const shimPath = join(shimDir, 'gh');
  writeFileSync(shimPath, [
    '#!/usr/bin/env bash',
    'trap "" TERM',
    `echo $$ > ${JSON.stringify(pidFile)}`,
    'while true; do sleep 3600; done',
    '',
  ].join('\n'));
  chmodSync(shimPath, 0o755);
  return shimDir;
}

describe('parked-pr-conflict-watch: a hung `gh pr list` fails fast, not indefinitely (#x5n4zn3)', () => {
  it('GREEN: defaultListParkedPrs kills a hung gh via SIGKILL, rejects fast, and leaves no leftover process', async () => {
    const pidFile = join(mkdtempSync(join(tmpdir(), 'parked-pr-hung-gh-pid-')), 'hang.pid');
    installHangingGhShim(pidFile);

    // A driver subprocess (not an in-process PATH mutation — PATH is process-wide and this suite runs
    // concurrently with others) with WE_CHILD_TIMEOUT_MS dialed down for a fast, deterministic test and a
    // generous, SIGKILL'd outer safety net (never expected to fire — see the lane-pool sibling test's header
    // for why an outer bound must never rely on the default SIGTERM).
    const driverScript = [
      `const mod = await import(${JSON.stringify(MODULE_PATH)});`,
      'const start = Date.now();',
      'try {',
      "  const rows = mod.defaultListParkedPrs({ repo: 'o/n' });",
      '  console.log(JSON.stringify({ ok: true, elapsedMs: Date.now() - start, rows }));',
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, elapsedMs: Date.now() - start, message: String(e && e.message || e) }));',
      '}',
    ].join('\n');

    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', driverScript], {
      encoding: 'utf8',
      timeout: 25_000,
      killSignal: 'SIGKILL',
      env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}`, WE_CHILD_TIMEOUT_MS: '3000' },
      cwd: DRIVER,
    });

    expect(r.error).toBeFalsy(); // never hit the outer 25s safety net
    expect(existsSync(pidFile)).toBe(true); // the hang is real — the shim actually ran
    const hungPid = Number(readFileSync(pidFile, 'utf8').trim());

    const result = JSON.parse(r.stdout.trim().split('\n').pop());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/spawnSync gh ETIMEDOUT|exited/i);
    // Bounded to the dialed-down WE_CHILD_TIMEOUT_MS budget, nowhere near indefinite.
    expect(result.elapsedMs).toBeLessThan(15_000);

    // THE PROOF BAR: no leftover child process.
    expect(isAlive(hungPid)).toBe(false);
  }, 30_000);
});
