/**
 * @file scripts/readiness/scope-lease.mjs
 * @description Scope-lease + conflict-policy engine (WE epic #2560, slice 1 — DATA MODEL + POLICY only).
 *   The PURE model behind the scope-lease board (plateau-app `docs/backlog-console-design.md` §3i) and the
 *   ratified scope-breach recovery table (§3i-A4, WE decision #2574). No fs, no child_process, no `Date` — a
 *   later slice wires these into the live `lane-pool.mjs` acquire/release path; this slice is just the logic
 *   plus its unit proof.
 *
 * THE §3i MODEL (kept faithful):
 *   • PREDICTED scope = module/glob-level, authored by the prepare agent at plan time (advisory — see below).
 *   • OBSERVED scope  = file-level, the lane's live `git diff --name-only` set (the CLI supplies it).
 *   • BREACH          = observed files that fall OUTSIDE the predicted scope (a generalized set difference:
 *     "outside" is decided by pattern coverage, since predicted entries are module/globs, not exact paths).
 *   • Two conflict knobs are POLICIES, never fixed rules:
 *       overlap-at-launch  ∈ { wait (default), ask, force }         → {@link overlapAtLaunch}
 *       breach-mid-build   ∈ { pause, park, resolve-at-drain }      → {@link breachOutcome}
 *
 * §3i-A4 (RATIFIED 2026-07-20) — what this module encodes verbatim:
 *   • Fork 1: the ENFORCEMENT UNIT is the whole-clone lease (`lane-pool.mjs` acquire/release + the `.lane-lease`
 *     marker in `../lib/lane-lease.mjs`). Predicted file-scope is an ADVISORY breach signal, NOT a second lock;
 *     git is the ground-truth conflict detector at drain. So everything here is advisory scheduling data — it
 *     never gates a write on its own. Per-file leases were rejected.
 *   • Fork 2: A4's default transition is RETRY-IN-PLACE / re-plan within scope (drop the out-of-scope edit,
 *     finish the in-lease work). Its escalation ladder = widen-lease → hand-off-to-cross-lane → bounce/quarantine
 *     ({@link BREACH_ESCALATION_LADDER}). Retry bound (jury amendment): the escalation trigger is a TOTAL attempt
 *     counter, NOT "breaches the same scope twice" — a re-plan that breaches a DIFFERENT out-of-scope file each
 *     attempt must still escalate, or it livelocks. Retry-once-then-escalate, never retry-forever.
 *   • Fork 3: a hold carries an explicit `holdSource ∈ { user, policy, sibling-lane }`; unhold authority follows
 *     the source. `pause` (breach files belong to another live lease) is a `sibling-lane` hold; `park` (policy
 *     decided to surface it) is a `policy` hold that renders as an amber you-card.
 *
 * HOW THIS COMPOSES (fidelity to the existing system beats a fresh model):
 *   • Repo-qualified paths ("<repo>:<path>") are the SAME convention as `lane-partition.mjs` `filesOf` and
 *     `overlap-chain.mjs` — the same path in two repos never collides, a genuine same-repo overlap always does.
 *   • The exact-set primitive `disjoint` is REUSED from `lane-partition.mjs` (not re-implemented) for the
 *     file-level fast paths.
 *   • `lane-partition.disjoint` / `overlap-chain.intersects` operate on EXACT paths. Predicted scope is
 *     module/glob-level, so exact-set intersection UNDER-matches (a `src/foo/**` lease vs a `src/foo/bar.ts`
 *     candidate would read as disjoint). This module therefore MIRRORS the `intersects` contract with a
 *     coverage-aware matcher ({@link coversFile} / {@link scopeEntriesOverlap}) rather than reusing it — there
 *     is no glob/match helper anywhere in `scripts/` to reuse (searched: no minimatch/micromatch/picomatch).
 */

import { disjoint } from './lane-partition.mjs';

// ── path / scope-pattern primitives ────────────────────────────────────────────────────────────────────────

/** Normalize a file/scope list → deduped array of non-empty repo-qualified strings. Mirrors
 *  `overlap-chain.mjs` `normFiles` (not exported there) — same contract, kept in sync by the test. */
export function normScope(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean).map((f) => String(f)).filter(Boolean))];
}

/** Split a repo-qualified path into `[repo, path]` (repo `null` when unqualified). Mirrors the first-colon
 *  split in `lane-partition.isMergeRiskFile`, so the two agree on what "<repo>:<path>" means. */
