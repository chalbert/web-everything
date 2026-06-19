/**
 * Unplugged-mode (non-invasive) test for the webstates STRATEGY protocols — #1109.
 *
 * Mirror of `webstates.unplugged.test.ts` (which proves CustomStore + CustomStoreRegistry), extended to
 * the two strategy registries the completion epic added: CustomChangeStrategyRegistry (#1107) and
 * CustomStorageStrategyRegistry (#1108). Proves both registries work as opt-in libraries through plain
 * instantiation, WITHOUT any global patch — webstates installs none (the native strategies just subscribe
 * to / wrap the platform APIs they are handed). The non-invasive proof is the same shape as the store
 * test: two scoped registries stay fully independent, and the native-first baseline works standalone with
 * zero configuration. This is the automated proof the strategy protocols do not REQUIRE plugged mode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import CustomChangeStrategyRegistry, {
  createDefaultChangeStrategyRegistry,
} from '../../CustomChangeStrategyRegistry';
import {
  nativeChangeStrategy,
  type ChangeRecord,
  type CustomChangeStrategy,
} from '../../CustomChangeStrategy';
import CustomStorageStrategyRegistry from '../../CustomStorageStrategyRegistry';
import { LocalStorageStrategy } from '../../CustomStorageStrategy';

// ── An in-memory Storage so the storage test is hermetic (no shared global localStorage). ──────────────
class MemoryStorage implements Storage {
  #map = new Map<string, string>();
  get length(): number {
    return this.#map.size;
  }
  clear(): void {
    this.#map.clear();
  }
  getItem(key: string): string | null {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, String(value));
  }
}

/** A minimal store-like target the native change strategy can track (duck-typed StoreLike). */
function makeStore(initial: Record<string, unknown> = {}) {
  let state = { ...initial };
  const listeners = new Set<(s: Record<string, unknown>) => void>();
  return {
    getState: () => state,
    setItem(key: string, value: unknown) {
      state = { ...state, [key]: value };
      listeners.forEach((l) => l(state));
    },
    subscribe(listener: (s: Record<string, unknown>) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('webstates change-strategy protocol — unplugged (non-invasive) mode', () => {
  let registry: CustomChangeStrategyRegistry;
  beforeEach(() => {
    registry = new CustomChangeStrategyRegistry();
  });

  it('defines and resolves a strategy through a scoped registry instance', () => {
    registry.define(nativeChangeStrategy, true);
    expect(registry.has('native-signals')).toBe(true);
    expect(registry.get('native-signals')).toBe(nativeChangeStrategy);
    expect(registry.activeKey).toBe('native-signals');
    expect(registry.active()).toBe(nativeChangeStrategy);
  });

  it('runs the native-first strategy as a plain library — observe() emits a ChangeRecord per change', () => {
    registry.define(nativeChangeStrategy, true);
    const store = makeStore({ count: 0 });
    const seen: ChangeRecord[] = [];
    const handle = registry.observe(store, (record) => seen.push(record));

    store.setItem('count', 1);
    store.setItem('count', 2);

    expect(seen.map((r) => r.newValue)).toEqual([1, 2]);
    expect(seen.every((r) => r.op === 'replace' && r.path === '/count')).toBe(true);

    handle.dispose();
    store.setItem('count', 3);
    expect(seen).toHaveLength(2); // no further records after dispose
  });

  it('falls back to the native-first baseline when no strategy is registered (zero-config)', () => {
    expect(registry.active()).toBe(nativeChangeStrategy); // baseline without any define()
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryB = new CustomChangeStrategyRegistry();
    const strategyA: CustomChangeStrategy = { key: 'only-a', track: () => ({ dispose() {} }) };
    const strategyB: CustomChangeStrategy = { key: 'only-b', track: () => ({ dispose() {} }) };
    registry.define(strategyA);
    registryB.define(strategyB);

    expect(registry.has('only-a')).toBe(true);
    expect(registry.has('only-b')).toBe(false);
    expect(registryB.has('only-b')).toBe(true);
    expect(registryB.has('only-a')).toBe(false);
  });

  it('resolves the nearest-scope active strategy up the extends chain', () => {
    const parent = createDefaultChangeStrategyRegistry(); // native active
    const custom: CustomChangeStrategy = { key: 'snapshot-diff', track: () => ({ dispose() {} }) };
    const child = new CustomChangeStrategyRegistry({ extends: [parent] });

    expect(child.active()).toBe(nativeChangeStrategy); // inherits parent's active
    child.define(custom, true);
    expect(child.active()).toBe(custom); // own selection wins
    expect(parent.active()).toBe(nativeChangeStrategy); // parent unaffected
  });
});

describe('webstates storage-strategy protocol — unplugged (non-invasive) mode', () => {
  let registry: CustomStorageStrategyRegistry<unknown>;
  beforeEach(() => {
    registry = new CustomStorageStrategyRegistry();
  });

  it('defines and resolves a strategy through a scoped registry instance', () => {
    const strategy = new LocalStorageStrategy('webstates', new MemoryStorage());
    registry.define(strategy, true);
    expect(registry.has('local-storage')).toBe(true);
    expect(registry.get('local-storage')).toBe(strategy);
    expect(registry.active()).toBe(strategy);
  });

  it('runs a strategy as a plain library through the degrading CRUD surface — set/get/keys/delete', async () => {
    registry.define(new LocalStorageStrategy('webstates', new MemoryStorage()), true);

    await registry.persist('todos', 'a', { title: 'first' });
    await registry.persist('todos', 'b', { title: 'second' });
    expect(await registry.read('todos', 'a')).toEqual({ title: 'first' });
    expect((await registry.listKeys('todos')).sort()).toEqual(['a', 'b']);

    await registry.remove('todos', 'a');
    expect(await registry.read('todos', 'a')).toBeUndefined();
    expect(await registry.listKeys('todos')).toEqual(['b']);
  });

  it('degrades to the next strategy in the chain when the active engine throws', async () => {
    const failing = {
      key: 'flaky',
      get: async () => {
        throw new Error('engine unavailable');
      },
      set: async () => {
        throw new Error('engine unavailable');
      },
      delete: async () => {
        throw new Error('engine unavailable');
      },
      keys: async () => {
        throw new Error('engine unavailable');
      },
    };
    const floor = new LocalStorageStrategy('webstates', new MemoryStorage());
    registry.define(failing, true); // active, throws
    registry.define(floor); // degradation floor

    await registry.persist('settings', 'theme', 'dark'); // transparently lands on the floor
    expect(await registry.read('settings', 'theme')).toBe('dark');
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryB = new CustomStorageStrategyRegistry();
    registry.define({ ...stubStrategy(), key: 'only-a' });
    registryB.define({ ...stubStrategy(), key: 'only-b' });

    expect(registry.has('only-a')).toBe(true);
    expect(registry.has('only-b')).toBe(false);
    expect(registryB.has('only-b')).toBe(true);
    expect(registryB.has('only-a')).toBe(false);
  });

  it('resolves the nearest-scope active strategy up the extends chain', () => {
    const parent = new CustomStorageStrategyRegistry();
    const parentStrategy = new LocalStorageStrategy('parent', new MemoryStorage());
    parent.define(parentStrategy, true);
    const child = new CustomStorageStrategyRegistry({ extends: [parent] });

    expect(child.active()).toBe(parentStrategy); // inherits parent's active
    const childStrategy = new LocalStorageStrategy('child', new MemoryStorage());
    child.define(childStrategy, true);
    expect(child.active()).toBe(childStrategy); // own selection wins
    expect(parent.active()).toBe(parentStrategy); // parent unaffected
  });
});

/** A no-op storage strategy stub for the registry-independence test. */
function stubStrategy() {
  return {
    key: 'stub',
    get: async () => undefined,
    set: async () => {},
    delete: async () => {},
    keys: async () => [],
  };
}
