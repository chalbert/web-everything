/**
 * @file blocks/draft-persistence/__tests__/draft-persistence.test.ts
 * @description Unit tests for the Draft-Persistence block — snapshot/restore across
 * a "session" boundary, version-stale discard, debounced autosave, last-writer-wins
 * reconciliation, and the pluggable storage strategies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DraftPersistence from '../DraftPersistence';
import { MemoryStorageStrategy, LocalStorageStrategy, pickDefaultStorage } from '../storage';
import { resolveLww } from '../coedit';
import type { DraftSnapshot } from '../types';

interface Form {
  name: string;
  amount: number;
}

describe('DraftPersistence — snapshot / restore', () => {
  it('saves and restores the exact field state', async () => {
    const dp = new DraftPersistence<Form>({ storage: new MemoryStorageStrategy(), editor: 'a' });
    await dp.save('loan:1', { name: 'Ada', amount: 500 });
    const restored = await dp.restore('loan:1');
    expect(restored?.state).toEqual({ name: 'Ada', amount: 500 });
    expect(restored?.editor).toBe('a');
  });

  it('survives a "session boundary" — a fresh instance over the same store restores the draft', async () => {
    const store = new MemoryStorageStrategy();
    const session1 = new DraftPersistence<Form>({ storage: store, editor: 'a' });
    await session1.save('loan:2', { name: 'Grace', amount: 1000 });

    const session2 = new DraftPersistence<Form>({ storage: store, editor: 'a' });
    expect((await session2.restore('loan:2'))?.state).toEqual({ name: 'Grace', amount: 1000 });
  });

  it('discards a draft whose schema version no longer matches', async () => {
    const store = new MemoryStorageStrategy();
    await new DraftPersistence<Form>({ storage: store, version: 1 }).save('loan:3', { name: 'x', amount: 1 });
    const v2 = new DraftPersistence<Form>({ storage: store, version: 2 });
    expect(await v2.restore('loan:3')).toBeNull();
    // …and the stale record was dropped.
    expect(await v2.list()).not.toContain('loan:3');
  });

  it('discard removes the draft', async () => {
    const dp = new DraftPersistence<Form>({ storage: new MemoryStorageStrategy() });
    await dp.save('loan:4', { name: 'y', amount: 2 });
    await dp.discard('loan:4');
    expect(await dp.restore('loan:4')).toBeNull();
  });

  it('list returns entity keys that have a draft', async () => {
    const dp = new DraftPersistence<Form>({ storage: new MemoryStorageStrategy() });
    await dp.save('loan:5', { name: 'a', amount: 1 });
    await dp.save('loan:6', { name: 'b', amount: 2 });
    expect((await dp.list()).sort()).toEqual(['loan:5', 'loan:6']);
  });
});

describe('DraftPersistence — debounced autosave', () => {
  beforeEach(() => vi.useFakeTimers());

  it('coalesces rapid changes into a single write after the debounce window', async () => {
    vi.useFakeTimers();
    const store = new MemoryStorageStrategy();
    const setSpy = vi.spyOn(store, 'set');
    const dp = new DraftPersistence<Form>({ storage: store, autosaveDebounceMs: 500 });

    dp.autosave('loan:7', { name: 'a', amount: 1 });
    dp.autosave('loan:7', { name: 'ab', amount: 2 });
    dp.autosave('loan:7', { name: 'abc', amount: 3 });
    expect(setSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(setSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
    expect((await store.get<DraftSnapshot<Form>>('draft:loan:7'))?.state).toEqual({ name: 'abc', amount: 3 });
  });
});

describe('last-writer-wins reconciliation', () => {
  const snap = (over: Partial<DraftSnapshot<Form>>): DraftSnapshot<Form> => ({
    entityKey: 'loan:8',
    state: { name: 'base', amount: 0 },
    savedAt: 1000,
    editor: 'local',
    version: 1,
    ...over,
  });

  it('resolveLww picks the later savedAt (ties go to remote)', () => {
    expect(resolveLww(snap({ savedAt: 1000 }), snap({ savedAt: 2000, editor: 'remote' })).remoteWon).toBe(true);
    expect(resolveLww(snap({ savedAt: 3000 }), snap({ savedAt: 2000, editor: 'remote' })).remoteWon).toBe(false);
    expect(resolveLww(snap({ savedAt: 1000 }), snap({ savedAt: 1000, editor: 'remote' })).remoteWon).toBe(true);
  });

  it('reconcile persists the winner when the remote is newer', async () => {
    const store = new MemoryStorageStrategy();
    const dp = new DraftPersistence<Form>({ storage: store, editor: 'local' });
    await dp.save('loan:8', { name: 'local-edit', amount: 1 });
    const local = await dp.restore('loan:8');

    const remote = snap({ savedAt: (local!.savedAt ?? 0) + 1000, editor: 'remote', state: { name: 'remote-edit', amount: 9 } });
    const res = await dp.reconcile(remote);
    expect(res.remoteWon).toBe(true);
    expect((await dp.restore('loan:8'))?.state).toEqual({ name: 'remote-edit', amount: 9 });
  });

  it('reconcile keeps local when it is newer', async () => {
    const store = new MemoryStorageStrategy();
    const dp = new DraftPersistence<Form>({ storage: store, editor: 'local' });
    const localSnap = await dp.save('loan:9', { name: 'local-edit', amount: 5 });
    const stale = { ...localSnap, savedAt: localSnap.savedAt - 5000, editor: 'remote', state: { name: 'old', amount: 0 } };
    const res = await dp.reconcile(stale);
    expect(res.remoteWon).toBe(false);
    expect((await dp.restore('loan:9'))?.state).toEqual({ name: 'local-edit', amount: 5 });
  });
});

describe('storage strategies', () => {
  it('LocalStorageStrategy round-trips and lists prefixed keys only', async () => {
    localStorage.clear();
    localStorage.setItem('unrelated', 'x');
    const s = new LocalStorageStrategy('we-draft:');
    await s.set('k', { a: 1 });
    expect(await s.get('k')).toEqual({ a: 1 });
    expect(await s.keys()).toEqual(['k']);
    await s.delete('k');
    expect(await s.get('k')).toBeNull();
  });

  it('pickDefaultStorage returns an available strategy', () => {
    expect(['indexeddb', 'localstorage', 'memory']).toContain(pickDefaultStorage().name);
  });
});
