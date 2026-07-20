/**
 * @file scripts/readiness/scope-policy-config.mjs
 * @description Per-program POLICY CONFIG for the scope-lease + conflict-policy engine (WE epic #2560, slice 2 —
 *   CONFIG RESOLUTION only). Slice 1 ({@link ./scope-lease.mjs}) modelled the two conflict knobs as POLICIES,
 *   never fixed rules, and left open WHICH policy a given program runs. This module resolves that: it takes a
 *   program's raw/partial config, validates each field against slice-1's frozen enums, fills the gaps from the
 *   ratified defaults, and rejects unknown values with a clear message. Pure — no fs, no child_process, no
 *   `Date`. A later slice reads a program's config off disk and hands the plain object here.
 *
 * THE §3i MODEL (from plateau-app `docs/backlog-console-design.md`), kept faithful:
 *   • "both knobs configurable per program" — overlap-at-launch ∈ {wait,ask,force};
 *     breach-mid-build ∈ {pause,park,resolve-at-drain}. This module is the per-program binding of those knobs.
 *   • §3i-A4 (RATIFIED 2026-07-20, WE #2574): the retry bound is a TOTAL attempt counter; the whole-clone lease
 *     is the real lock and predicted file-scope is advisory. So a program's `retryBound` is a plain int ≥ 0 that
 *     {@link ./scope-lease.mjs breachOutcome} consumes as its `retryBound` opt.
 *
 * DEFAULTS (§3i / §3i-A4): overlap = 'wait', breach = 'pause', retryBound = RETRY_BOUND (1). See
 *   {@link DEFAULT_SCOPE_POLICY}. `wait`/`pause` are the conservative knobs — block on conflict rather than
 *   force past or park — matching §3i's stated defaults and A4's "retry-in-place then hold" ladder.
 *
 * HOW THIS COMPOSES (compose, don't reinvent):
 *   • The policy enums are IMPORTED from slice 1 ({@link OVERLAP_POLICIES}, {@link BREACH_POLICIES},
 *     {@link RETRY_BOUND}) — NEVER re-listed here, so the two slices can never drift on the legal token sets.
 *   • The resolved policy object is exactly the shape `overlapAtLaunch`/`breachOutcome` already read:
 *     `resolveScopePolicy(cfg).overlapAtLaunch` is a valid `overlapAtLaunch(..., policy)` arg, and
 *     `.breachMidBuild` / `.retryBound` feed `breachOutcome(breach, policy, { retryBound })`.
 *   • CONFIG CONVENTION: mirrors `scripts/lib/build-queue.mjs` — a `validateScopePolicy(config)` that returns
 *     `{ ok, errors }` (the same shape as that file's `validateConfig`, the repo's per-program config validator),
 *     plus a `DEFAULT_SCOPE_POLICY` frozen default (its `DEFAULT_CONFIG`). The `resolveScopePolicy` REJECT path
 *     THROWS a clear message — mirroring slice 1's own `overlapAtLaunch`/`breachOutcome`, which throw on an
 *     unknown policy token. So validation is non-throwing (build-queue style) and resolution throws (scope-lease
 *     style); callers that want a soft check use `validateScopePolicy`, callers that want a usable policy or a
 *     hard failure use `resolveScopePolicy`.
 */

import { OVERLAP_POLICIES, BREACH_POLICIES, RETRY_BOUND } from './scope-lease.mjs';

// ── the ratified per-program default (§3i / §3i-A4) ──────────────────────────────────────────────────────────

/**
 * The default {@link ScopePolicy} a program runs when it sets no config. §3i's stated knob defaults
 * (overlap = wait, breach = pause) + §3i-A4's retry bound ({@link RETRY_BOUND}). Frozen so no caller can mutate
 * the shared default in place — same posture as `build-queue.mjs` `DEFAULT_CONFIG`.
 *
 * @typedef {{overlapAtLaunch:string, breachMidBuild:string, retryBound:number}} ScopePolicy
 *   `overlapAtLaunch` ∈ {@link OVERLAP_POLICIES} · `breachMidBuild` ∈ {@link BREACH_POLICIES} · `retryBound` int ≥ 0.
 */
export const DEFAULT_SCOPE_POLICY = Object.freeze({
  overlapAtLaunch: 'wait',
  breachMidBuild: 'pause',
  retryBound: RETRY_BOUND,
});

// A defensive self-check: the literal defaults above MUST be members of the imported enums. If a later edit to
// slice 1 ever renamed a token, this throws at import time rather than silently shipping an illegal default.
if (!OVERLAP_POLICIES.includes(DEFAULT_SCOPE_POLICY.overlapAtLaunch)
  || !BREACH_POLICIES.includes(DEFAULT_SCOPE_POLICY.breachMidBuild)) {
  throw new Error('scope-policy-config: DEFAULT_SCOPE_POLICY drifted from the slice-1 policy enums');
}

