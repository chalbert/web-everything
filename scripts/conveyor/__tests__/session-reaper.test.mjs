/**
 * @file scripts/conveyor/__tests__/session-reaper.test.mjs
 * @description Unit proof of the conveyor SESSION REAPER's PURE core (WE #3435, plus the ground-truth axis
 *   found live 2026-09-03 on `conveyor-3451`). Drives {@link classifySessionReap} / {@link sessionTarget} /
 *   {@link classifySessionReapWithGroundTruth} / {@link sessionReapPlan} directly with fixtures shaped exactly
 *   as `claude agents --json` reports them (NO fs / exec / clock) — pins the Done-when #2 proof (a mixed
 *   working/blocked/done/failed/stopped listing only reaps `done`/`failed`, never a live or blocked one)
 *   plus the `kind !== 'background'` guard against ever touching an interactive session, AND the new proof
 *   that a `working`/`blocked` session is reaped once — and ONLY once — its own target is confirmed done.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  classifySessionReap,
  classifySessionReapWithGroundTruth,
  sessionTarget,
  sessionReapPlan,
  groundTruthForItem,
  groundTruthForPr,
  makeGroundTruthResolver,
  makeCompletionResolver,
  DEFAULT_IDLE_REAP_THRESHOLD_MS,
  TERMINAL_REAP_STATES,
  ALREADY_STOPPED_STATES,
  stopSessionWithRetry,
  STOP_RETRY_ATTEMPTS,
  STOP_RETRY_BACKOFF_MS,
  runSessionReaperPass,
  makeHungResolver,
  planBackstopCompletion,
  UNREPORTED_EXIT_OUTCOME,
  classifyRetention,
  retentionGroundTruthForItem,
  retentionGroundTruthForPr,
  makeRetentionGroundTruthResolver,
  makeIntrospectionDoneResolver,
  makeCostRolledUpResolver,
  resolveRetentionGraceMs,
  resolveRetentionCeilingMs,
  runRetentionSweepPass,
  RETENTION_GRACE_MS_DEFAULT,
  RETENTION_CEILING_MS_DEFAULT,
} from '../session-reaper.mjs';
import { INFRA_RETRY_COOLOFF_MS } from '../reconcile-core.mjs';
import { newCompletionRecord, applyCompletionUpdate, writeCompletion } from '../../operations/completion-store.mjs';
import { newDeliveryReport, writeDeliveryReport } from '../../operations/delivery-report-store.mjs';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('sessionTarget — the dispatcher-minted grammar a session name encodes', () => {
  it('item-kind names (conveyor / prepare / prepare-decision), with a retry-attempt letter collapsed to the base', () => {
    expect(sessionTarget('conveyor-3451')).toEqual({ kind: 'item', id: '3451' });
    expect(sessionTarget('conveyor-3411b')).toEqual({ kind: 'item', id: '3411' });
    expect(sessionTarget('prepare-3399')).toEqual({ kind: 'item', id: '3399' });
    expect(sessionTarget('prepare-decision-3457')).toEqual({ kind: 'item', id: '3457' });
  });
  it('PR-kind names (review / fix / ci-heal / inspect) — a PR number, never an item number', () => {
    expect(sessionTarget('review-1871')).toEqual({ kind: 'pr', id: '1871', repo: 'we' });
    expect(sessionTarget('fix-1852')).toEqual({ kind: 'pr', id: '1852', repo: 'we' });
    expect(sessionTarget('ci-heal-1852c')).toEqual({ kind: 'pr', id: '1852', repo: 'we' });
    // epic #3383's diagnosis-only stuck-PR inspection dispatch — covered for free by the shared grammar.
    expect(sessionTarget('inspect-2505')).toEqual({ kind: 'pr', id: '2505', repo: 'we' });
    expect(sessionTarget('inspect-pa-176')).toEqual({ kind: 'pr', id: '176', repo: 'plateau-app' });
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

describe('groundTruthForItem — the local, unbounded backlog-status IO helper', () => {
  const fakeIo = (files) => ({
    readdirSyncFn: () => Object.keys(files),
    readFileSyncFn: (path) => {
      const name = path.split('/').pop();
      if (!(name in files)) throw new Error(`ENOENT: ${path}`);
      return files[name];
    },
  });

  it('resolved:true only when status is exactly `resolved`, matching by id prefix', () => {
    const io = fakeIo({ '3451-build-the-thing.md': '---\nstatus: resolved\n---\n# T\n' });
    expect(groundTruthForItem('3451', { backlogDir: '/backlog', ...io })).toEqual({ resolved: true, evidence: 'backlog#3451:resolved' });
  });
  it('resolved:false for any other status', () => {
    const io = fakeIo({ '2786-close-the-gap.md': '---\nstatus: active\n---\n# T\n' });
    expect(groundTruthForItem('2786', { backlogDir: '/backlog', ...io })).toEqual({ resolved: false });
  });
  it('resolved:false, never true, when no card matches the id at all — absence is never done', () => {
    const io = fakeIo({ '9999-unrelated.md': '---\nstatus: resolved\n---\n' });
    expect(groundTruthForItem('3451', { backlogDir: '/backlog', ...io })).toEqual({ resolved: false });
  });
  it('a numeric-prefix collision (id "3" vs file "345-...") never false-matches — the hyphen boundary holds', () => {
    const io = fakeIo({ '345-something-else.md': '---\nstatus: resolved\n---\n' });
    expect(groundTruthForItem('3', { backlogDir: '/backlog', ...io })).toEqual({ resolved: false });
  });
  it('returns null (unknown) when the backlog directory itself is unreadable', () => {
    const io = { readdirSyncFn: () => { throw new Error('ENOENT'); }, readFileSyncFn: () => '' };
    expect(groundTruthForItem('3451', { backlogDir: '/nope', ...io })).toBeNull();
  });
});

describe('groundTruthForPr — the bounded, network gh pr view IO helper', () => {
  it('resolved:true when gh reports a mergedAt timestamp', () => {
    const exec = () => JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-03T11:57:41Z' });
    expect(groundTruthForPr('1862', { exec })).toEqual({ resolved: true, evidence: 'pr#1862:merged' });
  });
  it('resolved:true when state reads MERGED even without a mergedAt field', () => {
    const exec = () => JSON.stringify({ state: 'MERGED' });
    expect(groundTruthForPr('1862', { exec })).toEqual({ resolved: true, evidence: 'pr#1862:merged' });
  });
  it('resolved:false for an open PR — the review-1871 shape', () => {
    const exec = () => JSON.stringify({ state: 'OPEN', mergedAt: null });
    expect(groundTruthForPr('1871', { exec })).toEqual({ resolved: false });
  });
  it('returns null (unknown) when gh itself fails — never reaps on an unreadable signal', () => {
    const exec = () => { throw new Error('gh: command not found'); };
    expect(groundTruthForPr('1862', { exec })).toBeNull();
  });
});

describe('makeGroundTruthResolver — routing, caching, and the gh pr view call cap', () => {
  it('routes item-kind to the local backlog read and pr-kind to gh, each exactly once per distinct target (caching)', () => {
    let itemReads = 0;
    let prCalls = 0;
    const resolver = makeGroundTruthResolver({
      backlogDir: '/backlog',
      readdirSyncFn: () => { itemReads++; return ['3451-x.md']; },
      readFileSyncFn: () => '---\nstatus: resolved\n---\n',
      exec: () => { prCalls++; return JSON.stringify({ state: 'MERGED' }); },
    });
    expect(resolver({ kind: 'item', id: '3451' })).toEqual({ resolved: true, evidence: 'backlog#3451:resolved' });
    expect(resolver({ kind: 'item', id: '3451' })).toEqual({ resolved: true, evidence: 'backlog#3451:resolved' });
    expect(resolver({ kind: 'pr', id: '1862' })).toEqual({ resolved: true, evidence: 'pr#1862:merged' });
    expect(resolver({ kind: 'pr', id: '1862' })).toEqual({ resolved: true, evidence: 'pr#1862:merged' });
    expect(itemReads).toBe(1); // cached — the second identical lookup cost nothing
    expect(prCalls).toBe(1); // cached — same
  });

  it('bounds gh pr view calls at maxPrViewCalls — a candidate past the cap reads null (unknown), not an unbounded burst', () => {
    let prCalls = 0;
    const resolver = makeGroundTruthResolver({
      maxPrViewCalls: 1,
      exec: () => { prCalls++; return JSON.stringify({ state: 'MERGED' }); },
    });
    expect(resolver({ kind: 'pr', id: '1' })).toEqual({ resolved: true, evidence: 'pr#1:merged' });
    expect(resolver({ kind: 'pr', id: '2' })).toBeNull(); // past the cap — never called
    expect(prCalls).toBe(1);
  });

  it('local item-kind lookups are never subject to the gh call cap', () => {
    const resolver = makeGroundTruthResolver({
      maxPrViewCalls: 0,
      backlogDir: '/backlog',
      readdirSyncFn: () => ['1-x.md', '2-y.md'],
      readFileSyncFn: () => '---\nstatus: resolved\n---\n',
    });
    expect(resolver({ kind: 'item', id: '1' })).toEqual({ resolved: true, evidence: 'backlog#1:resolved' });
    expect(resolver({ kind: 'item', id: '2' })).toEqual({ resolved: true, evidence: 'backlog#2:resolved' });
  });
});

// ── stopSessionWithRetry — WE #3479, found live 2026-09-04: the ONE session-reaper.mjs mechanical-pass failure
//    `runner.log` recorded over a 190+-tick live overnight run traced to a per-candidate `claude stop` failure
//    tripping the WHOLE pass's exit code, undiagnosable only because `runQuiet`'s own truncation (see
//    `skills-src/conveyor/runner.mjs`'s `summarizeMechanicalPassError`) discarded the real error text. A live
//    concurrency stress test (25 concurrent `claude stop` + 10 concurrent `claude agents --json --all` calls,
//    repeated) never reproduced a hard failure, so the retry targets a real-but-rare transient class, not a
//    reproduced deterministic bug — this proves the RETRY mechanics in isolation with a fake `exec`. ───────────

describe('stopSessionWithRetry — recovers a transient `claude stop` failure instead of failing the whole pass', () => {
  function flakyExec(failTimes, { message = 'some transient CLI-internal lock' } = {}) {
    let calls = 0;
    const fn = (..._args) => {
      calls++;
      if (calls <= failTimes) {
        const e = new Error(`Command failed: claude stop`);
        e.stderr = message;
        throw e;
      }
      return 'stopped abcd1234\n';
    };
    Object.defineProperty(fn, 'calls', { get: () => calls });
    return fn;
  }

  it('succeeds on the first attempt when `claude stop` succeeds immediately — no retry, no sleep', () => {
    const exec = flakyExec(0);
    let slept = 0;
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: () => { slept++; } });
    expect(res).toEqual({ stopped: true, alreadyGone: false, output: 'stopped abcd1234\n' });
    expect(exec.calls).toBe(1);
    expect(slept).toBe(0);
  });

  it('recovers a transient failure that clears within the retry budget (fails once, succeeds on retry 2)', () => {
    const exec = flakyExec(1);
    const sleeps = [];
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: (ms) => sleeps.push(ms) });
    expect(res.stopped).toBe(true);
    expect(exec.calls).toBe(2);
    expect(sleeps).toEqual([STOP_RETRY_BACKOFF_MS[0]]); // one backoff wait, before the 2nd attempt
  });

  it(`still throws once ALL ${STOP_RETRY_ATTEMPTS} attempts fail — a genuine failure, not swallowed`, () => {
    const exec = flakyExec(STOP_RETRY_ATTEMPTS);
    const sleeps = [];
    expect(() => stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: (ms) => sleeps.push(ms) })).toThrow(/claude stop/);
    expect(exec.calls).toBe(STOP_RETRY_ATTEMPTS);
    expect(sleeps).toEqual(STOP_RETRY_BACKOFF_MS); // backed off before every retry, never after the last attempt
  });

  it('never retries an `alreadyGone` answer — that is not a failure, resolved on the first call', () => {
    let calls = 0;
    const exec = () => {
      calls++;
      const e = new Error('boom');
      e.stderr = "No job matching 'abcd1234'. Run 'claude agents' to list running sessions.";
      throw e;
    };
    let slept = 0;
    const res = stopSessionWithRetry({ handle: 'abcd1234', exec, sleep: () => { slept++; } });
    expect(res).toEqual({ stopped: true, alreadyGone: true, output: expect.stringContaining('No job matching') });
    expect(calls).toBe(1);
    expect(slept).toBe(0);
  });
});

describe('repo-aware ground truth', () => {
  it('keeps separate cached answers and sends explicit gh repos', () => {
    expect(sessionTarget('review-fui-49')).toEqual({ kind: 'pr', id: '49', repo: 'frontierui' });
    const calls = [];
    const groundTruthFor = makeGroundTruthResolver({ exec: (file, args) => {
      calls.push([file, args]);
      return JSON.stringify({ state: args.includes('chalbert/frontierui') ? 'OPEN' : 'MERGED' });
    } });
    const listing = ['review-49', 'review-fui-49', 'fix-fui-49'].map((name) => bg({ name, sessionId: name, state: 'working' }));
    const { reap, keep } = sessionReapPlan(listing, { groundTruthFor });
    expect(reap.map((r) => r.session.name)).toEqual(['review-49']);
    expect(keep.map((r) => r.session.name)).toEqual(['review-fui-49', 'fix-fui-49']);
    expect(calls).toEqual(['chalbert/web-everything', 'chalbert/frontierui'].map((repo) => ['gh', ['pr', 'view', '49', '--repo', repo, '--json', 'state,mergedAt']]));
  });
  it('keeps sessions on unknown repo or gh failure', () => {
    const listing = [bg({ name: 'review-fui-49', state: 'working' })];
    const exec = () => { throw new Error('gh failed'); };
    expect(groundTruthForPr(49, { repo: 'unknown', exec: () => { throw new Error('must not call'); } })).toBeNull();
    for (const groundTruthFor of [makeGroundTruthResolver({ exec }), () => groundTruthForPr(49, { repo: 'unknown', exec })]) {
      const plan = sessionReapPlan(listing, { groundTruthFor });
      expect(plan.reap).toEqual([]);
      expect(plan.keep).toHaveLength(1);
    }
  });
});

it('shares the lookup cap across repos', () => {
  let calls = 0;
  const groundTruthFor = makeGroundTruthResolver({ maxPrViewCalls: 1, exec: () => {
    calls++; return '{"state":"MERGED"}';
  } });
  const sessions = ['review-49', 'review-fui-49'].map((name) => bg({ name, state: 'working' }));
  const plan = sessionReapPlan(sessions, { groundTruthFor });
  expect(calls).toBe(1);
  expect(plan.reap.map((r) => r.session.name)).toEqual(['review-49']);
  expect(plan.keep.map((r) => r.session.name)).toEqual(['review-fui-49']);
});

// ── epic #3383 daemon split: cwd scoping, the never-reap-working stricter mode, the completion-record axis,
//    and the idle-timeout backstop. All four are ADDITIVE (see each function's own doc) — every test above
//    this point exercises the pre-#3383 default and still passes unchanged. ──────────────────────────────────

describe('classifySessionReap — allowedCwd, a second structural guard (epic #3383)', () => {
  it('omitting allowedCwd is byte-identical to before — no behavior change for an existing caller', () => {
    expect(classifySessionReap(bg({ state: 'done' }))).toEqual({ reap: true, reason: 'done' });
    expect(classifySessionReap(bg({ state: 'done' }), {})).toEqual({ reap: true, reason: 'done' });
  });
  it('a session whose cwd does not match allowedCwd is never reaped, even a `done` one', () => {
    expect(classifySessionReap(bg({ state: 'done', cwd: '/some/other/checkout' }), { allowedCwd: '/repo' }))
      .toEqual({ reap: false, reason: 'wrong-cwd' });
  });
  it('a session whose cwd matches allowedCwd is reaped normally', () => {
    expect(classifySessionReap(bg({ state: 'done', cwd: '/repo' }), { allowedCwd: '/repo' }))
      .toEqual({ reap: true, reason: 'done' });
  });
  it('the cwd guard is checked before the state axis — a wrong-cwd working session is `wrong-cwd`, not `not-terminal`', () => {
    expect(classifySessionReap(bg({ state: 'working', cwd: '/elsewhere' }), { allowedCwd: '/repo' }))
      .toEqual({ reap: false, reason: 'wrong-cwd' });
  });
  it('an empty-string allowedCwd is treated as "no guard" (never refuses every session with a falsy cwd)', () => {
    expect(classifySessionReap(bg({ state: 'done' }), { allowedCwd: '' })).toEqual({ reap: true, reason: 'done' });
  });
});

describe('classifySessionReapWithGroundTruth — neverReapWorking (epic #3383 stricter mode)', () => {
  const alwaysResolved = () => ({ resolved: true, evidence: 'x' });
  const alwaysDone = () => ({ done: true });

  it('defaults to false — a `working` session is still upgradable by ground truth (unchanged pre-existing behavior)', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-1862' }), alwaysResolved))
      .toEqual({ reap: true, reason: 'ground-truth-pr:x' });
  });
  it('true — a `working` session is NEVER upgraded, even when ground truth says resolved', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-1862' }), alwaysResolved, { neverReapWorking: true }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('true — a `working` session is NEVER upgraded, even by a completion record reporting done', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-1862' }), null, { neverReapWorking: true, completionFor: alwaysDone }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('true — a `blocked` session (never `working`) is still upgradable', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), alwaysResolved, { neverReapWorking: true }))
      .toEqual({ reap: true, reason: 'ground-truth-pr:x' });
  });
  it('true — an already-terminal `done` session is unaffected (the flag only touches the ground-truth axis)', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'done', name: 'review-1862' }), alwaysResolved, { neverReapWorking: true }))
      .toEqual({ reap: true, reason: 'done' });
  });
});

describe('classifySessionReapWithGroundTruth — hung-transcript detection, axis 0 (epic #3383 continuation)', () => {
  const alwaysHung = () => ({ hung: true, reason: 'stale-no-activity' });
  const neverHung = () => ({ hung: false, reason: 'fresh' });

  it('a `working` session confirmed hung is reaped — THE LIVE CASE (review-2582, state working, dead)', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-2582' }), null, { hungFor: alwaysHung }))
      .toEqual({ reap: true, reason: 'hung-transcript:stale-no-activity' });
  });

  it('OVERRIDES `neverReapWorking:true` — the one axis allowed to, since it independently disproves `working` itself', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-2582' }), null, { neverReapWorking: true, hungFor: alwaysHung }))
      .toEqual({ reap: true, reason: 'hung-transcript:stale-no-activity' });
  });

  it('a `blocked` session confirmed hung is reaped too, tried BEFORE the ground-truth/completion/idle axes', () => {
    let groundTruthCalled = false;
    const groundTruthFor = () => { groundTruthCalled = true; return { resolved: false }; };
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-2599' }), groundTruthFor, { hungFor: alwaysHung }))
      .toEqual({ reap: true, reason: 'hung-transcript:stale-no-activity' });
    expect(groundTruthCalled).toBe(false);
  });

  it('a resolver answering not-hung falls through to every later axis unaffected', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-2582' }), null, { neverReapWorking: true, hungFor: neverHung }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });

  it('a resolver that throws is treated as unknown, never a guess, and never crashes the pass', () => {
    const throws = () => { throw new Error('unreadable transcript'); };
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-2582' }), null, { hungFor: throws }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });

  it('omitting hungFor entirely is byte-identical to before — additive only', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'review-2582' }), null, { neverReapWorking: true }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });

  it('an already-terminal `done` session is unaffected — axis 0 only ever runs after the base `not-terminal` check', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'done', name: 'review-2582' }), null, { hungFor: alwaysHung }))
      .toEqual({ reap: true, reason: 'done' });
  });
});

describe('makeHungResolver — the IO-shell resolver over hung-session.mjs (epic #3383 continuation)', () => {
  it('delegates to readHungInfo with the injected clock and threshold, never throwing on a bad row', () => {
    const resolver = makeHungResolver({ thresholdMs: 30 * 60_000, now: () => 1_000_000 });
    // No cwd/sessionId on this fixture (`bg()` DOES carry both — strip them to hit the "no signal" path) —
    // proves the resolver never throws even when the shared detector cannot locate a transcript at all.
    const { cwd, sessionId, ...noTranscript } = bg({ state: 'working' });
    expect(resolver(noTranscript)).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
  });
});

describe('classifySessionReapWithGroundTruth — the completion-record axis (epic #3383, #3436)', () => {
  it('a `blocked` session whose completion record reports done is reaped, tried BEFORE backlog/PR ground truth', () => {
    let groundTruthCalled = false;
    const groundTruthFor = () => { groundTruthCalled = true; return { resolved: false }; };
    const completionFor = () => ({ done: true });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), groundTruthFor, { completionFor }))
      .toEqual({ reap: true, reason: 'completion-record-done' });
    expect(groundTruthCalled).toBe(false); // axis 1 fired first — axis 2 never needed to run
  });
  it('a completion record reporting NOT done falls through to the backlog/PR axis, never reaps on its own', () => {
    const completionFor = () => ({ done: false });
    const groundTruthFor = () => ({ resolved: true, evidence: 'pr#1862:merged' });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), groundTruthFor, { completionFor }))
      .toEqual({ reap: true, reason: 'ground-truth-pr:pr#1862:merged' });
  });
  it('a `null` (unknown) completion-record answer falls through cleanly — never a guess', () => {
    const completionFor = () => null;
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), () => ({ resolved: false }), { completionFor }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('omitting completionFor entirely is byte-identical to before — additive only', () => {
    const groundTruthFor = () => ({ resolved: false });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), groundTruthFor))
      .toEqual(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'review-1862' }), groundTruthFor, {}));
  });
});

describe('classifySessionReapWithGroundTruth — the idle-timeout backstop, axis 3 (epic #3383)', () => {
  it('disabled by default (idleThresholdMs: 0) — a stale, unconfirmed `blocked` session is kept', () => {
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'test-dontask', startedAt: 0 }), null, { now: DEFAULT_IDLE_REAP_THRESHOLD_MS * 10 }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('reaps a `blocked` session once it has aged past the threshold with no other axis able to confirm it', () => {
    const now = 10_000_000;
    const startedAt = now - DEFAULT_IDLE_REAP_THRESHOLD_MS - 1;
    const verdict = classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'test-dontask', startedAt }), null, { idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS, now });
    expect(verdict.reap).toBe(true);
    expect(verdict.reason).toBe(`idle-threshold:${DEFAULT_IDLE_REAP_THRESHOLD_MS + 1}ms`);
  });
  it('never fires before the threshold is reached', () => {
    const now = 10_000_000;
    const startedAt = now - DEFAULT_IDLE_REAP_THRESHOLD_MS + 1;
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'test-dontask', startedAt }), null, { idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS, now }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('NEVER fires for `working` — the idle clock is not a way around neverReapWorking or the working axis', () => {
    const now = 10_000_000;
    const startedAt = now - DEFAULT_IDLE_REAP_THRESHOLD_MS - 1;
    expect(classifySessionReapWithGroundTruth(bg({ state: 'working', name: 'test-dontask', startedAt }), null, { idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS, now }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('never overrides an explicit `resolved: false` from the backlog/PR axis — positive "still open" evidence wins over age', () => {
    const now = 10_000_000;
    const startedAt = now - DEFAULT_IDLE_REAP_THRESHOLD_MS - 1;
    const stillOpen = () => ({ resolved: false });
    expect(classifySessionReapWithGroundTruth(bg({ state: 'blocked', name: 'conveyor-2786', startedAt }), stillOpen, { idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS, now }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
  it('a missing/non-numeric startedAt never crashes and never fires', () => {
    const { startedAt, ...noStart } = bg({ state: 'blocked', name: 'test-dontask' });
    expect(classifySessionReapWithGroundTruth(noStart, null, { idleThresholdMs: 1 }))
      .toEqual({ reap: false, reason: 'not-terminal' });
  });
});

describe('runSessionReaperPass — the reusable IO-shell pass a daemon calls directly (epic #3383)', () => {
  it('with every effect injected (no real fs/exec), stops the reaped session and reports the same shape the CLI prints', () => {
    const result = runSessionReaperPass({
      listAgents: () => [
        { id: 'done1', sessionId: 'done-1-full-uuid', cwd: '/daemon-clone', kind: 'background', state: 'done', name: 'review-1862' },
        { id: 'live1', sessionId: 'live-1-full-uuid', cwd: '/daemon-clone', kind: 'background', state: 'working', name: 'fix-99' },
      ],
      groundTruthFor: () => ({ resolved: false }),
      completionFor: () => null,
      allowedCwd: '/daemon-clone',
      stop: ({ handle }) => ({ stopped: true, alreadyGone: false, output: `stopped ${handle}` }),
      backstopCompletion: false, // this test's own title promises "no real fs/exec" — the backstop write is covered separately below
      log: () => {},
    });
    expect(result.scanned).toBe(2);
    expect(result.stopped).toBe(1);
    expect(result.kept).toBe(1);
    expect(result.collected).toEqual([{ id: 'done1', sessionId: 'done-1-full-uuid', name: 'review-1862', reason: 'done', alreadyGone: false }]);
  });

  it('an unreadable listing returns `unreadable: true` and touches nothing else — never throws', () => {
    const result = runSessionReaperPass({ listAgents: () => { throw new Error('claude: command not found'); }, log: () => {} });
    expect(result).toEqual({
      scanned: 0, stopped: 0, alreadyGone: 0, failures: 0, anomalies: 0, backstopWritten: 0,
      wouldWriteBackstop: undefined, wouldStop: undefined, collected: [], kept: 0, unreadable: true,
    });
  });

  it('a `dry-run` pass never calls `stop` at all', () => {
    let stopCalls = 0;
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'done1', sessionId: 'done-1-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' }],
      groundTruthFor: null,
      completionFor: null,
      dryRun: true,
      stop: () => { stopCalls++; return { stopped: true, alreadyGone: false, output: '' }; },
      backstopCompletion: false,
      log: () => {},
    });
    expect(stopCalls).toBe(0);
    expect(result.wouldStop).toEqual([{ id: 'done1', sessionId: 'done-1-full-uuid', name: 'conveyor-1', reason: 'done' }]);
  });

  it('threads neverReapWorking + completionFor + allowedCwd through to the plan exactly like sessionReapPlan does directly', () => {
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'w1', sessionId: 'w1-full', cwd: '/daemon-clone', kind: 'background', state: 'working', name: 'review-1862' }],
      groundTruthFor: () => ({ resolved: true, evidence: 'pr#1862:merged' }),
      completionFor: () => ({ done: true }),
      allowedCwd: '/daemon-clone',
      neverReapWorking: true,
      dryRun: true,
      backstopCompletion: false,
      log: () => {},
    });
    expect(result.wouldStop).toEqual([]);
    expect(result.kept).toBe(1);
  });

  it('threads hungFor through, and it overrides neverReapWorking exactly like classifySessionReapWithGroundTruth does directly', () => {
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'w2', sessionId: 'w2-full', cwd: '/daemon-clone', kind: 'background', state: 'working', name: 'review-2582' }],
      groundTruthFor: () => ({ resolved: false }),
      completionFor: () => null,
      neverReapWorking: true,
      hungFor: () => ({ hung: true, reason: 'stale-no-activity' }),
      dryRun: true,
      backstopCompletion: false,
      log: () => {},
    });
    expect(result.wouldStop).toEqual([{ id: 'w2', sessionId: 'w2-full', name: 'review-2582', reason: 'hung-transcript:stale-no-activity' }]);
    expect(result.kept).toBe(0);
  });
});

describe('planBackstopCompletion — the root-cause fix, not just detection (xbv32pg follow-up, epic #3383)', () => {
  it('mints a fresh done/unreported-exit record for a review-<pr> session with NO existing record', () => {
    const rec = planBackstopCompletion({ name: 'review-2599' }, null, () => '2026-09-24T21:00:00.000Z');
    expect(rec).toMatchObject({
      session: 'review-2599', kind: 'review', pr: '2599', status: 'done', outcome: UNREPORTED_EXIT_OUTCOME,
      startedAt: '2026-09-24T21:00:00.000Z', updatedAt: '2026-09-24T21:00:00.000Z',
    });
  });

  it('upgrades an existing `started` record to done/unreported-exit, preserving its startedAt', () => {
    const existing = { v: 1, session: 'fix-2607', kind: 'fix', pr: '2607', item: null, status: 'started', outcome: null, verdict: null, label: null, runId: null, startedAt: '2026-09-24T18:40:00.000Z', updatedAt: '2026-09-24T18:40:00.000Z' };
    const rec = planBackstopCompletion({ name: 'fix-2607' }, existing, () => '2026-09-24T21:00:00.000Z');
    expect(rec).toMatchObject({ session: 'fix-2607', status: 'done', outcome: UNREPORTED_EXIT_OUTCOME, startedAt: '2026-09-24T18:40:00.000Z', updatedAt: '2026-09-24T21:00:00.000Z' });
  });

  it('NEVER overwrites a genuinely done record, whatever its outcome — a backstop only ever fills a gap', () => {
    const existing = { v: 1, session: 'review-2607', kind: 'review', pr: '2607', item: null, status: 'done', outcome: 'blocked-on-infra', verdict: null, label: null, runId: null, startedAt: '2026-09-24T18:40:00.000Z', updatedAt: '2026-09-24T18:45:00.000Z' };
    expect(planBackstopCompletion({ name: 'review-2607' }, existing)).toBeNull();
  });

  it('never mints one for an item-kind session (conveyor-*/prepare-*) — no completion-record mechanism exists for those', () => {
    expect(planBackstopCompletion({ name: 'conveyor-3451' }, null)).toBeNull();
    expect(planBackstopCompletion({ name: 'prepare-3436' }, null)).toBeNull();
  });

  it('never mints one for ci-heal-<pr> — a real PR-kind name, but no completion-record kind exists for it', () => {
    expect(planBackstopCompletion({ name: 'ci-heal-2607' }, null)).toBeNull();
  });

  it('never mints one for a name matching no known grammar — never a guess', () => {
    expect(planBackstopCompletion({ name: 'my terminal' }, null)).toBeNull();
    expect(planBackstopCompletion({ name: undefined }, null)).toBeNull();
  });
});

