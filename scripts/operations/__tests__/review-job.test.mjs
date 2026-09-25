/**
 * x26lw6u — the review arc as a deterministic job (we:scripts/operations/review-job.mjs) and its job-record
 * store (we:scripts/operations/review-job-store.mjs). Every effect is faked: no lane pool, no `claude`, no `gh`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BLOCKED_ON_INFRA, DEFERRED_NO_LANE, MAX_LANE_DEFERRALS, REVIEW_JOB_KIND,
  classifyReviewLoopOutcome, decideJobClaim, dispatchReviewByMode, dispatchReviewJob, jobRecordToAgentRow,
  laneCooloffActive, listAgentsWithReviewJobs, listReviewJobAgents, nextLaneDeferral, parseReviewLoopStdout,
  readJobRecord, resolveReviewDispatchMode, runReviewJob, writeJobRecord,
} from '../review-job.mjs';
import { assessLiveness, bindAgents } from '../../conveyor/reconcile-core.mjs';
import { deriveReviewStatus, tagReviewStatus } from '../../conveyor/review-status-tag.mjs';
import { defaultReadAgents } from '../../conveyor/reconcile-pass.mjs';

const REPO = 'chalbert/web-everything';
const FRESH = () => ({ fresh: true, behind: 0 });

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'review-jobs-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('classifyReviewLoopOutcome — the brief\'s outcome words, read off review-loop-cli --json', () => {
  it('maps each stop to bounced / auto-cleared / parked, and anything unrecognised to blocked-on-infra', () => {
    const loop = { outcome: 'converged' };
    expect(classifyReviewLoopOutcome({ runId: 'r1', stopped: 'complete', verdict: { verdict: 'accept', loop } }))
      .toEqual({ outcome: 'auto-cleared', verdict: 'accept', loopOutcome: 'converged', runId: 'r1' });
    expect(classifyReviewLoopOutcome({ stopped: 'complete', verdict: { verdict: 'changes' } }).outcome).toBe('bounced');
    expect(classifyReviewLoopOutcome({ stopped: 'effect-in-flight', verdict: { verdict: 'changes' } }).outcome).toBe('bounced');
    expect(classifyReviewLoopOutcome({ stopped: 'confirm', verdict: { verdict: 'accept' } }).outcome).toBe('parked');
    expect(classifyReviewLoopOutcome({ queued: 'accept-needs-human', stopped: 'confirm' }).outcome).toBe('parked');
    expect(classifyReviewLoopOutcome({ preventionFiled: [], stopped: 'complete' }).outcome).toBe('auto-cleared');
    expect(classifyReviewLoopOutcome({ stopped: 'refused' }).outcome).toBe(BLOCKED_ON_INFRA);
    expect(classifyReviewLoopOutcome(null).outcome).toBe(BLOCKED_ON_INFRA);
  });
});

describe('parseReviewLoopStdout', () => {
  it('parses the pretty-printed payload, and survives a stray leading line (#3647)', () => {
    const payload = { runId: 'r9', stopped: 'complete' };
    expect(parseReviewLoopStdout(JSON.stringify(payload, null, 2))).toEqual(payload);
    expect(parseReviewLoopStdout(`notice: something\n${JSON.stringify(payload, null, 2)}\n`)).toEqual(payload);
    expect(parseReviewLoopStdout('error: boom')).toBeNull();
    expect(parseReviewLoopStdout('')).toBeNull();
  });
});

describe('lane deferral — next tick retries, bounded', () => {
  it('counts consecutive deferrals and escalates to blocked-on-infra at the cap', () => {
    expect(nextLaneDeferral(null)).toEqual({ count: 1, outcome: DEFERRED_NO_LANE, label: 'lane-deferrals:1' });
    let prev = null;
    for (let i = 1; i < MAX_LANE_DEFERRALS; i += 1) prev = { ...nextLaneDeferral(prev), status: 'done' };
    expect(prev.outcome).toBe(DEFERRED_NO_LANE);
    expect(nextLaneDeferral(prev)).toEqual({ count: MAX_LANE_DEFERRALS, outcome: BLOCKED_ON_INFRA, label: `lane-deferrals:${MAX_LANE_DEFERRALS}` });
    // A real review in between resets the count.
    expect(nextLaneDeferral({ outcome: 'bounced', label: null }).count).toBe(1);
  });

  it('cools off only after an escalated lane exhaustion, and only for the cool-off window', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const rec = { status: 'done', outcome: BLOCKED_ON_INFRA, label: 'lane-deferrals:5', updatedAt: '2026-09-25T11:55:00Z' };
    expect(laneCooloffActive(rec, now)).toBe(true);
    expect(laneCooloffActive({ ...rec, updatedAt: '2026-09-25T11:30:00Z' }, now)).toBe(false);
    expect(laneCooloffActive({ ...rec, label: 'review-loop exit 1' }, now)).toBe(false); // a loop failure is not a lane cool-off
    expect(laneCooloffActive({ ...rec, outcome: DEFERRED_NO_LANE }, now)).toBe(false);
  });
});

describe('job records — liveness by pid, without a transcript', () => {
  it('decideJobClaim: free when absent / ours / dead, held when another live pid owns it', () => {
    const alive = (p) => p === 11;
    expect(decideJobClaim(null, 5, alive)).toEqual({ ok: true });
    expect(decideJobClaim({ pid: 5 }, 5, alive)).toEqual({ ok: true });
    expect(decideJobClaim({ pid: 12 }, 5, alive)).toEqual({ ok: true });
    expect(decideJobClaim({ pid: 11 }, 5, alive)).toEqual({ ok: false, heldBy: 11 });
  });

  it('lists live jobs as agent rows and prunes a dead job\'s record', () => {
    writeJobRecord({ slug: 'review-10', pr: 10, repo: REPO, pid: 111, startedAt: '2026-09-25T10:00:00Z', cwd: '/lane' }, dir);
    writeJobRecord({ slug: 'review-20', pr: 20, repo: REPO, pid: 222, startedAt: '2026-09-25T10:00:00Z', cwd: '/lane' }, dir);
    const rows = listReviewJobAgents({ dir, isAlive: (p) => p === 111 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'review-10', state: 'working', pid: 111, kind: REVIEW_JOB_KIND, sessionId: null });
    expect(readJobRecord('review-20', dir)).toBeNull(); // pruned
    expect(listReviewJobAgents({ dir: join(dir, 'nope') })).toEqual([]);
  });

  it('a live job row binds to its PR and reads live-process in reconcile, and reviewing in review-status-tag', () => {
    const row = { ...jobRecordToAgentRow({ slug: 'review-10', pr: 10, repo: REPO, pid: 111, startedAt: '2026-09-25T10:00:00Z', cwd: '/lane' }), pidAlive: true };
    const pr = { number: 10, headRefOid: 'abc' };
    const bound = bindAgents(pr, [row], 'we');
    expect(bound).toHaveLength(1);
    expect(assessLiveness(bound)).toMatchObject({ kind: 'live-process', pid: 111 });
    expect(deriveReviewStatus({ pr: 10, agents: [row], repo: 'we' })).toEqual({ role: 'review', state: 'reviewing' });
    // A dead job is not live — the PR is free to be reconciled again.
    expect(assessLiveness(bindAgents(pr, [{ ...row, pidAlive: false }], 'we'))).toBeNull();
  });

  it('listAgentsWithReviewJobs merges the listing with the job rows, and a job-read failure costs nothing', () => {
    const merged = listAgentsWithReviewJobs({ listAgents: () => [{ name: 'fix-3' }], listJobs: () => [{ name: 'review-4' }] });
    expect(merged.map((a) => a.name)).toEqual(['fix-3', 'review-4']);
    expect(listAgentsWithReviewJobs({ listAgents: () => [{ name: 'x' }], listJobs: () => { throw new Error('io'); } })).toEqual([{ name: 'x' }]);
  });
});

/** A fake io recording every effect in order. */
function fakeIo(over = {}) {
  const calls = [];
  const io = {
    root: '/daemon',
    now: (() => { let t = 1_000; return () => { t += 10; return t; }; })(),
    newActorId: () => 'actor-fresh-uuid',
    readPrevCompletion: () => null,
    report: (flags) => calls.push(['report', flags.status, flags]),
    claim: (slug, rec) => { calls.push(['claim', slug, rec.pid]); return { ok: true }; },
    updateRecord: (rec) => calls.push(['update', rec.cwd, rec.actorId]),
    unclaim: (slug, pid) => calls.push(['unclaim', slug, pid]),
    acquireLane: (o) => { calls.push(['acquire', o]); return { lanePath: '/lanes/lane-7' }; },
    runLoop: (o) => {
      calls.push(['loop', o]);
      return { status: 0, stdout: JSON.stringify({ runId: 'review-pr-1', stopped: 'complete', verdict: { verdict: 'accept', loop: { outcome: 'converged' } } }), stderr: '' };
    },
    releaseLane: (slug) => calls.push(['release', slug]),
    log: () => {},
    ...over,
  };
  return { io, calls };
}

