/**
 * Unplugged-mode (non-invasive) test for webguards — #726 / #636 backfill (the #951 hand-off scope).
 *
 * Proves the runtime `customGuards` plug works as an opt-in library through plain instantiation, WITHOUT
 * any global patch — importing `webguards` installs nothing (the module only logs on load; the registry
 * is a plain `CustomRegistry` and providers are pure). The non-invasive proof: a `CustomGuardRegistry`
 * built standalone resolves the native-first default and evaluates a region, and two scoped registries
 * stay fully independent (no shared global state). The unplugged form is the mandatory real-app surface
 * (#606); this is the automated proof the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect } from 'vitest';
import CustomGuardRegistry, { createDefaultGuardRegistry } from '../../CustomGuardRegistry';
import {
  NativeGuardProvider,
  ALLOW,
  type CustomGuardProvider,
  type GuardDecision,
  type GuardRegion,
} from '../../../../guard/provider.js';

const region: GuardRegion = { kind: 'route', id: '/admin' };

class DenyProvider implements CustomGuardProvider {
  readonly key = 'deny';
  async evaluate(): Promise<GuardDecision> {
    return { allow: false, reason: 'forbidden' };
  }
}

describe('webguards — unplugged (non-invasive) mode', () => {
  it('defines and resolves a provider through a standalone registry instance (no global patch)', () => {
    const registry = new CustomGuardRegistry();
    registry.define(new NativeGuardProvider());
    expect(registry.has('native')).toBe(true);
    expect(registry.resolve().key).toBe('native');
  });

  it('runs as a plain library — the native-first default registry permits a region crossing', async () => {
    const registry = createDefaultGuardRegistry();
    expect(registry.defaultKey).toBe('native');
    const decision = await registry.evaluateRegion(region, 'enter');
    expect(decision).toEqual(ALLOW);
  });

  it('resolves a named provider and honours its decision through evaluateRegion', async () => {
    const registry = createDefaultGuardRegistry();
    registry.define(new DenyProvider());
    const decision = await registry.evaluateRegion(region, 'enter', undefined, 'deny');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('forbidden');
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryA = new CustomGuardRegistry();
    const registryB = new CustomGuardRegistry();
    registryA.define(new NativeGuardProvider());
    registryB.define(new DenyProvider());

    expect(registryA.resolve().key).toBe('native');
    expect(registryB.resolve().key).toBe('deny');
    expect(registryA.has('deny')).toBe(false);
    expect(registryB.has('native')).toBe(false);
  });
});
