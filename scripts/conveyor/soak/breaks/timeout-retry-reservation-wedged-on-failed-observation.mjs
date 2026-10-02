/**
 * @file breaks/timeout-retry-reservation-wedged-on-failed-observation.mjs — review finding on PR #3559 (card
 * xng7q1p, #4075). `ci-heal-pr-dispatch.mjs#dispatchTimeoutRetry` writes a durable `pending` reservation BEFORE
 * it observes the failed job, so a restart can never double-spend the retry budget. When that observation then
 * failed (a transient GitHub 5xx/network error, or the job already closed/stale) the reservation was left
 * `pending` even though NO rerun request had been sent. Every later tick read it as an in-flight, ambiguous
 * request and refused `retry-outcome-pending` until a newer run attempt appeared — which can never appear, since
 * nothing was requested. One flaky observation permanently wedged the retry for that head.
 *
 * Fix: a reservation created by the CURRENT call is released (`rejected`, which spends no budget) when the
 * observation throws or the observed job is stale/closed. A reservation inherited from an earlier call is never
 * released — its request may have been sent.
 *
 * SCENARIO: drive `dispatchTimeoutRetry` for one head through three ticks against fake effects — tick 1's
 * observation throws, ticks 2-3 observe a healthy failed job. RED = tick 2 never sends the request
 * (`retry-outcome-pending`); GREEN = exactly one request is sent on tick 2 and none is duplicated on tick 3.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const REPO = 'chalbert/web-everything';
const HEAD = 'c'.repeat(40);

export default {
  id: 'timeout-retry-reservation-wedged-on-failed-observation',
  title: 'a timeout-retry reservation left pending after a failed observation (no request sent) wedges every later tick on retry-outcome-pending',
  card: 'we:backlog/xng7q1p-a-ci-failure-in-a-test-the-pr-does-not-touch-is-re-run-not-h.md (epic #4075)',
  fixedBy: { sha: 'HEAD', where: 'lane/card-xng7q1p', paths: ['scripts/operations/ci-heal-pr-dispatch.mjs'] },
  fixPresent(root) {
    try {
      return /releaseFresh/.test(readFileSync(join(root, 'scripts/operations/ci-heal-pr-dispatch.mjs'), 'utf8'));
    } catch { return false; }
  },
  async run({ log } = {}) {
    const { dispatchTimeoutRetry } = await import(resolve(REPO_ROOT, 'scripts/operations/ci-heal-pr-dispatch.mjs'));
    const dir = mkdtempSync(join(tmpdir(), 'soak-timeout-retry-'));
    mkdirSync(dir, { recursive: true });
    try {
      const evidence = {
        eligible: true, repo: REPO, pr: 3415, head: HEAD, signature: 'soak-timeout',
        failures: [{ path: 'scripts/operations/__tests__/priority-sync.test.mjs', name: 'registration', kind: 'test-timeout' }],
        jobs: [{ run: 10, job: 20, attempt: 1, url: `https://github.com/${REPO}/actions/runs/10/job/20` }],
      };
      let observeFails = true;
      let requests = 0;
      const effects = {
        observe: (e, j) => {
          if (observeFails) throw new Error('github 502');
          return { repo: e.repo, head: e.head, runHead: e.head, open: true, run: j.run, job: j.job, jobRun: j.run,
            attempt: j.attempt, jobAttempt: j.attempt, status: 'completed', conclusion: 'failure' };
        },
        request: () => { requests += 1; return { status: 'confirmed' }; },
      };
      const opts = { dir, repo: REPO, effects };
      const results = [];
      for (let tick = 1; tick <= 3; tick += 1) {
        if (tick === 2) observeFails = false;
        const r = await dispatchTimeoutRetry(evidence, opts);
        results.push(r);
        log?.(`tick ${tick}: ${JSON.stringify(r)} requests=${requests}`);
      }
      return { results, requests };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  },
  judge(report) {
    const problems = [];
    if (report.requests !== 1) {
      problems.push(`expected exactly 1 rerun request across the 3 ticks (tick 1 observation failed, tick 2 healthy), saw ${report.requests} — results: ${report.results.map((r) => r.status === 'requested' ? 'requested' : r.reason).join(', ')}`);
    }
    if (report.results[1]?.status !== 'requested') {
      problems.push(`tick 2 (healthy observation after a failed one) refused ${report.results[1]?.reason} instead of requesting the retry`);
    }
    return problems;
  },
};
