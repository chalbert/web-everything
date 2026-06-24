/**
 * @file scripts/readiness/__tests__/reservations-session.test.mjs
 * @description Unit proof of `sessionForNum` (#1723): claim can recover the reserving session.
 *
 * The batch loop runs `claim <NNN>` without `--session`, so the #952 gate baseline used to never record
 * (claims.json stayed empty → `--scope=<slug>` silently inert). The `reserve` step already stamped each
 * planned item with its session in reservations.json; `sessionForNum` recovers it so the baseline records
 * without a per-claim flag.
 */
import { describe, it, expect } from 'vitest';
import { addHolds, sessionForNum, emptyState } from '../reservations.mjs';

describe('sessionForNum (#1723 — claim infers the reserving session)', () => {
  const SESSION = 'batch-2026-06-23-1725-1665';
  const state = addHolds(emptyState(), ['1723', '1742'], SESSION, '2026-06-23T22:00:00.000Z');

  it('returns the session that reserved a held item', () => {
    expect(sessionForNum(state, '1723')).toBe(SESSION);
  });

  it('tolerates an unpadded numeric num (matches the padded hold)', () => {
    expect(sessionForNum(state, 1742)).toBe(SESSION);
    expect(sessionForNum(state, '313')).toBeNull(); // not held
  });

  it('returns null for an unheld item or an empty registry', () => {
    expect(sessionForNum(state, '9999')).toBeNull();
    expect(sessionForNum(emptyState(), '1723')).toBeNull();
    expect(sessionForNum({}, '1723')).toBeNull();
  });
});
