/**
 * @file breaks/standdown-pr-holds-scope-slot.mjs — live break, 2026-10-03. A PR whose fix agent STOOD DOWN
 * (needs-judgment, terminal until an operator answers) kept its lingering fix claim counted as an in-flight fix,
 * so the fix dispatcher's scope-overlap serialization refused every other PR on the same file behind it.
 *
 * LIVE INCIDENT: web-everything/web-everything PR #3834 stood down at 23:02Z; nobody was working it, yet the
 * daemon logged "refused scope-overlap … PR #3787 — we:AGENTS.md overlaps in-flight fix PR #3834 — waiting 2nd
 * behind #3834", which also froze #3771 and #3767 behind #3787.
 *
 * FIX: `reconcile-fix-dispatch.mjs#dropTerminalFixClaims` — a PR reconcile refuses `stood-down` (unanswered) holds
 * no scope slot. Answered and re-dispatched, it re-enters normally.
 *
 * SCENARIO (fix-dispatch daemon only): PR A carries an unanswered stand-down plus a lingering live fix claim on
 * `soak/shared.txt`; PR B (review:changes + finding) edits the SAME file.
 * JUDGE: B is owed a fix; pre-fix it is refused scope-overlap behind A forever (`owed` violation), post-fix it
 * is dispatched.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { acquireFixDispatchClaim } from '../../fix-dispatch-claim.mjs';
import { fixDispatchClaimRoot } from '../../fix-claim-store.mjs';
import { resolveCoordinationRoot } from '../../../operations/coordination-root.mjs';
import { CONSTELLATION_REPOS } from '../../../lib/constellation-repos.mjs';
import { buildStandDownComment } from '../../stand-down.mjs';

const FILE = 'soak/shared.txt';

export default {
  id: 'standdown-pr-holds-scope-slot',
  title: 'a stood-down PR (terminal until a human answers) keeps holding its scope slot and blocks other PRs on the same file',
  card: 'operator 2026-10-03; live #3834 blocking #3787/#3771/#3767',
  fixedBy: { sha: 'uncommitted', where: 'lane/fix-standdown-holds', paths: ['scripts/conveyor/reconcile-fix-dispatch.mjs'] },
  fixPresent(root) {
    try {
      return /dropTerminalFixClaims/.test(readFileSync(join(root, 'scripts/conveyor/reconcile-fix-dispatch.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:standdown-pr-holds-scope-slot', rounds: 10,
      daemons: ['fix-dispatch'], mainEvery: 0, fleet: false, scorecards: false,
      setup(w, { api }) {
        w.git.createBranch('we', 'lane/soak-standdown-a', { from: 'main', files: { [FILE]: 'written by A\n' } });
        w.git.createBranch('we', 'lane/soak-standdown-b', { from: 'main', files: { [FILE]: 'written by B\n' } });
        const a = w.gh.openPr({ repo: 'we', head: 'lane/soak-standdown-a', title: 'soak: stands down', labels: ['review:changes'], body: 'No backlog item.' });
        const b = w.gh.openPr({ repo: 'we', head: 'lane/soak-standdown-b', title: 'soak: blocked behind the stood-down PR', labels: ['review:changes'], body: 'No backlog item.' });
        for (const pr of [a, b]) {
          w.gh.setChecks('we', pr, [{ name: 'test', conclusion: 'SUCCESS' }]);
          w.gh.comment('we', pr, `1. soak finding on #${pr}`, { author: 'review-bot' });
        }
        // A's fix agent stood down: unanswered, terminal. Its fix claim lingers (session gone from the listing, so
        // the claim keeps its TTL grace) exactly like live #3834's did.
        w.gh.comment('we', a, buildStandDownComment({ reason: 'needs-judgment' }), { author: 'web-everything' });
        const lockRoot = fixDispatchClaimRoot(resolveCoordinationRoot({ env: w.env, home: w.env.HOME }));
        const claim = acquireFixDispatchClaim({
          repo: CONSTELLATION_REPOS.we.slug, pr: a, scope: [`we:${FILE}`], owner: 'soak-host:1', leaseMinutes: 100000, lockRoot,
        });
        api.say(`setup: stood-down PR #${a} holds a lingering fix claim (${claim.ok ? 'acquired' : claim.reason}); PR #${b} shares ${FILE}`);
        api.owe(b, 'fix', 'B must be dispatched even though stood-down A shares its file');
        return { a, b };
      },
      log,
    });
  },
  judge(report) {
    return [...(report.fatal ? [report.fatal] : []), ...report.violations
      .filter((v) => ['owed', 'crash', 'isolation'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`)];
  },
};
