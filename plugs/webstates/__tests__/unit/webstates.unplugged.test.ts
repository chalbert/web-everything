/**
 * Unplugged-mode (non-invasive) test for webstates — #637 / #636 backfill.
 *
 * Proves the CustomStore + CustomStoreRegistry work as an opt-in library through plain instantiation,
 * WITHOUT any global patch — webstates installs none (stores are pure, registry `upgrade()` is a no-op),
 * so the non-invasive proof is that two scoped registries stay fully independent and a store works
 * standalone. The unplugged form is the mandatory real-app surface (#606); this is the automated proof
 * the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import CustomStoreRegistry from '../../CustomStoreRegistry';
import CustomStore, { type StoreListener, type StoreUnsubscribe } from '../../CustomStore';

interface CounterState {
  count: number;
}

class CounterStore extends CustomStore<CounterState> {
  state: CounterState = { count: 0 };
  #listeners = new Set<StoreListener<CounterState>>();
  subscribe(listener: StoreListener<CounterState>): StoreUnsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  getItem<K extends keyof CounterState>(key: K): CounterState[K] {
    return this.state[key];
  }
  setItem<K extends keyof CounterState>(key: K, value: CounterState[K]): void {
    this.state[key] = value;
    this.#listeners.forEach((l) => l(this.state));
  }
}

describe('webstates — unplugged (non-invasive) mode', () => {
  let registry: CustomStoreRegistry;
  beforeEach(() => {
    registry = new CustomStoreRegistry();
  });

  it('defines and resolves a store constructor through a scoped registry instance', () => {
    registry.define('counter', CounterStore);
    expect(registry.has('counter')).toBe(true);
    expect(registry.get('counter')).toBe(CounterStore);
  });

  it('runs a store as a plain library — state, get/set, and subscribe notifications', () => {
    const store = new CounterStore();
    const seen: number[] = [];
    const unsubscribe = store.subscribe((s) => seen.push(s.count));

    store.setItem('count', 1);
    store.setItem('count', 2);
    expect(store.getItem('count')).toBe(2);
    expect(seen).toEqual([1, 2]);

    unsubscribe();
    store.setItem('count', 3);
    expect(seen).toEqual([1, 2]); // no further notifications after unsubscribe
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryB = new CustomStoreRegistry();
    registry.define('only-a', CounterStore);
    registryB.define('only-b', CounterStore);

    expect(registry.has('only-a')).toBe(true);
    expect(registry.has('only-b')).toBe(false);
    expect(registryB.has('only-b')).toBe(true);
    expect(registryB.has('only-a')).toBe(false);
  });
});
