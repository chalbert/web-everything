/**
 * @file scripts/operations/step-kinds.mjs
 * @description THE CLOSED STEP VOCABULARY of the operation engine (#3032, under epic #3029).
 *
 * FOUR KINDS, AND NO FIFTH. The statute
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * (ratified 2026-08-08, #3031) closes the vocabulary at four and says why: *"An operation that appears to
 * need a fifth kind is a signal to change the model, not to extend the vocabulary."* This module is where
 * that closure is a **gate rather than a sentence** — {@link STEP_KINDS} is the whole list, `op()` in
 * {@link ./registry.mjs} refuses anything else, and the refusal happens **at registration**, not at run
 * time, so a fifth kind cannot reach a run at all.
 *
 * WHAT EACH KIND MAY DO — and, more load-bearing, WHAT IT MAY NOT.
 *
 *  - `compute` — a **pure function** plus its **declared reads**. The engine hands the fn a projection
 *    containing ONLY the paths the step declared, so an undeclared read is structurally impossible rather
 *    than merely discouraged.
 *  - `judge` — **declares a judgement; never performs one.** Its `request` fn returns `{ mandate, input,
 *    shape, … }` shaped for {@link ../lib/judge-spawn.mjs} (`judgeSpawn`, #3028) to run. The engine
 *    SUSPENDS and the caller does the spawn between two `advance` calls. This module imports nothing that
 *    can spawn, and a test pins that (see `__tests__/engine.test.mjs`, the io-import assertion).
 *  - `confirm` — **needs a person.** The engine suspends and records WHAT is asked and OF WHOM. This is the
 *    statute's replacement for the prose stop in `we:skills-src/review/SKILL.md`.
 *  - `effect` — **declares what should happen; performs none of it.** Its `effects` fn returns a list of
 *    `{ type, payload }` descriptors; {@link ./effect-executor.mjs} applies them, keyed by run + step +
 *    ordinal, so replay after a partial failure is safe.
 *
 * PURE. No fs, no clock, no process, no network — this file is a leaf and constructs plain frozen objects.
 */

/** The closed vocabulary. Adding to this array is the change the statute forbids without changing the model. */
export const STEP_KINDS = Object.freeze(['compute', 'judge', 'confirm', 'effect']);

/** Roots a step's declared `reads` may address. Anything else is refused at registration. */
export const READ_ROOTS = Object.freeze(['input', 'findings', 'verdict']);

/** Brand carried by every step this module builds — a hand-rolled object cannot forge its way past `op()`. */
const STEP_BRAND = Symbol.for('we.operations.step');

/** @param {*} v @returns {boolean} true for a plain (non-array, non-null) object. */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Is `value` a step this module built? Used by `op()` to refuse both a fifth kind AND a hand-rolled
 * lookalike. Exported so the registry's refusal is testable on its own.
 * @param {*} value
 * @returns {boolean}
 */
export function isStep(value) {
  return isPlainObject(value) && value[STEP_BRAND] === true && STEP_KINDS.includes(value.kind);
}

/**
 * Normalize + shallow-validate a step's declared `reads`. Deeper validation (does `findings.x` name an
 * EARLIER step? does `input.y` name a declared field?) needs the whole declaration and therefore lives in
 * `op()`; this only pins the syntax.
 * @param {*} reads
 * @param {string} kind - for the error message.
 * @returns {readonly string[]}
 */
function normalizeReads(reads, kind) {
  if (reads == null) return Object.freeze([]);
  if (!Array.isArray(reads)) {
    throw new TypeError(`operations: \`${kind}\` step \`reads\` must be an array of dotted paths, got ${typeof reads}`);
  }
  const out = [];
  for (const r of reads) {
    if (typeof r !== 'string' || !r.trim()) {
      throw new TypeError(`operations: \`${kind}\` step has a non-string entry in \`reads\``);
    }
    const path = r.trim();
    const root = path.split('.')[0];
    if (!READ_ROOTS.includes(root)) {
      throw new TypeError(
        `operations: \`${kind}\` step declares read ${JSON.stringify(path)} — the root must be one of ${READ_ROOTS.join('|')}`,
      );
    }
    if (path.split('.').length > 2) {
      throw new TypeError(
        `operations: \`${kind}\` step declares read ${JSON.stringify(path)} — reads are at most two segments (\`input.<field>\` / \`findings.<step>\` / \`verdict\`)`,
      );
    }
    if (!out.includes(path)) out.push(path);
  }
  return Object.freeze(out);
}