function splitRepo(s) {
  const str = String(s);
  const i = str.indexOf(':');
  return i < 0 ? [null, str] : [str.slice(0, i), str.slice(i + 1)];
}

/** Turn a repo-relative predicted pattern into a coverage test over a repo-relative observed path.
 *  Two shapes, per §3i "predicted scope is module/glob-level":
 *    • GLOB (contains `*`/`?`): `**` = any chars incl `/`; `*` = any chars except `/`; `?` = one non-`/`.
 *    • MODULE PREFIX (no wildcard): matches the exact path OR anything UNDER it (`src/backlog-view` covers
 *      `src/backlog-view/foo.ts`). This is the module-level reading of a bare directory-ish entry — the one
 *      design call §3i leaves implicit (it says "module-level" but never fixes the string form). */
function patternTest(patternPath) {
  const p = patternPath.replace(/\/$/, ''); // a trailing slash is just a directory marker
  if (/[*?]/.test(p)) {
    const rx = '^' + p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex metachars (NOT * ? — handled next)
      // convert the glob wildcards in ONE pass — alternation matches `**` before `*`, so no placeholder
      // sentinel is needed: `**` → `.*` (crosses path segments) · `*` → `[^/]*` (within a segment) ·
      // `?` → `[^/]` (one non-slash char).
      .replace(/\*\*|\*|\?/g, (m) => (m === '**' ? '.*' : m === '*' ? '[^/]*' : '[^/]')) + '$';
    const re = new RegExp(rx);
    return (f) => re.test(f);
  }
  return (f) => f === p || f.startsWith(p + '/');
}

/** Does a predicted scope entry cover an observed file? Both repo-qualified; the repo must match first (a
 *  `we:` lease never covers a `frontierui:` file — the constellation-disjointness `filesOf` relies on). */
export function coversFile(pattern, file) {
  const [pr, pp] = splitRepo(pattern);
  const [fr, fp] = splitRepo(file);
  if (pr !== fr) return false;
  return patternTest(pp)(fp);
}

/** The literal (wildcard-free) leading path of a pattern — its "module root". Used to decide pattern↔pattern
 *  overlap at LAUNCH, when only predicted (glob) scope exists on both sides and neither is an exact file. */
function litRoot(pattern) {
  const [r, p] = splitRepo(pattern);
  const lit = p.match(/^[^*?]*/)[0].replace(/\/$/, '');
  return [r, lit];
}

/** Do two predicted scope entries overlap? Same repo AND one module-root is a path-segment prefix of the
 *  other (or equal). MIRRORS `overlap-chain.intersects` (list-membership overlap) generalized to module
 *  patterns — see the file header for why exact-set `intersects`/`disjoint` under-matches here. */
export function scopeEntriesOverlap(x, y) {
  const [rx, px] = litRoot(x);
  const [ry, py] = litRoot(y);
  if (rx !== ry) return false;
  return px === py || px.startsWith(py + '/') || py.startsWith(px + '/') || px === '' || py === '';
}

/** Do two predicted scopes (arrays of module/glob entries) overlap at all? */
export function scopesOverlap(scopeA, scopeB) {
  const a = normScope(scopeA);
  const b = normScope(scopeB);
  return a.some((x) => b.some((y) => scopeEntriesOverlap(x, y)));
}

// ── (1) the scope-lease model: predicted (plan) vs observed (lane diff) → breach ────────────────────────────

/**
 * The scope-lease of one lane's work stream.
 * @param {string[]} predictedFiles  module/glob-level, repo-qualified — the prepare-agent's planned scope.
 * @param {string[]} observedFiles   file-level, repo-qualified — the lane's live changed set (git diff).
 * @returns {{predicted:string[], observed:string[], inScope:string[], breach:string[], clean:boolean}}
 *   `breach` = observed files covered by NO predicted entry (the §3i "breach = their difference", generalized
 *   from raw set-difference to pattern coverage because predicted is module-level). `clean` ⇒ no breach.
 *   ADVISORY only (§3i-A4 Fork 1) — the whole-clone lease is the real lock; this is a scheduling signal.
 */
export function scopeLease(predictedFiles, observedFiles) {
  const predicted = normScope(predictedFiles);
  const observed = normScope(observedFiles);
  const inScope = observed.filter((f) => predicted.some((p) => coversFile(p, f)));
  const breach = observed.filter((f) => !predicted.some((p) => coversFile(p, f)));
  return { predicted, observed, inScope, breach, clean: breach.length === 0 };
}

