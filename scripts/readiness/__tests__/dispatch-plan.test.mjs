/**
 * @file scripts/readiness/__tests__/dispatch-plan.test.mjs
 * @description Unit proof of the conveyor DISPATCHER's PURE core (WE #x53zzf9). Drives {@link dispatchPlan}
 *   directly with plain objects (NO git/network) and pins every branch of the dispatch rules:
 *   the disjoint happy path (free lanes fill in rank order), overlap-with-an-active-lease, the rival pair
 *   (higher rank wins), no-free-lane, blocked, and the UNSCOPED AUTO-PREPARE hold (#2613, ruled 2026-07-22 — an
 *   unscoped item is NEVER launched to build; it is ALWAYS held `unshaped-no-scope`, even in a fully-idle pool
 *   with free lanes, for the /conveyor skill to auto-prepare its scope) — plus the precedence between them.
 */
import { describe, it, expect } from 'vitest';
import { dispatchPlan, selectClearedRows, clearedNotReady } from '../dispatch-plan.mjs';
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

describe('dispatchPlan — a cleared kind:epic is HELD "needs-slice", never built (#2645)', () => {
  // An epic is a CONTAINER; its work lives in child stories/tasks, so it is never directly buildable. A cleared
  // epic must not launch to build AND must not fall through to the scope gate (which would auto-prepare a container).
  it('holds a scope-less epic "needs-slice" even in a fully-idle pool with free lanes (never built, never auto-prepared)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'epic' }], // no scope, but epic → needs-slice, NOT unshaped-no-scope
      leases: [],
      freeLanes: [2, 3],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-slice' }]);
  });

  it('holds an epic "needs-slice" even when it carries a scope (an epic is never a direct build)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'epic', scope: ['src/a/'] }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-slice' }]);
  });

  it('blocked takes precedence over needs-slice (a blocked epic can\'t be sliced until its blockers clear)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'epic', openBlockers: ['9'] }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.held).toEqual([{ num: 1, reason: 'blocked' }]);
  });

  it('needs-slice holds the epic while a disjoint story on the same tick still launches', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, kind: 'epic', scope: ['src/a/'] }, // epic → held needs-slice
        { num: 2, kind: 'story', scope: ['src/b/'] }, // buildable story → launches
      ],
      leases: [],
      freeLanes: [7],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 7 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-slice' }]);
  });

  it('a non-epic with no kind field still flows through the normal scope/launch path (no false needs-slice)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, scope: ['src/a/'] }], // kind absent → not an epic → launches
      leases: [],
      freeLanes: [4],
    });
    expect(plan.launch).toEqual([{ num: 1, lane: 4 }]);
    expect(plan.held).toEqual([]);
  });
});

describe('dispatchPlan — a cleared kind:decision is HELD "needs-decision", never built (#2647)', () => {
  // A decision is NOT build work; its lifecycle is prepare (research + author forks) then present (surface to
  // ratify). Like an epic, a cleared decision must not launch to build AND must not fall through to the scope gate
  // (which would aim a prepare-SCOPE agent at an item that has no build touch-set).
  it('holds a scope-less decision "needs-decision" even in a fully-idle pool with free lanes (never built, never scope-auto-prepared)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'decision' }], // no scope, but decision → needs-decision, NOT unshaped-no-scope
      leases: [],
      freeLanes: [2, 3],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-decision' }]);
  });

  it('holds a decision "needs-decision" even when it somehow carries a scope (a decision is never a direct build)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'decision', scope: ['src/a/'] }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-decision' }]);
  });

  it('blocked takes precedence over needs-decision (a blocked decision can\'t be prepared until its blockers clear)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1, kind: 'decision', openBlockers: ['9'] }],
      leases: [],
      freeLanes: [2],
    });
    expect(plan.held).toEqual([{ num: 1, reason: 'blocked' }]);
  });

  it('needs-decision holds the decision while a disjoint story on the same tick still launches', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, kind: 'decision' }, // decision → held needs-decision
        { num: 2, kind: 'story', scope: ['src/b/'] }, // buildable story → launches
      ],
      leases: [],
      freeLanes: [7],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 7 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'needs-decision' }]);
  });
});

