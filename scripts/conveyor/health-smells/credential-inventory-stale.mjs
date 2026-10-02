/** Repository secret age is a rotation-review heuristic, never issuer expiry. */
import { DAY } from '../credential-inventory.mjs';
export default {
  id: 'credential-inventory-stale', scope: 'repo', cadence: 'gh', probes: ['credentialInventory'],
  missingSubjectsUnknown: true, openAfter: 1, closeAfter: 2, severity: 'medium', action: 'alert', maxAgeDays: 90,
  recommendationHint: 'Review aging repository secrets and failed CI authentication.',
  evaluate({ credentialInventory: inventory }, { now }) {
    const out = [];
    for (const status of inventory.repositories) {
      const rows = inventory.secrets.filter((r) => r.repo === status.repo);
      const valid = (r) => r.updated_at && Number.isFinite(Date.parse(r.updated_at)) && Date.parse(r.updated_at) <= now;
      const stale = rows.filter((r) => valid(r) && now - Date.parse(r.updated_at) > this.maxAgeDays * DAY).map((r) => ({ name: r.name, ageDays: Math.floor((now - Date.parse(r.updated_at)) / DAY) }));
      if (stale.length || (status.secrets.complete && rows.every(valid))) out.push({
        subject: `${status.repo}:secret-age`, breach: stale.length > 0, measure: { stale },
        summary: `${status.repo}: ${stale.length ? stale.map((r) => `${r.name} updated ${r.ageDays} days ago`).join(', ') : 'no secrets over the rotation-review threshold'}. Age is not expiry.`,
        recommendation: stale.length ? `Repository owner: review ${stale.map((r) => `${r.name} (${r.ageDays} days since update)`).join(', ')}. Inspect its consuming workflow and issuer expiry; obtain a replacement with intended access, update through the normal secret channel, rerun the job and record successful verification. Never record replacement values here.` : 'ok',
      });
      const matches = inventory.ciFindings.filter((r) => r.repo === status.repo && r.badCredentials && Date.parse(r.observedAt) >= now - inventory.lookbackHours * 3600000 && Date.parse(r.observedAt) <= now);
      if (matches.length || status.ci.complete) out.push({ subject: `${status.repo}:ci-auth`, breach: matches.length > 0, measure: { runs: matches },
        summary: `${status.repo}: ${matches.length} observed CI authentication failures in the lookback window.`,
        recommendation: matches.length ? `Verify the failing credential for ${matches.map((r) => `${r.runUrl} attempt ${r.attempt}`).join(', ')}; Bad credentials does not identify a secret or prove expiry.` : 'No matching failure in this window; this does not prove credential repair.',
      });
    }
    return out;
  },
};