/** Convenience: just the breach set of predicted-vs-observed (the input `breachOutcome` consumes). */
export function breachOf(predictedFiles, observedFiles) {
  return scopeLease(predictedFiles, observedFiles).breach;
}

// ── (2) overlap-at-launch policy ────────────────────────────────────────────────────────────────────────────

/** Valid overlap-at-launch policy tokens (§3i). */
export const OVERLAP_POLICIES = Object.freeze(['wait', 'ask', 'force']);

/**
 * Decide whether work may launch given the scopes it would touch vs the active leases (§3i launch rule: "work
 * starts only where its scope doesn't intersect an active lease"). Composes with the overlap machinery by
 * MIRRORING `overlap-chain.intersects` at module-pattern granularity ({@link scopesOverlap}).
 *
 * @param {string[]} candidateScope  predicted scope (module/glob) of the work about to launch.
 * @param {Array<{id?:string, laneId?:string, scope:string[]}>} activeLeases  currently-held leases + scope.
 * @param {'wait'|'ask'|'force'} policy  the overlap-at-launch knob (default 'wait').
 * @returns {{outcome:string, policy:string, overlaps:Array<{leaseId:(string|null), scope:string[]}>,
 *   waitOn:string[], resolveAtDrain:boolean}}
 *   No overlap ⇒ `outcome:'launch'` regardless of policy. Otherwise per policy:
 *     wait  → 'wait'  (block until every overlapping lease frees; `waitOn` = their ids)
 *     ask   → 'ask'   (park for the human — present the overlap; no auto-launch)
 *     force → 'force' (launch now; `resolveAtDrain:true` schedules the agent conflict-resolution step at drain,
 *                      which parks for the human if resolution fails — the §3i "force + resolve" route).
 */
export function overlapAtLaunch(candidateScope, activeLeases, policy = 'wait') {
  if (!OVERLAP_POLICIES.includes(policy)) {
    throw new Error(`overlapAtLaunch: unknown policy "${policy}" (expected ${OVERLAP_POLICIES.join('|')})`);
  }
  const cand = normScope(candidateScope);
  const overlaps = (Array.isArray(activeLeases) ? activeLeases : [])
    .filter((l) => l && scopesOverlap(cand, l.scope))
    .map((l) => ({ leaseId: l.id ?? l.laneId ?? null, scope: normScope(l.scope) }));

  if (overlaps.length === 0) {
    return { outcome: 'launch', policy, overlaps: [], waitOn: [], resolveAtDrain: false };
  }
  const waitOn = overlaps.map((o) => o.leaseId);
  switch (policy) {
    case 'wait':
      return { outcome: 'wait', policy, overlaps, waitOn, resolveAtDrain: false };
    case 'ask':
      return { outcome: 'ask', policy, overlaps, waitOn, resolveAtDrain: false };
    case 'force':
      return { outcome: 'force', policy, overlaps, waitOn, resolveAtDrain: true };
    default: /* unreachable — guarded above */
      throw new Error(`overlapAtLaunch: unhandled policy "${policy}"`);
  }
}

// ── (3) breach-mid-build policy + the §3i-A4 escalation ladder ───────────────────────────────────────────────

/** Valid breach-mid-build policy tokens (§3i). */
export const BREACH_POLICIES = Object.freeze(['pause', 'park', 'resolve-at-drain']);

/**
 * §3i-A4 Fork 2 — retry-once-then-escalate. The TOTAL-attempt bound (jury amendment): escalate once the running
 * count of breach attempts EXCEEDS this, regardless of whether each attempt breached the same or a different
 * out-of-scope file. 1 ⇒ retry in place once, then escalate.
 */
export const RETRY_BOUND = 1;

/**
 * §3i-A4 Fork 2's escalation ladder, as DATA. `order:0` (retry-in-place) is A4's DEFAULT transition; rungs 1–3
 * are the escalation routes offered once the retry bound is exhausted. `condition` names the breach shape that
 * selects a rung when a program later auto-classifies (a `park` you-card offers rungs 1–3 as the route menu).
 */