// ── validation (build-queue.mjs `validateConfig` convention: return { ok, errors }, never throw) ──────────────

/** True for a non-negative integer (the `retryBound` domain — a total attempt count, §3i-A4). */
function isRetryBound(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/**
 * Validate a program's raw/partial scope-policy config WITHOUT throwing (mirrors `build-queue.mjs`
 * `validateConfig`). MISSING fields are allowed — they fill from {@link DEFAULT_SCOPE_POLICY} at resolve time,
 * so absence is never an error. Only PRESENT-but-illegal values are rejected: an unknown policy token, a
 * non-integer / negative `retryBound`, or an unknown extra key (typo guard).
 *
 * @param {unknown} config  a program's config object (may be partial, `{}`, `null`, or `undefined`).
 * @returns {{ok:boolean, errors:string[]}}  `ok` ⇒ every present field is legal; `errors` lists each problem.
 */
export function validateScopePolicy(config) {
  const errors = [];
  if (config == null) return { ok: true, errors }; // absent config ⇒ all-defaults, always valid
  if (typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, errors: ['config must be an object'] };
  }
  if ('overlapAtLaunch' in config && !OVERLAP_POLICIES.includes(config.overlapAtLaunch)) {
    errors.push(`unknown overlapAtLaunch "${config.overlapAtLaunch}" (expected ${OVERLAP_POLICIES.join('|')})`);
  }
  if ('breachMidBuild' in config && !BREACH_POLICIES.includes(config.breachMidBuild)) {
    errors.push(`unknown breachMidBuild "${config.breachMidBuild}" (expected ${BREACH_POLICIES.join('|')})`);
  }
  if ('retryBound' in config && !isRetryBound(config.retryBound)) {
    errors.push(`retryBound must be an integer ≥ 0 (got ${JSON.stringify(config.retryBound)})`);
  }
  for (const key of Object.keys(config)) {
    if (key !== 'overlapAtLaunch' && key !== 'breachMidBuild' && key !== 'retryBound') {
      errors.push(`unknown config key "${key}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── resolution (scope-lease.mjs convention: THROW a clear message on an illegal value) ───────────────────────

/**
 * Resolve a program's raw/partial config into a complete, validated {@link ScopePolicy}. Missing fields fill
 * from {@link DEFAULT_SCOPE_POLICY}; every present field is validated against the imported enums / int domain.
 * REJECTS an illegal config by THROWING with a clear message (mirrors slice 1's `overlapAtLaunch`/
 * `breachOutcome`, which throw on an unknown policy). Deterministic and pure.
 *
 * @param {ScopePolicy|Partial<ScopePolicy>|null|undefined} programConfig  the program's config (partial ok).
 * @returns {ScopePolicy}  a fresh, fully-populated, valid policy object (a plain object — caller-mutable).
 * @throws {Error} if any present field is an unknown policy token, a bad `retryBound`, or an unknown key.
 */
export function resolveScopePolicy(programConfig) {
  const { ok, errors } = validateScopePolicy(programConfig);
  if (!ok) {
    throw new Error(`resolveScopePolicy: invalid scope policy config — ${errors.join('; ')}`);
  }
  const cfg = programConfig ?? {};
  return {
    overlapAtLaunch: 'overlapAtLaunch' in cfg ? cfg.overlapAtLaunch : DEFAULT_SCOPE_POLICY.overlapAtLaunch,
    breachMidBuild: 'breachMidBuild' in cfg ? cfg.breachMidBuild : DEFAULT_SCOPE_POLICY.breachMidBuild,
    retryBound: 'retryBound' in cfg ? cfg.retryBound : DEFAULT_SCOPE_POLICY.retryBound,
  };
}

// ── human-readable summary ───────────────────────────────────────────────────────────────────────────────────

/**
 * One-line human summary of a policy (for board tooltips / logs). Resolves `policy` first, so a partial or
 * `null` input is described as the effective (default-filled) policy — and an illegal one throws, same as
 * {@link resolveScopePolicy}.
 *
 * @param {ScopePolicy|Partial<ScopePolicy>|null|undefined} policy
 * @returns {string} e.g. "overlap-at-launch: wait · breach-mid-build: pause · retry bound: 1"
 */
export function describeScopePolicy(policy) {
  const p = resolveScopePolicy(policy);
  return `overlap-at-launch: ${p.overlapAtLaunch} · breach-mid-build: ${p.breachMidBuild} · retry bound: ${p.retryBound}`;
}

// Re-export the imported enums so callers/tests can see the composition boundary explicitly (same posture as
// slice 1 re-exporting `disjoint`). These are the SAME frozen arrays slice 1 owns — not copies.
export { OVERLAP_POLICIES, BREACH_POLICIES, RETRY_BOUND };
