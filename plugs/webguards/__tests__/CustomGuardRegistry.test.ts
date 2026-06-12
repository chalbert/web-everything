/**
 * Runtime `customGuards` registry (#289): the live plug fulfils the same
 * `define`/`resolve`/`evaluateRegion` surface as the standalone `guard/` model (#288), but as a core
 * `CustomRegistry` so it is injector-chain-resolvable and inheritable via `extends` — the guard-protocol
 * sibling of #224's validator-resolution registry and #215's merge registry.
 */
import { describe, it, expect } from 'vitest';
import CustomGuardRegistry, { createDefaultGuardRegistry } from '../CustomGuardRegistry';
import {
  NativeGuardProvider,
  GuardDecisionError,
  ALLOW,
  type CustomGuardProvider,
  type GuardDecision,
  type GuardRegion,
} from '../../../guard/provider.js';
import { UnknownGuardProviderError } from '../../../guard/registry.js';

const region: GuardRegion = { kind: 'route', id: '/admin' };

class DenyProvider implements CustomGuardProvider {
  readonly key = 'deny';
  async evaluate(): Promise<GuardDecision> {
    return { allow: false, reason: 'forbidden' };
  }
}

describe('CustomGuardRegistry (runtime plug)', () => {
  it('is a core CustomRegistry with the customGuards localName', () => {
    const registry = new CustomGuardRegistry();
    expect(registry.localName).toBe('customGuards');
    expect(typeof registry.has).toBe('function');
    expect(typeof registry.keys).toBe('function');
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

  it('resolve throws UnknownGuardProviderError for an unregistered key', () => {
    const registry = createDefaultGuardRegistry();
    expect(() => registry.resolve('nope')).toThrow(UnknownGuardProviderError);
  });

  it('participates in the injector chain — a child resolves a parent-registered provider via extends', () => {
    const root = createDefaultGuardRegistry();
    root.define(new DenyProvider());
    const child = new CustomGuardRegistry({ extends: [root] });
    expect(child.has('native')).toBe(true);
    expect(child.has('deny')).toBe(true);
  });
});

describe('createDefaultGuardRegistry', () => {
  it('is pre-loaded with the native-first default provider, permissive for both events', async () => {
    const registry = createDefaultGuardRegistry();
    expect(registry.defaultKey).toBe('native');
    expect(await registry.evaluateRegion(region, 'enter')).toEqual(ALLOW);
    expect(await registry.evaluateRegion(region, 'leave')).toEqual(ALLOW);
  });
});

describe('evaluateRegion (runtime plug)', () => {
  it('runs the resolved provider and returns its decision', async () => {
    const registry = createDefaultGuardRegistry();
    registry.define(new DenyProvider());
    expect(await registry.evaluateRegion(region, 'enter', undefined, 'deny')).toEqual({
      allow: false,
      reason: 'forbidden',
    });
  });

  it('catches a misbehaving provider at the trust boundary', async () => {
    const registry = new CustomGuardRegistry();
    registry.define({ key: 'rogue', evaluate: async () => ({}) as GuardDecision }, true);
    await expect(registry.evaluateRegion(region, 'enter')).rejects.toThrow(GuardDecisionError);
  });
});
