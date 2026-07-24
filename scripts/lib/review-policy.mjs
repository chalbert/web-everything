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

// The care bands the care→jury table must cover — kept as a LOCAL literal, deliberately NOT imported from
// review-escalation.mjs's CARE_LEVELS: review-escalation imports POLICY_THRESHOLDS from THIS module, so importing
// back would form a cycle. This module stays an import LEAF (node builtins only). The conformance suite
// (`review-policy.conformance.test.mjs`, which CAN import both) proves this list equals CARE_LEVELS, so the two
// can never silently drift. (#2633)
const CARE_BAND_KEYS = ['none', 'low', 'elevated', 'high'];

// The roster-timing-mode knob's closed vocabulary (#2633, knob #4). A small strict enum — the resolver (#2655)
// dispatches on it; a third mode is a deliberate contract + validator edit, not free-form data.
const VALID_ROSTER_TIMING_MODES = new Set(['bind-at-open', 'bind-at-prepare']);

// The band knobs a per-item override may set (the override allow-list, #2633). An item file carries only
// OVERRIDES — never a full config — the same pattern `scope:` uses; the contract is the human-gated DEFAULT.
export const CARE_JURY_OVERRIDE_KEYS = Object.freeze(['lenses', 'methods', 'jurorsPerLens', 'roundCap']);

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
  for (const key of ['diffLines']) {
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

  // careJury — the care→jury table (#2633): a rosterTimingMode knob + one jury-config band per CARE_LEVEL.
  const cj = c.careJury;
  if (!cj || typeof cj !== 'object') fail('missing careJury');
  if (typeof cj.description !== 'string' || !cj.description.trim()) fail('careJury has no description prose');

  // rosterTimingMode (knob #4) — { value: one of VALID_ROSTER_TIMING_MODES, description }
  const rtm = cj.rosterTimingMode;
  if (!rtm || typeof rtm !== 'object') fail('careJury missing rosterTimingMode');
  if (!VALID_ROSTER_TIMING_MODES.has(rtm.value)) fail(`careJury.rosterTimingMode.value must be one of ${[...VALID_ROSTER_TIMING_MODES].join(', ')}`);
  if (typeof rtm.description !== 'string' || !rtm.description.trim()) fail('careJury.rosterTimingMode has no description prose');

  // bands — EXACTLY the care bands (none|low|elevated|high), each a { lenses, methods, jurorsPerLens, roundCap,
  // description } object. Lens + method TOKENS are validated for SHAPE only (non-empty strings), never enum-frozen:
  // #2634 must be free to add a11y / visual / perf lenses + their methods to this table without editing the
  // validator. The strict part is the STRUCTURE — every fanned-out lens carries ≥1 grounding method, and methods
  // never name a lens that does not fan out in the band.
  const bands = cj.bands;
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) fail('careJury missing bands object');
  const bandKeys = Object.keys(bands);
  const missingBands = CARE_BAND_KEYS.filter((k) => !bandKeys.includes(k));
  if (missingBands.length) fail(`careJury.bands missing care band(s): ${missingBands.join(', ')}`);
  const extraBands = bandKeys.filter((k) => !CARE_BAND_KEYS.includes(k));
  if (extraBands.length) fail(`careJury.bands has unknown care band(s): ${extraBands.join(', ')}`);
  for (const key of CARE_BAND_KEYS) {
    const b = bands[key];
    if (!b || typeof b !== 'object' || Array.isArray(b)) fail(`careJury band "${key}" is not an object`);
    if (!Array.isArray(b.lenses)) fail(`careJury band "${key}".lenses must be an array`);
    for (const lens of b.lenses) {
      if (typeof lens !== 'string' || !lens.trim()) fail(`careJury band "${key}" has a non-string lens`);
    }
    const lensSet = new Set(b.lenses);
    if (lensSet.size !== b.lenses.length) fail(`careJury band "${key}".lenses has a duplicate lens`);
    if (!b.methods || typeof b.methods !== 'object' || Array.isArray(b.methods)) fail(`careJury band "${key}".methods must be an object`);
    for (const [lens, methods] of Object.entries(b.methods)) {
      if (!lensSet.has(lens)) fail(`careJury band "${key}".methods names lens "${lens}" that does not fan out in this band`);
      if (!Array.isArray(methods) || methods.length === 0) fail(`careJury band "${key}".methods["${lens}"] must be a non-empty array`);
      for (const m of methods) {
        if (typeof m !== 'string' || !m.trim()) fail(`careJury band "${key}".methods["${lens}"] has a non-string method`);
      }
    }
    for (const lens of b.lenses) {
      if (!Array.isArray(b.methods[lens]) || b.methods[lens].length === 0) fail(`careJury band "${key}" lens "${lens}" fans out but pulls in no validation method`);
    }
    for (const numKey of ['jurorsPerLens', 'roundCap']) {
      if (!Number.isInteger(b[numKey]) || b[numKey] < 0) fail(`careJury band "${key}".${numKey} must be a non-negative integer`);
    }
    if (typeof b.description !== 'string' || !b.description.trim()) fail(`careJury band "${key}" has no description prose`);
  }
  return c;
}

