/**
 * review-policy.mjs — the LOADER + executable form of the review-escalation policy CONTRACT (#2566).
 *
 * WHAT THIS IS. `review-policy.contract.json` is the machine-diffable SPEC for the drain's review-escalation
 * policy: the rubric thresholds, the escalation-reason vocabulary (each reason's family + clearance), and the
 * strictest-wins disposition decision table — extracted out of the derivation code so they live as DATA in one
 * place. This module reads that contract, VALIDATES its shape (static conformance — a malformed contract throws
 * loudly at import, never silently mis-gates), FREEZES it, and exposes two things:
 *
 *   1. the policy VALUES as derived constants (`POLICY_THRESHOLDS`, `POLICY_REASON_TOKENS`,
 *      `POLICY_REASONS_BY_FAMILY`, `POLICY_HUMAN_SENSITIVITY_REASONS`) — the SINGLE SOURCE OF TRUTH the impl
 *      imports (`review-escalation.mjs` DEFAULT_THRESHOLDS; `review-core.mjs`'s reason sets) so a value exists
 *      exactly once. Flipping one is necessarily a diff to the contract → a human-gated spec change.
 *
 *   2. `derivePolicyDisposition()` — the EXECUTABLE FORM of the contract's disposition table: it computes the
 *      { mode, autoLand } outcome PURELY from the contract data (walk the precedence rules, first-match-wins).
 *      This is the ORACLE the conformance suite compares the hand-written imperative branches of
 *      `deriveReviewDisposition` (review-core.mjs) against. The two are deliberately SEPARATE realizations of the
 *      same table — the table is the human-owned truth, the branches are the impl — and the conformance suite
 *      proving them equal over the full input space is the whole point of spec-based programming (#2564): a
 *      behaviour-preserving refactor of the branches keeps conformance green and is agent-clearable; a change to
 *      what they DO diverges from the oracle → conformance red → the author must also edit the contract → human.
 *      Do NOT collapse `deriveReviewDisposition` into a call to this function — that would make the conformance
 *      check vacuous and there would be no impl left to refactor.
 *
 * Pure after load (the fs read happens once at module init, the #84-style JSON-load pattern used across
 * we:scripts). Registered on the trust-chain policy tier (gate-config.mjs) — editing this file or the contract
 * is a spec change that forces review:human.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolve the contract next to this module. Mirrors the working `dirname(fileURLToPath(import.meta.url))` pattern
// in scripts/lib/token-css.mjs / component-tokens.mjs (both read repo files under the vitest happy-dom runner).
const CONTRACT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'review-policy.contract.json');

const VALID_FAMILIES = new Set(['sensitivity', 'deadlock']);
const VALID_CLEARANCES = new Set(['human', 'agent']);
const VALID_MODES = new Set(['converge', 'human']);
const VALID_MATCH_KEYS = new Set(['family', 'clearance']);

/**
 * Validate the parsed contract's SHAPE (the meta-schema / static-conformance check, done in plain JS to stay
 * dependency-free). Throws on any structural defect so a broken contract can never load and silently mis-gate.
 * @param {*} c
 * @returns {object} the same object (for chaining), once proven well-formed.
 */
function validateContract(c) {
  const fail = (msg) => { throw new Error(`review-policy contract invalid: ${msg}`); };
  if (!c || typeof c !== 'object') fail('not an object');

  // thresholds — each a { value: number, description: string }
  const t = c.thresholds;
  if (!t || typeof t !== 'object') fail('missing thresholds');
  for (const key of ['diffLines', 'sampleNth']) {
    const entry = t[key];
    if (!entry || typeof entry !== 'object') fail(`missing threshold "${key}"`);
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) fail(`threshold "${key}".value must be a finite number`);
  }

  // reasons — a non-empty array of unique { token, family, clearance, description }
  if (!Array.isArray(c.reasons) || c.reasons.length === 0) fail('reasons must be a non-empty array');
  const seen = new Set();
  for (const r of c.reasons) {
    if (!r || typeof r !== 'object') fail('a reason entry is not an object');
    if (typeof r.token !== 'string' || !r.token.trim()) fail('a reason entry has no token');
    if (seen.has(r.token)) fail(`duplicate reason token "${r.token}"`);
    seen.add(r.token);
    if (!VALID_FAMILIES.has(r.family)) fail(`reason "${r.token}" has invalid family "${r.family}"`);
    if (!VALID_CLEARANCES.has(r.clearance)) fail(`reason "${r.token}" has invalid clearance "${r.clearance}"`);
    if (typeof r.description !== 'string' || !r.description.trim()) fail(`reason "${r.token}" has no description prose`);
  }

  // disposition.precedence — an ordered, non-empty list of { match, mode, autoLand }
  const prec = c.disposition && c.disposition.precedence;
  if (!Array.isArray(prec) || prec.length === 0) fail('disposition.precedence must be a non-empty array');
  for (const rule of prec) {
    if (!rule || typeof rule !== 'object') fail('a precedence rule is not an object');
    if (!VALID_MODES.has(rule.mode)) fail(`a precedence rule has invalid mode "${rule.mode}"`);
    if (typeof rule.autoLand !== 'boolean') fail('a precedence rule has non-boolean autoLand');
    if (!rule.match || typeof rule.match !== 'object') fail('a precedence rule has no match predicate');
    const keys = Object.keys(rule.match);
    if (keys.length !== 1 || !VALID_MATCH_KEYS.has(keys[0])) fail('a precedence rule match must have exactly one of { family, clearance }');
  }
  return c;
}