describe('runReviewJob — the arc, no Claude wrapper session', () => {
  it('claims, reports started, acquires, runs the loop ONCE under a fresh actor id, reports done, releases, unclaims', () => {
    const { io, calls } = fakeIo();
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out).toMatchObject({ pr: 10, sessionSlug: 'review-10', outcome: 'auto-cleared', verdict: 'accept', loopOutcome: 'converged', runId: 'review-pr-1', lanePath: '/lanes/lane-7' });
    expect(calls.map((c) => c[0])).toEqual(['claim', 'report', 'release', 'acquire', 'update', 'loop', 'report', 'release', 'unclaim']);
    const acquire = calls.find((c) => c[0] === 'acquire')[1];
    const loop = calls.find((c) => c[0] === 'loop')[1];
    expect(acquire).toMatchObject({ slug: 'review-10', actorId: 'actor-fresh-uuid', laneRepo: '.' });
    expect(loop).toMatchObject({ pr: 10, repo: REPO, lanePath: '/lanes/lane-7', actorId: 'actor-fresh-uuid' });
    const done = calls.filter((c) => c[0] === 'report')[1][2];
    expect(done).toMatchObject({ session: 'review-10', status: 'done', outcome: 'auto-cleared', verdict: 'converged', runId: 'review-pr-1' });
    expect(out.timings.loopMs).toBeGreaterThan(0);
  });

  it('#3647 — a non-zero exit whose stdout is a finished review reports the review\'s real outcome', () => {
    const { io, calls } = fakeIo({
      runLoop: () => ({ status: 1, stdout: JSON.stringify({ runId: 'r2', stopped: 'complete', verdict: { verdict: 'changes' } }), stderr: 'filing failed' }),
    });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out.outcome).toBe('bounced');
    expect(calls.filter((c) => c[0] === 'report')[1][2]).toMatchObject({ outcome: 'bounced', runId: 'r2', label: 'exit 1' });
  });

  it('no lane → deferred-no-lane, the loop never runs, done is still reported and the slot freed', () => {
    const { io, calls } = fakeIo({ acquireLane: () => ({ lanePath: null, error: 'pool full' }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out.outcome).toBe(DEFERRED_NO_LANE);
    expect(calls.some((c) => c[0] === 'loop')).toBe(false);
    expect(calls.filter((c) => c[0] === 'report')[1][2]).toMatchObject({ status: 'done', outcome: DEFERRED_NO_LANE, label: 'lane-deferrals:1' });
    expect(calls.at(-1)).toEqual(['unclaim', 'review-10', 99]);
  });

  it('the fifth consecutive no-lane escalates to blocked-on-infra', () => {
    const { io } = fakeIo({
      acquireLane: () => ({ lanePath: null }),
      readPrevCompletion: () => ({ status: 'done', outcome: DEFERRED_NO_LANE, label: `lane-deferrals:${MAX_LANE_DEFERRALS - 1}` }),
    });
    expect(runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io).outcome).toBe(BLOCKED_ON_INFRA);
  });

  it('a live job already holding the PR refuses without reporting or touching a lane', () => {
    const { io, calls } = fakeIo({ claim: () => ({ ok: false, heldBy: 7 }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out).toMatchObject({ refused: true, outcome: 'refused-live-job' });
    expect(calls).toEqual([]);
  });

  it('a timed-out loop is blocked-on-infra, and the lane is still released', () => {
    const { io, calls } = fakeIo({ runLoop: () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '', timedOut: true }) });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99, loopTimeoutMs: 60_000 }, io);
    expect(out.outcome).toBe(BLOCKED_ON_INFRA);
    expect(out.label).toMatch(/timed out/);
    expect(calls.slice(-2)).toEqual([['release', 'review-10'], ['unclaim', 'review-10', 99]]);
  });

  it('a crash mid-arc still writes done, releases and unclaims', () => {
    const { io, calls } = fakeIo({ runLoop: () => { throw new Error('spawn EAGAIN'); } });
    const out = runReviewJob({ pr: 10, repo: REPO, pid: 99 }, io);
    expect(out.outcome).toBe(BLOCKED_ON_INFRA);
    expect(calls.filter((c) => c[0] === 'report')[1][2]).toMatchObject({ status: 'done', outcome: BLOCKED_ON_INFRA, label: 'spawn EAGAIN' });
    expect(calls.slice(-2)).toEqual([['release', 'review-10'], ['unclaim', 'review-10', 99]]);
  });
});