describe('runSessionReaperPass — the backstop-completion write (xbv32pg follow-up, epic #3383)', () => {
  it('writes a done/unreported-exit record for a session reaped via the hung axis with no existing record', () => {
    const written = [];
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'w2', sessionId: 'w2-full', cwd: '/daemon-clone', kind: 'background', state: 'working', name: 'review-2582' }],
      groundTruthFor: () => ({ resolved: false }),
      completionFor: () => null,
      neverReapWorking: true,
      hungFor: () => ({ hung: true, reason: 'stale-no-activity' }),
      stop: ({ handle }) => ({ stopped: true, alreadyGone: false, output: `stopped ${handle}` }),
      readCompletionRecord: () => null,
      writeCompletionRecord: (rec) => { written.push(rec); },
      log: () => {},
    });
    expect(result.backstopWritten).toBe(1);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ session: 'review-2582', kind: 'review', pr: '2582', status: 'done', outcome: UNREPORTED_EXIT_OUTCOME });
  });

  it('never writes over an existing done record', () => {
    const written = [];
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'd1', sessionId: 'd1-full', kind: 'background', state: 'done', name: 'review-1862' }],
      groundTruthFor: () => null,
      completionFor: () => null,
      stop: ({ handle }) => ({ stopped: true, alreadyGone: false, output: `stopped ${handle}` }),
      readCompletionRecord: () => ({ status: 'done', outcome: 'accepted' }),
      writeCompletionRecord: (rec) => { written.push(rec); },
      log: () => {},
    });
    expect(result.backstopWritten).toBe(0);
    expect(written).toHaveLength(0);
  });

  it('`backstopCompletion: false` is a full rollback escape hatch — never calls writeCompletionRecord at all', () => {
    let readCalls = 0;
    const written = [];
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'd1', sessionId: 'd1-full', kind: 'background', state: 'done', name: 'review-1862' }],
      groundTruthFor: () => null,
      completionFor: () => null,
      backstopCompletion: false,
      stop: ({ handle }) => ({ stopped: true, alreadyGone: false, output: `stopped ${handle}` }),
      readCompletionRecord: () => { readCalls++; return null; },
      writeCompletionRecord: (rec) => { written.push(rec); },
      log: () => {},
    });
    expect(readCalls).toBe(0);
    expect(written).toHaveLength(0);
    expect(result.backstopWritten).toBe(0);
  });

  it('a dry-run pass reports what it WOULD write but never calls writeCompletionRecord', () => {
    const written = [];
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'd1', sessionId: 'd1-full', kind: 'background', state: 'done', name: 'review-1862' }],
      groundTruthFor: () => null,
      completionFor: () => null,
      dryRun: true,
      readCompletionRecord: () => null,
      writeCompletionRecord: (rec) => { written.push(rec); },
      log: () => {},
    });
    expect(written).toHaveLength(0);
    expect(result.wouldWriteBackstop).toEqual([{ name: 'review-1862', outcome: UNREPORTED_EXIT_OUTCOME }]);
  });

  it('a readCompletionRecord that throws (corrupt record / invalid slug) skips the backstop this tick — never guesses, never crashes the pass', () => {
    const result = runSessionReaperPass({
      listAgents: () => [{ id: 'd1', sessionId: 'd1-full', kind: 'background', state: 'done', name: 'review-1862' }],
      groundTruthFor: () => null,
      completionFor: () => null,
      stop: ({ handle }) => ({ stopped: true, alreadyGone: false, output: `stopped ${handle}` }),
      readCompletionRecord: () => { throw new Error('corrupt record'); },
      writeCompletionRecord: () => { throw new Error('should never be called'); },
      log: () => {},
    });
    expect(result.backstopWritten).toBe(0);
    expect(result.stopped).toBe(1); // the stop itself still proceeds — the backstop write is a side concern
  });
});

