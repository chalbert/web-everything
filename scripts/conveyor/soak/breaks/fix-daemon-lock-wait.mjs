/**
 * @file breaks/fix-daemon-lock-wait.mjs — live break 5, 2026-09-25 10:28-10:40 ET (#4075, epic card x0zg44l). The
 * fix daemon's tick-start rebuild (`we:scripts/lib/daemon-rebuild.mjs#rebuildClone`) takes the clone's WRITE lock
 * on EVERY tick (opportunistic — nothing has to have changed). While the review daemon's own 10-minute tick held
 * a READ slot on the same clone, the fix daemon's rebuild sat SILENTLY waiting for the lock's 600s default, no
 * log line, no ticks, until a human noticed the daemon had gone dark.
 *
 * Fix: `759529ac0` — `daemon-clone-lock.mjs#acquireWrite` gained `onBlocked({blockers, waitMs})` (fires once, the
 * moment a live reader blocks it), and `daemon-rebuild.mjs#rebuildClone` now bounds the wait to
 * `WE_DAEMON_REBUILD_LOCK_WAIT_MS` (default 60s) instead of the lock's own 600s default, logging the wait start
 * and the give-up. On lane/4044.
 *
 * Scenario: a REAL separate process holds the clone's READ lock (imported live from the sim clone's own
 * `daemon-clone-lock.mjs` — the way a sibling daemon's long tick would) for well over `bounds.tickBoundMs`, then
 * the fix-dispatch daemon ticks. `WE_DAEMON_REBUILD_LOCK_WAIT_MS` is pinned small (5s) and `bounds.tickBoundMs` to
 * 30s: FIXED code waits ~5s, logs it, gives up, and the tick completes normally under its own (unblocked) READ
 * lock. PRE-FIX code ignores that env var, waits the lock's real 600s default, and the runner's own per-tick
 * timeout (30s) reports a FATAL `bounded` violation — the tick never even returns.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/hold-clone-lock.mjs', import.meta.url));
const HOLD_MS = 40_000; // comfortably longer than the 30s tick bound and the 5s fixed wait.

async function waitForReady(path, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  return false;
}

export default {
  id: 'fix-daemon-lock-wait',
  title: "the fix daemon's tick-start rebuild waited SILENTLY up to the clone lock's 600s default for a live reader, instead of a bounded, logged wait",
  card: 'we:backlog/4044 via PR #2625 (epic #4075)',
  fixedBy: {
    sha: '759529ac0',
    where: 'lane/4044-daemon-rebuild-and-clone-lock',
    paths: ['scripts/lib/daemon-clone-lock.mjs', 'scripts/lib/daemon-rebuild.mjs'],
  },
  fixPresent(root) {
    try {
      return /onBlocked/.test(readFileSync(join(root, 'scripts/lib/daemon-clone-lock.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    let holder = null;
    try {
      const report = await runSoak({
        name: 'break:fix-daemon-lock-wait',
        rounds: 1,
        daemons: ['fix-dispatch'],
        mainEvery: 0,
        fleet: false,
        bounds: { tickBoundMs: 30_000 },
        env: { WE_DAEMON_REBUILD_LOCK_WAIT_MS: '5000' },
        log,
        setup(w) {
          w.env.WE_DAEMON_CLONE_LOCK_ROOT = join(w.root, 'clone-lock');
          return {};
        },
        async perRound(w, round, ctx, api) {
          if (round !== 0) return;
          // On main (no lane/4044 merged) neither scripts/lib/daemon-clone-lock.mjs nor daemon-rebuild.mjs
          // exists yet — this scenario is meaningless there. Throw a clear, specific error (never a raw
          // "Cannot find module" from a dynamic import several layers down) so the soak's own FATAL/crash
          // reporting still counts this as the expected failure, rather than silently reading as a pass.
          const lockModulePath = join(w.simCloneRoot, 'scripts/lib/daemon-clone-lock.mjs');
          if (!existsSync(lockModulePath)) {
            throw new Error('fix-daemon-lock-wait: requires scripts/lib/daemon-clone-lock.mjs and scripts/lib/daemon-rebuild.mjs (lands with #2625 / #4044) — not present on this tree');
          }
          const readyMarker = join(w.root, 'holder-ready');
          holder = spawn(process.execPath, [
            FIXTURE,
            'read',
            lockModulePath,
            w.simCloneRoot,
            String(HOLD_MS),
            readyMarker,
            w.env.WE_DAEMON_CLONE_LOCK_ROOT,
          ], { env: w.env, stdio: 'ignore' });
          const ok = await waitForReady(readyMarker, 10_000);
          if (!ok) throw new Error('fix-daemon-lock-wait: the holder process did not acquire the read lock in time');
          api.say(`r00 a real sibling process (pid ${holder.pid}) acquired the clone READ lock — the fix-dispatch tick's rebuild must now contend for the WRITE lock`);
        },
      });
      return report;
    } finally {
      if (holder && !holder.killed) { try { holder.kill('SIGKILL'); } catch { /* best-effort */ } }
    }
  },
  judge(report) {
    // 'bounded' = the live break (a silent, unbounded write-lock wait blowing the tick's own timeout). 'crash'
    // also matches the required-file guard above (main, pre-#4044, has neither daemon-clone-lock.mjs nor
    // daemon-rebuild.mjs) — that must count as reproduced too, never a silent pass on main (#4075 soak brief).
    return report.violations
      .filter((v) => v.invariant === 'bounded' || v.invariant === 'crash')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
