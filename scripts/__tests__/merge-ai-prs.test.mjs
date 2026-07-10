/**
 * @file scripts/__tests__/merge-ai-prs.test.mjs
 * @description Proof of the pure classifier in `scripts/merge-ai-prs.mjs` — the `/merge` sweep that lands
 *   OPEN AI-generated PRs (orphans the queue-scoped drain never touches). The gh calls are the I/O boundary;
 *   the merge/skip verdict (AI-gate + green-gate + mergeable-gate) is decided here and unit-tested.
 */
import { describe, it, expect } from 'vitest';
import { isAiAuthor, isAiCommit, isAiGeneratedPr, isMechanicalMergeCommit, isRequiredCheckGreen, hasLabel, classifyPr, planLabelDrain, parseWatchOpts, pickRunningBatches, readBatchFeed, decideBatchesIdleExit, isRebaseDropCandidate, needsManifestStripBeforeMerge, shouldRepollForLabelLag, shouldLabelOnGreen, resolveRepos, siblingCloneName, regenDerivedOnLand, resolvePrimaryPath, syncPrimaryOnLand, resyncDetachedCwdForLand, parseNumstat, computeNetDiffChangedFiles, drainReasonMarker, buildDrainReasonComment, hasDrainReasonComment, shouldPostParkReasonComment } from '../merge-ai-prs.mjs';

const mechMerge = { messageHeadline: "Merge branch 'main' into lane/x", messageBody: '', authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }] };

const claudeCommit = (extra = {}) => ({ authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }, { name: 'Claude Opus 4.8 (1M context)', email: 'noreply@anthropic.com' }], ...extra });
const humanCommit = { authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }] };
const greenRollup = [{ name: 'test', conclusion: 'SUCCESS' }, { name: 'cla', conclusion: 'FAILURE' }];
// body defaults to a non-empty description (#2324) so every pre-existing 'merge' expectation below stays true
// without threading a body through each call; the empty-body gate has its own dedicated tests.
const aiPr = (extra = {}) => ({ number: 1, title: 't', body: 'what changed and why', commits: [claudeCommit(), claudeCommit()], statusCheckRollup: greenRollup, mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', ...extra });

describe('merge-ai-prs — AI detection', () => {
  it('recognizes a Claude author by name or anthropic email', () => {
    expect(isAiAuthor({ name: 'Claude Opus 4.8', email: 'x' })).toBe(true);
    expect(isAiAuthor({ name: 'Bot', email: 'noreply@anthropic.com' })).toBe(true);
    expect(isAiAuthor({ name: 'Nicolas Gilbert', email: 'nic@x.com' })).toBe(false);
  });
  it('a commit is AI via a co-author OR a body trailer', () => {
    expect(isAiCommit(claudeCommit())).toBe(true);
    expect(isAiCommit({ authors: [{ name: 'Nic', email: 'n@x' }], messageBody: 'work\n\nCo-Authored-By: Claude <noreply@anthropic.com>' })).toBe(true);
    expect(isAiCommit(humanCommit)).toBe(false);
  });
  it('a PR is AI-generated only if EVERY substantive commit is AI (one human commit disqualifies it)', () => {
    expect(isAiGeneratedPr({ commits: [claudeCommit(), claudeCommit()] })).toBe(true);
    expect(isAiGeneratedPr({ commits: [claudeCommit(), humanCommit] })).toBe(false);
    expect(isAiGeneratedPr({ commits: [] })).toBe(false); // no commits ⇒ not qualifying
  });
  it('ignores mechanical `Merge branch` commits (from update-branch) — they do not disqualify an AI PR', () => {
    expect(isMechanicalMergeCommit(mechMerge)).toBe(true);
    expect(isMechanicalMergeCommit(claudeCommit())).toBe(false);
    // an AI PR that got a mechanical update-branch merge still qualifies
    expect(isAiGeneratedPr({ commits: [claudeCommit(), mechMerge] })).toBe(true);
    // but a mechanical merge alone (no substantive AI commit) does NOT qualify
    expect(isAiGeneratedPr({ commits: [mechMerge] })).toBe(false);
  });
});

describe('merge-ai-prs — green gate', () => {
  it('requires the `test` check to be SUCCESS; ignores cla/others', () => {
    expect(isRequiredCheckGreen(aiPr())).toBe(true);
    expect(isRequiredCheckGreen({ statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] })).toBe(false);
    expect(isRequiredCheckGreen({ statusCheckRollup: [{ name: 'cla', conclusion: 'SUCCESS' }] })).toBe(false); // test absent
  });
});

describe('merge-ai-prs — classifyPr verdict', () => {
  it('MERGES an AI PR that is green + mergeable (CLEAN or UNSTABLE)', () => {
    expect(classifyPr(aiPr({ mergeStateStatus: 'CLEAN' })).decision).toBe('merge');
    expect(classifyPr(aiPr({ mergeStateStatus: 'UNSTABLE' })).decision).toBe('merge'); // only non-required checks red
  });
  it('SKIPS a non-AI PR', () => {
    const v = classifyPr(aiPr({ commits: [claudeCommit(), humanCommit] }));
    expect(v.decision).toBe('skip'); expect(v.reason).toMatch(/not AI-generated/);
  });
  it('SKIPS when the required check is not green', () => {
    const v = classifyPr(aiPr({ statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] }));
    expect(v.decision).toBe('skip'); expect(v.reason).toMatch(/not green/);
  });
  it('SKIPS a BEHIND PR (needs rebase — never force-updated by the sweep)', () => {
    const v = classifyPr(aiPr({ mergeStateStatus: 'BEHIND' }));
    expect(v.decision).toBe('skip'); expect(v.reason).toMatch(/BEHIND|not landable|merge state/);
  });
  it('SKIPS a not-mergeable PR (conflicts)', () => {
    const v = classifyPr(aiPr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }));
    expect(v.decision).toBe('skip'); expect(v.reason).toMatch(/not mergeable/);
  });
  // #2324 — refuse to land a PR with an empty/whitespace description (PR #206 landed bodyless).
  it('SKIPS a PR with an empty description', () => {
    const v = classifyPr(aiPr({ body: '' }));
    expect(v.decision).toBe('skip'); expect(v.reason).toMatch(/empty\/whitespace description/);
  });
  it('SKIPS a PR with a whitespace-only description', () => {
    expect(classifyPr(aiPr({ body: '   \n\t  ' })).decision).toBe('skip');
  });
  it('SKIPS a PR with no body field at all', () => {
    expect(classifyPr(aiPr({ body: undefined })).decision).toBe('skip');
  });
  it('MERGES a PR with a real description', () => {
    expect(classifyPr(aiPr({ body: 'fixes the thing because reasons' })).decision).toBe('merge');
  });
});

