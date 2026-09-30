/** PR #3154: acquire failure is not evidence that the origin branch is gone. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realIo, runProbationHeal, WE_ROOT } from '../../../operations/probation-heal-run.mjs';
import { buildCiHealEscalationComment } from '../../ci-heal-escalation-mark.mjs';
import { planReconcile } from '../../reconcile-core.mjs';

export default {
  id: 'ci-heal-acquire-false-escalation',
  title: 'PR #3154: failed lane acquire permanently suppresses healing of an existing ref',
  card: 'we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md',
  fixedBy: { sha: 'working-tree', where: 'lane', paths: ['scripts/operations/probation-heal-run.mjs', 'scripts/conveyor/ci-heal-escalation-mark.mjs'] },
  fixPresent(root) { return readFileSync(join(root, 'scripts/operations/probation-heal-run.mjs'), 'utf8').includes('io.probeOriginRef'); },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'heal-ref-proof-'));
    const violations = [];
    const outcomes = [];
    try {
      const origin = join(dir, 'origin.git');
      const checkout = join(dir, 'checkout');
      const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init', '--bare', '--initial-branch=main', origin);
      git('clone', origin, checkout);
      git('-C', checkout, '-c', 'user.name=Probe', '-c', 'user.email=probe@example.test', 'commit', '--allow-empty', '-m', 'fixture');
      const ref = 'lane/4409-prepare-item-guard-relaxation-lint';
      git('-C', checkout, 'push', 'origin', `HEAD:refs/heads/${ref}`);
      const head = git('-C', checkout, 'rev-parse', 'HEAD');
      const pr = { number: 3154, state: 'OPEN', headRefName: ref, headRefOid: head, labels: [], mergeStateStatus: 'CLEAN',
        statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' }],
        comments: [{ author: { login: 'web-everything' }, body: buildCiHealEscalationComment({ headSha: head, outcome: 'needs-human', reason: `lane ref gone — ${ref} no longer resolves` }) }] };
      const io = realIo({ session: 'proof', env: { ...process.env, LANE_POOL_ROOT: join(dir, 'pool') }, run(bin, argv, opts) {
        // Real subprocesses against disposable origin/pool. Only location is substituted.
        const args = bin === 'git' ? argv.map(a => a === WE_ROOT ? checkout : a)
          : [...argv.filter(a => !a.startsWith('--repo=')), `--origin=${origin}`, `--reference=${checkout}`, '--name=healproof', '--branch=main', '--no-install', '--no-reap'];
        try { return { ok: true, out: execFileSync(bin, args, { ...opts, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
        catch (e) { return { ok: false, status: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
      } });
      for (let tick = 0; tick < 8; tick++) {
        const plan = planReconcile({ prs: [pr], agents: [], now: Date.now(), requiredChecks: ['test'] });
        if (!plan.dispatch.some(d => d.kind === 'ci-heal')) violations.push(`tick ${tick}: existing ref still held by legacy escalation`);
        const result = await runProbationHeal({ pr: 3154, session: 'proof', lane: 99, worker: { id: 'probe', executor: 'unused' } }, {
          ...io, prHead: () => pr, completion() {}, log: log ?? (() => {}),
          escalate: e => { violations.push(`tick ${tick}: false escalation ${e.reason}`); },
        });
        outcomes.push(result);
        if (result.outcome !== 'blocked-on-infra') violations.push(`tick ${tick}: ${result.outcome}`);
        if (!result.detail.includes('no lanes provisioned') || !result.detail.includes('origin ref present')) violations.push(`tick ${tick}: lost acquire/probe evidence`);
      }
      // Now delete the fixture's origin ref: the same real acquire failure must escalate exactly once.
      git('-C', checkout, 'push', 'origin', `:refs/heads/${ref}`);
      let escalations = 0;
      const absent = await runProbationHeal({ pr: 3154, session: 'proof', lane: 99, worker: { id: 'probe' } }, {
        ...io, prHead: () => pr, completion() {}, log: log ?? (() => {}), escalate() { escalations++; },
      });
      if (absent.outcome !== 'escalated-needs-human' || escalations !== 1) violations.push('verified absent ref did not escalate');
      return { violations, outcomes, absent };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  },
  judge(report) { return report.violations; },
};