describe('makeCompletionResolver — the IO helper over completion-store.mjs (#3436)', () => {
  it('returns null for a name completionPath refuses (e.g. an interactive session\'s free-text name) — never throws', () => {
    const resolver = makeCompletionResolver({ dir: '/does/not/matter' });
    expect(resolver('my terminal')).toBeNull();
    expect(resolver('')).toBeNull();
    expect(resolver(null)).toBeNull();
  });
  it('returns null when no record exists on disk for an otherwise-valid slug', () => {
    const resolver = makeCompletionResolver({ dir: '/tmp/we-session-reaper-completion-resolver-test-nonexistent' });
    expect(resolver('review-999999')).toBeNull();
  });

  describe('#2588/review-loops (epic #3383/#4075) — `blocked-on-infra` cool-off', () => {
    let dir;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cooloff-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it('does NOT report done while a `blocked-on-infra` outcome is still inside the cool-off — THE BUG: before this fix, `status: done` alone reaped the session immediately, erasing it from the listing before reconcile-core.mjs\'s own cool-off ever got a row to apply it to (PR re-dispatched ~2 min later)', () => {
      const startedAt = () => '2026-09-24T23:00:00.000Z';
      const updatedAt = '2026-09-24T23:05:00.000Z'; // 5 min after start — well inside the 15-min cool-off
      const rec = applyCompletionUpdate(
        newCompletionRecord({ session: 'review-2588', kind: 'review', pr: '2588', now: startedAt }),
        { status: 'done', outcome: 'blocked-on-infra' },
        () => updatedAt,
      );
      writeCompletion(rec, dir);
      const nowMs = Date.parse(updatedAt) + 5 * 60 * 1000; // 10 min after the report — still under the 15-min cap
      const resolver = makeCompletionResolver({ dir, now: () => nowMs });
      expect(resolver('review-2588')).toEqual({ done: false });
    });

    it('reports done once the `blocked-on-infra` cool-off has elapsed', () => {
      const startedAt = () => '2026-09-24T23:00:00.000Z';
      const updatedAt = '2026-09-24T23:05:00.000Z';
      const rec = applyCompletionUpdate(
        newCompletionRecord({ session: 'review-2588', kind: 'review', pr: '2588', now: startedAt }),
        { status: 'done', outcome: 'blocked-on-infra' },
        () => updatedAt,
      );
      writeCompletion(rec, dir);
      const nowMs = Date.parse(updatedAt) + INFRA_RETRY_COOLOFF_MS + 1000; // just past the 15-min cap
      const resolver = makeCompletionResolver({ dir, now: () => nowMs });
      expect(resolver('review-2588')).toEqual({ done: true });
    });

    it('a non-infra outcome (a real verdict) reports done immediately — the cool-off applies ONLY to `blocked-on-infra`', () => {
      const startedAt = () => '2026-09-24T23:00:00.000Z';
      const updatedAt = '2026-09-24T23:05:00.000Z';
      const rec = applyCompletionUpdate(
        newCompletionRecord({ session: 'review-2588', kind: 'review', pr: '2588', now: startedAt }),
        { status: 'done', outcome: 'accepted' },
        () => updatedAt,
      );
      writeCompletion(rec, dir);
      const nowMs = Date.parse(updatedAt) + 1000; // 1 second later
      const resolver = makeCompletionResolver({ dir, now: () => nowMs });
      expect(resolver('review-2588')).toEqual({ done: true });
    });

    it('classifySessionReapWithGroundTruth does not upgrade a `blocked`/`working` session to reap while its own completion resolver is still inside the cool-off', () => {
      const startedAt = () => '2026-09-24T23:00:00.000Z';
      const updatedAt = '2026-09-24T23:05:00.000Z';
      const rec = applyCompletionUpdate(
        newCompletionRecord({ session: 'review-2588', kind: 'review', pr: '2588', now: startedAt }),
        { status: 'done', outcome: 'blocked-on-infra' },
        () => updatedAt,
      );
      writeCompletion(rec, dir);
      const nowMs = Date.parse(updatedAt) + 5 * 60 * 1000;
      const completionFor = makeCompletionResolver({ dir, now: () => nowMs });
      const session = { name: 'review-2588', kind: 'background', state: 'blocked', cwd: '/repo' };
      const verdict = classifySessionReapWithGroundTruth(session, () => null, { completionFor });
      expect(verdict.reap).toBe(false);
    });
  });
});

