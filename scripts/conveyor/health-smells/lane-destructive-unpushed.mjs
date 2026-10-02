/**
 * #4370 — a lane's working tree was reset / cleaned / litter-reaped while it held UNPUSHED work, and nothing
 * saved that work first. 2026-09-28: lane-18 was reset by the health watch's reclaim with one commit ahead
 * while its owner had been live one tick earlier; finding out who did it took a manual join of the reflog and
 * two un-timestamped daemon logs.
 *
 * Reads the per-pool lane lifecycle journal (`laneJournal` probe — `we:scripts/lib/lane-history.mjs`, recent
 * entries only). Breaches once per lane with any such entry in the probe's window; the episode closes when
 * the entry ages out. A salvaged reset (a verified bundle was written first) never counts. Alert-only: the
 * journal line already names the actor, pid and reason — the recommendation points at it.
 */
import { isUnsalvagedDestructiveUnpushed } from '../../lib/lane-history.mjs';

export default {
  id: 'lane-destructive-unpushed',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['laneJournal'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  recommendationHint: 'A lane was reset/cleaned with unpushed work in it and no salvage bundle.',
  evaluate({ laneJournal }) {
    const out = [];
    for (const { pool, entries } of laneJournal || []) {
      const byLane = new Map();
      for (const e of entries || []) {
        if (isUnsalvagedDestructiveUnpushed(e) && Number.isInteger(e.lane)) byLane.set(e.lane, e);
      }
      for (const [lane, e] of byLane) {
        const actor = e.actor?.name || 'unknown';
        out.push({
          subject: `lane:${pool}/lane-${lane}`,
          breach: true,
          measure: {
            pool, lane, action: e.action, at: e.ts, actor, pid: e.actor?.pid ?? null, ppid: e.actor?.ppid ?? null,
            headBefore: e.headBefore ?? null, headAfter: e.headAfter ?? null,
            dirtyBefore: e.dirtyBefore ?? null, workDirtyBefore: e.workDirtyBefore ?? null,
            unpushedCommitsBefore: e.unpushedCommitsBefore ?? null, remoteReachableNow: e.remoteReachableNow ?? null, aheadBefore: e.aheadBefore ?? null, reason: e.reason ?? null,
          },
          summary: `${pool}/lane-${lane}: ${e.action} by ${actor} at ${e.ts} destroyed unpushed work `
            + `(dirty ${e.dirtyBefore ?? '?'}, ahead ${e.aheadBefore ?? '?'}, HEAD ${String(e.headBefore || '?').slice(0, 9)}) — ${e.reason || 'no reason recorded'}.`,
          recommendation: `Read the timeline (\`node scripts/lane-whois.mjs --history ${lane}\`), recover HEAD ${e.headBefore || '?'} `
            + 'from the lane\'s reflog if the work is not on a remote, and fix whichever caller let the reset past the owner-gone check.',
        });
      }
    }
    return out;
  },
};