describe('merge-ai-prs — label-conditional AI gate (#2195, blockedBy #2196)', () => {
  const rtm = [{ name: 'ready-to-merge' }];
  const mixedCommits = { commits: [claudeCommit(), humanCommit] }; // one hand-authored commit ⇒ NOT every-commit-AI

  it('MERGES a labelled MIXED-authorship PR (the label certifies it — #40/#42 no longer skipped)', () => {
    const v = classifyPr(aiPr({ ...mixedCommits, labels: rtm }));
    expect(v.decision).toBe('merge');
    expect(v.aiGenerated).toBe(false);   // truthfully NOT every-commit-AI…
    expect(v.certifyLabel).toBe(true);   // …but the producer label certifies it
    expect(v.reason).toMatch(/producer-certified/);
  });

  it('SKIPS an UNLABELLED mixed-authorship PR (orphan sweep keeps the strict gate)', () => {
    const v = classifyPr(aiPr({ ...mixedCommits, labels: [] }));
    expect(v.decision).toBe('skip');
    expect(v.reason).toMatch(/not AI-generated/);
    expect(v.reason).toMatch(/no "ready-to-merge" label/);
  });

  it('a labelled PR still SKIPS on a red required check or a conflict (label is not a rubber stamp)', () => {
    expect(classifyPr(aiPr({ ...mixedCommits, labels: rtm, statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] })).decision).toBe('skip');
    expect(classifyPr(aiPr({ ...mixedCommits, labels: rtm, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })).decision).toBe('skip');
  });

  it('trustLabel:null forces the strict every-commit gate even when labelled', () => {
    const v = classifyPr(aiPr({ ...mixedCommits, labels: rtm }), { trustLabel: null });
    expect(v.decision).toBe('skip'); expect(v.certifyLabel).toBe(false);
  });

  it('hasLabel tolerates string labels, {name} labels, and a missing field', () => {
    expect(hasLabel({ labels: [{ name: 'ready-to-merge' }] }, 'ready-to-merge')).toBe(true);
    expect(hasLabel({ labels: ['ready-to-merge'] }, 'ready-to-merge')).toBe(true);
    expect(hasLabel({ labels: [{ name: 'other' }] }, 'ready-to-merge')).toBe(false);
    expect(hasLabel({}, 'ready-to-merge')).toBe(false);
    expect(hasLabel({ labels: [{ name: 'ready-to-merge' }] }, null)).toBe(false);
  });
});

describe('merge-ai-prs — planLabelDrain blockedBy ordering (#2188)', () => {
  const cand = (num, item, blockedBy = [], decision = 'merge') => ({ num, item, blockedBy, decision });

  it('orphan PRs (no manifest) are all ready, ordered by PR number', () => {
    const { ready, deferred } = planLabelDrain([cand(9, null), cand(3, null), cand(7, null)]);
    expect(ready.map((c) => c.num)).toEqual([3, 7, 9]);
    expect(deferred).toEqual([]);
  });

  it('DEFERS a PR whose blockedBy item is still an open candidate', () => {
    // #2200 depends on #2199; both open → only the blocker is ready this pass.
    const { ready, deferred } = planLabelDrain([cand(2, 2200, [2199]), cand(1, 2199, [])]);
    expect(ready.map((c) => c.num)).toEqual([1]);
    expect(deferred).toEqual([{ num: 2, item: 2200, waitOn: [2199] }]);
  });

  it('a blockedBy item NOT in the candidate set is treated as already landed (ready)', () => {
    const { ready } = planLabelDrain([cand(5, 2200, [1234])]); // #1234 not among candidates → landed
    expect(ready.map((c) => c.num)).toEqual([5]);
  });

  it('a red/skip blocker still defers its dependents (never land past a broken blocker)', () => {
    const { ready, deferred } = planLabelDrain([cand(2, 2200, [2199]), cand(1, 2199, [], 'skip')]);
    expect(ready).toEqual([]); // the blocker is skip (unlanded) so it stays in the open set
    expect(deferred.map((d) => d.num)).toEqual([2]);
  });

  it('orders ready by item then PR number (deterministic cascade)', () => {
    const { ready } = planLabelDrain([cand(8, 2205), cand(4, 2201), cand(6, 2201)]);
    expect(ready.map((c) => c.num)).toEqual([4, 6, 8]); // item 2201 (PRs 4,6) before 2205 (PR 8)
  });
});

describe('merge-ai-prs — parseWatchOpts (#2194 /drain watch)', () => {
  it('defaults: watch off, 30s interval, unbounded (no max-idle), batch-idle off (debounce 2)', () => {
    expect(parseWatchOpts()).toEqual({ watch: false, intervalSec: 30, maxIdle: null, untilBatchesIdle: false, batchIdleDebounce: 2 });
  });

  it('--watch on with a custom interval + max-idle', () => {
    expect(parseWatchOpts({ watch: true, interval: '10', maxIdle: '3' })).toEqual({ watch: true, intervalSec: 10, maxIdle: 3, untilBatchesIdle: false, batchIdleDebounce: 2 });
  });

  it('--until-batches-idle on, custom debounce (#2330)', () => {
    const o = parseWatchOpts({ watch: true, untilBatchesIdle: true, batchIdleDebounce: '3' });
    expect(o.untilBatchesIdle).toBe(true);
    expect(o.batchIdleDebounce).toBe(3);
    // a bad/low debounce falls back to the safe default 2
    expect(parseWatchOpts({ untilBatchesIdle: true, batchIdleDebounce: '0' }).batchIdleDebounce).toBe(2);
    expect(parseWatchOpts({ untilBatchesIdle: true, batchIdleDebounce: 'x' }).batchIdleDebounce).toBe(2);
  });

  it('a non-positive / non-numeric interval falls back to the 30s default', () => {
    expect(parseWatchOpts({ watch: true, interval: '0' }).intervalSec).toBe(30);
    expect(parseWatchOpts({ watch: true, interval: 'x' }).intervalSec).toBe(30);
    expect(parseWatchOpts({ watch: true, interval: '-5' }).intervalSec).toBe(30);
  });

  it('max-idle=0 is honoured (exit on the first idle pass), a bad value → unbounded', () => {
    expect(parseWatchOpts({ watch: true, maxIdle: '0' }).maxIdle).toBe(0);
    expect(parseWatchOpts({ watch: true, maxIdle: 'x' }).maxIdle).toBe(null);
  });
});

