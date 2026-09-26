/**
 * @file breaks/daemon-overlay-lock-wait.mjs — live break, 2026-09-26 (#4075, epic #3383, card xa4qo7n follow-up).
 * `scripts/daemon-overlay.mjs add/remove` took the clone's WRITE lock via `withWriteLock(root, fn, {})` — an
 * EMPTY options object, so it inherited `acquireWrite`'s raw 600s (10 MINUTE) default wait, with no `onBlocked`
 * logging. Live: an operator's `daemon-overlay.mjs add --pinned` run against `wev-review-daemon` (a real,
 * actively-ticking clone) reserved the writer key, then sat silently (0% CPU, no log line) for 8+ minutes
 * waiting for the clone's live readers to drain — during which EVERY daemon sharing the clone was refused
 * `writer-active` on every tick. Same class of freeze as `fix-daemon-lock-wait.mjs` (card 4044/#2625, which
 * bounded `daemon-rebuild.mjs#rebuildClone`'s own write-lock wait) — this CLI just never got that fix, because
 * it is a separate call site onto the SAME `daemon-clone-lock.mjs` primitive.
 *
 * Fix: `daemon-overlay.mjs` now bounds its wait (`WE_DAEMON_OVERLAY_LOCK_WAIT_MS`, default 30s — this CLI's own
 * mutation is a tiny metadata write, never a rebuild, so it only needs to outlast whatever tick is CURRENTLY in
 * flight), logs when it starts waiting and who is blocking it, and reports `tick-in-progress` (retryable) on
 * timeout instead of hanging silently.
 *
 * Scenario: same shape as `fix-daemon-lock-wait.mjs` (a REAL separate process holds the sim clone's READ lock,
 * imported live from the tree under test), except this one runs `scripts/daemon-overlay.mjs add` ITSELF as a
 * REAL child process (not an in-process call) — the actual CLI a live operator runs — with its wait pinned
 * small via env, and asserts it gives up within that bound rather than the old silent 600s.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/hold-clone-lock.mjs', import.meta.url));
const HOLD_MS = 25_000; // comfortably longer than the pinned 3s wait below.
const WAIT_MS = 3_000;

async function waitForReady(path, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return true;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  return false;
}

export default {
  id: 'daemon-overlay-lock-wait',
  title: "scripts/daemon-overlay.mjs add/remove waited SILENTLY up to the clone lock's raw 600s default for a live reader, instead of a bounded, logged wait",
  card: 'we:backlog/xa4qo7n (epic #4075/#3383)',
  fixedBy: {
    sha: 'xa4qo7n-daemon-rebuild-offlock-smoke',
    where: 'lane/xa4qo7n-daemon-rebuild-offlock-smoke',
    paths: ['scripts/daemon-overlay.mjs'],
  },
  fixPresent(root) {
    try {
      return /OVERLAY_LOCK_WAIT_ENV/.test(readFileSync(join(root, 'scripts/daemon-overlay.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    let holder = null;
    try {
      const report = await runSoak({
        name: 'break:daemon-overlay-lock-wait',
        rounds: 1,
        daemons: [],
        mainEvery: 0,
        fleet: false,
        log,
        setup(w) {
          w.env.WE_DAEMON_CLONE_LOCK_ROOT = join(w.root, 'clone-lock');
          return {};
        },
        async perRound(w, round, ctx, api) {
          if (round !== 0) return;
          const overlayCliPath = join(w.simCloneRoot, 'scripts/daemon-overlay.mjs');
          const lockModulePath = join(w.simCloneRoot, 'scripts/lib/daemon-clone-lock.mjs');
          if (!existsSync(overlayCliPath) || !existsSync(lockModulePath)) {
            throw new Error('daemon-overlay-lock-wait: requires scripts/daemon-overlay.mjs and scripts/lib/daemon-clone-lock.mjs — not present on this tree');
          }

          const readyMarker = join(w.root, 'holder-ready');
          holder = spawn(process.execPath, [
            FIXTURE, 'read', lockModulePath, w.simCloneRoot, String(HOLD_MS), readyMarker, w.env.WE_DAEMON_CLONE_LOCK_ROOT,
          ], { env: w.env, stdio: 'ignore' });
          const ok = await waitForReady(readyMarker, 10_000);
          if (!ok) throw new Error('daemon-overlay-lock-wait: the holder process did not acquire the read lock in time');
          api.say(`r00 a real sibling process (pid ${holder.pid}) acquired the clone READ lock — daemon-overlay.mjs add must now contend for the WRITE lock`);

          const startedAt = Date.now();
          const res = spawnSync(process.execPath, [
            overlayCliPath, 'add', `--clone=${w.simCloneRoot}`, '--ref=lane/does-not-need-to-exist', '--json',
          ], {
            env: { ...w.env, WE_DAEMON_OVERLAY_LOCK_WAIT_MS: String(WAIT_MS) },
            encoding: 'utf8',
            timeout: 30_000,
          });
          const elapsed = Date.now() - startedAt;
          api.say(`r00 daemon-overlay.mjs add exited ${res.status} after ${elapsed}ms (pinned wait ${WAIT_MS}ms) — stderr: ${(res.stderr || '').trim().split('\n').join(' | ')}`);

          if (elapsed > WAIT_MS + 15_000) {
            api.violation('overlay-add-unbounded-wait', `daemon-overlay.mjs add took ${elapsed}ms with a ${WAIT_MS}ms pinned wait — it did not honor the bound (or hung entirely)`);
          }
          if (!/waiting up to \d+s for live reader/.test(res.stderr || '')) {
            api.violation('overlay-add-silent-wait', `daemon-overlay.mjs add gave no "waiting up to Ns" log line while blocked on a live reader — a silent wait is exactly the live incident this scenario replays`);
          }
          if (res.status === 0) {
            api.violation('overlay-add-should-have-refused', 'daemon-overlay.mjs add succeeded while a live reader still held the clone — expected it to be refused (tick-in-progress) within its pinned wait');
          }
        },
      });
      return report;
    } finally {
      if (holder && !holder.killed) { try { holder.kill('SIGKILL'); } catch { /* best-effort */ } }
    }
  },
  judge(report) {
    return report.violations
      .filter((v) => ['overlay-add-unbounded-wait', 'overlay-add-silent-wait', 'overlay-add-should-have-refused', 'crash'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
