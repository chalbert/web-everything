/**
 * The standalone `customValidationAdapter` registry (#304, slice #085-A) — `define`/`resolve` surface,
 * native-first-by-convention default, `adaptersFor(intent)` discovery, and the contract-check at
 * registration. Mirrors the validity-merge registry tests (#212).
 */
import { describe, it, expect } from 'vitest';
import {
  CustomValidationAdapterRegistry,
  UnknownValidationAdapterError,
  createValidationAdapterRegistry,
} from '../registry.js';
import {
  unsupportedIntents,
  type CustomValidationAdapter,
  type ValidationIntentId,
} from '../provider.js';

function adapter(key: string, intents: ValidationIntentId[]): CustomValidationAdapter {
  return {
    key,
    format: key,
    intents,
    emit: (decl) => ({ format: key, code: '', unsupported: unsupportedIntents(adapter(key, intents), decl) }),
  };
}

describe('CustomValidationAdapterRegistry', () => {
  it('carries the customValidationAdapter localName and starts empty', () => {
    const registry = new CustomValidationAdapterRegistry();
    expect(registry.localName).toBe('customValidationAdapter');
    expect(registry.keys()).toEqual([]);
    expect(registry.defaultKey).toBeNull();
  });

  it('define(adapter) keys by the adapter.key and marks the first registered as default', () => {
    const registry = new CustomValidationAdapterRegistry();
    registry.define(adapter('native-html', ['validation.intent.required']));
    registry.define(adapter('zod', ['validation.intent.required', 'validation.intent.pattern']));
    expect(registry.has('native-html')).toBe(true);
    expect(registry.keys()).toEqual(['native-html', 'zod']);
    expect(registry.defaultKey).toBe('native-html');
  });

  it('asDefault overrides which adapter resolve() returns with no argument', () => {
    const registry = new CustomValidationAdapterRegistry();
    registry.define(adapter('native-html', ['validation.intent.required']));
    registry.define(adapter('zod', ['validation.intent.pattern']), true);
    expect(registry.defaultKey).toBe('zod');
    expect(registry.resolve().key).toBe('zod');
  });

  it('resolve(key) returns the named adapter; resolve() returns the default', () => {
    const registry = new CustomValidationAdapterRegistry();
    registry.define(adapter('native-html', ['validation.intent.required']));
    expect(registry.resolve('native-html').key).toBe('native-html');
    expect(registry.resolve().key).toBe('native-html');
  });

  it('resolve throws UnknownValidationAdapterError for an absent key or an empty registry', () => {
    const registry = new CustomValidationAdapterRegistry();
    expect(() => registry.resolve()).toThrowError(UnknownValidationAdapterError);
    registry.define(adapter('native-html', ['validation.intent.required']));
    expect(() => registry.resolve('zod')).toThrowError(/Unknown validation adapter "zod"/);
  });

  it('rejects a malformed adapter at registration (contract-checked on the way in)', () => {
    const registry = new CustomValidationAdapterRegistry();
    // @ts-expect-error — intentionally malformed: unknown intent id.
    expect(() => registry.define({ key: 'bad', format: 'Bad', intents: ['nope'], emit: () => ({}) })).toThrow();
    expect(registry.keys()).toEqual([]);
  });

  it('adaptersFor(intent) returns every adapter that declares compliance, in registration order', () => {
    const registry = new CustomValidationAdapterRegistry();
    registry.define(adapter('native-html', ['validation.intent.required', 'validation.intent.pattern']));
    registry.define(adapter('zod', ['validation.intent.pattern']));
    registry.define(adapter('pydantic', ['validation.intent.required']));
    expect(registry.adaptersFor('validation.intent.pattern').map((a) => a.key)).toEqual(['native-html', 'zod']);
    expect(registry.adaptersFor('validation.intent.required').map((a) => a.key)).toEqual(['native-html', 'pydantic']);
    expect(registry.adaptersFor('validation.intent.custom')).toEqual([]);
  });

  it('createValidationAdapterRegistry() returns an empty registry (the foundation ships no adapter)', () => {
    expect(createValidationAdapterRegistry().keys()).toEqual([]);
  });
});
