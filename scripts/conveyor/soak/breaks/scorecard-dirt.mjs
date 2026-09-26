/**
 * @file breaks/scorecard-dirt.mjs — live break 1b, 2026-09-25 13:36 ET (#4075, card x0zg44l). A dispatched review
 * session appended a scorecard row (`we:scripts/conveyor/run-scorecard-store.mjs#appendScorecard`, default path
 * `scripts/conveyor/run-scorecards.json`, TRACKED) FROM INSIDE the daemon's own clone — the session carried no
 * `CONVEYOR_STATE_ROOT` (real dispatched sessions never do; see `behaviours.mjs#writeScorecard`). The clone went
 * dirty, `daemon-rebuild.mjs#doRebuild` refused it as `dirty` every tick, it fell 10 commits behind origin/main,
 * and every review/fix dispatch after that refused as STALE.
 *
 * Fix (lane/4044, fc62d02a1): `resolveScorecardStorePath()` now routes to `daemonConveyorStateRoot(env)` once
 * `isDaemonManagedClone(repoRoot, env)` is true (a rebuild state file or overlay list exists for this clone), so
 * the row never lands in the tracked file in the first place; `doRebuild` also gained `migrateDaemonStateFiles()`
 * (`DAEMON_STATE_FILES`) so a row written by OLDER code (or before the clone was recognised as daemon-managed)
 * is carried out to the pinned store and the tracked copy restored, instead of freezing the rebuild.
 *
 * ISOLATION FROM THE REAL ~/.claude STATE (harness rule): `isDaemonManagedClone` reads
 * `rebuildStatePath(root, env)` = `<env.WE_DAEMON_STATE_DIR || ~/.claude/daemon-self-sync-state>/<cloneKey>.rebuild.json`
 * — the world's merged env (`sim/world.mjs`) already scopes the SMOKE reject-cache
 * (`WE_DAEMON_SMOKE_STATE_DIR`) but NOT this one, so this scenario's own `setup` points `WE_DAEMON_STATE_DIR` at a
 * directory under the sim world root. That is the only tweak needed: on lane/4044 `withSelfSync` drives
 * `rebuildClone`/`doRebuild` on EVERY tick unconditionally, and `doRebuild`'s own `up-to-date` path writes the
 * rebuild-state file on the clone's very first tick (`writeState()`, `daemon-rebuild.mjs` around the
 * `plan.upToDate` branch) — so the sim clone becomes "daemon-managed" through the REAL rebuild/self-sync path
 * itself, never a marker this scenario fabricates by hand.
 *
 * Scenario: a few extra `review:pending` PRs (beyond the default fleet's one) so several reviews get ACCEPTED
 * early — each acceptance's session writes a scorecard row a round or two later (`behaviours.mjs#planFor`'s
 * `review:accepted` plan appends `writeScorecard()` when `scorecards:true`) — while origin/main moves a few
 * times. RED = the clone goes dirty on the first scorecard write and never recovers (`clean`/`behind`/`lag`/
 * `stale` violations); GREEN = every row lands out-of-tree, the clone stays clean and current.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';

export default {
  id: 'scorecard-dirt',
  title: 'a scorecard row written from inside the daemon clone (no CONVEYOR_STATE_ROOT) dirties it; the rebuild refuses it as dirty and every dispatch refuses as stale',
  card: 'we:backlog/4044 via PR #2625 (epic #4075)',
  fixedBy: {
    sha: 'fc62d02a1',
    where: 'lane/4044-daemon-rebuild-and-clone-lock',
    paths: ['scripts/conveyor/run-scorecard-store.mjs', 'scripts/lib/daemon-rebuild.mjs'],
  },
  // Either fix counts: lane/4044's daemon-clone routing (`isDaemonManagedClone`), or #4155's successor that moves
  // the store out of every git tree and drops that routing (`LEGACY_IN_TREE_STORE` names the old tracked home).
  fixPresent(root) {
    try {
      return /isDaemonManagedClone|LEGACY_IN_TREE_STORE/.test(readFileSync(join(root, 'scripts/conveyor/run-scorecard-store.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:scorecard-dirt',
      rounds: 16,
      mainEvery: 4,
      scorecards: true,
      setup(w, { owed }) {
        // Never the real `~/.claude/daemon-self-sync-state` — see file header.
        w.env.WE_DAEMON_STATE_DIR = join(w.root, 'daemon-self-sync-state');

        // A few more `review:pending` PRs beyond the default fleet's one, so several reviews get accepted (and
        // write scorecard rows) EARLY, while main is still moving.
        for (const key of ['extra1', 'extra2', 'extra3']) {
          const head = `lane/soak-${key}`;
          w.git.createBranch('we', head, { from: 'main', files: { [`soak/${key}.txt`]: `a change waiting for review (${key})\n` } });
          const pr = w.gh.openPr({
            repo: 'we', head, base: 'main', title: `soak: ${key}, review:pending, green CI`, labels: ['review:pending'],
          });
          w.gh.setChecks('we', pr, [{ name: 'test', conclusion: 'SUCCESS' }]);
          owed.push({
            pr, kind: 'review', sinceTick: 0, dispatched: false, note: `${key} review:pending — owes a review`,
          });
        }
        return {};
      },
      log,
    });
  },
  judge(report) {
    return report.violations
      .filter((v) => ['clean', 'behind', 'lag', 'stale'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
