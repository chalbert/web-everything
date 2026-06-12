/**
 * Validation-generation plane — the foundation of #085's "generate validation, two ways" protocol
 * (#304, slice #085-A). This module ships the two artifacts every downstream adapter slice consumes:
 *
 *  1. **The neutral intent vocabulary** — `ValidationIntentId`, the language-agnostic enumeration of
 *     *what can be constrained* (required, min-length, pattern, …). You declare validation once against
 *     these intents; an adapter materializes the declaration into a target language/format.
 *  2. **The `CustomValidationAdapter` contract** — the shape every emitter implements, including the
 *     intents it **declares + exposes** compliance with (the #085 "each adapter declares which intents
 *     it complies with" rule). Slices #305 (native-HTML), #306 (Zod), #307 (Pydantic), #308
 *     (JSON-Schema) each ship one adapter; #309 the Mode-2 service. They register into the
 *     {@link ../validation-generation/registry.CustomValidationAdapterRegistry}.
 *
 * **A code model, not a UX intent.** This is the *generation* vocabulary, deliberately distinct from
 * the UX-facing **Validation Intent** in `src/_data/intents.json` (which owns context/level/execution/
 * visibility — how validation *feels*). Per the intent-UX-only rule and the #266 capability-manifest
 * precedent (a code-model artifact, not an `intents.json` field), the constraint vocabulary lives here
 * as a dependency-free TS model — never an `intents.json` entry. Like `validity-merge/` (#212),
 * `validator-resolution/` (#214), and `capability-manifest/` (#266), the model is standalone: the
 * registry and the per-language adapters read *this* shape, they do not re-derive it.
 *
 * **No runtime injector plug (by design).** Unlike `customValidityMerge` (#215), which is resolved
 * live per-control in the injector chain, generation runs at build / service time (Mode 1 emit, Mode 2
 * service — #309), not per-control-instance. So the registry is a standalone table (mirroring the
 * standalone `validity-merge/registry.ts`), re-exported from the `webvalidation` plug like the
 * capability manifest — no `plugs/webvalidation` element extending `CustomRegistry`.
 */

/** The version a validation intent id first appeared in — see {@link VALIDATION_GENERATION_SPEC_VERSION}. */
export const VALIDATION_GENERATION_SPEC_VERSION = '1.0.0';

/**
 * A stable validation **intent** id (`validation.intent.*`, dot-path, append-only) — the neutral
 * vocabulary of what can be constrained, independent of any target language. An adapter lists the
 * subset it can emit in its `intents[]`; a declaration references one per constraint. Ids are **never
 * renamed** — deprecate-don't-rename keeps `#NNN`/tool references stable (same semver rule as the
 * capability manifest #266).
 */
export type ValidationIntentId =
  // Presence & type.
  | 'validation.intent.required'
  | 'validation.intent.type'
  // String shape.
  | 'validation.intent.min-length'
  | 'validation.intent.max-length'
  | 'validation.intent.pattern'
  | 'validation.intent.format'
  // Numeric range.
  | 'validation.intent.min'
  | 'validation.intent.max'
  | 'validation.intent.step'
  // Collection size.
  | 'validation.intent.min-items'
  | 'validation.intent.max-items'
  // Set membership & arbitrary predicate (the escape hatch).
  | 'validation.intent.enum'
  | 'validation.intent.custom';

/** Every known validation intent id — the closed vocabulary a declaration and an adapter draw from. */
export const VALIDATION_INTENTS: readonly ValidationIntentId[] = [
  'validation.intent.required',
  'validation.intent.type',
  'validation.intent.min-length',
  'validation.intent.max-length',
  'validation.intent.pattern',
  'validation.intent.format',
  'validation.intent.min',
  'validation.intent.max',
  'validation.intent.step',
  'validation.intent.min-items',
  'validation.intent.max-items',
  'validation.intent.enum',
  'validation.intent.custom',
];

/**
 * The spec version each intent id **first appeared in** (its `since`). Append-only: a new id is added
 * with the version that introduced it. Mirrors `FEATURE_SINCE` in the capability manifest (#266) so
 * the version-gating rule is identical across the validation standard's planes.
 */
export const VALIDATION_INTENT_SINCE: Record<ValidationIntentId, string> = {
  'validation.intent.required': '1.0.0',
  'validation.intent.type': '1.0.0',
  'validation.intent.min-length': '1.0.0',
  'validation.intent.max-length': '1.0.0',
  'validation.intent.pattern': '1.0.0',
  'validation.intent.format': '1.0.0',
  'validation.intent.min': '1.0.0',
  'validation.intent.max': '1.0.0',
  'validation.intent.step': '1.0.0',
  'validation.intent.min-items': '1.0.0',
  'validation.intent.max-items': '1.0.0',
  'validation.intent.enum': '1.0.0',
  'validation.intent.custom': '1.0.0',
};