/** Freeze a step object with its brand. */
function seal(step) {
  return Object.freeze({ ...step, [STEP_BRAND]: true });
}

/**
 * A **pure function plus its declared reads**. The engine calls `fn(view)` where `view` holds ONLY the
 * declared paths; the return value is stored as this step's finding.
 *
 * @param {object} spec
 * @param {string[]} [spec.reads] - dotted paths this step may see (`input.pr`, `findings.diff`, `verdict`).
 * @param {(view: object) => *} spec.fn - the pure function. It is given no io handles, ever.
 * @returns {object} a frozen `compute` step.
 */
export function compute({ reads, fn } = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('operations: `compute` step needs an `fn` function');
  }
  return seal({ kind: 'compute', reads: normalizeReads(reads, 'compute'), fn });
}

/**
 * A step that **needs a model and no tools**. It DECLARES the juror call and never makes it: `request(view)`
 * returns `{ mandate, input, shape }` (plus optional `model` / `effort` / `budget` / `lens`), which is
 * exactly `judgeSpawn`'s option shape (#3028). The engine suspends with that request on the run record; the
 * caller spawns and resumes.
 *
 * @param {object} spec
 * @param {string[]} [spec.reads]
 * @param {(view: object) => {mandate: string, input: string, shape: object}} spec.request
 * @returns {object} a frozen `judge` step.
 */
export function judge({ reads, request } = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('operations: `judge` step needs a `request` function returning {mandate, input, shape}');
  }
  return seal({ kind: 'judge', reads: normalizeReads(reads, 'judge'), request });
}

/**
 * A step that **needs a person**. The engine suspends and records what is asked and of whom; a decision
 * arrives later, from any surface, as a `resume` on the next `advance`.
 *
 * @param {object} spec
 * @param {string[]} [spec.reads]
 * @param {string|((view: object) => string)} spec.asks - the question put to the person.
 * @param {string} spec.of - who is asked (`operator`, a role, a handle) — recorded on the run record.
 * @param {string[]} [spec.options] - a closed answer set; a resume outside it is REFUSED.
 * @returns {object} a frozen `confirm` step.
 */
export function confirm({ reads, asks, of, options } = {}) {
  if (typeof asks !== 'string' && typeof asks !== 'function') {
    throw new TypeError('operations: `confirm` step needs `asks` — a string or a fn returning one');
  }
  if (typeof asks === 'string' && !asks.trim()) {
    throw new TypeError('operations: `confirm` step `asks` must be non-empty');
  }
  if (typeof of !== 'string' || !of.trim()) {
    throw new TypeError('operations: `confirm` step needs `of` — WHO is being asked (e.g. "operator")');
  }
  if (options != null) {
    if (!Array.isArray(options) || options.length === 0 || options.some((o) => typeof o !== 'string' || !o.trim())) {
      throw new TypeError('operations: `confirm` step `options`, when given, must be a non-empty array of strings');
    }
  }
  return seal({
    kind: 'confirm',
    reads: normalizeReads(reads, 'confirm'),
    asks,
    of: of.trim(),
    options: options ? Object.freeze([...options]) : null,
  });
}

/**
 * A step that **declares effects and performs none**. `effects(view)` returns an array of descriptors
 * `{ type, payload, idempotent? }`; {@link ./effect-executor.mjs} is the only thing that applies them.
 *
 * `idempotent: true` means re-applying the effect is harmless — which is what lets the executor recover from
 * an INDETERMINATE attempt (one that started and whose outcome is unknown) instead of refusing. It defaults
 * to `false`, so the unsafe case is the one you have to opt into.
 *
 * @param {object} spec
 * @param {string[]} [spec.reads]
 * @param {(view: object) => Array<{type: string, payload?: *, idempotent?: boolean}>} spec.effects
 * @returns {object} a frozen `effect` step.
 */
export function effect({ reads, effects } = {}) {
  if (typeof effects !== 'function') {
    throw new TypeError('operations: `effect` step needs an `effects` function returning declared effects');
  }
  return seal({ kind: 'effect', reads: normalizeReads(reads, 'effect'), effects });
}
