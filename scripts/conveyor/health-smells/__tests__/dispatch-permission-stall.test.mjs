/**
 * @file scripts/conveyor/health-smells/__tests__/dispatch-permission-stall.test.mjs
 * @description #xrv69j6 (epic #4075) — the PURE `evaluate()` of the `dispatch-permission-stall` smell: a
 *   dispatched background session stuck on Claude Code's own unanswerable permission prompt (live case:
 *   `fix-2735`, `claude agents --json`'s real `state: "blocked"`, `status: "waiting"`,
 *   `waitingFor: "permission prompt"` shape). No fs/network — every probe is a plain fixture array, exactly
 *   the shape `we:scripts/conveyor/health-watch.mjs#probeAgents` now returns.
 */
import { describe, it, expect } from 'vitest';
import dispatchPermissionStall, { stuckOnPermissionPrompt } from '../dispatch-permission-stall.mjs';

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-09-26T17:28:00Z'); // 13:28 ET

const agent = (over = {}) => ({
  name: 'fix-2735', kind: 'background', state: 'working', status: 'busy', waitingFor: null,
  startedAt: NOW - 5 * MINUTE, sessionId: '61d6f087-…', cwd: '/Users/op/workspace/.operations/dispatch/7d6149ba-…',
  ...over,
});

const stuck = (over = {}) => agent({ state: 'blocked', status: 'waiting', waitingFor: 'permission prompt', ...over });

describe('stuckOnPermissionPrompt', () => {
  it('matches a background, dispatched-named session blocked on exactly the permission-prompt wait', () => {
    expect(stuckOnPermissionPrompt([stuck()])).toHaveLength(1);
  });

  it('ignores an interactive session even if it happens to report the same fields', () => {
    expect(stuckOnPermissionPrompt([stuck({ kind: 'interactive', name: 'webeverything-3f' })])).toHaveLength(0);
  });

  it('ignores a session whose name does not look dispatched (never a bare guess at "background = ours")', () => {
    expect(stuckOnPermissionPrompt([stuck({ name: 'some-other-tool-9' })])).toHaveLength(0);
  });

  it('ignores a background session waiting on a DIFFERENT prompt', () => {
    expect(stuckOnPermissionPrompt([stuck({ waitingFor: 'something else' })])).toHaveLength(0);
  });

  it('ignores a background session that is not blocked at all', () => {
    expect(stuckOnPermissionPrompt([agent()])).toHaveLength(0);
  });

  it('matches every dispatched-session-slug family the pipeline mints', () => {
    const names = ['conveyor-3037', 'prepare-3438', 'prepare-decision-3402', 'investigate-3672', 'fix-2735', 'ci-heal-2636'];
    const rows = names.map((name) => stuck({ name }));
    expect(stuckOnPermissionPrompt(rows)).toHaveLength(names.length);
  });
});

describe('dispatch-permission-stall.evaluate', () => {
  it('breaches once a stuck session has been blocked past the 10-minute threshold', () => {
    const out = dispatchPermissionStall.evaluate({ agents: [stuck({ startedAt: NOW - 36 * MINUTE })] }, { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('fix-2735');
    expect(out[0].breach).toBe(true);
    expect(out[0].measure.ageMinutes).toBe(36);
    expect(out[0].summary).toMatch(/blocked on a permission prompt/);
  });

  it('does not yet breach a session stuck for under 10 minutes', () => {
    const out = dispatchPermissionStall.evaluate({ agents: [stuck({ startedAt: NOW - 3 * MINUTE })] }, { now: NOW });
    expect(out[0].breach).toBe(false);
  });

  it('reports nothing when no session is stuck', () => {
    expect(dispatchPermissionStall.evaluate({ agents: [agent()] }, { now: NOW })).toHaveLength(0);
  });

  it('tolerates a missing/non-array probe rather than throwing', () => {
    expect(dispatchPermissionStall.evaluate({ agents: null }, { now: NOW })).toEqual([]);
    expect(dispatchPermissionStall.evaluate({}, { now: NOW })).toEqual([]);
  });

  it('is wired to alert even in shadow mode, and scoped to the host (not gh-cadenced)', () => {
    expect(dispatchPermissionStall.notifyEvenInShadow).toBe(true);
    expect(dispatchPermissionStall.scope).toBe('host');
    expect(dispatchPermissionStall.cadence).toBe('every-tick');
    expect(dispatchPermissionStall.probes).toEqual(['agents']);
  });
});
