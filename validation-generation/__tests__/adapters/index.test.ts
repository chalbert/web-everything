/**
 * The shipped-adapters barrel (#085 B–E) + `createDefaultValidationAdapterRegistry()` — proves all four
 * emitters register, native-HTML is the native-first default, and the registry's `adaptersFor(intent)`
 * discovery spans them.
 */
import { describe, it, expect } from 'vitest';
import {
  SHIPPED_VALIDATION_ADAPTERS,
  createDefaultValidationAdapterRegistry,
} from '../../adapters/index.js';

describe('createDefaultValidationAdapterRegistry', () => {
  it('registers every shipped adapter with native-HTML as the native-first default', () => {
    const registry = createDefaultValidationAdapterRegistry();
    expect(registry.keys()).toEqual(['native-html', 'zod', 'pydantic', 'json-schema']);
    expect(registry.defaultKey).toBe('native-html');
    expect(registry.resolve().key).toBe('native-html');
  });

  it('every shipped adapter has a unique key and at least one supported intent', () => {
    const keys = SHIPPED_VALIDATION_ADAPTERS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const adapter of SHIPPED_VALIDATION_ADAPTERS) expect(adapter.intents.length).toBeGreaterThan(0);
  });

  it('adaptersFor surfaces which emitters comply with a given intent', () => {
    const registry = createDefaultValidationAdapterRegistry();
    // Only Zod declares the arbitrary-predicate escape hatch.
    expect(registry.adaptersFor('validation.intent.custom').map((a) => a.key)).toEqual(['zod']);
    // Every adapter handles required.
    expect(registry.adaptersFor('validation.intent.required').map((a) => a.key)).toEqual([
      'native-html',
      'zod',
      'pydantic',
      'json-schema',
    ]);
  });
});
