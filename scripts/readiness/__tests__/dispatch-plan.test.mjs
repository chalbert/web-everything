/**
 * @file scripts/readiness/__tests__/dispatch-plan.test.mjs
 * @description Unit proof of the conveyor DISPATCHER's PURE core (WE #x53zzf9). Drives {@link dispatchPlan}
 *   directly with plain objects (NO git/network) and pins every branch of the dispatch rules:
 *   the disjoint happy path (free lanes fill in rank order), overlap-with-an-active-lease, the rival pair
 *   (higher rank wins), no-free-lane, blocked, and needs-probe — plus the precedence between them.
 */
import { describe, it, expect } from 'vitest';
import { dispatchPlan, selectClearedRows } from '../dispatch-plan.mjs';
import { normNum } from '../../conveyor/queue-store.mjs';

describe('dispatchPlan — happy path: disjoint items fill free lanes in rank order', () => {
  it('assigns free lanes to disjoint queued items in queue (rank) order', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/a/'] },
        { num: 2, scope: ['src/b/'] },
        { num: 3, scope: ['src/c/'] },
      ],
      leases: [],
      freeLanes: [4, 5, 7],
    });
    expect(plan.launch).toEqual([
      { num: 1, lane: 4 },
      { num: 2, lane: 5 },
      { num: 3, lane: 7 },
    ]);
    expect(plan.held).toEqual([]);
  });

  it('a sibling-name-prefix rival pair (src/x vs src/x-2) BOTH launch — segment-boundary non-overlap', () => {
    // Hardens the keystone's most dangerous property at the DISPATCHER layer: `src/x` must NOT be read as a
    // prefix of `src/x-2` (a path-SEGMENT boundary, not a raw string prefix), so the two are disjoint and both
    // launch. Pins segment-boundary non-overlap here directly, not only transitively via scope-lease.test.mjs,
    // so a future swap of the overlap primitive can't silently start double-booking sibling-named scopes.
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/x'] },
        { num: 2, scope: ['src/x-2'] },
      ],
      leases: [],
      freeLanes: [3, 4],
    });
    expect(plan.launch).toEqual([
      { num: 1, lane: 3 },
      { num: 2, lane: 4 },
    ]);
    expect(plan.held).toEqual([]);
  });
});

describe('dispatchPlan — overlap with an ACTIVE lease → held "overlaps lane-<n>"', () => {
  it('holds an item whose scope intersects a running lane, naming that lane', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, scope: ['src/shared/util.ts'] }],
      leases: [{ lane: 9, scope: ['src/shared/'] }],
      freeLanes: [2, 3],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'overlaps lane-9' }]);
  });

  it('a disjoint item still launches while an overlapping sibling holds', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/shared/'] }, // overlaps lease lane-9
        { num: 2, scope: ['src/other/'] }, // disjoint → launches
      ],
      leases: [{ lane: 9, scope: ['src/shared/x.ts'] }],
      freeLanes: [4],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 4 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'overlaps lane-9' }]);
  });
});

describe('dispatchPlan — rival pair: two queued items overlap, neither running → higher rank launches', () => {
  it('launches the higher-ranked rival and holds the lower on the rival\'s lane', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/backlog-view/'] }, // higher rank → launches
        { num: 2, scope: ['src/backlog-view/list.ts'] }, // overlaps #1 → holds
      ],
      leases: [],
      freeLanes: [5, 6],
    });
    expect(plan.launch).toEqual([{ num: 1, lane: 5 }]);
    expect(plan.held).toEqual([{ num: 2, reason: 'overlaps lane-5' }]);
  });

  it('a higher rival that itself HELD does not block a lower item via the rival rule', () => {
    // #1 overlaps an active lease (held, not launched); #2 overlaps #1 but NOT the lease, so #2 is free to run.
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/x/', 'src/lease-owned/'] }, // held on the lease
        { num: 2, scope: ['src/x/'] }, // overlaps #1 (parked) only → launches
      ],
      leases: [{ lane: 8, scope: ['src/lease-owned/'] }],
      freeLanes: [3],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 3 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'overlaps lane-8' }]);
  });
});

describe('dispatchPlan — no free lane', () => {
  it('holds disjoint items once the free lanes run out, in rank order', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/a/'] },
        { num: 2, scope: ['src/b/'] },
        { num: 3, scope: ['src/c/'] },
      ],
      leases: [],
      freeLanes: [7], // only one slot
    });
    expect(plan.launch).toEqual([{ num: 1, lane: 7 }]);
    expect(plan.held).toEqual([
      { num: 2, reason: 'no free lane' },
      { num: 3, reason: 'no free lane' },
    ]);
  });

  it('with zero free lanes every disjoint item holds "no free lane"', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, scope: ['src/a/'] }],
      leases: [],
      freeLanes: [],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'no free lane' }]);
  });
});

