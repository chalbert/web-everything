import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  validateConfig,
  isReady,
  computeScore,
  effectiveScore,
  orderQueue,
  orderQueueDetailed,
  nextToBuild,
  rankBetween,
  initialRanks,
  TIERS,
} from '../lib/build-queue.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-16');
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Minimal item factory. */
function item(num, over = {}) {
  return { num: String(num), id: `${num}-x`, status: 'open', dateOpened: '2026-07-16', ...over };
}

describe('#2528 readiness gate (hard, read-only)', () => {
  it('a ready item (open, deps resolved, not won\'t) is eligible', () => {
    const items = [item(1)];
    expect(isReady(items[0], new Map([['1', items[0]]]))).toBe(true);
  });

  it('an item with an unresolved blocker is NOT ready (fail closed)', () => {
    const blocker = item(2, { status: 'open' });
    const blocked = item(1, { blockedBy: ['2'] });
    const byId = new Map([['1', blocked], ['2', blocker], ['2-x', blocker]]);
    expect(isReady(blocked, byId)).toBe(false);
  });

  it('an item whose blocker is resolved IS ready', () => {
    const blocker = item(2, { status: 'resolved' });
    const blocked = item(1, { blockedBy: ['2'] });
    const byId = new Map([['1', blocked], ['2', blocker]]);
    expect(isReady(blocked, byId)).toBe(true);
  });

  it('an unknown blocker id → NOT ready', () => {
    const blocked = item(1, { blockedBy: ['999'] });
    expect(isReady(blocked, new Map([['1', blocked]]))).toBe(false);
  });

  it("a won't-tier item is never eligible", () => {
    const it = item(1, { tier: "won't" });
    expect(isReady(it, new Map([['1', it]]))).toBe(false);
  });

  it('a non-open (active/resolved) item is not eligible', () => {
    expect(isReady(item(1, { status: 'active' }), new Map())).toBe(false);
    expect(isReady(item(1, { status: 'resolved' }), new Map())).toBe(false);
  });
});

describe('#2528 ordering — tier first, then score, then rank', () => {
  it('tier is the primary key: a pinned item outranks a higher-scoring normal item', () => {
    const pinned = item(1, { tier: 'pinned', value: 1 });
    const normal = item(2, { tier: 'normal', value: 5 }); // higher score, lower tier
    expect(nextToBuild([normal, pinned], DEFAULT_CONFIG, NOW).num).toBe('1');
  });

  it('within a tier, higher score wins', () => {
    const lo = item(1, { value: 1 });
    const hi = item(2, { value: 5 });
    expect(nextToBuild([lo, hi], DEFAULT_CONFIG, NOW).num).toBe('2');
  });

  it('rank breaks a score tie (manual override within a tier)', () => {
    const a = item(1, { value: 3, rank: 'm' });
    const b = item(2, { value: 3, rank: 'c' }); // earlier rank
    expect(nextToBuild([a, b], DEFAULT_CONFIG, NOW).num).toBe('2');
  });

  it('the queue excludes blocked and won\'t items entirely', () => {
    const blocker = item(9, { status: 'open' });
    const items = [
      item(1, { value: 5 }),
      item(2, { blockedBy: ['9'], value: 5 }), // blocked
      item(3, { tier: "won't", value: 5 }), // won't
      blocker,
    ];
    const q = orderQueue(items, DEFAULT_CONFIG, NOW).map((i) => i.num);
    // item 2 (blocked) and item 3 (won't) are excluded; item 1 and the ready blocker 9 remain,
    // item 1 first on its higher value.
    expect(q).toEqual(['1', '9']);
  });

  it('is deterministic — same inputs, same order', () => {
    const items = [item(1, { value: 3 }), item(2, { value: 3 }), item(3, { value: 4 })];
    const a = orderQueue(items, DEFAULT_CONFIG, NOW).map((i) => i.num);
    const b = orderQueue(items, DEFAULT_CONFIG, NOW).map((i) => i.num);
    expect(a).toEqual(b);
  });

  it('empty ready set → nextToBuild is null', () => {
    expect(nextToBuild([item(1, { status: 'active' })], DEFAULT_CONFIG, NOW)).toBeNull();
  });

  it('fully-tied items break by num ascending regardless of input order (total order)', () => {
    // identical tier/score/rank/dateOpened, differing only by num, passed in reverse.
    const a = item(2, { value: 3, rank: 'm' });
    const b = item(1, { value: 3, rank: 'm' });
    expect(orderQueue([a, b], DEFAULT_CONFIG, NOW).map((i) => i.num)).toEqual(['1', '2']);
  });
});