describe('merge-ai-prs — batch-aware --until-batches-idle exit (#2330)', () => {
  const feedOf = (runs) => ({ runs });

  it('pickRunningBatches selects only kind:batch status:running runs', () => {
    const feed = feedOf([
      { kind: 'batch', status: 'running', nums: [1, 2] },
      { kind: 'batch', status: 'completed', nums: [3] },   // terminal → not producing
      { kind: 'workflow', status: 'running' },             // not a batch
      { kind: 'batch', status: 'running', nums: [4] },
    ]);
    expect(pickRunningBatches(feed).map((r) => r.nums)).toEqual([[1, 2], [4]]);
    expect(pickRunningBatches(null)).toEqual([]);
    expect(pickRunningBatches({})).toEqual([]);
  });

  it('readBatchFeed: absent / stale / unparseable → known:false (keep watching); fresh → known:true', () => {
    const now = 1_000_000;
    const mk = (opts) => readBatchFeed('/feed.json', { now, staleMs: 30_000, fs: opts });
    // absent
    expect(mk({ existsSync: () => false, readFileSync: () => '', statSync: () => ({}) }))
      .toEqual({ known: false, running: [], reason: 'feed-absent' });
    // stale (mtime older than staleMs)
    expect(mk({ existsSync: () => true, statSync: () => ({ mtimeMs: now - 60_000 }), readFileSync: () => '{"runs":[]}' }).known).toBe(false);
    // unparseable
    expect(mk({ existsSync: () => true, statSync: () => ({ mtimeMs: now }), readFileSync: () => 'not json' }).known).toBe(false);
    // fresh + running batch
    const fresh = mk({ existsSync: () => true, statSync: () => ({ mtimeMs: now - 1_000 }), readFileSync: () => JSON.stringify(feedOf([{ kind: 'batch', status: 'running', nums: [9] }])) });
    expect(fresh.known).toBe(true);
    expect(fresh.running).toHaveLength(1);
  });

  it('decideBatchesIdleExit: the safe conjunction (idle + empty queue + debounced non-running)', () => {
    // disabled → never
    expect(decideBatchesIdleExit({ enabled: false, idlePass: true, considered: 0, batchNonRunningStreak: 5 })).toBe(false);
    // not idle → keep going
    expect(decideBatchesIdleExit({ enabled: true, idlePass: false, considered: 0, batchNonRunningStreak: 5 })).toBe(false);
    // queue not empty → keep going (a labelled PR is still in flight)
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 1, batchNonRunningStreak: 5 })).toBe(false);
    // batch not debounced yet (streak < debounce) → keep going
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 0, batchNonRunningStreak: 1, debounce: 2 })).toBe(false);
    // all conditions met → exit
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 0, batchNonRunningStreak: 2, debounce: 2 })).toBe(true);
  });
});

describe('shouldLabelOnGreen (#2216 — post-CI reconcile labels a stranded green PR)', () => {
  const labelled = (extra = {}) => aiPr({ labels: [{ name: 'ready-to-merge' }], ...extra });
  it('green + AI-generated + UNLABELLED → label it (the label-on-green timeout stranded it)', () => {
    expect(shouldLabelOnGreen(aiPr(), {})).toBe(true);
  });
  it('already carries the label → do NOT re-label', () => {
    expect(shouldLabelOnGreen(labelled(), {})).toBe(false);
  });
  it('a human orphan (a commit lacks the Claude trailer) → never labelled', () => {
    expect(shouldLabelOnGreen(aiPr({ commits: [claudeCommit(), humanCommit] }), {})).toBe(false);
  });
  it('required check not green (still pending/red) → not yet', () => {
    expect(shouldLabelOnGreen(aiPr({ statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] }), {})).toBe(false);
    expect(shouldLabelOnGreen(aiPr({ statusCheckRollup: [] }), {})).toBe(false);
  });
  it('no label configured → no-op', () => {
    expect(shouldLabelOnGreen(aiPr(), { label: null })).toBe(false);
  });
  it('BEHIND-but-green is still labelled (mergeability is the drain\'s rebase-drop job, not the label gate)', () => {
    expect(shouldLabelOnGreen(aiPr({ mergeStateStatus: 'BEHIND', mergeable: 'UNKNOWN' }), {})).toBe(true);
  });
});

describe('shouldRepollForLabelLag (#2230 — absorb the ready-to-merge index-propagation lag)', () => {
  it('zero labelled candidates on a label-scoped one-shot → re-poll once', () => {
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 0, retried: false })).toBe(true);
  });
  it('already found ≥1 → do NOT re-poll (queue is genuinely non-empty)', () => {
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 1, retried: false })).toBe(false);
  });
  it('already retried once → never re-poll again (no busy-loop; a still-empty re-poll is a real empty queue)', () => {
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 0, retried: true })).toBe(false);
  });
  it('no label (the bare /merge orphan sweep) → never re-poll (the lag only bites the labelled drain)', () => {
    expect(shouldRepollForLabelLag({ label: null, found: 0, retried: false })).toBe(false);
  });
  it('--expect=N: fewer than N found → re-poll; N-or-more → done', () => {
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 1, expect: 2, retried: false })).toBe(true);
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 2, expect: 2, retried: false })).toBe(false);
  });
  it('a non-positive / non-numeric --expect falls back to threshold 1 (any candidate suffices)', () => {
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 1, expect: 0, retried: false })).toBe(false);
    expect(shouldRepollForLabelLag({ label: 'ready-to-merge', found: 0, expect: 'x', retried: false })).toBe(true);
  });
});

