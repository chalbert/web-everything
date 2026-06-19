/**
 * Unit test for CustomStorageStrategyRegistry — #1108 (webstates completion #1089).
 *
 * Proves per-scope storage selection + the built-in IndexedDB → localStorage degradation: the default
 * registry degrades to localStorage when IndexedDB is absent (happy-dom has no IndexedDB), an operation
 * that throws on the active engine transparently falls to the next, and nearest-scope selection works.
 */
import { describe, it, expect } from 'vitest';
import CustomStorageStrategyRegistry, {
  createDefaultStorageStrategyRegistry,
} from '../../CustomStorageStrategyRegistry';
import { LocalStorageStrategy, type CustomStorageStrategy } from '../../CustomStorageStrategy';

/** A strategy whose every operation rejects — stands in for an IndexedDB engine that fails at runtime. */
function failingStrategy(key = 'native-indexeddb'): CustomStorageStrategy {
  const boom = () => Promise.reject(new Error(`${key} unavailable`));
  return { key, get: boom, set: boom, delete: boom, keys: boom };
}

describe('CustomStorageStrategyRegistry', () => {
  it('createDefault degrades to localStorage when IndexedDB is absent (happy-dom)', () => {
    // happy-dom provides Web Storage but not IndexedDB — the floor becomes the active engine.
    const registry = createDefaultStorageStrategyRegistry();
    expect(typeof indexedDB).toBe('undefined');
    expect(registry.active().key).toBe('local-storage');
  });

  it('degrades an operation IndexedDB → localStorage transparently when the active engine throws', async () => {
    const registry = new CustomStorageStrategyRegistry<{ n: number }>();
    registry.define(failingStrategy('native-indexeddb') as CustomStorageStrategy<{ n: number }>, true);
    const floor = new LocalStorageStrategy<{ n: number }>('webstates-degrade-test');
    registry.define(floor);

    // active is the failing IndexedDB engine; persist() falls through to localStorage.
    expect(registry.active().key).toBe('native-indexeddb');
    await registry.persist('settings', 'theme', { n: 7 });

    // The value landed in the localStorage floor — read it back both ways.
    expect(await floor.get('settings', 'theme')).toEqual({ n: 7 });
    expect(await registry.read('settings', 'theme')).toEqual({ n: 7 });
    expect(await registry.listKeys('settings')).toEqual(['theme']);
  });

  it('rethrows when every strategy in the chain fails', async () => {
    const registry = new CustomStorageStrategyRegistry();
    registry.define(failingStrategy('a'), true);
    registry.define(failingStrategy('b'));
    await expect(registry.persist('s', 'i', 1)).rejects.toThrow(/unavailable/);
  });

  it('registry map API (get/keys) still manages REGISTRATION, not data', () => {
    const registry = new CustomStorageStrategyRegistry();
    const floor = new LocalStorageStrategy();
    registry.define(floor, true);
    expect(registry.get('local-storage')).toBe(floor); // one-arg get = registry lookup
    expect([...registry.keys()]).toContain('local-storage');
  });

  it('nearest-scope wins: a child inherits the parent engine, then overrides it', () => {
    const parent = new CustomStorageStrategyRegistry();
    const parentFloor = new LocalStorageStrategy();
    parent.define(parentFloor, true);

    const child = new CustomStorageStrategyRegistry({ extends: [parent] });
    expect(child.active()).toBe(parentFloor); // inherited

    const childEngine = failingStrategy('rxdb');
    child.define(childEngine, true);
    expect(child.active()).toBe(childEngine); // own selection wins
    expect(parent.active()).toBe(parentFloor); // parent unaffected
  });

  it('throws only when no strategy is registered anywhere', () => {
    expect(() => new CustomStorageStrategyRegistry().active()).toThrow(/no storage strategy/);
  });
});
