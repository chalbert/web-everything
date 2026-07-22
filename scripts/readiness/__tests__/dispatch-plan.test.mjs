/**
 * @file scripts/readiness/__tests__/dispatch-plan.test.mjs
 * @description Unit proof of the conveyor DISPATCHER's PURE core (WE #x53zzf9). Drives {@link dispatchPlan}
 *   directly with plain objects (NO git/network) and pins every branch of the dispatch rules:
 *   the disjoint happy path (free lanes fill in rank order), overlap-with-an-active-lease, the rival pair
 *   (higher rank wins), no-free-lane, blocked, and needs-probe — plus the precedence between them.
 */
import { describe, it, expect } from 'vitest';
import { dispatchPlan } from '../dispatch-plan.mjs';

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

  it('an empty scope array is a valid (touches-nothing) declaration — it launches, never needs-probe', () => {
    const plan = dispatchPlan({ queue: [{ num: 1, scope: [] }], leases: [], freeLanes: [2] });
    expect(plan.launch).toEqual([{ num: 1, lane: 2 }]);
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
