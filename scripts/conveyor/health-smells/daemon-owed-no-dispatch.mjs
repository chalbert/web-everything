/**
 * Seed smell 1 + (b) / #4077 — a daemon with owed work that dispatches NOTHING for over 30 minutes: every tick
 * ends "dispatched 0" with a blocking refusal (no lane, dispatch-failed, stale clone) or a thrown tick.
 * 2026-09-25: the fix-dispatch daemon logged "dispatched 0, refused N" for hours (`{{SCOPE}}` dispatch-failed,
 * stale-clone refusals), and the review daemon's ticks threw from 09:20 to 09:59. Correct no-ops
 * (`nothing-owed`, `live-process`, `cap-exhausted`, …) never count. The deterministic diagnosis is the refusal
 * reason histogram itself, read from the daemon's own log.
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

function recommend(daemon, top) {
  if (!top) return `${daemon} is not dispatching; read its log tail for the refusal reason.`;
  if (/stale-checkout/.test(top)) return `${daemon} refuses because its clone is behind origin/main and the gated rebuild is holding it — see the clone-stale episode; the fix is whatever makes the rebuild's smoke gate pass.`;
  if (/\{\{\w+\}\}|placeholder/.test(top)) return `${daemon}'s dispatch brief has an unfilled placeholder (${(top.match(/\{\{\w+\}\}/) || ['?'])[0]}) — a product bug in the dispatch path; file or fix the card that makes that placeholder optional or filled.`;
  if (/no-lane|no acquirable lane/.test(top)) return `${daemon} has no free lane — see the lane-starvation episode (leaked leases or dirty lanes).`;
  if (/^tick failed/.test(top)) return `${daemon}'s tick throws ("${top.replace(/^tick failed: /, '')}") — a code bug in the daemon; find the commit that introduced it.`;
  return `${daemon} keeps refusing with "${top}" — read the log and fix the refusing gate.`;
}

export default {
  id: 'daemon-owed-no-dispatch',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['daemonLogs'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'high',
  action: 'investigate',
  minDurationMs: 30 * MINUTE,
  minTicks: 2,
  // A daemon whose ticks alternate throw / succeed never builds a 30-minute streak (2026-09-25 09:20-09:59 ET: the
  // review daemon's ticks threw "reading 'map'" 3-4 times, restarted, dispatched once, threw again). So a second
  // rule: most of the last 30 minutes' ticks unproductive.
  ratioWindowMs: 30 * MINUTE,
  ratioMin: 0.6,
  ratioMinTicks: 4,
  recommendationHint: 'A daemon has owed work but dispatches nothing; the refusal histogram in the report names why.',
  evaluate(_probes, { now, daemons }) {
    const out = [];
    for (const [name, mem] of Object.entries(daemons)) {
      if (!mem.ticksSeen) continue;
      const running = mem.unproductiveSince != null && mem.lastTick?.unproductive;
      const dur = running ? now - mem.unproductiveSince : 0;
      const reasons = Object.entries(mem.unproductiveReasons || {}).sort((a, b) => b[1] - a[1]);
      const win = (mem.recentTicks || []).filter((t) => now - t.at <= this.ratioWindowMs);
      const bad = win.filter((t) => t.u);
      const ratio = win.length ? bad.length / win.length : 0;
      const ratioBreach = win.length >= this.ratioMinTicks && ratio >= this.ratioMin;
      const streakBreach = running && dur >= this.minDurationMs && mem.unproductiveTicks >= this.minTicks;
      const winReasons = {};
      for (const t of bad) if (t.why) winReasons[t.why] = (winReasons[t.why] || 0) + 1;
      const top = reasons[0]?.[0] ?? Object.entries(winReasons).sort((a, b) => b[1] - a[1])[0]?.[0];
      out.push({
        subject: name,
        breach: streakBreach || ratioBreach,
        measure: { unproductiveForMin: Math.round(dur / MINUTE), unproductiveTicks: mem.unproductiveTicks, last30m: { ticks: win.length, unproductive: bad.length, reasons: winReasons }, estimated: !!mem.lastTickEstimated, reasons: Object.fromEntries(reasons.slice(0, 8)), lastTick: mem.lastTick },
        summary: streakBreach || !ratioBreach
          ? `${name}: ${mem.unproductiveTicks} tick(s) over ${fmtAge(dur)} dispatched nothing while blocked${top ? ` — top reason: ${top}` : ''}.`
          : `${name}: ${bad.length} of its last ${win.length} ticks (30m) dispatched nothing while blocked${top ? ` — top reason: ${top}` : ''}.`,
        recommendation: recommend(name, top),
      });
    }
    return out;
  },
};
