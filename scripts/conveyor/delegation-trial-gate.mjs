/**
 * #3690 progressive backdown bar, computed fresh from the caller's store. No IO.
 * @param {{provider:string, model:string, taskType:string}} triple
 * @param {{records: object[]}} store
 * @returns {boolean}
 */
export function isDelegationTripleGraduated({ provider, model, taskType }, store) {
  const rows = (store?.records ?? [])
    .filter((r) => r.dispatchKind === 'session-delegation'
      && r.provider === provider && r.model === model && r.taskType === taskType)
    // Other verifiers neither count toward nor break the streak.
    .filter((r) => r.verifiedBy === 'claude-subagent' || r.verifiedBy === 'independent-claude')
    .sort((a, b) => new Date(a.scoredAt) - new Date(b.scoredAt));
  const everInformative = rows.some((r) => typeof r.findings === 'string' && r.findings.trim() !== '');
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const clean = rows[i].outcome === 'landed'
      && (rows[i].findings === null || rows[i].findings === undefined);
    if (!clean) break;
    streak += 1;
  }
  return everInformative && streak >= 5;
}
