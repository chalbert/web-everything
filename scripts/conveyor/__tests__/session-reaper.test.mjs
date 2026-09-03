/**
 * @file scripts/conveyor/__tests__/session-reaper.test.mjs
 * @description Unit proof of the conveyor SESSION REAPER's PURE core (WE #3435). Drives
 *   {@link classifySessionReap} / {@link sessionReapPlan} directly with fixtures shaped exactly as
 *   `claude agents --json` reports them (NO fs / exec / clock) — pins the Done-when #2 proof (a mixed
 *   working/blocked/done/failed/stopped listing only reaps `done`/`failed`, never a live or blocked one)
 *   plus the `kind !== 'background'` guard against ever touching an interactive session.
 */
import { describe, it, expect } from 'vitest';
import { classifySessionReap, sessionReapPlan, TERMINAL_REAP_STATES, ALREADY_STOPPED_STATES } from '../session-reaper.mjs';

const bg = (over = {}) => ({ id: 'abc12345', cwd: '/repo', kind: 'background', startedAt: 1, sessionId: 'abc12345-0000-0000-0000-000000000000', name: 'conveyor-1', ...over });
const interactive = (over = {}) => ({ pid: 111, cwd: '/repo', kind: 'interactive', startedAt: 1, sessionId: 'def67890-0000-0000-0000-000000000000', name: 'my terminal', ...over });

describe('classifySessionReap — the per-row verdict', () => {
  it('a `done` background session is reaped', () => {
    expect(classifySessionReap(bg({ state: 'done' }))).toEqual({ reap: true, reason: 'done' });
  });
  it('a `failed` background session is reaped', () => {
    expect(classifySessionReap(bg({ state: 'failed' }))).toEqual({ reap: true, reason: 'failed' });
  });
  it('a `working` background session is never reaped — still live', () => {
    expect(classifySessionReap(bg({ state: 'working' }))).toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('a `blocked` background session is never reaped — may simply not have started yet (#3435 found-live #2)', () => {
    expect(classifySessionReap(bg({ state: 'blocked' }))).toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('an already-`stopped` background session needs no action', () => {
    expect(classifySessionReap(bg({ state: 'stopped' }))).toEqual({ reap: false, reason: 'already-stopped' });
  });
  it('a session with no `state` at all is never reaped', () => {
    const { state, ...noState } = bg({ state: 'done' });
    expect(classifySessionReap(noState)).toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('an INTERACTIVE session is never reaped, even carrying a terminal-looking state (structural guard)', () => {
    expect(classifySessionReap(interactive({ state: 'done' }))).toEqual({ reap: false, reason: 'not-background' });
    expect(classifySessionReap(interactive())).toEqual({ reap: false, reason: 'not-background' });
  });
  it('degenerate input never throws', () => {
    expect(classifySessionReap(null)).toEqual({ reap: false, reason: 'not-terminal' });
    expect(classifySessionReap(undefined)).toEqual({ reap: false, reason: 'not-terminal' });
    expect(classifySessionReap('not-an-object')).toEqual({ reap: false, reason: 'not-terminal' });
  });
});

describe('TERMINAL_REAP_STATES / ALREADY_STOPPED_STATES — the state sets themselves', () => {
  it('names exactly the states measured live against a real `claude agents --json --all` listing', () => {
    expect([...TERMINAL_REAP_STATES].sort()).toEqual(['done', 'failed']);
    expect([...ALREADY_STOPPED_STATES].sort()).toEqual(['stopped']);
  });
});

describe('sessionReapPlan — Done-when #2: a mixed listing only reaps the terminal background ones', () => {
  it('splits a fabricated working/blocked/done/failed/stopped/interactive listing correctly', () => {
    const listing = [
      bg({ sessionId: 'live-1', state: 'working', name: 'conveyor-10' }),
      bg({ sessionId: 'blocked-1', state: 'blocked', name: 'review-20' }),
      bg({ sessionId: 'done-1', state: 'done', name: 'conveyor-30' }),
      bg({ sessionId: 'done-2', state: 'done', name: 'review-40' }),
      bg({ sessionId: 'failed-1', state: 'failed', name: 'fix-50' }),
      bg({ sessionId: 'stopped-1', state: 'stopped', name: 'conveyor-60' }),
      interactive({ sessionId: 'interactive-1', name: 'operator terminal' }),
    ];
    const { reap, keep } = sessionReapPlan(listing);

    expect(reap.map((r) => r.session.sessionId).sort()).toEqual(['done-1', 'done-2', 'failed-1']);
    expect(reap.every((r) => ['done', 'failed'].includes(r.reason))).toBe(true);

    const keptIds = keep.map((r) => r.session.sessionId).sort();
    expect(keptIds).toEqual(['blocked-1', 'interactive-1', 'live-1', 'stopped-1']);
    // Never a live one, never a blocked one, never the interactive one — the exact Done-when #2 proof.
    expect(keep.find((r) => r.session.sessionId === 'live-1').reason).toBe('not-terminal');
    expect(keep.find((r) => r.session.sessionId === 'blocked-1').reason).toBe('not-terminal');
    expect(keep.find((r) => r.session.sessionId === 'interactive-1').reason).toBe('not-background');
    expect(keep.find((r) => r.session.sessionId === 'stopped-1').reason).toBe('already-stopped');
  });

  it('a non-array input reaps nothing', () => {
    expect(sessionReapPlan(null)).toEqual({ reap: [], keep: [] });
    expect(sessionReapPlan(undefined)).toEqual({ reap: [], keep: [] });
  });

  it('an empty listing reaps nothing', () => {
    expect(sessionReapPlan([])).toEqual({ reap: [], keep: [] });
  });
});
