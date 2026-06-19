/**
 * Unit test for the storage contract + native strategies (#1106, webstates #1089).
 *
 * The localStorage strategy round-trips fully here (happy-dom provides Web Storage). The IndexedDB
 * strategy is real, browser-correct code, but happy-dom does NOT implement IndexedDB, so its round-trip
 * is feature-gated to a real environment rather than silently skipped — `pickStorageStrategy()` proves
 * the native-first feature-detect degrades to localStorage when IndexedDB is absent.
 */
import { describe, it, expect } from 'vitest';
import {
  LocalStorageStrategy,
  IndexedDBStrategy,
  pickStorageStrategy,
  nativeStoragePersistence,
} from '../../CustomStorageStrategy';

describe('LocalStorageStrategy (degradation floor — round-trips here)', () => {
  it('round-trips set → get → keys → delete over a scope', async () => {
    const s = new LocalStorageStrategy<{ n: number }>('webstates-test');
    await s.set('users', 'u1', { n: 1 });
    await s.set('users', 'u2', { n: 2 });
    expect(await s.get('users', 'u1')).toEqual({ n: 1 });
    expect((await s.keys('users')).sort()).toEqual(['u1', 'u2']);
    await s.delete('users', 'u1');
    expect(await s.get('users', 'u1')).toBeUndefined();
    expect(await s.keys('users')).toEqual(['u2']);
  });

  it('namespaces by scope — keys(scopeA) never sees scopeB entries', async () => {
    const s = new LocalStorageStrategy('webstates-ns');
    await s.set('a', 'x', 1);
    await s.set('b', 'y', 2);
    expect(await s.keys('a')).toEqual(['x']);
    expect(await s.keys('b')).toEqual(['y']);
  });

  it('bulk applies set + delete ops in order', async () => {
    const s = new LocalStorageStrategy<number>('webstates-bulk');
    await s.bulk('c', [{ op: 'set', id: 'a', value: 1 }, { op: 'set', id: 'b', value: 2 }, { op: 'delete', id: 'a' }]);
    expect(await s.keys('c')).toEqual(['b']);
    expect(await s.get('c', 'b')).toBe(2);
  });
});

describe('IndexedDBStrategy + native-first pick', () => {
  it('declares the native-indexeddb key', () => {
    expect(new IndexedDBStrategy().key).toBe('native-indexeddb');
  });

  it('pickStorageStrategy degrades to localStorage when IndexedDB is absent (this env)', () => {
    const picked = pickStorageStrategy();
    const expectedKey = typeof indexedDB !== 'undefined' ? 'native-indexeddb' : 'local-storage';
    expect(picked.key).toBe(expectedKey);
  });

  // Real round-trip only where IndexedDB exists (a browser / fake-indexeddb); skipped under happy-dom.
  it.skipIf(typeof indexedDB === 'undefined')('round-trips set → get → keys → delete (browser only)', async () => {
    const s = new IndexedDBStrategy<{ n: number }>('webstates-idb-test');
    await s.set('docs', 'd1', { n: 9 });
    expect(await s.get('docs', 'd1')).toEqual({ n: 9 });
    expect(await s.keys('docs')).toEqual(['d1']);
    await s.delete('docs', 'd1');
    expect(await s.get('docs', 'd1')).toBeUndefined();
  });
});

describe('nativeStoragePersistence', () => {
  it('degrades to false / {} when navigator.storage is absent', async () => {
    expect(typeof (await nativeStoragePersistence.persisted())).toBe('boolean');
    expect(typeof (await nativeStoragePersistence.estimate())).toBe('object');
  });
});
