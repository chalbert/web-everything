/**
 * @file scripts/operations/registry.mjs
 * @description THE DECLARATION SHAPE + THE REGISTRY of the operation engine (#3032, under epic #3029).
 *
 * ONE DECLARATION, DERIVED CALLERS. Per the statute
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * (#3031), a delivery-loop operation is declared once — input schema + ordered named steps — and every
 * caller is generated from it. This file owns the declaration and refuses a malformed one; the adapters
 * that read it are #3035 (command line) and #3036 (HTTP). **Nothing is declared onto this registry in this
 * slice** — #3032 is the machine, #3035 is the first declaration.
 *
 * THE SHAPE, LITERALLY `op(name, { input, ...steps })`:
 *
 * ```js
 * export const reviewPr = op('review-pr', {
 *   input:       { pr: 'number', reason: { type: 'string', required: false } },
 *   verdictFrom: 'panel',                                   // optional: which step's finding IS the verdict
 *   diff:    compute({ reads: ['input.pr'],       fn: (v) => … }),
 *   panel:   judge({   reads: ['findings.diff'],  request: (v) => ({ mandate, input, shape }) }),
 *   humanOk: confirm({ reads: ['verdict'], asks: 'Accept this verdict?', of: 'operator',
 *                      options: ['accept', 'changes'] }),
 *   record:  effect({  reads: ['verdict'],        effects: (v) => [{ type: 'ledger.append', payload: v }] }),
 * });
 * ```
 *
 * Step ORDER is the object's key order — JavaScript preserves insertion order for string keys, so the
 * declaration reads top-to-bottom as the run executes. `input` and `verdictFrom` are the ONLY reserved keys;
 * every other key is a step.
 *
 * REFUSED AT REGISTRATION, NEVER AT RUN TIME. A fifth kind, a hand-rolled step lookalike, a read of a
 * later step's finding, a read of an undeclared input field, a `verdictFrom` naming nothing — all of these
 * throw out of `op()`. The statute's *"a fifth kind is a signal to change the model"* is therefore a gate
 * a run can never reach, not advice in a comment.
 *
 * PURE. No fs, no clock, no process, no network. Leaf apart from {@link ./step-kinds.mjs}.
 */

import { STEP_KINDS, isStep } from './step-kinds.mjs';

/** Keys of a declaration body that are NOT steps. Everything else must be a step. */
export const RESERVED_DECLARATION_KEYS = Object.freeze(['input', 'verdictFrom']);

/** Field types an input schema may declare. */
export const INPUT_TYPES = Object.freeze(['string', 'number', 'boolean', 'object', 'array']);

/** @param {*} v @returns {boolean} */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Normalize an input schema — `{ pr: 'number' }` and `{ pr: { type: 'number', required: true } }` are the
 * same thing. Shorthand fields are REQUIRED; optionality is opt-in, so a caller cannot omit a field by
 * accident. Returns a frozen map of `{ type, required, default, enum }`.
 *
 * `enum` — A CLOSED SET, DECLARED ONCE. Under the statute's "declared once, callers generated", the set of
 * values a field accepts is part of what the operation IS, so declaring it buys three things from one line:
 * `validateInput` refuses anything outside it, the command line PRINTS it in `--help` instead of `<string>`,
 * and #3036's HTTP adapter gets the same for free. Before this, `review-pr` knew its four lenses (it re-exports
 * `PANEL_LENSES` from `we:scripts/lib/jury-core.mjs` expressly "so an adapter can list it in --help"), and the
 * adapter still printed `[--lens=<string>]` — the intent was there and the wiring was not, because the adapter
 * derives every flag from THIS schema and the schema had nowhere to put it. It generalises: any field with a
 * fixed vocabulary (a verdict target, a mode, a repo class) declares one here rather than validating by hand
 * inside its first step, where the refusal arrives after the run record already exists.
 *
 * Only `string` and `number` may carry one — a closed set of objects/arrays is a schema, not an enum, and
 * pretending otherwise would invite deep-equality membership tests the CLI's `--flag=value` parse cannot serve.
 *
 * @param {object|undefined} schema
 * @param {string} name - operation name, for error text.
 * @returns {Readonly<Record<string, {type: string, required: boolean, default: *, enum: (readonly *[]|null)}>>}
 */
