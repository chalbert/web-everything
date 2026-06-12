/**
 * Guard protocol standalone model (#288/#289): the dependency-free `CustomGuardRegistry` + the
 * native-first default provider + the `assertGuardDecision` trust-boundary guard. The runtime plug
 * (`plugs/webguards/`) fulfils the same `define`/`resolve`/`evaluateRegion` surface as a core
 * `CustomRegistry`; this pins the contract the plug must not drift from.
 */
import { describe, it, expect } from 'vitest';
import {
  NativeGuardProvider,
  GuardDecisionError,
  assertGuardDecision,
  ALLOW,
  type CustomGuardProvider,
  type GuardDecision,
  type GuardRegion,
  type GuardEvent,
} from '../provider.js';
import { CustomGuardRegistry, UnknownGuardProviderError, createDefaultRegistry } from '../index.js';

const region: GuardRegion = { kind: 'route', id: '/admin' };

/** A deny-by-default provider for testing the non-permissive path. */
class DenyProvider implements CustomGuardProvider {
  readonly key = 'deny';
  async evaluate(): Promise<GuardDecision> {
    return { allow: false, reason: 'forbidden' };
  }
}

describe('CustomGuardRegistry (standalone model)', () => {
  it('has the customGuards localName', () => {
    expect(new CustomGuardRegistry().localName).toBe('customGuards');
  });

  it('define(provider) keys by provider.key and marks the first as default', () => {
    const registry = new CustomGuardRegistry();
    registry.define(new NativeGuardProvider());
    expect(registry.has('native')).toBe(true);
    expect(registry.defaultKey).toBe('native');
    expect(registry.resolve().key).toBe('native');
  });

  it('define(provider, asDefault=true) overrides the default even when not first', () => {
    const registry = new CustomGuardRegistry();
    registry.define(new NativeGuardProvider());
    registry.define(new DenyProvider(), true);
    expect(registry.defaultKey).toBe('deny');
    expect(registry.resolve().key).toBe('deny');
  });

  it('resolve(key) returns the named provider', () => {
    const registry = createDefaultRegistry();
    registry.define(new DenyProvider());
    expect(registry.resolve('native').key).toBe('native');
    expect(registry.resolve('deny').key).toBe('deny');
  });

  it('resolve throws UnknownGuardProviderError for an unregistered key (never silently allows)', () => {
    const registry = createDefaultRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownGuardProviderError);
  });

  it('resolve throws for the default when nothing is registered', () => {
    expect(() => new CustomGuardRegistry().resolve()).toThrow(UnknownGuardProviderError);
  });
});

describe('createDefaultRegistry', () => {
  it('is pre-loaded with the native-first default provider, permissive for both events', async () => {
    const registry = createDefaultRegistry();
    expect(registry.defaultKey).toBe('native');
    expect(await registry.evaluateRegion(region, 'enter')).toEqual(ALLOW);
    expect(await registry.evaluateRegion(region, 'leave')).toEqual(ALLOW);
  });
});

describe('evaluateRegion', () => {
  it('runs the resolved provider and returns its (validated) decision', async () => {
    const registry = createDefaultRegistry();
    registry.define(new DenyProvider());
    const decision = await registry.evaluateRegion(region, 'enter', { user: 'guest' }, 'deny');
    expect(decision).toEqual({ allow: false, reason: 'forbidden' });
  });

  it('passes a misbehaving provider answer through the trust-boundary guard and throws', async () => {
    const registry = new CustomGuardRegistry();
    registry.define({ key: 'rogue', evaluate: async () => ({}) as GuardDecision }, true);
    await expect(registry.evaluateRegion(region, 'enter')).rejects.toThrow(GuardDecisionError);
  });
});

describe('NativeGuardProvider', () => {
  it('is permissive — resolves ALLOW for every event/region', async () => {
    const native = new NativeGuardProvider();
    const events: GuardEvent[] = ['enter', 'leave'];
    for (const event of events) {
      expect(await native.evaluate(region, event)).toEqual(ALLOW);
    }
  });

  it('exposes no subscribe — nothing can revoke "allow"', () => {
    expect((new NativeGuardProvider() as CustomGuardProvider).subscribe).toBeUndefined();
  });
});

describe('assertGuardDecision (trust boundary)', () => {
  it('accepts a conformant decision and strips extra keys', () => {
    expect(assertGuardDecision('p', { allow: true, reason: 'ok', extra: 1 })).toEqual({ allow: true, reason: 'ok' });
    expect(assertGuardDecision('p', { allow: false })).toEqual({ allow: false });
  });

  it('rejects a non-object, a missing/non-boolean allow, and a non-string reason', () => {
    expect(() => assertGuardDecision('p', null)).toThrow(GuardDecisionError);
    expect(() => assertGuardDecision('p', { reason: 'x' })).toThrow(GuardDecisionError);
    expect(() => assertGuardDecision('p', { allow: 'yes' })).toThrow(GuardDecisionError);
    expect(() => assertGuardDecision('p', { allow: true, reason: 5 })).toThrow(GuardDecisionError);
  });
});
