/**
 * critical-work.mjs — IS THIS WORK CRITICAL, AND WAS THIS MISS ON CRITICAL WORK? (#4034, epic #3383)
 *
 * Fork 4 of decision #4029 (platform-decisions.md#delegation-trial-record-graduation, rule 5): "critical" is the
 * EXISTING dispatch-risk / never-spot-check / human-required proxy already computed for the work, never a new
 * bespoke scale. This module only COMPOSES those existing sources; it re-implements none of them:
 *
 *   | proxy              | source (read directly, never copied)                                              |
 *   |--------------------|-----------------------------------------------------------------------------------|
 *   | `dispatch-risk`    | `dispatch-contracts.mjs#deriveRisk(...) === 'high'` (statute path or isHighStakesTask) |
 *   | `never-spot-check` | `dispatch-thresholds.mjs#NEVER_SPOT_CHECK_PATH_PREFIXES` (statute, gateSelf, irreversible) |
 *   | `human-required`   | `humanRequired: true` on the record, else `gate-config.mjs#isPrincipleSurface(path, null)` — the
 *   |                    | same predicate `review-escalation.mjs#scoreEscalation` derives `humanRequired` from, read with no
 *   |                    | diff yet (a statute path fails closed to "human", the leash floor is unconditional) |
 *   | `gate-self`        | `gate-config.mjs#isTrustChainPath` — the review gate's own policy + engine roster (the lander,
 *   |                    | the resident daemons, the dispatch loop)                                            |
 *   | `daemon-drain`     | {@link DAEMON_DRAIN_PATH_PREFIXES} / {@link DAEMON_DRAIN_NAME_RE} — the conveyor trees and any
 *   |                    | daemon or drain file the roster does not name yet (the one list this module owns)   |
 *
 * WHERE THIS IS READ. `dispatch-contracts.mjs#routeDispatch` computes {@link criticalWorkVerdict} for the task and
 * {@link criticalMissesFor} over the raw scorecards, and hands both to `provider-routing.mjs#selectProvider`, whose
 * `CRITICAL_WORK_GATE` opens a gated kind to a non-Claude worker ONLY for a non-critical task of an opened
 * taskType, and never for a {provider, model, taskType} triple with a critical miss on record (hard veto).
 *
 * WHY A SEPARATE MODULE rather than inside provider-routing.mjs (where the card first placed it): both
 * `dispatch-contracts.mjs` and `dispatch-thresholds.mjs` import provider-routing.mjs, and dispatch-thresholds reads
 * `DEFAULT_BACKDOWN_THRESHOLDS` at module top level — so provider-routing.mjs importing either would throw a TDZ
 * ReferenceError whenever provider-routing.mjs is the first module loaded. provider-routing.mjs stays pure and
 * import-cycle free; it receives the verdict as data.
 *
 * FAIL CLOSED. No declared scope → critical (`unknown-scope`). A miss row with no scope evidence → a critical miss.
 *
 * PURE: no fs, no process, no clock. Deterministic over its arguments. The one import cycle here
 * (dispatch-contracts ↔ this file) is safe: neither module reads the other's bindings at top level.
 */

import { deriveRisk, deriveComplexity } from './dispatch-contracts.mjs';
import { NEVER_SPOT_CHECK_PATH_PREFIXES, isNeverSpotCheckPath } from './dispatch-thresholds.mjs';
import { isPrincipleSurface, isTrustChainPath } from './gate-config.mjs';
import { CONSTELLATION_REPOS } from './constellation-repos.mjs';

/** The conveyor trees — every resident daemon's entry point and the tick/reconcile machinery they run. */
// @test-only-export-ok: the critical-work table (#4034), read by its own test and the dispatch dry-run
export const DAEMON_DRAIN_PATH_PREFIXES = Object.freeze(['scripts/conveyor/', 'skills-src/conveyor/']);

/** A daemon or drain file anywhere (`lane-drain.mjs`, `drain-lock.mjs`, `daemon-self-sync.mjs`, `tools/drain-daemon/`). */
// @test-only-export-ok: the critical-work table (#4034), read by its own test and the dispatch dry-run
export const DAEMON_DRAIN_NAME_RE = /(^|[/_.-])(daemons?|drain)([/_.-]|$)/i;

