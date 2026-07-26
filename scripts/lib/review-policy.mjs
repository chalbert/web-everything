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

// The care→jury table's fixed vocabulary (#2633). These MIRROR enums that live in other modules — the advisory
// care bands (`CARE_LEVELS`, review-escalation.mjs) and the panel lens set (`PANEL_LENSES`, jury-core.mjs) — but
// are duplicated as bare literals HERE on purpose: review-policy.mjs is a trust-chain LEAF that imports only
// fs/path (review-escalation → review-policy already; importing either back would cycle). The conformance suite
// pins these literals equal to the real enums, so drift is caught mechanically rather than risked by a coupling.
const CARE_BAND_NAMES = ['none', 'low', 'elevated', 'high'];
const VALID_CARE_LENSES = new Set(['correctness', 'security', 'simplicity', 'standards-conformance']);
const VALID_ROSTER_TIMING_MODES = new Set(['up-front', 'incremental']);

// The disposition-config vocabulary (#2651). resolutionMode's two settings and the three knobs a per-decision
// override is allowed to set. Declared here so the shape validator and the resolver name them once.
const VALID_RESOLUTION_MODES = new Set(['accept-best', 'present-unless-all-agree']);
const DISPOSITION_KNOB_KEYS = ['lensWeights', 'dissentThreshold', 'resolutionMode'];

// The auto-land seam's operating modes (#2675). `shadow` = observe-only (log the intended disposition, write no
// label, merge nothing — a human still clears); `enforce` = a clean auto-dispose writes review:accepted and the
// drain lands it. GLOBAL-only knob (not band/decision-overridable) — a system-wide stance, so it is validated
// here and read straight from the global default, never merged through the override precedence.
const VALID_LAND_MODES = new Set(['shadow', 'enforce']);

/**
 * Validate the disposition-config knob shape (#2651) — shared by the global default block and each optional
 * per-band override (a band override is PARTIAL: any knob it omits inherits the global default). `require` gates
 * whether every knob must be present (true for the global block, false for a partial band override).
 * @param {*} d the disposition object
 * @param {(msg: string) => never} fail
 * @param {string} where a label for error messages
 * @param {boolean} require whether all three knobs are mandatory
 */
