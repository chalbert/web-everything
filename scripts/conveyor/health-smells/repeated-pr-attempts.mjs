/** Operator rule, 2026-09-30: repeated trials on one PR signal a possible problem.
 * A single smell aggregates actions; no extra GitHub reads. Existing gated self-sync
 * owns clone recovery; the watch's alert path escalates persistent failures.
 */
import { ATTEMPT_WINDOW_MS, MIN_PR_ATTEMPTS, recordPrAttempts, isExpectedPrWait } from '../health-pr-attempts.mjs';

export default {
  id: 'repeated-pr-attempts', scope: 'repo', cadence: 'every-tick',
  probes: ['daemonLogs'], openAfter: 1, closeAfter: 2, severity: 'high', action: 'alert',
  recommendationHint: 'Investigate the latest failed action before retrying this PR again.',
  evaluate({ operationRuns }, { now, daemons }) {
    const groups = new Map();
    const logs = Object.values(daemons).flatMap((m) => m.prAttempts ?? [])
      .filter((r) => r.at > now - ATTEMPT_WINDOW_MS && r.at <= now && !isExpectedPrWait(r));
    // Logs and records can describe the same attempts without a shared ID. Use the
    // larger evidence set per PR/action, a conservative lower bound, not their sum.
    const sources = new Map();
    for (const [source, evidence] of [['logs', logs], ['records', recordPrAttempts(operationRuns, now)]]) {
      for (const row of evidence) {
        const key = `${row.pr}:${row.action}`;
        if (!sources.has(key)) sources.set(key, { logs: [], records: [] });
        sources.get(key)[source].push(row);
      }
    }
    const rows = [...sources.values()].flatMap((s) => s.logs.length >= s.records.length ? s.logs : s.records);
    for (const row of rows) {
      if (!groups.has(row.pr)) groups.set(row.pr, []);
      groups.get(row.pr).push(row);
    }
    return [...groups].map(([pr, attempts]) => {
      attempts.sort((a, b) => a.at - b.at);
      const latest = attempts.at(-1);
      const actions = {};
      for (const r of attempts) actions[r.action] = (actions[r.action] ?? 0) + 1;
      return {
        subject: pr, breach: attempts.length >= MIN_PR_ATTEMPTS,
        measure: { attempts: attempts.length, actions, latestReason: latest.reason, windowMinutes: 60,
          estimated: attempts.some((r) => r.estimated) },
        summary: `${pr}: ${attempts.length} failed/refused/recovery attempts in 60m (${Object.entries(actions).map(([a, n]) => `${a}: ${n}`).join(', ')}); latest ${latest.action}: ${latest.reason}`,
        recommendation: /behind origin\/main|stale-checkout/.test(latest.reason)
          ? 'The existing gated self-sync rebuild owns stale-clone recovery. Inspect its clone-held-stale alert and resolve the reported blocker; escalate if it persists. Never rebase the daemon clone by hand.'
          : this.recommendationHint,
      };
    });
  },
};
