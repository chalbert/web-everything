/**
 * Validation **field-error shape** (#464, building on the #304 generation plane). RFC 9457
 * (`application/problem+json`) standardizes the error *envelope* — `type` / `title` / `status` /
 * `detail` / `instance` — but deliberately leaves the **field-level** error shape undefined, delegating
 * it to "extension members." The #085 Mode-2 service already emits RFC 9457 envelopes with an ad-hoc
 * per-field shape; this module claims that gap for the Web Validation vocabulary so every adapter can
 * emit and every consumer can parse field errors uniformly.
 *
 * A field error is the **output** counterpart of the {@link ./provider.ValidationConstraint} input: a
 * constraint declares *what must hold*; a field error reports *which field broke which rule, and why*.
 * Three parts, no more:
 *   1. `pointer` — an RFC 6901 **JSON-Pointer** to the offending field (`/email`, `/items/0/qty`),
 *      so the error addresses a node in the same document the value came from (envelope-agnostic);
 *   2. `rule` — the {@link ./provider.ValidationIntentId} whose constraint failed, linking the error
 *      back to the neutral constraint vocabulary (arbitrary rules use `validation.intent.custom`);
 *   3. `message` — the human-readable explanation.
 *
 * This is a **data contract, not a constraint intent** — it is intentionally *not* a member of
 * {@link ./provider.VALIDATION_INTENTS} (that enumerates what can be constrained; this is the failure
 * shape). It lives beside the generation vocabulary as the same kind of dependency-free TS model, and
 * is re-exported from the `webvalidation` plug alongside it.
 */

import { type ValidationIntentId, isValidationIntentId } from './provider.js';

/**
 * RFC 6901 JSON-Pointer: the empty string (the whole document) or one-or-more `/`-prefixed
 * reference-tokens, where every `~` is escaped as `~0` (literal `~`) or `~1` (literal `/`). An
 * unescaped `~`, or a non-empty pointer without a leading `/`, is invalid.
 */
const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)*$/;

/** True when `s` is a syntactically valid RFC 6901 JSON-Pointer. */
export function isJsonPointer(s: unknown): s is string {
  return typeof s === 'string' && JSON_POINTER.test(s);
}

/**
 * A single per-field validation error — the field-level shape RFC 9457 leaves undefined. `rule` ties
 * the failure to the constraint vocabulary; `pointer` addresses the field in its source document.
 */
export interface ValidationFieldError {
  /** RFC 6901 JSON-Pointer to the offending field, e.g. `/email` or `/items/0/qty`. */
  readonly pointer: string;
  /** The validation intent whose constraint failed (`validation.intent.custom` for arbitrary rules). */
  readonly rule: ValidationIntentId;
  /** Human-readable message for this field error. */
  readonly message: string;
}

/**
 * An RFC 9457 `application/problem+json` problem document carrying the WE field-error extension. The
 * envelope members are the RFC 9457 core (all optional per the spec — a bare `{}` is a valid problem);
 * `errors` is the field-level extension this module standardizes. Consumers that only know RFC 9457
 * ignore `errors` harmlessly; WE-aware consumers read it for per-field reporting.
 */
export interface ValidationProblemDetails {
  /** A URI reference identifying the problem type (RFC 9457 §3.1.1). */
  readonly type?: string;
  /** A short, human-readable summary of the problem type (§3.1.2). */
  readonly title?: string;
  /** The HTTP status code (§3.1.3). */
  readonly status?: number;
  /** A human-readable explanation specific to this occurrence (§3.1.4). */
  readonly detail?: string;
  /** A URI reference identifying the specific occurrence (§3.1.5). */
  readonly instance?: string;
  /** The field-level extension (#464): per-field errors. */
  readonly errors: readonly ValidationFieldError[];
}

/** The `application/problem+json` media type RFC 9457 mandates for the envelope. */
export const PROBLEM_JSON_MEDIA_TYPE = 'application/problem+json';

/** Construct a {@link ValidationFieldError} (a tiny ergonomic helper; the shape is the contract). */
export function fieldError(pointer: string, rule: ValidationIntentId, message: string): ValidationFieldError {
  return { pointer, rule, message };
}

/** Structural + semantic check: a valid JSON-Pointer `pointer`, a known-intent `rule`, a string `message`. */
export function isValidationFieldError(value: unknown): value is ValidationFieldError {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Partial<ValidationFieldError>;
  return isJsonPointer(e.pointer) && isValidationIntentId(e.rule) && typeof e.message === 'string';
}

/** Thrown by {@link assertValidationFieldError} when a value does not satisfy the field-error contract. */
export class ValidationFieldErrorContractError extends Error {
  constructor(reason: string) {
    super(`Invalid ValidationFieldError — ${reason}`);
    this.name = 'ValidationFieldErrorContractError';
  }
}

/** Assert the field-error contract, throwing {@link ValidationFieldErrorContractError} on the first breach. */
export function assertValidationFieldError(value: unknown): asserts value is ValidationFieldError {
  if (typeof value !== 'object' || value === null) throw new ValidationFieldErrorContractError('not an object');
  const e = value as Partial<ValidationFieldError>;
  if (!isJsonPointer(e.pointer))
    throw new ValidationFieldErrorContractError(`"pointer" must be an RFC 6901 JSON-Pointer, got ${JSON.stringify(e.pointer)}`);
  if (!isValidationIntentId(e.rule))
    throw new ValidationFieldErrorContractError(`"rule" must be a known validation intent id, got ${JSON.stringify(e.rule)}`);
  if (typeof e.message !== 'string') throw new ValidationFieldErrorContractError('"message" must be a string');
}
