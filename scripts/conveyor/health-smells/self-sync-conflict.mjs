/**
 * #4068 (slice 3 of #4065) — a daemon's self-sync is in CONFLICT: it is behind origin/main and cannot move
 * without a hand merge. Two real shapes, both seen on 2026-09-24:
 *   1. the merge-style self-sync (`we:scripts/lib/daemon-self-sync.mjs`, the POC path and pre-rebuild clones)
 *      logs `daemon-self-sync: [POC mode: <branch>] behind but NOT syncing (conflict|dirty|not-on-branch)` or
 *      `daemon-self-sync: behind origin/main but NOT syncing (conflict)` on every tick it stays stuck — read
 *      from each daemon's own log (only the lines new since the last health tick, so a daemon that stops
 *      printing it closes the episode);
 *   2. the gated rebuild (`we:scripts/lib/daemon-rebuild.mjs`) records a `pinned-overlay-conflict` alert when a
 *      PINNED overlay no longer merges onto main — it cannot auto-drop a pinned overlay, so it stays stuck until
 *      someone rebases the overlay's branch.
 * A clone HELD behind main for any other reason (a rejected smoke, a dirty tree) is `clone-stale`'s sign, and a
 * clone frozen on its last-good build is `daemon-held-on-last-good`'s — this sign is only the merge conflict.
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

/** Both self-sync log shapes: `[POC mode: <branch>] behind but NOT syncing (<reason>)` and the plain one. */
export const SELF_SYNC_STUCK_RE = /daemon-self-sync: (?:\[POC mode: ([^\]]+)\] )?behind(?: origin\/main)? but NOT syncing \((conflict|dirty|not-on-branch)\)/g;

/** PURE: the stuck self-sync lines in one log sample's new text → `{count, reasons, pocBranch}`. */
export function stuckSelfSyncLines(text) {
  const reasons = {};
  let count = 0;
  let pocBranch = null;
  for (const m of String(text || '').matchAll(SELF_SYNC_STUCK_RE)) {
    count += 1;
    reasons[m[2]] = (reasons[m[2]] || 0) + 1;
    pocBranch = m[1] ?? pocBranch;
  }
  return { count, reasons, pocBranch };
}

export default {
  id: 'self-sync-conflict',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['daemonLogs', 'selfSync'],
  openAfter: 1,
  closeAfter: 3,
  severity: 'high',
  action: 'investigate',
  recentMs: 30 * MINUTE,
  recommendationHint: 'A daemon clone cannot self-sync onto origin/main without a hand merge — rebase the conflicting branch (or clean the clone\'s tree), never force the clone.',
  evaluate({ daemonLogs, selfSync }, { now }) {
    const out = [];
    for (const s of daemonLogs || []) {
      const hit = stuckSelfSyncLines(s.text);
      if (!hit.count) continue;
      const top = Object.entries(hit.reasons).sort((a, b) => b[1] - a[1])[0][0];
      out.push({
        subject: `daemon:${s.name}`,
        breach: true,
        measure: { lines: hit.count, reasons: hit.reasons, pocBranch: hit.pocBranch },
        summary: `${s.name}: self-sync behind${hit.pocBranch ? ` (POC ${hit.pocBranch})` : ' origin/main'} but NOT syncing (${top}) — ${hit.count} line(s) since the last health tick.`,
        recommendation: top === 'conflict'
          ? `${s.name}'s clone conflicts with ${hit.pocBranch ? `origin/${hit.pocBranch}` : 'origin/main'} — merge it by hand in that clone (or rebase the branch it carries), then let the daemon restart onto the result.`
          : top === 'dirty'
            ? `${s.name}'s clone has local modifications, so self-sync refuses to merge — find what writes tracked files inside a daemon clone and move that output under the state root.`
            : `${s.name}'s clone is not on its expected branch, so self-sync refuses to merge — check out the branch the daemon was started on.`,
      });
    }
    for (const c of selfSync || []) {
      const last = (c.alerts || []).filter((a) => a.kind === 'pinned-overlay-conflict' && a.at != null && a.at <= now).at(-1);
      if (!last) continue;
      const ageMs = now - last.at;
      const d = last.detail || {};
      out.push({
        subject: `clone:${c.cloneKey}`,
        breach: ageMs <= this.recentMs,
        measure: { lastAt: new Date(last.at).toISOString(), ref: d.ref ?? null, pr: d.pr ?? null, pinnedBy: d.pinnedBy ?? null },
        summary: `clone ${c.cloneKey}: pinned overlay ${d.ref ?? '?'}${d.pr ? ` (PR #${d.pr})` : ''} conflicts with origin/main — last seen ${fmtAge(ageMs)} ago.`,
        recommendation: `Rebase ${d.ref ?? 'the pinned overlay'}${d.pr ? ` (PR #${d.pr})` : ''} onto origin/main — a pinned overlay is never auto-dropped, so the rebuild keeps skipping it until its branch merges cleanly again.`,
      });
    }
    return out;
  },
};
