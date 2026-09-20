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
import { describe, it, expect } from 'vitest';
import {
  classifySessionReap,
  classifySessionReapWithGroundTruth,
  sessionTarget,
  sessionReapPlan,
  groundTruthForItem,
  groundTruthForPr,
  makeGroundTruthResolver,
  attentionRows,
  hasHandler,
  REDISPATCH_ACTIONS,
  TERMINAL_REAP_STATES,
  ALREADY_STOPPED_STATES,
  stopSessionWithRetry,
  STOP_RETRY_ATTEMPTS,
  STOP_RETRY_BACKOFF_MS,
} from '../session-reaper.mjs';

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
  it('a repo key pins the lookup with `--repo <owner/repo>` and names the repo in the evidence', () => {
    const argv = [];
    const exec = (_cmd, args) => { argv.push(args); return JSON.stringify({ state: 'MERGED' }); };
    expect(groundTruthForPr('148', { exec, repo: 'plateau-app' })).toEqual({ resolved: true, evidence: 'pr#148:merged@plateau-app' });
    expect(argv).toEqual([['pr', 'view', '148', '--repo', 'chalbert/plateau-app', '--json', 'state,mergedAt']]);
  });
  it('an unknown repo key is unknown (null) and never falls back to the cwd repo — no gh call at all', () => {
    let calls = 0;
    expect(groundTruthForPr('148', { exec: () => { calls++; return '{}'; }, repo: 'nope' })).toBeNull();
    expect(calls).toBe(0);
  });
  it('a PR that does not exist in that repo is unknown (null), not "not merged"', () => {
    const exec = () => { throw Object.assign(new Error('Command failed: gh pr view'), { stderr: 'GraphQL: Could not resolve to a PullRequest with the number of 148.' }); };
    expect(groundTruthForPr('148', { exec, repo: 'we' })).toBeNull();
  });
});

// ── repo-less PR session names (#3383, found live 2026-09-20: `review-148` is plateau-app#148, merged, but the
//    name carries no repo so `gh pr view 148` from the reaper's cwd read WE#148 — the wrong repo). ────────────
/** A fake `gh` keyed by `--repo` owner/repo → `'merged' | 'open' | 'absent' | 'error'`; records every call. */
function fakeGh(byRepo) {
  const calls = [];
  const exec = (_cmd, args) => {
    const slug = args[args.indexOf('--repo') + 1];
    calls.push(slug);
    const answer = byRepo[slug];
    if (answer === 'merged') return JSON.stringify({ state: 'MERGED', mergedAt: '2026-09-20T12:20:00Z' });
    if (answer === 'open') return JSON.stringify({ state: 'OPEN', mergedAt: null });
    if (answer === 'closed') return JSON.stringify({ state: 'CLOSED', mergedAt: null });
    if (answer === 'absent') throw Object.assign(new Error('Command failed: gh pr view'), { stderr: 'GraphQL: Could not resolve to a PullRequest with the number of 148. (repository.pullRequest)' });
    throw new Error('gh: HTTP 502');
  };
  return { exec, calls };
}
const WE = 'chalbert/web-everything';
const FUI = 'chalbert/frontierui';
const PA = 'chalbert/plateau-app';

