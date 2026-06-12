/**
 * Validation-generation vocabulary + adapter contract (#304, slice #085-A). Pins the neutral intent
 * enumeration, the `since` table, and the `CustomValidationAdapter` contract guards — the shape the
 * per-language adapter slices (#305–#308) and the Mode-2 service (#309) build against.
 */
import { describe, it, expect } from 'vitest';
import {
  VALIDATION_GENERATION_SPEC_VERSION,
  VALIDATION_INTENTS,
  VALIDATION_INTENT_SINCE,
  isValidationIntentId,
  unsupportedIntents,
  isValidationAdapter,
  assertValidationAdapter,
  ValidationAdapterContractError,
  type CustomValidationAdapter,
  type ValidationDeclaration,
} from '../provider.js';

/** A minimal in-test adapter — the foundation ships none (those are #305–#308), so tests fake one. */
function fakeAdapter(overrides: Partial<CustomValidationAdapter> = {}): CustomValidationAdapter {
  return {
    key: 'fake',
    format: 'Fake',
    language: 'json',
    intents: ['validation.intent.required', 'validation.intent.min-length'],
    emit: (decl) => ({
      format: 'Fake',
      language: 'json',
      code: JSON.stringify(decl),
      unsupported: unsupportedIntents(fakeAdapter(overrides), decl),
    }),
    ...overrides,
  };
}

describe('validation-generation vocabulary', () => {
  it('the intent enumeration is the closed vocabulary and every id is dot-pathed', () => {
    expect(VALIDATION_INTENTS.length).toBeGreaterThan(0);
    for (const id of VALIDATION_INTENTS) expect(id).toMatch(/^validation\.intent\./);
  });

  it('VALIDATION_INTENT_SINCE has one entry per intent, all at the current spec version', () => {
    expect(Object.keys(VALIDATION_INTENT_SINCE).sort()).toEqual([...VALIDATION_INTENTS].sort());
    for (const id of VALIDATION_INTENTS) expect(VALIDATION_INTENT_SINCE[id]).toBe(VALIDATION_GENERATION_SPEC_VERSION);
  });

  it('isValidationIntentId accepts members and rejects non-members', () => {
    expect(isValidationIntentId('validation.intent.required')).toBe(true);
    expect(isValidationIntentId('validation.intent.unknown')).toBe(false);
    expect(isValidationIntentId(42)).toBe(false);
  });
});

describe('unsupportedIntents', () => {
  it('returns the declared intents the adapter does not comply with (deduped)', () => {
    const adapter = fakeAdapter({ intents: ['validation.intent.required'] });
    const decl: ValidationDeclaration = {
      field: 'name',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.pattern', value: '\\d+' },
        { intent: 'validation.intent.pattern', value: '\\w+' },
      ],
    };
    expect(unsupportedIntents(adapter, decl)).toEqual(['validation.intent.pattern']);
  });

  it('is empty when every declared intent is supported', () => {
    const adapter = fakeAdapter({ intents: ['validation.intent.required'] });
    const decl: ValidationDeclaration = { field: 'name', constraints: [{ intent: 'validation.intent.required' }] };
    expect(unsupportedIntents(adapter, decl)).toEqual([]);
  });
});

describe('adapter contract guards', () => {
  it('isValidationAdapter accepts a well-formed adapter', () => {
    expect(isValidationAdapter(fakeAdapter())).toBe(true);
  });

  it('isValidationAdapter rejects malformed values', () => {
    expect(isValidationAdapter(null)).toBe(false);
    expect(isValidationAdapter({ key: '', format: 'x', intents: [], emit: () => {} })).toBe(false);
    expect(isValidationAdapter({ key: 'k', format: 'x', intents: ['nope'], emit: () => {} })).toBe(false);
    expect(isValidationAdapter({ key: 'k', format: 'x', intents: [] })).toBe(false); // no emit
  });

  it('assertValidationAdapter throws a ValidationAdapterContractError naming the breach', () => {
    expect(() => assertValidationAdapter({ key: 'k', format: 'x', intents: ['nope'], emit: () => {} }))
      .toThrowError(ValidationAdapterContractError);
    expect(() => assertValidationAdapter({ format: 'x', intents: [], emit: () => {} }))
      .toThrowError(/non-empty "key"/);
    expect(() => assertValidationAdapter(fakeAdapter())).not.toThrow();
  });
});
