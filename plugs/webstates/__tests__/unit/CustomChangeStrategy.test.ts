/**
 * Unit test for the change-tracking contract + native default strategy (#1105, webstates #1089).
 * Proves a CustomStore mutation yields a well-formed ChangeRecord through the native strategy, plus the
 * snapshot diff and the reversible applyInverse — all without any global patch.
 */
import { describe, it, expect } from 'vitest';
import CustomStore, { type StoreListener, type StoreUnsubscribe } from '../../CustomStore';
import {
  NativeChangeStrategy,
  nativeChangeStrategy,
  type ChangeRecord,
} from '../../CustomChangeStrategy';

interface ThemeState {
  [key: string]: unknown;
  theme: string;
}

class ThemeStore extends CustomStore<ThemeState> {
  state: ThemeState = { theme: 'light' };
  #listeners = new Set<StoreListener<ThemeState>>();

  subscribe(listener: StoreListener<ThemeState>): StoreUnsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  getItem<K extends keyof ThemeState>(key: K): ThemeState[K] {
    return this.state[key];
  }
  setItem<K extends keyof ThemeState>(key: K, value: ThemeState[K]): void {
    this.state[key] = value;
    this.#listeners.forEach((l) => l(this.state));
  }
  getState(): ThemeState {
    return this.state;
  }
}

// Deterministic clock so the record timestamp is assertable.
const strat = new NativeChangeStrategy(() => 1000);

describe('NativeChangeStrategy (native-first change tracking)', () => {
  it('is registered under a stable key', () => {
    expect(nativeChangeStrategy.key).toBe('native-signals');
  });

  it('a CustomStore.setItem yields a well-formed ChangeRecord (replace)', () => {
    const store = new ThemeStore();
    const records: ChangeRecord[] = [];
    const handle = strat.track(store, (r) => records.push(r));

    store.setItem('theme', 'dark');

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      path: '/theme',
      op: 'replace',
      oldValue: 'light',
      newValue: 'dark',
      source: { channel: 'program' },
      timestamp: 1000,
    });
    handle.dispose();
  });

  it('emits an add for a brand-new key and a remove when a key is deleted', () => {
    const add = strat.diff({}, { theme: 'dark' });
    expect(add).toEqual([{ path: '/theme', op: 'add', newValue: 'dark', source: { channel: 'program' }, timestamp: 1000 }]);
    const remove = strat.diff({ theme: 'dark' }, {});
    expect(remove[0]).toMatchObject({ path: '/theme', op: 'remove', oldValue: 'dark' });
  });

  it('dispose() stops the stream — a later mutation emits nothing', () => {
    const store = new ThemeStore();
    const records: ChangeRecord[] = [];
    const handle = strat.track(store, (r) => records.push(r));
    handle.dispose();
    store.setItem('theme', 'dark');
    expect(records).toHaveLength(0);
  });

  it('applyInverse restores the prior value (reversible)', () => {
    const store = new ThemeStore();
    const record: ChangeRecord = {
      path: '/theme', op: 'replace', oldValue: 'light', newValue: 'dark',
      source: { channel: 'program' }, timestamp: 1000,
    };
    store.setItem('theme', 'dark');
    strat.applyInverse(store, [record]);
    expect(store.getItem('theme')).toBe('light');
  });
});
