/**
 * @file scripts/conveyor/__tests__/fix-procedure.test.mjs — the fix procedure (operator-approved 2026-09-27,
 *   live incident PR #2811).
 * @description Proves the four halves of the procedure:
 *   1. the per-PR FIX CLAIM (`fix-procedure.mjs`) — take / refuse / heartbeat / release, on the #2789 store;
 *   2. while a claim is live: the planner refuses every dispatch (`fix-claimed`, including `promote-draft`), a
 *      dispatcher refuses to spawn, a push by anyone else is refused (`pushRefusal`, `guard-bash.mjs#reason`),
 *      and the status tagger reads `fixing`;
 *   3. stand-down semantics — a concurrent-author stop is a PAUSE (re-arms on the next head or after quiet),
 *      the legacy #2811 comment is reclassified, and a re-armed dispatch row carries the saved alt branch;
 *   4. the fix daemon's claim-refresh sweep no longer throws on a `fixing` claim (it used to mint a session slug
 *      for the unknown kind).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  acquireFixClaim, releaseFixClaim, heartbeatFixClaim, readLiveFixClaim, pushRefusal, isClaimHolder,
  fixBegin, fixEnd, withAltBranchHint, repoKeyFromRemoteUrl, repoKeyForCheckout, DEFAULT_FIX_CLAIM_TTL_MINUTES,
  FIX_BEGIN_MARKER, FIX_END_MARKER, FIXING_LABEL, STOOD_DOWN_LABEL,
} from '../fix-procedure.mjs';
import { acquireFixDispatchClaim, refreshLiveFixDispatchClaims } from '../fix-dispatch-claim.mjs';
import {
  STAND_DOWN_MARKER, CONCURRENT_AUTHOR_PAUSE_MARKER, buildConcurrentAuthorPauseComment, concurrentAuthorPauses,
  countTerminalStandDowns, countStandDownComments, parseAltBranch, buildStandDownComment,
} from '../stand-down.mjs';
import { planReconcile, countUnresolvedStandDowns, CONCURRENT_AUTHOR_QUIET_MS } from '../reconcile-core.mjs';
import { enrichPrsWithFixClaims } from '../reconcile-pass.mjs';
import { deriveReviewStatus } from '../review-status-tag.mjs';
import { dispatchFix } from '../reconcile-fix-dispatch.mjs';
import { dispatchCiHeal } from '../../operations/ci-heal-pr-dispatch.mjs';
import { DISPATCH_EFFECT } from '../../operations/dispatch-lane.mjs';
import { reason as guardReason } from '../../guard-bash.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'fix-procedure-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const T0 = Date.parse('2026-09-27T15:00:00.000Z');
const MIN = 60_000;
const AUTOMATION = { login: 'web-everything' };
const BRANCH = 'lane/run-rating-slice1-mechanical-grade';

/** PR #2811's REAL stand-down comment body, verbatim from the live thread (2026-09-27T15:45:27Z). */
const LIVE_2811_STAND_DOWN = [
  STAND_DOWN_MARKER,
  '',
  'conveyor fix agent stopped rather than guessing: a genuine same-line conflict with `main` blocked the repair. concurrent author pushed overlapping fixes (60f0f3d57) mid-repair; remaining fixes saved on lane/run-rating-slice1-fix-2811-alt (3b24fcc18) for cherry-pick',
  '',
  'The PR was left EXACTLY as the reviewer left it — no label was changed, the review was not re-armed, and nothing was re-pushed. This comment is the durable record that a fixer *deliberately stood down* here, which is what tells the reconciler apart from a fixer that simply died.',
].join('\n');

