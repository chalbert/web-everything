/**
 * @file scripts/conveyor/__tests__/session-reap-plan.test.mjs
 * @description Unit proof of the conveyor SESSION REAPER's PURE PLANNER (`session-reap-plan.mjs`; WE #3435, plus the
 *   ground-truth axis found live 2026-09-03 on `conveyor-3451`). Drives {@link classifySessionReap} / {@link sessionTarget} /
 *   {@link classifySessionReapWithGroundTruth} / {@link sessionReapPlan} / {@link attentionRows} directly with fixtures
 *   shaped exactly as `claude agents --json` reports them (NO fs / exec / clock) — pins the Done-when #2 proof (a mixed
 *   working/blocked/done/failed/stopped listing only reaps `done`/`failed`, never a live or blocked one)
 *   plus the `kind !== 'background'` guard against ever touching an interactive session, AND the new proof
 *   that a `working`/`blocked` session is reaped once — and ONLY once — its own target is confirmed done.
 *   (Split out of `session-reaper.test.mjs`; the resolver and stop halves are in `session-reap-evidence.test.mjs` and
 *   `session-reap-stop.test.mjs`. This file imports only the pure planner.)
 */
import { describe, it, expect } from 'vitest';
import {
  classifySessionReap,
  classifySessionReapWithGroundTruth,
  sessionTarget,
  sessionReapPlan,
  attentionRows,
  hasHandler,
  REDISPATCH_ACTIONS,
  TERMINAL_REAP_STATES,
  ALREADY_STOPPED_STATES,
} from '../session-reap-plan.mjs';

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

  // #3383 (found live 2026-09-14 — the "26 entries, `pid: null`, 6-13.5 DAYS old" audit): the PID-LIVENESS axis.
  describe('the pid-dead axis (#3383)', () => {
    it('a `working` session CONFIRMED dead via a real pid/ps-aux probe is reaped, reason `pid-dead`', () => {
      expect(classifySessionReap(bg({ state: 'working', pidAlive: false }))).toEqual({ reap: true, reason: 'pid-dead' });
    });
    it('a `blocked` session confirmed dead is reaped the same way', () => {
      expect(classifySessionReap(bg({ state: 'blocked', pidAlive: false }))).toEqual({ reap: true, reason: 'pid-dead' });
    });
    it('a `working` session with a LIVE pid is never reaped on this axis', () => {
      expect(classifySessionReap(bg({ state: 'working', pidAlive: true }))).toEqual({ reap: false, reason: 'not-terminal' });
    });
    it('`pidAlive` unresolved (undefined — no IO shell ever attached it) never guesses at death', () => {
      expect(classifySessionReap(bg({ state: 'working' }))).toEqual({ reap: false, reason: 'not-terminal' });
    });
    it('`pidAlive: null` (probed but unknown) never guesses at death either', () => {
      expect(classifySessionReap(bg({ state: 'working', pidAlive: null }))).toEqual({ reap: false, reason: 'not-terminal' });
    });
    it('a `done`/`failed`/`stopped` row is unaffected by `pidAlive` — the terminal axes still win first', () => {
      expect(classifySessionReap(bg({ state: 'done', pidAlive: false }))).toEqual({ reap: true, reason: 'done' });
      expect(classifySessionReap(bg({ state: 'stopped', pidAlive: false }))).toEqual({ reap: false, reason: 'already-stopped' });
    });
    it('an INTERACTIVE session confirmed "dead" is still never reaped — the structural guard outranks pid-dead too', () => {
      expect(classifySessionReap(interactive({ state: 'working', pidAlive: false }))).toEqual({ reap: false, reason: 'not-background' });
    });
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

describe('sessionTarget — the dispatcher-minted grammar a session name encodes', () => {
  it('item-kind names (conveyor / prepare / prepare-decision), with a retry-attempt letter collapsed to the base', () => {
    expect(sessionTarget('conveyor-3451')).toEqual({ kind: 'item', id: '3451' });
    expect(sessionTarget('conveyor-3411b')).toEqual({ kind: 'item', id: '3411' });
    expect(sessionTarget('prepare-3399')).toEqual({ kind: 'item', id: '3399' });
    expect(sessionTarget('prepare-decision-3457')).toEqual({ kind: 'item', id: '3457' });
  });
  it('PR-kind names (review / fix / ci-heal) — a PR number, never an item number', () => {
    expect(sessionTarget('review-1871')).toEqual({ kind: 'pr', id: '1871' });
    expect(sessionTarget('fix-1852')).toEqual({ kind: 'pr', id: '1852' });
    expect(sessionTarget('ci-heal-1852c')).toEqual({ kind: 'pr', id: '1852' });
  });
  it('an unrecognized name (a stray operator label, no grammar) yields null — never a guess', () => {
    expect(sessionTarget('test-dontask')).toBeNull();
    expect(sessionTarget('pr review resume')).toBeNull();
    expect(sessionTarget('my terminal')).toBeNull();
    expect(sessionTarget(null)).toBeNull();
    expect(sessionTarget(undefined)).toBeNull();
  });
});

describe('classifySessionReapWithGroundTruth — the new axis found live on `conveyor-3451`', () => {
  it('omitting the resolver is byte-identical to classifySessionReap (strictly additive)', () => {
    for (const state of ['done', 'failed', 'working', 'blocked', 'stopped', undefined]) {
      const session = bg({ state });
      expect(classifySessionReapWithGroundTruth(session)).toEqual(classifySessionReap(session));
      expect(classifySessionReapWithGroundTruth(session, null)).toEqual(classifySessionReap(session));
    }
  });
  it('a `working`/`blocked` session is reaped once its target reads resolved — the conveyor-3451 shape', () => {
    const resolved = () => ({ resolved: true, evidence: 'backlog#3451:resolved' });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'conveyor-3451' }), resolved)).toEqual({
      reap: true,
      reason: 'ground-truth-item:backlog#3451:resolved',
    });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'prepare-decision-3457' }), resolved)).toEqual({
      reap: true,
      reason: 'ground-truth-item:backlog#3451:resolved',
    });
  });
  it('a `working` PR-kind session is reaped once its PR reads merged', () => {
    const merged = () => ({ resolved: true, evidence: 'pr#1862:merged' });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-1862' }), merged)).toEqual({
      reap: true,
      reason: 'ground-truth-pr:pr#1862:merged',
    });
  });
  it('never reaps when the resolver says not resolved — the genuinely-still-open shape', () => {
    const stillOpen = () => ({ resolved: false });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'conveyor-2786' }), stillOpen)).toEqual({
      reap: false,
      reason: 'not-terminal',
    });
  });
  it('never reaps when the resolver answer is unknown (null) — an unreadable signal is never a green light', () => {
    const unknown = () => null;
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'conveyor-3399' }), unknown)).toEqual({
      reap: false,
      reason: 'not-terminal',
    });
  });
  it('never calls the resolver for a name matching no known grammar — never a guess', () => {
    let called = false;
    const spy = () => {
      called = true;
      return { resolved: true };
    };
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'test-dontask' }), spy)).toEqual({
      reap: false,
      reason: 'not-terminal',
    });
    expect(called).toBe(false);
  });
  it('never upgrades an already-terminal or already-stopped or interactive verdict, even if the resolver would say resolved', () => {
    const alwaysResolved = () => ({ resolved: true });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'done', name: 'conveyor-1' }), alwaysResolved)).toEqual({ reap: true, reason: 'done' });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'stopped', name: 'conveyor-1' }), alwaysResolved)).toEqual({ reap: false, reason: 'already-stopped' });
    expect(classifySessionReapWithGroundTruth(interactive({ state: 'blocked', name: 'conveyor-1' }), alwaysResolved)).toEqual({ reap: false, reason: 'not-background' });
  });
  it('#3383 — a confirmed pid-dead row reaps via the base axis WITHOUT ever consulting the ground-truth resolver', () => {
    let called = false;
    const spy = () => { called = true; return { resolved: true }; };
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'conveyor-2786', pidAlive: false }), spy)).toEqual({
      reap: true,
      reason: 'pid-dead',
    });
    expect(called).toBe(false);
  });
});

