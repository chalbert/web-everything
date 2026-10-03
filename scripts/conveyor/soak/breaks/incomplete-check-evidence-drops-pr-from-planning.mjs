/** PR #3432 (card 4958): incomplete required-check evidence must not drop a PR from planning. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runReconcilePass } from '../../reconcile-pass.mjs';

const REQUIRED = ['test', 'smoke', 'daemon-soak', 'soak-replay-gate'];
const HEAD = '4ecb5deb362c81aa28de162db4616bb4c2009347';
const row = (name, i, conclusion) => ({ id: 110460009383 + i, name, status: 'completed', conclusion, completed_at: '2026-10-01T10:00:00Z' });
const crowded = () => Array.from({ length: 100 }, (_, i) => ({ name: i ? 'review-gate' : 'soak-replay-gate', status: 'COMPLETED', conclusion: 'SUCCESS' }));
const options = (pr, readChecks) => ({ repo: 'we', readPrs: () => [pr], readAgents: () => [], enrich: a => a, readChecks,
  readRequiredChecks: () => ({ checks: REQUIRED }), enrichMainRed: prs => ({ prs, mainRedWindows: [] }),
  enrichAlreadyLanded: prs => prs, enrichBaseRef: prs => prs, enrichSystemFix: prs => prs,
  enrichFixClaims: prs => prs, resolveMainSha: () => null });

export default {
  id: 'incomplete-check-evidence-drops-pr-from-planning',
  title: 'PR #3432: a cancelled required check with absent jobs, or an unreadable check read, drops the PR from every planner branch',
  card: 'we:backlog/4958-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md',
  fixedBy: { sha: '54903364cac41bcb889899e41d61eec4f1efe0c0', where: 'lane/card-4958', paths: ['scripts/conveyor/reconcile-pass.mjs'] },
  fixPresent(root) { return readFileSync(join(root, 'scripts/conveyor/reconcile-pass.mjs'), 'utf8').includes('result.incomplete'); },
  async run() {
    const violations = [];
    const draft = { number: 3336, headRefOid: HEAD, headRefName: 'lane/3336-replay', isDraft: true, labels: [], comments: [], statusCheckRollup: crowded() };
    // Authoritative REST rows: one cancelled required check, the other required jobs never created a run.
    const heal = runReconcilePass(options(draft, () => [row('smoke', 1, 'cancelled')]));
    if (!heal.dispatch.some(d => d.prNumber === 3336 && d.kind === 'ci-heal')) violations.push('cancelled check with absent required jobs was not healed');
    // Unknown evidence (absent names with nothing observed, or an unreadable read) must still reach non-CI planning.
    const bounced = { ...draft, isDraft: false, labels: [{ name: 'review:changes' }],
      comments: [{ body: '🔁 review — changes requested\nPlease fix', author: { login: 'web-everything' }, createdAt: '2026-10-01T09:00:00Z' }] };
    for (const [name, readChecks] of [['absent', () => [row('soak-replay-gate', 3, 'success')]], ['unreadable', () => { throw new Error('HTTP 502'); }]]) {
      const plan = runReconcilePass(options(bounced, readChecks));
      if (!plan.dispatch.some(d => d.prNumber === 3336 && d.kind === 'fix')) violations.push(`${name} evidence dropped the PR from non-CI planning`);
      if (plan.dispatch.some(d => d.kind === 'ci-heal' || d.kind === 'promote-draft')) violations.push(`${name} evidence reached a CI-consuming branch`);
    }
    return { violations };
  },
  judge(report) { return report.violations; },
};
