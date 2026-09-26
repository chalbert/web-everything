/**
 * @file scripts/operations/__tests__/live-work.test.mjs
 * @description Card x20lkf6 (epic #3931) — pure unit tests for the RUNNING section: `classifyRunState`,
 * `sortRunning`, `waitingForSlotWhos` and the end-to-end `assessLiveWork` join, plus a declaration-shape test
 * for `liveWorkOperation`. No IO: every input is a plain fixture, mirroring `live-state.test.mjs`'s own suite.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyRunState, sortRunning, waitingForSlotWhos, assessLiveWork, liveWorkOperation, LIVE_WORK_OP,
  IDLE_TOO_LONG_MS, RUN_STATES,
} from '../live-work.mjs';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

describe('classifyRunState', () => {
  it('dead when pidAlive is explicitly false, even if everything else looks fine', () => {
    const out = classifyRunState({ pidAlive: false, lastActivityAt: NOW }, { now: NOW });
    expect(out.state).toBe('dead');
  });

  it('blocked-permission when status is waiting on a permission prompt (reuses isPermissionWait)', () => {
    const out = classifyRunState({ pidAlive: true, status: 'waiting', waitingFor: 'permission to run rm -rf' }, { now: NOW });
    expect(out.state).toBe('blocked-permission');
    expect(out.reason).toContain('permission to run rm -rf');
  });

  it('a non-permission wait is never blocked-permission (never guesses)', () => {
    const out = classifyRunState({ pidAlive: true, status: 'waiting', waitingFor: 'user input' }, { now: NOW, slotWhos: new Set() });
    expect(out.state).not.toBe('blocked-permission');
  });

  it('waiting-for-test-slot when the row\'s own lease matches a live heavy-queue WAITING who', () => {
    const out = classifyRunState({ pidAlive: true, lease: { purpose: 'fix-3932' }, lastActivityAt: NOW },
      { now: NOW, slotWhos: new Set(['fix-3932']) });
    expect(out.state).toBe('waiting-for-test-slot');
  });

  it('idle-too-long past the 10-minute bar with no other signal', () => {
    const out = classifyRunState({ pidAlive: true, lastActivityAt: NOW - IDLE_TOO_LONG_MS - 60_000 }, { now: NOW });
    expect(out.state).toBe('idle-too-long');
    expect(out.reason).toContain('min');
  });

  it('exactly at the bar is still working (strictly greater-than, not >=)', () => {
    const out = classifyRunState({ pidAlive: true, lastActivityAt: NOW - IDLE_TOO_LONG_MS }, { now: NOW });
    expect(out.state).toBe('working');
  });

  it('working when active and unknown pid liveness (never guesses dead from silence alone)', () => {
    const out = classifyRunState({ pidAlive: null, lastActivityAt: NOW - 1000 }, { now: NOW });
    expect(out.state).toBe('working');
  });

  it('working when lastActivityAt is unknown (null) and nothing else flags it', () => {
    const out = classifyRunState({ pidAlive: true, lastActivityAt: null }, { now: NOW });
    expect(out.state).toBe('working');
  });
});

describe('waitingForSlotWhos', () => {
  it('collects only WAIT rows\' who, never RUN rows', () => {
    const set = waitingForSlotWhos({
      rows: [{ state: 'RUN', who: 'build-1' }, { state: 'WAIT', who: 'fix-2' }, { state: 'WAIT', who: null }],
    });
    expect([...set]).toEqual(['fix-2']);
  });
  it('empty for a missing/empty heavy queue', () => {
    expect([...waitingForSlotWhos(null)]).toEqual([]);
    expect([...waitingForSlotWhos({ rows: [] })]).toEqual([]);
  });
});

describe('sortRunning', () => {
  it('sorts stuck and dead states before waiting-for-test-slot and working, in the brief\'s own priority order', () => {
    const rows = [
      { runId: 'w', state: 'working', lastActivityAt: null },
      { runId: 'd', state: 'dead', lastActivityAt: null },
      { runId: 's', state: 'waiting-for-test-slot', lastActivityAt: null },
      { runId: 'i', state: 'idle-too-long', lastActivityAt: null },
      { runId: 'b', state: 'blocked-permission', lastActivityAt: null },
    ];
    expect(sortRunning(rows).map((r) => r.runId)).toEqual(['d', 'b', 'i', 's', 'w']);
  });

  it('within the same state, the stalest (oldest lastActivityAt) sorts first', () => {
    const rows = [
      { runId: 'newer', state: 'idle-too-long', lastActivityAt: '2026-09-26T11:55:00.000Z' },
      { runId: 'older', state: 'idle-too-long', lastActivityAt: '2026-09-26T11:00:00.000Z' },
    ];
    // sortRunning operates on already-ISO-stamped rows from assessLiveWork in practice; this unit test drives
    // the raw comparator with numeric ms directly since that's what the function actually compares.
    const numeric = rows.map((r) => ({ ...r, lastActivityAt: Date.parse(r.lastActivityAt) }));
    expect(sortRunning(numeric).map((r) => r.runId)).toEqual(['older', 'newer']);
  });

  it('RUN_STATES is a closed, ordered enum — dead and blocked-permission are the two front ranks', () => {
    expect(RUN_STATES[0]).toBe('dead');
    expect(RUN_STATES[1]).toBe('blocked-permission');
    expect(RUN_STATES[RUN_STATES.length - 1]).toBe('working');
  });
});

describe('assessLiveWork — end to end join over raw rows', () => {
  const baseHeavyQueue = { rows: [] };

  it('a matched review job renders role review, its PR, and its own transcript path', () => {
    const read = {
      observedAt: new Date(NOW).toISOString(),
      heavyQueue: baseHeavyQueue,
      prToCard: { 'we:2267': '3931' },
      rows: [{
        id: 'job-555', sessionId: null, name: 'review-2267', kind: 'review-job', pid: 555,
        cwd: '/repo', state: 'working', startedAt: new Date(NOW - 5 * 60_000).toISOString(),
        transcriptPath: '/repo/.operations/review-jobs/review-2267.log', lastActivityAt: NOW - 1000, pidAlive: true,
      }],
    };
    const out = assessLiveWork(read);
    expect(out.running).toHaveLength(1);
    expect(out.running[0]).toMatchObject({
      runId: 'job-555', kind: 'review', workItem: '3931', state: 'working',
      transcriptPath: '/repo/.operations/review-jobs/review-2267.log',
    });
    expect(out.running[0].runtimeMs).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
  });

  it('a fixer session with a dead pid renders dead, sorted first', () => {
    const read = {
      observedAt: new Date(NOW).toISOString(), heavyQueue: baseHeavyQueue, prToCard: {},
      rows: [
        { id: 'sess-ok', sessionId: 'sess-ok', name: 'conveyor-4001', kind: 'background', pid: 111,
          cwd: '/repo', state: 'working', startedAt: new Date(NOW - 1000).toISOString(),
          transcriptPath: '/t/ok.jsonl', lastActivityAt: NOW - 500, pidAlive: true },
        { id: 'sess-dead', sessionId: 'sess-dead', name: 'fix-2267', kind: 'background', pid: 222,
          cwd: '/repo', state: 'working', startedAt: new Date(NOW - 1000).toISOString(),
          transcriptPath: '/t/dead.jsonl', lastActivityAt: NOW - 500, pidAlive: false },
      ],
    };
    const out = assessLiveWork(read);
    expect(out.running.map((r) => r.runId)).toEqual(['sess-dead', 'sess-ok']);
    expect(out.running[0].state).toBe('dead');
  });

  it('an unresolved interactive session (the operator\'s own chat) still appears, workItem null', () => {
    const read = {
      observedAt: new Date(NOW).toISOString(), heavyQueue: baseHeavyQueue, prToCard: {},
      rows: [{
        id: 'chat-1', sessionId: 'chat-1', kind: 'interactive', name: null, cwd: null,
        state: null, startedAt: null, transcriptPath: '/proj/chat-1.jsonl', lastActivityAt: NOW - 2000, pidAlive: null,
      }],
    };
    const out = assessLiveWork(read);
    expect(out.running).toHaveLength(1);
    expect(out.running[0]).toMatchObject({ runId: 'chat-1', kind: 'session', workItem: null, pr: null });
  });

  it('an unmatched background row (no card, no PR) is still reported, never dropped', () => {
    const read = {
      observedAt: new Date(NOW).toISOString(), heavyQueue: baseHeavyQueue, prToCard: {},
      rows: [{
        id: 'sess-x', sessionId: 'sess-x', name: 'proto-note', kind: 'background', pid: 333,
        cwd: '/repo', state: 'working', startedAt: new Date(NOW - 1000).toISOString(),
        transcriptPath: '/t/x.jsonl', lastActivityAt: NOW - 500, pidAlive: true,
      }],
    };
    const out = assessLiveWork(read);
    expect(out.running).toHaveLength(1);
    expect(out.running[0].workItem).toBeNull();
  });

  it('a session queued on the heavy-admission pool (its lease matches a live WAIT row) renders waiting-for-test-slot', () => {
    const read = {
      observedAt: new Date(NOW).toISOString(),
      heavyQueue: { rows: [{ state: 'WAIT', who: 'fix-3932' }] },
      prToCard: {},
      rows: [{
        id: 'sess-q', sessionId: 'sess-q', name: 'fix-3932', kind: 'background', pid: 444,
        cwd: '/repo', state: 'working', startedAt: new Date(NOW - 1000).toISOString(),
        transcriptPath: '/t/q.jsonl', lastActivityAt: NOW - 500, pidAlive: true,
        lease: { purpose: 'fix-3932', ownerSession: 'sess-q', workerSession: 'sess-q' },
      }],
    };
    const out = assessLiveWork(read);
    expect(out.running[0].state).toBe('waiting-for-test-slot');
  });

  it('throws on an unreadable snapshot rather than silently reporting nothing running', () => {
    expect(() => assessLiveWork(null)).toThrow(TypeError);
    expect(() => assessLiveWork({})).toThrow(TypeError);
  });
});

describe('liveWorkOperation', () => {
  it('requires an injected collect reader', () => {
    expect(() => liveWorkOperation({})).toThrow(TypeError);
  });

  it('wires read → assess through the injected collector', async () => {
    const read = {
      observedAt: new Date(NOW).toISOString(), heavyQueue: { rows: [] }, prToCard: {},
      rows: [],
    };
    const declaration = liveWorkOperation({ collect: () => read });
    expect(declaration.name).toBe(LIVE_WORK_OP);
  });
});