function validateDispositionKnobs(d, fail, where, require) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail(`${where} must be an object`);
  if (require || d.lensWeights !== undefined) {
    const lw = d.lensWeights;
    if (!lw || typeof lw !== 'object' || Array.isArray(lw)) fail(`${where}.lensWeights must be an object`);
    // The global block requires the {default, values} wrapper; a partial override may omit either — but WHEN
    // present, `default` and `values` are validated the same way (so a mistyped override default is caught, not
    // silently dropped by the merge).
    if (require && lw.default === undefined) fail(`${where}.lensWeights.default is required`);
    if (lw.default !== undefined && (typeof lw.default !== 'number' || !Number.isFinite(lw.default) || lw.default < 0)) {
      fail(`${where}.lensWeights.default must be a non-negative finite number`);
    }
    if (require && lw.values === undefined) fail(`${where}.lensWeights.values is required`);
    if (lw.values !== undefined && (!lw.values || typeof lw.values !== 'object' || Array.isArray(lw.values))) {
      fail(`${where}.lensWeights.values must be an object`);
    }
    const values = lw.values ?? lw; // a band override may give a bare lens→weight map or the {default,values} shape
    for (const [lens, weight] of Object.entries(values)) {
      if (lens === 'default' || lens === 'values' || lens === 'description') continue;
      if (!VALID_CARE_LENSES.has(lens)) fail(`${where}.lensWeights names lens "${lens}" not in the panel lens set`);
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
        fail(`${where}.lensWeights["${lens}"] must be a non-negative finite number`);
      }
    }
  }
  if (require || d.dissentThreshold !== undefined) {
    // Global block: the knob is a { value, description } wrapper (require the object so a mistyped bare `0` can't
    // slip a truthiness short-circuit). Partial override: the knob is a bare number.
    if (require && (!d.dissentThreshold || typeof d.dissentThreshold !== 'object')) fail(`${where}.dissentThreshold must be a { value, description } object`);
    const dt = require ? d.dissentThreshold.value : d.dissentThreshold;
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0 || dt > 1) {
      fail(`${where}.dissentThreshold must be a finite number in [0, 1]`);
    }
  }
  if (require || d.resolutionMode !== undefined) {
    if (require && (!d.resolutionMode || typeof d.resolutionMode !== 'object')) fail(`${where}.resolutionMode must be a { value, description } object`);
    const rm = require ? d.resolutionMode.value : d.resolutionMode;
    if (!VALID_RESOLUTION_MODES.has(rm)) {
      fail(`${where}.resolutionMode must be one of ${[...VALID_RESOLUTION_MODES].join(', ')}`);
    }
  }
}

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

  // careJury — the care→jury table (#2633). A rosterTimingMode knob + one band per care level, each declaring the
  // lens fan-out, jurorsPerLens, roundCap, and optional per-lens validation methods. Validated for SHAPE only;
  // UNKNOWN keys are tolerated on purpose so the ratified forward-fit (per-lens weights, dissent threshold,
  // resolutionMode — #2651 / record 273a2dbd) is a purely-additive edit later, never a migration.
  const cj = c.careJury;
  if (!cj || typeof cj !== 'object') fail('missing careJury');
  const rtm = cj.rosterTimingMode;
  if (!rtm || typeof rtm !== 'object') fail('careJury.rosterTimingMode must be an object');
  if (!VALID_ROSTER_TIMING_MODES.has(rtm.value)) fail(`careJury.rosterTimingMode.value must be one of ${[...VALID_ROSTER_TIMING_MODES].join(', ')}`);
  if (typeof rtm.description !== 'string' || !rtm.description.trim()) fail('careJury.rosterTimingMode has no description prose');

  // disposition — the disposition-config knobs (#2651, FF3 filled in). The global default block declares all three
  // knobs plus the per-decision override allow-list. Additive over the #2633 shape; a band may narrow it per band
  // (validated in the band loop below) and a decision per subject (the allow-list here bounds what an override sets).
  const disp = cj.disposition;
  if (!disp || typeof disp !== 'object') fail('missing careJury.disposition');
  if (typeof disp.description !== 'string' || !disp.description.trim()) fail('careJury.disposition has no description prose');
  validateDispositionKnobs(disp, fail, 'careJury.disposition', true);
  // landMode (#2675) — the GLOBAL-only auto-land operating mode. A { value, description } wrapper like the other
  // global knobs; its value must be one of VALID_LAND_MODES. Validated here (not in validateDispositionKnobs) because
  // it is global-only: a band/decision override may never set it, so it must stay OUT of the shared knob validator.
  if (!disp.landMode || typeof disp.landMode !== 'object') fail('careJury.disposition.landMode must be a { value, description } object');
  if (!VALID_LAND_MODES.has(disp.landMode.value)) fail(`careJury.disposition.landMode.value must be one of ${[...VALID_LAND_MODES].join(', ')}`);
  if (typeof disp.landMode.description !== 'string' || !disp.landMode.description.trim()) fail('careJury.disposition.landMode has no description prose');
  const ov = disp.override;
  if (!ov || typeof ov !== 'object') fail('careJury.disposition.override must be an object');
  if (typeof ov.description !== 'string' || !ov.description.trim()) fail('careJury.disposition.override has no description prose');
  if (!Array.isArray(ov.overridableKeys) || ov.overridableKeys.length === 0) fail('careJury.disposition.override.overridableKeys must be a non-empty array');
  for (const k of ov.overridableKeys) {
    if (!DISPOSITION_KNOB_KEYS.includes(k)) fail(`careJury.disposition.override.overridableKeys names unknown knob "${k}"`);
  }
  if (new Set(ov.overridableKeys).size !== ov.overridableKeys.length) fail('careJury.disposition.override.overridableKeys has duplicates');

  const bands = cj.bands;
  if (!bands || typeof bands !== 'object') fail('careJury.bands must be an object');
  for (const name of CARE_BAND_NAMES) {
    const band = bands[name];
    if (!band || typeof band !== 'object') fail(`careJury.bands missing band "${name}"`);
    if (!Array.isArray(band.lenses)) fail(`careJury band "${name}".lenses must be an array`);
    for (const lens of band.lenses) {
      if (!VALID_CARE_LENSES.has(lens)) fail(`careJury band "${name}" has invalid lens "${lens}"`);
    }
    if (new Set(band.lenses).size !== band.lenses.length) fail(`careJury band "${name}".lenses has duplicates`);
    if (!Number.isInteger(band.jurorsPerLens) || band.jurorsPerLens < 0) fail(`careJury band "${name}".jurorsPerLens must be a non-negative integer`);
    if (!Number.isInteger(band.roundCap) || band.roundCap < 0) fail(`careJury band "${name}".roundCap must be a non-negative integer`);
    if (typeof band.description !== 'string' || !band.description.trim()) fail(`careJury band "${name}" has no description prose`);
    // validationMethods is OPTIONAL. When present it maps lens → array of non-empty method labels; every keyed
    // lens must be one this band actually fans out (a method for a lens that never runs is a spec error).
    if (band.validationMethods !== undefined) {
      const vm = band.validationMethods;
      if (!vm || typeof vm !== 'object' || Array.isArray(vm)) fail(`careJury band "${name}".validationMethods must be an object`);
      for (const [lens, methods] of Object.entries(vm)) {
        if (!band.lenses.includes(lens)) fail(`careJury band "${name}".validationMethods names lens "${lens}" not in this band's lenses`);
        if (!Array.isArray(methods) || methods.some((m) => typeof m !== 'string' || !m.trim())) {
          fail(`careJury band "${name}".validationMethods["${lens}"] must be an array of non-empty strings`);
        }
      }
    }
    // disposition — OPTIONAL per-band override of the global disposition knobs (#2651). Partial: any knob the band
    // omits inherits the global default (require=false). Reserved room today — no band carries one — but validated
    // so a later per-band tune is a checked edit. A band override names a lens only from its own fanned-out lenses.
    if (band.disposition !== undefined) {
      validateDispositionKnobs(band.disposition, fail, `careJury band "${name}".disposition`, false);
      const lw = band.disposition.lensWeights;
      if (lw && typeof lw === 'object' && !Array.isArray(lw)) {
        const weightMap = lw.values ?? lw; // descend into the {default, values} wrapper, else the bare lens→weight map
        for (const lens of Object.keys(weightMap)) {
          if (lens === 'default' || lens === 'values' || lens === 'description') continue;
          if (!band.lenses.includes(lens)) fail(`careJury band "${name}".disposition.lensWeights names lens "${lens}" not in this band's lenses`);
        }
      }
    }
  }
  return c;
}