/** The parsed, validated, deep-frozen contract. */
export const REVIEW_POLICY = deepFreeze(validateContract(JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'))));

/** The rubric threshold VALUES (bare numbers) — the single source `review-escalation.mjs` imports. Frozen. */
export const POLICY_THRESHOLDS = Object.freeze({
  diffLines: REVIEW_POLICY.thresholds.diffLines.value,
  sampleNth: REVIEW_POLICY.thresholds.sampleNth.value,
});

/** token → { family, clearance }, for O(1) classification lookups. */
const REASON_META = new Map(REVIEW_POLICY.reasons.map((r) => [r.token, { family: r.family, clearance: r.clearance }]));

/** Every reason token, in contract order. Frozen — `review-core.mjs`'s ALL_REASON_TOKENS imports this. */
export const POLICY_REASON_TOKENS = Object.freeze(REVIEW_POLICY.reasons.map((r) => r.token));

/** Reason tokens grouped by family — `{ sensitivity: [...], deadlock: [...] }`. Frozen (shallow arrays frozen too). */
export const POLICY_REASONS_BY_FAMILY = Object.freeze({
  sensitivity: Object.freeze(REVIEW_POLICY.reasons.filter((r) => r.family === 'sensitivity').map((r) => r.token)),
  deadlock: Object.freeze(REVIEW_POLICY.reasons.filter((r) => r.family === 'deadlock').map((r) => r.token)),
});

/** The SENSITIVITY reasons that still require a human to clear (clearance:human ∧ family:sensitivity — gate-self,
 *  statute). Deadlock reasons are human too but are handled by the earlier precedence rule, so they are excluded
 *  here to mirror review-core.mjs's HUMAN_SENSITIVITY_REASONS exactly. Frozen. */
export const POLICY_HUMAN_SENSITIVITY_REASONS = Object.freeze(
  REVIEW_POLICY.reasons.filter((r) => r.family === 'sensitivity' && r.clearance === 'human').map((r) => r.token),
);

/** Does a reason's meta satisfy a precedence rule's single-key match predicate? Pure. */
function matchesRule(match, meta) {
  if (!meta) return false;
  const [key, want] = Object.entries(match)[0];
  return meta[key] === want;
}

/**
 * The EXECUTABLE FORM of the contract's disposition table (#2566) — compute { mode, autoLand } for the reason(s)
 * a PR escalated for, PURELY from the contract data: walk `disposition.precedence` in order and return the first
 * rule whose predicate matches ANY reason. This is the ORACLE the conformance suite holds `deriveReviewDisposition`
 * (review-core.mjs) to; it is intentionally a distinct realization of the same table (see the module header).
 * Accepts bare reason tokens only (the contract's vocabulary) — canonicalizing the drain's DECORATED reason
 * strings is the impl's job (`review-core.mjs` canonicalizeReason), not the contract's. Throws on empty/unknown
 * input, matching the impl's discipline.
 * @param {{reason?: string, reasons?: string[]}} o
 * @returns {{mode: 'converge'|'human', autoLand: boolean}}
 */
export function derivePolicyDisposition({ reason, reasons } = {}) {
  const raw = (Array.isArray(reasons) ? reasons : reason ? [reason] : []).filter(Boolean);
  if (!raw.length) throw new Error('derivePolicyDisposition: at least one reason is required');
  const metas = raw.map((tok) => ({ tok, meta: REASON_META.get(tok) }));
  const unknown = metas.filter((m) => !m.meta).map((m) => m.tok);
  if (unknown.length) throw new Error(`derivePolicyDisposition: unknown reason(s): ${unknown.join(', ')}`);
  for (const rule of REVIEW_POLICY.disposition.precedence) {
    if (metas.some((m) => matchesRule(rule.match, m.meta))) return { mode: rule.mode, autoLand: rule.autoLand };
  }
  // Unreachable if the contract's last rule is a family catch-all (the shape validator does not force this, so a
  // deliberately-incomplete precedence table surfaces here as a loud error rather than a silent wrong disposition).
  throw new Error(`derivePolicyDisposition: no precedence rule matched reason(s): ${raw.join(', ')}`);
}

/** Deep-freeze a plain JSON value (objects + arrays) so the loaded contract can never be mutated at runtime. */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
