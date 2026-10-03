/**
 * @file breaks/review-gate-conflict-suppresses-ci-heal.mjs — x6n7c2p review finding on PR #3633 (CONFIRMED by
 * the correctness reviewer and the codex advisory). `planReconcile` gained an early check: when the review CI
 * gate reports `required-review-gate-conflict` (a REQUIRED `review-gate` that is not green), it refused the PR
 * with `review-ci` and `continue`d — ahead of the `ci-red`, fix and advisory branches. `review-gate` is red BY
 * DESIGN while a review label is held, so in a repo that lists it as required the check fired for every PR, and
 * the unconditional `continue` swallowed the repair ownership of any PR that ALSO had an independently failing
 * required check: no ci-heal, no rerun, no escalation, ever, until someone edited branch protection.
 *
 * FIX: the early refusal is scoped to its one purpose — a `ci-red` PR whose ONLY failing required check is
 * `review-gate` (ci-heal cannot clear it; healing it would loop). Any other failing required check, and every
 * non-`ci-red` phase, falls through to its normal repair branch. Review emission stays gated separately by
 * `reviewChecksAllow`.
 *
 * SCENARIO: one PR, `review:pending`, whose required set is the fallback set plus `review-gate`; `test` failed
 * for real and `review-gate` is red (held by the label). The fix-dispatch daemon ticks every round.
 *
 * RED = no `ci-heal-<pr>` session is ever dispatched (the PR owes a repair of `test`). GREEN = one is.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSoak } from '../soak.mjs';
import { FALLBACK_REQUIRED_STATUS_CHECKS } from '../../../lib/required-status-checks.mjs';
import { sessionMatches } from '../invariants.mjs';

const ROUNDS = 4;
const INVARIANT = 'ci-heal-suppressed-by-review-gate-conflict';

export default {
  id: 'review-gate-conflict-suppresses-ci-heal',
  title: 'a required review-gate that is red by design suppresses the ci-heal owed to an independently failing required check',
  card: 'we:backlog/x6n7c2p — review finding on PR #3633 (reconcile-core.mjs required-review-gate-conflict early continue)',
  fixedBy: {
    sha: 'this same PR', where: 'this same PR (we:backlog/x6n7c2p)',
    paths: ['scripts/conveyor/reconcile-core.mjs'],
  },
  fixPresent(root) {
    try {
      return /reviewCi\.affected\.every\(row => row\.name === 'review-gate'\)/
        .test(readFileSync(join(root, 'scripts/conveyor/reconcile-core.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:review-gate-conflict-suppresses-ci-heal',
      rounds: ROUNDS,
      daemons: ['fix-dispatch'],
      mainEvery: 0,
      scorecards: false,
      fleet: false,
      setup(w) {
        // `review-gate` is a REQUIRED check in this repo (the configuration the finding is about).
        w.gh.setRequiredChecks('we', [...FALLBACK_REQUIRED_STATUS_CHECKS, 'review-gate']);
        const head = 'lane/soak-review-gate-conflict-ci-red';
        w.git.createBranch('we', head, { from: 'main', files: { 'soak/review-gate-conflict-ci-red.txt': 'a change whose test check really failed\n' } });
        const pr = w.gh.openPr({
          repo: 'we', head, base: 'main', title: 'soak: review:pending, required test failed AND required review-gate red',
          labels: ['review:pending'], body: 'No backlog item.',
        });
        w.gh.setChecks('we', pr, [
          { name: 'test', conclusion: 'FAILURE' },
          { name: 'smoke', conclusion: 'SUCCESS' },
          { name: 'daemon-soak', conclusion: 'SUCCESS' },
          { name: 'review-gate', conclusion: 'FAILURE' },
        ]);
        return { pr, healSeen: false };
      },
      perRound(w, round, ctx, api) {
        const heals = w.claude.sessions().filter((s) => sessionMatches(s.name, 'ci-heal', ctx.pr));
        if (heals.length) ctx.healSeen = true;
        api.say(`r${String(round).padStart(2, '0')} PR #${ctx.pr}: ${heals.length} ci-heal session(s)`);
        if (round === ROUNDS - 1 && !ctx.healSeen) {
          api.violation(INVARIANT, `PR #${ctx.pr} never got a ci-heal over ${ROUNDS} rounds although required check \`test\` failed on its own — the red review-gate swallowed the repair`);
        }
      },
      log,
    });
  },
  judge(report) {
    return report.violations
      .filter((v) => v.invariant === INVARIANT)
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