describe('the fix claim', () => {
  it('a second fixer is refused while the first holds it; the holder re-begins reentrantly', () => {
    const a = acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', why: 'address review', branch: BRANCH, lockRoot: root, nowMs: T0 });
    expect(a).toMatchObject({ ok: true });
    const b = acquireFixClaim({ repo: 'chalbert/web-everything', pr: 2811, who: 'rubric-worker', lockRoot: root, nowMs: T0 + MIN });
    expect(b).toMatchObject({ ok: false, reason: 'held', heldBy: 'fixer:fix-2811' });
    expect(acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', lockRoot: root, nowMs: T0 + 2 * MIN })).toMatchObject({ ok: true, reason: 'own' });
    // the reentrant re-begin kept the branch it was first given
    expect(readLiveFixClaim({ repo: 'we', pr: 2811, lockRoot: root, nowMs: T0 + 2 * MIN }).meta.branch).toBe(BRANCH);
  });

  it('expires on its TTL unless heartbeat-refreshed, and only the holder may release it', () => {
    acquireFixClaim({ repo: 'we', pr: 7, who: 'w', lockRoot: root, nowMs: T0 });
    const late = T0 + (DEFAULT_FIX_CLAIM_TTL_MINUTES + 1) * MIN;
    expect(readLiveFixClaim({ repo: 'we', pr: 7, lockRoot: root, nowMs: late })).toBeNull();
    acquireFixClaim({ repo: 'we', pr: 8, who: 'w', lockRoot: root, nowMs: T0 });
    expect(heartbeatFixClaim({ repo: 'we', pr: 8, who: 'w', lockRoot: root, nowMs: late - MIN })).toEqual({ refreshed: true });
    expect(readLiveFixClaim({ repo: 'we', pr: 8, lockRoot: root, nowMs: late })).not.toBeNull();
    expect(releaseFixClaim({ repo: 'we', pr: 8, who: 'someone-else', lockRoot: root })).toMatchObject({ released: false, reason: 'not-owner' });
    expect(releaseFixClaim({ repo: 'we', pr: 8, who: 'w', lockRoot: root })).toMatchObject({ released: true });
  });

  it('a worker is refused while the daemon\'s own dispatched fixer (fix-<pr>) holds the spawn claim — that fixer itself is not', () => {
    acquireFixDispatchClaim({ repo: 'we', pr: 2811, kind: 'fix', owner: 'daemon:1', lockRoot: root, nowMs: T0 });
    expect(acquireFixClaim({ repo: 'we', pr: 2811, who: 'rubric-worker', lockRoot: root, nowMs: T0 + MIN }))
      .toMatchObject({ ok: false, reason: 'dispatched-fixer', heldBy: 'fix-2811' });
    expect(acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ ok: true });
  });
});

