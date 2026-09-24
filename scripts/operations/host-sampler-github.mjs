/**
 * @file scripts/operations/host-sampler-github.mjs
 * @description THE GITHUB API BUDGET, sampled by the host sampler (epic #3383, capacity audit 2026-09-23). The shared
 * 5,000-per-hour budget ran out during that audit while `gh.throttle.*` (`we:scripts/lib/gh-throttle.mjs`) had written
 * zero records in three days: the wrapper only sees the callers already migrated onto it, and never an agent session's
 * own `gh` calls. So nothing could tell a delivery slowdown caused by GitHub from one caused by the machine. This reads
 * the budget itself, whoever spent it: one `gh api rate_limit` at most every {@link GH_BUDGET_EVERY_SEC} seconds. That
 * endpoint does not count against the budget it reports.
 *
 * PURE: {@link parseRateLimit}, {@link ghBudgetDue} and {@link credentialOf} take injected facts. The one `gh` call
 * lives in `host-sampler.mjs`'s IO edge.
 */

/** How often the budget is read. */
export const GH_BUDGET_EVERY_SEC = 300;

/** The buckets recorded (REST `core` and `graphql`; the others are rarely the ones that run out). */
export const GH_BUCKETS = Object.freeze(['core', 'graphql']);

/**
 * PURE. `gh api rate_limit` output → the recorded buckets, or null when the text is not a rate-limit document. A bucket
 * missing from the document is left out, never reported as 0.
 * @param {string} text
 * @returns {Array<{bucket:string, limit:number, used:number, remaining:number, resetAtMs:number|null}>|null}
 */
export function parseRateLimit(text) {
  let doc;
  try { doc = JSON.parse(String(text ?? '')); } catch { return null; }
  const res = doc?.resources;
  if (!res || typeof res !== 'object') return null;
  const out = [];
  for (const bucket of GH_BUCKETS) {
    const b = res[bucket];
    if (!b || ![b.limit, b.used, b.remaining].every(Number.isFinite)) continue;
    out.push({ bucket, limit: b.limit, used: b.used, remaining: b.remaining, resetAtMs: Number.isFinite(b.reset) ? b.reset * 1000 : null });
  }
  return out;
}

/** PURE. Is a budget read due? */
export function ghBudgetDue({ lastAtMs, nowMs, everySec = GH_BUDGET_EVERY_SEC }) {
  return !Number.isFinite(lastAtMs) || nowMs - lastAtMs >= everySec * 1000;
}

/** PURE. Which credential `gh` spends, as a low-cardinality label (never the token itself). */
export function credentialOf(env = {}) {
  if (env.GH_TOKEN) return 'env:GH_TOKEN';
  if (env.GITHUB_TOKEN) return 'env:GITHUB_TOKEN';
  return 'gh-auth';
}
