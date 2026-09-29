/**
 * #4370 — a lane has a LIVE worker (a `claude agents` session whose cwd is inside it, or whose session is the
 * lane's last recorded holder) but NO lease. 2026-09-28: lane-21's lease was released by the reaper four times
 * in an hour, each ~11 min after acquire, while its worker kept building — the pool then treated the lane as
 * free and reset it under the worker.
 *
 * Reads `workerWithoutLease` off the lane-pool health watcher's per-tick line (`lanePools` probe — the whois
 * scan that tick already ran; absent when the reclaim sub-pass is disabled). Opens on the second consecutive
 * reading so a worker that is between `release` and exit is not flagged. Alert-only.
 */
export default {
  id: 'lane-worker-without-lease',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['lanePools'],
  openAfter: 2,
  closeAfter: 2,
  severity: 'high',
  action: 'alert',
  recommendationHint: 'A live worker is building in a lane that holds no lease — the pool may hand it out or reset it.',
  evaluate({ lanePools }, { now }) {
    const out = [];
    for (const p of lanePools || []) {
      for (const lane of Array.isArray(p?.workerWithoutLease) ? p.workerWithoutLease : []) {
        if (!Number.isInteger(lane)) continue;
        out.push({
          subject: `lane:${p.repo}/lane-${lane}`,
          breach: true,
          measure: { repo: p.repo, lane, readingAgeMs: Number.isFinite(p.at) ? now - p.at : null },
          summary: `${p.repo} lane-${lane} has a live worker but no lease — the pool reads it as free.`,
          recommendation: `Check who dropped the lease (\`node scripts/lane-whois.mjs --history ${lane}\`). If the worker is `
            + 'genuine, re-lease the lane for it; if a reaper released it, that reaper misread the worker as gone.',
        });
      }
    }
    return out;
  },
};