describe('pushes while a claim is live', () => {
  beforeEach(() => {
    acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', sessionId: 'sess-fixer', branch: BRANCH, lockRoot: root, nowMs: T0 });
  });
  // `dispatchFix` reads the claim at the REAL clock, so its case takes a claim stamped now.
  const claimNow = () => acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', lockRoot: root, nowMs: Date.now() });

  it('refuses anyone else\'s push to the claimed branch, allows the holder (by session, or by WE_FIX_WHO for a session-less claim)', () => {
    const worker = pushRefusal({ repo: 'we', branch: `refs/heads/${BRANCH}`, sessionId: 'sess-worker', lockRoot: root, nowMs: T0 + MIN });
    expect(worker).toMatchObject({ refused: true, pr: 2811, holder: 'fix-2811' });
    expect(worker.message).toMatch(/fix-2811 holds the fix claim on PR #2811/);
    expect(pushRefusal({ repo: 'we', branch: BRANCH, sessionId: 'sess-fixer', lockRoot: root, nowMs: T0 + MIN })).toBeNull();
    expect(pushRefusal({ repo: 'we', branch: 'lane/other', sessionId: 'sess-worker', lockRoot: root, nowMs: T0 + MIN })).toBeNull();
    expect(pushRefusal({ repo: 'frontierui', branch: BRANCH, sessionId: 'sess-worker', lockRoot: root, nowMs: T0 + MIN })).toBeNull();
    // A claim taken with no session id (a non-Claude worker) is held by its `who` alone.
    acquireFixClaim({ repo: 'we', pr: 2900, who: 'rubric-worker', branch: 'lane/worker-owned', lockRoot: root, nowMs: T0 });
    expect(pushRefusal({ repo: 'we', branch: 'lane/worker-owned', who: 'rubric-worker', lockRoot: root, nowMs: T0 + MIN })).toBeNull();
    expect(pushRefusal({ repo: 'we', branch: 'lane/worker-owned', who: 'someone-else', lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ refused: true });
  });

  it('a session-bound claim is never rebound, pushed, heartbeat or released by a caller that only knows the public `who`', () => {
    // `who` is printed on the PR thread (`**Who:** \`fix-2811\``) — an impostor session re-uses it verbatim.
    const impostor = { who: 'fix-2811', sessionId: 'sess-impostor' };
    expect(acquireFixClaim({ repo: 'we', pr: 2811, ...impostor, branch: BRANCH, lockRoot: root, nowMs: T0 + MIN }))
      .toMatchObject({ ok: false, reason: 'session-mismatch' });
    expect(pushRefusal({ repo: 'we', branch: BRANCH, ...impostor, lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ refused: true });
    expect(pushRefusal({ repo: 'we', branch: BRANCH, who: 'fix-2811', lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ refused: true });
    expect(heartbeatFixClaim({ repo: 'we', pr: 2811, ...impostor, lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ refreshed: false, reason: 'session-mismatch' });
    expect(releaseFixClaim({ repo: 'we', pr: 2811, ...impostor, lockRoot: root })).toMatchObject({ released: false, reason: 'session-mismatch' });
    // The claim is untouched: still bound to the original session, which keeps every right.
    expect(readLiveFixClaim({ repo: 'we', pr: 2811, lockRoot: root, nowMs: T0 + MIN }).meta.sessionId).toBe('sess-fixer');
    expect(pushRefusal({ repo: 'we', branch: BRANCH, sessionId: 'sess-fixer', lockRoot: root, nowMs: T0 + MIN })).toBeNull();
    expect(acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', sessionId: 'sess-fixer', lockRoot: root, nowMs: T0 + MIN })).toMatchObject({ ok: true, reason: 'own' });
    expect(heartbeatFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', sessionId: 'sess-fixer', lockRoot: root, nowMs: T0 + MIN })).toEqual({ refreshed: true });
    expect(releaseFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', sessionId: 'sess-fixer', lockRoot: root })).toMatchObject({ released: true });
  });

  it('the ci-heal dispatcher refuses to spawn while a fix claim is live (claimRoot threaded to the claim read)', async () => {
    claimNow();
    const spawned = [];
    const r = await dispatchCiHeal(
      { itemNum: null, pr: 2811, laneRef: BRANCH, scope: ['we:x'], lane: 3, headRefOid: 'a'.repeat(40) },
      { readBrief: () => '# {{PR_NUM}}', claimRoot: root, sinks: { [DISPATCH_EFFECT]: async (p) => { spawned.push(p); return { handle: 'x' }; } } },
    );
    expect(r).toMatchObject({ held: true, reason: 'fix-claimed', heldBy: 'fix-2811' });
    expect(spawned).toHaveLength(0);
  });

  it('guard-bash denies a raw `git push` to the claimed lane ref (fixClaimedBranches from the IO shell)', () => {
    const fixClaimedBranches = [{ branch: BRANCH, message: 'push refused: fix-2811 holds the fix claim' }];
    expect(guardReason(`git push origin HEAD:refs/heads/${BRANCH}`, { fixClaimedBranches })).toMatch(/fix-2811 holds the fix claim/);
    expect(guardReason(`git push --force-with-lease origin HEAD:${BRANCH}`, { fixClaimedBranches })).toMatch(/fix-2811/);
    expect(guardReason('git push origin HEAD:refs/heads/lane/unrelated', { fixClaimedBranches })).toBeNull();
    expect(guardReason(`git push origin HEAD:refs/heads/${BRANCH}`)).toBeNull(); // inert without the IO shell's list
  });

  it('the dispatcher refuses to spawn a fixer while any fix claim is live', () => {
    claimNow();
    const spawned = [];
    const r = dispatchFix(
      { itemNum: null, pr: 2811, laneRef: BRANCH, scope: ['we:x'], lane: 3, headRefOid: 'a'.repeat(40) },
      { root: '/repo', readBrief: () => '# {{PR_NUM}}', claimRoot: root, spawnAgent: () => { spawned.push(1); return ''; } },
    );
    expect(r).toMatchObject({ held: true, reason: 'fix-claimed', heldBy: 'fix-2811' });
    expect(spawned).toHaveLength(0);
  });

  it('the status tagger reads `fixing` for a claim held by a non-daemon worker', () => {
    expect(deriveReviewStatus({ pr: 2811, agents: [], fixClaim: { meta: { who: 'rubric-worker' } } })).toEqual({ role: 'fix', state: 'fixing' });
  });

  it('isClaimHolder: a session-bound claim needs its session id; a session-less claim needs its who', () => {
    const e = readLiveFixClaim({ repo: 'we', pr: 2811, lockRoot: root, nowMs: T0 });
    expect(isClaimHolder(e, { sessionId: 'sess-fixer' })).toBe(true);
    expect(isClaimHolder(e, { who: 'fix-2811' })).toBe(false);
    expect(isClaimHolder(e, { who: 'fix-2811', sessionId: 'sess-other' })).toBe(false);
    expect(isClaimHolder(e, {})).toBe(false);
    const sessionless = { meta: { who: 'rubric-worker', sessionId: null } };
    expect(isClaimHolder(sessionless, { who: 'rubric-worker' })).toBe(true);
    expect(isClaimHolder(sessionless, { who: 'other' })).toBe(false);
  });
});

describe('planReconcile — a live fix claim refuses every dispatch', () => {
  const pr = (over = {}) => ({
    number: 2811, state: 'OPEN', headRefName: BRANCH, headRefOid: '60f0f3d5764f63b4b150ef5a7c5a8b7c40730010',
    labels: [{ name: 'review:pending' }], mergeStateStatus: 'CLEAN',
    statusCheckRollup: [{ name: 'gate', status: 'completed', conclusion: 'success' }], comments: [], ...over,
  });

  it('a green draft is NOT promoted and no review is dispatched while the claim is held; after release it is promoted', () => {
    const claimed = planReconcile({ prs: [pr({ isDraft: true, fixClaim: { who: 'fix-2811', why: 'address review' } })], agents: [], now: T0 });
    expect(claimed.dispatch).toEqual([]);
    expect(claimed.refusals).toEqual([expect.objectContaining({ prNumber: 2811, kind: 'fix-claimed', who: 'fix-2811' })]);
    const released = planReconcile({ prs: [pr({ isDraft: true })], agents: [], now: T0 });
    expect(released.dispatch).toEqual([expect.objectContaining({ prNumber: 2811, kind: 'promote-draft' })]);
  });

  it('enrichPrsWithFixClaims attaches the claim off the store (and nothing when there is none)', () => {
    acquireFixClaim({ repo: 'we', pr: 2811, who: 'fix-2811', why: 'w', lockRoot: root, nowMs: Date.now() });
    const readClaim = (o) => readLiveFixClaim({ ...o, lockRoot: root });
    const [a, b] = enrichPrsWithFixClaims([{ number: 2811 }, { number: 9 }], { repo: 'we', readClaim });
    expect(a.fixClaim).toMatchObject({ who: 'fix-2811', why: 'w' });
    expect(b.fixClaim).toBeUndefined();
  });
});

describe('stand-down semantics — a concurrent author is a pause, not a burial', () => {
  const HEAD = '60f0f3d5764f63b4b150ef5a7c5a8b7c40730010';
  const pr = (comments, over = {}) => ({
    number: 2811, state: 'OPEN', headRefName: BRANCH, headRefOid: HEAD,
    labels: [{ name: 'review:changes' }], mergeStateStatus: 'CLEAN',
    statusCheckRollup: [{ name: 'gate', status: 'completed', conclusion: 'success' }],
    comments: [{ body: '🔁 review — changes requested\n\nthe gap enumeration drops lead-in time', author: AUTOMATION }, ...comments],
    ...over,
  });

  it('the LIVE #2811 stand-down is reclassified: not terminal for any counter, parsed as a pause with its alt branch', () => {
    const comments = [{ body: LIVE_2811_STAND_DOWN, author: AUTOMATION, createdAt: '2026-09-27T15:45:27Z' }];
    expect(countUnresolvedStandDowns(comments)).toBe(0);
    expect(countTerminalStandDowns(comments)).toBe(0);
    expect(countStandDownComments(comments)).toBe(0);
    expect(concurrentAuthorPauses(comments)).toEqual([
      { createdAt: '2026-09-27T15:45:27Z', head: null, legacy: true, alt: { branch: 'lane/run-rating-slice1-fix-2811-alt', sha: '3b24fcc18' } },
    ]);
  });

  it('the LIVE #2811 PR is re-armed: the planner owes it a fix, and the row names the saved alt branch', () => {
    const plan = planReconcile({
      prs: [pr([{ body: LIVE_2811_STAND_DOWN, author: AUTOMATION, createdAt: '2026-09-27T15:45:27Z' }])],
      agents: [], now: Date.parse('2026-09-27T21:30:00Z'),
    });
    expect(plan.refusals.filter((r) => r.prNumber === 2811)).toEqual([]);
    expect(plan.dispatch).toEqual([expect.objectContaining({
      prNumber: 2811, kind: 'fix', altBranch: { branch: 'lane/run-rating-slice1-fix-2811-alt', sha: '3b24fcc18' },
    })]);
  });

  it('a genuine terminal stand-down stays terminal', () => {
    const comments = [{ body: buildStandDownComment({ reason: 'needs-judgment' }), author: AUTOMATION }];
    const plan = planReconcile({ prs: [pr(comments)], agents: [], now: T0 });
    expect(plan.refusals).toEqual([expect.objectContaining({ kind: 'stood-down' })]);
  });

  // Review finding (PR #2821): the classifier sniffed free prose, so any terminal stand-down whose --detail said
  // "concurrent author" was re-armed after the quiet window. Every reason × red-herring detail must stay terminal.
  const RED_HERRINGS = [
    'the migration also touched a table a concurrent author owns; needs a human call on precedence',
    'Concurrent-Author semantics are unclear here',
    'a concurrent author saved work on lane/some-fix-alt (abc1234) but the reviewer asks for a design call',
    'edited concurrently by two sessions',
  ];
  for (const reason of ['needs-judgment', 'gate-red', 'conflict', 'lane-ref-gone', 'bogus-reason']) {
    for (const detail of RED_HERRINGS) {
      // The legacy #2811 shape (conflict + concurrent author + a saved -alt branch) is the ONE reclassified combo.
      if (reason === 'conflict' && /-alt\b/.test(detail)) continue;
      it(`stays terminal: --reason=${reason} with detail "${detail.slice(0, 40)}…"`, () => {
        const comments = [{ body: buildStandDownComment({ reason, detail }), author: AUTOMATION, createdAt: '2026-09-27T15:00:00Z' }];
        expect(countStandDownComments(comments)).toBe(1);
        expect(countTerminalStandDowns(comments)).toBe(1);
        expect(concurrentAuthorPauses(comments)).toEqual([]);
        for (const now of [T0 + 5 * MIN, T0 + 25 * MIN, T0 + 24 * 60 * MIN]) {
          const plan = planReconcile({ prs: [pr(comments)], agents: [], now });
          expect(plan.refusals).toEqual([expect.objectContaining({ kind: 'stood-down' })]);
          expect(plan.dispatch).toEqual([]);
        }
      });
    }
  }

  it('the `concurrent-author` reason built through buildStandDownComment IS a pause', () => {
    const comments = [{ body: buildStandDownComment({ reason: 'concurrent-author', detail: 'x' }), author: AUTOMATION }];
    expect(countStandDownComments(comments)).toBe(0);
    expect(concurrentAuthorPauses(comments)).toHaveLength(1);
  });

  it('a new-style pause holds on the same head inside the quiet window, and re-arms on the next head or after it', () => {
    const body = buildConcurrentAuthorPauseComment({ head: HEAD, alt: 'lane/x-fix-2811-alt', altSha: 'b'.repeat(40) });
    expect(body.startsWith(CONCURRENT_AUTHOR_PAUSE_MARKER)).toBe(true);
    const comments = [{ body, author: AUTOMATION, createdAt: new Date(T0).toISOString() }];
    const held = planReconcile({ prs: [pr(comments)], agents: [], now: T0 + 5 * MIN });
    expect(held.refusals).toEqual([expect.objectContaining({ kind: 'concurrent-author-paused' })]);
    const nextHead = planReconcile({ prs: [pr(comments, { headRefOid: 'c'.repeat(40) })], agents: [], now: T0 + 5 * MIN });
    expect(nextHead.dispatch).toEqual([expect.objectContaining({ kind: 'fix', altBranch: { branch: 'lane/x-fix-2811-alt', sha: 'b'.repeat(40) } })]);
    const quiet = planReconcile({ prs: [pr(comments)], agents: [], now: T0 + CONCURRENT_AUTHOR_QUIET_MS + MIN });
    expect(quiet.dispatch).toEqual([expect.objectContaining({ kind: 'fix' })]);
  });

  it('a pause from an untrusted login is ignored (#3383 authorship rule)', () => {
    const body = buildConcurrentAuthorPauseComment({ head: HEAD });
    expect(concurrentAuthorPauses([{ body, author: { login: 'drive-by' } }])).toEqual([]);
  });

  it('parseAltBranch reads the saved branch and sha out of free text', () => {
    expect(parseAltBranch('saved on lane/a-b-fix-9-alt (`3b24fcc18`, rebased)')).toEqual({ branch: 'lane/a-b-fix-9-alt', sha: '3b24fcc18' });
    expect(parseAltBranch('nothing saved')).toBeNull();
  });

  it('withAltBranchHint tells the next fixer to start from the saved branch (and is a no-op without one)', () => {
    expect(withAltBranchHint('P', null)).toBe('P');
    const out = withAltBranchHint('P', { branch: 'lane/run-rating-slice1-fix-2811-alt', sha: '3b24fcc18' });
    expect(out).toMatch(/git fetch origin lane\/run-rating-slice1-fix-2811-alt/);
    expect(out).toMatch(/3b24fcc18/);
  });
});

describe('fixBegin / fixEnd — the IO shell', () => {
  const fakeGh = (view) => {
    const calls = [];
    const gh = async (args) => { calls.push(args); return args[1] === 'view' ? JSON.stringify(view) : ''; };
    return { gh, calls };
  };
  const fakeLabels = () => {
    const log = [];
    return {
      log,
      ensureLabel: (repo, name) => log.push(['ensure', name]),
      setLabels: (repo, pr, spec) => log.push(['set', spec]),
      postComment: (repo, pr, body) => log.push(['comment', body.split('\n')[0]]),
    };
  };

  it('fix-begin: claim → `gh pr ready --undo` → fixing label (stood-down removed) → marker; fix-end leaves it draft', async () => {
    const { gh, calls } = fakeGh({ headRefName: BRANCH, headRefOid: 'a'.repeat(40), isDraft: false, state: 'OPEN', labels: [{ name: STOOD_DOWN_LABEL }] });
    const labels = fakeLabels();
    const r = await fixBegin({ repo: 'we', pr: 2811, who: 'fix-2811', why: 'address review', gh, labels, lockRoot: root, nowMs: T0 });
    expect(r).toMatchObject({ ok: true, branch: BRANCH, steps: ['draft', 'label', 'comment'] });
    expect(calls).toContainEqual(['pr', 'ready', '2811', '--repo', 'chalbert/web-everything', '--undo']);
    expect(labels.log).toContainEqual(['set', { add: FIXING_LABEL, remove: [STOOD_DOWN_LABEL] }]);
    expect(labels.log).toContainEqual(['comment', FIX_BEGIN_MARKER]);

    const other = await fixBegin({ repo: 'we', pr: 2811, who: 'rubric-worker', gh, labels: fakeLabels(), lockRoot: root, nowMs: T0 + MIN });
    expect(other).toMatchObject({ ok: false, reason: 'held' });

    const end = await fixEnd({ repo: 'we', pr: 2811, who: 'fix-2811', gh, labels, lockRoot: root });
    expect(end).toMatchObject({ ok: true });
    expect(calls.filter((a) => a[1] === 'ready')).toHaveLength(1); // fix-end never un-drafts
    expect(labels.log).toContainEqual(['set', { remove: [FIXING_LABEL] }]);
    expect(labels.log).toContainEqual(['comment', FIX_END_MARKER]);
    expect(readLiveFixClaim({ repo: 'we', pr: 2811, lockRoot: root, nowMs: T0 + 2 * MIN })).toBeNull();
  });

  it('fix-begin releases the claim and fails when the PR cannot be turned back to draft', async () => {
    const gh = async (args) => { if (args[1] === 'ready') throw new Error('gh: boom'); return JSON.stringify({ headRefName: BRANCH, isDraft: false, state: 'OPEN' }); };
    const r = await fixBegin({ repo: 'we', pr: 5, who: 'w', gh, labels: fakeLabels(), lockRoot: root, nowMs: T0 });
    expect(r).toMatchObject({ ok: false, reason: 'draft-failed' });
    expect(readLiveFixClaim({ repo: 'we', pr: 5, lockRoot: root, nowMs: T0 })).toBeNull();
  });
});

describe('the fix daemon\'s refresh sweep and a `fixing` claim', () => {
  it('does not throw on a fixing claim, and refreshes it while a session named `who` is live', () => {
    acquireFixClaim({ repo: 'we', pr: 2811, who: 'rubric-worker', lockRoot: root, nowMs: T0 });
    const agents = [{ name: 'rubric-worker', state: 'working' }];
    const r = refreshLiveFixDispatchClaims({ lockRoot: root, listAgentsAll: () => agents, hungInfoFor: () => null, nowIso: () => new Date(T0 + MIN).toISOString() });
    expect(r.refreshed).toEqual([expect.objectContaining({ pr: 2811, kind: 'fixing' })]);
    const none = refreshLiveFixDispatchClaims({ lockRoot: root, listAgentsAll: () => [], hungInfoFor: () => null, nowIso: () => new Date(T0 + MIN).toISOString() });
    expect(none.refreshed).toEqual([]);
  });
});

describe('repoKeyFromRemoteUrl', () => {
  it('maps ssh and https remotes; unknown repos are null', () => {
    expect(repoKeyFromRemoteUrl('git@github.com:chalbert/web-everything.git')).toBe('we');
    expect(repoKeyFromRemoteUrl('https://github.com/chalbert/frontierui')).toBe('frontierui');
    expect(repoKeyFromRemoteUrl('git@github.com:someone/else.git')).toBeNull();
  });

  it('repoKeyForCheckout reads the URL of the remote it is told to (pr-land passes its --remote), from a checkout PATH', () => {
    const calls = [];
    const exec = (cmd, args, o) => { calls.push([args.at(-1), o.cwd]); return args.at(-1) === 'upstream' ? 'git@github.com:chalbert/frontierui.git\n' : 'git@github.com:chalbert/web-everything.git\n'; };
    expect(repoKeyForCheckout('/lanes/x', { exec })).toBe('we');
    expect(repoKeyForCheckout('/lanes/x', { remote: 'upstream', exec })).toBe('frontierui');
    expect(calls).toEqual([['origin', '/lanes/x'], ['upstream', '/lanes/x']]);
  });
});

describe('the CLI and its documented invocations name the repo', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const CLI = join(HERE, '..', 'fix-procedure.mjs');
  const WE = join(HERE, '..', '..', '..') + sep;

  it('fix-begin / fix-end / fix-heartbeat / fix-status refuse to run without --repo (never default to `we`)', () => {
    for (const cmd of ['fix-begin', 'fix-end', 'fix-heartbeat', 'fix-status']) {
      // PATH holds only node: on a regressed tree the CLI must never reach a real `gh` and touch a live PR.
      const env = { ...process.env, WE_COORDINATION_ROOT: root, PATH: dirname(process.execPath) };
      const r = spawnSync(process.execPath, [CLI, cmd, '999999', '--who=x'], { encoding: 'utf8', env });
      expect(r.status, cmd).toBe(1);
      expect(r.stderr).toMatch(/needs --repo=/);
    }
  });

  it('every fix-begin / fix-end / fix-heartbeat command in skills-src passes --repo', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, d.name);
        if (d.isDirectory()) walk(p);
        else if (d.name.endsWith('.md')) {
          // Join wrapped lines so a command split across a markdown line break is read whole.
          const text = readFileSync(p, 'utf8').replace(/\s*\n\s*/g, ' ');
          for (const m of text.matchAll(/fix-procedure\.mjs"?\s+(fix-(?:begin|end|heartbeat))\s+\S+([^`\n]*)/g)) {
            if (!/--repo=/.test(m[2])) offenders.push(`${p.slice(WE.length)}: ${m[0].slice(0, 90)}`);
          }
        }
      }
    };
    walk(join(WE, 'skills-src'));
    expect(offenders).toEqual([]);
  });
});
