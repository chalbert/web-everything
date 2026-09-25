/**
 * (d) / #4077 — a PR whose CI is red for over an hour with NO fixer session on it. Reads `gh pr list` (the
 * `prs` probe, 15-minute cadence) and `claude agents --json` (the `agents` probe). Red = a failing check other
 * than the review gate (config `ignoreChecks`), or the `ci:failed` label. Attended = a live agent session named
 * `fix-<PR>` / `ci-heal-…<PR>…` (the conveyor's own session names). 2026-09-25: #2636 and #2635 sat red for
 * hours while the fix daemon refused them with a `{{SCOPE}}` dispatch failure.
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

const FAIL = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED']);

export function redInfo(pr, ignoreChecks) {
  const failing = (pr.statusCheckRollup || []).filter((c) => !ignoreChecks.includes(c.name) && FAIL.has(c.conclusion || c.state));
  const labelled = (pr.labels || []).some((l) => l.name === 'ci:failed');
  if (!failing.length && !labelled) return null;
  const times = failing.map((c) => Date.parse(c.completedAt || '')).filter(Number.isFinite);
  const since = times.length ? Math.min(...times) : Date.parse(pr.updatedAt || '') || null;
  return { since, failing: [...new Set(failing.map((c) => c.name))], labelled };
}

export default {
  id: 'red-pr-unattended',
  scope: 'repo',
  cadence: 'gh',
  probes: ['prs', 'agents'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'medium',
  action: 'investigate',
  redForMs: 60 * MINUTE,
  ignoreChecks: ['review-gate'],
  recommendationHint: 'A red PR has no fixer; the fix-dispatch daemon log names why it refuses it.',
  evaluate({ prs, agents }, { now, daemons }) {
    const live = (agents || []).filter((a) => a.state !== 'done' && a.state !== 'stopped' && a.state !== 'failed');
    const out = [];
    for (const pr of prs) {
      const red = redInfo(pr, this.ignoreChecks);
      if (!red) continue;
      const n = String(pr.number);
      const fixer = live.find((a) => new RegExp(`^(fix|ci-heal|heal|conflict)-.*\\b${n}\\b|^(fix|ci-heal)-${n}$`).test(a.name || ''));
      const redFor = red.since ? now - red.since : 0;
      const fixLog = daemons['fix-dispatch-daemon'];
      const last = fixLog?.prRefusals?.[`${pr.repo}#${n}`];
      const refusal = last ? `${last.reason}, ${fmtAge(now - last.at)} ago` : null;
      out.push({
        subject: `${pr.repo}#${n}`,
        breach: !fixer && redFor >= this.redForMs,
        measure: { redForMin: Math.round(redFor / MINUTE), lastFixDaemonRefusal: refusal, failing: red.failing, ciFailedLabel: red.labelled, fixerSession: fixer?.name ?? null, title: String(pr.title || '').slice(0, 80) },
        summary: `${pr.repo}#${n} red for ${fmtAge(redFor)} (${red.failing.join(', ') || 'ci:failed label'}) with no fixer session.`,
        recommendation: refusal
          ? `No fixer on ${pr.repo}#${n}: the fix-dispatch daemon's last word on it was "${refusal}". Fix that refusal in the dispatch path; do not heal the PR by hand.`
          : `No fixer on ${pr.repo}#${n} and the fix-dispatch daemon has not mentioned it recently — check why the fix-dispatch / ci-heal path skips it (\`node scripts/conveyor/reconcile-pass.mjs\` for its phase).`,
      });
    }
    return out;
  },
};