describe('dispatchPlan — blocked', () => {
  it('holds an item with open blockers as "blocked" (array shape)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, scope: ['src/a/'], openBlockers: ['42'] }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'blocked' }]);
  });

  it('holds an item with open blockers as "blocked" (count shape)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, scope: ['src/a/'], openBlockers: 2 }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.held).toEqual([{ num: 1, reason: 'blocked' }]);
  });

  it('blocked takes precedence over a missing scope', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, openBlockers: ['9'] }], // no scope AND blocked → blocked wins
      leases: [],
      freeLanes: [2],
    });
    expect(plan.held).toEqual([{ num: 1, reason: 'blocked' }]);
  });
});

describe('dispatchPlan — needs-probe (no scope field)', () => {
  it('holds an item that declares no scope as "needs-probe"', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1 }], // undefined scope
      leases: [],
      freeLanes: [2],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-probe' }]);
  });

  it('an EMPTY scope array reads as undeclared → needs-probe (identical to an absent scope)', () => {
    // The ratified empty-scope contract (#663 review): [] is NOT a "touches nothing" launch — it is the
    // un-safe declaration, so the core treats it exactly like an absent scope. This keeps the pure core
    // aligned with the loader (normalizeScope [] → undefined) and check:standards (errors on []).
    const plan = dispatchPlan({ queue: [{ num: 1, scope: [] }], leases: [], freeLanes: [2] });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-probe' }]);
  });

  it('needs-probe holds even when a free lane is available; a scoped sibling still launches', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1 }, // needs-probe
        { num: 2, scope: ['src/b/'] }, // launches
      ],
      leases: [],
      freeLanes: [3, 4],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 3 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-probe' }]);
  });
});

describe('dispatchPlan — mixed tick pins the full precedence + ordering', () => {
  it('resolves blocked / needs-probe / lease-overlap / rival / launch / no-free-lane together', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/a/'], openBlockers: ['5'] }, // blocked
        { num: 2 }, // needs-probe
        { num: 3, scope: ['src/leased/'] }, // overlaps active lease lane-9
        { num: 4, scope: ['src/feature/'] }, // launches → lane-10
        { num: 5, scope: ['src/feature/sub/'] }, // rival of #4 → overlaps lane-10
        { num: 6, scope: ['src/lonely/'] }, // launches → lane-11
        { num: 7, scope: ['src/last/'] }, // disjoint but no lane left → no free lane
      ],
      leases: [{ lane: 9, scope: ['src/leased/'] }],
      freeLanes: [10, 11],
    });
    expect(plan.launch).toEqual([
      { num: 4, lane: 10 },
      { num: 6, lane: 11 },
    ]);
    expect(plan.held).toEqual([
      { num: 1, reason: 'blocked' },
      { num: 2, reason: 'needs-probe' },
      { num: 3, reason: 'overlaps lane-9' },
      { num: 5, reason: 'overlaps lane-10' },
      { num: 7, reason: 'no free lane' },
    ]);
  });
});

describe('dispatchPlan — defensive input handling', () => {
  it('returns an empty plan for empty / missing inputs', () => {
    expect(dispatchPlan({})).toEqual({ launch: [], held: [] });
    expect(dispatchPlan()).toEqual({ launch: [], held: [] });
  });
});

describe('selectClearedRows — cleared set comes from the SESSION-LOCAL sidecar, not committed buildQueued (#2613)', () => {
  // The shell's new membership rule: an item is in the conveyor queue IFF its num is in `.conveyor/queue.json`
  // (the sidecar), NOT because it carries committed `buildQueued:true` frontmatter. Rank order (the row order
  // the build-queue engine emits) is preserved; only membership moved to the sidecar.
  const rows = [
    { num: 100, buildQueued: true }, // committed-cleared but NOT in the sidecar → dropped
    { num: 200, buildQueued: false }, // in the sidecar → kept, despite no committed flag
    { num: 300, buildQueued: true }, // in the sidecar → kept
  ];

  it('keeps only sidecar members, in rank order — a committed buildQueued NOT in the sidecar is dropped', () => {
    const cleared = new Set(['200', '300'].map(normNum));
    expect(selectClearedRows(rows, cleared, normNum)).toEqual([
      { num: 200, buildQueued: false },
      { num: 300, buildQueued: true },
    ]);
  });

  it('a sidecar item with NO committed buildQueued flag is still dispatched (pins the inverted source)', () => {
    const cleared = new Set(['200'].map(normNum));
    expect(selectClearedRows(rows, cleared, normNum)).toEqual([{ num: 200, buildQueued: false }]);
  });

  it('an empty sidecar dispatches nothing even when rows carry committed buildQueued:true', () => {
    expect(selectClearedRows(rows, new Set(), normNum)).toEqual([]);
  });

  it('membership is padding-tolerant (sidecar "042" matches row num 42)', () => {
    const cleared = new Set(['042'].map(normNum));
    expect(selectClearedRows([{ num: 42 }], cleared, normNum)).toEqual([{ num: 42 }]);
  });

  it('defensive: non-array rows → []', () => {
    expect(selectClearedRows(null, new Set(['1']), normNum)).toEqual([]);
  });
});
