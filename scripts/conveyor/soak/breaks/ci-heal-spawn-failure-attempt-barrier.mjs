/**
 * @file breaks/ci-heal-spawn-failure-attempt-barrier.mjs — PR #3577 review finding (card xp0lsdi). A CI-heal launch
 * persists its attempt row (`handle: null`) BEFORE it spawns the wrapper. When the spawn itself threw (EAGAIN,
 * ENOENT, …), nothing settled the row, so every later reconcile tick polled it, got `unresolved` ("unknown
 * CI-heal wrapper handle") and `dispatchCiHeal` held that PR forever — a silently stuck PR with no cap-counted
 * marker, exactly the class of failure the attempt ledger was built to remove.
 *
 * Fix (working tree, lane-16): `probationWorkerDetachedProvider` settles the row as a failed attempt when the
 * spawn throws, and `observeHealAttempt` ages a handle-less row past the listing grace out to the same settled
 * failure (an ambiguous no-pid launch, which cannot be settled eagerly).
 *
 * SCENARIO (direct, no simulator — the code under test is the provider → attempt-ledger → poller seam): launch a
 * CI-heal whose `spawnDetached` throws, then poll the ledger the way `runReconcileCiHealDispatch` does. A fake
 * `gh` that always fails keeps the run off the network; the failure marker for the settled attempt is then owed
 * and retried, which is fine — the row must simply stop being `unresolved`. RED = any row still `unresolved`.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const worker = { id: 'soak-worker', provider: 'antigravity', model: 'soak-model', executor: 'antigravity', taskType: 'test-fix' };

export default {
  id: 'ci-heal-spawn-failure-attempt-barrier',
  title: 'a CI-heal launch whose spawn throws leaves a handle-less attempt row that blocks that PR\'s CI-heal forever',
  card: 'we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md (PR #3577 review)',
  fixedBy: { sha: '5f3be06c0', where: 'lane/card-xp0lsdi', paths: ['scripts/operations/dispatch-providers/probation-worker.mjs', 'scripts/operations/probation-heal-run.mjs'] },
  fixPresent(root) {
    try { return /failAttempt/.test(readFileSync(join(root, 'scripts/operations/dispatch-providers/probation-worker.mjs'), 'utf8')); } catch { return false; }
  },
  async run({ root = ROOT } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-heal-spawn-'));
    const saved = { PATH: process.env.PATH, WE_COORDINATION_ROOT: process.env.WE_COORDINATION_ROOT, WE_GH_THROTTLE_LOCK_ROOT: process.env.WE_GH_THROTTLE_LOCK_ROOT };
    const violations = [];
    try {
      const bin = join(dir, 'bin'); mkdirSync(bin);
      writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      process.env.PATH = `${bin}:${saved.PATH}`;
      process.env.WE_COORDINATION_ROOT = join(dir, 'coordination');
      process.env.WE_GH_THROTTLE_LOCK_ROOT = join(dir, 'throttle');
      const load = rel => import(pathToFileURL(join(root, rel)).href);
      const { probationWorkerDetachedProvider } = await load('scripts/operations/dispatch-providers/probation-worker.mjs');
      const { healAttemptsDir, pollHealAttempts, observeHealAttempt, finishHealAttempt } = await load('scripts/operations/probation-heal-run.mjs');
      const request = { launchKind: 'ci-heal', pr: 3373, sessionSlug: 'ci-heal-3373', headRefOid: 'a'.repeat(40), probationWorker: worker, cwd: dir };
      try {
        probationWorkerDetachedProvider(request, { spawnDetached: () => { throw Object.assign(new Error('spawn EAGAIN'), { code: 'EAGAIN' }); }, logPathFor: () => join(dir, 'log') });
        violations.push('the provider swallowed the spawn failure');
      } catch { /* the launch error is the expected outcome */ }
      // Poll like the reconcile pass; a terminal row is settled from its own record, a handle-less one must not block.
      const dir2 = healAttemptsDir();
      const settle = (id, terminal) => finishHealAttempt(id, terminal, { dir: dir2, publish: () => {}, complete: () => {} });
      const rows = pollHealAttempts({ dir: dir2, observe: (id, o) => observeHealAttempt(id, { ...o, settle }) });
      for (const r of rows) if (r.status === 'unresolved') violations.push(`attempt ${r.attemptId} stays unresolved: ${r.error}`);
      if (!rows.length) violations.push('no attempt row was recorded');
    } catch (e) { violations.push(String(e.stack || e)); }
    finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      rmSync(dir, { recursive: true, force: true });
    }
    return { violations };
  },
  judge: report => report.violations,
};
