/**
 * @file scripts/conveyor/__tests__/session-verdicts.test.mjs
 * @description Proof of the mechanical session verdict (#3383 tracker item 11). Fixtures are the FOUR live
 *   `state: blocked, status: idle` sessions seen 2026-09-20 ~10:21 ET (three `finished-unreaped`, one `stalled`), one
 *   case per verdict, the permission wait, determinism, and that no verdict ever routes to the operator queue.
 *   Also drives the reaper's pure plan through the classifier.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTIONS, VERDICTS, DEFAULT_STALL_MINUTES, classifySession, dispatchGrammar, escalationRow, isPermissionWait,
} from '../session-verdicts.mjs';
import { classifySessionReapWithVerdict, sessionReapPlan, sessionTarget } from '../session-reaper.mjs';
import { isAwaitingPermission } from '../reconcile-core.mjs';
import { buildEscalationPacket } from '../../operations/land-advance-escalations.mjs';
import { ALLOWED_TOOLS_BY_KIND } from '../../operations/land-advance-tools.mjs';
import { OWED_ACTIONS } from '../../operations/land-advance.mjs';

const MIN = 60000;
/** ~10:21 ET on 2026-09-20 — the moment the live evidence was read. */
const NOW = 1789914060000;

// The four live rows, exactly as `claude agents --json` reported them.
const unstick = { pid: 61294, id: '071785de', cwd: '/Users/nicolasgilbert/workspace/.operations/jobs', kind: 'background', startedAt: 1789905594683, sessionId: '071785de-bdfc-4050-8e83-a4d4b4afcf1b', name: 'unstick-2072', status: 'idle', state: 'blocked', waitingFor: null };
const fold = { pid: 74942, id: 'f8d07388', cwd: '/Users/nicolasgilbert/workspace/.operations/jobs', kind: 'background', startedAt: 1789905921587, sessionId: 'f8d07388-ef41-46d7-9fbf-fac0783f6160', name: 'fold-2220', status: 'idle', state: 'blocked', waitingFor: null };
const oldFix = { pid: 23457, id: 'c0404eca', cwd: '/Users/nicolasgilbert/workspace/.lanes/web-everything/lane-54', kind: 'background', startedAt: 1789910758110, sessionId: 'c0404eca-d462-408d-8fb6-a3218894b8c8', name: 'fix-2347', status: 'idle', state: 'blocked', waitingFor: null };
const newFix = { pid: 38315, id: '6e8c2b6e', cwd: '/Users/nicolasgilbert/workspace/.lanes/web-everything/lane-54', kind: 'background', startedAt: 1789913006395, sessionId: '6e8c2b6e-bf21-430f-b936-cc603a6bc3b7', name: 'fix-2347', status: 'idle', state: 'working' };
const review148 = { pid: 62849, id: '9eff9f54', cwd: '/Users/nicolasgilbert/workspace/wev-conflict-2130', kind: 'background', startedAt: 1789907660043, sessionId: '9eff9f54-d1d3-44ff-883d-91d4072f17ca', name: 'review-148', status: 'idle', state: 'blocked', waitingFor: null };

const resultAfter = (agent, offsetMs, path) => ({ path, mtimeMs: agent.startedAt + offsetMs });
const live = (over = {}) => ({ pidAlive: true, ...over });

const LIVE_EVIDENCE = {
  unstick: live({ transcriptMtimeMs: NOW - 120 * MIN, resultFiles: [resultAfter(unstick, 142000, 'jobs/unstick-2072.result.md')] }),
  fold: live({ transcriptMtimeMs: NOW - 110 * MIN, resultFiles: [resultAfter(fold, 247000, 'jobs/fold-2220.result.md')] }),
  oldFix: live({ transcriptMtimeMs: NOW - 50 * MIN, resultFiles: [resultAfter(oldFix, 40000, 'jobs/fix-2347.result.md')] }),
  review148: live({ transcriptMtimeMs: NOW - 107 * MIN, resultFiles: [] }),
};

const classify = (agent, evidence) => classifySession(agent, evidence, { now: NOW });

