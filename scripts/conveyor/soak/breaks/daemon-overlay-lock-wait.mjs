/**
 * @file breaks/daemon-overlay-lock-wait.mjs — live break, 2026-09-26 (#4229/#2760 follow-up, epic #3383/#4075).
 * `scripts/daemon-overlay.mjs add/remove` took the clone's WRITE lock (`daemon-clone-lock.mjs`, Module A)
 * around its mutation. Two earlier cuts only tightened HOW that wait behaved:
 *   1. The very first cut called `withWriteLock(root, fn, {})` — an unbounded (raw 600s `acquireWrite` default)
 *      wait. A live operator `add --pinned` run against `wev-review-daemon` sat silently for 8+ minutes waiting
 *      for a live reader to drain, refusing every daemon sharing that clone on every tick (4218).
 *   2. 4218 bounded that wait (`WE_DAEMON_OVERLAY_LOCK_WAIT_MS`, default 30s) and logged it. That shortened
 *      the freeze but did not remove the real blocker: whenever the daemon's OWN rebuild — which runs on
 *      every tick, often — already held the writer slot, `add` failed OUTRIGHT with `concurrent-mover` and no
 *      wait at all (`acquireWrite` refuses immediately when another live writer holds the key). Live
 *      2026-09-26: PR #2760 failed to register 4 times in a row this way.
 * Both fixes treated the symptom (wait duration/visibility). The real fix: `add`/`remove` never needed the
 * clone's lock at all — they only register/drop an entry in the overlay STORE
 * (`~/.claude/daemon-overlays/<hash>.json`), which already serializes its own read-modify-write under a
 * separate, tiny mkdir-mutex (`daemon-overlays.mjs#withListLock`). The next automatic rebuild (main + overlays,
 * smoke-gated, falls back to last-good) is what actually applies it. So this CLI must return near-instantly and
 * successfully EVEN WHILE the clone's writer lock is held live by a concurrent rebuild — the exact condition
 * that broke PR #2760 four times.
 *
 * Scenario: a REAL separate process holds the sim clone's WRITE lock (imported live from the tree under test —
 * the exact shape a daemon's own in-flight rebuild holds it in), mimicking "the daemon's own rebuild holds the
 * clone's writer lock" from the live incident. `scripts/daemon-overlay.mjs add` then runs as a REAL child
 * process (the actual CLI an operator/automation runs) and must succeed near-instantly, with the ref actually
 * registered in the overlay store — never refused, never waiting on the writer.
 *
 * PR #2827 added an overlay-conflict guard to `add` (it resolves the ref and merge-tree-checks it against main,
 * off a scratch repo — never the clone's lock), so the ref this scenario registers must now really exist on the
 * world's origin: an unresolvable ref is correctly refused by that guard, which is not what this break tests.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/hold-clone-lock.mjs', import.meta.url));
const OVERLAY_REF = 'lane/overlay-lock-wait-fixture';
const HOLD_MS = 10_000; // comfortably longer than the near-instant add this scenario expects.
const MAX_ADD_MS = 5_000; // generous ceiling for a plain metadata write; a lock-bound wait would blow well past this.

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
  title: 'scripts/daemon-overlay.mjs add refused/blocked on the clone WRITE lock instead of only registering the overlay and returning at once',
  card: 'we:backlog/4229 follow-up, PR #2760 (epic #4075/#3383)',
  fixedBy: {
    sha: 'fix-overlay-register-only',
    where: 'lane/fix-overlay-register-only',
    paths: ['scripts/daemon-overlay.mjs'],
  },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, 'scripts/daemon-overlay.mjs'), 'utf8');
      // The fix removed the IMPORT of Module A entirely — add/remove never touch the clone's lock any more.
      // (The file's own docs may still mention "daemon-clone-lock" by name in prose, so match the import shape
      // specifically, never a bare substring.)
      return !/import\(.*daemon-clone-lock|from\s+['"].*daemon-clone-lock/.test(src);
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
          // Keep the registration in this world, never the operator's real `~/.claude/daemon-overlays` store.
          w.env.WE_DAEMON_OVERLAY_DIR = join(w.root, 'daemon-overlays');
          return {};
        },
        async perRound(w, round, ctx, api) {
          if (round !== 0) return;
          const overlayCliPath = join(w.simCloneRoot, 'scripts/daemon-overlay.mjs');
          const lockModulePath = join(w.simCloneRoot, 'scripts/lib/daemon-clone-lock.mjs');
          if (!existsSync(overlayCliPath) || !existsSync(lockModulePath)) {
            throw new Error('daemon-overlay-lock-wait: requires scripts/daemon-overlay.mjs and scripts/lib/daemon-clone-lock.mjs — not present on this tree');
          }

          w.git.createBranch('we', OVERLAY_REF, { from: 'main', files: { 'soak/overlay-lock-wait.md': '# overlay fixture\n' } });

          const readyMarker = join(w.root, 'holder-ready');
          holder = spawn(process.execPath, [
            FIXTURE, 'write', lockModulePath, w.simCloneRoot, String(HOLD_MS), readyMarker, w.env.WE_DAEMON_CLONE_LOCK_ROOT,
          ], { env: w.env, stdio: 'ignore' });
          const ok = await waitForReady(readyMarker, 10_000);
          if (!ok) throw new Error('daemon-overlay-lock-wait: the holder process did not acquire the write lock in time');
          api.say(`r00 a real sibling process (pid ${holder.pid}) acquired the clone WRITE lock (simulating an in-flight rebuild) — daemon-overlay.mjs add must NOT contend for it`);

          const startedAt = Date.now();
          const res = spawnSync(process.execPath, [
            overlayCliPath, 'add', `--clone=${w.simCloneRoot}`, `--ref=${OVERLAY_REF}`, '--pr=2760', '--json',
          ], {
            env: w.env,
            encoding: 'utf8',
            timeout: 30_000,
          });
          const elapsed = Date.now() - startedAt;
          api.say(`r00 daemon-overlay.mjs add exited ${res.status} after ${elapsed}ms while the writer lock was held — stderr: ${(res.stderr || '').trim().split('\n').join(' | ')}`);

          if (elapsed > MAX_ADD_MS) {
            api.violation('overlay-add-blocked-on-writer', `daemon-overlay.mjs add took ${elapsed}ms while the clone's writer lock was held by another process — it must never wait on that lock at all`);
          }
          if (res.status !== 0) {
            api.violation('overlay-add-refused-by-writer-lock', `daemon-overlay.mjs add exited ${res.status} while the clone's writer lock was held (stderr: ${(res.stderr || '').trim()}) — register-only add must succeed regardless of the clone's lock state`);
          }
          if (!(res.stdout || '').includes(`"ref":"${OVERLAY_REF}"`)) {
            api.violation('overlay-add-not-registered', `daemon-overlay.mjs add did not report the ref registered in its JSON output: ${(res.stdout || '').trim()}`);
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
      .filter((v) => ['overlay-add-blocked-on-writer', 'overlay-add-refused-by-writer-lock', 'overlay-add-not-registered', 'crash'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
