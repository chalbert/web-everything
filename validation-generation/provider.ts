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

/**
 * A cross-field rule — a constraint that spans more than one field, carried as a **CEL** expression (the
 * single canonical pivot, #504 / ratified #465). The expression references sibling fields by name
 * (`endDate > startDate`; `category == 'gift' ? giftLetter != null : true`). CEL supersedes the
 * non-portable `custom` escape hatch for the portable case — a forward adapter transpiles it to the
 * target idiom, or reports it unsupported and the rule degrades to the Mode-2 service.
 */
export interface CrossFieldRule {
  /** The rule as a CEL expression (the canonical, portable representation). */
  readonly rule: string;
  /** Optional author message surfaced when the rule fails. */
  readonly message?: string;
}

/** The validation declared for one field/property — the neutral input an adapter materializes. */
export interface ValidationDeclaration {
  readonly field: string;
  readonly constraints: readonly ValidationConstraint[];
  /**
   * Optional object-scoped cross-field rules (CEL), anchored on this declaration. An OPTIONAL,
   * advertised, flag-lossy capability (#504): only adapters that declare `validation.feature.cross-field`
   * (i.e. implement {@link CustomValidationAdapter.emitCrossField}) materialize these; otherwise they are
   * reported and fall back to the authoritative Mode-2 service.
   */
  readonly crossField?: readonly CrossFieldRule[];
}

/**
 * The artifact a cross-field-capable adapter emits for a declaration's `crossField` rules — separate from
 * the per-field `GeneratedValidation` because cross-field lowers to an object-scoped construct
 * (`.refine()` for Zod, `model_validator` for Pydantic). `unsupportedRules` lists any CEL rule the adapter
 * could not transpile (outside the CEL subset) — reported, never silently dropped (the #085 lossy rule).
 */
export interface GeneratedCrossField {
  readonly format: string;
  readonly language?: string;
  readonly code: string;
  readonly unsupportedRules: readonly string[];
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
  /**
   * OPTIONAL — materialize a declaration's cross-field rules (CEL) into the target idiom. Implementing
   * this method IS the adapter's declaration of `validation.feature.cross-field` compliance (#504): an
   * adapter without it does not support cross-field, and the rules degrade to the Mode-2 service. See
   * {@link supportsCrossField} / {@link crossFieldFeatureFor}.
   */
  emitCrossField?(declaration: ValidationDeclaration): GeneratedCrossField;
}

/** The capability-manifest feature id a cross-field-capable adapter advertises (#266 / #504). */
export const CROSS_FIELD_FEATURE = 'validation.feature.cross-field';

/** True when `adapter` advertises cross-field support (i.e. implements {@link CustomValidationAdapter.emitCrossField}). */
export function supportsCrossField(adapter: CustomValidationAdapter): boolean {
  return typeof adapter.emitCrossField === 'function';
}

/** The cross-field feature id when `adapter` supports it, else `null` — the manifest advertisement (absence is reportable). */
export function crossFieldFeatureFor(adapter: CustomValidationAdapter): typeof CROSS_FIELD_FEATURE | null {
  return supportsCrossField(adapter) ? CROSS_FIELD_FEATURE : null;
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