describe('dispatchPlan — the UNSCOPED AUTO-PREPARE hold (#2613, ruled 2026-07-22)', () => {
  // An unscoped item is "assume-overlaps-everything" and is NEVER launched to build — not even alone into an idle
  // pool. It is ALWAYS held `unshaped-no-scope` so the /conveyor skill auto-prepares its scope upstream; once that
  // lands the item is scoped and dispatches to BUILD on a later tick. The conveyor never builds without scope and
  // never dispatches blind. These cases pin: no serial "run-alone" launch exists anywhere.

  it('an unscoped item is HELD "unshaped-no-scope" even in a fully-idle pool with free lanes (never built blind)', () => {
    // THE point of auto-prepare: an idle pool + free lanes is NOT permission to build an unscoped item. It holds
    // so the skill authors its scope first. (The old serial floor launched it here — that branch is deleted.)
    const plan = dispatchPlan({ queue: [{ num: 1 }], leases: [], freeLanes: [2, 3] });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'unshaped-no-scope' }]);
  });

  it('an EMPTY scope array is treated identically to absent → held "unshaped-no-scope"', () => {
    // The #663 empty-scope contract: [] is NOT a "touches nothing" launch — it is undeclared, so it reads as
    // unscoped and holds for auto-prepare. Keeps the pure core aligned with the loader (normalizeScope [] →
    // undefined) and check:standards (errors on []).
    const plan = dispatchPlan({ queue: [{ num: 1, scope: [] }], leases: [], freeLanes: [2] });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'unshaped-no-scope' }]);
  });

  it('an unscoped item is HELD "unshaped-no-scope" when a lease is active too (uniform, pool-state-independent)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1 }], // unscoped
      leases: [{ lane: 9, scope: ['src/anything/'] }], // a lane is running
      freeLanes: [2, 3],
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'unshaped-no-scope' }]);
  });

  it('multiple unscoped items → ALL hold "unshaped-no-scope" (none launches, even with free lanes to spare)', () => {
    const plan = dispatchPlan({
      queue: [{ num: 1 }, { num: 2 }, { num: 3 }],
      leases: [],
      freeLanes: [5, 6, 7], // plenty of free lanes — still nothing builds unscoped
    });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([
      { num: 1, reason: 'unshaped-no-scope' },
      { num: 2, reason: 'unshaped-no-scope' },
      { num: 3, reason: 'unshaped-no-scope' },
    ]);
  });

  it('a scoped + an unscoped item → the SCOPED launches, the unscoped holds for auto-prepare', () => {
    // Scoped items dispatch normally (pass unchanged); the unscoped item holds regardless of its rank or free
    // lanes — it is never launched to build, only auto-prepared. Held stays in queue order.
    const plan = dispatchPlan({
      queue: [
        { num: 1 }, // unscoped, higher rank → held for auto-prepare
        { num: 2, scope: ['src/b/'] }, // scoped → launches
      ],
      leases: [],
      freeLanes: [3, 4],
    });
    expect(plan.launch).toEqual([{ num: 2, lane: 3 }]);
    expect(plan.held).toEqual([{ num: 1, reason: 'unshaped-no-scope' }]);
  });

  it('an unscoped item with NO free lane also holds "unshaped-no-scope" (unscoped is checked before lanes)', () => {
    const plan = dispatchPlan({ queue: [{ num: 1 }], leases: [], freeLanes: [] });
    expect(plan.launch).toEqual([]);
    expect(plan.held).toEqual([{ num: 1, reason: 'unshaped-no-scope' }]);
  });
});

describe('dispatchPlan — mixed tick pins the full precedence + ordering', () => {
  it('resolves blocked / unscoped / lease-overlap / rival / launch / no-free-lane together', () => {
    const plan = dispatchPlan({
      queue: [
        { num: 1, scope: ['src/a/'], openBlockers: ['5'] }, // blocked
        { num: 2 }, // unscoped → held unshaped-no-scope (never launched; auto-prepared)
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
    // ONE pass now — holds come out in QUEUE order (no deferred second pass), so the unscoped #2 sorts in its
    // queue position (second), NOT last.
    expect(plan.held).toEqual([
      { num: 1, reason: 'blocked' },
      { num: 2, reason: 'unshaped-no-scope' },
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

  it('a `#`-spelled sidecar id matches a bare-numeric row (#2613 review req 1)', () => {
    const cleared = new Set(['#2613'].map(normNum)); // operator typed `#2613`
    expect(selectClearedRows([{ num: 2613 }, { num: 7 }], cleared, normNum)).toEqual([{ num: 2613 }]);
  });
});

describe('clearedNotReady — a cleared id with no ready row is surfaced, never silently dropped (#2613 review req 2b)', () => {
  const readyRows = [{ num: 200 }, { num: 300 }];

  it('returns the cleared ids that have NO ready build-queue row (blocked / resolved / typo / unknown)', () => {
    const sidecar = [{ num: '200' }, { num: '999' }, { num: 'ghost' }];
    expect(clearedNotReady(sidecar, readyRows, normNum)).toEqual(['999', 'ghost']);
  });

  it('preserves the stored spelling for display and is padding/`#`-tolerant', () => {
    // "042" IS ready (row 200? no — 042→42, not ready); "#300" IS ready (→300); "#42" is NOT ready.
    const sidecar = [{ num: '#300' }, { num: '#42' }];
    expect(clearedNotReady(sidecar, readyRows, normNum)).toEqual(['#42']);
  });

  it('everything ready → [] (nothing to flag)', () => {
    expect(clearedNotReady([{ num: '200' }, { num: 300 }], readyRows, normNum)).toEqual([]);
  });

  it('accepts bare-id entries and tolerates empty/missing input', () => {
    expect(clearedNotReady(['999', 200], readyRows, normNum)).toEqual(['999']);
    expect(clearedNotReady(null, readyRows, normNum)).toEqual([]);
    expect(clearedNotReady([{ num: '' }, { num: null }], readyRows, normNum)).toEqual([]);
  });
});