export function normalizeInputSchema(schema, name = '<anonymous>') {
  if (schema == null) return Object.freeze({});
  if (!isPlainObject(schema)) {
    throw new TypeError(`operations: \`${name}\` — \`input\` must be an object mapping field → type`);
  }
  const out = {};
  for (const [field, spec] of Object.entries(schema)) {
    const s = typeof spec === 'string' ? { type: spec } : spec;
    if (!isPlainObject(s)) {
      throw new TypeError(`operations: \`${name}\` — input field \`${field}\` must be a type string or a spec object`);
    }
    if (!INPUT_TYPES.includes(s.type)) {
      throw new TypeError(
        `operations: \`${name}\` — input field \`${field}\` has type ${JSON.stringify(s.type)}; must be one of ${INPUT_TYPES.join('|')}`,
      );
    }
    const required = s.required === undefined ? true : !!s.required;
    if (required && s.default !== undefined) {
      throw new TypeError(`operations: \`${name}\` — input field \`${field}\` is required and cannot also carry a \`default\``);
    }
    const members = normalizeEnum(s.enum, name, field, s.type);
    if (members && s.default !== undefined && !members.includes(s.default)) {
      throw new TypeError(
        `operations: \`${name}\` — input field \`${field}\` defaults to ${JSON.stringify(s.default)}, which is not `
        + `one of its own declared values (${members.join('|')}). A default the field would refuse is a run that `
        + 'dies on its own schema.',
      );
    }
    out[field] = Object.freeze({ type: s.type, required, default: s.default, enum: members });
  }
  return Object.freeze(out);
}

/** Types a declared `enum` is allowed on. See the note in {@link normalizeInputSchema}. */
const ENUMERABLE_TYPES = Object.freeze(['string', 'number']);

/** Validate + freeze one field's declared value set. Returns `null` when the field declares none. */
function normalizeEnum(members, name, field, type) {
  if (members === undefined || members === null) return null;
  if (!Array.isArray(members) || members.length === 0) {
    throw new TypeError(`operations: \`${name}\` — input field \`${field}\`'s \`enum\` must be a non-empty array`);
  }
  if (!ENUMERABLE_TYPES.includes(type)) {
    throw new TypeError(
      `operations: \`${name}\` — input field \`${field}\` is a ${type} and cannot declare an \`enum\` `
      + `(only ${ENUMERABLE_TYPES.join('/')} may)`,
    );
  }
  for (const m of members) {
    if (typeOf(m) !== type) {
      throw new TypeError(
        `operations: \`${name}\` — input field \`${field}\` declares enum member ${JSON.stringify(m)}, `
        + `which is not a ${type}`,
      );
    }
  }
  if (new Set(members).size !== members.length) {
    throw new TypeError(`operations: \`${name}\` — input field \`${field}\`'s \`enum\` repeats a value`);
  }
  return Object.freeze([...members]);
}

/** Runtime type test matching {@link INPUT_TYPES}. */
function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * Validate a run's input against a normalized schema. FAILS CLOSED in both directions: a missing required
 * field AND an **unknown** field are both errors, so a caller can never smuggle state past the declaration.
 *
 * @param {object} schema - a normalized schema from {@link normalizeInputSchema}.
 * @param {object} input
 * @returns {{ok: boolean, value: object, errors: string[]}}
 */
export function validateInput(schema, input) {
  const errors = [];
  if (!isPlainObject(input)) {
    return { ok: false, value: {}, errors: ['input must be an object'] };
  }
  const value = {};
  for (const [field, spec] of Object.entries(schema)) {
    const given = Object.prototype.hasOwnProperty.call(input, field) ? input[field] : undefined;
    if (given === undefined) {
      if (spec.required) errors.push(`missing required input field \`${field}\` (${spec.type})`);
      else if (spec.default !== undefined) value[field] = spec.default;
      continue;
    }
    const actual = typeOf(given);
    if (actual !== spec.type) {
      errors.push(`input field \`${field}\` must be a ${spec.type}, got ${actual}`);
      continue;
    }
    // A declared value set is refused HERE, before a run record exists — not inside the first step that
    // happens to look at it, where the refusal costs a run id and a written record to reject one flag.
    if (spec.enum && !spec.enum.includes(given)) {
      errors.push(
        `input field \`${field}\` must be one of ${spec.enum.map((m) => String(m)).join('|')}, got ${JSON.stringify(given)}`,
      );
      continue;
    }
    value[field] = given;
  }
  for (const field of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(schema, field)) {
      errors.push(`unknown input field \`${field}\` — the declaration does not accept it`);
    }
  }
  return { ok: errors.length === 0, value, errors };
}

/**
 * Build + validate an operation declaration. THE REFUSAL POINT: everything structural about an operation is
 * checked here, before any run exists.
 *
 * @param {string} name - the operation's stable id (kebab-case by convention; any non-empty string works).
 * @param {object} body - `{ input?, verdictFrom?, ...steps }`.
 * @returns {Readonly<{name: string, input: object, verdictFrom: (string|null),
 *                     steps: ReadonlyArray<{name: string, index: number, step: object}>,
 *                     stepNames: readonly string[]}>}
 */
