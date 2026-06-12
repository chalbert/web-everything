import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TTL_MINUTES,
  emptyState,
  parseReservations,
  partitionByTtl,
  foreignHolds,
  deprioritizeReserved,
  addHolds,
  removeBySession,
  removeNums,
  pruneExpired,
  serialize,
} from '../readiness/reservations.mjs';

// A fixed clock; tests inject ages relative to it so nothing reads the wall clock.
const NOW = Date.parse('2026-06-12T12:00:00.000Z');
const minsAgo = (m) => new Date(NOW - m * 60_000).toISOString();

describe('parseReservations — tolerant', () => {
  it('empty / blank / bad JSON degrade to a clean empty state', () => {
    for (const t of ['', '   ', '{bad', 'null', '[]']) {
      expect(parseReservations(t)).toEqual(emptyState());
    }
  });

  it('normalizes num to 3-digit and drops junk rows', () => {
    const s = parseReservations(JSON.stringify({
      ttlMinutes: 90,
      held: [
        { num: 83, session: 'a', at: minsAgo(1) },
        { num: '7', session: 'b', at: minsAgo(1) },
        { num: '5' },                       // missing session/at → dropped
        { session: 'c', at: minsAgo(1) },   // missing num → dropped
        null,                               // junk → dropped
      ],
    }));
    expect(s.ttlMinutes).toBe(90);
    expect(s.held.map((h) => h.num)).toEqual(['083', '007']);
  });

  it('falls back to the default TTL when missing or non-positive', () => {
    expect(parseReservations(JSON.stringify({ held: [] })).ttlMinutes).toBe(DEFAULT_TTL_MINUTES);
    expect(parseReservations(JSON.stringify({ ttlMinutes: 0, held: [] })).ttlMinutes).toBe(DEFAULT_TTL_MINUTES);
  });
});

describe('partitionByTtl — ignore stale (#083 invariant 3)', () => {
  const state = {
    ttlMinutes: 60,
    held: [
      { num: '001', session: 'a', at: minsAgo(10) },   // live
      { num: '002', session: 'a', at: minsAgo(59) },   // live (just inside)
      { num: '003', session: 'a', at: minsAgo(120) },  // expired
      { num: '004', session: 'a', at: 'not-a-date' },  // unparseable → expired
    ],
  };
  it('splits live vs expired by the lease', () => {
    const { live, expired } = partitionByTtl(state, NOW);
    expect(live.map((h) => h.num)).toEqual(['001', '002']);
    expect(expired.map((h) => h.num)).toEqual(['003', '004']);
  });
});

describe('foreignHolds — session-aware (#083: never penalize your own chain)', () => {
  const state = {
    ttlMinutes: 60,
    held: [
      { num: '010', session: 'batch-A', at: minsAgo(5) },
      { num: '011', session: 'batch-B', at: minsAgo(5) },
      { num: '012', session: 'batch-A', at: minsAgo(999) }, // expired → not foreign
    ],
  };
  it('returns only live holds owned by another session', () => {
    const f = foreignHolds(state, NOW, 'batch-A');
    expect([...f.keys()]).toEqual(['011']);
    expect(f.get('011')).toBe('batch-B');
  });
  it('with no session, every live hold is foreign', () => {
    const f = foreignHolds(state, NOW, undefined);
    expect([...f.keys()].sort()).toEqual(['010', '011']);
  });
});

describe('deprioritizeReserved — deprioritize, not exclude (#083 invariant 1)', () => {
  const ranked = [{ num: '1' }, { num: '2' }, { num: '3' }, { num: '4' }];
  it('sinks foreign-held items to the back, preserving relative order, same length', () => {
    const foreign = new Map([['002', 'batch-X'], ['003', 'batch-X']]);
    const out = deprioritizeReserved(ranked, foreign);
    expect(out.map((it) => it.num)).toEqual(['1', '4', '2', '3']); // free first, held last
    expect(out).toHaveLength(ranked.length); // nothing dropped
  });
  it('annotates held items with reservedBy and leaves free items untouched', () => {
    const foreign = new Map([['002', 'batch-X']]);
    const out = deprioritizeReserved(ranked, foreign);
    expect(out.find((it) => it.num === '2').reservedBy).toBe('batch-X');
    expect(out.find((it) => it.num === '1').reservedBy).toBeUndefined();
  });
  it('is a no-op (same array) when nothing is foreign-held', () => {
    expect(deprioritizeReserved(ranked, new Map())).toBe(ranked);
  });
});

describe('addHolds — first-holder-wins, refresh own (#083)', () => {
  it('adds new holds normalized + sorted', () => {
    const s = addHolds(emptyState(), ['8', '12'], 'batch-A', minsAgo(0));
    expect(s.held.map((h) => h.num)).toEqual(['008', '012']);
    expect(s.held.every((h) => h.session === 'batch-A')).toBe(true);
  });
  it("does not let another session steal an existing hold", () => {
    const s0 = addHolds(emptyState(), ['9'], 'batch-A', minsAgo(10));
    const s1 = addHolds(s0, ['9'], 'batch-B', minsAgo(0));
    expect(s1.held).toHaveLength(1);
    expect(s1.held[0].session).toBe('batch-A'); // first holder kept
  });
  it('refreshes the lease when the SAME session re-reserves', () => {
    const s0 = addHolds(emptyState(), ['9'], 'batch-A', minsAgo(10));
    const s1 = addHolds(s0, ['9'], 'batch-A', minsAgo(0));
    expect(s1.held[0].at).toBe(minsAgo(0));
  });
});

describe('release paths — invariant 2', () => {
  const base = {
    ttlMinutes: 120,
    held: [
      { num: '001', session: 'A', at: minsAgo(1) },
      { num: '002', session: 'A', at: minsAgo(1) },
      { num: '003', session: 'B', at: minsAgo(1) },
    ],
  };
  it('removeBySession clears a whole session (batch stop)', () => {
    expect(removeBySession(base, 'A').held.map((h) => h.num)).toEqual(['003']);
  });
  it('removeNums releases specific items (clear-on-claim)', () => {
    expect(removeNums(base, ['2']).held.map((h) => h.num)).toEqual(['001', '003']);
  });
  it('pruneExpired drops only stale entries', () => {
    const s = { ttlMinutes: 60, held: [{ num: '1', session: 'A', at: minsAgo(10) }, { num: '2', session: 'A', at: minsAgo(120) }] };
    expect(pruneExpired(s, NOW).held.map((h) => h.num)).toEqual(['1']);
  });
});

describe('serialize → parse roundtrip', () => {
  it('survives a write/read cycle with a _doc header', () => {
    const s = addHolds(emptyState(), ['83'], 'batch-2026-06-12-083', minsAgo(0));
    const text = serialize(s);
    expect(text).toContain('"_doc"');
    const back = parseReservations(text);
    expect(back.held).toEqual(s.held);
    expect(back.ttlMinutes).toBe(s.ttlMinutes);
  });
});