describe('sessionReapPlan with groundTruthFor — end to end over a mixed listing', () => {
  it('reaps done/failed via the base axis AND working/blocked via ground truth, keeps everything else', () => {
    const listing = [
      bg({ sessionId: 'done-1', state: 'done', name: 'conveyor-1' }),
      bg({ sessionId: 'blocked-resolved', state: 'blocked', name: 'conveyor-3451' }),
      bg({ sessionId: 'working-resolved', state: 'working', name: 'prepare-3399' }),
      bg({ sessionId: 'working-open', state: 'working', name: 'conveyor-2786' }),
      bg({ sessionId: 'working-unnamed', state: 'working', name: 'test-dontask' }),
    ];
    const resolvedIds = new Set(['3451', '3399']);
    const groundTruthFor = (target) => (target.kind === 'item' && resolvedIds.has(target.id) ? { resolved: true, evidence: `backlog#${target.id}` } : { resolved: false });

    const { reap, keep } = sessionReapPlan(listing, { groundTruthFor });
    expect(reap.map((r) => r.session.sessionId).sort()).toEqual(['blocked-resolved', 'done-1', 'working-resolved']);
    expect(keep.map((r) => r.session.sessionId).sort()).toEqual(['working-open', 'working-unnamed']);
  });

  it('with no groundTruthFor at all, behaves exactly as the original state-only plan', () => {
    const listing = [
      bg({ sessionId: 'blocked-resolved', state: 'blocked', name: 'conveyor-3451' }),
      bg({ sessionId: 'done-1', state: 'done', name: 'conveyor-1' }),
    ];
    const { reap, keep } = sessionReapPlan(listing);
    expect(reap.map((r) => r.session.sessionId)).toEqual(['done-1']);
    expect(keep.map((r) => r.session.sessionId)).toEqual(['blocked-resolved']);
  });
});

