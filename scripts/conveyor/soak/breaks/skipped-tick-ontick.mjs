/**
 * @file breaks/skipped-tick-ontick.mjs — live break 6, 2026-09-25 13:20Z-13:33Z (#4075, epic card x0zg44l). When
 * `withSelfSync`'s default path could not take the clone's READ lock (a writer active, e.g. a sibling daemon's
 * rebuild in flight, or the clone quarantined), it returned a bare `{skipped:true, reason}`. BOTH daemons' own
 * `onTick` read `result.repos.map(...)` unconditionally — `Cannot read properties of undefined (reading 'map')`
 * on EVERY skip, all round.
 *
 * Fix: `11661ed52` — `daemon-self-sync.mjs#skippedTick(reason)` returns the FULL empty-tick shape (the union of
 * review-daemon's and reconcile-fix-dispatch-daemon's own result fields: `repos:[]`, `dispatched:[]`, etc.) so a
 * skip is a normal, loggable tick, never a bare marker object. On lane/4044.
 *
 * Scenario: a REAL separate process holds the clone's WRITE lock (imported live from the sim clone's own
 * `daemon-clone-lock.mjs` — the way a sibling daemon mid-rebuild would) across one round, so BOTH daemons'
 * `acquireRead` calls are refused (`writer-active`) and both ticks are skipped. Judged on the harness's own
 * `no-onTick-crash` invariant, which the soak's daemon host captures as `onTickError` whenever a daemon's own
 * `onTick` throws on the tick's result.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/hold-clone-lock.mjs', import.meta.url));
const HOLD_MS = 15_000; // comfortably longer than both daemons' round-0 ticks.

async function waitForReady(path, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  return false;
}

export default {
  id: 'skipped-tick-ontick',
  title: "a tick skipped by a refused clone read lock (writer active) returned a bare {skipped,reason}; every daemon's onTick crashed reading result.repos",
  card: 'we:backlog/4044 via PR #2625 (epic #4075)',
  fixedBy: { sha: '11661ed52', where: 'lane/4044-daemon-rebuild-and-clone-lock', paths: ['scripts/lib/daemon-self-sync.mjs'] },
  fixPresent(root) {
    try {
      return /export function skippedTick/.test(readFileSync(join(root, 'scripts/lib/daemon-self-sync.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    let holder = null;
    try {
      const report = await runSoak({
        name: 'break:skipped-tick-ontick',
        rounds: 2,
        mainEvery: 0,
        fleet: false,
        log,
        setup(w) {
          w.env.WE_DAEMON_CLONE_LOCK_ROOT = join(w.root, 'clone-lock');
          return {};
        },
        async perRound(w, round, ctx, api) {
          if (round !== 0) return;
          // On main (no lane/4044 merged) there is no clone-lock concept at all — daemon-self-sync.mjs never
          // calls acquireRead, and scripts/lib/daemon-clone-lock.mjs doesn't exist. Throw a clear, specific
          // error rather than a raw "Cannot find module" several layers down, so this still counts as the
          // expected failure on main instead of silently reading as a pass (#4075 soak brief).
          const lockModulePath = join(w.simCloneRoot, 'scripts/lib/daemon-clone-lock.mjs');
          if (!existsSync(lockModulePath)) {
            throw new Error('skipped-tick-ontick: requires scripts/lib/daemon-clone-lock.mjs (lands with #2625 / #4044) — not present on this tree');
          }
          const readyMarker = join(w.root, 'holder-ready');
          holder = spawn(process.execPath, [
            FIXTURE,
            'write',
            lockModulePath,
            w.simCloneRoot,
            String(HOLD_MS),
            readyMarker,
            w.env.WE_DAEMON_CLONE_LOCK_ROOT,
          ], { env: w.env, stdio: 'ignore' });
          const ok = await waitForReady(readyMarker, 10_000);
          if (!ok) throw new Error('skipped-tick-ontick: the holder process did not acquire the write lock in time');
          api.say(`r00 a real sibling process (pid ${holder.pid}) acquired the clone WRITE lock — both daemons' ticks this round must be refused a read slot and skipped`);
        },
      });
      return report;
    } finally {
      if (holder && !holder.killed) { try { holder.kill('SIGKILL'); } catch { /* best-effort */ } }
    }
  },
  judge(report) {
    // 'no-onTick-crash' = the live break itself. 'crash' also matches the required-file guard above (main,
    // pre-#4044, has no clone-lock concept at all) — that must count as reproduced too, never a silent pass on
    // main (#4075 soak brief).
    return report.violations
      .filter((v) => v.invariant === 'no-onTick-crash' || v.invariant === 'crash')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