/** The confirmed-miss outcomes (#3949 writes `reworked` on a review:changes verdict; the red team #4195 too). */
// @test-only-export-ok: the critical-work table (#4034)
export const MISS_OUTCOMES = Object.freeze(['reworked', 'rejected']);

/** `we:scripts/x.mjs` → `scripts/x.mjs`; `plateau-app:tools/x` → `plateau-app/tools/x` (as decideDispatchRoute does). */
function normalizePath(p) {
  return String(p).trim().replace(/^we:/, '').replace(/^([A-Za-z0-9._-]+):/, '$1/').replace(/^\.\//, '');
}

/**
 * #4200 (epic #3383) — EVERY ALIAS `normalizePath` can leave as a sibling repo's own leading path segment
 * (`plateau-app/`, `plateau/`, `frontierui/`, `fui/`) — `we:`/`webeverything:` is already stripped bare by
 * `normalizePath` itself, so it needs no entry here. Sourced from `constellation-repos.mjs#CONSTELLATION_REPOS`
 * (the one table) plus the two short scope-prefix aliases `scripts/lib/repo-profile.mjs#SCOPE_PREFIXES`
 * documents (`fui`, `plateau`) — not imported from that file to keep this module's import graph exactly as
 * narrow as its own docblock already claims ("no fs, no process, no clock"; `repo-profile.mjs` reads `homedir()`
 * and `existsSync` at call time for ITS OWN callers, a capability this module has no reason to acquire).
 */
const SIBLING_REPO_PATH_ALIASES = Object.freeze(
  [...new Set([
    ...Object.entries(CONSTELLATION_REPOS).filter(([key]) => key !== 'we').flatMap(([, meta]) => meta.dirs),
    'fui', 'plateau',
  ])],
);

/**
 * #4200 — THE SAME FILE, RELATIVE TO ITS OWN REPO, given `normalizePath`'s already-normalized form. An
 * irreversible-tier pattern like `.github/workflows/` recurs IDENTICALLY in every constellation repo's own
 * layout — each has its own `.github/workflows/` at its own root — so testing only the WE-relative form (as
 * every OTHER never-spot-check group correctly does; `docs/agent/`, `scripts/check-standards` etc. are WE's
 * OWN governance/gate files with no sibling-repo equivalent) silently exempted a `plateau:`/`frontierui:`-scoped
 * deploy-workflow edit from the SAME rule a `we:`-scoped one already gets. Returns `null` when `f` carries no
 * recognized sibling-repo alias segment (already WE-relative, or an unrecognized prefix) — the caller always
 * tests the ORIGINAL string too, so this only ever ADDS a candidate, never replaces one. PURE.
 * @param {string} f - already run through {@link normalizePath}.
 * @returns {string|null}
 */
function repoRelativeForm(f) {
  for (const alias of SIBLING_REPO_PATH_ALIASES) {
    const prefix = `${alias}/`;
    if (f.startsWith(prefix)) return f.slice(prefix.length);
  }
  return null;
}

/**
 * Is this work critical? Pure.
 * @param {{taskType?: string, filesTouched?: string[], estimatedLoc?: number, acceptanceTestable?: boolean,
 *   risk?: string, humanRequired?: boolean}} work
 * @returns {{critical: boolean, reasons: Array<{proxy: string, detail: string}>}}
 */
// @test-only-export-ok: the critical-work predicate (#4034), wired through dispatch-contracts.mjs#routeDispatch
export function criticalWorkVerdict(work = {}) {
  const taskType = typeof work?.taskType === 'string' ? work.taskType : '';
  const files = Array.isArray(work?.filesTouched)
    ? [...new Set(work.filesTouched.filter((p) => typeof p === 'string' && p.trim()).map(normalizePath))]
    : [];
  const reasons = [];
  if (files.length === 0) {
    return { critical: true, reasons: [{ proxy: 'unknown-scope', detail: 'no declared scope: criticality cannot be ruled out (fail closed)' }] };
  }

  const estimatedLoc = Number.isFinite(work?.estimatedLoc) ? work.estimatedLoc : 0;
  const complexity = deriveComplexity(taskType, estimatedLoc, files.length);
  const risk = deriveRisk(taskType, files, complexity, work?.acceptanceTestable !== false);
  if (risk === 'high' || work?.risk === 'high') {
    reasons.push({ proxy: 'dispatch-risk', detail: `deriveRisk is high${work?.risk === 'high' && risk !== 'high' ? ' (raised by the requested risk)' : ''}` });
  }

  const groups = Object.entries(NEVER_SPOT_CHECK_PATH_PREFIXES)
    .filter(([name, prefixes]) => files.some((f) => {
      if (prefixes.some((prefix) => f.startsWith(prefix))) return true;
      // #4200 — ONLY `irreversible` recurs identically per repo (`.github/workflows/`, the deploy/land
      // mechanisms this rule exists to catch); `statute`/`gateSelf` name WE's OWN governance/gate files with
      // no sibling-repo equivalent, so they deliberately stay WE-relative-only, unchanged.
      if (name !== 'irreversible') return false;
      const relative = repoRelativeForm(f);
      return relative != null && prefixes.some((prefix) => relative.startsWith(prefix));
    }))
    .map(([group]) => group);
  if (groups.length || files.some(isNeverSpotCheckPath)) {
    reasons.push({ proxy: 'never-spot-check', detail: groups.length ? groups.join(',') : 'statute-tier path' });
  }

  const principle = files.filter((f) => isPrincipleSurface(f, null));
  if (work?.humanRequired === true || principle.length) {
    reasons.push({ proxy: 'human-required', detail: principle.length ? principle.join(',') : 'humanRequired on record' });
  }

  const trust = files.filter((f) => isTrustChainPath(f));
  if (trust.length) reasons.push({ proxy: 'gate-self', detail: trust.join(',') });

  const daemon = files.filter((f) => DAEMON_DRAIN_PATH_PREFIXES.some((prefix) => f.startsWith(prefix)) || DAEMON_DRAIN_NAME_RE.test(f));
  if (daemon.length) reasons.push({ proxy: 'daemon-drain', detail: daemon.join(',') });

  return { critical: reasons.length > 0, reasons };
}

/** A confirmed miss: an explicit `reworked`/`rejected` outcome (never inferred from `findings`). Pure. */
// @test-only-export-ok: the critical-work predicate (#4034)
export function isMissRecord(record) {
  return Boolean(record) && typeof record === 'object' && MISS_OUTCOMES.includes(record.outcome);
}

/**
 * Was this trial a miss on CRITICAL work? Pure. The scope comes from the row itself (`filesTouched`,
 * `humanRequired`, `risk`) or from caller-supplied `evidence` (e.g. the PR's changed files read at the io edge).
 * A miss with no scope evidence is critical — fail closed, the same direction rule 5 fails a missing class.
 * @param {object} record - a run-scorecard row
 * @param {{filesTouched?: string[], humanRequired?: boolean, risk?: string}} [evidence]
 * @returns {boolean}
 */
// @test-only-export-ok: the critical-work predicate (#4034), wired through dispatch-contracts.mjs#routeDispatch
export function isCriticalMiss(record, evidence = {}) {
  if (!isMissRecord(record)) return false;
  return criticalWorkVerdict({
    taskType: record.taskType,
    filesTouched: Array.isArray(record.filesTouched) ? record.filesTouched : evidence?.filesTouched,
    humanRequired: record.humanRequired === true || evidence?.humanRequired === true,
    risk: record.risk ?? evidence?.risk,
  }).critical;
}

/**
 * Every {provider, model, taskType} triple with a critical miss on record — the hard-veto list
 * `selectProvider` reads. Accepts the store shape (`{records}`) or a bare array. Pure.
 * @param {Array<object>|{records?: Array<object>}} scorecards
 * @param {string} [taskType] - only rows of this taskType (omit for all)
 * @returns {Array<{provider: string, model: string, taskType: string, scoredAt: string|null}>}
 */
// @test-only-export-ok: the critical-work predicate (#4034), wired through dispatch-contracts.mjs#routeDispatch
export function criticalMissesFor(scorecards, taskType) {
  const records = Array.isArray(scorecards) ? scorecards : Array.isArray(scorecards?.records) ? scorecards.records : [];
  return records
    .filter((r) => r && typeof r === 'object' && typeof r.provider === 'string' && typeof r.model === 'string')
    .filter((r) => r.role !== 'supervise' && (taskType === undefined || r.taskType === taskType))
    .filter((r) => isCriticalMiss(r))
    .map((r) => ({ provider: r.provider, model: r.model, taskType: r.taskType, scoredAt: typeof r.scoredAt === 'string' ? r.scoredAt : null }));
}
