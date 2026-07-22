/**
 * @file scripts/readiness/__tests__/conveyor-state.test.mjs
 * @description Unit proof of the CONVEYOR TICK STATE-READ's PURE core (WE #2611, epic #2612). Drives every
 *   `shape*` / `derive*` / `assess*` fn and the top-level {@link assembleConveyorState} composer directly with
 *   fixtures (NO real git / gh / fs / clock — `now` is injected). Three representative end-to-end ticks pin the
 *   whole shape: a HEALTHY tick, a STALLED-LANE tick (transcript mtime past the stall threshold → verdict warn),
 *   and a DAEMON-UNAVAILABLE tick (a null report degrades to the `"unavailable"` sentinel, not a crash).
 */
import { describe, it, expect } from 'vitest';
import {
  shapeQueue,
  itemNumFromRef,
  ciRollup,
  shapePrs,
  shapeLanes,
  computeFreeSlots,
  shapeDaemon,
  lastMergeFromDaemon,
  lastQueueAddFromQueued,
  deriveIdle,
  transcriptMentionsItem,
  assessHealth,
  assembleConveyorState,
  DEFAULT_STALL_MS,
} from '../conveyor-state.mjs';

describe('shapeQueue — ready/queued build-queue rows → the tick queue shape', () => {
  it('maps num/rank/buildQueued and defaults openBlockers/scope defensively', () => {
    const buildQueue = { queue: [{ num: '554', rank: null, buildQueued: false }, { num: 42, rank: 3, buildQueued: true }] };
    expect(shapeQueue(buildQueue)).toEqual([
      { num: '554', rank: null, buildQueued: false, openBlockers: [], scope: null },
      { num: '42', rank: 3, buildQueued: true, openBlockers: [], scope: null },
    ]);
  });
  it('reads a bare row array too', () => {
    expect(shapeQueue([{ num: '1' }])).toEqual([{ num: '1', rank: null, buildQueued: false, openBlockers: [], scope: null }]);
  });
  it('picks up openBlockers / blockedBy / scope when a producer annotates them', () => {
    expect(shapeQueue([{ num: '9', openBlockers: [7, 8], scope: ['we:src/a.ts'] }])[0]).toEqual({
      num: '9', rank: null, buildQueued: false, openBlockers: ['7', '8'], scope: ['we:src/a.ts'],
    });
    expect(shapeQueue([{ num: '9', blockedBy: ['10'] }])[0].openBlockers).toEqual(['10']);
  });
  it('tolerates null / missing queue → []', () => {
    expect(shapeQueue(null)).toEqual([]);
    expect(shapeQueue({})).toEqual([]);
  });
});

describe('itemNumFromRef — item id out of a lane headRef', () => {
  it('extracts a numeric id', () => expect(itemNumFromRef('lane/2611-conveyor-state')).toBe('2611'));
  it('extracts a numeric id with no slug', () => expect(itemNumFromRef('lane/2611')).toBe('2611'));
  it('extracts a JIT slug id', () => expect(itemNumFromRef('lane/xe2fmix-slug')).toBe('xe2fmix'));
  it('a word-first ref falls back to the TRAILING digits (never the leading word)', () => {
    expect(itemNumFromRef('lane/hotfix-2611')).toBe('2611'); // not 'hotfix'
  });
  it('a word-only ref (no id anywhere) → null, never a silent wrong id', () => {
    expect(itemNumFromRef('lane/hotfix')).toBe(null);
    expect(itemNumFromRef('lane/conveyor-work')).toBe(null);
  });
  it('is null for a non-lane / empty ref', () => {
    expect(itemNumFromRef('main')).toBe(null);
    expect(itemNumFromRef(null)).toBe(null);
  });
});

