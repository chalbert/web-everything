/**
 * @file scripts/conveyor/__tests__/status-board.test.mjs
 * @description Unit proof of the CONVEYOR STATUS BOARD renderer (WE #2613, epic #2612). Drives the PURE
 *   {@link renderBoard} directly with fixture state objects (NO real git / gh / fs / clock) — the same
 *   `conveyor-state.mjs --json` shape it consumes in production. Four representative boards pin the whole
 *   render: a FULL board (running + preparing + queued + blocked + needs-you), an EMPTY/idle board, an
 *   ALL-UNSHAPED board, and a DAEMON-UNAVAILABLE + health-warn board. Asserts the header counts, that each
 *   section renders its rows, that empty sections are OMITTED, and that a null/partial state never throws.
 */
import { describe, it, expect } from 'vitest';
import { renderBoard, laneMarker, MARKERS } from '../status-board.mjs';

// ── laneMarker — the lane state derivation (paused ▸ parked ▸ preparing ▸ building, first match wins). ──
describe('laneMarker — active-lane state derivation', () => {
  const noPrs = new Map();
  it('a non-empty breach set → paused (wins over everything)', () => {
    expect(laneMarker({ breach: ['we:a.ts'], lease: ['we:a.ts'] }, noPrs)).toBe('paused');
  });
  it("a lane whose PR carries a review label → parked", () => {
    const prByNum = new Map([['2547', { prNumber: 612, labels: ['review:human'] }]]);
    expect(laneMarker({ num: '2547', lease: ['we:a.ts'] }, prByNum)).toBe('parked');
  });
  it('leased but no predicted scope declared → preparing', () => {
    expect(laneMarker({ num: '2547', lease: [] }, noPrs)).toBe('preparing');
  });
  it('leased with scope, no breach, no review PR → building', () => {
    expect(laneMarker({ num: '2547', lease: ['we:a.ts'] }, noPrs)).toBe('building');
  });
});

// ── A FULL board: running (building + paused + review-parked) · preparing · queued · blocked · needs-you. ──
describe('renderBoard — a full board', () => {
  const state = {
    queue: [
      { num: '2547', rank: 1, buildQueued: true, openBlockers: [], scope: ['we:src/a.ts'] }, // ready
      { num: '2601', rank: 2, buildQueued: true, openBlockers: ['2600'], scope: ['we:src/b.ts'] }, // blocked
      { num: '2610', rank: 3, buildQueued: true, openBlockers: [], scope: null }, // unshaped (no scope)
      { num: '999', rank: 4, buildQueued: false, openBlockers: [], scope: ['we:src/c.ts'] }, // NOT cleared — omitted
    ],
    clearedNotReady: ['4242'],
    unshaped: [{ num: '2610', scope: null }],
    lanes: [
      { lane: 1, num: '2530', session: 'conveyor-2530', lease: ['we:src/x.ts'], breach: [] }, // building
      { lane: 2, num: '2531', session: 'conveyor-2531', lease: ['we:src/y.ts'], breach: [] }, // review-parked (PR below)
      { lane: 3, num: '2532', session: 'conveyor-2532', lease: ['we:src/z.ts'], breach: ['we:src/z.ts'] }, // paused-breach
    ],
    freeSlots: 5,
    prs: [
      { num: '2531', prNumber: 612, state: 'OPEN', ci: 'pass', labels: ['review:human'] },
      { num: '2530', prNumber: 610, state: 'OPEN', ci: 'pending', labels: [] },
    ],
    daemon: { resident: true, lastPass: null, parked: [] },
    idle: { lastMerge: null, lastQueueAdd: null, now: 1 },
    health: { verdict: 'ok', stalled: [], errors: [] },
  };
  const board = renderBoard(state);

  it('header counts each section and reports lanes-free / health / daemon', () => {
    // 3 running lanes · 1 preparing (unshaped) · 3 queued (ready + blocked + cleared-not-ready) · 1 needs-you.
    expect(board).toContain(
      'CONVEYOR · 3 running · 1 preparing · 3 queued · 1 needs-you · 5/8 lanes free · health ok · daemon resident',
    );
  });
  it('RUNNING renders one line per active lane with its state marker', () => {
    expect(board).toContain('RUNNING');
    expect(board).toContain(`${MARKERS.building} #2530 building`);
    expect(board).toContain(`${MARKERS.parked} #2531 review-parked (PR #612)`);
    expect(board).toContain(`${MARKERS.paused} #2532 paused-breach (breach on 1 path)`);
  });
  it('QUEUE renders each cleared item with WHY it waits, in dispatch-plan language', () => {
    expect(board).toContain('QUEUE');
    expect(board).toContain(`#2547`);
    expect(board).toContain('ready · will launch');
    expect(board).toContain('blocked · waits on #2600');
    expect(board).toContain('preparing scope');
    expect(board).toContain('cleared-but-not-ready');
  });
  it('NEEDS YOU lists the parked PR with the /review action', () => {
    expect(board).toContain('NEEDS YOU');
    expect(board).toContain(`#2531`);
    expect(board).toContain(`${MARKERS.parked} PR #612 review:human → /review 612`);
  });
  it('omits an uncleared (buildQueued:false) queue item', () => {
    expect(board).not.toContain('#999');
  });
});