export const BREACH_ESCALATION_LADDER = Object.freeze([
  Object.freeze({ rung: 'retry-in-place', order: 0, condition: 'default',
    desc: 'drop the out-of-scope edit, re-plan within the lease (A4 default transition)' }),
  Object.freeze({ rung: 'widen-lease', order: 1, condition: 'free-scope',
    desc: 'lock-escalation into currently-free scope ONLY' }),
  Object.freeze({ rung: 'handoff-cross-lane', order: 2, condition: 'foreign-lease',
    desc: 'hand off to the cross-lane family (B2/B3/B8) — the wanted files belong to another live lease' }),
  Object.freeze({ rung: 'bounce-quarantine', order: 3, condition: 'uncontainable',
    desc: 'the slice was never containable in one lease — bounce/quarantine, re-file as a new item' }),
]);

/** The escalation routes (rungs 1–3) a `park` you-card surfaces — everything past the retry-in-place default. */
export const ESCALATION_ROUTES = Object.freeze(BREACH_ESCALATION_LADDER.filter((r) => r.order >= 1));

/** Coerce a breach input (a raw file array, or a `scopeLease(...)` result) → the breach file array. */
function breachFiles(breach) {
  if (Array.isArray(breach)) return normScope(breach);
  if (breach && Array.isArray(breach.breach)) return normScope(breach.breach);
  return [];
}

/**
 * Decide the response to a mid-build scope breach (§3i-A4). Advisory scheduling data (Fork 1) — never a lock.
 *
 * @param {string[]|{breach:string[]}} breach  the breach set (from {@link scopeLease}) or a raw file array.
 * @param {'pause'|'park'|'resolve-at-drain'} policy  the breach-mid-build knob.
 * @param {{attempt?:number, retryBound?:number}} [opts]  `attempt` = the TOTAL breach-attempt count so far
 *   (1-based, Fork 2's total counter — NOT same-scope-twice); `retryBound` defaults to {@link RETRY_BOUND}.
 * @returns {{breached:boolean, action:string, rung:(string|null), escalated:boolean, policy:string,
 *   attempt:number, retryBound:number, holdSource:(string|null), resolveAtDrain:boolean, routes:object[]}}
 *   No breach                      → `action:'continue'`.
 *   Within the retry budget        → `action:'retry-in-place'` (A4 default; `escalated:false`), for ANY policy.
 *   Budget exhausted, per policy   → 'pause' (holdSource 'sibling-lane' — wait for the owning lease to free),
 *                                    'park'  (holdSource 'policy' — amber you-card; `routes` = the ladder menu),
 *                                    'resolve-at-drain' (continue building; `resolveAtDrain:true`).
 */
export function breachOutcome(breach, policy, { attempt = 1, retryBound = RETRY_BOUND } = {}) {
  if (!BREACH_POLICIES.includes(policy)) {
    throw new Error(`breachOutcome: unknown policy "${policy}" (expected ${BREACH_POLICIES.join('|')})`);
  }
  const files = breachFiles(breach);
  const base = { policy, attempt, retryBound, resolveAtDrain: false, routes: [] };

  if (files.length === 0) {
    return { ...base, breached: false, action: 'continue', rung: null, escalated: false, holdSource: null };
  }
  // A4 default transition: retry in place / re-plan within scope — until the TOTAL attempt count exceeds the
  // bound (Fork 2's livelock guard: a different out-of-scope file each attempt still counts toward the bound).
  if (attempt <= retryBound) {
    return { ...base, breached: true, action: 'retry-in-place', rung: 'retry-in-place', escalated: false, holdSource: null };
  }
  // Bound exhausted → escalate per the breach knob.
  switch (policy) {
    case 'resolve-at-drain':
      return { ...base, breached: true, action: 'resolve-at-drain', rung: null, escalated: true,
        holdSource: null, resolveAtDrain: true };
    case 'pause':
      // The breached files belong to another live lease — hold until it frees (Fork 3: sibling-lane source).
      return { ...base, breached: true, action: 'pause', rung: 'handoff-cross-lane', escalated: true,
        holdSource: 'sibling-lane' };
    case 'park':
      // Promote to an amber you-card offering the route menu (Fork 2's `ask`/`park` promotion). holdSource
      // 'policy' — the policy decided to surface it; unhold authority is the human (Fork 3).
      return { ...base, breached: true, action: 'park', rung: null, escalated: true,
        holdSource: 'policy', routes: ESCALATION_ROUTES };
    default: /* unreachable — guarded above */
      throw new Error(`breachOutcome: unhandled policy "${policy}"`);
  }
}

// Re-export the reused exact-set primitive so callers/tests can see the composition boundary explicitly.
export { disjoint };
