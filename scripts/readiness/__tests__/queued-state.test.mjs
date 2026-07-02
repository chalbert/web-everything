/**
 * @file scripts/readiness/__tests__/queued-state.test.mjs
 * @description Unit proof of the ready-to-merge (queued) primitive (#2138 Fork 4) — the local, offline
 *   signal that distinguishes a queued (lane-pushed, waiting-to-drain) item from an abandoned one, so
 *   `claim` won't re-offer it and the #2072 closeout reconcile (`release`) won't reopen it as abandoned.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyQueuedState, parseQueued, isQueued, queuedNums, addQueued, removeQueued, serializeQueued,
} from '../queued-state.mjs';

const AT = '2026-07-02T20:00:00.000Z';

describe('queued-state primitive (#2138 Fork 4)', () => {
  it('marks and reads an item ready-to-merge, padded-tolerant', () => {
    const s = addQueued(emptyQueuedState(), ['2153', 42], AT);
    expect(isQueued(s, '2153')).toBe(true);
    expect(isQueued(s, 2153)).toBe(true);   // unpadded numeric matches
    expect(isQueued(s, '042')).toBe(true);  // padded on write
    expect(isQueued(s, '999')).toBe(false);
    expect(queuedNums(s)).toEqual(['042', '2153']); // sorted, padded
  });

  it('is idempotent — re-queuing refreshes rather than duplicating', () => {
    let s = addQueued(emptyQueuedState(), ['2153'], AT, { lane: 'lane/2153-we-o1' });
    s = addQueued(s, ['2153'], '2026-07-02T21:00:00.000Z', { lane: 'lane/2153-we-o2' });
    expect(queuedNums(s)).toEqual(['2153']);
    expect(s.queued[0].at).toBe('2026-07-02T21:00:00.000Z');
    expect(s.queued[0].lane).toBe('lane/2153-we-o2');
  });

  it('carries optional lane/batchSlug metadata, omits when absent', () => {
    const s = addQueued(emptyQueuedState(), ['2153'], AT, { lane: 'lane/2153-we-o1', batchSlug: 'batch-x' });
    expect(s.queued[0]).toMatchObject({ num: '2153', lane: 'lane/2153-we-o1', batchSlug: 'batch-x' });
    const bare = addQueued(emptyQueuedState(), ['2153'], AT);
    expect(bare.queued[0]).not.toHaveProperty('lane');
    expect(bare.queued[0]).not.toHaveProperty('batchSlug');
  });

  it('clears a mark at landing (the drain single clear point); idempotent', () => {
    let s = addQueued(emptyQueuedState(), ['2153', '2161'], AT);
    s = removeQueued(s, ['2153']);
    expect(isQueued(s, '2153')).toBe(false);
    expect(isQueued(s, '2161')).toBe(true);
    s = removeQueued(s, ['2153']); // no-op on an already-clear item
    expect(queuedNums(s)).toEqual(['2161']);
  });

  it('round-trips through serialize/parse (durable local token)', () => {
    const s = addQueued(emptyQueuedState(), ['2153', '2161'], AT, { lane: 'lane/2153-we-o1' });
    const back = parseQueued(serializeQueued(s));
    expect(queuedNums(back)).toEqual(queuedNums(s));
    expect(isQueued(back, '2153')).toBe(true);
    expect(isQueued(back, '2161')).toBe(true);
    expect(back.queued.find((q) => q.num === '2153').lane).toBe('lane/2153-we-o1');
  });

  it('degrades a corrupt/empty token to empty (never wedges the ownership path)', () => {
    expect(queuedNums(parseQueued(''))).toEqual([]);
    expect(queuedNums(parseQueued('{ not json'))).toEqual([]);
    expect(queuedNums(parseQueued('{"queued":[{"junk":1},{"num":"2153"}]}'))).toEqual(['2153']);
    expect(isQueued(undefined, '2153')).toBe(false);
    expect(isQueued({}, '2153')).toBe(false);
  });
});