describe('makeGroundTruthResolver — a repo-less PR name never guesses one repo', () => {
  const target = { kind: 'pr', id: '148' };

  it('the review-148 fixture: merged in WE and plateau-app, absent in frontierui → resolved, evidence names the repos', () => {
    const gh = fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: true, evidence: 'pr#148:merged@we+plateau-app' });
    expect(gh.calls).toEqual([WE, FUI, PA]); // every constellation repo was asked, in table order
  });

  it('merged in the only repo where it exists → resolved (absent elsewhere is not a blocker)', () => {
    const gh = fakeGh({ [WE]: 'absent', [FUI]: 'absent', [PA]: 'merged' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: true, evidence: 'pr#148:merged@plateau-app' });
  });

  it('AMBIGUOUS: merged in one repo but still open in another → kept (resolved:false)', () => {
    const gh = fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'open' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: false });
  });

  it('THE LIVE SHAPE (2026-09-20): WE#148 CLOSED unmerged + plateau-app#148 merged → resolved (operator rule: only an OPEN PR blocks)', () => {
    // The operator ruled "closed unmerged is terminal" on 2026-09-20 (this test pinned the opposite until then, so
    // the flip was deliberate). It is what reaps the real `review-148`.
    const gh = fakeGh({ [WE]: 'closed', [FUI]: 'absent', [PA]: 'merged' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: true, evidence: 'pr#148:merged@plateau-app,closed@we' });
  });

  it('closed unmerged in every repo where it exists (none merged, none open) → resolved: the review target is gone', () => {
    const gh = fakeGh({ [WE]: 'closed', [FUI]: 'absent', [PA]: 'absent' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: true, evidence: 'pr#148:closed@we' });
  });

  it('closed in one repo but still OPEN in another → kept (only an open PR blocks, and one is open)', () => {
    const gh = fakeGh({ [WE]: 'closed', [FUI]: 'absent', [PA]: 'open' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: false });
  });

  it('a repo-marked target whose PR is closed unmerged stays resolved:false (the rule covers the repo-less cross-repo check only)', () => {
    const gh = fakeGh({ [PA]: 'closed' });
    expect(makeGroundTruthResolver({ exec: gh.exec })({ ...target, repo: 'plateau-app' })).toEqual({ resolved: false });
    expect(gh.calls).toEqual([PA]);
  });

  it('UNREADABLE in ANY repo → unknown (null), even when every other repo says merged', () => {
    const gh = fakeGh({ [WE]: 'merged', [FUI]: 'error', [PA]: 'merged' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toBeNull();
  });

  it('the number exists in NO repo → resolved:false — absence is never done', () => {
    const gh = fakeGh({ [WE]: 'absent', [FUI]: 'absent', [PA]: 'absent' });
    expect(makeGroundTruthResolver({ exec: gh.exec })(target)).toEqual({ resolved: false });
  });

  it('a repo-marked target (`repo` set) is checked in that repo ALONE — one gh call', () => {
    const gh = fakeGh({ [WE]: 'open', [FUI]: 'open', [PA]: 'merged' });
    expect(makeGroundTruthResolver({ exec: gh.exec })({ ...target, repo: 'plateau-app' })).toEqual({ resolved: true, evidence: 'pr#148:merged@plateau-app' });
    expect(gh.calls).toEqual([PA]);
  });

  it('a repo-marked target whose PR is absent in that repo is unknown (null) — never widened to the other repos', () => {
    const gh = fakeGh({ [WE]: 'merged', [PA]: 'absent' });
    expect(makeGroundTruthResolver({ exec: gh.exec })({ ...target, repo: 'plateau-app' })).toBeNull();
    expect(gh.calls).toEqual([PA]);
  });

  it('the session\'s own ledger entry names the repo → that repo alone, before any cross-repo guess', () => {
    const gh = fakeGh({ [WE]: 'open', [PA]: 'merged' });
    const followUps = [{ session: 'abc12345', kind: 'review', target: 'plateau-app#148' }];
    const resolver = makeGroundTruthResolver({ exec: gh.exec, followUps });
    expect(resolver(target, bg({ name: 'review-148' }))).toEqual({ resolved: true, evidence: 'pr#148:merged@plateau-app' });
    expect(gh.calls).toEqual([PA]);
  });

  it('a ledger entry for a DIFFERENT PR number, or another session, or an unknown repo, is ignored (falls back to every repo)', () => {
    for (const entry of [
      { session: 'abc12345', kind: 'review', target: 'plateau-app#149' },
      { session: 'other-session', kind: 'review', target: 'plateau-app#148' },
      { session: 'abc12345', kind: 'review', target: 'nope#148' },
    ]) {
      const gh = fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' });
      const out = makeGroundTruthResolver({ exec: gh.exec, followUps: [entry] })(target, bg({ name: 'review-148' }));
      expect(out).toEqual({ resolved: true, evidence: 'pr#148:merged@we+plateau-app' });
      expect(gh.calls).toEqual([WE, FUI, PA]);
    }
  });

  it('every repo call counts against the cap: a pass that runs out midway answers null (kept), never a partial "merged"', () => {
    const gh = fakeGh({ [WE]: 'merged', [FUI]: 'merged', [PA]: 'merged' });
    const resolver = makeGroundTruthResolver({ exec: gh.exec, maxPrViewCalls: 2 });
    expect(resolver(target)).toBeNull();
    expect(gh.calls).toEqual([WE, FUI]);
  });

  it('caches per (PR, repo scope): the same repo-less number costs one 3-repo lookup, a marked one is a separate entry', () => {
    const gh = fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' });
    const resolver = makeGroundTruthResolver({ exec: gh.exec });
    resolver(target); resolver(target);
    expect(gh.calls).toHaveLength(3);
    resolver({ ...target, repo: 'we' });
    expect(gh.calls).toHaveLength(4);
  });

  it('is deterministic: same answers → byte-identical resolutions across independent resolvers', () => {
    const run = () => makeGroundTruthResolver({ exec: fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' }).exec })(target);
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('classifySessionReapWithGroundTruth — passes the session row to the resolver', () => {
  it('reaps repo-less review-148 (blocked, live) only through the unambiguous cross-repo answer', () => {
    const row = bg({ name: 'review-148', state: 'blocked', id: '9eff9f54' });
    const merged = makeGroundTruthResolver({ exec: fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' }).exec });
    expect(classifySessionReapWithGroundTruth(row, merged)).toEqual({ reap: true, reason: 'ground-truth-pr:pr#148:merged@we+plateau-app' });
    const ambiguous = makeGroundTruthResolver({ exec: fakeGh({ [WE]: 'open', [FUI]: 'absent', [PA]: 'merged' }).exec });
    expect(classifySessionReapWithGroundTruth(row, ambiguous)).toEqual({ reap: false, reason: 'not-terminal' });
    const unreadable = makeGroundTruthResolver({ exec: fakeGh({ [WE]: 'merged', [FUI]: 'error', [PA]: 'merged' }).exec });
    expect(classifySessionReapWithGroundTruth(row, unreadable)).toEqual({ reap: false, reason: 'not-terminal' });
  });

  it('hands the resolver `(target, session)` so a resolver can read the row', () => {
    const seen = [];
    const row = bg({ name: 'review-148', state: 'working' });
    classifySessionReapWithGroundTruth(row, (target, session) => { seen.push([target, session]); return null; });
    expect(seen).toEqual([[{ kind: 'pr', id: '148' }, row]]);
  });

  it('sessionReapPlan over a mixed listing is deterministic — same rows and answers, byte-identical plan', () => {
    const rows = [
      bg({ id: 'a1', name: 'review-148', state: 'blocked' }),
      bg({ id: 'a2', name: 'review-149', state: 'blocked' }),
      bg({ id: 'a3', name: 'conveyor-9', state: 'done' }),
    ];
    const plan = () => sessionReapPlan(rows, { groundTruthFor: makeGroundTruthResolver({ exec: fakeGh({ [WE]: 'merged', [FUI]: 'absent', [PA]: 'merged' }).exec }) });
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
    const { reap, keep } = plan();
    expect(reap.map((r) => r.session.id)).toEqual(['a1', 'a2', 'a3']); // gh fake answers every number the same way
    expect(keep).toEqual([]);
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
    expect(resolver({ kind: 'pr', id: '1862', repo: 'we' })).toEqual({ resolved: true, evidence: 'pr#1862:merged@we' });
    expect(resolver({ kind: 'pr', id: '1862', repo: 'we' })).toEqual({ resolved: true, evidence: 'pr#1862:merged@we' });
    expect(itemReads).toBe(1); // cached — the second identical lookup cost nothing
    expect(prCalls).toBe(1); // cached — same
  });

  it('bounds gh pr view calls at maxPrViewCalls — a candidate past the cap reads null (unknown), not an unbounded burst', () => {
    let prCalls = 0;
    const resolver = makeGroundTruthResolver({
      maxPrViewCalls: 1,
      exec: () => { prCalls++; return JSON.stringify({ state: 'MERGED' }); },
    });
    expect(resolver({ kind: 'pr', id: '1', repo: 'we' })).toEqual({ resolved: true, evidence: 'pr#1:merged@we' });
    expect(resolver({ kind: 'pr', id: '2', repo: 'we' })).toBeNull(); // past the cap — never called
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
