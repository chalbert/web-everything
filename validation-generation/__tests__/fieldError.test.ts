/**
 * Validation field-error shape (#464). Pins the RFC 6901 JSON-Pointer check, the `ValidationFieldError`
 * contract guards, and that a field error rides inside an RFC 9457 problem document's `errors`
 * extension — the per-field shape RFC 9457 leaves undefined.
 */
import { describe, it, expect } from 'vitest';
import {
  isJsonPointer,
  fieldError,
  isValidationFieldError,
  assertValidationFieldError,
  ValidationFieldErrorContractError,
  PROBLEM_JSON_MEDIA_TYPE,
  type ValidationProblemDetails,
} from '../fieldError.js';

describe('isJsonPointer — RFC 6901', () => {
  it('accepts the empty pointer (whole document) and rooted tokens', () => {
    for (const p of ['', '/email', '/items/0/qty', '/a~1b', '/m~0n', '//']) expect(isJsonPointer(p)).toBe(true);
  });
  it('rejects a non-empty pointer with no leading slash and bad tilde escapes', () => {
    for (const p of ['email', '/~2', '/foo~', 'items/0']) expect(isJsonPointer(p)).toBe(false);
  });
  it('rejects non-strings', () => {
    expect(isJsonPointer(42)).toBe(false);
    expect(isJsonPointer(null)).toBe(false);
  });
});

describe('ValidationFieldError contract (#464)', () => {
  it('fieldError builds the pointer + rule + message shape', () => {
    expect(fieldError('/email', 'validation.intent.format', 'Not a valid email')).toEqual({
      pointer: '/email',
      rule: 'validation.intent.format',
      message: 'Not a valid email',
    });
  });

  it('isValidationFieldError accepts a well-formed error and rejects bad pointer / unknown rule / non-string message', () => {
    expect(isValidationFieldError(fieldError('/age', 'validation.intent.min', 'Too young'))).toBe(true);
    expect(isValidationFieldError({ pointer: 'age', rule: 'validation.intent.min', message: 'x' })).toBe(false); // bad pointer
    expect(isValidationFieldError({ pointer: '/age', rule: 'validation.intent.nope', message: 'x' })).toBe(false); // unknown rule
    expect(isValidationFieldError({ pointer: '/age', rule: 'validation.intent.min', message: 42 })).toBe(false); // non-string message
  });

  it('arbitrary rules ride on validation.intent.custom', () => {
    expect(isValidationFieldError(fieldError('/coupon', 'validation.intent.custom', 'Expired'))).toBe(true);
  });

  it('assertValidationFieldError throws a contract error naming the first breach', () => {
    expect(() => assertValidationFieldError({ pointer: 'nope', rule: 'validation.intent.min', message: 'x' }))
      .toThrow(ValidationFieldErrorContractError);
    expect(() => assertValidationFieldError({ pointer: '/x', rule: 'bogus', message: 'x' }))
      .toThrow(/known validation intent id/);
    expect(() => assertValidationFieldError(fieldError('/x', 'validation.intent.required', 'Required'))).not.toThrow();
  });
});

describe('ValidationProblemDetails — RFC 9457 envelope + errors extension', () => {
  it('the field errors live under the `errors` extension of a problem document', () => {
    const problem: ValidationProblemDetails = {
      type: 'https://webeverything.dev/problems/validation',
      title: 'Validation failed',
      status: 422,
      errors: [
        fieldError('/email', 'validation.intent.format', 'Not a valid email'),
        fieldError('/items/0/qty', 'validation.intent.min', 'Must be at least 1'),
      ],
    };
    expect(problem.errors.every(isValidationFieldError)).toBe(true);
    expect(PROBLEM_JSON_MEDIA_TYPE).toBe('application/problem+json');
  });
});