describe('the four live sessions (2026-09-20 10:21 ET)', () => {
  it.each([
    ['unstick-2072', unstick, LIVE_EVIDENCE.unstick],
    ['fold-2220', fold, LIVE_EVIDENCE.fold],
    ['old fix-2347 (c0404eca)', oldFix, LIVE_EVIDENCE.oldFix],
  ])('%s is finished-unreaped → reap', (_n, agent, evidence) => {
    const r = classify(agent, evidence);
    expect(r).toMatchObject({ verdict: 'finished-unreaped', action: 'reap' });
    expect(r.why).toContain('result file');
  });

  it('review-148 (no result, idle 107 min, no PR verdict) is stalled → redispatch-once', () => {
    expect(classify(review148, LIVE_EVIDENCE.review148)).toMatchObject({ verdict: 'stalled', action: 'redispatch-once' });
  });

  it('review-148 escalates once the ledger shows a redispatch already happened', () => {
    expect(classify(review148, { ...LIVE_EVIDENCE.review148, redispatchAttempts: 1 })).toMatchObject({ verdict: 'stalled', action: 'escalate' });
  });

  it('the NEW fix-2347 is not finished by the OLD fix-2347\'s same-named result file (older than its own start)', () => {
    const r = classify({ ...newFix, state: 'blocked' }, live({ transcriptMtimeMs: NOW - 5 * MIN, resultFiles: [resultAfter(oldFix, 40000, 'jobs/fix-2347.result.md')] }));
    expect(r).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
});

describe('one case per verdict', () => {
  it('progressing: live pid, working, fresh transcript → none', () => {
    expect(classify(newFix, live({ transcriptMtimeMs: NOW - 2 * MIN }))).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
  it('progressing: a quiet session inside the stall threshold stays none', () => {
    expect(classify(review148, live({ transcriptMtimeMs: NOW - (DEFAULT_STALL_MINUTES - 1) * MIN }))).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
  it('finished-unreaped: registry `done` with a live pid → reap (no result file needed)', () => {
    expect(classify({ ...unstick, state: 'done' }, live())).toMatchObject({ verdict: 'finished-unreaped', action: 'reap' });
  });
  it('finished-unreaped: a `done` completion record proves a review session finished', () => {
    const r = classify(review148, live({ transcriptMtimeMs: NOW - 107 * MIN, completion: { status: 'done', startedAt: new Date(review148.startedAt).toISOString(), updatedAt: new Date(review148.startedAt + 5 * MIN).toISOString() } }));
    expect(r).toMatchObject({ verdict: 'finished-unreaped', action: 'reap' });
    expect(r.why).toContain('completion record');
  });
  it('finished-unreaped: a `started`-only completion record proves nothing', () => {
    expect(classify(review148, live({ transcriptMtimeMs: NOW - 107 * MIN, completion: { status: 'started', startedAt: new Date(review148.startedAt).toISOString(), updatedAt: new Date(review148.startedAt).toISOString() } })).verdict).toBe('stalled');
  });
  it('finished-unreaped: a review:* label / verdict comment after the session started finishes a review session (ground truth is the PR)', () => {
    const r = classify(review148, live({ transcriptMtimeMs: NOW - 107 * MIN, prSignal: { reviewSignalAtMs: review148.startedAt + 20 * MIN, what: 'label review:accepted' } }));
    expect(r).toMatchObject({ verdict: 'finished-unreaped', action: 'reap' });
    expect(r.why).toContain('review:accepted');
  });
  it('stalled: a review signal from BEFORE the session started does not finish it', () => {
    expect(classify(review148, live({ transcriptMtimeMs: NOW - 107 * MIN, prSignal: { reviewSignalAtMs: review148.startedAt - MIN } })).verdict).toBe('stalled');
  });
  it('a PR signal never finishes a non-review/fix session', () => {
    expect(classify({ ...unstick, name: 'conveyor-9' }, live({ transcriptMtimeMs: NOW - 120 * MIN, prSignal: { reviewSignalAtMs: NOW } })).verdict).toBe('stalled');
  });
  it('waiting-permission: first rung is stop-and-redispatch-once with the kind\'s scoped tools', () => {
    const r = classify({ ...review148, status: 'waiting', waitingFor: 'permission prompt' }, live());
    expect(r).toMatchObject({ verdict: 'waiting-permission', action: 'stop-and-redispatch-once' });
    expect(r.allowedTools).toBe(`--allowedTools=${ALLOWED_TOOLS_BY_KIND.review.join(',')}`);
  });
  it('waiting-permission: fix sessions get the fix grant, item sessions the build grant', () => {
    const wait = { status: 'waiting', waitingFor: 'permission prompt' };
    expect(classify({ ...oldFix, ...wait }, live()).allowedTools).toBe(`--allowedTools=${ALLOWED_TOOLS_BY_KIND.fix.join(',')}`);
    expect(classify({ ...oldFix, ...wait, name: 'conveyor-3443' }, live()).allowedTools).toBe(`--allowedTools=${ALLOWED_TOOLS_BY_KIND.build.join(',')}`);
  });
  it('waiting-permission: after one redispatch, or with no re-mintable name, it escalates', () => {
    const wait = { ...review148, status: 'waiting', waitingFor: 'permission prompt' };
    expect(classify(wait, live({ redispatchAttempts: 1 }))).toMatchObject({ verdict: 'waiting-permission', action: 'escalate' });
    const r = classify({ ...wait, name: 'proto-note' }, live());
    expect(r).toMatchObject({ verdict: 'waiting-permission', action: 'escalate' });
    expect(r.allowedTools).toBeUndefined();
  });
  it('waiting-permission outranks a finished-looking result file (waitingFor is not empty)', () => {
    expect(classify({ ...unstick, status: 'waiting', waitingFor: 'permission prompt' }, LIVE_EVIDENCE.unstick).verdict).toBe('waiting-permission');
  });
  it('a wait on something that is not a permission prompt is never guessed at', () => {
    expect(classify({ ...unstick, status: 'waiting', waitingFor: 'user input' }, live())).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
  it('stalled: a name with no dispatch grammar escalates straight away', () => {
    expect(classify({ ...review148, name: 'proto-note' }, live({ transcriptMtimeMs: NOW - 107 * MIN }))).toMatchObject({ verdict: 'stalled', action: 'escalate' });
  });
  it('stalled needs a KNOWN idle time — no transcript mtime is never stalled', () => {
    expect(classify(review148, live())).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
  it('dead-record: an explicit `pidAlive: false` → clear-record', () => {
    const { pid, ...noPid } = review148;
    expect(classify(noPid, { pidAlive: false })).toMatchObject({ verdict: 'dead-record', action: 'clear-record' });
  });
  it('unknown liveness is never a dead record, and never acted on', () => {
    expect(classify(review148, {})).toMatchObject({ verdict: 'progressing', action: 'none' });
    expect(classify(review148, { pidAlive: null })).toMatchObject({ verdict: 'progressing', action: 'none' });
  });
  it('target-moved-on: the reaper\'s ground-truth answer → reap, and it outranks a stall', () => {
    const r = classify(review148, live({ transcriptMtimeMs: NOW - 107 * MIN, targetMovedOn: { resolved: true, evidence: 'pr#148:merged' } }));
    expect(r).toMatchObject({ verdict: 'target-moved-on', action: 'reap' });
    expect(r.why).toContain('pr#148:merged');
  });
  it('target-moved-on needs no liveness read (the reaper has always reaped on ground truth alone)', () => {
    expect(classify(review148, { targetMovedOn: { resolved: true, evidence: 'pr#148:merged' } })).toMatchObject({ verdict: 'target-moved-on', action: 'reap' });
  });
  it('an unresolved / unknown ground truth is not moved-on', () => {
    expect(classify(newFix, live({ transcriptMtimeMs: NOW - MIN, targetMovedOn: { resolved: false } })).verdict).toBe('progressing');
    expect(classify(newFix, live({ transcriptMtimeMs: NOW - MIN, targetMovedOn: null })).verdict).toBe('progressing');
  });
  it('an interactive session is never acted on', () => {
    expect(classify({ pid: 1, kind: 'interactive', name: 'Continuation', status: 'idle', startedAt: 1 }, live({ transcriptMtimeMs: 1 }))).toMatchObject({ action: 'none' });
  });
  it('a stricter stallMinutes turns a shorter idle into stalled', () => {
    expect(classifySession(review148, live({ transcriptMtimeMs: NOW - 10 * MIN }), { now: NOW, stallMinutes: 5 }).verdict).toBe('stalled');
  });
});

describe('closed enums', () => {
  const matrix = [];
  for (const agent of [unstick, review148, newFix, { ...review148, status: 'waiting', waitingFor: 'permission prompt' }, { ...review148, name: 'proto-note' }, { kind: 'interactive' }]) {
    for (const evidence of [{}, { pidAlive: false }, LIVE_EVIDENCE.unstick, LIVE_EVIDENCE.review148, live({ targetMovedOn: { resolved: true } }), live({ redispatchAttempts: 2, transcriptMtimeMs: 1 })]) {
      matrix.push(classify(agent, evidence));
    }
  }
  it('every result is in the closed verdict and action sets', () => {
    for (const r of matrix) {
      expect(VERDICTS).toContain(r.verdict);
      expect(ACTIONS).toContain(r.action);
      expect(typeof r.why).toBe('string');
    }
  });
  it('the pairing is fixed by verdict', () => {
    const allowed = {
      progressing: ['none'], 'finished-unreaped': ['reap'], 'target-moved-on': ['reap'], 'dead-record': ['clear-record'],
      stalled: ['redispatch-once', 'escalate'], 'waiting-permission': ['stop-and-redispatch-once', 'escalate'],
    };
    for (const r of matrix) expect(allowed[r.verdict]).toContain(r.action);
  });
});

describe('determinism', () => {
  it('same inputs → byte-identical output, inputs untouched', () => {
    const agent = structuredClone(review148), evidence = structuredClone(LIVE_EVIDENCE.review148);
    const a = JSON.stringify(classify(agent, evidence)), b = JSON.stringify(classify(agent, evidence));
    expect(a).toBe(b);
    expect(agent).toEqual(review148);
    expect(evidence).toEqual(LIVE_EVIDENCE.review148);
  });
  it('the whole live table serialises identically across runs', () => {
    const run = () => JSON.stringify([[unstick, 'unstick'], [fold, 'fold'], [oldFix, 'oldFix'], [review148, 'review148']].map(([a, k]) => classify(a, LIVE_EVIDENCE[k])));
    expect(run()).toBe(run());
  });
});

describe('a blocked worker is agent work: nothing routes to the operator queue', () => {
  const stuck = [
    [review148, { ...LIVE_EVIDENCE.review148, redispatchAttempts: 1 }],
    [{ ...review148, status: 'waiting', waitingFor: 'permission prompt' }, live({ redispatchAttempts: 1 })],
    [{ ...review148, name: 'proto-note' }, LIVE_EVIDENCE.review148],
  ];
  it('no action names an operator route, and the action set is disjoint from land-advance\'s operator action', () => {
    expect(ACTIONS.filter((a) => /operator/i.test(a))).toEqual([]);
    expect(ACTIONS).not.toContain('needs-operator');
    expect(OWED_ACTIONS).toContain('needs-operator'); // sanity: the operator action exists and is NOT ours
  });
  it('escalate builds an escalation packet bound for AI triage — never review:human / needs-operator', () => {
    for (const [agent, evidence] of stuck) {
      const result = classify(agent, evidence);
      expect(result.action).toBe('escalate');
      const row = escalationRow(agent, result);
      const packet = buildEscalationPacket(row, NOW);
      expect(packet.ladder.next).toBe('L2 ai-triage');
      expect(JSON.stringify(packet)).not.toMatch(/review:human|needs-operator/);
      expect(packet.id).toMatch(/^[\w-]+$/);
    }
  });
  it('escalationRow refuses to escalate what the ladder did not', () => {
    expect(escalationRow(review148, classify(review148, LIVE_EVIDENCE.review148))).toBeNull(); // redispatch-once
    expect(escalationRow(unstick, classify(unstick, LIVE_EVIDENCE.unstick))).toBeNull(); // reap
  });
  it('the escalation row is stable per session and carries the PR number for PR-kind sessions', () => {
    const result = classify(review148, { ...LIVE_EVIDENCE.review148, redispatchAttempts: 1 });
    expect(escalationRow(review148, result)).toMatchObject({ kind: 'session-stalled', subject: 'session:review-148', packetId: 'session-stalled-session-review-148', pr: 148 });
  });
});

describe('grammar pins (mirrored, so tested against the originals)', () => {
  it.each(['conveyor-3451', 'conveyor-3441b', 'prepare-3438', 'prepare-decision-3402', 'review-148', 'fix-2347', 'ci-heal-2107', 'proto-note', 'lane-salvage', '', undefined])(
    'dispatchGrammar(%j) agrees with session-reaper sessionTarget',
    (name) => {
      const g = dispatchGrammar(name), t = sessionTarget(name);
      expect(g ? { kind: g.target, id: g.id } : null).toEqual(t);
    },
  );
  it.each([
    [{ status: 'waiting', waitingFor: 'permission prompt' }], [{ status: 'waiting', waitingFor: 'input' }], [{ status: 'idle', waitingFor: 'permission prompt' }],
    [{ status: 'WAITING', waitingFor: 'Permission' }], [{}], [null],
  ])('isPermissionWait(%j) agrees with reconcile-core isAwaitingPermission', (agent) => {
    expect(isPermissionWait(agent)).toBe(isAwaitingPermission(agent));
  });
});

describe('the reaper plan, through the classifier', () => {
  const rows = [unstick, fold, oldFix, review148, newFix].map((s) => ({ ...s, pidAlive: true }));
  const evidenceByKey = new Map([[unstick.id, LIVE_EVIDENCE.unstick], [fold.id, LIVE_EVIDENCE.fold], [oldFix.id, LIVE_EVIDENCE.oldFix], [review148.id, LIVE_EVIDENCE.review148],
    [newFix.id, { transcriptMtimeMs: NOW - 2 * MIN, resultFiles: [resultAfter(oldFix, 40000, 'jobs/fix-2347.result.md')] }]]);
  const evidenceFor = (s) => evidenceByKey.get(s.id);

  it('reaps the three finished-unreaped sessions, keeps the stalled and the working one', () => {
    const plan = sessionReapPlan(rows, { evidenceFor, now: NOW });
    expect(plan.reap.map((r) => r.session.name)).toEqual(['unstick-2072', 'fold-2220', 'fix-2347']);
    expect(plan.reap.map((r) => r.session.id)).toEqual(['071785de', 'f8d07388', 'c0404eca']);
    expect(plan.reap.every((r) => r.verdict === 'finished-unreaped' && r.reason.startsWith('finished-unreaped:'))).toBe(true);
    expect(plan.keep.map((r) => [r.session.name, r.verdict, r.action])).toEqual([['review-148', 'stalled', 'redispatch-once'], ['fix-2347', 'progressing', 'none']]);
  });

  it('target-moved-on reaps through the classifier, keeping the existing `ground-truth-<kind>:<evidence>` reason', () => {
    const groundTruthFor = (t) => (t.kind === 'pr' && t.id === '148' ? { resolved: true, evidence: 'pr#148:merged' } : { resolved: false });
    expect(classifySessionReapWithVerdict(rows[3], { groundTruthFor, evidenceFor, now: NOW }))
      .toMatchObject({ reap: true, reason: 'ground-truth-pr:pr#148:merged', verdict: 'target-moved-on', action: 'reap' });
  });

  it('every existing axis still comes first: terminal state and pid-dead are unchanged and carry no verdict', () => {
    expect(classifySessionReapWithVerdict({ ...unstick, state: 'done', pidAlive: true }, { evidenceFor, now: NOW })).toEqual({ reap: true, reason: 'done' });
    expect(classifySessionReapWithVerdict({ ...unstick, pidAlive: false }, { evidenceFor, now: NOW })).toEqual({ reap: true, reason: 'pid-dead' });
    expect(classifySessionReapWithVerdict({ kind: 'interactive', name: 'x', state: 'done' }, { evidenceFor, now: NOW })).toEqual({ reap: false, reason: 'not-background' });
  });

  it('without evidenceFor it is byte-identical to the ground-truth plan (strictly additive)', () => {
    expect(JSON.stringify(sessionReapPlan(rows, { now: NOW }))).toBe(JSON.stringify(sessionReapPlan(rows)));
    expect(sessionReapPlan(rows, { now: NOW }).reap).toEqual([]);
  });

  it('an evidence reader that throws means unknown, never a reap', () => {
    const boom = () => { throw new Error('disk gone'); };
    expect(sessionReapPlan(rows, { evidenceFor: boom, now: NOW }).reap).toEqual([]);
  });

  it('a row without a resolved pidAlive is never reaped by the verdict axis', () => {
    const unprobed = { ...unstick }; // no pidAlive fact
    expect(classifySessionReapWithVerdict(unprobed, { evidenceFor, now: NOW }).reap).toBe(false);
  });
});