/** True when `id` is a member of the known validation-intent vocabulary. */
export function isValidationIntentId(id: unknown): id is ValidationIntentId {
  return typeof id === 'string' && (VALIDATION_INTENTS as readonly string[]).includes(id);
}

/**
 * A single declared constraint — an intent plus its parameter and an optional author message. The
 * `value`'s meaning is intent-specific: `min-length` → a number, `pattern` → a RegExp source string,
 * `format` → a named format (`'email'` | `'url'` | …), `enum` → the allowed set, `required` → no value.
 */
export interface ValidationConstraint {
  readonly intent: ValidationIntentId;
  readonly value?: unknown;
  readonly message?: string;
}

/** The validation declared for one field/property — the neutral input an adapter materializes. */
export interface ValidationDeclaration {
  readonly field: string;
  readonly constraints: readonly ValidationConstraint[];
}

/**
 * The artifact an adapter emits. `code` is the target-language source; `unsupported` lists any intent
 * in the declaration this adapter does not comply with — **reported, never silently dropped** (the
 * #085 lossy-is-visible rule; mirrors MaaS's `lossy`/`diagnostics`).
 */
export interface GeneratedValidation {
  readonly format: string;
  readonly language?: string;
  readonly code: string;
  readonly unsupported: readonly ValidationIntentId[];
}

/**
 * The contract every validation-generation adapter implements. `intents` is the adapter's declared
 * compliance surface — the subset of the vocabulary it can emit; the registry uses it for
 * `adaptersFor(intent)` discovery and `emit()` reports anything outside it as `unsupported`.
 */
export interface CustomValidationAdapter {
  /** Registration key (the format id), e.g. `'native-html'` | `'zod'` | `'pydantic'` | `'json-schema'`. */
  readonly key: string;
  /** Human/target format label surfaced in the emitted artifact. */
  readonly format: string;
  /** Target language token (`'html'` | `'typescript'` | `'python'` | `'json'`), if applicable. */
  readonly language?: string;
  /** The validation intents this adapter declares + exposes compliance with. */
  readonly intents: readonly ValidationIntentId[];
  /** Materialize a declaration into the target format. */
  emit(declaration: ValidationDeclaration): GeneratedValidation;
}

/** The intents present in `declaration` that `adapter` does not declare compliance with. */
export function unsupportedIntents(
  adapter: CustomValidationAdapter,
  declaration: ValidationDeclaration,
): ValidationIntentId[] {
  const supported = new Set(adapter.intents);
  const seen = new Set<ValidationIntentId>();
  for (const c of declaration.constraints) {
    if (!supported.has(c.intent)) seen.add(c.intent);
  }
  return [...seen];
}

/** Thrown by {@link assertValidationAdapter} when a value does not satisfy the adapter contract. */
export class ValidationAdapterContractError extends Error {
  constructor(reason: string) {
    super(`Invalid CustomValidationAdapter — ${reason}`);
    this.name = 'ValidationAdapterContractError';
  }
}

/** Structural check: a non-empty `key`/`format`, a known-intent `intents[]`, and an `emit` function. */
export function isValidationAdapter(value: unknown): value is CustomValidationAdapter {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Partial<CustomValidationAdapter>;
  return (
    typeof a.key === 'string' &&
    a.key.length > 0 &&
    typeof a.format === 'string' &&
    a.format.length > 0 &&
    Array.isArray(a.intents) &&
    a.intents.every(isValidationIntentId) &&
    typeof a.emit === 'function'
  );
}

/** Assert the adapter contract, throwing {@link ValidationAdapterContractError} on the first breach. */
export function assertValidationAdapter(value: unknown): asserts value is CustomValidationAdapter {
  if (typeof value !== 'object' || value === null) throw new ValidationAdapterContractError('not an object');
  const a = value as Partial<CustomValidationAdapter>;
  if (typeof a.key !== 'string' || a.key.length === 0) throw new ValidationAdapterContractError('missing a non-empty "key"');
  if (typeof a.format !== 'string' || a.format.length === 0) throw new ValidationAdapterContractError('missing a non-empty "format"');
  if (!Array.isArray(a.intents)) throw new ValidationAdapterContractError('"intents" must be an array');
  const unknown = a.intents.filter((i) => !isValidationIntentId(i));
  if (unknown.length > 0) throw new ValidationAdapterContractError(`unknown intent id(s): ${unknown.join(', ')}`);
  if (typeof a.emit !== 'function') throw new ValidationAdapterContractError('missing an "emit" method');
}