/** The parsed, validated, deep-frozen contract. */
export const REVIEW_POLICY = deepFreeze(validateContract(JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'))));

/** The rubric threshold VALUES (bare numbers) — the single source `review-escalation.mjs` imports. Frozen. */
export const POLICY_THRESHOLDS = Object.freeze({
  diffLines: REVIEW_POLICY.thresholds.diffLines.value,
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

/** The care→jury table (#2633), deep-frozen with the rest of the contract. The single, human-gated HOME for the
 *  per-care-band jury config the resolver (#2655) and the lens↔method split (#2634) read. */
export const POLICY_CARE_JURY = REVIEW_POLICY.careJury;

/** The roster-timing-mode knob (#4) — the bare value (`bind-at-open` | `bind-at-prepare`). Frozen source. */
export const POLICY_ROSTER_TIMING_MODE = REVIEW_POLICY.careJury.rosterTimingMode.value;

/**
 * The EXECUTABLE FORM of the care→jury table's RIGOR bands (#2633) — compute the panel rigor for one care band
 * PURELY from the contract data (the lenses that fan out, jurors per lens, and the round budget `roundCap` →
 * `rounds`). This is the ORACLE the conformance suite holds jury-core.mjs's `panelRigorForCareLevel` to — exactly
 * as `derivePolicyDisposition` is the oracle for `deriveReviewDisposition`. Today the bands live as literals in
 * `panelRigorForCareLevel`; this function reads them off the contract and the conformance suite proves the two
 * agree, so a downstream slice (#2655) can rewire `panelRigorForCareLevel` to import from HERE without any
 * behaviour change. Returns the bare band values only (`careLevel`, `rounds`, `lenses`, `jurorsPerLens`); the
 * AGGREGATION mode and per-lens weights are FORWARD-FIT (#2651) and deliberately not surfaced yet. Throws on an
 * unknown care band.
 * @param {'none'|'low'|'elevated'|'high'} careLevel
 * @returns {{careLevel: string, rounds: number, lenses: string[], jurorsPerLens: number}}
 */
export function deriveCareJuryRigor(careLevel) {
  const band = REVIEW_POLICY.careJury.bands[careLevel];
  if (!band) {
    throw new Error(`deriveCareJuryRigor: unknown care band "${careLevel}" — must be one of ${Object.keys(REVIEW_POLICY.careJury.bands).join(', ')}`);
  }
  return { careLevel, rounds: band.roundCap, lenses: [...band.lenses], jurorsPerLens: band.jurorsPerLens };
}

/**
 * Resolve the effective jury config for a care band with an optional per-item OVERRIDE merged on top (#2633) —
 * the "care→jury table WITH per-item override" half of this slice. Pure. The contract band is the human-gated
 * DEFAULT; an item file may carry only OVERRIDES (never a full config), the same pattern `scope:` uses, and only
 * for the allow-listed knobs (`CARE_JURY_OVERRIDE_KEYS`). An override naming any other key is rejected LOUDLY — a
 * typo'd or out-of-band override must never silently pass through the human-gated leash. The merge is a shallow
 * per-knob REPLACE (an override supplies a whole new value for that knob; it does not deep-merge lens lists),
 * mirroring how a per-item `scope:` replaces rather than accretes. Returns a fresh frozen object; never mutates
 * the contract. Deep VALUE validation of an override (that a supplied roundCap is a non-negative integer, etc.) is
 * the item-frontmatter parser's job (#2655) — this helper owns the allow-list gate + the merge shape.
 * @param {'none'|'low'|'elevated'|'high'} careLevel
 * @param {{lenses?: string[], methods?: object, jurorsPerLens?: number, roundCap?: number}} [override]
 * @returns {{lenses: string[], methods: object, jurorsPerLens: number, roundCap: number}}
 */
export function resolveCareJuryConfig(careLevel, override = {}) {
  const band = REVIEW_POLICY.careJury.bands[careLevel];
  if (!band) {
    throw new Error(`resolveCareJuryConfig: unknown care band "${careLevel}" — must be one of ${Object.keys(REVIEW_POLICY.careJury.bands).join(', ')}`);
  }
  const ov = override ?? {};
  if (typeof ov !== 'object' || Array.isArray(ov)) throw new Error('resolveCareJuryConfig: override must be an object');
  const unknown = Object.keys(ov).filter((k) => !CARE_JURY_OVERRIDE_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`resolveCareJuryConfig: override has non-overridable key(s): ${unknown.join(', ')} — allowed: ${CARE_JURY_OVERRIDE_KEYS.join(', ')}`);
  }
  const merged = {
    lenses: [...band.lenses],
    methods: { ...band.methods },
    jurorsPerLens: band.jurorsPerLens,
    roundCap: band.roundCap,
  };
  for (const key of CARE_JURY_OVERRIDE_KEYS) {
    if (key in ov) merged[key] = ov[key];
  }
  return Object.freeze(merged);
}

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
