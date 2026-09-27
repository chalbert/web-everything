/**
 * gh-call-failures — `gh` calls are failing host-wide. Reads the gh-throttle sidecar call log
 * (`<gh lock root>/calls.jsonl`, written by `we:scripts/lib/gh-throttle.mjs` for every `gh` call routed through
 * the App shim) over the last 15 minutes.
 *
 * Live 2026-09-27 ~04:00-04:20Z (landing freeze): 229 + 227 failed calls and 75 rate-limit `retry_exhausted`
 * lines in 20 minutes, after a mutation burst (~300 `pr edit` / `pr comment` / `api --method` calls in 10 min).
 * The drain failed every pass with a bare `gh-error` and the review daemon's smoke timed out on `gh pr list`,
 * yet nothing named the cause. The same episode also exposed the throttle crashing every `gh` call made from a
 * cwd outside the workspace (EACCES on its lock root) — now fail-open, recorded as a `fail_open` line here.
 *
 * Breaches when ANY of: a `fail_open` line (the throttle itself broke), `minExhausted` rate-limit
 * `retry_exhausted` lines, or a failure ratio >= `maxFailRatio` over at least `minCalls` calls.
 */
import { MINUTE } from '../health-watch-core.mjs';

/** PURE: reduce parsed calls.jsonl entries to the window's counts. */
export function summarizeGhCalls(entries, { now, windowMs = 15 * MINUTE } = {}) {
  const s = { calls: 0, failed: 0, exhausted: 0, failOpen: 0, failOpenStages: {}, failedByOp: {} };
  for (const e of entries || []) {
    const t = Date.parse(e?.ts || '');
    if (!Number.isFinite(t) || now - t > windowMs || t > now + MINUTE) continue;
    if (e.outcome === 'call') {
      s.calls += 1;
      if (e.ok === false) { s.failed += 1; s.failedByOp[e.op || '?'] = (s.failedByOp[e.op || '?'] || 0) + 1; }
    } else if (e.outcome === 'retry_exhausted') s.exhausted += 1;
    else if (e.outcome === 'fail_open') { s.failOpen += 1; s.failOpenStages[e.stage || '?'] = (s.failOpenStages[e.stage || '?'] || 0) + 1; }
  }
  return s;
}

export default {
  id: 'gh-call-failures',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['ghCalls'],
  openAfter: 1,
  closeAfter: 2,
  severity: 'high',
  action: 'alert',
  windowMs: 15 * MINUTE,
  minExhausted: 5,
  minCalls: 20,
  maxFailRatio: 0.4,
  recommendationHint: 'gh calls are failing host-wide — the drain and the daemons cannot read GitHub.',
  evaluate({ ghCalls }, { now }) {
    const s = summarizeGhCalls(ghCalls, { now, windowMs: this.windowMs });
    const ratio = s.calls ? s.failed / s.calls : 0;
    const ratioBreach = s.calls >= this.minCalls && ratio >= this.maxFailRatio;
    const breach = s.failOpen > 0 || s.exhausted >= this.minExhausted || ratioBreach;
    const topOps = Object.entries(s.failedByOp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([op, n]) => `${op}×${n}`).join(', ');
    return [{
      subject: 'gh-calls',
      breach,
      measure: { calls: s.calls, failed: s.failed, failRatio: Math.round(ratio * 100) / 100, rateLimitExhausted: s.exhausted, failOpen: s.failOpen, failOpenStages: s.failOpenStages, failedByOp: s.failedByOp },
      summary: `gh in 15m: ${s.failed}/${s.calls} failed, ${s.exhausted} rate-limit retries exhausted${s.failOpen ? `, ${s.failOpen} throttle fail-open(s)` : ''}${topOps ? ` (top: ${topOps})` : ''}.`,
      recommendation: s.failOpen
        ? `gh-throttle could not set up its lock (${Object.keys(s.failOpenStages).join(', ')}) and ran gh unthrottled — check the lock root (WE_GH_THROTTLE_LOCK_ROOT / ~/workspace/.lanes/.admission/gh) is writable.`
        : s.exhausted >= this.minExhausted
          ? 'GitHub is rate-limiting this host (rate-limit retries exhausted) — find the caller bursting mutations (pr edit/comment, api --method) in calls.jsonl; landing stalls until the limit clears.'
          : 'A large share of gh calls are failing — check auth (github-app-status) and GitHub status.',
    }];
  },
};