describe('isRebaseDropCandidate (#2198 — the manifest-wall rescue gate)', () => {
  // classifyPr on a certified+green PR that is CONFLICTING (the classic shared-manifest wall) → skip.
  const walled = classifyPr(aiPr({ number: 7, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }), {});
  it('a certified + green PR walled by the manifest (CONFLICTING/DIRTY) IS a candidate', () => {
    expect(walled.decision).toBe('skip');
    expect(isRebaseDropCandidate(walled)).toBe(true);
  });
  it('a BEHIND (needs-rebase) certified+green PR is a candidate', () => {
    const behind = classifyPr(aiPr({ number: 8, mergeable: 'MERGEABLE', mergeStateStatus: 'BEHIND' }), {});
    expect(isRebaseDropCandidate(behind)).toBe(true);
  });
  it('a cleanly-mergeable PR is NOT a candidate (decision is merge, nothing to rebuild)', () => {
    const clean = classifyPr(aiPr({ number: 9 }), {});
    expect(clean.decision).toBe('merge');
    expect(isRebaseDropCandidate(clean)).toBe(false);
  });
  it('a red `test` is NOT a candidate (a real bug, not a manifest artefact)', () => {
    const red = classifyPr(aiPr({ number: 10, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] }), {});
    expect(isRebaseDropCandidate(red)).toBe(false);
  });
  it('an un-certified (mixed-authorship, no label) PR is NOT a candidate — never auto-resolve an un-blessed branch', () => {
    const uncertified = classifyPr({ number: 11, title: 't', commits: [claudeCommit(), humanCommit], statusCheckRollup: greenRollup, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY', labels: [] }, {});
    expect(uncertified.decision).toBe('skip');
    expect(isRebaseDropCandidate(uncertified)).toBe(false);
  });
  it('a BLOCKED/DRAFT state is NOT a candidate (branch-protection / human concern, not a manifest wall)', () => {
    const blocked = classifyPr(aiPr({ number: 12, mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' }), {});
    expect(isRebaseDropCandidate(blocked)).toBe(false);
  });
});

describe('resolveRepos (#2257/#2287 — the single /drain lander sweeps all 3 constellation repos BY DEFAULT)', () => {
  it('neither flag (+ self) → the constellation IS the default (#2287), SELF FIRST', () => {
    expect(resolveRepos({ self: 'chalbert/web-everything' }))
      .toEqual(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app']);
  });
  it('--this-repo → single-repo [null] (deliberately scoped; the cwd repo, no --repo)', () => {
    expect(resolveRepos({ singleRepo: true, self: 'chalbert/web-everything' })).toEqual([null]);
  });
  it('default derives the owner from self and dedupes (self is not listed twice)', () => {
    const r = resolveRepos({ self: 'acme/frontierui' });
    expect(r[0]).toBe('acme/frontierui');                        // self first
    expect(r).toEqual(['acme/frontierui', 'acme/web-everything', 'acme/plateau-app']);
    expect(new Set(r).size).toBe(r.length);                      // no dupes
  });
  it('an underivable owner (no self, or self without a slash) falls back to single-repo [null] — safe', () => {
    expect(resolveRepos()).toEqual([null]);
    expect(resolveRepos({})).toEqual([null]);
    expect(resolveRepos({ self: 'noslug' })).toEqual([null]);
  });
  it('--repos=a,b → exactly those slugs (explicit override, trims + drops blanks)', () => {
    expect(resolveRepos({ repos: 'chalbert/frontierui, chalbert/plateau-app' }))
      .toEqual(['chalbert/frontierui', 'chalbert/plateau-app']);
    expect(resolveRepos({ repos: ' , chalbert/frontierui , ' })).toEqual(['chalbert/frontierui']);
  });
  it('--repos wins over the default/--this-repo when given', () => {
    expect(resolveRepos({ repos: 'x/y', self: 'a/web-everything' })).toEqual(['x/y']);
    expect(resolveRepos({ repos: 'x/y', singleRepo: true, self: 'a/web-everything' })).toEqual(['x/y']);
  });
  it('`--all-repos` is a harmless no-op alias of the default (unknown key ignored → still constellation)', () => {
    expect(resolveRepos({ allRepos: true, self: 'chalbert/web-everything' }))
      .toEqual(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app']);
  });
  it('an empty/whitespace --repos falls back to the single-repo default', () => {
    expect(resolveRepos({ repos: '' })).toEqual([null]);
    expect(resolveRepos({ repos: '   ' })).toEqual([null]);
  });
});

describe('siblingCloneName (#2263 — sibling-clone routing for remote-repo rebase-drop)', () => {
  it('a known constellation repo slug → its short directory name', () => {
    expect(siblingCloneName('chalbert/frontierui')).toBe('frontierui');
    expect(siblingCloneName('chalbert/plateau-app')).toBe('plateau-app');
    expect(siblingCloneName('chalbert/web-everything')).toBe('web-everything');
  });
  it('a repo outside the known constellation → null (nothing to route to)', () => {
    expect(siblingCloneName('chalbert/some-other-repo')).toBeNull();
  });
  it('null/malformed input → null', () => {
    expect(siblingCloneName(null)).toBeNull();
    expect(siblingCloneName(undefined)).toBeNull();
    expect(siblingCloneName('noslug')).toBeNull();
    expect(siblingCloneName('')).toBeNull();
  });
});

describe('parseNumstat (#1821 — net two-dot diff for the review-escalation backstop)', () => {
  it('parses `<added>\\t<deleted>\\t<path>` lines into changedFiles + total diffLines', () => {
    const out = parseNumstat('3\t1\tscripts/merge-ai-prs.mjs\n0\t5\tbacklog/1821-foo.md\n');
    expect(out.changedFiles).toEqual(['scripts/merge-ai-prs.mjs', 'backlog/1821-foo.md']);
    expect(out.diffLines).toBe(9);
  });
  it('a net-unchanged file (already landed upstream) simply does not appear — nothing to parse for it', () => {
    // the whole point of #1821: the caller diffs `origin/main` vs the PR head directly, so a file whose
    // content is identical on both sides never shows up in `--numstat` output in the first place (unlike the
    // GitHub PR `files` list, which is a three-dot/merge-base diff and would still list it).
    const out = parseNumstat('2\t0\tscripts/only-real-change.mjs\n');
    expect(out.changedFiles).toEqual(['scripts/only-real-change.mjs']);
    expect(out.changedFiles).not.toContain('scripts/merge-ai-prs.mjs');
  });
  it('binary files use `-\\t-\\t<path>` — counted as 0 lines, path still included', () => {
    const out = parseNumstat('-\t-\tsrc/assets/logo.png\n1\t1\tREADME.md');
    expect(out.changedFiles).toEqual(['src/assets/logo.png', 'README.md']);
    expect(out.diffLines).toBe(2);
  });
  it('blank/empty input → empty result', () => {
    expect(parseNumstat('')).toEqual({ changedFiles: [], diffLines: 0 });
    expect(parseNumstat(null)).toEqual({ changedFiles: [], diffLines: 0 });
    expect(parseNumstat(undefined)).toEqual({ changedFiles: [], diffLines: 0 });
  });
});

describe('computeNetDiffChangedFiles (#2373 — SHARED net-diff basis, producer + drain)', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      calls.push({ cmd, args, opts, key: `${cmd} ${args.join(' ')}` });
      const h = script[`${cmd} ${args.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      // Faithful to real git: an UNSTUBBED `git diff` against a ref this fake doesn't know throws
      // (unknown revision) rather than silently returning '' — so an invalid candidate (e.g. the producer's
      // `<remote>/<sha>`) fails fast and the fallthrough is exercised as it would be against real git.
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      return '';
    };
    return { exec, calls };
  };

  it('fetches BASE with an EXPLICIT destination refspec (never a bare `git fetch <remote> <base>`, which relies on the opportunistic tracking-ref update)', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(calls.some((c) => c.args[0] === 'fetch' && c.args[1] === 'origin' && c.args[2] === '+main:refs/remotes/origin/main')).toBe(true);
  });

  it('diffs `<remote>/<base>` against `rev` directly (a plain two-tree comparison, content-only) and parses via parseNumstat', () => {
    const { exec } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' } });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 4, scored: true });
  });

  it('a file already landed upstream (net-identical) never appears — the false-positive #2373 exists to prevent', () => {
    // origin/main already carries the gate-fix commit, so its tree is identical to the PR head for that file:
    // `git diff --numstat` naturally omits it, regardless of whether the commit is in the PR's ancestry.
    const { exec } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tbacklog/2373-x.md\n' } });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r.changedFiles).not.toContain('scripts/merge-ai-prs.mjs');
    expect(r.changedFiles).not.toContain('scripts/lib/review-escalation.mjs');
  });

  it('the fetch failing degrades gracefully — still attempts the diff off whatever is locally cached', () => {
    const { exec, calls } = fakeExec({
      'git fetch origin +main:refs/remotes/origin/main --quiet': { throw: 'network unreachable' },
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ changedFiles: ['README.md'], diffLines: 1, scored: true });
    expect(calls.some((c) => c.args[0] === 'diff')).toBe(true);
  });

  it('#2373-review-r2 — the REMOTE-tracking candidate `<remote>/<rev>` is tried BEFORE the bare `rev` (dodges a stale-local-branch-name collision in the drain, where `rev` is `v.headRef`, a branch NAME)', () => {
    // Both candidates would "resolve" here; only the ORDER distinguishes them. origin/lane/x (freshly fetched)
    // carries the real diff; a stale local `lane/x` carries a WRONG/partial one. Remote-first must win.
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/x': { stdout: '2\t2\tscripts/merge-ai-prs.mjs\n' }, // fresh remote — correct
      'git diff --numstat origin/main lane/x': { stdout: '1\t0\tREADME.md\n' }, // stale local — WRONG, must not win
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ changedFiles: ['scripts/merge-ai-prs.mjs'], diffLines: 4, scored: true });
    // Resolved on the FIRST diff attempt — the remote-tracking ref — so the stale-local candidate is never reached.
    const diffCalls = calls.filter((c) => c.args[0] === 'diff');
    expect(diffCalls.length).toBe(1);
    expect(diffCalls[0].key).toBe('git diff --numstat origin/main origin/lane/x');
  });

  it('resolves a foreign/sibling clone\'s PR via `<remote>/<rev>` when `rev` is not a local branch (the head ref was fetched by `fetchExtraRefs`)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/x': { stdout: '2\t2\tscripts/merge-ai-prs.mjs\n' },
      // no local `lane/x` branch — the bare-rev candidate would throw (unstubbed) if ever reached
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ changedFiles: ['scripts/merge-ai-prs.mjs'], diffLines: 4, scored: true });
    expect(calls.filter((c) => c.args[0] === 'diff').length).toBe(1);
  });

  it('#2373-review-r2 — PRODUCER path (`rev` is a resolved local SHA): `<remote>/<sha>` is an invalid ref that fails fast, then the bare SHA resolves — one extra cheap failed git call, no behavior change', () => {
    const { exec, calls } = fakeExec({
      // `origin/deadbeef` is NOT stubbed → the fake throws (unknown revision), mirroring real git on an invalid ref.
      'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' }); // producer: no fetchExtraRefs
    expect(r).toEqual({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 4, scored: true });
    const diffCalls = calls.filter((c) => c.args[0] === 'diff');
    expect(diffCalls.map((c) => c.key)).toEqual([
      'git diff --numstat origin/main origin/deadbeef', // tried first, fails fast (invalid ref)
      'git diff --numstat origin/main deadbeef', // falls through to the real local SHA
    ]);
  });

  it('#2373-review — neither `rev` nor `<remote>/<rev>` resolves → scored:false (FETCH_HEAD is NOT a fallback candidate: it would resolve to `<remote>/<base>` — base is first in the fetch refspec — and "succeed" with a base-vs-base EMPTY diff, masking this real miss; scored:false lets the caller fall through to its GitHub files-list backstop)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
      // A base-vs-base FETCH_HEAD diff would return '' (empty) and score true with zero changed files — the
      // exact false-negative #2373-review removes. It must NEVER be attempted; assertion below proves it isn't.
      'git diff --numstat origin/main FETCH_HEAD': { stdout: '' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('#2373-review — FETCH_HEAD is never a diff candidate, with OR without fetchExtraRefs (it always points at `<remote>/<base>` → a spurious empty base-vs-base diff)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x' }); // no fetchExtraRefs
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffChangedFiles({})).toEqual({ changedFiles: [], diffLines: 0, scored: false });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffChangedFiles({ exec })).toEqual({ changedFiles: [], diffLines: 0, scored: false });
    expect(calls.length).toBe(0);
  });

  it('honors a custom remote/base and passes fetchExtraRefs through to the fetch call', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat upstream/release deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    computeNetDiffChangedFiles({ exec, remote: 'upstream', base: 'release', rev: 'deadbeef', fetchExtraRefs: ['lane/x'] });
    expect(calls[0]).toMatchObject({ args: ['fetch', 'upstream', '+release:refs/remotes/upstream/release', 'lane/x', '--quiet'] });
  });
});

describe('needsManifestStripBeforeMerge (#2183 — first-lander manifest-leak fix)', () => {
  // The gap: isRebaseDropCandidate only fires on a CONFLICTING/BEHIND PR, so the FIRST cleanly-mergeable lane
  // PR of a batch carried its `.lane-manifest.json` onto main (observed: #79). A clean PR that still carries
  // the manifest must be rebuilt-to-drop it BEFORE merge, conflict or not.
  it('a cleanly-mergeable PR that STILL carries the manifest needs stripping (the leak case)', () => {
    const clean = classifyPr(aiPr({ number: 20 }), {});
    expect(clean.decision).toBe('merge');
    expect(needsManifestStripBeforeMerge({ ...clean, hasManifest: true })).toBe(true);
  });
  it('a cleanly-mergeable PR with NO manifest (orphan /pr PR) merges directly — no rebuild', () => {
    const clean = classifyPr(aiPr({ number: 21 }), {});
    expect(needsManifestStripBeforeMerge({ ...clean, hasManifest: false })).toBe(false);
  });
  it('a SKIPPED (conflicting) manifest-carrier is left to isRebaseDropCandidate, not this predicate', () => {
    const walled = classifyPr(aiPr({ number: 22, mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }), {});
    expect(walled.decision).toBe('skip');
    expect(needsManifestStripBeforeMerge({ ...walled, hasManifest: true })).toBe(false);
  });
  it('null / missing is not a candidate', () => {
    expect(needsManifestStripBeforeMerge(null)).toBe(false);
    expect(needsManifestStripBeforeMerge({ decision: 'merge' })).toBe(false);
  });
});

describe('regenDerivedOnLand — the drain owns post-land WE derived regen (#2290/#2182)', () => {
  // A capturing fake exec: records every call, and lets a test script canned-return per `cmd argv-join`.
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      calls.push({ cmd, args, opts, key: `${cmd} ${args.join(' ')}` });
      const h = script[`${cmd} ${args.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      return h && 'stdout' in h ? h.stdout : '';
    };
    return { exec, calls };
  };
  const REGEN = [['npm', 'run', 'gen:inventory'], ['npm', 'run', 'gen:reference-index']];
  const PATHS = ['AGENTS.md', 'src/_data/referenceIndex.json'];
  // The change-detection diff is now SCOPED to the derived-output paths (`-- <paths>`), not a bare tree diff —
  // so the fake-exec key carries the pathspec.
  const DIFF_KEY = `git diff --name-only -- ${PATHS.join(' ')}`;
  const ran = (calls) => calls.filter((c) => c.cmd === 'npm').map((c) => c.args.join(' '));
  const did = (calls, cmd, sub) => calls.some((c) => c.cmd === cmd && c.args[0] === sub);

  it('a successful land runs BOTH generators, then commits + pushes the diff to main (as the drain)', () => {
    const { exec, calls } = fakeExec({ [DIFF_KEY]: { stdout: 'AGENTS.md\nsrc/_data/referenceIndex.json\n' } });
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: true, dryRun: false, regenSet: REGEN, outputPaths: PATHS });
    expect(ran(calls)).toEqual(['run gen:inventory', 'run gen:reference-index']); // both generators invoked
    expect(did(calls, 'git', 'add')).toBe(true);
    const commit = calls.find((c) => c.cmd === 'git' && c.args[0] === 'commit');
    expect(commit.args.join(' ')).toMatch(/chore: regen derived artifacts post-land \(#2182\) \[gen:inventory, gen:reference-index\]/);
    const push = calls.find((c) => c.cmd === 'git' && c.args[0] === 'push');
    expect(push.args).toEqual(['push', 'origin', 'HEAD:main']);
    expect(push.opts.env.MAIN_PUSH_OK).toBe('1'); // gated main write, as the drain
    expect(r).toMatchObject({ ran: true, committed: true, pushed: true });
  });

  it('a no-op sweep (nothing landed) does NOT run the generators or touch git', () => {
    const { exec, calls } = fakeExec();
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: false, regenSet: REGEN });
    expect(calls.length).toBe(0);
    expect(r).toMatchObject({ ran: false, committed: false, pushed: false });
  });

  it('a dry-run never regenerates', () => {
    const { exec, calls } = fakeExec();
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: true, dryRun: true, regenSet: REGEN });
    expect(calls.length).toBe(0);
    expect(r.ran).toBe(false);
  });

  it('generators ran but produced NO diff → no commit, no push (idempotent land)', () => {
    const { exec, calls } = fakeExec({ [DIFF_KEY]: { stdout: '' } });
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: true, regenSet: REGEN, outputPaths: PATHS });
    expect(ran(calls)).toHaveLength(2);
    expect(did(calls, 'git', 'commit')).toBe(false);
    expect(did(calls, 'git', 'push')).toBe(false);
    expect(r).toMatchObject({ ran: true, committed: false, pushed: false });
  });

  it('a push failure is best-effort — reported in `warning`, never thrown (the couples already landed)', () => {
    const { exec } = fakeExec({ [DIFF_KEY]: { stdout: 'AGENTS.md\n' }, 'git push origin HEAD:main': { throw: 'remote rejected' } });
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: true, regenSet: REGEN, outputPaths: PATHS });
    expect(r.committed).toBe(false);
    expect(r.pushed).toBe(false);
    expect(r.warning).toMatch(/regen committed\/pushed FAILED/);
  });

  it('NEVER sweeps a foreign dirty file into the regen commit — scopes strictly to the derived-output paths', () => {
    // Regression for the drain-in-a-dirty-primary bug: a concurrent session left `backlog/2095-*.md` dirty
    // (an in-flight claim). The change-detect must intersect with the derived-output paths and commit ONLY
    // those — the foreign backlog edit must never ride the derived-artifacts commit onto main.
    const FOREIGN = 'backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v.md';
    // Even if git's pathspec were somehow bypassed and returned the foreign path, the `.filter(outputPaths)`
    // guard drops it — assert the belt-and-suspenders by canning a diff that INCLUDES the foreign file.
    const { exec, calls } = fakeExec({ [DIFF_KEY]: { stdout: `AGENTS.md\n${FOREIGN}\n` } });
    const r = regenDerivedOnLand({ exec, cwd: '/repo', landed: true, regenSet: REGEN, outputPaths: PATHS });
    const add = calls.find((c) => c.cmd === 'git' && c.args[0] === 'add');
    expect(add.args).toEqual(['add', 'AGENTS.md']);        // ONLY the derived output — never the foreign file
    expect(add.args).not.toContain(FOREIGN);
    expect(r).toMatchObject({ ran: true, committed: true, pushed: true });
  });
});