/** The parsed, validated, deep-frozen contract. */
export const REVIEW_POLICY = deepFreeze(validateContract(JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'))));

/** The rubric threshold VALUES (bare numbers) — the single source `review-escalation.mjs` imports. Frozen. */
export const POLICY_THRESHOLDS = Object.freeze({
  diffLines: REVIEW_POLICY.thresholds.diffLines.value,
});

/** The care→jury table (#2633) as a derived, deep-frozen constant — the single source a future jury-roster
 *  consumer imports for the per-band lens fan-out / jurorsPerLens / roundCap (today's `panelRigorForCareLevel`
 *  bands live in jury-core.mjs and the conformance suite pins them equal to this table). Includes the
 *  `rosterTimingMode` knob (#4) and the reserved forward-fit room (#2651). Already frozen via REVIEW_POLICY. */
export const POLICY_CARE_JURY = REVIEW_POLICY.careJury;

/** The care band names in least→most order (`none` → `high`) — mirrors CARE_LEVEL_ORDER (review-escalation.mjs),
 *  pinned equal by the conformance suite. Frozen. */
export const POLICY_CARE_BAND_NAMES = Object.freeze([...CARE_BAND_NAMES]);

/** The disposition-config block (#2651, FF3) — the global default knobs + the per-decision override allow-list a
 *  future disposition judge (#2652) reads. Already deep-frozen via REVIEW_POLICY. */
export const POLICY_DISPOSITION = REVIEW_POLICY.careJury.disposition;

/** The allow-list of knob keys a per-decision override may set (`lensWeights`, `dissentThreshold`, `resolutionMode`).
 *  The privacy/authority boundary for `resolveDispositionConfig`: an override naming any other key is rejected. Frozen. */
export const POLICY_DISPOSITION_OVERRIDABLE_KEYS = Object.freeze([...REVIEW_POLICY.careJury.disposition.override.overridableKeys]);

/** The GLOBAL auto-land operating mode (#2675) — `shadow` (observe-only, the ratified default) or `enforce` (a clean
 *  auto-dispose writes review:accepted so the drain merges it). GLOBAL-only: NOT in POLICY_DISPOSITION_OVERRIDABLE_KEYS,
 *  so no band or decision may override it; flipping it to `enforce` is a separate one-line ruling (a diff to the
 *  policy contract → human-gated). The auto-land seam (auto-land-seam.mjs) reads this via resolveDispositionConfig. */
export const POLICY_LAND_MODE = REVIEW_POLICY.careJury.disposition.landMode.value;

/**
 * The CONFIG half of the resolver-spined F3 shape (#2651) — resolve the EFFECTIVE disposition config for one review
 * subject by merging the three precedence layers the contract declares: per-decision override > per-band override >
 * global default. PURE (a stateless recompute, no I/O) — this is the config a future disposition judge (#2652) reads;
 * it does NOT itself dispose (build the config, not the judge). Returns `{ lensWeights, dissentThreshold, resolutionMode }`
 * where `lensWeights` is a resolved `{ default, values }` (lens → weight; absent lens = `default`).
 *
 * @param {{ band?: string, override?: {lensWeights?: object, dissentThreshold?: number, resolutionMode?: string} }} o
 *   `band` names a care band whose optional per-band override narrows the global default; `override` is the
 *   per-decision override (only `POLICY_DISPOSITION_OVERRIDABLE_KEYS` keys honoured — an unknown key throws).
 * @returns {{ lensWeights: {default: number, values: object}, dissentThreshold: number, resolutionMode: string, landMode: string }}
 */
export function resolveDispositionConfig({ band, override } = {}) {
  const g = REVIEW_POLICY.careJury.disposition;
  // Layer 1 — global default.
  let lensWeights = { default: g.lensWeights.default, values: { ...g.lensWeights.values } };
  let dissentThreshold = g.dissentThreshold.value;
  let resolutionMode = g.resolutionMode.value;
  // landMode is GLOBAL-only (#2675) — never merged through the band/decision precedence below; the auto-land seam
  // reads the resolved config, so it rides along here, but its value is always the single global stance.
  const landMode = g.landMode.value;
  // Layer 2 — per-band override (partial; a band omits the disposition key entirely when it inherits everything).
  if (band !== undefined) {
    if (!CARE_BAND_NAMES.includes(band)) throw new Error(`resolveDispositionConfig: unknown care band "${band}"`);
    const bd = REVIEW_POLICY.careJury.bands[band].disposition;
    if (bd) {
      if (bd.lensWeights) lensWeights = mergeLensWeights(lensWeights, bd.lensWeights);
      if (bd.dissentThreshold !== undefined) dissentThreshold = bd.dissentThreshold;
      if (bd.resolutionMode !== undefined) resolutionMode = bd.resolutionMode;
    }
  }
  // Layer 3 — per-decision override (allow-list gated: an override may only set the three declared knobs), and its
  // VALUES must satisfy the contract's declared domains — the resolver is the runtime boundary for a decision
  // override, so a bad override fails loud here rather than emitting an out-of-domain effective config.
  if (override) {
    for (const key of Object.keys(override)) {
      if (!POLICY_DISPOSITION_OVERRIDABLE_KEYS.includes(key)) {
        throw new Error(`resolveDispositionConfig: override key "${key}" is not overridable (allowed: ${POLICY_DISPOSITION_OVERRIDABLE_KEYS.join(', ')})`);
      }
    }
    validateDispositionKnobs(override, (msg) => { throw new Error(`resolveDispositionConfig: invalid override — ${msg}`); }, 'override', false);
    if (override.lensWeights) lensWeights = mergeLensWeights(lensWeights, override.lensWeights);
    if (override.dissentThreshold !== undefined) dissentThreshold = override.dissentThreshold;
    if (override.resolutionMode !== undefined) resolutionMode = override.resolutionMode;
  }
  return { lensWeights, dissentThreshold, resolutionMode, landMode };
}

/** Merge a partial lens-weight override onto a resolved `{ default, values }` — a bare lens→weight map (or a
 *  `{ default?, values? }` shape) narrows the base; unspecified lenses keep their inherited weight. Pure. */
function mergeLensWeights(base, patch) {
  const out = { default: base.default, values: { ...base.values } };
  const patchValues = patch.values && typeof patch.values === 'object' ? patch.values : patch;
  if (typeof patch.default === 'number') out.default = patch.default;
  for (const [lens, weight] of Object.entries(patchValues)) {
    if (lens === 'default' || lens === 'values' || lens === 'description') continue;
    out.values[lens] = weight;
  }
  return out;
}

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