describe('sessionReapPlan — the "26 stale entries" shape (#3383, found live 2026-09-14)', () => {
  it('a `state: working`, `pidAlive: false` row on a STILL-OPEN item (ground truth unresolved) is reaped anyway', () => {
    // The exact gap: ground truth alone never catches this (the item is genuinely still open — nothing to
    // confirm), and the state-only axis never catches it either (`state` never advances on its own). Only the
    // pid-liveness axis closes it.
    const listing = [
      bg({ sessionId: 'phantom-1', state: 'working', name: 'conveyor-2900', pidAlive: false, startedAt: 1 }),
      bg({ sessionId: 'phantom-2', state: 'working', name: 'prepare-3010', pidAlive: false, startedAt: 1 }),
      bg({ sessionId: 'phantom-3', state: 'working', name: 'prepare-decision-3020', pidAlive: false, startedAt: 1 }),
      bg({ sessionId: 'live-1', state: 'working', name: 'conveyor-3030', pidAlive: true }),
      bg({ sessionId: 'unknown-1', state: 'working', name: 'conveyor-3040', pidAlive: null }),
    ];
    const groundTruthFor = () => ({ resolved: false }); // every item is still genuinely open — never resolved
    const { reap, keep } = sessionReapPlan(listing, { groundTruthFor });

    expect(reap.map((r) => r.session.sessionId).sort()).toEqual(['phantom-1', 'phantom-2', 'phantom-3']);
    expect(reap.every((r) => r.reason === 'pid-dead')).toBe(true);
    expect(keep.map((r) => r.session.sessionId).sort()).toEqual(['live-1', 'unknown-1']);
  });
});

describe('attentionRows — the redispatch-once gap is named `no handler`', () => {
  const kept = (over) => ({ session: bg({ id: 'stall1', name: 'review-7' }), verdict: 'stalled', action: 'redispatch-once', why: 'quiet 45m', ...over });

  it('only stalled / waiting-permission rows are attention rows; everything else is dropped', () => {
    const rows = attentionRows([kept(), kept({ verdict: 'progressing', action: 'none' }), kept({ verdict: undefined, action: undefined })]);
    expect(rows).toHaveLength(1);
  });

  it('`redispatch-once` and `stop-and-redispatch-once` report `handler: none`; `escalate` keeps its handler', () => {
    expect(attentionRows([kept()])[0]).toEqual({ id: 'stall1', name: 'review-7', verdict: 'stalled', action: 'redispatch-once', why: 'quiet 45m', handler: 'none' });
    expect(attentionRows([kept({ verdict: 'waiting-permission', action: 'stop-and-redispatch-once' })])[0].handler).toBe('none');
    expect(attentionRows([kept({ action: 'escalate' })])[0].handler).toBe('land-advance');
  });

  it('the no-handler set is exactly the two redispatch rungs', () => {
    expect([...REDISPATCH_ACTIONS].sort()).toEqual(['redispatch-once', 'stop-and-redispatch-once']);
    expect(hasHandler('redispatch-once')).toBe(false);
    expect(hasHandler('escalate')).toBe(true);
    expect(hasHandler('reap')).toBe(true);
  });
});