describe('ciRollup — statusCheckRollup → one CI token', () => {
  it('none for an empty rollup', () => expect(ciRollup([])).toBe('none'));
  it('pass when every check is complete & green', () => {
    expect(ciRollup([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { state: 'SUCCESS' }])).toBe('pass');
  });
  it('fail when any check is definitively red (wins over pending)', () => {
    expect(ciRollup([{ status: 'IN_PROGRESS' }, { conclusion: 'FAILURE' }])).toBe('fail');
  });
  it('pending when a check is still running and none failed', () => {
    expect(ciRollup([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS' }])).toBe('pending');
  });
  it('SKIPPED / NEUTRAL conclusions count as complete-green (→ pass)', () => {
    expect(ciRollup([{ status: 'COMPLETED', conclusion: 'SKIPPED' }, { status: 'COMPLETED', conclusion: 'NEUTRAL' }])).toBe('pass');
  });
  it('a legacy commit StatusContext state:PENDING → pending', () => {
    expect(ciRollup([{ state: 'SUCCESS' }, { state: 'PENDING' }])).toBe('pending');
  });
  it('a legacy commit StatusContext state:ERROR → fail', () => {
    expect(ciRollup([{ state: 'SUCCESS' }, { state: 'ERROR' }])).toBe('fail');
  });
  it('a COMPLETED run with a null/absent conclusion → pending (not silently green)', () => {
    expect(ciRollup([{ status: 'COMPLETED' }])).toBe('pending');
    expect(ciRollup([{ status: 'COMPLETED', conclusion: null }])).toBe('pending');
  });
});

describe('transcriptMentionsItem — ANCHORED item-id match (no #26-masks-#2611 false hit)', () => {
  it('matches the exact id followed by a non-alphanumeric', () => {
    expect(transcriptMentionsItem('working on #2611 ("conveyor")', '2611')).toBe(true);
    expect(transcriptMentionsItem('done #2611.', '2611')).toBe(true);
  });
  it('#26 does NOT match a longer #2611 / #260 (the stall-masking false hit)', () => {
    expect(transcriptMentionsItem('working on #2611', '26')).toBe(false);
    expect(transcriptMentionsItem('working on #260', '26')).toBe(false);
  });
  it('#261 does NOT match the #261x family', () => {
    expect(transcriptMentionsItem('see #2613 and #2614', '261')).toBe(false);
  });
  it('a JIT slug matches exactly, not a longer slug', () => {
    expect(transcriptMentionsItem('item #xe2fmix here', 'xe2fmix')).toBe(true);
    expect(transcriptMentionsItem('item #xe2fmixy here', 'xe2fmix')).toBe(false);
  });
  it('empty text / null num → false', () => {
    expect(transcriptMentionsItem('', '2611')).toBe(false);
    expect(transcriptMentionsItem('#2611', null)).toBe(false);
  });
});

describe('shapePrs — gh pr list → the in-flight PR shape', () => {
  it('maps num(from headRef)/prNumber/state/ci/labels', () => {
    const prs = shapePrs([
      { number: 658, state: 'OPEN', headRefName: 'lane/2611-conveyor-state', statusCheckRollup: [{ conclusion: 'SUCCESS' }], labels: [{ name: 'review:human' }] },
    ]);
    expect(prs).toEqual([{ num: '2611', prNumber: 658, state: 'OPEN', ci: 'pass', labels: ['review:human'] }]);
  });
  it('tolerates a bare-string label array and a missing rollup', () => {
    expect(shapePrs([{ number: 1, headRefName: 'lane/5-x', labels: ['a'] }])[0]).toEqual({
      num: '5', prNumber: 1, state: '', ci: 'none', labels: ['a'],
    });
  });
  it('null list → []', () => expect(shapePrs(null)).toEqual([]));
});

// A lane-pool `status --json` row + the scope-lease-collect picture leases share the lane index.
const poolRow = (lane, { leased = true, session = `sess-${lane}`, predictedScope, exists = true } = {}) => ({
  lane, path: `/pool/lane-${lane}`, exists, leased,
  lease: leased ? { session, ...(predictedScope ? { predictedScope } : {}) } : null,
});
const picLease = (lane, { predicted = [], breach = [], session = `sess-${lane}` } = {}) => ({ lane, session, predicted, observed: predicted, breach, clean: breach.length === 0 });

describe('shapeLanes — pool rows × scope picture → the tick lanes shape', () => {
  it('keeps only live-leased lanes and crosses in predicted scope + breach', () => {
    const poolStatus = { lanes: [poolRow(1, { predictedScope: ['we:src/a.ts'] }), poolRow(2, { leased: false })] };
    const scopePicture = { leases: [picLease(1, { predicted: ['we:src/a.ts'], breach: ['we:src/x.ts'] })] };
    const lanes = shapeLanes({ poolStatus, scopePicture, laneItem: { 1: '2611' } });
    expect(lanes).toEqual([{ lane: 1, num: '2611', session: 'sess-1', lease: ['we:src/a.ts'], breach: ['we:src/x.ts'] }]);
  });
  it('falls back to the marker predictedScope when the picture has no lease, num null when unmapped', () => {
    const poolStatus = { lanes: [poolRow(3, { predictedScope: ['we:src/m.ts'] })] };
    const lanes = shapeLanes({ poolStatus, scopePicture: { leases: [] } });
    expect(lanes[0]).toEqual({ lane: 3, num: null, session: 'sess-3', lease: ['we:src/m.ts'], breach: [] });
  });
});

describe('computeFreeSlots — free (existing, unleased) lanes', () => {
  it('counts unleased existing lanes only', () => {
    const poolStatus = { lanes: [poolRow(1), poolRow(2, { leased: false }), poolRow(3, { leased: false }), { lane: 4, exists: false, leased: false }] };
    expect(computeFreeSlots(poolStatus)).toBe(2);
  });
  it('null pool → 0', () => expect(computeFreeSlots(null)).toBe(0));
});

describe('shapeDaemon — plateau daemon status report → the daemon section (or "unavailable")', () => {
  it('distills resident / lastPass / parked from the real report shape', () => {
    const report = { launchd: { loaded: true }, lastPass: { at: '2026-07-22T14:56:07.141Z', merged: 0 }, parkedNow: [{ num: 104, repo: 'chalbert/plateau-app' }] };
    expect(shapeDaemon(report)).toEqual({ resident: true, lastPass: report.lastPass, parked: report.parkedNow });
  });
  it('a null/absent report → the "unavailable" sentinel (graceful degrade)', () => {
    expect(shapeDaemon(null)).toBe('unavailable');
    expect(shapeDaemon(undefined)).toBe('unavailable');
  });
});

describe('idle-clock inputs — last merge / last queue-add', () => {
  it('lastMergeFromDaemon = newest `at` among passes that merged something', () => {
    const report = { lastPass: { at: '2026-07-22T15:00:00.000Z', merged: 0 }, history: [{ at: '2026-07-22T13:00:00.000Z', merged: 2 }, { at: '2026-07-22T14:00:00.000Z', merged: 1 }] };
    expect(lastMergeFromDaemon(report)).toBe('2026-07-22T14:00:00.000Z');
  });
  it('lastMergeFromDaemon null when nothing merged / daemon unavailable', () => {
    expect(lastMergeFromDaemon({ lastPass: { at: 'x', merged: 0 }, history: [] })).toBe(null);
    expect(lastMergeFromDaemon(null)).toBe(null);
  });
  it('lastQueueAddFromQueued = newest queued `at`', () => {
    expect(lastQueueAddFromQueued({ queued: [{ num: '1', at: '2026-07-22T10:00:00Z' }, { num: '2', at: '2026-07-22T12:00:00Z' }] })).toBe('2026-07-22T12:00:00Z');
    expect(lastQueueAddFromQueued({ queued: [] })).toBe(null);
  });
  it('deriveIdle passes the injected now through and never calls Date', () => {
    const idle = deriveIdle({ daemonReport: null, queuedState: { queued: [] }, now: 1234 });
    expect(idle).toEqual({ lastMerge: null, lastQueueAdd: null, now: 1234 });
  });
});

describe('assessHealth — stalled-lane detection via transcript mtimes', () => {
  const now = 1_000_000_000_000;
  it('ok when no lane is past the stall threshold', () => {
    const lanes = [{ lane: 1, num: '2611', lastActivity: now - 10_000 }];
    expect(assessHealth({ lanes, now })).toEqual({ verdict: 'ok', stalled: [], errors: [] });
  });
  it('warn + a stalled entry when a lane is silent past stallMs', () => {
    const lanes = [{ lane: 1, num: '2611', session: 's1', lastActivity: now - (DEFAULT_STALL_MS + 60_000) }];
    const h = assessHealth({ lanes, now });
    expect(h.verdict).toBe('warn');
    expect(h.stalled).toEqual([{ lane: 1, num: '2611', session: 's1', idleS: Math.round((DEFAULT_STALL_MS + 60_000) / 1000) }]);
  });
  it('a lane with no located transcript (lastActivity null) is NEVER flagged', () => {
    expect(assessHealth({ lanes: [{ lane: 1, num: '2611', lastActivity: null }], now }).verdict).toBe('ok');
  });
  it('collector errors alone make the verdict warn', () => {
    expect(assessHealth({ lanes: [], now, errors: ['lane-pool status: boom'] })).toEqual({ verdict: 'warn', stalled: [], errors: ['lane-pool status: boom'] });
  });
});

// ── END-TO-END (pure) — assembleConveyorState over three representative ticks ─────────────────────────────────
describe('assembleConveyorState — the whole tick picture', () => {
  const now = 1_000_000_000_000;
  const baseInputs = () => ({
    buildQueue: { queue: [{ num: '2611', rank: 1, buildQueued: true }, { num: '2612', rank: 2, buildQueued: false }] },
    poolStatus: { lanes: [poolRow(1, { predictedScope: ['we:scripts/readiness/conveyor-state.mjs'] }), poolRow(2, { leased: false }), poolRow(3, { leased: false }) ] },
    scopePicture: { leases: [picLease(1, { predicted: ['we:scripts/readiness/conveyor-state.mjs'] })] },
    prList: [{ number: 658, state: 'OPEN', headRefName: 'lane/2611-conveyor-state', statusCheckRollup: [{ conclusion: 'SUCCESS' }], labels: [{ name: 'review:human' }] }],
    daemonReport: { launchd: { loaded: true }, lastPass: { at: '2026-07-22T15:00:00Z', merged: 0 }, history: [{ at: '2026-07-22T14:00:00Z', merged: 1 }], parkedNow: [{ num: 104, repo: 'chalbert/plateau-app' }] },
    queuedState: { queued: [{ num: '2611', at: '2026-07-22T14:30:00Z' }] },
    laneItem: { 1: '2611' },
    now,
  });

  it('HEALTHY tick — all sections populated, freeSlots counted, verdict ok', () => {
    const inputs = baseInputs();
    inputs.laneActivity = { 1: now - 5_000 }; // lane-1 active 5s ago
    const s = assembleConveyorState(inputs);
    expect(s.queue).toHaveLength(2);
    expect(s.queue[0]).toEqual({ num: '2611', rank: 1, buildQueued: true, openBlockers: [], scope: null });
    expect(s.lanes).toEqual([{ lane: 1, num: '2611', session: 'sess-1', lease: ['we:scripts/readiness/conveyor-state.mjs'], breach: [] }]);
    expect(s.freeSlots).toBe(2);
    expect(s.prs).toEqual([{ num: '2611', prNumber: 658, state: 'OPEN', ci: 'pass', labels: ['review:human'] }]);
    expect(s.daemon).toEqual({ resident: true, lastPass: inputs.daemonReport.lastPass, parked: inputs.daemonReport.parkedNow });
    expect(s.idle).toEqual({ lastMerge: '2026-07-22T14:00:00Z', lastQueueAdd: '2026-07-22T14:30:00Z', now });
    expect(s.health).toEqual({ verdict: 'ok', stalled: [], errors: [] });
  });

  it('STALLED-LANE tick — a lane silent past the threshold → verdict warn + a stalled entry', () => {
    const inputs = baseInputs();
    inputs.laneActivity = { 1: now - (DEFAULT_STALL_MS + 120_000) }; // lane-1 silent > stall window
    const s = assembleConveyorState(inputs);
    expect(s.health.verdict).toBe('warn');
    expect(s.health.stalled).toEqual([{ lane: 1, num: '2611', session: 'sess-1', idleS: Math.round((DEFAULT_STALL_MS + 120_000) / 1000) }]);
    // the emitted lanes section itself stays activity-free (activity is folded in only for the health scan)
    expect('lastActivity' in s.lanes[0]).toBe(false);
  });

  it('DAEMON-UNAVAILABLE tick — a null report degrades to "unavailable" with NO health impact (real absent path)', () => {
    const inputs = baseInputs();
    // The REAL absent/errored daemon path: the shell routes a missing OR throwing daemon read to null WITHOUT
    // pushing an errors[] row (the daemon is best-effort/cross-repo), so no error is injected here.
    inputs.daemonReport = null;
    const s = assembleConveyorState(inputs);
    expect(s.daemon).toBe('unavailable');
    expect(s.idle.lastMerge).toBe(null); // no daemon ⇒ no merge clock
    expect(s.idle.lastQueueAdd).toBe('2026-07-22T14:30:00Z'); // queue-add still comes from queued.json
    expect(s.health.verdict).toBe('ok'); // a vanished daemon must NOT flip the tick to warn
    expect(s.health.errors).toEqual([]);
    // the rest of the tick is intact
    expect(s.queue).toHaveLength(2);
    expect(s.lanes).toHaveLength(1);
  });

  it('a genuine COLLECTOR error (e.g. lane-pool status failed) DOES flip the verdict to warn', () => {
    // Distinct from the best-effort daemon: a core collector failing IS surfaced as a warn (the shell passes its
    // errors[] through). This pins that the daemon is the ONLY read exempted from the health verdict.
    const inputs = baseInputs();
    inputs.errors = ['lane-pool status: spawn failed'];
    const s = assembleConveyorState(inputs);
    expect(s.health.verdict).toBe('warn');
    expect(s.health.errors).toEqual(['lane-pool status: spawn failed']);
  });
});