// #4089 (epic #3383/#4075, statute `#conveyor-session-lifecycle-policy` clause 1) — the retention sweep: a
// FINISHED session's own RECORDS (completion record, delivery report, `claude agents` entry) are deletable
// only once the work they served is confirmed over, past a grace period, or unconditionally past a ceiling.
describe('classifyRetention — the pure two-path verdict', () => {
  const now = 1_000_000_000;
  it('PATH A: deletes once confirmed done, past the grace period', () => {
    const v = classifyRetention(
      { workDone: true, terminalAt: now - 1000, introspectionDone: true, costRolledUp: true, recordAgeMs: 500 },
      { graceMs: 999, ceilingMs: null, now },
    );
    expect(v).toEqual({ deletable: true, reason: 'grace-after-done' });
  });
  it('PATH A: NOT yet deletable before the grace period elapses', () => {
    const v = classifyRetention(
      { workDone: true, terminalAt: now - 10, introspectionDone: true, costRolledUp: true, recordAgeMs: 10 },
      { graceMs: 999, ceilingMs: null, now },
    );
    expect(v).toEqual({ deletable: false, reason: 'not-yet' });
  });
  it('PATH A: never deletes while `workDone`/`introspectionDone`/`costRolledUp` is not ALL true, however old', () => {
    for (const partial of [
      { workDone: false, terminalAt: now - 10_000, introspectionDone: true, costRolledUp: true },
      { workDone: true, terminalAt: now - 10_000, introspectionDone: false, costRolledUp: true },
      { workDone: true, terminalAt: now - 10_000, introspectionDone: true, costRolledUp: false },
    ]) {
      expect(classifyRetention({ ...partial, recordAgeMs: 10_000 }, { graceMs: 1, ceilingMs: null, now }))
        .toEqual({ deletable: false, reason: 'not-yet' });
    }
  });
  it("`graceMs: null` (the 'never' setting) disables path A outright", () => {
    const v = classifyRetention(
      { workDone: true, terminalAt: now - 1_000_000, introspectionDone: true, costRolledUp: true, recordAgeMs: 1_000_000 },
      { graceMs: null, ceilingMs: null, now },
    );
    expect(v).toEqual({ deletable: false, reason: 'not-yet' });
  });
  it('PATH B: the ceiling deletes unconditionally, even with workDone:false (a card that never finishes)', () => {
    const v = classifyRetention(
      { workDone: false, terminalAt: null, introspectionDone: false, costRolledUp: false, recordAgeMs: 5000 },
      { graceMs: null, ceilingMs: 4999, now },
    );
    expect(v).toEqual({ deletable: true, reason: 'ceiling' });
  });
  it("`ceilingMs: null` (the 'never' setting) disables path B outright", () => {
    const v = classifyRetention(
      { workDone: false, terminalAt: null, introspectionDone: false, costRolledUp: false, recordAgeMs: Number.MAX_SAFE_INTEGER },
      { graceMs: null, ceilingMs: null, now },
    );
    expect(v).toEqual({ deletable: false, reason: 'not-yet' });
  });
  it('the ceiling is checked FIRST — it wins even when path A would also say yes', () => {
    const v = classifyRetention(
      { workDone: true, terminalAt: now - 100, introspectionDone: true, costRolledUp: true, recordAgeMs: 10 },
      { graceMs: 1, ceilingMs: 5, now },
    );
    expect(v).toEqual({ deletable: true, reason: 'ceiling' });
  });
});