describe('resolvePrimaryPath — robust primary locator, independent of clone mode (#xwokc1n)', () => {
  const noAlt = () => { throw new Error('ENOENT'); };            // a --local clone: no alternates file

  it('an explicit --primary=<path> flag wins over everything', () => {
    expect(resolvePrimaryPath('/clone', { flag: '/Users/me/primary' }, () => '/Users/me/primary/.git/objects\n'))
      .toBe('/Users/me/primary');
  });

  it('falls back to WE_PRIMARY env when no flag', () => {
    expect(resolvePrimaryPath('/clone', { env: '/env/primary' }, noAlt)).toBe('/env/primary');
  });

  it('flag beats env beats alternates (precedence order)', () => {
    expect(resolvePrimaryPath('/clone', { flag: '/flag', env: '/env' }, () => '/alt/.git/objects\n')).toBe('/flag');
    expect(resolvePrimaryPath('/clone', { env: '/env' }, () => '/alt/.git/objects\n')).toBe('/env');
  });

  it('falls back to the git alternates file (the legacy --reference/--shared clone)', () => {
    // alternates points at <primary>/.git/objects → resolves up two levels to <primary>.
    expect(resolvePrimaryPath('/clone', {}, () => '/Users/me/primary/.git/objects\n')).toBe('/Users/me/primary');
  });

  it('returns null when unlocatable — a --local clone with no flag/env/alternates (the #xwokc1n rot cause)', () => {
    expect(resolvePrimaryPath('/clone', {}, noAlt)).toBeNull();
  });

  it('a bare --primary (true, no value) is ignored, not coerced to a path', () => {
    expect(resolvePrimaryPath('/clone', { flag: true }, noAlt)).toBeNull();
    expect(resolvePrimaryPath('/clone', { flag: '  ' }, noAlt)).toBeNull(); // whitespace-only too
  });

  it('a RELATIVE --primary/env resolves against the passed cwd, not process.cwd()', () => {
    expect(resolvePrimaryPath('/work/clone', { flag: '../primary' }, noAlt)).toBe('/work/primary');
    expect(resolvePrimaryPath('/work/clone', { env: './peer' }, noAlt)).toBe('/work/clone/peer');
    expect(resolvePrimaryPath('/work/clone', { flag: '/abs/primary' }, noAlt)).toBe('/abs/primary'); // absolute unaffected
  });
});

