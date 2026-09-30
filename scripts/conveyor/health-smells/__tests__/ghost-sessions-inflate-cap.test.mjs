/**
 * @file scripts/conveyor/health-smells/__tests__/ghost-sessions-inflate-cap.test.mjs
 * @description #ghost-sessions-inflate-cap — the PURE `evaluate()` of the `ghost-sessions-inflate-cap` smell:
 *   a non-terminal `claude agents --json` entry whose own process is confirmed gone (no matching `pid`, no
 *   matching `ps` command line). Seeded from the real live incident: 18 `conveyor-NNNN` sessions, `state:
 *   'working'`, 20-26 days old — a representative subset here, the full 18 in `session-reaper.test.mjs`'s own
 *   pid-dead-axis suite (this smell's SIBLING fix, not a duplicate of that proof).
 */
import { describe, it, expect } from 'vitest';
import ghostSessionsInflateCap, { isProcessAlive, findGhostAgentSessions } from '../ghost-sessions-inflate-cap.mjs';

const agent = (over = {}) => ({ name: 'conveyor-3412', state: 'working', sessionId: 'sid-a', ...over });
const psRow = (command, pid = 999) => ({ pid, command });

describe('isProcessAlive', () => {
  it('answers alive via the row\'s own pid when a process row carries that exact pid', () => {
    expect(isProcessAlive({ pid: 4242 }, [psRow('node x', 4242)])).toBe(true);
  });
  it('answers dead when no process row carries that pid', () => {
    expect(isProcessAlive({ pid: 4242 }, [psRow('node x', 1)])).toBe(false);
  });
  it('falls back to a sessionId command-line scan when no pid is present (the real ghost shape)', () => {
    expect(isProcessAlive({ sessionId: 'abc-full-uuid' }, [psRow('claude --resume=abc-full-uuid')])).toBe(true);
    expect(isProcessAlive({ sessionId: 'abc-full-uuid' }, [psRow('node unrelated')])).toBe(false);
  });
  it('answers null (never a guess) with neither a pid nor a sessionId to check, or when the probe itself never ran', () => {
    expect(isProcessAlive({ name: 'x' }, [psRow('anything')])).toBe(null);
    expect(isProcessAlive({ sessionId: 'x' }, null)).toBe(null);
  });

  it('a successfully-read but genuinely EMPTY snapshot is a definite "not found" (false), never "unknown" '
    + '(null) — the two must not collapse, or a real ghost would silently downgrade to unknown', () => {
    expect(isProcessAlive({ sessionId: 'x' }, [])).toBe(false);
  });
});

describe.each([
  ['pid', { pid: 123 }, (alive) => [psRow('node x', alive ? 123 : 1)]],
  ['sessionId', { sessionId: 'sid-z' }, (alive) => [psRow(alive ? 'claude --resume=sid-z' : 'node x')]],
])('isProcessAlive identity parity (%s)', (_name, session, rows) => {
  it.each([
    ['unavailable snapshot', () => null, null],
    ['empty snapshot', () => [], false],
    ['matching snapshot', () => rows(true), true],
    ['nonmatching snapshot', () => rows(false), false],
  ])('%s', (_label, snapshot, expected) => {
    expect(isProcessAlive(session, snapshot())).toBe(expected);
  });
});

describe('isProcessAlive unavailable probe with a pid', () => {
  it('answers null for { pid: 123 } with a null snapshot', () => {
    expect(isProcessAlive({ pid: 123 }, null)).toBe(null);
  });
  it('findGhostAgentSessions does not flag a pid-bearing session when the probe never ran', () => {
    expect(findGhostAgentSessions([agent({ pid: 123 })], null)).toEqual([]);
  });
});

describe('findGhostAgentSessions', () => {
  it('flags the real live-incident shape: a `state:working`, 20+-day-old session with no matching process', () => {
    const ghosts = findGhostAgentSessions([
      agent({ name: 'conveyor-3412', sessionId: 'f111cbf6-9f62-43da-a6b3-6a57c319a7de', startedAt: 1788260544818 }),
      agent({ name: 'conveyor-2786', sessionId: 'f3820f6a-441b-4ff9-960a-d81e7fc39aaa', startedAt: 1788312792649 }),
    ], []); // empty ps snapshot — nothing is alive
    expect(ghosts).toHaveLength(2);
  });

  it('never flags a session whose process is confirmed alive', () => {
    const ghosts = findGhostAgentSessions(
      [agent({ sessionId: 'still-here' })],
      [psRow('claude --resume=still-here')],
    );
    expect(ghosts).toHaveLength(0);
  });

  it('never flags a terminal (done/stopped/failed) session, dead process or not', () => {
    const ghosts = findGhostAgentSessions([agent({ state: 'done', sessionId: 'gone' })], []);
    expect(ghosts).toHaveLength(0);
  });

  it('never flags a session neither signal can answer for (unknown, not assumed dead)', () => {
    const ghosts = findGhostAgentSessions([{ name: 'x', state: 'working' }], []);
    expect(ghosts).toHaveLength(0);
  });
});

describe('ghost-sessions-inflate-cap (the wired smell)', () => {
  it('declares the agents+processes probes and a 3-tick open hysteresis (wider than an acute-incident smell\'s)', () => {
    expect(ghostSessionsInflateCap.id).toBe('ghost-sessions-inflate-cap');
    expect(ghostSessionsInflateCap.probes).toEqual(['agents', 'processes']);
    expect(ghostSessionsInflateCap.openAfter).toBe(3);
  });

  it('evaluate() reports a breach naming the count and the oldest startedAt, never stopping anything itself', () => {
    const out = ghostSessionsInflateCap.evaluate({
      agents: [agent({ name: 'conveyor-3412', sessionId: 'gone-1', startedAt: 100 }), agent({ name: 'conveyor-2786', sessionId: 'gone-2', startedAt: 50 })],
      processes: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].breach).toBe(true);
    expect(out[0].measure.count).toBe(2);
    expect(out[0].measure.oldestStartedAt).toBe(50);
    expect(out[0].recommendation).toMatch(/session reaper/i);
  });

  it('evaluate() reports nothing when every listed session is alive or terminal', () => {
    const out = ghostSessionsInflateCap.evaluate({
      agents: [agent({ sessionId: 'still-here' })],
      processes: [psRow('claude --resume=still-here')],
    });
    expect(out).toEqual([]);
  });
});
