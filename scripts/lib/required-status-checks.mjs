/**
 * @file scripts/lib/required-status-checks.mjs — @module required-status-checks
 *
 * THE PROBLEM THIS CLOSES (LIVE INCIDENT 2026-09-26, PR #2748, chalbert/web-everything): "CI failed" was
 * decided by an EXCLUSION list (`we:scripts/operations/pr-status.mjs#CI_TRUTH_EXCLUDED_CHECKS`) — every check
 * counted as CI truth EXCEPT the ones named on that list. A brand-new advisory workflow (the soak-replay gate,
 * PR #2775) went red on a PR whose every REQUIRED check (`test`/`smoke`/`daemon-soak`) was green, and every
 * wholesale "is anything red" reader (`we:scripts/progress-board.mjs#ciFailed`, `we:scripts/readiness/
 * conveyor-state.mjs#ciRollup`, this file's sibling `reduceCheckState`, `we:scripts/operator/dispatch.mjs
 * #healCi`) read it as a genuine CI failure anyway, because nobody had yet added its name to the exclusion
 * list — an advisory workflow's mere EXISTENCE was enough to cause a false red, and the same will be true of
 * the NEXT one someone adds, forever, unless something closes the gap structurally.
 *
 * THE FIX: invert the question. Branch protection (`gh api repos/<repo>/branches/<branch>/protection --jq
 * .required_status_checks.contexts`) already states which checks are ACTUALLY required to merge — the one
 * ground truth that does not need updating by hand every time a new advisory workflow is added. A reader that
 * asks "did a REQUIRED check fail" instead of "did any check outside a hand-maintained exclusion list fail"
 * cannot be fooled by a new advisory check, because the new check simply is not in the required set until
 * someone deliberately adds it to branch protection.
 *
 * THIS FILE OWNS THE IO (`gh api …`, cached to a sidecar file — same convention as `we:scripts/progress-
 * board.mjs`'s own `reports/.progress-board-cache.json`) so every PURE reducer that wants the required set
 * (`ciFailed`/`classifyPr` in `we:scripts/progress-board.mjs`, `we:scripts/conveyor/reconcile-core.mjs
 * #planReconcile`) can accept it as plain data, with no network call of their own, matching this repo's
 * standing "the gh calls are injected, so every branch is reachable in a test with no network" convention (see
 * `we:scripts/operations/pr-status.mjs`'s own file header).
 *
 * DEGRADATION, on the same "never lose the read" principle `we:scripts/progress-board.mjs` documents: a fresh
 * live fetch wins when available; a live fetch that fails falls back to the last cache written (even stale —
 * a branch-protection change is rare, so a day-old required set is still far more accurate than guessing);
 * with no cache at all, {@link FALLBACK_REQUIRED_STATUS_CHECKS} is the last resort — the required set as
 * confirmed live on 2026-09-26 (`test`, `smoke`, `daemon-soak`). A caller can always tell which happened via
 * the returned `source` (`'live'` / `'cache'` / `'stale-cache'` / `'fallback'`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The required set as confirmed live on 2026-09-26 (`gh api repos/chalbert/web-everything/branches/main/
 * protection --jq .required_status_checks.contexts`). Used ONLY when a live fetch fails AND no cache (even a
 * stale one) exists — see this file's header. Deliberately NOT frozen-and-forgotten as the source of truth:
 * a real branch-protection change is picked up on the next successful live fetch regardless of this constant.
 */
export const FALLBACK_REQUIRED_STATUS_CHECKS = Object.freeze(['test', 'smoke', 'daemon-soak']);

const DEFAULT_CACHE_TTL_MS = 15 * 60_000;

/** Where the cache sidecar lives — mirrors `we:scripts/progress-board.mjs#cachePathFor`'s own convention. */
export function defaultCachePath() {
  return join(process.cwd(), 'reports', '.required-status-checks-cache.json');
}

/**
 * The injected `gh` reader. Returns the repo's required status-check context names, or throws — never
 * swallows an error itself, so {@link getRequiredStatusChecks} is the one place that decides what a failure
 * degrades to.
 *
 * `repo` OMITTED (null/undefined) uses `gh api`'s own `{owner}/{repo}` template placeholders, resolved from
 * the CURRENT directory's git remote — the same "let gh infer it" convention this repo's other readers use
 * (e.g. `we:scripts/conveyor/reconcile-pass.mjs#defaultReadAheadBy`) — rather than failing a caller that never
 * had a repo slug to pass.
 * @param {{repo?: string, branch?: string}} o
 * @returns {string[]}
 */
export function defaultReadRequiredStatusChecks({ repo, branch = 'main' } = {}) {
  const out = execFileSync(
    'gh',
    ['api', `repos/${repo || '{owner}/{repo}'}/branches/${branch}/protection`, '--jq', '.required_status_checks.contexts'],
    { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(out.trim() || '[]');
  if (!Array.isArray(parsed)) throw new Error('required-status-checks: unexpected shape from branch protection');
  return parsed.map(String);
}

/**
 * The required set for `repo`'s `branch`, cached — see this file's header for the full fallback chain. PURE
 * apart from the injected `readChecks` and the cache file IO, both of which a test can stub/redirect.
 *
 * @param {object} o
 * @param {string} o.repo - `owner/name` slug (branch protection is repo-scoped).
 * @param {string} [o.branch] - defaults to `'main'`.
 * @param {string} [o.cachePath] - defaults to {@link defaultCachePath}.
 * @param {number} [o.now] - epoch ms; defaults to `Date.now()`.
 * @param {number} [o.ttlMs] - how long a cached read is trusted before a fresh live fetch is attempted again;
 *   defaults to 15 minutes. A stale-but-only-option cache is still preferred over the hardcoded fallback (see
 *   header), so this bounds re-FETCH frequency, not cache USABILITY.
 * @param {Function} [o.readChecks] - defaults to {@link defaultReadRequiredStatusChecks}.
 * @returns {{checks: string[], source: 'live'|'cache'|'stale-cache'|'fallback'}}
 */
export function getRequiredStatusChecks({
  repo,
  branch = 'main',
  cachePath = defaultCachePath(),
  now = Date.now(),
  ttlMs = DEFAULT_CACHE_TTL_MS,
  readChecks = defaultReadRequiredStatusChecks,
} = {}) {
  const key = `${repo || ''}@${branch}`;
  let cache = null;
  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (parsed && parsed.key === key && Array.isArray(parsed.checks) && Number.isFinite(parsed.fetchedAtMs)) {
      cache = parsed;
    }
  } catch {
    /* no cache, or unreadable — a fresh live fetch (or the hardcoded fallback) is next */
  }

  if (cache && (now - cache.fetchedAtMs) < ttlMs) {
    return { checks: cache.checks, source: 'cache' };
  }

  try {
    const checks = readChecks({ repo, branch });
    if (Array.isArray(checks) && checks.length) {
      try {
        mkdirSync(dirname(cachePath), { recursive: true });
        writeFileSync(cachePath, JSON.stringify({ key, checks, fetchedAtMs: now }, null, 2) + '\n');
      } catch {
        /* the cache is an optimisation — never fail this read over a write it doesn't need to succeed */
      }
      return { checks, source: 'live' };
    }
  } catch {
    /* gh missing, unauthenticated, offline, rate-limited, or an unexpected response shape — degrade below */
  }

  if (cache) return { checks: cache.checks, source: 'stale-cache' };
  return { checks: FALLBACK_REQUIRED_STATUS_CHECKS.slice(), source: 'fallback' };
}
