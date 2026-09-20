/**
 * @file scripts/conveyor/__tests__/session-reap-evidence.test.mjs
 * @description Unit proof of the session reaper's GROUND-TRUTH EVIDENCE (`session-reap-evidence.mjs`): the local backlog-status
 *   read ({@link groundTruthForItem}), the bounded `gh pr view` read ({@link groundTruthForPr}) and the per-pass resolver
 *   ({@link makeGroundTruthResolver}: routing, per-target cache, the `gh` call cap, and the repo-less PR-name resolution
 *   found live 2026-09-20 on `review-148`) — all with an injected fake `exec` / fs, never a real `gh`. The last describe drives
 *   the pure planner (`session-reap-plan.mjs`) THROUGH the real resolver, so it lives with the resolver, not the planner.
 *   (Split out of `session-reaper.test.mjs`.)
 */
import { describe, it, expect } from 'vitest';
import {
  groundTruthForItem,
  groundTruthForPr,
  makeGroundTruthResolver,
} from '../session-reap-evidence.mjs';
import { classifySessionReapWithGroundTruth, sessionReapPlan } from '../session-reap-plan.mjs';

const bg = (over = {}) => ({ id: 'abc12345', cwd: '/repo', kind: 'background', startedAt: 1, sessionId: 'abc12345-0000-0000-0000-000000000000', name: 'conveyor-1', ...over });

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
