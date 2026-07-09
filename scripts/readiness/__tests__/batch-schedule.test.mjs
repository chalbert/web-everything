/**
 * @file scripts/readiness/__tests__/batch-schedule.test.mjs
 * @description Unit proof of the adaptive execution-model selector (#2334, epic #1143) — the pure layer that
 *   lets the user pick 'batch' instead of 'which engine'. Pins the model: disjoint items fan out, items that
 *   share a real touch-set (the drain/review core) CHAIN, the plan re-evaluates as items land, and it
 *   degenerates to all-parallel (nothing contends) / all-serial (a full chain). The headline case: 9
 *   drain-core items that were serialised BY HAND now schedule into a single serial chain automatically.
 */
import { describe, it, expect } from 'vitest';
import {
  contends, predecessorsOf, readyAfter, scheduleWaves, selectModel, scheduleReason, beforeInOrder,
  orderedEntries,
} from '../batch-schedule.mjs';

// A probed entry, matching lane-partition's fixture shape.
const entry = (num, probe, extra = {}) => ({ num: String(num), file: `${num}-x.md`, ...extra, probe });
const we = (...predictedFiles) => ({ predictedFiles, confident: true });

describe('beforeInOrder — deterministic, total, numeric-first', () => {
  it('orders by numeric num ascending', () => {
    expect(beforeInOrder(entry(2, we()), entry(10, we()))).toBe(true);
    expect(beforeInOrder(entry(10, we()), entry(2, we()))).toBe(false);
  });
  it('sorts provisional xNNNNNN ids AFTER all numerics', () => {
    expect(beforeInOrder(entry(999, we()), entry('x0abc12', we()))).toBe(true);
    expect(beforeInOrder(entry('x0abc12', we()), entry(999, we()))).toBe(false);
  });
});

describe('contends — the efficiency predicate (superset of conflicts)', () => {
  it('two items sharing an ORDINARY code file contend (the drain-thrash case conflicts() misses)', () => {
    // merge-ai-prs.mjs is NOT a merge-risk registry, so lane-partition.conflicts() says fan out; the
    // scheduler chains them so the drain rebases once instead of replaying.
    const x = entry(1, we('scripts/merge-ai-prs.mjs', 'scripts/a.mjs'));
    const y = entry(2, we('scripts/merge-ai-prs.mjs', 'scripts/b.mjs'));
    expect(contends(x, y)).toBe(true);
  });
  it('fully disjoint items do NOT contend', () => {
    expect(contends(entry(1, we('src/a.ts')), entry(2, we('src/b.ts')))).toBe(false);
  });
  it('a probe-less item contends with everything (unknown touch-set)', () => {
    expect(contends(entry(1, null), entry(2, we('src/b.ts')))).toBe(true);
  });
  it('a blockedBy edge contends even when file-disjoint', () => {
    const x = entry(2, we('src/a.ts'), { blockedBy: ['1'] });
    const y = entry(1, we('src/b.ts'));
    expect(contends(x, y)).toBe(true);
  });
  it('the per-item backlog file never manufactures false contention', () => {
    // Each item's only shared-directory file is its own we:backlog/NNN.md, which is unique per item.
    expect(contends(entry(1, we('src/a.ts')), entry(2, we('src/b.ts')))).toBe(false);
  });
});

