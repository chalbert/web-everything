/**
 * Seed smell 3 / #4077 — lane starvation: the pool's acquirable lanes are below the demand the daemons see, or
 * daemons hit repeated no-lane refusals. Reads the lane-pool health watcher's own per-tick health line
 * (`{"checked":true,"health":{total,leased,acquirable,dirtyUnleased}}`, the `lanePools` probe) and the no-lane
 * refusals folded from the daemon logs. Diagnosed by the stale-state read (lease/claim liveness evidence).
 */
import { MINUTE } from '../health-watch-core.mjs';
import { repoKeyForSlug } from '../../lib/constellation-repos.mjs';

export default {
  id: 'lane-starvation',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['lanePools', 'daemonLogs'],
  openAfter: 2,
  closeAfter: 3,
  severity: 'high',
  action: 'investigate',
  windowMs: 30 * MINUTE,
  minNoLane: 3,
  diagnose: { command: 'node', args: ['scripts/operations/run.mjs', 'stale-state', '--json'], timeoutMs: 45_000 },
  recommendationHint: 'Lanes below demand: pool cap, leaked leases, or litter-dirty lanes.',
  evaluate({ lanePools }, { now, daemons }) {
    const demand = {};
    const recent = {};
    for (const mem of Object.values(daemons)) {
      for (const e of mem.noLaneTimes || []) {
        const k = repoKeyForSlug(e.repo) ?? e.repo;
        if (now - e.at <= this.windowMs) recent[k] = (recent[k] || 0) + 1;
      }
      for (const t of mem.lastTick?.blocking || []) {
        if (/no-lane|no acquirable lane/.test(t)) demand.we = (demand.we || 0) + 1;
      }
    }
    return lanePools.map((p) => {
      const d = demand[p.repo] || 0;
      const r = recent[p.repo] || 0;
      const h = p.health || {};
      const breach = (d > 0 && (h.acquirable ?? 0) < d) || r >= this.minNoLane;
      return {
        subject: `lane-pool:${p.repo}`,
        breach,
        measure: { ...h, demandNow: d, noLaneRefusals30m: r, healthLineAgeMin: p.at ? Math.round((now - p.at) / MINUTE) : null },
        summary: `lane pool ${p.repo}: ${h.acquirable ?? '?'} acquirable of ${h.total ?? '?'} (${h.leased ?? '?'} leased, ${h.dirtyUnleased ?? '?'} dirty); ${r} no-lane refusal(s) in 30m.`,
        recommendation: r > 0 && (h.acquirable ?? 0) >= 5
          ? `Daemons were refused a lane ${r} time(s) in 30m while the ${p.repo} pool reports ${h.acquirable} acquirable — the acquire path and the pool's own count disagree (lease contention, or acquire's per-call wait too short); investigate acquire, not pool size.`
          : (h.dirtyUnleased ?? 0) > (h.acquirable ?? 0)
          ? `Most free lanes in ${p.repo} are dirty (${h.dirtyUnleased}) — the fix is teaching the lane-pool litter allowlist / reclaim what those lanes hold, then they become acquirable.`
          : `Lanes in ${p.repo} are leased out (${h.leased}) — run the stale-state read to find leases whose holder is gone; the lease reaper should reclaim them.`,
      };
    });
  },
};
