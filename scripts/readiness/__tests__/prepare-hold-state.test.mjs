/**
 * @file scripts/readiness/__tests__/prepare-hold-state.test.mjs
 * @description Unit proof of the prepare-hold primitive (#2219 (b) flow, build arm #2264) — the local,
 *   offline, HARD-excluding hold that protects a prepare-in-a-lane window. Unlike the soft `reserve`
 *   deprioritize, `--select` skips a held item and `claim` refuses it; a `leaseUntil` bounds a crashed
 *   holder so it can't block the item forever.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyHoldState, parseHolds, isHeld, heldBy, heldNums, addHold, removeHold, pruneExpired,
  leaseUntilIso, serializeHolds, DEFAULT_LEASE_MINUTES,
} from '../prepare-hold-state.mjs';

const NOW = Date.parse('2026-07-07T12:00:00.000Z');
const FUTURE = '2026-07-07T20:00:00.000Z'; // live at NOW
const PAST = '2026-07-07T08:00:00.000Z';   // expired at NOW

describe('prepare-hold primitive (#2219 (b) / #2264)', () => {
  it('holds and reads an item as held while the lease is live, padded-tolerant', () => {
    const s = addHold(emptyHoldState(), '2153', 'sess-a', FUTURE);
    expect(isHeld(s, '2153', NOW)).toBe(true);
    expect(isHeld(s, 2153, NOW)).toBe(true);   // unpadded numeric matches
    expect(heldBy(s, '2153', NOW)).toBe('sess-a');
    expect(heldNums(s, NOW)).toEqual(['2153']);
  });

  it('treats an EXPIRED lease as not held (ignored like a crashed reservation)', () => {
    const s = addHold(emptyHoldState(), '2153', 'sess-a', PAST);
    expect(isHeld(s, '2153', NOW)).toBe(false);
    expect(heldBy(s, '2153', NOW)).toBe(null);
    expect(heldNums(s, NOW)).toEqual([]);
  });

  it('a missing/invalid leaseUntil is treated as expired (never wedges selection)', () => {
    const s = { holds: [{ num: '2153', holder: 'x', leaseUntil: null }, { num: '2154', holder: 'y', leaseUntil: 'not-a-date' }] };
    expect(isHeld(s, '2153', NOW)).toBe(false);
    expect(isHeld(s, '2154', NOW)).toBe(false);
  });

  it('is idempotent — re-holding refreshes the holder + lease rather than duplicating', () => {
    let s = addHold(emptyHoldState(), '2153', 'sess-a', PAST);
    s = addHold(s, '2153', 'sess-a', FUTURE); // extend across a long prepare
    expect(heldNums(s, NOW)).toEqual(['2153']);
    expect(s.holds).toHaveLength(1);
    expect(s.holds[0].leaseUntil).toBe(FUTURE);
    expect(isHeld(s, '2153', NOW)).toBe(true);
  });

  it('releases a hold (the preparer clear point); idempotent', () => {
    let s = addHold(addHold(emptyHoldState(), '2153', 'a', FUTURE), '2161', 'b', FUTURE);
    s = removeHold(s, ['2153']);
    expect(isHeld(s, '2153', NOW)).toBe(false);
    expect(isHeld(s, '2161', NOW)).toBe(true);
    s = removeHold(s, ['2153']); // no-op on an already-clear item
    expect(heldNums(s, NOW)).toEqual(['2161']);
  });

  it('pruneExpired drops only expired holds (self-pruning on write)', () => {
    const s = { holds: [{ num: '2153', holder: 'a', leaseUntil: FUTURE }, { num: '2161', holder: 'b', leaseUntil: PAST }] };
    const pruned = pruneExpired(s, NOW);
    expect(pruned.holds.map((h) => h.num)).toEqual(['2153']);
  });

  it('leaseUntilIso stamps the default lease into the future (outlasts the 120min reserve TTL)', () => {
    const iso = leaseUntilIso(NOW);
    expect(Date.parse(iso)).toBe(NOW + DEFAULT_LEASE_MINUTES * 60_000);
    expect(DEFAULT_LEASE_MINUTES).toBeGreaterThan(120); // strictly stronger than the soft reserve
  });

  it('round-trips through serialize/parse (durable local token)', () => {
    const s = addHold(emptyHoldState(), '2153', 'sess-a', FUTURE);
    const back = parseHolds(serializeHolds(s));
    expect(isHeld(back, '2153', NOW)).toBe(true);
    expect(heldBy(back, '2153', NOW)).toBe('sess-a');
  });

  it('degrades a corrupt/empty token to empty (never wedges the select/claim path)', () => {
    expect(heldNums(parseHolds(''), NOW)).toEqual([]);
    expect(heldNums(parseHolds('{ not json'), NOW)).toEqual([]);
    expect(heldNums(parseHolds('{"holds":[{"junk":1},{"num":"2153","leaseUntil":"' + FUTURE + '"}]}'), NOW)).toEqual(['2153']);
    expect(isHeld(undefined, '2153', NOW)).toBe(false);
    expect(isHeld({}, '2153', NOW)).toBe(false);
  });
});