describe('#2529 orderQueueDetailed — enriched records (the "why" the console + builder read)', () => {
  it('records carry the tier STRING, effective score, unblocks, and rank; same order as orderQueue', () => {
    const foundation = item(1, { value: 2 }); // ready, and unblocks the dependent below
    const dependent = item(2, { blockedBy: ['1'], value: 2 }); // blocked by the open foundation → excluded
    const pinned = item(3, { tier: 'pinned', value: 1 });
    const items = [foundation, dependent, pinned];
    const detailed = orderQueueDetailed(items, DEFAULT_CONFIG, NOW);
    // Bare-item projection must match orderQueue exactly (one source of truth).
    expect(detailed.map((r) => r.item.num)).toEqual(orderQueue(items, DEFAULT_CONFIG, NOW).map((i) => i.num));
    // Pinned leads on tier despite the lowest score.
    expect(detailed[0].item.num).toBe('3');
    expect(detailed[0].tier).toBe('pinned');
    // Every record exposes the display fields; a tier-less item defaults to 'normal'.
    const rec1 = detailed.find((r) => r.item.num === '1');
    expect(rec1.tier).toBe('normal');
    expect(typeof rec1.score).toBe('number');
    expect(rec1.unblocks).toBe(1); // foundation unblocks the (blocked, still-pending) dependent
    // The excluded blocked item never appears.
    expect(detailed.some((r) => r.item.num === '2')).toBe(false);
  });

  it('score matches effectiveScore for the same unblocks context (no recompute drift)', () => {
    const it = item(1, { value: 4, timeCriticality: 2 });
    const [rec] = orderQueueDetailed([it], DEFAULT_CONFIG, NOW);
    expect(rec.score).toBe(effectiveScore(it, DEFAULT_CONFIG, NOW, { unblocks: 0 }));
  });
});

describe('#2528 unblocks — computed from the blockedBy graph', () => {
  it('an item that unblocks others scores higher (all else equal)', () => {
    const foundation = item(1, { value: 2 });
    const leaf = item(2, { value: 2 });
    const dependents = [item(3, { blockedBy: ['1'] }), item(4, { blockedBy: ['1'] })];
    const next = nextToBuild([leaf, foundation, ...dependents], DEFAULT_CONFIG, NOW);
    expect(next.num).toBe('1'); // foundation unblocks 2 items → higher CoD
  });
});

describe('#2528 aging prevents within-tier starvation', () => {
  it('a long-waiting low-value item eventually out-scores a fresh higher-value one in the same tier', () => {
    const fresh = item(1, { value: 3, dateOpened: iso(NOW) });
    const old = item(2, { value: 1, dateOpened: iso(NOW - 60 * DAY) }); // 60 days old
    expect(nextToBuild([fresh, old], DEFAULT_CONFIG, NOW).num).toBe('2');
  });

  it('aging never crosses tiers (a pinned fresh item still beats an aged normal one)', () => {
    const pinnedFresh = item(1, { tier: 'pinned', value: 1, dateOpened: iso(NOW) });
    const normalOld = item(2, { tier: 'normal', value: 5, dateOpened: iso(NOW - 999 * DAY) });
    expect(nextToBuild([normalOld, pinnedFresh], DEFAULT_CONFIG, NOW).num).toBe('1');
  });

  it('aging is capped', () => {
    const cfg = { ...DEFAULT_CONFIG, aging: { ratePerDay: 1, cap: 5 } };
    const it = item(1, { value: 0, dateOpened: iso(NOW - 1000 * DAY) });
    const base = computeScore(it, cfg, { unblocks: 0 });
    expect(effectiveScore(it, cfg, NOW, { unblocks: 0 })).toBeCloseTo(base + 5);
  });
});