describe('scheduleWaves — the layered plan; union == the pack, each item once', () => {
  it('all-disjoint ⇒ one wave (everything parallel)', () => {
    const waves = scheduleWaves([entry(1, we('a')), entry(2, we('b')), entry(3, we('c'))]);
    expect(waves).toHaveLength(1);
    expect(waves[0].map((e) => e.num).sort()).toEqual(['1', '2', '3']);
  });

  it('HEADLINE: 9 drain-core items sharing merge-ai-prs.mjs schedule as a 9-deep serial chain', () => {
    const items = Array.from({ length: 9 }, (_, i) =>
      entry(100 + i, we('scripts/merge-ai-prs.mjs', `scripts/lane-${100 + i}.mjs`)));
    const waves = scheduleWaves(items);
    expect(waves).toHaveLength(9);
    expect(waves.every((w) => w.length === 1)).toBe(true);
    // dispatched in deterministic num order
    expect(waves.map((w) => w[0].num)).toEqual(items.map((e) => e.num));
    expect(selectModel(items)).toBe('all-serial');
  });

  it('MIXED: two contending + one disjoint ⇒ the loner fans out with wave 0, the pair chains', () => {
    const a = entry(1, we('scripts/core.mjs', 'scripts/a.mjs'));
    const b = entry(2, we('scripts/core.mjs', 'scripts/b.mjs'));
    const c = entry(3, we('src/lonely.ts'));
    const waves = scheduleWaves([a, b, c]);
    expect(waves).toHaveLength(2);
    expect(waves[0].map((e) => e.num).sort()).toEqual(['1', '3']); // a + the loner fan out
    expect(waves[1].map((e) => e.num)).toEqual(['2']);             // b chains after a
    expect(selectModel([a, b, c])).toBe('mixed');
  });

  it('a HIGHER-numbered blocker still dispatches BEFORE the lower-numbered item it blocks', () => {
    // #259 negotiation regression: item 2 is blockedBy item 5, so item 5 MUST land first even though 5 > 2.
    // The scheduler must honor the blockedBy DIRECTION, not the numeric num order (which would emit [[2],[5]]).
    const blocked = entry(2, we('src/b.ts'), { blockedBy: ['5'] });
    const blocker = entry(5, we('src/a.ts'));
    const pack = [blocker, blocked];
    // the blocker leads; the blocked item waits on it
    expect(predecessorsOf(blocker, pack).map((e) => e.num)).toEqual([]);
    expect(predecessorsOf(blocked, pack).map((e) => e.num)).toEqual(['5']);
    // nothing landed ⇒ only the blocker is dispatchable
    expect(readyAfter(pack, []).map((e) => e.num)).toEqual(['5']);
    // waves: blocker first, then the item it blocks
    expect(scheduleWaves(pack).map((w) => w.map((e) => e.num))).toEqual([['5'], ['2']]);
    expect(selectModel(pack)).toBe('all-serial');
    // the placement copy still names the edge (blocked chained after its blocker)
    expect(scheduleReason(blocked, pack)).toMatch(/chained after #5 — blockedBy edge/);
  });

  it('#259 round-2 regression: a 3-item group with ONE num-inverting blockedBy edge chains all-serial (no cycle)', () => {
    // The exact failure the per-pair predecessor decision produced: three items all touching one shared file
    // (so all three pairwise contend), with a single blockedBy edge whose direction inverts numeric order.
    //   A{num:3}, B{num:1, blockedBy:[3]}, C{num:2}
    // Per-pair, the "before" edges A→B (blockedBy, num-inverted), B→C (1<2), C→A (2<3) CYCLED — readyAfter
    // returned [] and the defensive flush dumped [[A,B,C]] as one all-parallel wave, dispatching B alongside
    // its own blocker A. A single consistent linear order makes that impossible.
    const A = entry(3, we('scripts/shared.mjs'));
    const B = entry(1, we('scripts/shared.mjs'), { blockedBy: ['3'] });
    const C = entry(2, we('scripts/shared.mjs'));
    const pack = [A, B, C];
    const waves = scheduleWaves(pack);
    const waveOf = (num) => waves.findIndex((w) => w.some((e) => e.num === String(num)));
    // an all-serial chain — one item per wave, never collapsed into a single all-parallel wave
    expect(waves).toHaveLength(3);
    expect(waves.every((w) => w.length === 1)).toBe(true);
    expect(selectModel(pack)).toBe('all-serial');
    expect(selectModel(pack)).not.toBe('all-parallel');
    // the blockedBy edge is honored: A (num 3) lands strictly before B (num 1), and B is NEVER co-waved with A
    expect(waveOf(3)).toBeLessThan(waveOf(1));
    expect(waveOf(3)).not.toBe(waveOf(1));
    // readyAfter never wrongly returns empty while items remain (the masked-by-flush symptom)
    expect(readyAfter(pack, []).length).toBeGreaterThan(0);
  });

  it('#259 round-2: genuinely-CYCLIC blockedBy input is broken deterministically by numeric order, never all-parallel', () => {
    // A real dependency cycle in the DATA (A blockedBy C, B blockedBy A, C blockedBy B), all sharing one file.
    // There is no topological order; we break the cycle by numeric order rather than silently collapsing to
    // concurrent dispatch, yielding a deterministic all-serial chain in num order 1 → 2 → 3.
    const A = entry(1, we('scripts/shared.mjs'), { blockedBy: ['3'] });
    const B = entry(2, we('scripts/shared.mjs'), { blockedBy: ['1'] });
    const C = entry(3, we('scripts/shared.mjs'), { blockedBy: ['2'] });
    const pack = [A, B, C];
    const waves = scheduleWaves(pack);
    expect(waves.map((w) => w.map((e) => e.num))).toEqual([['1'], ['2'], ['3']]);
    expect(waves.some((w) => w.length > 1)).toBe(false); // NOT collapsed into one all-parallel wave
    expect(selectModel(pack)).toBe('all-serial');
    expect(selectModel(pack)).not.toBe('all-parallel');
  });

  it('#259 round-2: a non-cyclic item merely blocked BY a cycle keeps its ordering constraint', () => {
    // A↔B form a real 2-cycle (A blockedBy B, B blockedBy A); D is blockedBy A but is NOT itself in a cycle.
    // Breaking the cycle must not force the numerically-lowest item out ahead of its blocker: D still lands
    // after A even though D would sort first numerically.
    const D = entry(1, we('scripts/shared.mjs'), { blockedBy: ['2'] });
    const A = entry(2, we('scripts/shared.mjs'), { blockedBy: ['3'] });
    const B = entry(3, we('scripts/shared.mjs'), { blockedBy: ['2'] });
    const pack = [D, A, B];
    const order = orderedEntries(pack).map((e) => e.num);
    // A and B are the cycle (2↔3); D (num 1) is blockedBy A (num 2) and must follow it despite the lower num
    expect(order.indexOf('2')).toBeLessThan(order.indexOf('1'));
    expect(selectModel(pack)).toBe('all-serial');
  });

  it('every item appears exactly once across the waves', () => {
    const items = [entry(1, we('x', 'shared')), entry(2, we('y', 'shared')), entry(3, we('z')), entry(4, null)];
    const flat = scheduleWaves(items).flat().map((e) => e.num).sort();
    expect(flat).toEqual(['1', '2', '3', '4']);
  });
});

describe('selectModel — auto-selects the engine from the pack shape', () => {
  it('empty / single item ⇒ all-parallel', () => {
    expect(selectModel([])).toBe('all-parallel');
    expect(selectModel([entry(1, we('a'))])).toBe('all-parallel');
  });
  it('all-disjoint ⇒ all-parallel', () => {
    expect(selectModel([entry(1, we('a')), entry(2, we('b'))])).toBe('all-parallel');
  });
  it('a full mutual-contention clique ⇒ all-serial', () => {
    const mk = (n) => entry(n, we('scripts/core.mjs', `scripts/${n}.mjs`));
    expect(selectModel([mk(1), mk(2), mk(3)])).toBe('all-serial');
  });
});

describe('readyAfter — the adaptive re-evaluation as items land', () => {
  const a = entry(1, we('scripts/core.mjs', 'scripts/a.mjs')); // chain head
  const b = entry(2, we('scripts/core.mjs', 'scripts/b.mjs')); // chained after a
  const c = entry(3, we('src/lonely.ts'));                     // disjoint
  const pack = [a, b, c];

  it('predecessorsOf: b waits on a, a and c wait on nobody', () => {
    expect(predecessorsOf(a, pack).map((e) => e.num)).toEqual([]);
    expect(predecessorsOf(b, pack).map((e) => e.num)).toEqual(['1']);
    expect(predecessorsOf(c, pack).map((e) => e.num)).toEqual([]);
  });

  it('nothing landed ⇒ a + c are ready, b is not (its predecessor a is unlanded)', () => {
    expect(readyAfter(pack, []).map((e) => e.num).sort()).toEqual(['1', '3']);
  });

  it('after a lands ⇒ b frees up (c already dispatched, a landed)', () => {
    expect(readyAfter(pack, ['1', '3']).map((e) => e.num)).toEqual(['2']);
  });

  it('a landed item is never re-offered', () => {
    expect(readyAfter(pack, ['1', '2', '3'])).toHaveLength(0);
  });

  it('accepts numeric or string landed nums', () => {
    expect(readyAfter(pack, [1, 3]).map((e) => e.num)).toEqual(['2']);
  });
});

describe('scheduleReason — human-readable placement copy', () => {
  it('names disjoint fan-out, a shared touch-set, a blockedBy chain, and a probe failure', () => {
    const a = entry(1, we('scripts/core.mjs'));
    const b = entry(2, we('scripts/core.mjs'));
    expect(scheduleReason(a, [a, b])).toMatch(/parallel — disjoint/);
    expect(scheduleReason(b, [a, b])).toMatch(/chained after #1 — shares a touch-set/);
    expect(scheduleReason(b, [a, b])).toMatch(/scripts\/core\.mjs/);

    const dep = entry(4, we('src/x.ts'), { blockedBy: ['3'] });
    const dep0 = entry(3, we('src/y.ts'));
    expect(scheduleReason(dep, [dep0, dep])).toMatch(/chained after #3 — blockedBy edge/);

    expect(scheduleReason(entry(9, null), [entry(9, null)])).toMatch(/unknown touch-set/);
  });
});
