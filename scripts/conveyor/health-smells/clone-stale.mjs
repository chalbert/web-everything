/**
 * (c) / #4077 (design smell 4, pulled into slice 1) — a daemon clone stuck behind `main`, or its gated rebuild
 * rejecting the new tree. Reads ~/.claude/daemon-self-sync-state/<cloneKey>.alerts.jsonl (`smoke-rejected`,
 * `clone-held-stale`, `smoke-slow`) and <cloneKey>.rebuild.json. 2026-09-25 08:15 ET: the rebuild's smoke gate
 * rejected `gh` calls, the clone was held stale, and every daemon on it refused dispatch as stale — the
 * `daemonsRefusingStale`/`staleDaemons` reporting below still watches for exactly that. Since x5wbsbc
 * (2026-09-26), a MANAGED clone with a known last-good build no longer refuses this way: it falls back to
 * dispatching from that last-good build instead of blocking (`main-staleness.mjs#assertMainNotStale`) — the
 * `daemon-held-on-last-good` sign is what now watches how long it stays on that fallback.
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';

// `dirty`: the rebuild refuses to move a clone with local modifications (2026-09-25 13:35 ET: a tracked
// scorecard file written inside the review daemon's clone held it 10 commits behind main and every review failed).
const BAD = new Set(['smoke-rejected', 'clone-held-stale', 'smoke-slow', 'quarantined', 'rebuild-failed', 'dirty']);
const HOLDING = new Set(['smoke-rejected', 'clone-held-stale', 'quarantined', 'rebuild-failed', 'dirty']);

export default {
  id: 'clone-stale',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['selfSync'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'high',
  action: 'investigate',
  recentMs: 15 * MINUTE,
  inProgressMaxMs: 20 * MINUTE,
  recommendationHint: 'A daemon clone is held behind origin/main; its alerts file names the rejected smoke step.',
  evaluate({ selfSync }, { now, daemons }) {
    const staleDaemons = Object.entries(daemons)
      .filter(([, m]) => m.lastTick?.unproductive && (m.lastTick.blocking || []).some((b) => /stale-checkout/.test(b)))
      .map(([n]) => n);
    return selfSync.map((c) => {
      const alerts = (c.alerts || []).filter((a) => a.at != null && a.at <= now);
      const adoptedAt = c.rebuild?.adopted?.at ?? null;
      const lastBad = alerts.filter((a) => BAD.has(a.kind)).at(-1) ?? null;
      const recentBad = lastBad && now - lastBad.at <= this.recentMs;
      // A rejected or held rebuild leaves the clone on old code until the NEXT adoption — the episode stays open
      // until then, however old the alert (2026-09-25: smoke-rejected 08:15 ET, still held at 09:30).
      const heldUnresolved = lastBad && HOLDING.has(lastBad.kind) && (adoptedAt == null || adoptedAt < lastBad.at);
      const inProg = c.rebuild?.inProgress?.startedAt ?? null;
      const stuckRebuild = inProg != null && now - inProg > this.inProgressMaxMs;
      const rejected = !!c.rebuild?.rejected || !!c.rebuild?.quarantine;
      const why = [recentBad && `${lastBad.kind} ${fmtAge(now - lastBad.at)} ago`, heldUnresolved && `held off origin/main since ${fmtAge(now - lastBad.at)} ago (no adoption since)`, stuckRebuild && `rebuild in progress for ${fmtAge(now - inProg)}`, rejected && 'rebuild state records a rejection/quarantine'].filter(Boolean);
      const failed = lastBad?.detail?.failed;
      return {
        subject: `clone:${c.cloneKey}`,
        breach: why.length > 0,
        measure: { lastBadKind: lastBad?.kind ?? null, lastBadAt: lastBad ? new Date(lastBad.at).toISOString() : null, failedSmoke: failed ?? null, adoptedAt: adoptedAt ? new Date(adoptedAt).toISOString() : null, rebuildInProgressMin: inProg ? Math.round((now - inProg) / MINUTE) : null, daemonsRefusingStale: staleDaemons },
        summary: `clone ${c.cloneKey}: ${why.join('; ') || 'healthy'}${failed ? ` (failed smoke: ${failed})` : ''}${staleDaemons.length ? `; refusing as stale: ${staleDaemons.join(', ')}` : ''}.`,
        recommendation: lastBad?.kind === 'dirty'
          ? `The rebuild will not move clone ${c.cloneKey}: it has local modifications (${[].concat(lastBad.detail ?? []).join(', ').slice(0, 160)}). Something writes tracked files inside a daemon clone — the product fix is pinning that writer's output under the state root (#4052), not cleaning the clone by hand.`
          : lastBad?.kind === 'smoke-slow' && !heldUnresolved
          ? `The rebuild's smoke gate took ${Math.round((lastBad.detail?.ms ?? 0) / 1000)}s (${String(lastBad.detail?.checks ?? '').slice(0, 160)}) — the slowest check is the product fix; a slow smoke delays every daemon's move to new code.`
          : failed
          ?`The rebuild's smoke gate fails on ${failed} — run that smoke step by hand from the clone to see the error, and fix the tooling it exercises (a shim or dependency), not the clone.`
          : `The clone ${c.cloneKey} is not advancing to origin/main — read ~/.claude/daemon-self-sync-state/${c.cloneKey}.alerts.jsonl and .rebuild.json for the held reason.`,
      };
    });
  },
};