describe('#2528 config validation (configurable-not-chaotic)', () => {
  it('the default config is valid', () => {
    expect(validateConfig(DEFAULT_CONFIG).ok).toBe(true);
  });
  it('weights must sum to 100', () => {
    const bad = { ...DEFAULT_CONFIG, criteria: [{ key: 'a', weight: 40 }, { key: 'b', weight: 40 }] };
    expect(validateConfig(bad).ok).toBe(false);
  });
  it('no single weight may exceed 50%', () => {
    const bad = { ...DEFAULT_CONFIG, criteria: [{ key: 'a', weight: 60 }, { key: 'b', weight: 40 }] };
    expect(validateConfig(bad).errors.join()).toMatch(/exceeds 50/);
  });
  it('at most 5 criteria', () => {
    const bad = { ...DEFAULT_CONFIG, criteria: Array.from({ length: 6 }, (_, i) => ({ key: `c${i}`, weight: i === 0 ? 100 : 0 })) };
    expect(validateConfig(bad).errors.join()).toMatch(/too many criteria/);
  });
  it('rejects a negative aging rate', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, aging: { ratePerDay: -1 } }).ok).toBe(false);
  });
});

describe('#2528 LexoRank (fractional string ordering)', () => {
  it('rankBetween produces a key strictly between its neighbors', () => {
    const mid = rankBetween('a', 'c');
    expect(mid > 'a' && mid < 'c').toBe(true);
  });

  it('handles adjacent digits by extending precision', () => {
    const mid = rankBetween('a', 'b');
    expect(mid > 'a' && mid < 'b').toBe(true);
  });

  it('open-ended: before-everything and after-everything', () => {
    const first = rankBetween('', 'm');
    const last = rankBetween('m', '');
    expect(first < 'm').toBe(true);
    expect(last > 'm').toBe(true);
  });

  it('repeated inserts between the same two keys stay strictly ordered', () => {
    let lo = 'a';
    const hi = 'b';
    const seen = [];
    for (let k = 0; k < 20; k++) {
      const mid = rankBetween(lo, hi);
      expect(mid > lo && mid < hi).toBe(true);
      seen.push(mid);
      lo = mid; // keep inserting just after the previous — the hard case
    }
    // all strictly ascending
    for (let k = 1; k < seen.length; k++) expect(seen[k] > seen[k - 1]).toBe(true);
  });

  it('rejects lo >= hi', () => {
    expect(() => rankBetween('c', 'a')).toThrow();
    expect(() => rankBetween('a', 'a')).toThrow();
  });

  it('throws when no key exists strictly between (zero-tail hi, e.g. "a" / "a0")', () => {
    expect(() => rankBetween('a', 'a0')).toThrow(/no key exists/);
  });

  it('initialRanks returns n strictly-ascending keys', () => {
    const ranks = initialRanks(50);
    expect(ranks).toHaveLength(50);
    for (let k = 1; k < ranks.length; k++) expect(ranks[k] > ranks[k - 1]).toBe(true);
  });

  it('a drag = one rewritten key that lands the item in the new slot', () => {
    // three items ranked r0<r1<r2; drag the third to between the first two.
    const [r0, r1, r2] = initialRanks(3);
    const moved = rankBetween(r0, r1);
    const order = [
      { num: '1', rank: r0 },
      { num: '3', rank: moved },
      { num: '2', rank: r1 },
      { num: '_', rank: r2 },
    ].sort((a, b) => (a.rank < b.rank ? -1 : 1)).map((x) => x.num);
    expect(order).toEqual(['1', '3', '2', '_']);
  });

  it('TIERS is the fixed coarse enum', () => {
    expect(TIERS).toEqual(['pinned', 'normal', 'someday', "won't"]);
  });
});