describe('syncPrimaryOnLand — post-land primary ff-sync decision (#xwokc1n, PR #202 review)', () => {
  // Fake git spawner: records calls, cans output by `args.join(' ')`, or throws.
  const fakeGit = (script = {}) => {
    const calls = [];
    const exec = (args) => {
      const key = args.join(' ');
      calls.push(key);
      const h = script[key];
      if (h && h.throw) throw new Error(h.throw);
      return h && 'stdout' in h ? h.stdout : '';
    };
    return { exec, calls, pulled: () => calls.some((k) => k.includes(' pull ')) };
  };
  const P = '/Users/me/primary';
  const onMain = { [`-C ${P} rev-parse --abbrev-ref HEAD`]: { stdout: 'main' } };

  it('a clean tracked tree → pure `git pull --ff-only`, synced', () => {
    const g = fakeGit({ ...onMain, [`-C ${P} status --porcelain --untracked-files=no`]: { stdout: '' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r).toMatchObject({ synced: true });
    expect(g.calls).toContain(`-C ${P} pull --ff-only`);
    expect(g.calls.some((k) => k.includes('--autostash'))).toBe(false); // NEVER autostash
  });

  it('UNTRACKED-only cruft does NOT block the sync (the PR #202 fix) — status uses --untracked-files=no', () => {
    // With --untracked-files=no the porcelain output is empty even though scratch files exist → sync proceeds.
    const g = fakeGit({ ...onMain, [`-C ${P} status --porcelain --untracked-files=no`]: { stdout: '' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r.synced).toBe(true);
    expect(g.calls).toContain(`-C ${P} status --porcelain --untracked-files=no`); // the guard is untracked-blind
  });

  it('TRACKED uncommitted work → skipped UNTOUCHED (no autostash, no pull), loud', () => {
    const g = fakeGit({ ...onMain, [`-C ${P} status --porcelain --untracked-files=no`]: { stdout: ' M scripts/x.mjs' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r).toMatchObject({ synced: false, reason: 'dirty', warn: true });
    expect(g.pulled()).toBe(false);
  });

  it('running FROM the primary (isCwd true) → benign quiet skip, no git touched', () => {
    const g = fakeGit(onMain);
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P, isCwd: () => true });
    expect(r).toMatchObject({ synced: false, reason: 'from-primary', warn: false });
    expect(g.calls).toHaveLength(0);
  });

  it('unlocatable WITH a --primary/env hint → loud (a typo worth shouting about)', () => {
    const r = syncPrimaryOnLand({ exec: () => '', primary: null, hinted: true });
    expect(r).toMatchObject({ synced: false, reason: 'not-located', warn: true });
  });

  it('unlocatable WITHOUT a hint → quiet (cwd is the primary, already synced — no --primary nag)', () => {
    const r = syncPrimaryOnLand({ exec: () => '', primary: null, hinted: false });
    expect(r).toMatchObject({ synced: false, reason: 'not-located', warn: false });
  });

  it('primary not on main → skipped, loud, reports the branch', () => {
    const g = fakeGit({ [`-C ${P} rev-parse --abbrev-ref HEAD`]: { stdout: 'lane/x' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r).toMatchObject({ synced: false, reason: 'not-on-main', warn: true, branch: 'lane/x' });
    expect(g.pulled()).toBe(false);
  });

  it('a diverged primary (ff-only pull throws) → skipped, loud, never force-updated', () => {
    const g = fakeGit({ ...onMain, [`-C ${P} status --porcelain --untracked-files=no`]: { stdout: '' }, [`-C ${P} pull --ff-only`]: { throw: 'not possible to fast-forward' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r).toMatchObject({ synced: false, reason: 'diverged', warn: true });
  });

  it('an unreadable primary (rev-parse throws) → not-a-repo, loud', () => {
    const g = fakeGit({ [`-C ${P} rev-parse --abbrev-ref HEAD`]: { throw: 'not a git repo' } });
    const r = syncPrimaryOnLand({ exec: g.exec, primary: P });
    expect(r).toMatchObject({ synced: false, reason: 'not-a-repo', warn: true });
  });
});

describe('resyncDetachedCwdForLand (#2348 — a lane clone\'s detached HEAD stranded JIT numbering/regen on a stale tree)', () => {
  // Same capturing fake-exec shape as regenDerivedOnLand's tests above.
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      calls.push({ cmd, args, opts, key: `${cmd} ${args.join(' ')}` });
      const h = script[`${cmd} ${args.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      return h && 'stdout' in h ? h.stdout : '';
    };
    return { exec, calls };
  };
  const SYMREF = 'git symbolic-ref -q HEAD';
  const STATUS = 'git status --porcelain --untracked-files=no';
  const ANCESTOR = 'git merge-base --is-ancestor HEAD origin/main';
  const detachedClean = { [SYMREF]: { throw: 'not a symbolic ref' }, [STATUS]: { stdout: '' } };

  it('not landedLocal → no-op, no git touched', () => {
    const { exec, calls } = fakeExec();
    const r = resyncDetachedCwdForLand({ exec, landedLocal: false, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'not-applicable' });
    expect(calls.length).toBe(0);
  });

  it('already localSynced (the primary, attached branch pull already worked) → no-op, no git touched', () => {
    const { exec, calls } = fakeExec();
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: true });
    expect(r).toMatchObject({ resynced: false, skipped: 'not-applicable' });
    expect(calls.length).toBe(0);
  });

  it('ATTACHED branch (symbolic-ref succeeds) but pull still failed (a real divergence) → left untouched, never detached', () => {
    const { exec, calls } = fakeExec({ [SYMREF]: { stdout: 'refs/heads/main' } });
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'attached' });
    expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false); // the primary's own main is NEVER detached
  });

  it('DETACHED + clean tracked tree + HEAD already an ancestor → fetch + is-ancestor + checkout --detach, resynced', () => {
    const { exec, calls } = fakeExec(detachedClean);
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: true });
    expect(calls.some((c) => c.key === 'git fetch origin main --quiet')).toBe(true);
    expect(calls.some((c) => c.key === ANCESTOR)).toBe(true);
    expect(calls.some((c) => c.key === 'git checkout --detach origin/main --quiet')).toBe(true);
  });

  it('DETACHED + UNTRACKED-only cruft does NOT block the resync (mirrors syncPrimaryOnLand\'s PR #202 fix)', () => {
    const { exec } = fakeExec(detachedClean); // --untracked-files=no already excludes it
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r.resynced).toBe(true);
  });

  it('DETACHED + TRACKED local changes → skipped dirty, never resets a dirty tree', () => {
    const { exec, calls } = fakeExec({ [SYMREF]: { throw: 'not a symbolic ref' }, [STATUS]: { stdout: ' M scripts/x.mjs' } });
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'dirty' });
    expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'fetch')).toBe(false); // never even fetches a tree it won't touch
  });

  it('DETACHED + clean tree but the fetch itself fails → reported, never thrown, never checks out', () => {
    const { exec, calls } = fakeExec({ ...detachedClean, 'git fetch origin main --quiet': { throw: 'network unreachable' } });
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'exec-failed' });
    expect(r.detail).toMatch(/network unreachable/);
    expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
  });

  // #2348 review — a lane clone can carry MORE local commits than the couple this pass just landed (e.g. a
  // session already committed a second item's work in the same clone before pushing it). Detaching onto
  // origin/main in that state would silently ORPHAN those unpushed commits (reflog-only). Verified live
  // against this very lane during the review: `git merge-base --is-ancestor HEAD origin/main` on a clone
  // carrying an unpushed resolve commit exits 1 — exactly the case this guard exists to catch.
  it('DETACHED + clean tree but HEAD is NOT an ancestor of origin/main (unpushed local commits) → skipped, never detaches', () => {
    const { exec, calls } = fakeExec({ ...detachedClean, [ANCESTOR]: { throw: 'exit 1' } });
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'unpublished-commits' });
    expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false); // never orphans the unpushed commit(s)
  });

  it('DETACHED + clean tree, HEAD ancestor OK, but the checkout itself fails → reported, never thrown', () => {
    const { exec } = fakeExec({ ...detachedClean, 'git checkout --detach origin/main --quiet': { throw: 'would overwrite local changes' } });
    const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
    expect(r).toMatchObject({ resynced: false, skipped: 'exec-failed' });
    expect(r.detail).toMatch(/would overwrite/);
  });
});

describe('drain reason comment (#2313 — stamp park/skip reasons onto the PR, not only the log)', () => {
  it('buildDrainReasonComment prefixes a kind-specific marker the dedupe check can find', () => {
    const body = buildDrainReasonComment('park', 'blast-radius (scripts/foo.mjs)');
    expect(body.startsWith(drainReasonMarker('park'))).toBe(true);
    expect(body).toContain('blast-radius (scripts/foo.mjs)');
    expect(body).toContain('Parked for review');
  });

  it('skip comments use a distinct marker from park comments', () => {
    expect(drainReasonMarker('skip')).not.toBe(drainReasonMarker('park'));
    const body = buildDrainReasonComment('skip', 'not mergeable (mergeable=CONFLICTING)');
    expect(body.startsWith(drainReasonMarker('skip'))).toBe(true);
    expect(body).toContain('Skipped by the drain');
  });

  it('hasDrainReasonComment finds an identical prior post (dedup — a --watch loop never reposts unchanged)', () => {
    const reason = 'required check "test" is not green';
    const comments = [{ body: buildDrainReasonComment('skip', reason) }];
    expect(hasDrainReasonComment(comments, 'skip', reason)).toBe(true);
  });

  it('hasDrainReasonComment is false when the reason text changed (posts fresh)', () => {
    const comments = [{ body: buildDrainReasonComment('skip', 'not mergeable (mergeable=CONFLICTING)') }];
    expect(hasDrainReasonComment(comments, 'skip', 'required check "test" is not green')).toBe(false);
  });

  it('hasDrainReasonComment is false across kinds (a park comment does not dedupe a skip comment)', () => {
    const reason = 'escalated — awaiting an independent review (review:pending)';
    const comments = [{ body: buildDrainReasonComment('park', reason) }];
    expect(hasDrainReasonComment(comments, 'skip', reason)).toBe(false);
  });

  it('xnsk54v — an audit line is appended to the comment and threads through the dedupe (tamper-evidence)', () => {
    const reason = 'escalated — awaiting an independent review (review:pending)';
    const auditA = 'manifest acted-on: dismissedFindings=3 crossRepo=true blockedBy=[]';
    const auditB = 'manifest acted-on: dismissedFindings=0 crossRepo=false blockedBy=[]'; // a post-review body edit
    const body = buildDrainReasonComment('park', reason, auditA);
    expect(body).toContain(reason);
    expect(body).toContain(auditA);
    // Same reason + same acted-on values → dedupe hit (idempotent; a --watch loop never reposts unchanged).
    expect(hasDrainReasonComment([{ body }], 'park', reason, auditA)).toBe(true);
    // Same reason but a CHANGED acted-on value → NO dedupe → a fresh, separately-timestamped comment posts.
    expect(hasDrainReasonComment([{ body }], 'park', reason, auditB)).toBe(false);
  });

  it('xnsk54v — omitting the audit line is backward-compatible (orphan/impl PR comments are unchanged)', () => {
    const reason = 'not mergeable (mergeable=CONFLICTING)';
    const withNoAudit = buildDrainReasonComment('skip', reason);
    expect(withNoAudit).toBe(buildDrainReasonComment('skip', reason, undefined));
    expect(withNoAudit).not.toContain('manifest acted-on:');
    // A no-audit prior post still dedupes a no-audit re-post.
    expect(hasDrainReasonComment([{ body: withNoAudit }], 'skip', reason)).toBe(true);
  });

  it("xnsk54v land-path — the 'land' kind records the acted-on values BEFORE a merge (closes the attack-success gap)", () => {
    // The park/skip paths only fire when the drain does NOT merge, so they record nothing in the attack's
    // SUCCESS state (dismissedFindings edited DOWN so the PR LANDS). The 'land' comment fires just before the
    // merge on a manifest-carrying PR, so a landed PR always carries a durable record of what the drain acted on.
    const reason = 'landing — recording the acted-on manifest escalation values before merge';
    const auditActed = 'manifest acted-on: dismissedFindings=0 crossRepo=false blockedBy=[]'; // the tampered-down value the drain actually acted on
    const body = buildDrainReasonComment('land', reason, auditActed);
    expect(body).toContain('drain-land-reason'); // its own marker kind, distinct from park/skip
    expect(body).toContain('Landed by the drain');
    expect(body).toContain(reason);
    expect(body).toContain(auditActed);
    // Idempotent: a --watch re-pass over the same land value dedupes (no duplicate record).
    expect(hasDrainReasonComment([{ body }], 'land', reason, auditActed)).toBe(true);
    // A land marker never collides with a park/skip marker of the same text.
    expect(hasDrainReasonComment([{ body }], 'park', reason, auditActed)).toBe(false);
    expect(hasDrainReasonComment([{ body }], 'skip', reason, auditActed)).toBe(false);
    // A CHANGED acted-on value posts a fresh, separately-timestamped land record (the tamper trail).
    const auditOther = 'manifest acted-on: dismissedFindings=3 crossRepo=true blockedBy=[]';
    expect(hasDrainReasonComment([{ body }], 'land', reason, auditOther)).toBe(false);
  });

  it('hasDrainReasonComment tolerates a missing/odd comments array', () => {
    expect(hasDrainReasonComment(undefined, 'skip', 'x')).toBe(false);
    expect(hasDrainReasonComment([{}, { body: null }], 'skip', 'x')).toBe(false);
  });

  it('#2333 shouldPostParkReasonComment — an agent-reviewable park stamps a comment; a review:human park does NOT', () => {
    // Non-human (agent-reviewable) park → the #2313 park comment fires.
    expect(shouldPostParkReasonComment({ humanRequired: false })).toBe(true);
    expect(shouldPostParkReasonComment({})).toBe(true); // absent flag defaults to agent-reviewable
    // review:human park → NO park comment (the #2324 body-block already states the same reason — no dup).
    expect(shouldPostParkReasonComment({ humanRequired: true })).toBe(false);
  });
});
