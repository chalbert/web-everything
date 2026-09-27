/**
 * @file breaks/build-daemon-restart-same-file.mjs — #3984 slice 1 (build-dispatch daemon). The double-dispatch
 * shape PR #2789 fixed for fix/ci-heal dispatch, replayed for BUILD dispatch: the tick core's build guard lives in
 * the dispatcher's memory, so a restarted dispatcher forgets what it launched and dispatches the same cleared card
 * again — and, with two ready cards on the same file, can also start the second one on top of the first.
 *
 * Fix: the build-dispatch daemon takes a durable per-item claim (we:scripts/conveyor/build-dispatch-claim.mjs)
 * that stores the build's scope, so the restarted process sees the first build as in flight (by num) and the
 * second card as a hot-file conflict.
 *
 * Scenario: two REAL separate processes run one live tick each, back to back (a restart: new pid, empty
 * bookkeeping), sharing one claim root. Both see the same two cleared cards on the same file. Exactly ONE
 * dispatch may happen across both processes.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const FIXTURE = fileURLToPath(new URL('./fixtures/build-daemon-tick.mjs', import.meta.url));

export default {
  id: 'build-daemon-restart-same-file',
  title: 'a restarted build dispatcher forgot its in-memory guards and re-dispatched a cleared card (and its same-file sibling)',
  card: 'we:backlog/3984 (build-dispatch daemon slice 1; claim shape from PR #2789)',
  fixedBy: { sha: '2aa2058ee', where: 'lane/build-daemon-slice1', paths: ['scripts/conveyor/build-dispatch-claim.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'] },
  fixPresent(root) {
    const p = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(p) && /BUILD_DAEMON_DURABLE_CLAIM/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-build-daemon-'));
    const lockRoot = join(dir, 'claims');
    const dispatchLog = join(dir, 'dispatches.log');
    const violations = [];
    try {
      for (const round of [0, 1]) {
        try {
          const outText = execFileSync(process.execPath, [FIXTURE, REPO_ROOT, lockRoot, dispatchLog], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          log?.(`r0${round} ${outText.trim()}`);
        } catch (e) {
          violations.push({ invariant: 'crash', tick: round, detail: String(e?.stderr || e?.message || e).split('\n')[0] });
        }
      }
      const lines = existsSync(dispatchLog) ? readFileSync(dispatchLog, 'utf8').trim().split('\n').filter(Boolean) : [];
      if (lines.length !== 1) violations.push({ invariant: 'single-dispatch', detail: `expected exactly 1 dispatch across the restart, got ${lines.length}: ${lines.join(' | ')}` });
      return { violations, dispatches: lines };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  judge(report) {
    return report.violations.map((v) => `tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
