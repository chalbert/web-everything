/**
 * @file review-park-state.test.mjs — proof of the #2262 review-escalation park-age clock: the durable
 *   "when did this PR FIRST park" marker that lets the drain's watch-window gate (`decideReviewGate`) time
 *   out a deterministically-sampled PR to `merge-anyway` instead of re-parking it forever.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyParkState,
  parkKey,
  parseParkState,
  serializeParkState,
  getParkedSinceMs,
  recordParked,
  clearParked,
} from '../review-park-state.mjs';

describe('parkKey', () => {
  it('keys a (repo, num) pair, normalizing a missing repo to the local-repo slug', () => {
    expect(parkKey('org/we', '110')).toBe('org/we#110');
    expect(parkKey(null, '110')).toBe('cwd#110');
    expect(parkKey(undefined, '110')).toBe('cwd#110');
  });
});

describe('parseParkState', () => {
  it('empty/missing text → empty state', () => {
    expect(parseParkState('')).toEqual({ parked: [] });
    expect(parseParkState(undefined)).toEqual({ parked: [] });
  });
  it('bad JSON never throws — degrades to empty (a corrupt cache must not break the drain)', () => {
    expect(parseParkState('{not json')).toEqual({ parked: [] });
  });
  it('parses valid entries and normalizes the key', () => {
    const s = parseParkState(JSON.stringify({ parked: [{ repo: 'org/we', num: 110, sinceMs: 1000 }] }));
    expect(s.parked).toEqual([{ key: 'org/we#110', repo: 'org/we', num: '110', sinceMs: 1000 }]);
  });
  it('drops junk rows (missing num, non-numeric sinceMs) rather than choking on them', () => {
    const s = parseParkState(JSON.stringify({ parked: [{ sinceMs: 1 }, { num: 5, sinceMs: 'x' }, { num: 5, sinceMs: 10 }] }));
    expect(s.parked).toEqual([{ key: 'cwd#5', repo: null, num: '5', sinceMs: 10 }]);
  });
});

describe('serializeParkState', () => {
  it('round-trips through parse and strips internal bookkeeping (key)', () => {
    const s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    const text = serializeParkState(s);
    const reparsed = parseParkState(text);
    expect(getParkedSinceMs(reparsed, { repo: 'org/we', num: 110 })).toBe(1000);
    expect(JSON.parse(text).parked).toEqual([{ repo: 'org/we', num: '110', sinceMs: 1000 }]);
  });
});

describe('getParkedSinceMs', () => {
  it('untracked (repo, num) → null (a just-escalated PR has no park age yet)', () => {
    expect(getParkedSinceMs(emptyParkState(), { repo: 'org/we', num: 110 })).toBeNull();
  });
});

describe('recordParked — idempotent, keeps the FIRST stamp', () => {
  it('first record sets sinceMs', () => {
    const s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    expect(getParkedSinceMs(s, { repo: 'org/we', num: 110 })).toBe(1000);
  });
  it('re-parking on a LATER pass does not reset the clock (the window counts from the first park)', () => {
    let s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    s = recordParked(s, { repo: 'org/we', num: 110 }, 999_999);
    expect(getParkedSinceMs(s, { repo: 'org/we', num: 110 })).toBe(1000);
  });
  it('different (repo, num) pairs are tracked independently', () => {
    let s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    s = recordParked(s, { repo: 'org/fui', num: 110 }, 2000);
    expect(getParkedSinceMs(s, { repo: 'org/we', num: 110 })).toBe(1000);
    expect(getParkedSinceMs(s, { repo: 'org/fui', num: 110 })).toBe(2000);
  });
});

describe('clearParked — leaves the parked set once resolved', () => {
  it('removes the tracked entry', () => {
    let s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    s = clearParked(s, { repo: 'org/we', num: 110 });
    expect(getParkedSinceMs(s, { repo: 'org/we', num: 110 })).toBeNull();
  });
  it('is a no-op (same reference) when nothing is tracked — cheap to call unconditionally', () => {
    const s = emptyParkState();
    expect(clearParked(s, { repo: 'org/we', num: 110 })).toBe(s);
  });
  it('a later unrelated escalation starts its own fresh window after clearing', () => {
    let s = recordParked(emptyParkState(), { repo: 'org/we', num: 110 }, 1000);
    s = clearParked(s, { repo: 'org/we', num: 110 });
    s = recordParked(s, { repo: 'org/we', num: 110 }, 5000);
    expect(getParkedSinceMs(s, { repo: 'org/we', num: 110 })).toBe(5000);
  });
});