export function op(name, body) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('operations: `op(name, …)` needs a non-empty operation name');
  }
  if (!isPlainObject(body)) {
    throw new TypeError(`operations: \`${name}\` — the declaration body must be an object { input, ...steps }`);
  }

  const input = normalizeInputSchema(body.input, name);
  const inputFields = new Set(Object.keys(input));

  const steps = [];
  const seen = new Set();
  for (const [key, value] of Object.entries(body)) {
    if (RESERVED_DECLARATION_KEYS.includes(key)) continue;
    if (!isStep(value)) {
      // THE CLOSED-VOCABULARY REFUSAL. A fifth kind, a plain object with a made-up `kind`, or a stray
      // config key all land here — at registration, never at run time.
      const got = isPlainObject(value) && typeof value.kind === 'string' ? `kind ${JSON.stringify(value.kind)}` : typeof value;
      throw new TypeError(
        `operations: \`${name}\` — key \`${key}\` is not a step (${got}). The vocabulary is closed at ` +
        `${STEP_KINDS.join('|')}; the only non-step keys are ${RESERVED_DECLARATION_KEYS.join('|')}. ` +
        'An operation that appears to need a fifth kind is a signal to change the model, not to extend the ' +
        'vocabulary (#operations-declared-once-callers-generated, #3031).',
      );
    }
    if (seen.has(key)) throw new TypeError(`operations: \`${name}\` — duplicate step name \`${key}\``);
    seen.add(key);
    steps.push({ name: key, index: steps.length, step: value });
  }

  if (steps.length === 0) {
    throw new TypeError(`operations: \`${name}\` — an operation needs at least one step`);
  }

  // Reads are checked against what EXISTS AT THAT POINT IN THE RUN: an earlier step's finding, a declared
  // input field, or the verdict. A forward reference is a declaration bug and dies here.
  const earlier = new Set();
  for (const { name: stepName, step } of steps) {
    for (const path of step.reads) {
      const [root, leaf] = path.split('.');
      if (root === 'input') {
        if (leaf !== undefined && !inputFields.has(leaf)) {
          throw new TypeError(`operations: \`${name}\`.\`${stepName}\` reads \`${path}\` but the input schema has no field \`${leaf}\``);
        }
      } else if (root === 'findings') {
        if (leaf === undefined) {
          throw new TypeError(`operations: \`${name}\`.\`${stepName}\` reads bare \`findings\` — name the step, e.g. \`findings.diff\``);
        }
        if (!earlier.has(leaf)) {
          throw new TypeError(
            `operations: \`${name}\`.\`${stepName}\` reads \`${path}\`, but \`${leaf}\` is ` +
            (seen.has(leaf) ? 'declared LATER in the run — a step cannot read a finding that does not exist yet' : 'not a declared step'),
          );
        }
      } else if (root === 'verdict' && path !== 'verdict') {
        throw new TypeError(`operations: \`${name}\`.\`${stepName}\` reads \`${path}\` — \`verdict\` takes no sub-path`);
      }
    }
    earlier.add(stepName);
  }

  let verdictFrom = null;
  if (body.verdictFrom != null) {
    if (typeof body.verdictFrom !== 'string' || !seen.has(body.verdictFrom)) {
      throw new TypeError(
        `operations: \`${name}\` — \`verdictFrom\` must name a declared step, got ${JSON.stringify(body.verdictFrom)}`,
      );
    }
    verdictFrom = body.verdictFrom;
  }

  return Object.freeze({
    name: name.trim(),
    input,
    verdictFrom,
    steps: Object.freeze(steps.map((s) => Object.freeze(s))),
    stepNames: Object.freeze(steps.map((s) => s.name)),
  });
}

/**
 * A registry of declared operations. `createRegistry()` returns an isolated one (what tests and adapters
 * should use); {@link defaultRegistry} is the process-wide one that {@link defineOperation} writes to.
 *
 * Lookups FAIL CLOSED: `get` on an unknown name throws rather than returning undefined, because the caller
 * downstream of it is about to run something.
 */
export function createRegistry() {
  /** @type {Map<string, object>} */
  const byName = new Map();
  return {
    /** Register a declaration built by {@link op}. Re-registering the SAME frozen declaration is a no-op;
     *  registering a DIFFERENT one under a taken name is refused (two wirings for one operation is the
     *  exact defect the statute forbids). */
    register(declaration) {
      if (!declaration || typeof declaration !== 'object' || typeof declaration.name !== 'string' || !Array.isArray(declaration.steps)) {
        throw new TypeError('operations: registry.register expects a declaration built by `op(name, …)`');
      }
      const existing = byName.get(declaration.name);
      if (existing && existing !== declaration) {
        throw new Error(`operations: \`${declaration.name}\` is already registered with a different declaration`);
      }
      byName.set(declaration.name, declaration);
      return declaration;
    },
    /** @returns {object} the declaration. THROWS on an unknown name — never `undefined`. */
    get(name) {
      const found = byName.get(String(name ?? ''));
      if (!found) {
        const known = [...byName.keys()].sort();
        throw new Error(
          `operations: no operation named ${JSON.stringify(name)} is registered` +
          (known.length ? ` (known: ${known.join(', ')})` : ' (the registry is empty)'),
        );
      }
      return found;
    },
    has(name) { return byName.has(String(name ?? '')); },
    names() { return [...byName.keys()].sort(); },
    clear() { byName.clear(); },
  };
}

/** The process-wide registry. Adapters resolve an operation name through this one. */
export const defaultRegistry = createRegistry();

/** Declare an operation AND register it in {@link defaultRegistry}. `op()` alone stays side-effect free. */
export function defineOperation(name, body) {
  return defaultRegistry.register(op(name, body));
}