// ── An EMPTY / idle board: only the header + the idle note; every section omitted. ──
describe('renderBoard — an empty/idle board', () => {
  const board = renderBoard({
    queue: [],
    clearedNotReady: [],
    unshaped: [],
    lanes: [],
    freeSlots: 8,
    prs: [],
    daemon: { resident: true, parked: [] },
    idle: {},
    health: { verdict: 'ok', stalled: [], errors: [] },
  });
  it('header shows all-zero counts and 8/8 lanes free', () => {
    expect(board).toContain('CONVEYOR · 0 running · 0 preparing · 0 queued · 0 needs-you · 8/8 lanes free · health ok · daemon resident');
  });
  it('omits every empty section', () => {
    expect(board).not.toContain('RUNNING');
    expect(board).not.toContain('QUEUE');
    expect(board).not.toContain('NEEDS YOU');
  });
  it('renders the honest idle note', () => {
    expect(board).toContain('conveyor idle');
  });
});

// ── An ALL-UNSHAPED board: every cleared item lacks scope → all preparing, none ready. ──
describe('renderBoard — an all-unshaped board', () => {
  const state = {
    queue: [
      { num: 'xa1', buildQueued: true, openBlockers: [], scope: null },
      { num: 'xa2', buildQueued: true, openBlockers: [], scope: [] },
    ],
    clearedNotReady: [],
    unshaped: [{ num: 'xa1', scope: null }, { num: 'xa2', scope: [] }],
    lanes: [],
    freeSlots: 4,
    prs: [],
    daemon: { resident: true, parked: [] },
    idle: {},
    health: { verdict: 'ok', stalled: [], errors: [] },
  };
  const board = renderBoard(state);
  it('counts both as preparing and none as queued/running', () => {
    expect(board).toContain('CONVEYOR · 0 running · 2 preparing · 0 queued · 0 needs-you · 4/4 lanes free · health ok · daemon resident');
  });
  it('QUEUE marks each as preparing scope', () => {
    expect(board).toContain('QUEUE');
    expect(board).toContain('#xa1');
    expect(board).toContain('#xa2');
    expect(board.match(/preparing scope/g)?.length).toBe(2);
  });
  it('no lane is running', () => {
    expect(board).not.toContain('RUNNING');
  });
});

// ── A DAEMON-UNAVAILABLE + health-warn board: footer surfaces the stall + the absent daemon. ──
describe('renderBoard — daemon unavailable + health warn', () => {
  const state = {
    queue: [],
    clearedNotReady: [],
    unshaped: [],
    lanes: [{ lane: 7, num: '2200', session: 'conveyor-2200', lease: ['we:src/a.ts'], breach: [] }],
    freeSlots: 3,
    prs: [],
    daemon: 'unavailable',
    idle: {},
    health: { verdict: 'warn', stalled: [{ lane: 7, num: '2200', session: 'conveyor-2200', idleS: 240 }], errors: ['lane-pool status: boom'] },
  };
  const board = renderBoard(state);
  it('header reports the daemon as unavailable and health as warn', () => {
    expect(board).toContain('health warn');
    expect(board).toContain('daemon unavailable');
  });
  it('footer surfaces the stalled lane and the collector error', () => {
    expect(board).toContain(`${MARKERS.attention} stalled: lane-7 #2200 (240s idle)`);
    expect(board).toContain(`${MARKERS.attention} errors: lane-pool status: boom`);
  });
  it('footer warns the drain daemon is unavailable', () => {
    expect(board).toContain('drain daemon unavailable');
  });
});

// ── Graceful degradation: null / partial / missing state never throws. ──
describe('renderBoard — degrades gracefully', () => {
  it('null state renders the header, not a throw', () => {
    const board = renderBoard(null);
    expect(board).toContain('CONVEYOR · 0 running · 0 preparing · 0 queued · 0 needs-you');
  });
  it('a partial state (only a lanes array) never throws and omits missing sections', () => {
    const board = renderBoard({ lanes: [{ lane: 1, num: null, session: 's', lease: ['we:a'], breach: [] }] });
    expect(board).toContain('RUNNING');
    expect(board).toContain('1 running');
    expect(board).not.toContain('QUEUE');
  });
  it('a lane with no num falls back to its session name', () => {
    const board = renderBoard({ lanes: [{ lane: 9, num: null, session: 'conveyor-x', lease: ['we:a'], breach: [] }] });
    expect(board).toContain('conveyor-x building');
  });
});
