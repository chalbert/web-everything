/** Strict review prerequisite; independent of the general merge/CI reducer. */
import { collapseRollupToLatestPerName } from './rollup-collapse.mjs';

export function reviewCiGate({ headSha, requiredChecks, checks } = {}) {
  const refuse = (reason, affected = []) => ({ allowed: false, headSha: headSha ?? null, reason, affected });
  if (typeof headSha !== 'string' || !headSha.trim()) return refuse('missing-head');
  if (!Array.isArray(requiredChecks) || !requiredChecks.length
      || requiredChecks.some(name => typeof name !== 'string' || !name.trim())) return refuse('unknown-required-set');
  const latest = new Map(collapseRollupToLatestPerName(checks).map(row => [row?.name ?? row?.context, row]));
  const affected = [...new Set(requiredChecks)].flatMap(name => {
    const row = latest.get(name);
    let reason;
    if (!row) reason = 'missing';
    else if (row.head_sha && row.head_sha !== headSha) reason = 'wrong-head';
    else if (typeof row.status !== 'string') reason = 'malformed';
    else if (['queued', 'in_progress', 'pending', 'waiting', 'requested'].includes(row.status.toLowerCase())) reason = 'pending';
    else if (row.status.toLowerCase() !== 'completed' || typeof row.conclusion !== 'string') reason = 'malformed';
    else if (row.conclusion.toLowerCase() !== 'success') reason = row.conclusion.toLowerCase() || 'malformed';
    return reason ? [{ name, reason }] : [];
  });
  if (affected.length) return refuse(affected.some(row => row.name === 'review-gate')
    ? 'required-review-gate-conflict' : 'required-checks-not-successful', affected);
  return { allowed: true, headSha, reason: 'required-checks-successful', affected: [] };
}