describe('resolveRetentionGraceMs / resolveRetentionCeilingMs — the env-overridable settings', () => {
  it('default to 1 day grace / 30 day ceiling when unset', () => {
    expect(resolveRetentionGraceMs({})).toBe(RETENTION_GRACE_MS_DEFAULT);
    expect(resolveRetentionCeilingMs({})).toBe(RETENTION_CEILING_MS_DEFAULT);
    expect(RETENTION_GRACE_MS_DEFAULT).toBe(24 * 60 * 60 * 1000);
    expect(RETENTION_CEILING_MS_DEFAULT).toBe(30 * 24 * 60 * 60 * 1000);
  });
  it('`WE_RETENTION_GRACE_HOURS` / `WE_RETENTION_CEILING_DAYS` override the defaults', () => {
    expect(resolveRetentionGraceMs({ WE_RETENTION_GRACE_HOURS: '2' })).toBe(2 * 60 * 60 * 1000);
    expect(resolveRetentionCeilingMs({ WE_RETENTION_CEILING_DAYS: '7' })).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it("the literal string 'never' disables the path (null), matching the statute's own \"no upper limit\" amendment", () => {
    expect(resolveRetentionGraceMs({ WE_RETENTION_GRACE_HOURS: 'never' })).toBeNull();
    expect(resolveRetentionCeilingMs({ WE_RETENTION_CEILING_DAYS: 'Never' })).toBeNull();
  });
});

describe('retentionGroundTruthForItem — item-kind ground truth (status + dateResolved)', () => {
  const fakeIo = (files) => ({
    readdirSyncFn: () => Object.keys(files),
    readFileSyncFn: (path) => {
      const name = path.split('/').pop();
      if (!(name in files)) throw new Error(`ENOENT: ${path}`);
      return files[name];
    },
  });
  it('workDone:true with a parsed terminalAt when status is resolved', () => {
    const io = fakeIo({ '4089-thing.md': '---\nstatus: resolved\ndateResolved: "2026-09-24"\n---\n# T\n' });
    expect(retentionGroundTruthForItem('4089', { backlogDir: '/backlog', ...io }))
      .toEqual({ workDone: true, terminalAt: Date.parse('2026-09-24') });
  });
  it('workDone:false for a `parked` item — this repo has no distinct `withdrawn` status, and parked may resume', () => {
    const io = fakeIo({ '4089-thing.md': '---\nstatus: parked\n---\n# T\n' });
    expect(retentionGroundTruthForItem('4089', { backlogDir: '/backlog', ...io })).toEqual({ workDone: false, terminalAt: null });
  });
  it('workDone:false, never true, when no card matches — absence is never done', () => {
    const io = fakeIo({ '9999-other.md': '---\nstatus: resolved\n---\n' });
    expect(retentionGroundTruthForItem('4089', { backlogDir: '/backlog', ...io })).toEqual({ workDone: false, terminalAt: null });
  });
  it('an unreadable backlog dir answers unknown, never a guess', () => {
    const io = { readdirSyncFn: () => { throw new Error('ENOENT'); }, readFileSyncFn: () => '' };
    expect(retentionGroundTruthForItem('4089', { backlogDir: '/backlog', ...io })).toEqual({ workDone: false, terminalAt: null });
  });
});

describe('retentionGroundTruthForPr — PR-kind ground truth (merged OR closed, wider than the stop axis)', () => {
  it('workDone:true for a MERGED pr, terminalAt from mergedAt', () => {
    const exec = () => JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-20T00:00:00Z' });
    expect(retentionGroundTruthForPr('100', { exec })).toEqual({ workDone: true, terminalAt: Date.parse('2026-09-20T00:00:00Z') });
  });
  it('workDone:true for a CLOSED (never merged) pr, terminalAt from closedAt', () => {
    const exec = () => JSON.stringify({ state: 'CLOSED', closedAt: '2026-09-21T00:00:00Z' });
    expect(retentionGroundTruthForPr('101', { exec })).toEqual({ workDone: true, terminalAt: Date.parse('2026-09-21T00:00:00Z') });
  });
  it('workDone:false for an OPEN pr', () => {
    const exec = () => JSON.stringify({ state: 'OPEN' });
    expect(retentionGroundTruthForPr('102', { exec })).toEqual({ workDone: false, terminalAt: null });
  });
  it('any `gh` failure answers null (unknown), never a guess', () => {
    const exec = () => { throw new Error('gh: not found'); };
    expect(retentionGroundTruthForPr('103', { exec })).toBeNull();
  });
});

describe('makeRetentionGroundTruthResolver — routes + caches, bounded PR calls', () => {
  it('routes item vs pr targets and caches repeat lookups', () => {
    let prCalls = 0;
    const exec = () => { prCalls++; return JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-20T00:00:00Z' }); };
    const resolver = makeRetentionGroundTruthResolver({
      exec,
      readdirSyncFn: () => ['4089-t.md'],
      readFileSyncFn: () => '---\nstatus: resolved\ndateResolved: "2026-09-24"\n---\n',
    });
    expect(resolver({ kind: 'item', id: '4089' })).toEqual({ workDone: true, terminalAt: Date.parse('2026-09-24') });
    expect(resolver({ kind: 'pr', id: '200', repo: 'we' })).toEqual({ workDone: true, terminalAt: Date.parse('2026-09-20T00:00:00Z') });
    expect(resolver({ kind: 'pr', id: '200', repo: 'we' })).toEqual({ workDone: true, terminalAt: Date.parse('2026-09-20T00:00:00Z') });
    expect(prCalls).toBe(1); // second lookup of the same target was cached
  });
  it('bounds `gh pr view` calls to maxPrViewCalls, leaving the rest unresolved (null) this pass', () => {
    let prCalls = 0;
    const exec = () => { prCalls++; return JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-20T00:00:00Z' }); };
    const resolver = makeRetentionGroundTruthResolver({ exec, maxPrViewCalls: 1 });
    expect(resolver({ kind: 'pr', id: '201' })).not.toBeNull();
    expect(resolver({ kind: 'pr', id: '202' })).toBeNull();
    expect(prCalls).toBe(1);
  });
});

describe('makeIntrospectionDoneResolver — the #3477 deferral gate', () => {
  it('vacuously true when introspection is OFF (the default) — nothing was ever asked to run', () => {
    expect(makeIntrospectionDoneResolver({ env: {} })()).toBe(true);
    expect(makeIntrospectionDoneResolver({ env: { WE_INTROSPECTION_ENABLED: '0' } })()).toBe(true);
  });
  it('fail-closed when introspection is turned ON — #3477 has not shipped a real signal to read yet', () => {
    expect(makeIntrospectionDoneResolver({ env: { WE_INTROSPECTION_ENABLED: '1' } })()).toBe(false);
  });
});

describe('makeCostRolledUpResolver — the #4071 explicit statute deferral', () => {
  it('always true today — "This condition applies only once #4071 exists"', () => {
    expect(makeCostRolledUpResolver()()).toBe(true);
  });
});

describe('runRetentionSweepPass — the IO shell', () => {
  let completionsDir;
  let deliveryDir;
  let previousCompletions;
  let previousDelivery;
  beforeEach(() => {
    completionsDir = mkdtempSync(join(tmpdir(), 'we-retention-completions-'));
    deliveryDir = mkdtempSync(join(tmpdir(), 'we-retention-delivery-'));
    // BOTH env vars, every test — a test that sets only one leaks onto this checkout's REAL
    // `.operations/delivery-reports`/`.operations/completions` (gitignored, so `git reset` never clears it,
    // and this file's own `runRetentionSweepPass` calls `resolveCompletionsDir`/`resolveDeliveryReportsDir`
    // INTERNALLY — it takes no `dir` override at all, unlike every fs-shell test elsewhere in this repo that
    // passes `dir` explicitly). Found live: an earlier draft of these tests set only one var and a non-dry-run
    // case deleted real leftover delivery reports from this very checkout.
    previousCompletions = process.env.OPERATION_COMPLETIONS_DIR;
    previousDelivery = process.env.OPERATION_DELIVERY_REPORTS_DIR;
    process.env.OPERATION_COMPLETIONS_DIR = completionsDir;
    process.env.OPERATION_DELIVERY_REPORTS_DIR = deliveryDir;
  });
  afterEach(() => {
    rmSync(completionsDir, { recursive: true, force: true });
    rmSync(deliveryDir, { recursive: true, force: true });
    if (previousCompletions === undefined) delete process.env.OPERATION_COMPLETIONS_DIR; else process.env.OPERATION_COMPLETIONS_DIR = previousCompletions;
    if (previousDelivery === undefined) delete process.env.OPERATION_DELIVERY_REPORTS_DIR; else process.env.OPERATION_DELIVERY_REPORTS_DIR = previousDelivery;
  });

  const baseOpts = (extra = {}) => ({
    retentionGroundTruthFor: () => ({ workDone: true, terminalAt: Date.now() - 2 * 24 * 60 * 60 * 1000 }),
    introspectionDoneFor: () => true,
    costRolledUpFor: () => true,
    graceMs: 24 * 60 * 60 * 1000,
    ceilingMs: null,
    now: Date.now(),
    listAgents: () => [],
    rm: () => ({ removed: true, alreadyGone: true, output: '' }),
    pruneRuns: () => ({ pruned: [] }),
    log: () => {},
    ...extra,
  });

  it('deletes a confirmed-done session\'s completion record and delivery report once past grace', () => {
    writeCompletion(newCompletionRecord({ session: 'conveyor-4089', kind: 'review', pr: '1' }), completionsDir);
    writeDeliveryReport(newDeliveryReport({ session: 'conveyor-4089', item: '4089' }), deliveryDir);
    const result = runRetentionSweepPass(baseOpts());
    expect(result.deleted).toBe(1);
    expect(result.kept).toBe(0);
    expect(tryReadCompletionSafe(completionsDir, 'conveyor-4089')).toBe(false);
  });

  it('keeps a session whose work is not yet confirmed done', () => {
    writeCompletion(newCompletionRecord({ session: 'conveyor-4090', kind: 'review', pr: '1' }), completionsDir);
    const result = runRetentionSweepPass(baseOpts({ retentionGroundTruthFor: () => ({ workDone: false, terminalAt: null }) }));
    expect(result.deleted).toBe(0);
    expect(result.kept).toBe(1);
  });

  it('dry-run reports what would be deleted without touching disk', () => {
    writeCompletion(newCompletionRecord({ session: 'conveyor-4091', kind: 'review', pr: '1' }), completionsDir);
    const result = runRetentionSweepPass(baseOpts({ dryRun: true }));
    expect(result.deleted).toBe(0);
    expect(result.wouldDelete).toEqual([{ session: 'conveyor-4091', reason: 'grace-after-done' }]);
    expect(tryReadCompletionSafe(completionsDir, 'conveyor-4091')).toBe(true); // still on disk
  });

  it('an unknown session-slug grammar is skipped, never guessed', () => {
    writeCompletion(newCompletionRecord({ session: 'my-freeform-session-name', kind: 'review', pr: '1' }), completionsDir);
    const result = runRetentionSweepPass(baseOpts());
    expect(result.deleted).toBe(0);
    expect(result.kept).toBe(1);
  });
});

// Tiny local helper — just "is the file still on disk", independent of the completion-store's own
// parse-or-refuse contract (not what these tests are checking).
function tryReadCompletionSafe(dir, session) {
  return existsSync(join(dir, `${session}.json`));
}
