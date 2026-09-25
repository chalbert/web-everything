/**
 * #4077 (added at the coordinator's request, 2026-09-25) — heavy-command queue wait. Reads the declared
 * heavy-admission status (`node scripts/readiness/heavy-admission.mjs status --json`: cap, held slots, waiters
 * with `requestedAt`). Warns when any waiter has waited over 30 min, or a slot holder has held its slot over
 * 40 min. Live 16:02 ET: lane-9 had waited 1.5 h. Held slots carry no acquire time, so a holder's age is measured
 * from when the health watch first saw that (slot, owner, pid) — `ctx.heavyHeldSince`, kept in the watch's state
 * (a lower bound; flagged `holdAgeFrom: 'first-seen'`).
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

const laneOf = (owner) => { const m = /lane-(\d+)/.exec(String(owner ?? '')); return m ? `lane-${m[1]}` : String(owner ?? '?').split('/').pop(); };

export default {
  id: 'heavy-queue-wait',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['heavyQueue'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'medium',
  action: 'investigate',
  waitMaxMs: 30 * MINUTE,
  holdMaxMs: 40 * MINUTE,
  recommendationHint: 'The heavy-command queue is backed up; the report names who waits and who holds.',
  evaluate({ heavyQueue }, { now, heavyHeldSince = {} }) {
    const waiters = (heavyQueue.waiting || []).map((w) => ({ lane: laneOf(w.owner), pid: w.pid, waitedMs: now - (Date.parse(w.requestedAt || '') || now) }));
    const holders = (heavyQueue.held || []).map((h) => {
      const since = heavyHeldSince[`${h.slot}|${h.owner}|${h.pid}`] ?? now;
      return { slot: h.slot, lane: laneOf(h.owner), pid: h.pid, heldMs: now - since };
    });
    const longWait = waiters.filter((w) => w.waitedMs > this.waitMaxMs).sort((a, b) => b.waitedMs - a.waitedMs);
    const longHold = holders.filter((h) => h.heldMs > this.holdMaxMs).sort((a, b) => b.heldMs - a.heldMs);
    const round = (x) => Math.round(x / MINUTE);
    return [{
      subject: 'heavy-admission',
      breach: longWait.length > 0 || longHold.length > 0,
      measure: {
        cap: heavyQueue.cap ?? null, heldCount: heavyQueue.heldCount ?? holders.length, waiting: waiters.length,
        longWaiters: longWait.map((w) => ({ lane: w.lane, pid: w.pid, waitedMin: round(w.waitedMs) })),
        longHolders: longHold.map((h) => ({ slot: h.slot, lane: h.lane, pid: h.pid, heldMin: round(h.heldMs) })),
        holdAgeFrom: 'first-seen',
      },
      summary: [
        longWait.length ? `${longWait.length} waiter(s) past ${fmtAge(this.waitMaxMs)} (longest: ${longWait[0].lane} ${fmtAge(longWait[0].waitedMs)})` : '',
        longHold.length ? `${longHold.length} slot(s) held past ${fmtAge(this.holdMaxMs)} (longest: ${longHold[0].lane} ${fmtAge(longHold[0].heldMs)}+)` : '',
      ].filter(Boolean).join('; ') || `heavy queue: ${waiters.length} waiting, ${holders.length}/${heavyQueue.cap ?? '?'} held`,
      recommendation: longHold.length
        ? `${longHold[0].lane} (pid ${longHold[0].pid}) has held a heavy slot for ${fmtAge(longHold[0].heldMs)}+ while others wait — check whether that run is hung; the product fix is a wall-clock cap on a heavy slot.`
        : `Heavy-command waiters are queued past ${fmtAge(this.waitMaxMs)} (cap ${heavyQueue.cap ?? '?'}) — the slots are busy with long runs; raise the cap only if the host has headroom, else shorten the heavy runs.`,
    }];
  },
};
