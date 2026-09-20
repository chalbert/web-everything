/** #3383 — The persisted file belongs to tick-core, with metadata kept outside its guards. */
import { it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTickBookkeeping, BOOKKEEPING_FIELDS } from '../tick-bookkeeping.mjs';
it('is fresh only when absent and round-trips the ten fields, preserving firstSeenAt', () => {
  let at = 100;
  const store = createTickBookkeeping({ now: () => at });
  expect(store.loadBookkeeping()).toMatchObject({ ok: true, fresh: true, bookkeeping: {} });
  const state = Object.fromEntries(BOOKKEEPING_FIELDS.map((k) => [k, k.endsWith('Guards') ? [{ num: 'x1', lane: 1, spawnedTick: 1 }] : k === 'tick' ? 1 : ['watched', 'launchedNums'].includes(k) ? [] : {}]));
  store.saveBookkeeping({ nextState: { ...state, payload: 'do not persist' }, driverId: 'a', tickId: 'a#1' });
  expect(store.loadBookkeeping().bookkeeping).toEqual(state);
  at = 200;
  store.saveBookkeeping({ nextState: state, driverId: 'b', tickId: 'b#2' });
  expect(store.loadBookkeeping().guardMeta['buildGuards:x1']).toEqual({ firstSeenAt: 100, spawnAgeMs: 100, claimStatus: 'none' });
  const raw = JSON.parse(readFileSync(join(process.env.WE_COORDINATION_ROOT, 'tick-bookkeeping.json')));
  expect(raw.bookkeeping.buildGuards).toEqual(state.buildGuards);
  expect(raw.savedBy).toBe('b');
});
it('refuses corrupt and wrong-version state', () => {
  const path = join(process.env.WE_COORDINATION_ROOT, 'tick-bookkeeping.json');
  for (const value of ['{', JSON.stringify({ version: 99, bookkeeping: {} }), JSON.stringify({ version: 1, bookkeeping: { tick: 'broken' }, guardMeta: {} })]) {
    writeFileSync(path, value);
    expect(createTickBookkeeping().loadBookkeeping().ok).toBe(false);
  }
});
it('derives guard claim status from item and PR action identities without editing guards', async () => {
  const { createActionStore } = await import('../../operations/action-store.mjs');
  const { actionResource } = await import('../../operations/action-record.mjs');
  const actions = createActionStore();
  const claim = actions.claim({ resource: actionResource('we', { type: 'pr', id: 77 }), kind: 'fix', owner: 'driver' });
  const store = createTickBookkeeping({ actions, now: () => 100 });
  const guard = { num: 'xfix', pr: 77, lane: 3, spawnedTick: 1 };
  store.saveBookkeeping({ nextState: { tick: 1, fixGuards: [guard] }, driverId: 'driver', tickId: 'driver#1' });
  expect(store.loadBookkeeping()).toMatchObject({ guardMeta: { 'fixGuards:xfix': { firstSeenAt: 100, claimStatus: 'intent' } } });
  expect(store.loadBookkeeping().bookkeeping.fixGuards).toEqual([guard]);
  actions.release(claim.record.resource, claim.record.attempt, { token: claim.record.ownerToken });
  expect(store.loadBookkeeping().guardMeta['fixGuards:xfix'].claimStatus).toBe('terminal');
});
