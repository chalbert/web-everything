/**
 * @file scripts/__tests__/merge-ai-prs.test.mjs
 * @description Proof of the pure classifier in `scripts/merge-ai-prs.mjs` — the `/merge` sweep that lands
 *   OPEN AI-generated PRs (orphans the queue-scoped drain never touches). The gh calls are the I/O boundary;
 *   the merge/skip verdict (AI-gate + green-gate + mergeable-gate) is decided here and unit-tested.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isAiAuthor, isAiCommit, isAiGeneratedPr, isMechanicalMergeCommit, isRequiredCheckGreen, isRequiredCheckFailed, hasLabel, classifyPr, planLabelDrain, joinImplToCouples, parseWatchOpts, decideDrainLeaseGate, pickRunningBatches, readBatchFeed, decideBatchesIdleExit, isRebaseDropCandidate, needsManifestStripBeforeMerge, isStackedWeCoupleHalf, shouldRepollForLabelLag, shouldLabelOnGreen, resolveRepos, siblingCloneName, regenDerivedOnLand, resolvePrimaryPath, syncPrimaryOnLand, resyncDetachedCwdForLand, parseNumstat, computeNetDiffChangedFiles, computeNetDiffText, drainReasonMarker, buildDrainReasonComment, hasDrainReasonComment, shouldPostParkReasonComment, LAND_REASON, CI_LIFECYCLE_LABELS, CI_LIFECYCLE_LABEL_META, lifecycleLabelFromCiTruth, planCiLifecycleLabelUpdate, remoteManifestApiArgs, collectFlagOccurrences, parseNoReviewEscalation, applyEscalationRelief, matchesOnlyTarget, mapWithConcurrency, fetchPrReadsCached, isDegradedOpenPrListing, OPEN_PR_LIST_LIMIT } from '../merge-ai-prs.mjs';
import { scoreEscalation, decideReviewGate, REVIEW_LABELS } from '../lib/review-escalation.mjs';

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

  it('MERGES a human-cleared parked PR (review:accepted) even with a non-AI commit and NO ready-to-merge label — the drain-rebase stranding fix (#2196/#2326)', () => {
    // The shape #745 hit: a review:accepted PR whose only non-AI commit is the drain's own `drain: rebase …`.
    const v = classifyPr(aiPr({ ...mixedCommits, labels: [{ name: REVIEW_LABELS.accepted }] }));
    expect(v.decision).toBe('merge');
    expect(v.aiGenerated).toBe(false);  // truthfully NOT every-commit-AI…
    expect(v.certifyLabel).toBe(false); // …and NOT ready-to-merge-labelled…
    expect(v.humanCleared).toBe(true);  // …but the human clear certifies it
    expect(v.reason).toMatch(/human-cleared/);
  });

  it('an un-accepted mixed-authorship PR (review:pending, not accepted) still SKIPS — the clear must be a human accept', () => {
    const v = classifyPr(aiPr({ ...mixedCommits, labels: [{ name: 'review:pending' }] }));
    expect(v.decision).toBe('skip');
    expect(v.humanCleared).toBe(false);
    expect(v.reason).toMatch(/not human-cleared/);
  });

  it('a human-cleared PR still SKIPS on a red required check (accept is not a rubber stamp)', () => {
    const v = classifyPr(aiPr({ ...mixedCommits, labels: [{ name: REVIEW_LABELS.accepted }], statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] }));
    expect(v.decision).toBe('skip');
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

describe('merge-ai-prs — #2820 hold-integrity: an unsatisfied review hold blocks merge regardless of ready-to-merge', () => {
  const rtm = { name: 'ready-to-merge' };
  // An otherwise-perfectly-landable PR (AI, green, cleanly mergeable, real body, ready-to-merge): the ONLY
  // variable across these cases is the review label, so a `skip` proves the hold is what refused it — nothing else.
  const readyPr = (labels) => aiPr({ labels });

  it('SKIPS ready-to-merge + review:changes — the exact WE #956 state (the hold that must hold)', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.changes }]));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
    expect(v.certifyLabel).toBe(true);            // ready-to-merge IS present — proves the AND, not an OR
    expect(v.reason).toMatch(/unsatisfied review hold/);
    expect(v.reason).toMatch(/review:changes/);
    expect(v.reason).toMatch(/#2820/);
  });

  it('SKIPS review:human + ready-to-merge — a human-only gate is never cleared by ready-to-merge', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.human }]));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
    expect(v.reason).toMatch(/unsatisfied review hold/);
    expect(v.reason).toMatch(/review:human/);
  });

  it('SKIPS review:pending + ready-to-merge (not relieved) — an owed independent review still holds', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.pending }]));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
    expect(v.reason).toMatch(/review:pending/);
  });

  it('MERGES ready-to-merge + review:accepted — a satisfied review clears the hold', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.accepted }]));
    expect(v.decision).toBe('merge');
    expect(v.reviewHeld).toBe(false);
    expect(v.reason).toMatch(/producer-certified/);
  });

  it('MERGES ready-to-merge alone (no review label at all) — unchanged pre-#2820 behaviour', () => {
    const v = classifyPr(readyPr([rtm]));
    expect(v.decision).toBe('merge');
    expect(v.reviewHeld).toBe(false);
  });

  it('review:accepted WINS over a coexisting review:changes (matches decideReviewGate: the reviewer verdict wins)', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }]));
    expect(v.decision).toBe('merge');
    expect(v.reviewHeld).toBe(false);
  });

  it('allowPendingReview (the #2423 per-PR relief valve) waives review:pending to a merge…', () => {
    const v = classifyPr(readyPr([rtm, { name: REVIEW_LABELS.pending }]), { allowPendingReview: true });
    expect(v.decision).toBe('merge');
    expect(v.reviewHeld).toBe(false);
  });

  it('…but relief NEVER waives review:changes or review:human (still held even when relieved)', () => {
    expect(classifyPr(readyPr([rtm, { name: REVIEW_LABELS.changes }]), { allowPendingReview: true }).decision).toBe('skip');
    expect(classifyPr(readyPr([rtm, { name: REVIEW_LABELS.human }]), { allowPendingReview: true }).decision).toBe('skip');
  });

  it('the hold refuses even a certified-via-AI PR carrying review:changes but NO ready-to-merge label', () => {
    // AI-generated (every commit AI ⇒ certified without a label), green, mergeable — only the hold stops it.
    const v = classifyPr(aiPr({ labels: [{ name: REVIEW_LABELS.changes }] }));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
    expect(v.reason).toMatch(/unsatisfied review hold/);
  });

  // #2820-review-fix (finding 3) — `reviewHeld` means the hold is the SOLE blocker: it is true ONLY on an
  // otherwise-landable PR. A PR that is ALSO red / unmergeable / bodyless keeps its more actionable reason and is
  // NOT reviewHeld, so it never leaks into the passes gated on reviewHeld (the escalation pass, the id-collision
  // heal). The hold is checked LAST — a hard AND on ready-to-merge still (no held PR ever reaches `merge`), but
  // the more-actionable skip reason wins when several blockers are true at once.
  it('a red-CI PR carrying review:changes is NOT reviewHeld — the CI reason wins over the hold (finding 3)', () => {
    const v = classifyPr(aiPr({ statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }], labels: [rtm, { name: REVIEW_LABELS.changes }] }));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(false);                 // NOT the operative blocker → never enters the downstream passes
    expect(v.reason).toMatch(/required check "test" is not green/);
    expect(v.reason).not.toMatch(/unsatisfied review hold/);
  });

  it('a CONFLICTING PR carrying review:human is NOT reviewHeld — the mergeability reason wins (finding 3)', () => {
    const v = classifyPr(aiPr({ mergeable: 'CONFLICTING', labels: [rtm, { name: REVIEW_LABELS.human }] }));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(false);
    expect(v.reason).toMatch(/not mergeable/);
  });

  it('a bodyless PR carrying review:pending is NOT reviewHeld — the empty-description reason wins (finding 3)', () => {
    const v = classifyPr(aiPr({ body: '   ', labels: [rtm, { name: REVIEW_LABELS.pending }] }));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(false);
    expect(v.reason).toMatch(/empty\/whitespace description/);
  });
});

// #2820-review-fix (finding 2) — decideReviewGate's DEAD ZONE: review:pending had no branch, so a PR whose fresh
// score de-escalated (rebase below threshold, or a best-effort signal miss) fell through to `!escalate` → merge.
// Combined with classifyPr's hold-skip that stranded the PR: skipped every pass AND absent from parked. The fix
// makes review:pending sticky on the LABEL (mirroring the #2362 human-sticky gate) — it parks agent-reviewable.
describe('merge-ai-prs — #2820-review-fix (finding 2): review:pending is sticky, never the merge dead zone', () => {
  it('a de-escalated review:pending PR PARKS agent-reviewable, not merge', () => {
    const g = decideReviewGate({ escalate: false, humanRequired: false, labels: [{ name: REVIEW_LABELS.pending }] });
    expect(g.action).toBe('park');
    expect(g.applyLabel).toBe(REVIEW_LABELS.pending);
    expect(g.humanRequired).toBe(false);
  });

  it('the per-PR relief valve still frees that exact pending park (the escape hatch is intact)', () => {
    const g = decideReviewGate({ escalate: false, humanRequired: false, labels: [{ name: REVIEW_LABELS.pending }] });
    expect(applyEscalationRelief(g, { relieved: true }).waive).toBe(true);
  });

  it('a real verdict still wins over the sticky pending: review:changes → wait-author, review:human → park human', () => {
    expect(decideReviewGate({ escalate: false, labels: [{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.changes }] }).action).toBe('wait-author');
    expect(decideReviewGate({ escalate: false, labels: [{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.human }] }).humanRequired).toBe(true);
    expect(decideReviewGate({ escalate: false, labels: [{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }] }).action).toBe('merge');
  });

  it('no review label + de-escalated still merges — the fix is a no-op for the common path', () => {
    expect(decideReviewGate({ escalate: false, labels: [] }).action).toBe('merge');
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

  // #2388 — hash-keyed items (JIT numbering, #2288) must not collapse into a single `Number(hash) === NaN`
  // bucket: a bare `Number()` coercion makes every hash item indistinguishable (`NaN === NaN` under Set's
  // SameValueZero equality), so a hash blockedBy edge would spuriously match ANY other open hash item.
  it('a hash-keyed blockedBy DEFERS while its blocker is open, then FREES once the blocker leaves the set', () => {
    const deferredPass = planLabelDrain([cand(2, 'x5lail9', ['xiea3rt']), cand(1, 'xiea3rt', [])]);
    expect(deferredPass.ready.map((c) => c.num)).toEqual([1]);
    expect(deferredPass.deferred).toEqual([{ num: 2, item: 'x5lail9', waitOn: ['xiea3rt'] }]);

    // the caller's cascade removes a merged item between passes (mirrors the real for(;;) loop) — freeing it.
    const freedPass = planLabelDrain([cand(2, 'x5lail9', ['xiea3rt'])]);
    expect(freedPass.ready.map((c) => c.num)).toEqual([2]);
    expect(freedPass.deferred).toEqual([]);
  });

  it('two DISTINCT hash items are never conflated into one NaN bucket', () => {
    // #2 is blockedBy a hash (#xuj0wtn) that is NOT the OTHER open hash item (#xiea3rt) — a `Number()`
    // coercion would make both blockedBy/openItems entries collapse to `NaN`, so #2 would wrongly defer on
    // #xiea3rt even though its real blocker is absent from the candidate set (already landed).
    const { ready, deferred } = planLabelDrain([cand(2, 'x5lail9', ['xuj0wtn']), cand(1, 'xiea3rt', [])]);
    expect(ready.map((c) => c.num)).toEqual([1, 2]); // both ready: #2's actual blocker isn't in play
    expect(deferred).toEqual([]);
  });

  it('sorts numeric items by number, and hash items after every numbered item (tie-break by PR#)', () => {
    const { ready } = planLabelDrain([cand(3, 'xuj0wtn'), cand(2, 2201), cand(4, 'xiea3rt'), cand(1, 2199)]);
    expect(ready.map((c) => c.num)).toEqual([1, 2, 3, 4]); // 2199, 2201, then hashes by PR# (3 before 4)
  });
});

describe('merge-ai-prs — #2683 matchesOnlyTarget (the --only fast-drain repo-scoped target)', () => {
  it('number mismatch never matches', () => {
    expect(matchesOnlyTarget({ prNumber: 9, onlyPr: '12', repo: null, onlyRepo: null, isLocal: true, repoCount: 1 })).toBe(false);
  });
  it('--only-repo scopes to that exact repo (pr-watch sibling-PR case)', () => {
    expect(matchesOnlyTarget({ prNumber: 12, onlyPr: '12', repo: 'o/frontierui', onlyRepo: 'o/frontierui', isLocal: false, repoCount: 3 })).toBe(true);
    expect(matchesOnlyTarget({ prNumber: 12, onlyPr: '12', repo: 'o/plateau-app', onlyRepo: 'o/frontierui', isLocal: false, repoCount: 3 })).toBe(false);
  });
  it('legacy /pr: --this-repo (repoCount 1, cwd repo) matches without --only-repo', () => {
    expect(matchesOnlyTarget({ prNumber: 12, onlyPr: '12', repo: null, onlyRepo: null, isLocal: true, repoCount: 1 })).toBe(true);
  });
  it('legacy /finish REMOTE lane: --repos=<remoteslug> (repoCount 1, non-local) STILL matches (regression guard)', () => {
    // /finish fires `--only=42 --repos=chalbert/frontierui` with NO --only-repo; a local-only default would have
    // filtered the remote target out and merged nothing.
    expect(matchesOnlyTarget({ prNumber: 42, onlyPr: '42', repo: 'chalbert/frontierui', onlyRepo: null, isLocal: false, repoCount: 1 })).toBe(true);
  });
  it('multi-repo default sweep, no --only-repo → disambiguate to the LOCAL repo only', () => {
    expect(matchesOnlyTarget({ prNumber: 12, onlyPr: '12', repo: 'o/web-everything', onlyRepo: null, isLocal: true, repoCount: 3 })).toBe(true);
    expect(matchesOnlyTarget({ prNumber: 12, onlyPr: '12', repo: 'o/frontierui', onlyRepo: null, isLocal: false, repoCount: 3 })).toBe(false);
  });
});

describe('merge-ai-prs — #2683 extraOpenItems (the --only fast drain orders like the full sweep)', () => {
  const cand = (num, item, blockedBy = [], decision = 'merge') => ({ num, item, blockedBy, decision });
  const sc = (num, item, stackParents = [], { blockedBy = [] } = {}) => ({ num, item, blockedBy, stackParents, decision: 'merge' });

  it('DEFERS a narrowed --only target whose blockedBy sibling is open ONLY via extraOpenItems', () => {
    // The fast-drain candidate list is narrowed to the target (#2 → item 2200 blockedBy 2199); the blocker 2199
    // is NOT in the candidate set. Without extraOpenItems it reads as landed and the target lands EARLY (the AC1
    // bug); feeding the sibling's still-open item in defers it — never landed ahead of its dependency.
    const early = planLabelDrain([cand(2, 2200, [2199])]);
    expect(early.ready.map((c) => c.num)).toEqual([2]); // the pre-#2683 hole: lands early

    const gated = planLabelDrain([cand(2, 2200, [2199])], { extraOpenItems: [2199] });
    expect(gated.ready).toEqual([]);
    expect(gated.deferred).toEqual([{ num: 2, item: 2200, waitOn: [2199] }]);
  });

  it('FREES the target once its blocker is no longer an open sibling (blocker landed)', () => {
    const freed = planLabelDrain([cand(2, 2200, [2199])], { extraOpenItems: [1234] }); // 2199 not open anymore
    expect(freed.ready.map((c) => c.num)).toEqual([2]);
  });

  it('a stackParent that is a still-open sibling defers the --only target via extraOpenItems', () => {
    // A numeric stackParent absent from the candidate set would read as landed (proof source 4); listing it as an
    // open sibling in extraOpenItems flips it back to "still open → defer" (proof source 2).
    const gated = planLabelDrain([sc(5, 'xchild0', [2201])], { extraOpenItems: [2201] });
    expect(gated.ready).toEqual([]);
    expect(gated.deferred).toEqual([{ num: 5, item: 'xchild0', waitOn: [2201] }]);
  });

  it('extraOpenItems tolerates a Set, hash ids, and null entries', () => {
    const gated = planLabelDrain([cand(2, 'x5lail9', ['xiea3rt'])], { extraOpenItems: new Set(['xiea3rt', null]) });
    expect(gated.deferred).toEqual([{ num: 2, item: 'x5lail9', waitOn: ['xiea3rt'] }]);
  });
});

// #xq985wu — DECOUPLE the drain's merge-ORDERING from the `ready-to-merge` label scope. Ordering must derive
// from the FULL open-PR item set (the label-blind `collectOpenPrContext` set), NOT the `--label`-scoped
// candidate list. This is the prerequisite that makes #984/#2832's strip of `ready-to-merge` from a held PR
// SAFE: once stripped, the held PR drops out of the `--label`-scoped `verdicts`, so if ordering derived only
// from that list a dependent `blockedBy` the held item would resolve the edge as "landed" and land EARLY.
describe('merge-ai-prs — #xq985wu decouple merge-ordering from the ready-to-merge label scope', () => {
  const cand = (num, item, blockedBy = [], decision = 'merge') => ({ num, item, blockedBy, decision });

  // AC1 — decoupled ordering. On a FULL sweep, #984 strips `ready-to-merge` from a held blocker, so it is
  // ABSENT from the `--label`-scoped candidate list — yet it is STILL an open PR, so its item rides in via
  // `extraOpenItems` (the label-blind full-open set). The dependent must DEFER against that membership.
  it('AC1: a dependent DEFERS on a held blocker that is absent from the candidate list but present in extraOpenItems (the #984 strip)', () => {
    // candidate list = only the dependent (#2 → item 2200 blockedBy 2199); the held blocker 2199 was stripped
    // of `ready-to-merge` so it is NOT a candidate. Its item is fed via the label-blind open-PR set.
    const gated = planLabelDrain([cand(2, 2200, [2199])], { extraOpenItems: new Set([2199, 2200]) });
    expect(gated.ready).toEqual([]);
    expect(gated.deferred).toEqual([{ num: 2, item: 2200, waitOn: [2199] }]);
  });

  it('AC1 mirror: the SAME dependent is READY once the blocker is absent from BOTH the candidate list AND extraOpenItems (truly landed)', () => {
    // Proves the defer above comes from open-SET membership, not from nothing: drop 2199 from the open set and
    // the dependent frees. (The extraOpenItems still carries the dependent's OWN item 2200, but that is already
    // in `openItems` via the candidate-seeding line — the redundancy is harmless because the dependent has no
    // self-`blockedBy` edge; a genuine self-`blockedBy` would be a PERMANENT self-defer, not a no-op, and is
    // rejected upstream by check-standards.mjs / check-backlog-item.mjs.)
    const freed = planLabelDrain([cand(2, 2200, [2199])], { extraOpenItems: new Set([2200]) });
    expect(freed.ready.map((c) => c.num)).toEqual([2]);
    expect(freed.deferred).toEqual([]);
  });

  // AC2 — superset safety / no regression. A FULL candidate list plus a superset `extraOpenItems` (containing
  // extra UNRELATED open items) yields the SAME ready/deferred partition as feeding no extra set at all for the
  // non-held items. Extra open items only add a defer for an edge that points AT them — never drop one.
  it('AC2: a superset extraOpenItems produces the SAME partition as today for non-held items (only ADDs defers, never drops one)', () => {
    const list = [cand(2, 2200, [2199]), cand(1, 2199, []), cand(3, 2205, [])];
    const baseline = planLabelDrain(list); // today's full-sweep behaviour (extraOpenItems null)
    // superset = the candidate items PLUS unrelated open items no edge points at.
    const withSuperset = planLabelDrain(list, { extraOpenItems: new Set([2199, 2200, 2205, 9998, 9999]) });
    expect(withSuperset.ready.map((c) => c.num)).toEqual(baseline.ready.map((c) => c.num));
    expect(withSuperset.deferred).toEqual(baseline.deferred);
    // and the concrete partition is unchanged: the blocker (#1) + the disjoint sibling (#3) land; #2 defers.
    expect(withSuperset.ready.map((c) => c.num)).toEqual([1, 3]);
    expect(withSuperset.deferred).toEqual([{ num: 2, item: 2200, waitOn: [2199] }]);
  });

  // AC3 — the wiring. `orderExtraOpenItems` is sourced from the label-blind full-open context (`openPrContext`)
  // on EVERY pass, no longer conditioned on `onlyPr`. This is a source-contract assertion (mirrors the existing
  // #2409 add-first/remove-last source check): the observable seam is a single top-level assignment.
  it('AC3: orderExtraOpenItems is sourced from openPrContext.openItems and NOT gated on onlyPr', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');
    const m = src.match(/const orderExtraOpenItems = (.+);/);
    expect(m).not.toBeNull(); // the assignment is present
    const rhs = m[1];
    expect(rhs).toContain('openPrContext.openItems'); // sourced from the label-blind full-open set
    expect(rhs).not.toContain('onlyPr'); // NOT conditioned on the --only fast-drain flag
  });
});

// #999 / xq985wu review — the LIVENESS regression the one-liner introduced. Decoupling ordering onto the
// FROZEN full-open superset (`orderExtraOpenItems`, snapshot BEFORE any merge, never updated) is only safe if
// the `blockedBy` path honours a proven-landed item the SAME way `stackParents` already does. Before the fix
// `blockWait` consulted `openItems` ONLY, so an item that was landed THIS pass (`landedThisPass`) or proven on
// main in a prior session (`provenOnMain`) but still present in the frozen `openItems` kept deferring its
// dependents forever. These are the CAPTURED PREVENTIONS (contract tests at the seam where the bug lives).
describe('merge-ai-prs — #999/xq985wu liveness: blockWait honors landed-proof (F1/F2)', () => {
  const cand = (num, item, blockedBy = [], decision = 'merge') => ({ num, item, blockedBy, decision });

  // F1 — the in-pass cascade must free a `blockedBy` dependent the SAME pass its blocker lands. `landedThisPass`
  // carries the just-merged blocker; the frozen `extraOpenItems` superset still names both. Before the fix the
  // dependent deferred (one-link-per-pass); after, it is ready — mirroring `stackProven`'s landedThisPass-first
  // precedence. This is the asymmetry the review caught: `stackParents` checked landedThisPass BEFORE openItems,
  // `blockedBy` never did.
  it('F1: a dependent whose blocker landed THIS pass is READY even while the frozen superset still names it', () => {
    const plan = planLabelDrain([cand(2, 200, [100])], { landedThisPass: new Set([100]), extraOpenItems: new Set([100, 200]) });
    expect(plan.ready.map((c) => c.num)).toEqual([2]);
    expect(plan.deferred).toEqual([]);
  });

  // F2 — a stale/abandoned/draft/human/impl-half PR still NAMING a LANDED item keeps it in `openItems` forever.
  // `provenOnMain` (the `bornAs`-on-main proof, already wired into `stackParents`) must also clear a `blockedBy`
  // edge: an item present in BOTH `extraOpenItems` and `provenOnMain` is landed, so the dependent is READY.
  it('F2: an item in BOTH extraOpenItems and provenOnMain is proven landed → dependent READY, not deferred', () => {
    const plan = planLabelDrain([cand(2, 200, [100])], { provenOnMain: new Set([100]), extraOpenItems: new Set([100, 200]) });
    expect(plan.ready.map((c) => c.num)).toEqual([2]);
    expect(plan.deferred).toEqual([]);
  });

  // F2 negative control — a blocker that is open and has NO landed-proof still defers (the fix must not read
  // absence-of-proof as landed; it only clears the edge on POSITIVE proof, mirroring the stowaway guard).
  it('F2 control: an open blocker with no landed-proof still DEFERS the dependent', () => {
    const plan = planLabelDrain([cand(2, 200, [100])], { extraOpenItems: new Set([100, 200]) });
    expect(plan.ready).toEqual([]);
    expect(plan.deferred).toEqual([{ num: 2, item: 200, waitOn: [100] }]);
  });

  // Cascade-level test — the seam NO original AC touched. Faithfully simulates the real cascade's freeing
  // bookkeeping (scripts/merge-ai-prs.mjs ~2321-2409): re-plan with the SAME frozen `extraOpenItems` superset
  // each inner iteration, and on each "merge" add the item to `landedThisPass` + drop it from `remaining` — the
  // ONLY thing stubbed is the `gh pr merge` write. Before the fix A lands but B never frees within the pass
  // (one-link-per-pass, deferred non-empty at fixed-point); after, BOTH land in one pass, deferred empty.
  it('Cascade: A(ready) + B(blockedBy[A]) BOTH land in one pass, not one-link-per-pass', () => {
    const A = cand(1, 100, []);
    const B = cand(2, 200, [100]);
    // The frozen superset the cascade passes UNCHANGED across inner iterations (snapshot before any merge).
    const extraOpenItems = new Set([100, 200]);
    const landedThisPass = new Set();
    let remaining = [A, B].map((v) => ({ ...v }));
    const merged = [];
    let lastDeferred = [];
    // mirrors the real `for (;;)` cascade loop + its per-merge bookkeeping
    for (let guard = 0; guard < 10; guard++) {
      const plan = planLabelDrain(remaining, { landedThisPass, extraOpenItems });
      lastDeferred = plan.deferred;
      if (!plan.ready.length) break;
      for (const c of plan.ready) {
        merged.push(c.num);
        landedThisPass.add(c.item); // real cascade: landedThisPass.add(asItemId(c.item)) on a WE-carrier merge
        remaining = remaining.filter((x) => x.num !== c.num);
      }
    }
    expect(merged.sort((a, b) => a - b)).toEqual([1, 2]); // both landed
    expect(lastDeferred).toEqual([]); // nothing left deferred at the fixed point
    expect(remaining).toEqual([]); // the dependent did NOT survive to a second pass
  });
});

// #999 / xq985wu F3 — the `--limit` on `collectOpenPrContext`'s per-repo listing is now a MERGE-SAFETY input:
// that listing is the sole ordering source on a full sweep, so a SILENTLY truncated page (newest-first) drops
// the OLDEST open PRs — exactly the long-lived held blockers — and a dependent then reads the missing edge as
// landed and merges EARLY. A full page (`count >= limit`) must be flagged DEGRADED, not silently trusted.
describe('merge-ai-prs — #999/xq985wu F3 truncated open-PR listing is flagged degraded', () => {
  it('a listing at exactly the cap is degraded; below the cap is not', () => {
    expect(isDegradedOpenPrListing(OPEN_PR_LIST_LIMIT, OPEN_PR_LIST_LIMIT)).toBe(true); // full page → truncation possible
    expect(isDegradedOpenPrListing(OPEN_PR_LIST_LIMIT + 5, OPEN_PR_LIST_LIMIT)).toBe(true); // over-full (defensive)
    expect(isDegradedOpenPrListing(OPEN_PR_LIST_LIMIT - 1, OPEN_PR_LIST_LIMIT)).toBe(false); // room to spare → complete
    expect(isDegradedOpenPrListing(0, OPEN_PR_LIST_LIMIT)).toBe(false);
  });
  it('the cap was raised off the old silent 100 (raising alone does not retire the class; the flag does)', () => {
    expect(OPEN_PR_LIST_LIMIT).toBeGreaterThan(100);
  });
});

describe('merge-ai-prs — #2393 proof-of-land stackParents gate (planLabelDrain)', () => {
  // a candidate that may carry stackParents (the overlap-stack edge) alongside its blockedBy edge.
  const sc = (num, item, stackParents = [], { blockedBy = [], decision = 'merge' } = {}) => ({ num, item, blockedBy, stackParents, decision });

  it('a chain lands IN ORDER: the child defers while its parent is open, then frees once the parent is proven landed this pass', () => {
    // child (#2 stackParents [parent]) + parent (#1). Pass 1: parent open ⇒ child NOT proven ⇒ deferred.
    const p1 = planLabelDrain([sc(2, 'xchild0', ['xparen0']), sc(1, 'xparen0', [])]);
    expect(p1.ready.map((c) => c.num)).toEqual([1]);
    expect(p1.deferred).toEqual([{ num: 2, item: 'xchild0', waitOn: ['xparen0'] }]);

    // the caller merged the parent's WE carrier this pass (adds it to landedThisPass) + removed it from the set.
    const p2 = planLabelDrain([sc(2, 'xchild0', ['xparen0'])], { landedThisPass: new Set(['xparen0']) });
    expect(p2.ready.map((c) => c.num)).toEqual([2]);
    expect(p2.deferred).toEqual([]);
  });

  it('a RED/ABSENT parent DEFERS its descendants (positive proof — absence is NEVER read as landed)', () => {
    // parent (#1) is red (decision:skip) so it stays open + NEVER enters landedThisPass. The child (#2) must
    // NOT land past it — even though a bare blockedBy-style "absent ⇒ landed" would wrongly free it.
    const red = planLabelDrain([sc(2, 'xchild0', ['xparen0']), sc(1, 'xparen0', [], { decision: 'skip' })]);
    expect(red.ready).toEqual([]);
    expect(red.deferred.map((d) => d.num)).toEqual([2]);

    // a parent that is entirely ABSENT from the candidate set and has NO bornAs proof is likewise NOT proven —
    // a provisional hash we cannot positively prove landed defers the descendant (the stowaway guard).
    const absent = planLabelDrain([sc(5, 'xchild0', ['xghost0'])]);
    expect(absent.ready).toEqual([]);
    expect(absent.deferred).toEqual([{ num: 5, item: 'xchild0', waitOn: ['xghost0'] }]);
  });

  it('a parent bornAs-proven on main (provenOnMain) frees the child even when absent from the candidate set', () => {
    const { ready, deferred } = planLabelDrain([sc(5, 'xchild0', ['xparen0'])], { provenOnMain: new Set(['xparen0']) });
    expect(ready.map((c) => c.num)).toEqual([5]);
    expect(deferred).toEqual([]);
  });

  it('a NUMERIC stackParent absent from the candidate set is already-landed (a number only exists post-land)', () => {
    // #2288 JIT numbering assigns a NNN only at land, so a numeric stackParent not in play is landed ⇒ ready.
    const { ready } = planLabelDrain([sc(5, 'xchild0', [2199])]);
    expect(ready.map((c) => c.num)).toEqual([5]);
  });

  it('a DISJOINT sibling (no stackParents) is UNAFFECTED — degrades to the legacy ready sweep', () => {
    const { ready, deferred } = planLabelDrain([sc(3, 'xsib000', []), sc(1, 'xother0', [])]);
    expect(ready.map((c) => c.num).sort()).toEqual([1, 3]);
    expect(deferred).toEqual([]);
  });

  it('both gates compose: a candidate blocked on BOTH an open blockedBy and an unproven stackParent lists both waitOn', () => {
    const { deferred } = planLabelDrain([
      sc(3, 'xdep000', ['xstk000'], { blockedBy: ['xblk000'] }),
      sc(1, 'xblk000', []),
      sc(2, 'xstk000', []),
    ]);
    const d = deferred.find((x) => x.num === 3);
    expect(d.waitOn.sort()).toEqual(['xblk000', 'xstk000']);
  });
});

describe('merge-ai-prs — #2393 impl-PR→WE-manifest laneRef join (joinImplToCouples)', () => {
  // a WE carrier (its own manifest) + its couple's lane refs; and a manifest-less impl PR keyed by headRef.
  const we = (num, item, { blockedBy = [], stackParents = [], refs = [] } = {}) =>
    ({ num, repo: null, headRef: `lane/${item}`, hasManifest: true, manifestRefs: refs, item, blockedBy, stackParents });
  const impl = (num, headRef) => ({ num, repo: 'chalbert/frontierui', headRef, hasManifest: false, item: null, blockedBy: [], stackParents: [] });

  it('a manifest-less impl PR INHERITS its couple item + blockedBy + stackParents (closes the impl-orphan-always-ready hole)', () => {
    const couple = we(10, 'xitem00', { blockedBy: ['xblk000'], stackParents: ['xpar000'], refs: ['lane/xitem00', 'lane/xitem00-fui'] });
    const implPr = impl(20, 'lane/xitem00-fui');
    joinImplToCouples([couple, implPr]);
    expect(implPr.item).toBe('xitem00');
    expect(implPr.blockedBy).toEqual(['xblk000']);
    expect(implPr.stackParents).toEqual(['xpar000']);
    expect(implPr.joinedToCouple).toBe('xitem00');
  });

  it('once joined, the impl PR is GATED WITH its couple — it defers whenever the couple defers (no stowaway at the impl level)', () => {
    const couple = we(10, 'xitem00', { stackParents: ['xpar000'], refs: ['lane/xitem00-fui'] });
    const implPr = impl(20, 'lane/xitem00-fui');
    const verdicts = joinImplToCouples([couple, implPr]).map((v) => ({ ...v, decision: 'merge' }));
    // parent unproven ⇒ BOTH the WE couple and its impl PR defer together.
    const { ready, deferred } = planLabelDrain(verdicts);
    expect(ready).toEqual([]);
    expect(deferred.map((d) => d.num).sort()).toEqual([10, 20]);
  });

  it('a TRUE orphan (a headRef in no couple manifest) stays an always-ready orphan — the bare /merge sweep is unchanged', () => {
    const orphan = impl(30, 'lane/unrelated');
    joinImplToCouples([we(10, 'xitem00', { refs: ['lane/xitem00'] }), orphan]);
    expect(orphan.item).toBeNull();
    expect(orphan.joinedToCouple).toBeUndefined();
    expect(planLabelDrain([{ ...orphan, decision: 'merge' }]).ready.map((c) => c.num)).toEqual([30]);
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

describe('merge-ai-prs — decideDrainLeaseGate (#2449 always-on whole-process lease; #2391/#2424/#2443)', () => {
  const free = { held: false, stale: false, owner: null };
  const heldBy = (owner) => ({ held: true, stale: false, owner, heartbeatAt: 'now' });
  const staleOf = (owner) => ({ held: false, stale: true, owner, heartbeatAt: 'old' });

  it('a free lease → acquire, for one-shot and watch alike (no mode input — the gate is mode-agnostic)', () => {
    expect(decideDrainLeaseGate({ status: free }).action).toBe('acquire');
  });

  it('a STALE lease → acquire (the atomic reserve reclaims it — a crashed drain never wedges the queue)', () => {
    expect(decideDrainLeaseGate({ status: staleOf('mac:1:drain') }).action).toBe('acquire');
  });

  it('a LIVE foreign holder → noop surfacing the holder (#2424: the second full drain no-ops, never races)', () => {
    const g = decideDrainLeaseGate({ status: heldBy('mac:99:drain') });
    expect(g.action).toBe('noop');
    expect(g.heldBy).toBe('mac:99:drain');
  });

  it('--only single-PR fast drain BYPASSES the lease (numbering mutex suffices — /pr and /finish stay instant next to a resident daemon)', () => {
    expect(decideDrainLeaseGate({ onlyPr: '12', status: heldBy('mac:99:drain') }).action).toBe('bypass');
  });

  it('--dry-run BYPASSES (merges nothing; a resident daemon must never block a plan read)', () => {
    expect(decideDrainLeaseGate({ dryRun: true, status: heldBy('mac:99:drain') }).action).toBe('bypass');
  });

  it('--no-drain-lease escape hatch BYPASSES', () => {
    expect(decideDrainLeaseGate({ noLease: true, status: heldBy('mac:99:drain') }).action).toBe('bypass');
  });

  it('--under-lease matching the LIVE holder → under-lease (a daemon child pass runs without acquiring)', () => {
    const g = decideDrainLeaseGate({ underLease: 'mac:7:daemon', status: heldBy('mac:7:daemon') });
    expect(g.action).toBe('under-lease');
  });

  it('--under-lease whose declared holder is GONE (free/stale/other) → noop, fail-safe (#2449: an orphaned child never drains unleased)', () => {
    expect(decideDrainLeaseGate({ underLease: 'mac:7:daemon', status: free }).action).toBe('noop');
    expect(decideDrainLeaseGate({ underLease: 'mac:7:daemon', status: staleOf('mac:7:daemon') }).action).toBe('noop');
    expect(decideDrainLeaseGate({ underLease: 'mac:7:daemon', status: heldBy('mac:99:drain') }).action).toBe('noop');
  });

  it('bypass precedence: dry-run > only > no-lease reasons are distinct (operator-visible why)', () => {
    expect(decideDrainLeaseGate({ dryRun: true, onlyPr: '3', status: free }).reason).toBe('dry-run');
    expect(decideDrainLeaseGate({ onlyPr: '3', noLease: true, status: free }).reason).toBe('single-pr-fast-drain');
    expect(decideDrainLeaseGate({ noLease: true, status: free }).reason).toBe('no-drain-lease');
  });
});

describe('merge-ai-prs — decideDrainLeaseGate REPO-SCOPE awareness (#2458)', () => {
  const heldScoped = (owner, scope) => ({ held: true, stale: false, owner, heartbeatAt: 'now', scope });

  it('holder scope UNKNOWN (legacy/unscoped lease) → conservative no-op, never a false-negative land (preserves pre-#2458)', () => {
    const g = decideDrainLeaseGate({ repos: ['o/we'], status: { held: true, stale: false, owner: 'mac:9:drain', scope: null } });
    expect(g).toMatchObject({ action: 'noop', reason: 'lease-held', heldBy: 'mac:9:drain' });
  });

  it('this run has NO scope input → conservative no-op (cannot prove disjointness → assume covered)', () => {
    expect(decideDrainLeaseGate({ repos: [], status: heldScoped('mac:9:drain', ['o/we']) }).reason).toBe('lease-held');
    expect(decideDrainLeaseGate({ status: heldScoped('mac:9:drain', ['o/we']) }).reason).toBe('lease-held');
  });

  it('this run ⊆ holder scope → honest no-op (the holder genuinely covers this work)', () => {
    const g = decideDrainLeaseGate({ repos: ['o/we'], status: heldScoped('mac:9:drain', ['o/we', 'o/frontierui', 'o/plateau-app']) });
    expect(g).toMatchObject({ action: 'noop', reason: 'lease-held' });
  });

  it('fully DISJOINT scope → HONEST no-op naming the uncovered repos (NOT a lease-less bypass — that would race two same-scope launches under a narrow holder)', () => {
    const g = decideDrainLeaseGate({ repos: ['o/plateau-app'], status: heldScoped('mac:9:drain', ['o/we']) });
    expect(g).toMatchObject({ action: 'noop', reason: 'lease-held-uncovered', heldBy: 'mac:9:drain' });
    expect(g.uncovered).toEqual(['o/plateau-app']); // reported honestly instead of a false "covers this work"
  });

  it('PARTIAL overlap → same honest no-op, reporting the UNCOVERED repos (no false coverage claim; no shared-repo merge race)', () => {
    const g = decideDrainLeaseGate({ repos: ['o/we', 'o/plateau-app'], status: heldScoped('mac:9:drain', ['o/we']) });
    expect(g).toMatchObject({ action: 'noop', reason: 'lease-held-uncovered' });
    expect(g.uncovered).toEqual(['o/plateau-app']); // named so the message can be honest about what is NOT swept
    expect(g.covered).toEqual(['o/we']);
  });

  it('scope comparison is order-independent (both sides may arrive unsorted)', () => {
    const g = decideDrainLeaseGate({ repos: ['o/frontierui', 'o/we'], status: heldScoped('mac:9:drain', ['o/we', 'o/frontierui']) });
    expect(g.reason).toBe('lease-held'); // fully covered regardless of order
  });

  it('scope awareness never overrides the earlier bypass/under-lease branches', () => {
    // A --only fast drain or --dry-run still bypasses even against a disjoint scoped holder (scope check is only for the plain held path).
    expect(decideDrainLeaseGate({ onlyPr: '5', repos: ['o/plateau-app'], status: heldScoped('mac:9:drain', ['o/we']) }).reason).toBe('single-pr-fast-drain');
    expect(decideDrainLeaseGate({ dryRun: true, repos: ['o/plateau-app'], status: heldScoped('mac:9:drain', ['o/we']) }).reason).toBe('dry-run');
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
  it('a human-cleared parked PR (review:accepted) IS labelled on green even with a non-AI commit — the drain-rebase stranding fix (#2196/#2326)', () => {
    expect(shouldLabelOnGreen(aiPr({ commits: [claudeCommit(), humanCommit], labels: [{ name: REVIEW_LABELS.accepted }] }), {})).toBe(true);
  });
  it('a non-AI PR that is NOT human-cleared (review:pending) is still not labelled', () => {
    expect(shouldLabelOnGreen(aiPr({ commits: [claudeCommit(), humanCommit], labels: [{ name: 'review:pending' }] }), {})).toBe(false);
  });
});

describe('isRequiredCheckFailed (#2421 — the ci:failed twin of isRequiredCheckGreen)', () => {
  it('a definitively red conclusion → failed', () => {
    for (const concl of ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']) {
      expect(isRequiredCheckFailed({ statusCheckRollup: [{ name: 'test', conclusion: concl }] })).toBe(true);
    }
  });
  it('a green/pending/absent required check → NOT failed (in-flight, not red)', () => {
    expect(isRequiredCheckFailed(aiPr())).toBe(false); // SUCCESS
    expect(isRequiredCheckFailed({ statusCheckRollup: [{ name: 'test', conclusion: '' }] })).toBe(false); // pending
    expect(isRequiredCheckFailed({ statusCheckRollup: [] })).toBe(false); // not yet reported at all
    expect(isRequiredCheckFailed({ statusCheckRollup: [{ name: 'cla', conclusion: 'FAILURE' }] })).toBe(false); // non-required
  });
});

describe('lifecycleLabelFromCiTruth (#2421/#2281 — the TOTAL ci-lifecycle label function)', () => {
  // The exactly-one invariant: every one of the 8 boolean-input combinations resolves to exactly one of the
  // four ratified states, with `blocked` > `ready-to-merge` > `ci:failed` > `checking` precedence.
  const cases = [
    [{ blocked: false, checkGreen: false, checkFailed: false }, CI_LIFECYCLE_LABELS.checking],
    [{ blocked: false, checkGreen: false, checkFailed: true }, CI_LIFECYCLE_LABELS.failed],
    [{ blocked: false, checkGreen: true, checkFailed: false }, CI_LIFECYCLE_LABELS.ready],
    [{ blocked: false, checkGreen: true, checkFailed: true }, CI_LIFECYCLE_LABELS.ready], // green wins over a stale/contradictory failed signal
    [{ blocked: true, checkGreen: false, checkFailed: false }, CI_LIFECYCLE_LABELS.blocked],
    [{ blocked: true, checkGreen: false, checkFailed: true }, CI_LIFECYCLE_LABELS.blocked], // blocked wins over failed
    [{ blocked: true, checkGreen: true, checkFailed: false }, CI_LIFECYCLE_LABELS.blocked], // blocked wins over green — still ordering-gated
    [{ blocked: true, checkGreen: true, checkFailed: true }, CI_LIFECYCLE_LABELS.blocked],
  ];
  it.each(cases)('%o → %s', (input, expected) => {
    const result = lifecycleLabelFromCiTruth(input);
    expect(result).toBe(expected);
    expect(Object.values(CI_LIFECYCLE_LABELS)).toContain(result); // always one of the 4 ratified states
  });
  it('defaults to checking with no input (never throws, never a 5th state)', () => {
    expect(lifecycleLabelFromCiTruth()).toBe(CI_LIFECYCLE_LABELS.checking);
  });
  it('the two NEW labels carry provisioning metadata; ready-to-merge is deliberately NOT re-minted here', () => {
    expect(CI_LIFECYCLE_LABEL_META[CI_LIFECYCLE_LABELS.checking]).toBeTruthy();
    expect(CI_LIFECYCLE_LABEL_META[CI_LIFECYCLE_LABELS.failed]).toBeTruthy();
    expect(CI_LIFECYCLE_LABEL_META[CI_LIFECYCLE_LABELS.blocked]).toBeTruthy();
    expect(CI_LIFECYCLE_LABEL_META[CI_LIFECYCLE_LABELS.ready]).toBeUndefined();
  });
});

describe('planCiLifecycleLabelUpdate (#2421 — the label add/remove plan enforcing exactly-one-of-owned)', () => {
  it('no current labels, desired owned → add only that one', () => {
    expect(planCiLifecycleLabelUpdate({ currentLabels: [], desired: 'checking' })).toEqual({ toAdd: ['checking'], toRemove: [] });
  });
  it('a stale sibling label present → removed when the state moves on', () => {
    const plan = planCiLifecycleLabelUpdate({ currentLabels: [{ name: 'checking' }], desired: 'ci:failed' });
    expect(plan.toAdd).toEqual(['ci:failed']);
    expect(plan.toRemove).toEqual(['checking']);
  });
  it('already exactly correct → no-op', () => {
    expect(planCiLifecycleLabelUpdate({ currentLabels: [{ name: 'blocked' }], desired: 'blocked' })).toEqual({ toAdd: [], toRemove: [] });
  });
  it('desired is OUTSIDE `owned` (e.g. ready-to-merge, scoped out of the CLI wiring) → never added, but owned siblings still clear', () => {
    const owned = [CI_LIFECYCLE_LABELS.checking, CI_LIFECYCLE_LABELS.failed, CI_LIFECYCLE_LABELS.blocked];
    const plan = planCiLifecycleLabelUpdate({ currentLabels: [{ name: 'checking' }], desired: 'ready-to-merge', owned });
    expect(plan.toAdd).toEqual([]); // ready-to-merge is never touched by this scoped caller
    expect(plan.toRemove).toEqual(['checking']); // but the stale checking label still sheds
  });
  it('scoped owned + nothing stale present + desired outside owned → true no-op', () => {
    const owned = [CI_LIFECYCLE_LABELS.checking, CI_LIFECYCLE_LABELS.failed, CI_LIFECYCLE_LABELS.blocked];
    expect(planCiLifecycleLabelUpdate({ currentLabels: [{ name: 'ready-to-merge' }], desired: 'ready-to-merge', owned })).toEqual({ toAdd: [], toRemove: [] });
  });
  it('tolerates string-shaped labels too (hasLabel\'s own tolerance)', () => {
    expect(planCiLifecycleLabelUpdate({ currentLabels: ['checking'], desired: 'ci:failed' })).toEqual({ toAdd: ['ci:failed'], toRemove: ['checking'] });
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

describe('#2684 — isStackedWeCoupleHalf (which manifest PRs get the couple re-CI regime tag)', () => {
  const SHA_A = 'a'.repeat(40);

  it('recognises a stacked WE couple half (manifest + cross-repo + a base sha)', () => {
    expect(isStackedWeCoupleHalf({ num: 1, hasManifest: true, crossRepo: true, base: SHA_A })).toBe(true);
  });
  it('a WE half opened off main (no base sha) is NOT stacked → untagged, unchanged path', () => {
    expect(isStackedWeCoupleHalf({ hasManifest: true, crossRepo: true, base: undefined })).toBe(false);
  });
  it('a single-locus (non-crossRepo) manifest PR is not a stacked couple half', () => {
    expect(isStackedWeCoupleHalf({ hasManifest: true, crossRepo: false, base: SHA_A })).toBe(false);
  });
  it('a manifest-less orphan / impl PR is not a stacked couple half', () => {
    expect(isStackedWeCoupleHalf({ hasManifest: false, crossRepo: true, base: SHA_A })).toBe(false);
  });
  it('an invalid base sha is rejected (never trusted as a stack base)', () => {
    expect(isStackedWeCoupleHalf({ hasManifest: true, crossRepo: true, base: 'not-a-sha' })).toBe(false);
  });
  it('a null/undefined candidate is safely not-stacked', () => {
    expect(isStackedWeCoupleHalf(null)).toBe(false);
    expect(isStackedWeCoupleHalf(undefined)).toBe(false);
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options`. That flag is argv
      // hygiene, not intent: encoding it in every fixture key means adding the guard to one more call site reds
      // 17 unrelated tests and tempts the author to drop the guard instead of the fixtures. The guard has its own
      // dedicated assertion (`guards the git-diff argv…`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
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

  // PR #1031 r4 finding 1 — `candidate` is the caller-supplied refname on the second resolution pass. Verified
  // on git 2.50.1: unguarded, `git diff --numstat <base> '--output=<path>'` exits 0 and WRITES that file. Worse
  // than the write — the swallowed numstat then reads EMPTY while the candidate still resolves, so this reports
  // ZERO blast radius for a PR the lander is about to merge.
  it('guards the git-diff argv with --end-of-options at EVERY position taking a caller-supplied ref', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/x': { stdout: '1\t0\tREADME.md\n' },
      'git diff --numstat a1b2c3d4e5f6 origin/lane/x': { stdout: '1\t0\tREADME.md\n' },
      'git diff origin/main origin/lane/x': { stdout: 'diff --git a/README.md b/README.md\n' },
    });
    computeNetDiffChangedFiles({ exec, rev: 'lane/x', baseRev: 'a1b2c3d4e5f6', fetchExtraRefs: ['lane/x'] });
    computeNetDiffText({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    const diffs = calls.filter((c) => c.args[0] === 'diff');
    expect(diffs.length, 'no git diff calls made — the assertion would pass vacuously').toBeGreaterThan(2);
    for (const c of diffs) {
      const g = c.args.indexOf('--end-of-options');
      expect(g, `unguarded git diff argv: ${c.args.join(' ')}`).toBeGreaterThan(-1);
      const firstRef = c.args.findIndex((a, i) => i > 0 && !a.startsWith('-'));
      expect(g, `guard must PRECEDE the refs: ${c.args.join(' ')}`).toBeLessThan(firstRef);
    }
  });

  it('fetches BASE with an EXPLICIT destination refspec (never a bare `git fetch <remote> <base>`, which relies on the opportunistic tracking-ref update)', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(calls.some((c) => c.args[0] === 'fetch' && c.args.includes('origin') && c.args.includes('+main:refs/remotes/origin/main'))).toBe(true);
  });

  it('diffs `<remote>/<base>` against `rev` directly (a plain two-tree comparison, content-only) and parses via parseNumstat', () => {
    const { exec } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' } });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 4, scored: true, humanBasisFiles: ['scripts/pr-land.mjs'] });
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
    expect(r).toEqual({ changedFiles: ['README.md'], diffLines: 1, scored: true, humanBasisFiles: ['README.md'] });
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
    expect(r).toEqual({ changedFiles: ['scripts/merge-ai-prs.mjs'], diffLines: 4, scored: true, humanBasisFiles: ['scripts/merge-ai-prs.mjs'] });
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
    expect(r).toEqual({ changedFiles: ['scripts/merge-ai-prs.mjs'], diffLines: 4, scored: true, humanBasisFiles: ['scripts/merge-ai-prs.mjs'] });
    expect(calls.filter((c) => c.args[0] === 'diff').length).toBe(1);
  });

  it('#2373-review-r2 — PRODUCER path (`rev` is a resolved local SHA): `<remote>/<sha>` is an invalid ref that fails fast, then the bare SHA resolves — one extra cheap failed git call, no behavior change', () => {
    const { exec, calls } = fakeExec({
      // `origin/deadbeef` is NOT stubbed → the fake throws (unknown revision), mirroring real git on an invalid ref.
      'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' }); // producer: no fetchExtraRefs
    expect(r).toEqual({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 4, scored: true, humanBasisFiles: ['scripts/pr-land.mjs'] });
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
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('#2373-review — FETCH_HEAD is never a diff candidate, with OR without fetchExtraRefs (it always points at `<remote>/<base>` → a spurious empty base-vs-base diff)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x' }); // no fetchExtraRefs
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffChangedFiles({})).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffChangedFiles({ exec })).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    expect(calls.length).toBe(0);
  });

  // PR #1031 review, finding 1 — `fetchExtraRefs` carries a branch name straight off the `gh` API, and a
  // dash-leading refname is LEGAL (`git check-ref-format 'refs/heads/--output=/tmp/pwn'` exits 0). Verified on
  // git 2.50.1: the unguarded form EXECUTES an injected `--upload-pack=<script>`, while the guarded form refuses
  // with `invalid refspec`. So the guard must PRECEDE every caller-supplied argv element, not merely be present.
  it('guards the fetch argv with --end-of-options BEFORE any caller-supplied value', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    computeNetDiffChangedFiles({ exec, rev: 'deadbeef', fetchExtraRefs: ['lane/x'] });
    const fetch = calls.find((c) => c.args[0] === 'fetch');
    const guard = fetch.args.indexOf('--end-of-options');
    expect(guard, 'the fetch argv carries no --end-of-options guard').toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fetch.args.indexOf('origin'));
    expect(guard).toBeLessThan(fetch.args.indexOf('lane/x'));
  });

  it('honors a custom remote/base and passes fetchExtraRefs through to the fetch call', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat upstream/release deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    computeNetDiffChangedFiles({ exec, remote: 'upstream', base: 'release', rev: 'deadbeef', fetchExtraRefs: ['lane/x'] });
    expect(calls[0]).toMatchObject({ args: ['fetch', '--quiet', '--end-of-options', 'upstream', '+release:refs/remotes/upstream/release', 'lane/x'] });
  });

  // #2390 — a STACKED lane records the SHA it was cut from (its predecessor's tip) as the manifest per-repo
  // `base`; scoring the SIZE from THAT base de-inflates the lane to its OWN delta, not the cumulative stack vs
  // main. #2390-review-fix — but the human-gate basis (`humanBasisFiles`) stays the cumulative origin/main…head,
  // and the base is trusted for the size de-inflation ONLY when it is a strict ancestor of head.
  it('#2390 — a stacked lane (baseRev = strict-ancestor manifest base) de-inflates SIZE to base…head, but humanBasisFiles stays the cumulative origin/main…head (keeps the ancestor gate-self edit)', () => {
    const { exec, calls } = fakeExec({
      // Cumulative diff INCLUDES an ancestor's gate-self edit; the own delta (from the base) does not.
      'git diff --numstat origin/main origin/lane/child': { stdout: '4\t2\tbacklog/2390-own.md\n2\t0\tscripts/lib/review-escalation.mjs\n' },
      'git diff --numstat a1b2c3d4e5f6 origin/lane/child': { stdout: '4\t2\tbacklog/2390-own.md\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'a1b2c3d4e5f6', fetchExtraRefs: ['lane/child'] });
    expect(r.changedFiles).toEqual(['backlog/2390-own.md']); // SIZE de-inflated to the own delta
    expect(r.diffLines).toBe(6);
    expect(r.scored).toBe(true);
    expect(r.humanBasisFiles).toEqual(['backlog/2390-own.md', 'scripts/lib/review-escalation.mjs']); // cumulative — gate file preserved
    const diffCalls = calls.filter((c) => c.args[0] === 'diff');
    expect(diffCalls.some((c) => c.key === 'git diff --numstat a1b2c3d4e5f6 origin/lane/child')).toBe(true); // own-delta off the base SHA
    expect(diffCalls.some((c) => c.key === 'git diff --numstat origin/main origin/lane/child')).toBe(true); // human basis off origin/main
  });

  it('#2390-review-fix — the base tracking-ref is ALWAYS fetched, even when stacked (the cumulative human-gate basis needs origin/main; a stacked base can never suppress it)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/child': { stdout: '1\t0\tREADME.md\n' },
      'git diff --numstat a1b2c3d4e5f6 origin/lane/child': { stdout: '1\t0\tREADME.md\n' },
    });
    computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'a1b2c3d4e5f6', fetchExtraRefs: ['lane/child'] });
    const fetch = calls.find((c) => c.args[0] === 'fetch');
    expect(fetch.args).toEqual(['fetch', '--quiet', '--end-of-options', 'origin', '+main:refs/remotes/origin/main', 'lane/child']);
  });

  it('#2390 — a malformed (non-hex) baseRev is IGNORED — the origin/main basis serves BOTH size and the human gate, never an injected git arg', () => {
    const { exec, calls } = fakeExec({ 'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' } });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef', baseRev: '--upload-pack=evil' });
    expect(r).toEqual({ changedFiles: ['README.md'], diffLines: 1, scored: true, humanBasisFiles: ['README.md'] });
    expect(calls.some((c) => c.args.includes('--upload-pack=evil'))).toBe(false); // the poison value never reaches git
    expect(calls[0].args).toContain('+main:refs/remotes/origin/main'); // sibling basis restored
  });

  // ── #2390-review-fix — the CORE security guarantees: a self-declared / mis-set base can de-inflate SIZE but
  //    can NEVER narrow or suppress the gate-self / review:human trigger. ────────────────────────────────────
  it('#2390-review-fix — an ANCESTOR policy-core edit that drops out of the own-delta is STILL caught: it rides humanBasisFiles → scoreEscalation humanRequired:true', () => {
    const { exec } = fakeExec({
      // Cumulative origin/main…head carries the ancestor's edit to a policy-tier trust-chain file (the roster).
      'git diff --numstat origin/main origin/lane/child': { stdout: '2\t0\tbacklog/2390-child.md\n5\t1\tscripts/lib/gate-config.mjs\n' },
      // The own delta (base…head) does NOT — the gate-self edit was the ancestor's, before this lane's base.
      'git diff --numstat feedface origin/lane/child': { stdout: '2\t0\tbacklog/2390-child.md\n' },
    });
    const net = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'feedface', fetchExtraRefs: ['lane/child'] });
    expect(net.changedFiles).not.toContain('scripts/lib/gate-config.mjs'); // SIZE de-inflated (the ancestor edit is out)
    expect(net.humanBasisFiles).toContain('scripts/lib/gate-config.mjs'); // but the human gate still sees it
    const score = scoreEscalation({ changedFiles: net.changedFiles, diffLines: net.diffLines, humanBasisFiles: net.humanBasisFiles });
    expect(score.humanRequired).toBe(true); // THE FIX: a policy-core edit forces review:human even from an ancestor
  });

  it('#2390-review-fix — a mis-set base==head is REJECTED (rev-parse equal ⇒ not a strict ancestor): the own-delta falls back to the cumulative basis, so an empty base…head can never silently under-score', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/child': { stdout: '3\t0\tscripts/lib/review-escalation.mjs\n' },
      'git rev-parse cafebabecafe': { stdout: 'cafebabecafe\n' },
      'git rev-parse origin/lane/child': { stdout: 'cafebabecafe\n' }, // head resolves to the SAME sha as base
    });
    const net = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'cafebabecafe', fetchExtraRefs: ['lane/child'] });
    expect(net.changedFiles).toEqual(['scripts/lib/review-escalation.mjs']); // fell back to cumulative — NOT an empty under-score
    expect(net.humanBasisFiles).toEqual(['scripts/lib/review-escalation.mjs']);
    expect(calls.some((c) => c.key === 'git diff --numstat cafebabecafe origin/lane/child')).toBe(false); // own-delta never attempted
    expect(scoreEscalation({ changedFiles: net.changedFiles, diffLines: net.diffLines, humanBasisFiles: net.humanBasisFiles }).humanRequired).toBe(true);
  });

  it('#2390-review-fix — a base that is NOT an ancestor of head is REJECTED (merge-base --is-ancestor non-zero): fall back to the cumulative origin/main basis rather than trust an unrelated-tree base', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/child': { stdout: '2\t0\tbacklog/x.md\n1\t0\tscripts/lib/gate-config.mjs\n' },
      'git merge-base --is-ancestor deadbeefdead origin/lane/child': { throw: 'not an ancestor' },
    });
    const net = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'deadbeefdead', fetchExtraRefs: ['lane/child'] });
    expect(net.changedFiles).toEqual(['backlog/x.md', 'scripts/lib/gate-config.mjs']); // cumulative — a bad base never de-inflates
    expect(calls.some((c) => c.key === 'git diff --numstat deadbeefdead origin/lane/child')).toBe(false); // own-delta never attempted
    expect(scoreEscalation({ changedFiles: net.changedFiles, diffLines: net.diffLines, humanBasisFiles: net.humanBasisFiles }).humanRequired).toBe(true);
  });

  // ── #2404 — twin of #2373: a FRESH base against an UN-REBASED head over-reports (PR #364 repro: a 2-file
  //    docs-only PR scored dozens of "changed" files that were purely upstream-advanced). The diff basis must
  //    be the lane's own fork point (`merge-base(origin/main, head)`), not the base tip directly. ────────────
  it('#2404 — a head BEHIND an advanced base diffs off `merge-base(origin/main, head)`, not the base tip, so upstream-only advances never appear as the PR\'s own changes', () => {
    const { exec, calls } = fakeExec({
      // origin/main has advanced past the lane's fork point with commits touching gate-self files; a bare
      // origin/main..head diff would sweep those in. merge-base finds the true fork point.
      'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint1234\n' },
      'git diff --numstat forkpoint1234 origin/lane/x': { stdout: '2\t0\tbacklog/2404-x.md\n' },
      // Unused if the fix works — proves the cumulative-from-tip basis is NOT what gets diffed.
      'git diff --numstat origin/main origin/lane/x': { stdout: '2\t0\tbacklog/2404-x.md\n15\t58\tscripts/merge-ai-prs.mjs\n6\t13\tscripts/pr-land.mjs\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ changedFiles: ['backlog/2404-x.md'], diffLines: 2, scored: true, humanBasisFiles: ['backlog/2404-x.md'] });
    expect(r.changedFiles).not.toContain('scripts/merge-ai-prs.mjs'); // no false gate-self hit
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main origin/lane/x')).toBe(false); // the tip-basis diff is never attempted
    expect(scoreEscalation({ changedFiles: r.changedFiles, diffLines: r.diffLines, humanBasisFiles: r.humanBasisFiles }).humanRequired).toBe(false);
  });

  it('#2404 — a head already rebased onto origin/main is unaffected: merge-base(origin/main, head) == origin/main, so the diff basis is unchanged', () => {
    const { exec, calls } = fakeExec({
      'git merge-base origin/main deadbeef': { stdout: 'origin/main\n' },
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' }); // producer: `<remote>/<sha>` fails fast first, falls through to the bare SHA (as in the pre-#2404 fallback-chain test)
    expect(r).toEqual({ changedFiles: ['README.md'], diffLines: 1, scored: true, humanBasisFiles: ['README.md'] });
    expect(calls.filter((c) => c.args[0] === 'diff').map((c) => c.key)).toEqual([
      'git diff --numstat origin/main origin/deadbeef', // tried first, fails fast (invalid ref)
      'git diff --numstat origin/main deadbeef', // falls through to the real local SHA, narrowed to the fork point (== origin/main here)
    ]);
  });

  it('#2404 — an unresolvable merge-base (no common history) degrades to the base tip itself — the prior, safe over-scoring behavior, never a scoring failure', () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 4, scored: true, humanBasisFiles: ['scripts/pr-land.mjs'] });
  });

  it('#2404 — the merge-base narrowing benefits `own` too when a lane is ALSO stacked (baseRev): the strict-ancestor own-delta wins over the merge-base cumulative basis, as before', () => {
    const { exec } = fakeExec({
      'git merge-base origin/main origin/lane/child': { stdout: 'forkpoint\n' },
      'git diff --numstat forkpoint origin/lane/child': { stdout: '4\t2\tbacklog/2390-own.md\n2\t0\tscripts/lib/review-escalation.mjs\n' },
      'git diff --numstat a1b2c3d4e5f6 origin/lane/child': { stdout: '4\t2\tbacklog/2390-own.md\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'a1b2c3d4e5f6', fetchExtraRefs: ['lane/child'] });
    expect(r.changedFiles).toEqual(['backlog/2390-own.md']); // SIZE de-inflated via the strict-ancestor baseRev, unchanged
    expect(r.humanBasisFiles).toEqual(['backlog/2390-own.md', 'scripts/lib/review-escalation.mjs']); // cumulative narrowed to the fork point, gate file preserved
  });

  it('#2404-review — a `git merge-base` that prints MULTIPLE lines (criss-cross-merge history, several equally-valid best common ancestors) uses only the FIRST — an embedded newline would otherwise make an invalid single-arg revision', () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { stdout: 'forkpoint1\nforkpoint2\n' },
      'git diff --numstat forkpoint1 deadbeef': { stdout: '1\t0\tREADME.md\n' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ changedFiles: ['README.md'], diffLines: 1, scored: true, humanBasisFiles: ['README.md'] });
  });
});

describe('computeNetDiffText (#2450 — reviewer-facing NET diff TEXT, SAME basis as the score)', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options`. That flag is argv
      // hygiene, not intent: encoding it in every fixture key means adding the guard to one more call site reds
      // 17 unrelated tests and tempts the author to drop the guard instead of the fixtures. The guard has its own
      // dedicated assertion (`guards the git-diff argv…`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      return '';
    };
    return { exec, calls };
  };

  it('shares the #2373/#2404 base resolution: force-fetches the base with an EXPLICIT refspec, then diffs two trees (never checks out the PR branch)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' }, // the shared basis probe
      'git diff origin/main deadbeef': { stdout: 'diff --git a/README.md b/README.md\n@@ text @@\n' },
    });
    const r = computeNetDiffText({ exec, rev: 'deadbeef' });
    expect(r.scored).toBe(true);
    expect(r.text).toContain('diff --git a/README.md');
    expect(r.base).toBe('origin/main');
    expect(r.rev).toBe('deadbeef');
    // exact same fetch refspec computeNetDiffChangedFiles uses — proving ONE shared basis, no drift.
    expect(calls.some((c) => c.args[0] === 'fetch' && c.args.includes('+main:refs/remotes/origin/main'))).toBe(true);
    // #2336 — no checkout/switch of the PR branch, ever.
    expect(calls.some((c) => ['checkout', 'switch'].includes(c.args[0]))).toBe(false);
  });

  it('narrows the LEFT side to the #2404 fork point (merge-base) exactly as the score does, then returns that two-tree diff text', () => {
    const { exec, calls } = fakeExec({
      'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint1234\n' },
      'git diff --numstat forkpoint1234 origin/lane/x': { stdout: '2\t0\tbacklog/2450-x.md\n' },
      'git diff forkpoint1234 origin/lane/x': { stdout: 'diff --git a/backlog/2450-x.md b/backlog/2450-x.md\n' },
    });
    const r = computeNetDiffText({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toMatchObject({ base: 'forkpoint1234', rev: 'origin/lane/x', scored: true });
    expect(r.text).toContain('backlog/2450-x.md');
    // the phantom sibling-lane file only in the three-dot diff is NOT swept in — the tip-basis text is never diffed.
    expect(calls.some((c) => c.key === 'git diff origin/main origin/lane/x')).toBe(false);
  });

  it('degrades to scored:false (no checkout) when neither `<remote>/<rev>` nor the bare `rev` resolves — caller falls back to `gh pr diff`', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffText({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ text: '', base: null, rev: null, scored: false });
    expect(calls.some((c) => ['checkout', 'switch'].includes(c.args[0]))).toBe(false);
  });

  it('degrades to scored:false when the basis resolves but the TEXT diff itself fails (safe fallback, no checkout)', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' }, // basis resolves
      'git diff origin/main deadbeef': { throw: 'diff exploded' }, // but the text diff fails
    });
    const r = computeNetDiffText({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ text: '', base: null, rev: null, scored: false });
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffText({})).toEqual({ text: '', base: null, rev: null, scored: false });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffText({ exec })).toEqual({ text: '', base: null, rev: null, scored: false });
    expect(calls.length).toBe(0);
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options`. That flag is argv
      // hygiene, not intent: encoding it in every fixture key means adding the guard to one more call site reds
      // 17 unrelated tests and tempts the author to drop the guard instead of the fixtures. The guard has its own
      // dedicated assertion (`guards the git-diff argv…`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options`. That flag is argv
      // hygiene, not intent: encoding it in every fixture key means adding the guard to one more call site reds
      // 17 unrelated tests and tempts the author to drop the guard instead of the fixtures. The guard has its own
      // dedicated assertion (`guards the git-diff argv…`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
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

  // #2419 — a lane clone can ALSO be left ATTACHED to a stray `lane/*` branch (a leftover from an earlier
  // rebase-drop / manual checkout), not only genuinely detached. `git pull --ff-only` has no upstream to
  // follow there either, so this widened trigger needs the exact same rescue mechanics — mirrored 1:1 against
  // the DETACHED cases above (#2348).
  describe('#2419 — ATTACHED to a stale lane/* branch (mirrors the DETACHED cases above)', () => {
    const staleLaneClean = { [SYMREF]: { stdout: 'refs/heads/lane/file-2417' }, [STATUS]: { stdout: '' } };

    it('non-lane attached branch (e.g. a feature branch) stays on the existing warn-only path, never detached', () => {
      const { exec, calls } = fakeExec({ [SYMREF]: { stdout: 'refs/heads/feature/foo' } });
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: false, skipped: 'attached' });
      expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
    });

    it('ATTACHED to a stale lane/* branch + clean tracked tree + HEAD already an ancestor → fetch + is-ancestor + checkout --detach, resynced', () => {
      const { exec, calls } = fakeExec(staleLaneClean);
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: true });
      expect(calls.some((c) => c.key === 'git fetch origin main --quiet')).toBe(true);
      expect(calls.some((c) => c.key === ANCESTOR)).toBe(true);
      expect(calls.some((c) => c.key === 'git checkout --detach origin/main --quiet')).toBe(true);
    });

    it('ATTACHED to a stale lane/* branch + TRACKED local changes → skipped dirty, never resets a dirty tree', () => {
      const { exec, calls } = fakeExec({ [SYMREF]: { stdout: 'refs/heads/lane/file-2417' }, [STATUS]: { stdout: ' M scripts/x.mjs' } });
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: false, skipped: 'dirty' });
      expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
      expect(calls.some((c) => c.args[0] === 'fetch')).toBe(false);
    });

    it('ATTACHED to a stale lane/* branch but the fetch itself fails → reported, never thrown, never checks out', () => {
      const { exec, calls } = fakeExec({ ...staleLaneClean, 'git fetch origin main --quiet': { throw: 'network unreachable' } });
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: false, skipped: 'exec-failed' });
      expect(r.detail).toMatch(/network unreachable/);
      expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
    });

    it('ATTACHED to a stale lane/* branch but HEAD is NOT an ancestor of origin/main (unpushed local commits) → skipped, never detaches', () => {
      const { exec, calls } = fakeExec({ ...staleLaneClean, [ANCESTOR]: { throw: 'exit 1' } });
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: false, skipped: 'unpublished-commits' });
      expect(calls.some((c) => c.args[0] === 'checkout')).toBe(false);
    });

    it('ATTACHED to a stale lane/* branch, HEAD ancestor OK, but the checkout itself fails → reported, never thrown', () => {
      const { exec } = fakeExec({ ...staleLaneClean, 'git checkout --detach origin/main --quiet': { throw: 'would overwrite local changes' } });
      const r = resyncDetachedCwdForLand({ exec, landedLocal: true, localSynced: false });
      expect(r).toMatchObject({ resynced: false, skipped: 'exec-failed' });
      expect(r.detail).toMatch(/would overwrite/);
    });
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
    const reason = LAND_REASON; // the exported const the land path posts — kept in one place, no drift
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

  it('#2399 remoteManifestApiArgs — GET is explicit, so an -f/--field param never silently switches gh api to POST', () => {
    const args = remoteManifestApiArgs('chalbert/plateau-app', 'lane/x-2343');
    // GET must be explicit and precede the endpoint (a POST to the read-only contents endpoint 404s).
    expect(args).toContain('--method');
    expect(args[args.indexOf('--method') + 1]).toBe('GET');
    expect(args).toContain('repos/chalbert/plateau-app/contents/.lane-manifest.json');
    expect(args).toEqual(expect.arrayContaining(['-f', 'ref=lane/x-2343']));
  });
});

describe('#2423 per-PR --no-review-escalation relief valve', () => {
  describe('collectFlagOccurrences — reads a REPEATABLE flag the last-write-wins flags object would drop', () => {
    it('collects every valued occurrence in order (not just the last)', () => {
      expect(collectFlagOccurrences(['--no-review-escalation=12', '--no-review-escalation=34'], 'no-review-escalation'))
        .toEqual(['12', '34']);
    });
    it('a BARE occurrence is recorded as true; a valued one as its raw string', () => {
      expect(collectFlagOccurrences(['--no-review-escalation', '--no-review-escalation=5'], 'no-review-escalation'))
        .toEqual([true, '5']);
    });
    it('ignores unrelated flags and a prefix that is not an exact match', () => {
      expect(collectFlagOccurrences(['--label=x', '--no-review-escalation-else=9'], 'no-review-escalation')).toEqual([]);
      expect(collectFlagOccurrences([], 'no-review-escalation')).toEqual([]);
      expect(collectFlagOccurrences(undefined, 'no-review-escalation')).toEqual([]);
    });
  });

  describe('parseNoReviewEscalation — repeatable + comma-separated; bare → passWide', () => {
    it('parses repeatable occurrences into { passWide:false, prs:[...] }', () => {
      expect(parseNoReviewEscalation(['--no-review-escalation=12', '--no-review-escalation=34']))
        .toEqual({ passWide: false, prs: [12, 34] });
    });
    it('parses a comma-separated value (and a mix of repeatable + comma)', () => {
      expect(parseNoReviewEscalation(['--no-review-escalation=12,34']))
        .toEqual({ passWide: false, prs: [12, 34] });
      expect(parseNoReviewEscalation(['--no-review-escalation=12,34', '--no-review-escalation=56']))
        .toEqual({ passWide: false, prs: [12, 34, 56] });
    });
    it('a BARE --no-review-escalation → passWide (the legacy pass-wide waiver), no prs', () => {
      expect(parseNoReviewEscalation(['--no-review-escalation'])).toEqual({ passWide: true, prs: [] });
      expect(parseNoReviewEscalation(['--no-review-escalation='])).toEqual({ passWide: true, prs: [] }); // empty value → bare
    });
    it('tolerates #-prefixed and padded numbers; drops non-numeric/≤0; de-dupes', () => {
      expect(parseNoReviewEscalation(['--no-review-escalation= #12 , 34 ,x, 0 ,12']))
        .toEqual({ passWide: false, prs: [12, 34] });
    });
    it('no flag at all → neither pass-wide nor any relieved PR', () => {
      expect(parseNoReviewEscalation(['--label=ready-to-merge'])).toEqual({ passWide: false, prs: [] });
    });
  });

  describe('applyEscalationRelief — waives ONLY an agent-reviewable review:pending park', () => {
    // The FRESH gate verdicts a candidate can carry this pass (from decideReviewGate).
    const pendingPark = decideReviewGate({ escalate: true, humanRequired: false, labels: [] });   // review:pending
    const humanPark = decideReviewGate({ escalate: true, humanRequired: true, labels: [] });      // review:human
    const changes = decideReviewGate({ escalate: true, labels: [{ name: REVIEW_LABELS.changes }] }); // wait-author

    it('relieved + agent-reviewable review:pending park → WAIVED to a merge', () => {
      expect(pendingPark.applyLabel).toBe(REVIEW_LABELS.pending);
      expect(applyEscalationRelief(pendingPark, { relieved: true }).waive).toBe(true);
    });
    it('the override REFUSES review:human (human-only, never waivable — #2285)', () => {
      expect(humanPark.applyLabel).toBe(REVIEW_LABELS.human);
      expect(applyEscalationRelief(humanPark, { relieved: true }).waive).toBe(false);
    });
    it('the override REFUSES review:changes (reviewer rejected → wait-author)', () => {
      expect(changes.action).toBe('wait-author');
      expect(applyEscalationRelief(changes, { relieved: true }).waive).toBe(false);
    });
    it('a NON-relieved review:pending park is untouched (still parks)', () => {
      expect(applyEscalationRelief(pendingPark, { relieved: false }).waive).toBe(false);
    });
    it('a gate that already says merge is never touched (nothing to waive)', () => {
      const mergeGate = decideReviewGate({ escalate: false, labels: [] });
      expect(applyEscalationRelief(mergeGate, { relieved: true }).waive).toBe(false);
    });
    it('#2409 — a STALE-acceptance re-park is NEVER waived, even though it carries review:pending', () => {
      // The head advanced past the reviewed SHA → decideReviewGate re-parks review:pending WITH staleAcceptance.
      // The pending-relief valve must refuse it: "review never arrived" and "head moved past review" are
      // different concerns, and only the former is waivable.
      const stalePark = decideReviewGate({ escalate: true, humanRequired: false, labels: [{ name: REVIEW_LABELS.accepted }], acceptedSha: 'aaaaaaa', headSha: 'bbbbbbb' });
      expect(stalePark.applyLabel).toBe(REVIEW_LABELS.pending); // looks like a pending park…
      expect(stalePark.staleAcceptance).toBe(true);             // …but it is the #2409 outcome
      expect(applyEscalationRelief(stalePark, { relieved: true }).waive).toBe(false);
    });
  });

  describe('a scoped =<pr#> relieves ONE PR while the rest of the pass stays gated', () => {
    // Faithful mini of runCli's per-candidate escalation loop (merge-ai-prs.mjs, the `if (REVIEW_ESCALATION)`
    // block): score → decideReviewGate → applyEscalationRelief. A waived candidate stays 'merge'; an unrelieved
    // park/wait-author skips. REVIEW_ESCALATION is ON here (a scoped =<pr#> keeps `passWide` false).
    const runPass = (candidates, argv) => {
      const { passWide, prs } = parseNoReviewEscalation(argv);
      expect(passWide).toBe(false); // a scoped run must NOT turn the rubric off pass-wide
      return candidates.map((c) => {
        const gate = decideReviewGate({ escalate: c.escalate, humanRequired: c.humanRequired, labels: c.labels || [] });
        const relief = applyEscalationRelief(gate, { relieved: prs.includes(c.num) });
        const decision = relief.waive ? 'merge' : (gate.action === 'park' || gate.action === 'wait-author' ? 'skip' : 'merge');
        return { num: c.num, decision, applyLabel: gate.applyLabel, humanRequired: gate.humanRequired, waived: relief.waive };
      });
    };

    it('the relieved review:pending PR merges while a fresh gate-self PR IN THE SAME PASS still parks review:human', () => {
      // #396 is a stuck agent-reviewable review:pending park; #401 is a fresh gate-self diff (humanRequired).
      const out = runPass(
        [
          { num: 396, escalate: true, humanRequired: false },  // agent-reviewable → review:pending
          { num: 401, escalate: true, humanRequired: true },   // gate-self → review:human
        ],
        ['--label=ready-to-merge', '--no-review-escalation=396'],
      );
      const p396 = out.find((o) => o.num === 396);
      const p401 = out.find((o) => o.num === 401);
      // the named PR is relieved → merges on allowPending semantics…
      expect(p396.decision).toBe('merge');
      expect(p396.waived).toBe(true);
      // …but the OTHER candidate's rubric stayed LIVE — the fresh gate-self PR still parks review:human.
      expect(p401.decision).toBe('skip');
      expect(p401.waived).toBe(false);
      expect(p401.applyLabel).toBe(REVIEW_LABELS.human);
    });

    it('naming a gate-self PR does NOT relieve it — review:human is never waivable', () => {
      const out = runPass(
        [{ num: 401, escalate: true, humanRequired: true }],
        ['--label=ready-to-merge', '--no-review-escalation=401'],
      );
      expect(out[0].decision).toBe('skip');
      expect(out[0].waived).toBe(false);
      expect(out[0].applyLabel).toBe(REVIEW_LABELS.human);
    });
  });
});

describe('#2409 — the stale re-park label swap is ADD-FIRST / REMOVE-LAST', () => {
  // The re-park swap lives in runCli's imperative park branch: it shells `gh pr edit` to apply the re-park
  // label AND to drop the now-stale review:accepted. BOTH calls are best-effort (errors swallowed), so ORDER
  // is the safety property — the pure gate functions above cannot express it. If the accepted label were
  // removed FIRST and the add then threw (transient gh/network), the PR would carry NO review label: next pass
  // `hasReviewLabel(accepted)` is false, the reviewed-SHA staleness check is skipped, and a de-escalated
  // ride-in commit auto-lands (the exact hole #2409 closes). Add-first/remove-last means a partial failure
  // leaves review:accepted in place, which safely re-triggers the stale check. This asserts that ordering at
  // the source level (the only observable seam for an inline, side-effecting gh sequence).
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  it('applies the re-park label (add) before removing review:accepted', () => {
    const addIdx = src.indexOf("'--add-label', gate.applyLabel");
    const removeStaleIdx = src.indexOf("'--remove-label', REVIEW_LABELS.accepted");
    expect(addIdx).toBeGreaterThan(-1);      // the re-park add call is present
    expect(removeStaleIdx).toBeGreaterThan(-1); // the stale-accepted remove call is present
    // REMOVE-LAST: the stale-accepted drop must appear AFTER the re-park add in source order.
    expect(removeStaleIdx).toBeGreaterThan(addIdx);
  });

  it('removes review:accepted exactly once in the park path (no duplicate swap)', () => {
    const occurrences = src.split("'--remove-label', REVIEW_LABELS.accepted").length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('#2417 — per-pass read fan-out (bounded pool)', () => {
  it('mapWithConcurrency preserves input order and runs with a bounded number in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const fn = async (n) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n * 2;
    };
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, fn);
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]); // input order preserved
    expect(peak).toBeLessThanOrEqual(3);           // never more than `limit` concurrent
    expect(peak).toBeGreaterThan(1);               // and it DID run some in parallel
  });

  it('mapWithConcurrency degrades safely on an empty list and a limit below 1', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n)).toEqual([1, 2]); // clamps to ≥1 worker
  });

  it('fans out every PR through fetchOne once on a cold first pass', async () => {
    const calls = [];
    const cache = new Map();
    const prs = [{ repo: 'we', number: 1, sha: 'a' }, { repo: 'we', number: 2, sha: 'b' }, { repo: 'fui', number: 1, sha: 'c' }];
    const reads = await fetchPrReadsCached(prs, {
      cache,
      keyOf: (p) => `${p.repo}::${p.number}`,
      shaOf: (p) => p.sha,
      fetchOne: async (p) => { calls.push(`${p.repo}::${p.number}`); return { commits: [p.number] }; },
    });
    expect(calls.sort()).toEqual(['fui::1', 'we::1', 'we::2']); // all three fetched once
    expect(reads.get('we::1').value).toEqual({ commits: [1] });
    expect(reads.get('we::1').cached).toBe(false);
  });
});

describe('#2417 — cross-pass cache reuses unchanged-SHA reads under --watch', () => {
  it('does NOT re-fetch a PR whose head SHA is unchanged on a second pass, but DOES re-fetch a changed SHA', async () => {
    const cache = new Map();
    let fetches = 0;
    const run = (prs) => fetchPrReadsCached(prs, {
      cache,
      keyOf: (p) => `${p.repo}::${p.number}`,
      shaOf: (p) => p.sha,
      fetchOne: async (p) => { fetches++; return { commits: [p.sha] }; },
    });

    // Pass 1 (cold): both PRs fetched.
    await run([{ repo: 'we', number: 1, sha: 'aaa' }, { repo: 'we', number: 2, sha: 'bbb' }]);
    expect(fetches).toBe(2);

    // Pass 2: PR#1 unchanged (reused, NO fetch), PR#2 rebuilt its tip (changed SHA → re-fetched).
    const pass2 = await run([{ repo: 'we', number: 1, sha: 'aaa' }, { repo: 'we', number: 2, sha: 'ccc' }]);
    expect(fetches).toBe(3);                       // exactly ONE new fetch (PR#2), NOT two
    expect(pass2.get('we::1').cached).toBe(true);  // PR#1 served from cache
    expect(pass2.get('we::2').cached).toBe(false); // PR#2 re-fetched
    expect(pass2.get('we::2').value).toEqual({ commits: ['ccc'] });
  });

  it('evicts a PR that dropped out of the pass so the cache tracks the live open set (bounded growth)', async () => {
    const cache = new Map();
    const opts = (prs) => fetchPrReadsCached(prs, {
      cache,
      keyOf: (p) => `${p.repo}::${p.number}`,
      shaOf: (p) => p.sha,
      fetchOne: async () => ({ ok: true }),
    });
    await opts([{ repo: 'we', number: 1, sha: 'a' }, { repo: 'we', number: 2, sha: 'b' }]);
    expect(cache.size).toBe(2);
    await opts([{ repo: 'we', number: 1, sha: 'a' }]); // PR#2 landed/closed → gone from the pass
    expect(cache.size).toBe(1);
    expect(cache.has('we::2')).toBe(false);
  });

  it('a null head SHA always misses (never serves a stale read when the key is unknowable)', async () => {
    const cache = new Map();
    let fetches = 0;
    const run = (prs) => fetchPrReadsCached(prs, {
      cache,
      keyOf: (p) => `${p.repo}::${p.number}`,
      shaOf: (p) => p.sha,
      fetchOne: async () => { fetches++; return {}; },
    });
    await run([{ repo: 'we', number: 1, sha: null }]);
    await run([{ repo: 'we', number: 1, sha: null }]);
    expect(fetches).toBe(2); // no SHA ⇒ cannot prove unchanged ⇒ re-fetch each pass
  });

  it('does NOT cache an error-path (degraded) read — the next pass re-fetches and self-heals', async () => {
    // #2417 review — a swallowed gh error yields a spurious `{ commits: [], degraded: true }`. Even though the
    // head SHA is UNCHANGED, that degraded read must not latch: caching it would serve the empty/degraded read
    // for the whole head-SHA lifetime under `--watch` instead of self-healing when gh recovers next pass.
    const cache = new Map();
    let ghUp = false; // gh is DOWN on pass 1 (throws → degraded), UP from pass 2
    let fetches = 0;
    const run = (prs) => fetchPrReadsCached(prs, {
      cache,
      keyOf: (p) => `${p.repo}::${p.number}`,
      shaOf: (p) => p.sha,
      isDegraded: (v) => !!v?.degraded,
      fetchOne: async () => {
        fetches++;
        return ghUp ? { commits: ['c1'], degraded: false } : { commits: [], degraded: true };
      },
    });
    const pr = [{ repo: 'we', number: 1, sha: 'aaa' }]; // SHA is stable across all three passes

    // Pass 1 (gh down): fetched, degraded → used this pass but NOT cached.
    const p1 = await run(pr);
    expect(fetches).toBe(1);
    expect(p1.get('we::1').value).toEqual({ commits: [], degraded: true }); // best-effort value THIS pass
    expect(cache.has('we::1')).toBe(false);                                 // degraded read was NOT cached

    // Pass 2 (gh recovered): unchanged SHA still RE-FETCHES (the degraded read never latched) and self-heals.
    ghUp = true;
    const p2 = await run(pr);
    expect(fetches).toBe(2);                                                // re-fetched despite unchanged SHA
    expect(p2.get('we::1').cached).toBe(false);
    expect(p2.get('we::1').value).toEqual({ commits: ['c1'], degraded: false });
    expect(cache.has('we::1')).toBe(true);                                  // the good read IS cached now

    // Pass 3 (still up, unchanged SHA): NOW served from cache (a genuine successful read latches correctly).
    const p3 = await run(pr);
    expect(fetches).toBe(2);                                                // no new fetch — cache hit
    expect(p3.get('we::1').cached).toBe(true);
  });
});
