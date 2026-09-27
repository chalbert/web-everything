/**
 * gh-call-failures — `gh` calls are failing host-wide, OR mutating host-wide too fast. Reads the gh-throttle
 * sidecar call log (`<gh lock root>/calls.jsonl`, written by `we:scripts/lib/gh-throttle.mjs` for every `gh`
 * call routed through the App shim) over the last 15 minutes.
 *
 * Live 2026-09-27 ~04:00-04:20Z (landing freeze): 229 + 227 failed calls and 75 rate-limit `retry_exhausted`
 * lines in 20 minutes, preceded 03:5xZ by a mutation burst (`pr edit` ~x80 + `pr comment` ~x75 in ten minutes —
 * `api --method` x152 in that same burst turned out on inspection to be `--method GET` reads, not mutations;
 * see `we:scripts/lib/gh-throttle.mjs#classifyGhWrite`'s own doc comment). The drain failed every pass with a
 * bare `gh-error` and the review daemon's smoke timed out on `gh pr list`, yet nothing named the cause. The
 * same episode also exposed the throttle crashing every `gh` call made from a cwd outside the workspace
 * (EACCES on its lock root) — now fail-open, recorded as a `fail_open` line here.
 *
 * Breaches when ANY of: a `fail_open` line (the throttle itself broke), `minExhausted` rate-limit
 * `retry_exhausted` lines, a failure ratio >= `maxFailRatio` over at least `minCalls` calls, OR (#gh-write-burst)
 * a sustained WRITE rate — the burst's own actual shape — at or above `maxWriteBudgetFraction` of the write
 * budget `gh-throttle.mjs` itself now enforces (`resolveGhWriteBudgetPerMin`), so this alerts on the SAME
 * mutation-rate signal the throttle's own write-budget gate queues against, rather than a second, independently
 * guessed threshold.
 */
import { MINUTE } from '../health-watch-core.mjs';
import { resolveGhWriteBudgetPerMin } from '../../lib/gh-throttle.mjs';

/** PURE: reduce parsed calls.jsonl entries to the window's counts. */
export function summarizeGhCalls(entries, { now, windowMs = 15 * MINUTE } = {}) {
  const s = {
    calls: 0, failed: 0, exhausted: 0, failOpen: 0, failOpenStages: {}, failedByOp: {},
    writes: 0, writesByCaller: {},
  };
  for (const e of entries || []) {
    const t = Date.parse(e?.ts || '');
    if (!Number.isFinite(t) || now - t > windowMs || t > now + MINUTE) continue;
    if (e.outcome === 'call') {
      s.calls += 1;
      if (e.ok === false) { s.failed += 1; s.failedByOp[e.op || '?'] = (s.failedByOp[e.op || '?'] || 0) + 1; }
      if (e.w === true) { s.writes += 1; s.writesByCaller[e.caller || 'unknown'] = (s.writesByCaller[e.caller || 'unknown'] || 0) + 1; }
    } else if (e.outcome === 'retry_exhausted') s.exhausted += 1;
    else if (e.outcome === 'fail_open') { s.failOpen += 1; s.failOpenStages[e.stage || '?'] = (s.failOpenStages[e.stage || '?'] || 0) + 1; }
  }
  s.writesPerMin = s.writes / (windowMs / MINUTE);
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
  // #gh-write-burst — a write-RATE breach independent of failure/retry signals: the 2026-09-27 burst itself
  // (03:5xZ) preceded any failure at all, so a smell that only reacts to failures would have stayed quiet
  // through the whole run-up. `maxWriteBudgetFraction` is checked against `gh-throttle.mjs`'s OWN write-budget
  // ceiling (see `resolveGhWriteBudgetPerMin`) — never a second, independently-guessed number — so this smell
  // and the throttle's own queuing gate can never disagree about what "too fast" means.
  maxWriteBudgetFraction: 0.8,
  recommendationHint: 'gh calls are failing host-wide — the drain and the daemons cannot read GitHub.',
  evaluate({ ghCalls }, { now }) {
    const s = summarizeGhCalls(ghCalls, { now, windowMs: this.windowMs });
    const ratio = s.calls ? s.failed / s.calls : 0;
    const ratioBreach = s.calls >= this.minCalls && ratio >= this.maxFailRatio;
    const writeBudgetPerMin = resolveGhWriteBudgetPerMin();
    const writeRateBreach = s.writesPerMin >= this.maxWriteBudgetFraction * writeBudgetPerMin;
    const breach = s.failOpen > 0 || s.exhausted >= this.minExhausted || ratioBreach || writeRateBreach;
    const topOps = Object.entries(s.failedByOp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([op, n]) => `${op}×${n}`).join(', ');
    const topWriteCallers = Object.entries(s.writesByCaller).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c}×${n}`).join(', ');
    return [{
      subject: 'gh-calls',
      breach,
      measure: {
        calls: s.calls, failed: s.failed, failRatio: Math.round(ratio * 100) / 100, rateLimitExhausted: s.exhausted,
        failOpen: s.failOpen, failOpenStages: s.failOpenStages, failedByOp: s.failedByOp,
        writes: s.writes, writesPerMin: Math.round(s.writesPerMin * 10) / 10, writeBudgetPerMin, writesByCaller: s.writesByCaller,
      },
      summary: `gh in 15m: ${s.failed}/${s.calls} failed, ${s.exhausted} rate-limit retries exhausted${s.failOpen ? `, ${s.failOpen} throttle fail-open(s)` : ''}${topOps ? ` (top: ${topOps})` : ''}; `
        + `writes ${Math.round(s.writesPerMin * 10) / 10}/min of a ${writeBudgetPerMin}/min budget${topWriteCallers ? ` (top writer: ${topWriteCallers})` : ''}.`,
      recommendation: s.failOpen
        ? `gh-throttle could not set up its lock (${Object.keys(s.failOpenStages).join(', ')}) and ran gh unthrottled — check the lock root (WE_GH_THROTTLE_LOCK_ROOT / ~/workspace/.lanes/.admission/gh) is writable.`
        : s.exhausted >= this.minExhausted
          ? `GitHub is rate-limiting this host (rate-limit retries exhausted) — the top write caller in calls.jsonl (${topWriteCallers || 'none recorded'}) is where to look first; landing stalls until the limit clears.`
          : writeRateBreach
            ? `A caller is mutating PRs faster than gh-throttle's own write budget expects (${Math.round(s.writesPerMin * 10) / 10}/min of ${writeBudgetPerMin}/min) — top writer: ${topWriteCallers || 'none recorded'}. Check that caller for a non-idempotent per-tick write loop before it trips GitHub's secondary rate limit.`
            : 'A large share of gh calls are failing — check auth (github-app-status) and GitHub status.',
    }];
  },
};