describe('dispatchReviewJob — what the daemon calls', () => {
  const base = { pr: 10, repo: REPO, root: '/daemon', checkStaleness: FRESH, readCompletion: () => null };

  it('spawns the job detached with the gh shim on PATH and WITHOUT the dispatcher\'s own actor id, and claims the slot', () => {
    const spawned = [];
    const out = dispatchReviewJob({
      ...base, dir,
      env: { PATH: '/usr/bin', CLAUDE_CODE_SESSION_ID: 'dispatcher-session', GH_TOKEN: 't' },
      resolveSettingsEnv: () => ({ PATH: '/shim:/usr/bin' }),
      spawnJob: (o) => { spawned.push(o); return 4242; },
    });
    expect(out).toMatchObject({ mode: 'job', pr: 10, sessionSlug: 'review-10', agentId: null, jobPid: 4242 });
    expect(spawned).toHaveLength(1);
    expect(spawned[0].argv.slice(1)).toEqual(['run', '--pr=10', `--repo=${REPO}`]);
    expect(spawned[0].env.PATH).toBe('/shim:/usr/bin');
    expect(spawned[0].env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    expect(readJobRecord('review-10', dir)).toMatchObject({ slug: 'review-10', pid: 4242, pr: 10 });
  });

  it('declines to spawn while a live job holds the PR, or during the lane cool-off', () => {
    writeJobRecord({ slug: 'review-10', pid: 555, pr: 10, repo: REPO, startedAt: new Date().toISOString(), cwd: '/x' }, dir);
    const spawnJob = () => { throw new Error('must not spawn'); };
    expect(dispatchReviewJob({ ...base, dir, spawnJob, isAlive: () => true })).toMatchObject({ skipped: 'live-job', jobPid: 555 });
    const now = Date.parse('2026-09-25T12:00:00Z');
    const cooled = { status: 'done', outcome: BLOCKED_ON_INFRA, label: 'lane-deferrals:5', updatedAt: '2026-09-25T11:59:00Z' };
    expect(dispatchReviewJob({ ...base, dir, now, spawnJob, isAlive: () => false, readCompletion: () => cooled })).toMatchObject({ skipped: 'lane-cooloff' });
  });

  it('refuses from a lane checkout and on a stale main, exactly like the session path', () => {
    expect(() => dispatchReviewJob({ ...base, dir, root: '/x/lane-7', spawnJob: () => 1 })).toThrow(/lane checkout/);
    expect(() => dispatchReviewJob({ ...base, dir, checkStaleness: () => ({ action: 'warn', behind: 3 }), spawnJob: () => 1 })).toThrow(/behind origin\/main/);
  });

  it('leaves no stray files beyond the claimed record', () => {
    dispatchReviewJob({ ...base, dir, resolveSettingsEnv: () => null, spawnJob: () => 1 });
    expect(readdirSync(dir).filter((n) => !n.endsWith('.log'))).toEqual(['review-10.json']);
    expect(existsSync(join(dir, 'review-10.json'))).toBe(true);
  });
});

describe('the two readers that decide "is a review running" see job rows (x26lw6u)', () => {
  const jobRow = { name: 'review-10', state: 'working', pid: 111, kind: REVIEW_JOB_KIND, startedAt: Date.now(), cwd: '/lane' };

  it('reconcile-pass#defaultReadAgents merges the live jobs into the claude agents listing', () => {
    const exec = () => JSON.stringify([{ name: 'fix-3', state: 'working', pid: 5, startedAt: Date.now() }]);
    const rows = defaultReadAgents({ exec, env: {}, completionFor: () => null, hungInfoFor: () => null, listJobs: () => [jobRow] });
    expect(rows.map((r) => r.name)).toEqual(['fix-3', 'review-10']);
  });

  it('review-status-tag labels a PR with a live job as review-status:reviewing', () => {
    const edits = [];
    const provider = { readLabels: () => [], ensureLabel: () => {}, setLabels: (_r, _p, e) => edits.push(e) };
    const out = tagReviewStatus({ pr: 10, repo: REPO, listAgents: () => listAgentsWithReviewJobs({ listAgents: () => [], listJobs: () => [jobRow] }), provider });
    expect(out).toMatchObject({ changed: true, label: 'review-status:reviewing' });
  });
});

describe('dispatch mode', () => {
  it('defaults to the job; only an explicit session opts back into claude --bg', () => {
    expect(resolveReviewDispatchMode({})).toBe('job');
    expect(resolveReviewDispatchMode({ WE_REVIEW_DISPATCH_MODE: 'bogus' })).toBe('job');
    expect(resolveReviewDispatchMode({ WE_REVIEW_DISPATCH_MODE: 'session' })).toBe('session');
  });

  it('dispatchReviewByMode routes job mode to the job dispatch', () => {
    const out = dispatchReviewByMode({
      mode: 'job', pr: 10, repo: REPO, root: '/daemon', dir, checkStaleness: FRESH, readCompletion: () => null,
      resolveSettingsEnv: () => null, spawnJob: () => 31,
    });
    expect(out).toMatchObject({ mode: 'job', jobPid: 31 });
  });
});
