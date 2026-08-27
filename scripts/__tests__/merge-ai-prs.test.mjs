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
import { isAiAuthor, labelOnGreenVerdict, planResolveOnLand, resolveIdsForLandedPass, latestRequiredCheck, rollupRowKind, collapseRollupToLatestPerName, computeNetDiffPaths, isAiCommit, isAiGeneratedPr, isMechanicalMergeCommit, isRequiredCheckGreen, isRequiredCheckFailed, hasLabel, classifyPr, planLabelDrain, joinImplToCouples, parseWatchOpts, decideDrainLeaseGate, pickRunningBatches, readBatchFeed, decideBatchesIdleExit, isRebaseDropCandidate, needsManifestStripBeforeMerge, needsAcceptanceRestamp, restampAcceptance, isStackedWeCoupleHalf, shouldRepollForLabelLag, shouldLabelOnGreen, resolveRepos, siblingCloneName, regenDerivedOnLand, resolvePrimaryPath, syncPrimaryOnLand, resyncDetachedCwdForLand, parseNumstat, computeNetDiffChangedFiles, computeNetDiffText, resolveNetDiffBasis, computeNetDiffSignals, drainReasonMarker, buildDrainReasonComment, hasDrainReasonComment, shouldPostParkReasonComment, LAND_REASON, CI_LIFECYCLE_LABELS, CI_LIFECYCLE_LABEL_META, lifecycleLabelFromCiTruth, planCiLifecycleLabelUpdate, remoteManifestApiArgs, collectFlagOccurrences, parseNoReviewEscalation, applyEscalationRelief, matchesOnlyTarget, mapWithConcurrency, fetchPrReadsCached, isDegradedOpenPrListing, OPEN_PR_LIST_LIMIT, carrierDeferDecision, buildCarrierHealth, deferralsAllHeldCouple, planDrainPass, resolveContextRepos, reduceOpenPrContext, collectOpenPrContext, isContentsNotFound, readRemoteManifestViaApi, isPassIdle, isConfirmSweepSettled, coupleImplOpen, liveOpenHeadRefs, deriveCoupleIncomplete, buildDrainVerdicts, REVIEW_COVERAGE_KIND, REVIEW_RECORD_HEADLINES, REVIEW_COVERAGE_GAP_META, reviewRecordKind, recordedReviewRecords, readReviewRecord, reviewCoverageGaps, buildReviewCoverageReason } from '../merge-ai-prs.mjs';
import { scoreEscalation, diffHunksFrom, decideReviewGate, REVIEW_LABELS, READY_TO_MERGE_LABEL, decideParkReadyStrip } from '../lib/review-escalation.mjs';
import { buildManifest, asItemId } from '../readiness/lane-manifest.mjs';

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

// #984 F2 — the WIRING half of the park go-ahead strip. The decision itself is pure and covered in
// `review-escalation.test.mjs` (`decideParkReadyStrip`); what a pure test cannot see is WHERE the drain calls
// it, and that is exactly what broke: the strip was nested inside `if (gate.applyLabel && !DRY_RUN)`, so it
// never ran for `review:changes` (a `wait-author` verdict with no `applyLabel`), and two other park sites
// (`continue`-ing on manifest-tamper / test-gaming) never reached it at all. Source-contract assertions, the
// same mechanism the AC3 check above and the #2409 add-first/remove-last check already use — the park loop
// lives in `runCli`, which this file's standing norm leaves un-executed.
describe('merge-ai-prs — #984 F2: the park strip is keyed on OBSERVED holds, not on gate.applyLabel', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  it('there is exactly ONE ready-to-merge removal site, and it is guarded by decideParkReadyStrip', () => {
    expect(src.match(/'--remove-label', READY_TO_MERGE_LABEL/g) || []).toHaveLength(1);
    const helper = src.slice(src.indexOf('const stripReadyOnPark = ('));
    expect(helper).toMatch(/^const stripReadyOnPark = [\s\S]{0,600}?decideParkReadyStrip\(v\.prLabels, \{ applyLabel, staleAcceptance \}\)/);
    // …and NOT on the shipped applyLabel-shaped key, which is what excluded review:changes.
    expect(src).not.toMatch(/isReviewHoldLabel\(gate\.applyLabel\)/);
  });

  it('the strip does NOT live inside the `gate.applyLabel` guard (the review:changes hole)', () => {
    const start = src.indexOf('if (gate.applyLabel && !DRY_RUN) {');
    expect(start).toBeGreaterThan(-1);
    // The block's closing anchor moved with #x9xqexm: what used to follow this guard was #2409's
    // `--remove-label review:accepted`; a re-score no longer removes it, and the comment block explaining that
    // now sits in its place. Anchored on the replacement so the scan still bounds the same region.
    const end = src.indexOf('// #x9xqexm — A RE-SCORE NEVER REMOVES', start);
    expect(end).toBeGreaterThan(start);
    const guarded = src.slice(start, end);
    expect(guarded).not.toContain('stripReadyOnPark');
    expect(guarded).not.toContain('READY_TO_MERGE_LABEL');
  });

  it('all THREE park sites route through the seam (gate park/wait-author, manifest tamper, test-gaming)', () => {
    expect(src.match(/^\s*stripReadyOnPark\(v, \{/gm) || []).toHaveLength(3);
    // The gate site passes the park's own writes through, so a fresh park and a #2409 re-park both still strip.
    expect(src).toContain('stripReadyOnPark(v, { applyLabel: gate.applyLabel, staleAcceptance: gate.staleAcceptance })');
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
  // #2832 — LABEL/HOLD SELF-CONSISTENCY (the ADD-side write-time invariant): a green, fully-AI PR carrying ANY
  // review-hold label must NOT be auto-stamped ready-to-merge (a hold and a go-ahead are contradictory). This is
  // the AI-generated case — distinct from the non-AI case above, which fails on authorship, not on the hold.
  it('#2832 — green + fully-AI but review:pending → REFUSED (held PRs never get the go-ahead)', () => {
    expect(shouldLabelOnGreen(aiPr({ labels: [{ name: 'review:pending' }] }), {})).toBe(false);
  });
  it('#2832 — green + fully-AI but review:changes → REFUSED', () => {
    expect(shouldLabelOnGreen(aiPr({ labels: [{ name: 'review:changes' }] }), {})).toBe(false);
  });
  it('#2832 — green + fully-AI but review:human → REFUSED', () => {
    expect(shouldLabelOnGreen(aiPr({ labels: [{ name: 'review:human' }] }), {})).toBe(false);
  });
  it('#2832 — a review:accepted PR is NOT held (the hold was cleared) → still labelled on green', () => {
    expect(shouldLabelOnGreen(aiPr({ labels: [{ name: REVIEW_LABELS.accepted }] }), {})).toBe(true);
  });
  it('#2832 — a clean PR with NO review label is unaffected → labelled on green', () => {
    expect(shouldLabelOnGreen(aiPr(), {})).toBe(true);
  });
});

// #2832 — the REASON channel + the #2423 relief. Two regressions the bare refusal above would otherwise ship:
//   1. a withheld go-ahead goes SILENT (pre-#2832 the held PR kept the label, entered the candidate set, and got
//      a park comment from the merge gate; refusing the stamp removes it from that set, so nothing explains the
//      wait any more) — `reason:'held'` is what lets the reconcile post it instead;
//   2. the ratified #2423 valve dies (`--no-review-escalation=<pr#>` still waives the MERGE predicate, but an
//      unstamped PR never enters the `--label`-scoped candidate set, so there is nothing left for it to waive).
describe('labelOnGreenVerdict (#2832 — the reason channel and the #2423 relief)', () => {
  it('green + fully-AI + review:pending → refused WITH reason "held" (so the reconcile can say why)', () => {
    expect(labelOnGreenVerdict(aiPr({ labels: [{ name: 'review:pending' }] }), {})).toEqual({ label: false, reason: 'held' });
  });

  it('the #2423 relief re-opens the stamp for a NAMED review:pending PR — the valve stays alive', () => {
    expect(labelOnGreenVerdict(aiPr({ labels: [{ name: 'review:pending' }] }), { allowPendingReview: true }))
      .toEqual({ label: true, reason: null });
  });

  // The relief is narrow at BOTH layers, exactly as `classifyPr` has it: an operator flag waives an
  // agent-reviewable pending park, never a reviewer's active rejection and never the human-only gate.
  it('the relief NEVER waives review:changes', () => {
    expect(labelOnGreenVerdict(aiPr({ labels: [{ name: 'review:changes' }] }), { allowPendingReview: true }))
      .toEqual({ label: false, reason: 'held' });
  });
  it('the relief NEVER waives review:human', () => {
    expect(labelOnGreenVerdict(aiPr({ labels: [{ name: 'review:human' }] }), { allowPendingReview: true }))
      .toEqual({ label: false, reason: 'held' });
  });

  // A red or non-producer PR is NOT "stuck because held" — it is stuck for its own reason, which the
  // ci-lifecycle labels already carry. Reporting `held` there would post a misleading comment on every pass.
  it('a RED PR that also carries a hold reports NO reason (not stuck because held)', () => {
    const red = { ...aiPr({ labels: [{ name: 'review:pending' }] }), statusCheckRollup: [{ name: 'test', conclusion: 'FAILURE' }] };
    expect(labelOnGreenVerdict(red, {})).toEqual({ label: false, reason: null });
  });
  it('a non-AI PR that also carries a hold reports NO reason (it fails on authorship first)', () => {
    const orphan = aiPr({ commits: [claudeCommit(), humanCommit], labels: [{ name: 'review:pending' }] });
    expect(labelOnGreenVerdict(orphan, {})).toEqual({ label: false, reason: null });
  });
  it('an ALREADY-labelled held PR reports no reason — nothing is being withheld from it', () => {
    const already = aiPr({ labels: [{ name: 'ready-to-merge' }, { name: 'review:pending' }] });
    expect(labelOnGreenVerdict(already, {})).toEqual({ label: false, reason: null });
  });

  it('`shouldLabelOnGreen` is exactly the boolean projection of the verdict', () => {
    const cases = [
      aiPr(),
      aiPr({ labels: [{ name: 'review:pending' }] }),
      aiPr({ labels: [{ name: 'review:changes' }] }),
      aiPr({ labels: [{ name: 'review:human' }] }),
      aiPr({ labels: [{ name: REVIEW_LABELS.accepted }] }),
      aiPr({ labels: [{ name: 'ready-to-merge' }] }),
      aiPr({ commits: [claudeCommit(), humanCommit] }),
    ];
    for (const pr of cases) expect(shouldLabelOnGreen(pr, {})).toBe(labelOnGreenVerdict(pr, {}).label);
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options` and
      // (#2890-review-r2 finding 2b) `--no-ext-diff`. Both are argv hygiene, not intent: encoding them in every
      // fixture key means adding one guard to one more call site reds 17 unrelated tests and tempts the author
      // to drop the guard instead of the fixtures. Each has its own dedicated assertion (`guards the git-diff
      // argv…`, `computeNetDiffText passes --no-ext-diff`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      // Faithful to real git: an UNSTUBBED `git diff` against a ref this fake doesn't know throws
      // (unknown revision) rather than silently returning '' — so an invalid candidate (e.g. the producer's
      // `<remote>/<sha>`) fails fast and the fallthrough is exercised as it would be against real git.
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
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
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [], reason: 'ref-unresolved' });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('#2373-review — FETCH_HEAD is never a diff candidate, with OR without fetchExtraRefs (it always points at `<remote>/<base>` → a spurious empty base-vs-base diff)', () => {
    const { exec, calls } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x' }); // no fetchExtraRefs
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [], reason: 'ref-unresolved' });
    expect(calls.some((c) => c.key === 'git diff --numstat origin/main FETCH_HEAD')).toBe(false);
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffChangedFiles({})).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffChangedFiles({ exec })).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] });
    expect(calls.length).toBe(0);
  });

  // #2952 — the fixable case: a caller-side `exec`-contract violation used to be BYTE-IDENTICAL to a legitimately
  // absent ref (both `{ scored: false }`, no signal) — reproduced live in the human review of WE PR #1063
  // (2026-08-06), where a shell-exec shaped `(cmd, opts) => execSync(cmd, opts)` was injected in place of the
  // documented `(cmd, args, opts) => execFileSync(cmd, args, opts)` contract. Called 3-arg, it received the ARGS
  // ARRAY in its `opts` position; Node's own `execSync` argument validation then throws
  // `TypeError [ERR_INVALID_ARG_TYPE]` for a non-object `options` — reproduced directly here without touching a
  // real subprocess, since the classification (`isExecContractError`) keys off `instanceof TypeError`, not the
  // specific message.
  it('#2952 — exec-contract: a wrongly-shaped `exec` (2-arity, treating the args ARRAY as the options object) throws a TypeError, and the degrade reports reason:"exec-contract" instead of looking identical to an absent ref', () => {
    const badExec = (cmd, optsShapedAsArgsArray) => {
      if (!optsShapedAsArgsArray || Array.isArray(optsShapedAsArgsArray)) {
        throw new TypeError('The "options" argument must be of type object. Received an instance of Array');
      }
      return '';
    };
    const r = computeNetDiffChangedFiles({ exec: badExec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [], reason: 'exec-contract' });
  });

  it('#2952 — a NORMAL git failure (unresolvable candidates) is classified "ref-unresolved", never "exec-contract" — a well-shaped exec throwing a plain Error (not TypeError) is the legitimately-absent-ref case', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r.reason).toBe('ref-unresolved');
  });

  it('#2952 — additive only: a consumer that destructures just `scored` (the pre-#2952 contract) sees no behavior change — `reason` is a new field, every other field is untouched', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    const { scored } = r; // a consumer that reads ONLY `scored`, exactly as every consumer did pre-#2952
    expect(scored).toBe(false);
    expect(r.changedFiles).toEqual([]);
    expect(r.diffLines).toBe(0);
    expect(r.humanBasisFiles).toEqual([]);
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
      // The fixture is the ROSTER (a declarative-leash file, #2771/#2785): the point of this case is that a
      // mis-set base==head cannot under-score the HUMAN basis, so it needs a file that still forces a human.
      'git diff --numstat origin/main origin/lane/child': { stdout: '3\t0\tscripts/lib/gate-config.mjs\n' },
      'git rev-parse cafebabecafe': { stdout: 'cafebabecafe\n' },
      'git rev-parse origin/lane/child': { stdout: 'cafebabecafe\n' }, // head resolves to the SAME sha as base
    });
    const net = computeNetDiffChangedFiles({ exec, rev: 'lane/child', baseRev: 'cafebabecafe', fetchExtraRefs: ['lane/child'] });
    expect(net.changedFiles).toEqual(['scripts/lib/gate-config.mjs']); // fell back to cumulative — NOT an empty under-score
    expect(net.humanBasisFiles).toEqual(['scripts/lib/gate-config.mjs']);
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

  // ── #3343 — the base-TIP fallback above is safe for SIZE and blast-radius (they buy reviewer attention) and
  //    NOT safe for the STATUTE / declarative-leash terms, which force `review:human`: `decideSetLabel` then
  //    refuses `accepted` on that PR and only the human ceremony clears it. One upstream commit touching
  //    `docs/agent/platform-decisions.md` is enough to spend a person on a PR of three backlog cards. So before
  //    settling for the base tip, the basis asks the ANCESTRY question instead — which needs no merge-base. ───
  it("#3343 — a FAILED merge-base lookup no longer falls straight back to the base TIP for the human-gate basis: the ancestry set (`origin/main..head`) is used, so a head merely BEHIND main is not scored on the upstream commits it lacks", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      // The base-TIP diff — three cards this head really added, PLUS two files upstream advanced on while it sat
      // behind. `docs/agent/platform-decisions.md` is a STATUTE path, and any statute touch forces review:human.
      'git diff --numstat origin/main deadbeef': { stdout: '2\t0\tbacklog/a.md\n2\t0\tbacklog/b.md\n2\t0\tbacklog/c.md\n4\t4\tdocs/agent/platform-decisions.md\n3\t1\tscripts/guard-bash.mjs\n' },
      // The ANCESTRY set — the commits on this head and not on main. The three cards; nothing upstream-only.
      'git log --numstat --diff-merges=first-parent --pretty=format: origin/main..deadbeef --': { stdout: '2\t0\tbacklog/a.md\n2\t0\tbacklog/b.md\n2\t0\tbacklog/c.md\n' },
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(basis.ok).toBe(true);
    expect(basis.basisKind).toBe('ancestry');
    expect(basis.basisNarrowed).toBe(true);
    expect(basis.humanBasis.changedFiles).toEqual(['backlog/a.md', 'backlog/b.md', 'backlog/c.md']);
    expect(basis.humanBasis.changedFiles).not.toContain('docs/agent/platform-decisions.md');
    // The whole point: no `review:human` on a PR of three backlog cards.
    const score = scoreEscalation({ changedFiles: basis.humanBasis.changedFiles, diffLines: basis.humanBasis.diffLines, humanBasisFiles: basis.humanBasis.changedFiles });
    expect(score.humanRequired).toBe(false);
  });

  it("#3343 NEGATIVE DIRECTION — a head that GENUINELY edits a statute file still earns review:human when the merge-base lookup fails: one of its own commits touches the file, so the ancestry set contains it", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      'git diff --numstat origin/main deadbeef': { stdout: '2\t0\tbacklog/a.md\n9\t3\tdocs/agent/platform-decisions.md\n' },
      // This head's OWN commits include the statute edit — the ancestry set reports it, exactly as it must.
      'git log --numstat --diff-merges=first-parent --pretty=format: origin/main..deadbeef --': { stdout: '2\t0\tbacklog/a.md\n9\t3\tdocs/agent/platform-decisions.md\n' },
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(basis.basisKind).toBe('ancestry');
    expect(basis.humanBasis.changedFiles).toContain('docs/agent/platform-decisions.md');
    const score = scoreEscalation({ changedFiles: basis.humanBasis.changedFiles, diffLines: basis.humanBasis.diffLines, humanBasisFiles: basis.humanBasis.changedFiles });
    expect(score.humanRequired).toBe(true);
    expect(score.reasons.some((r) => r.startsWith('statute ('))).toBe(true);
  });

  it("#3343 NEGATIVE DIRECTION — a declarative-leash (gate-self) edit likewise still forces review:human off the ancestry basis", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      'git diff --numstat origin/main deadbeef': { stdout: '5\t1\tscripts/lib/gate-config.mjs\n' },
      'git log --numstat --diff-merges=first-parent --pretty=format: origin/main..deadbeef --': { stdout: '5\t1\tscripts/lib/gate-config.mjs\n' },
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(scoreEscalation({ changedFiles: basis.humanBasis.changedFiles, humanBasisFiles: basis.humanBasis.changedFiles }).humanRequired).toBe(true);
  });

  it("#3343 — when the ancestry probe cannot answer either, the legacy base-TIP fallback is kept AND SAID: `basisKind:'base-tip'`, `basisNarrowed:false` — no longer byte-identical to a narrowed basis", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      'git diff --numstat origin/main deadbeef': { stdout: '3\t1\tscripts/pr-land.mjs\n' },
      // `git log` deliberately unstubbed → this fake throws, as real git does on a range it cannot resolve.
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(basis.ok).toBe(true); // still a basis — the fallback is not a scoring failure
    expect(basis.basisKind).toBe('base-tip');
    expect(basis.basisNarrowed).toBe(false);
    expect(basis.humanBasis.changedFiles).toEqual(['scripts/pr-land.mjs']); // unchanged over-scoring content
  });

  it("#3343 — a merge-base that RESOLVES is untouched: the ancestry probe never runs, and the basis reports `basisKind:'merge-base'`", () => {
    const { exec, calls } = fakeExec({
      'git merge-base origin/main deadbeef': { stdout: 'forkpoint1234\n' },
      'git diff --numstat forkpoint1234 deadbeef': { stdout: '2\t0\tbacklog/a.md\n' },
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(basis.basisKind).toBe('merge-base');
    expect(basis.basisNarrowed).toBe(true);
    expect(calls.some((c) => c.args[0] === 'log')).toBe(false); // no extra subprocess on the hot path
  });

  it("#3343 — the ancestry set is DEDUPLICATED by path across commits (a file edited in two commits is one entry, its lines summed — churn, the over-scoring direction)", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main deadbeef': { throw: 'no common ancestors' },
      'git diff --numstat origin/main deadbeef': { stdout: '1\t1\tbacklog/a.md\n' },
      'git log --numstat --diff-merges=first-parent --pretty=format: origin/main..deadbeef --': { stdout: '\n3\t1\tbacklog/a.md\n\n2\t0\tbacklog/a.md\n' },
    });
    const basis = resolveNetDiffBasis({ exec, rev: 'deadbeef' });
    expect(basis.humanBasis.changedFiles).toEqual(['backlog/a.md']);
    expect(basis.humanBasis.diffLines).toBe(6); // 3+1 then 2+0 — summed across commits, never a net count
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options` and
      // (#2890-review-r2 finding 2b) `--no-ext-diff`. Both are argv hygiene, not intent: encoding them in every
      // fixture key means adding one guard to one more call site reds 17 unrelated tests and tempts the author
      // to drop the guard instead of the fixtures. Each has its own dedicated assertion (`guards the git-diff
      // argv…`, `computeNetDiffText passes --no-ext-diff`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
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
    expect(r).toEqual({ text: '', base: null, rev: null, scored: false, reason: 'ref-unresolved' });
    expect(calls.some((c) => ['checkout', 'switch'].includes(c.args[0]))).toBe(false);
  });

  it('degrades to scored:false when the basis resolves but the TEXT diff itself fails (safe fallback, no checkout)', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' }, // basis resolves
      'git diff origin/main deadbeef': { throw: 'diff exploded' }, // but the text diff fails
    });
    const r = computeNetDiffText({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ text: '', base: null, rev: null, scored: false, reason: 'diff-failed' });
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffText({})).toEqual({ text: '', base: null, rev: null, scored: false });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffText({ exec })).toEqual({ text: '', base: null, rev: null, scored: false });
    expect(calls.length).toBe(0);
  });

  // #2952 — the `reason` classification is shared (`resolveNetDiffBasis`), so it must show up identically here,
  // not just on `computeNetDiffChangedFiles`.
  it('#2952 — exec-contract propagates through computeNetDiffText too — same wrongly-shaped exec, same reason', () => {
    const badExec = (cmd, optsShapedAsArgsArray) => {
      if (!optsShapedAsArgsArray || Array.isArray(optsShapedAsArgsArray)) {
        throw new TypeError('The "options" argument must be of type object. Received an instance of Array');
      }
      return '';
    };
    const r = computeNetDiffText({ exec: badExec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ text: '', base: null, rev: null, scored: false, reason: 'exec-contract' });
  });
});

// #2890-review-fix finding 3 — the PR's first cut called `computeNetDiffChangedFiles` and `computeNetDiffText`
// independently for the SAME ref, which re-ran the whole of `resolveNetDiffBasis`: measured 5 → 11 git
// subprocesses and 1 → 2 network fetches per `pr-land` PR open, under a comment claiming the two read off ONE
// fetch. `resolveNetDiffBasis` is now exported and both helpers accept the resolved object, so the claim is
// true by construction.
describe('resolveNetDiffBasis shared across both helpers (#2890-review-fix finding 3 — ONE fetch, one probe)', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
      return '';
    };
    return { exec, calls };
  };
  const script = {
    'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint\n' },
    'git diff --numstat forkpoint origin/lane/x': { stdout: '3\t1\tREADME.md\n' },
    'git diff forkpoint origin/lane/x': { stdout: 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-a\n+b\n' },
  };

  it('sharing the basis makes ONE fetch and ONE candidate probe total, not two of each', () => {
    const { exec, calls } = fakeExec(script);
    const basis = resolveNetDiffBasis({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(basis.ok).toBe(true);
    computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'], basis });
    computeNetDiffText({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'], basis });
    expect(calls.filter((c) => c.args[0] === 'fetch').length).toBe(1);
    expect(calls.filter((c) => c.args[0] === 'merge-base').length).toBe(1);
    expect(calls.filter((c) => c.key.startsWith('git diff --numstat')).length).toBe(1);
    expect(calls.length).toBe(4); // fetch + merge-base + numstat probe + the text diff
  });

  it('the UNSHARED path costs strictly more — the measurement the review made, pinned', () => {
    const { exec, calls } = fakeExec(script);
    computeNetDiffChangedFiles({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    computeNetDiffText({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(calls.filter((c) => c.args[0] === 'fetch').length).toBe(2);
    expect(calls.length).toBeGreaterThan(4);
  });

  it('a shared basis yields byte-identical results to resolving independently', () => {
    const a = fakeExec(script);
    const basis = resolveNetDiffBasis({ exec: a.exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    const sharedFiles = computeNetDiffChangedFiles({ exec: a.exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'], basis });
    const sharedText = computeNetDiffText({ exec: a.exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'], basis });
    const b = fakeExec(script);
    expect(sharedFiles).toEqual(computeNetDiffChangedFiles({ exec: b.exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] }));
    expect(sharedText).toEqual(computeNetDiffText({ exec: b.exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] }));
  });

  it('an UNRESOLVED shared basis still degrades with its reason — no silent scored:true', () => {
    const { exec } = fakeExec({}); // every diff probe throws ⇒ ref-unresolved
    const basis = resolveNetDiffBasis({ exec, rev: 'lane/gone' });
    expect(basis).toMatchObject({ ok: false, reason: 'ref-unresolved' });
    expect(computeNetDiffText({ exec, rev: 'lane/gone', basis }))
      .toEqual({ text: '', base: null, rev: null, scored: false, reason: 'ref-unresolved' });
    expect(computeNetDiffChangedFiles({ exec, rev: 'lane/gone', basis }))
      .toEqual({ changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [], reason: 'ref-unresolved' });
  });
});

// #2890-review-r2 finding 1 — the `basis` option overrides `rev`, `remote` AND `base` outright, and nothing
// checked the basis was resolved for the ref being asked about. Reproduced live against real git: a basis for
// `main` handed to `computeNetDiffText({rev: <lane>})` returned `{scored:true, rev:'origin/main', text:''}`,
// which `diffHunksFrom` maps to `''` — "COMPUTED, genuinely empty", the STRONGEST clearance the #2890 contract
// can express — beside an empty file list. That is round 1's blocker reached through the door round 1's own fix
// opened. No in-repo caller does it (both go through `computeNetDiffSignals`), but `resolveNetDiffBasis` is
// exported and `basis` is a documented public option on two exported helpers.
describe('#2890-review-r2 finding 1 — a basis resolved for a DIFFERENT request is REFUSED, never answered', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
      return '';
    };
    return { exec, calls };
  };
  // `main` resolves to an EMPTY self-diff (the reviewer's repro shape); the lane has a real, large diff.
  const script = {
    'git merge-base origin/main origin/main': { stdout: 'mainsha\n' },
    'git diff --numstat mainsha origin/main': { stdout: '' },
    'git diff mainsha origin/main': { stdout: '' },
    'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint\n' },
    'git diff --numstat forkpoint origin/lane/x': { stdout: '90\t10\tdocs/agent/platform-decisions.md\n' },
    'git diff forkpoint origin/lane/x': { stdout: 'diff --git a/docs/agent/platform-decisions.md b/docs/agent/platform-decisions.md\n@@ -1 +1 @@\n-old ruling\n+new ruling\n' },
  };

  it('the exact repro: a main-resolved basis asked about a lane is scored:false/basis-mismatch, NOT a scored EMPTY diff', () => {
    const { exec } = fakeExec(script);
    const mainBasis = resolveNetDiffBasis({ exec, rev: 'main' });
    expect(mainBasis.ok).toBe(true);

    const text = computeNetDiffText({ exec, rev: 'lane/x', basis: mainBasis });
    expect(text.scored).toBe(false);
    expect(text.reason).toBe('basis-mismatch');
    expect(text.rev).toBeNull(); // never reports origin/main as though it were the lane

    const files = computeNetDiffChangedFiles({ exec, rev: 'lane/x', basis: mainBasis });
    expect(files.scored).toBe(false);
    expect(files.reason).toBe('basis-mismatch');
  });

  it('and so the escalation verdict says NOT COMPUTED instead of clearing the lane', () => {
    const { exec } = fakeExec(script);
    const mainBasis = resolveNetDiffBasis({ exec, rev: 'main' });
    const text = computeNetDiffText({ exec, rev: 'lane/x', basis: mainBasis });
    const files = computeNetDiffChangedFiles({ exec, rev: 'lane/x', basis: mainBasis });
    const score = scoreEscalation({
      changedFiles: files.changedFiles,
      humanBasisFiles: files.humanBasisFiles,
      diffLines: files.diffLines,
      diffHunks: diffHunksFrom(text),
    });
    // The whole point: `null` (a detector must over-fire), never `''` (a detector may clear).
    expect(score.diffHunks).toBeNull();
    expect(score.diffHunks).not.toBe('');
    expect(score.diffHunksBasisFiles).toBeNull();
  });

  it('a mismatched REMOTE or BASE is refused too — the basis overrides those as well', () => {
    const { exec } = fakeExec(script);
    const basis = resolveNetDiffBasis({ exec, rev: 'lane/x' }); // origin / main
    expect(computeNetDiffText({ exec, rev: 'lane/x', remote: 'upstream', basis }).reason).toBe('basis-mismatch');
    expect(computeNetDiffText({ exec, rev: 'lane/x', base: 'release', basis }).reason).toBe('basis-mismatch');
    expect(computeNetDiffChangedFiles({ exec, rev: 'lane/x', base: 'release', basis }).reason).toBe('basis-mismatch');
  });

  it('a hand-built basis carrying no identity is refused — a gate does not trust an unidentifiable basis', () => {
    const { exec } = fakeExec(script);
    const forged = { ok: true, baseRef: 'origin/main', diffBase: 'mainsha', candidate: 'origin/main', humanBasis: { changedFiles: [], diffLines: 0 } };
    expect(computeNetDiffText({ exec, rev: 'lane/x', basis: forged }).reason).toBe('basis-mismatch');
    expect(computeNetDiffChangedFiles({ exec, rev: 'lane/x', basis: forged }).reason).toBe('basis-mismatch');
  });

  it('an UNRESOLVED basis for the wrong ref is refused rather than reported as THIS ref being gone', () => {
    // `ref-unresolved` means "this branch does not exist" — a different fact from "you asked with the wrong
    // basis", so the identity rides the failure shape too.
    const { exec } = fakeExec({});
    const gone = resolveNetDiffBasis({ exec, rev: 'lane/gone' });
    expect(gone.ok).toBe(false);
    expect(computeNetDiffText({ exec, rev: 'lane/x', basis: gone }).reason).toBe('basis-mismatch');
  });

  it('the MATCHING basis is unaffected — same results as resolving independently', () => {
    const { exec } = fakeExec(script);
    const basis = resolveNetDiffBasis({ exec, rev: 'lane/x' });
    const shared = computeNetDiffText({ exec, rev: 'lane/x', basis });
    expect(shared.scored).toBe(true);
    expect(shared.text).toContain('+new ruling');
    const b = fakeExec(script);
    expect(shared).toEqual(computeNetDiffText({ exec: b.exec, rev: 'lane/x' }));
  });
});

// #2890-review-r2 finding 3 — both production call sites hand-assembled basis → changed files → text →
// `diffHunksFrom`, and that assembly was pinned by NOTHING: removing `basis:` from all three call sites failed
// zero of the 551 tests, and the only guard on the `diffHunks` mapping was a source-level grep for one literal
// spelling. The assembly is now ONE exported function, so these are behaviour, not spelling.
describe('computeNetDiffSignals — the ONE net-diff derivation both call sites use (#2890-review-r2 finding 3)', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
      return '';
    };
    return { exec, calls };
  };
  const script = {
    'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint\n' },
    'git diff --numstat forkpoint origin/lane/x': { stdout: '3\t1\tREADME.md\n' },
    'git diff forkpoint origin/lane/x': { stdout: 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-a\n+b\n' },
  };

  it('costs ONE fetch, ONE merge-base, ONE numstat probe and ONE text diff — the shared basis, pinned by cost', () => {
    const { exec, calls } = fakeExec(script);
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.scored).toBe(true);
    expect(calls.filter((c) => c.args[0] === 'fetch').length).toBe(1);
    expect(calls.filter((c) => c.args[0] === 'merge-base').length).toBe(1);
    expect(calls.filter((c) => c.key.startsWith('git diff --numstat')).length).toBe(1);
    expect(calls.length).toBe(4);
  });

  it('returns the changed-file shape, the cumulative human basis, the text object AND the mapped hunks', () => {
    const { exec } = fakeExec(script);
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.changedFiles).toEqual(['README.md']);
    expect(sig.diffLines).toBe(4);
    expect(sig.humanBasisFiles).toEqual(['README.md']);
    expect(sig.netDiffText.scored).toBe(true);          // the drain reuses this object for the gaming scan
    expect(sig.diffHunks).toBe(sig.netDiffText.text);
  });

  it('THE regression, as behaviour: a FAILED text diff yields diffHunks null while changedFiles still populates', () => {
    // This is round 1's blocker in the shape it actually reaches a detector — a real file list beside a content
    // signal that must say "I could not look", not "there was nothing to see".
    const { exec } = fakeExec({ ...script, 'git diff forkpoint origin/lane/x': { throw: 'diff exploded' } });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.changedFiles).toEqual(['README.md']);
    expect(sig.scored).toBe(true);
    expect(sig.diffHunks).toBeNull();
    expect(sig.diffHunks).not.toBe('');
    expect(scoreEscalation({ ...sig }).diffHunks).toBeNull();
  });

  it('a genuinely EMPTY but computed diff still comes through as \'\' — the other half of the contract', () => {
    const { exec } = fakeExec({ ...script, 'git diff forkpoint origin/lane/x': { stdout: '' } });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.diffHunks).toBe('');
    expect(sig.diffHunks).not.toBeNull();
  });

  it('an unresolvable ref degrades everything at once — no half-populated verdict', () => {
    const { exec } = fakeExec({});
    const sig = computeNetDiffSignals({ exec, rev: 'lane/gone' });
    expect(sig).toMatchObject({ changedFiles: [], diffLines: 0, humanBasisFiles: [], scored: false, diffHunks: null });
  });

  it('#2390 de-inflation is preserved: changedFiles narrows to baseRev…head, the hunks + human basis stay CUMULATIVE', () => {
    const { exec } = fakeExec({
      ...script,
      'git merge-base --is-ancestor abc1234 origin/lane/x': { stdout: '' },
      'git rev-parse abc1234': { stdout: 'abc1234\n' },
      'git rev-parse origin/lane/x': { stdout: 'headsha\n' },
      'git diff --numstat forkpoint origin/lane/x': { stdout: '3\t1\tREADME.md\n1\t0\tdocs/agent/platform-decisions.md\n' },
      'git diff --numstat abc1234 origin/lane/x': { stdout: '3\t1\tREADME.md\n' },
    });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', baseRev: 'abc1234', fetchExtraRefs: ['lane/x'] });
    expect(sig.changedFiles).toEqual(['README.md']);
    expect(sig.humanBasisFiles).toEqual(['README.md', 'docs/agent/platform-decisions.md']);
    // and the verdict pairs the hunks with the CUMULATIVE list, never the de-inflated one (#2890 finding 4).
    expect(scoreEscalation({ ...sig }).diffHunksBasisFiles).toEqual(['README.md', 'docs/agent/platform-decisions.md']);
  });

  it('#3317 — publishes the CUMULATIVE line count beside the cumulative file list, off the same resolved basis', () => {
    const { exec, calls } = fakeExec(script);
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.cumulativeDiffLines).toBe(4);          // 3 added + 1 deleted, merge-base…head
    expect(calls.filter((c) => c.key.startsWith('git diff --numstat')).length).toBe(1); // no extra subprocess
  });
  it('#3317 — a stacked lane de-inflates diffLines but NOT cumulativeDiffLines, so scoreEscalation still sees the honest size', () => {
    const { exec } = fakeExec({
      ...script,
      'git merge-base --is-ancestor abc1234 origin/lane/x': { stdout: '' },
      'git rev-parse abc1234': { stdout: 'abc1234\n' },
      'git rev-parse origin/lane/x': { stdout: 'headsha\n' },
      // the ancestor contributed 600 lines; the child's own delta is 4
      'git diff --numstat forkpoint origin/lane/x': { stdout: '3\t1\tREADME.md\n500\t100\tdocs/big.md\n' },
      'git diff --numstat abc1234 origin/lane/x': { stdout: '3\t1\tREADME.md\n' },
    });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', baseRev: 'abc1234', fetchExtraRefs: ['lane/x'] });
    expect(sig.diffLines).toBe(4);                    // #2390 de-inflation, preserved
    expect(sig.cumulativeDiffLines).toBe(604);        // #3317 — the merge-base measurement, un-shrinkable
    const score = scoreEscalation({ ...sig });
    expect(score.escalate).toBe(true);
    expect(score.signals.size).toBe(604);
    // and it is an escalation, never a refusal (#3320) — agent-clearable
    expect(score.humanRequired).toBe(false);
  });
  it('#3317 — an unresolvable basis degrades to 0, which leaves the declared count alone rather than zeroing it', () => {
    const { exec } = fakeExec({});
    const sig = computeNetDiffSignals({ exec, rev: 'lane/gone' });
    expect(sig.cumulativeDiffLines).toBe(0);
    expect(scoreEscalation({ diffLines: 900, cumulativeDiffLines: sig.cumulativeDiffLines }).signals.size).toBe(900);
  });
  it('the drain\'s scoring loop reads the signal off this derivation, never assembling it inline', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');
    const loop = src.slice(src.indexOf('for (const v of verdicts)'));
    expect(loop).toMatch(/computeNetDiffSignals\(/);
    expect(loop.match(/diffHunks\s*[:=][^;\n]*\.text\b/)).toBeNull();
  });
});

// #2890-review-r2 finding 2b — `computeNetDiffText` shares the `diff.external` / `GIT_EXTERNAL_DIFF` exposure
// its write-time sibling had, and its output now feeds `diffHunks`, the reviewer panel AND the anti-test-gaming
// scan — three readers that must never see a user-configurable RENDERING of the diff.
describe('computeNetDiffText passes --no-ext-diff (#2890-review-r2 finding 2b)', () => {
  it('the flag is on the argv, ahead of --end-of-options', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args);
      if (args[0] === 'diff' && args.includes('--numstat')) return '1\t0\tREADME.md\n';
      return 'diff --git a/README.md b/README.md\n';
    };
    computeNetDiffText({ exec, rev: 'deadbeef' });
    const textDiff = calls.find((a) => a[0] === 'diff' && !a.includes('--numstat'));
    expect(textDiff).toContain('--no-ext-diff');
    expect(textDiff.indexOf('--no-ext-diff')).toBeLessThan(textDiff.indexOf('--end-of-options'));
  });
  it('but NOT --text: a whole-PR diff must not force binary assets into the reviewer-facing text', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args);
      if (args[0] === 'diff' && args.includes('--numstat')) return '1\t0\tREADME.md\n';
      return 'diff\n';
    };
    computeNetDiffText({ exec, rev: 'deadbeef' });
    expect(calls.find((a) => a[0] === 'diff' && !a.includes('--numstat'))).not.toContain('--text');
  });
});

describe('computeNetDiffPaths (#2901/#1031 — NET changed-file list as plain paths, SAME basis as the score/text)', () => {
  const fakeExec = (script = {}) => {
    const calls = [];
    const exec = (cmd, args, opts) => {
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      calls.push({ cmd, args, opts, key: `${cmd} ${intent.join(' ')}` });
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      // #3343 — same faithfulness for the ancestry probe (`git log <base>..<head>`): real git exits 128 on a
      // range whose refs it cannot resolve, it does not print an empty log. Returning '' here would hand
      // `resolveNetDiffBasis` a CONFIDENT empty file set for every fixture that never stubbed the probe —
      // an under-score, the one direction the basis must never take.
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
      return '';
    };
    return { exec, calls };
  };

  it('resolves the same basis as computeNetDiffText/computeNetDiffChangedFiles and returns plain NUL-separated paths', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' },
      'git diff --name-only -z origin/main..deadbeef': { stdout: 'README.md\0' },
    });
    const r = computeNetDiffPaths({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ paths: ['README.md'], base: 'origin/main', rev: 'deadbeef', scored: true });
  });

  it('#2952 — degrades with reason:"ref-unresolved" when neither candidate resolves (legitimately absent — a foreign/sibling clone with no head ref)', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main lane/x': { throw: 'unknown revision' },
      'git diff --numstat origin/main origin/lane/x': { throw: 'unknown revision' },
    });
    const r = computeNetDiffPaths({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ paths: [], base: null, rev: null, scored: false, reason: 'ref-unresolved' });
  });

  it('#2952 — degrades with reason:"diff-failed" when the basis resolves but the name-only diff itself fails', () => {
    const { exec } = fakeExec({
      'git diff --numstat origin/main deadbeef': { stdout: '1\t0\tREADME.md\n' }, // basis resolves
      'git diff --name-only -z origin/main..deadbeef': { throw: 'diff exploded' }, // but this diff fails
    });
    const r = computeNetDiffPaths({ exec, rev: 'deadbeef' });
    expect(r).toEqual({ paths: [], base: null, rev: null, scored: false, reason: 'diff-failed' });
  });

  it('#2952 — exec-contract propagates through computeNetDiffPaths too — same wrongly-shaped exec, same reason', () => {
    const badExec = (cmd, optsShapedAsArgsArray) => {
      if (!optsShapedAsArgsArray || Array.isArray(optsShapedAsArgsArray)) {
        throw new TypeError('The "options" argument must be of type object. Received an instance of Array');
      }
      return '';
    };
    const r = computeNetDiffPaths({ exec: badExec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(r).toEqual({ paths: [], base: null, rev: null, scored: false, reason: 'exec-contract' });
  });

  it('no exec / no rev → scored:false without touching git at all', () => {
    expect(computeNetDiffPaths({})).toEqual({ paths: [], base: null, rev: null, scored: false });
    const { exec, calls } = fakeExec();
    expect(computeNetDiffPaths({ exec })).toEqual({ paths: [], base: null, rev: null, scored: false });
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options` and
      // (#2890-review-r2 finding 2b) `--no-ext-diff`. Both are argv hygiene, not intent: encoding them in every
      // fixture key means adding one guard to one more call site reds 17 unrelated tests and tempts the author
      // to drop the guard instead of the fixtures. Each has its own dedicated assertion (`guards the git-diff
      // argv…`, `computeNetDiffText passes --no-ext-diff`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
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
      // The stub key names WHICH TREES are compared, deliberately ignoring `--end-of-options` and
      // (#2890-review-r2 finding 2b) `--no-ext-diff`. Both are argv hygiene, not intent: encoding them in every
      // fixture key means adding one guard to one more call site reds 17 unrelated tests and tempts the author
      // to drop the guard instead of the fixtures. Each has its own dedicated assertion (`guards the git-diff
      // argv…`, `computeNetDiffText passes --no-ext-diff`), which is where a regression must fail.
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
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

describe('#x9xqexm — a re-score never REMOVES review:accepted (superseding #2409\'s add-first/remove-last)', () => {
  // WHAT THIS REPLACES. #2409's re-park swap did two `gh pr edit` calls: add the re-park label, then drop the
  // now-stale `review:accepted`. Its safety property was the ORDER (add-first/remove-last), because both calls
  // are best-effort and removing first could leave a PR with NO review label. #x9xqexm removes the second call
  // entirely, which retires that ordering concern and closes a worse one: the drain was DELETING a human's
  // recorded clearance minutes after the operator granted it (WE PR #1100 at 14:41:44, PR #984 at 14:41:51 —
  // 2-3s after the matching add, exactly this swap).
  //
  // WHY THE MERGE IS STILL REFUSED WITHOUT THE REMOVAL. `decideReviewGate` checks `review:accepted` FIRST and
  // returns `action:'park'` — never `'merge'` — for as long as `acceptanceCoversHead` says the accept is stale,
  // so the land decision never depended on the label being gone. The one thing the removal did buy — keeping the
  // NON-scoring paths from reading `accepted + human` as cleared — is now `hasUnclearedReviewLabel`'s job
  // (gate-invariants INVARIANT 5). Source-level, because an inline side-effecting `gh` sequence has no other
  // observable seam.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  it('the re-park ADD is still there — a stale acceptance is still re-parked, it just is not un-accepted', () => {
    expect(src.indexOf("'--add-label', gate.applyLabel")).toBeGreaterThan(-1);
  });

  it('NO code path in the drain removes review:accepted, in any spelling', () => {
    for (const forbidden of [
      /--remove-label'\s*,\s*REVIEW_LABELS\.accepted/,
      /--remove-label'\s*,\s*'review:accepted'/,
      /--remove-label=review:accepted/,
    ]) {
      expect(src).not.toMatch(forbidden);
    }
  });

  // ── ROUND-2 BLOCKER 1: the label pair the removal used to prevent, on the path that never scores. ─────────
  // Keeping `review:accepted` through a re-park is only safe if every reader of the raw label set understands
  // the resulting pair. `decideReviewGate` does — it re-derives `park` from the fingerprints every pass. The
  // BARE `/merge` orphan sweep does not: `node scripts/merge-ai-prs.mjs` with no `--label` sets
  // `REVIEW_ESCALATION = false` and never calls `decideReviewGate` at all, so `classifyPr` is the whole gate
  // there — and it certifies on `review:accepted` ALONE (no `ready-to-merge` required, so stripping that label
  // protects nothing). These are the two pairs a stale re-park can leave behind.
  const bare = (names) => aiPr({ labels: names.map((name) => ({ name })) });

  it('the bare sweep REFUSES a stale re-park pair [accepted, pending] — the PR #984 shape', () => {
    // The drain applies `review:pending` on re-park whenever the fresh score is not `humanRequired`, which is
    // the bulk of the queue. No sanctioned writer makes this pair: `--to=accepted` and `--to=clear-human` both
    // REMOVE `pending` as they add `accepted`. So the pair means "a re-score found this accept stale" and the
    // non-scoring path must read it that way.
    const v = classifyPr(bare([REVIEW_LABELS.accepted, REVIEW_LABELS.pending]));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
    expect(v.reason).toMatch(/unsatisfied review hold/);
  });

  it('the bare sweep REFUSES a stale re-park pair [accepted, human] — the gate-self shape', () => {
    const v = classifyPr(bare([REVIEW_LABELS.accepted, REVIEW_LABELS.human]));
    expect(v.decision).toBe('skip');
    expect(v.reviewHeld).toBe(true);
  });

  it('…and still MERGES a clean [accepted] — refusing the pairs costs no legitimate land', () => {
    expect(classifyPr(bare([REVIEW_LABELS.accepted])).decision).toBe('merge');
    // #2974 stays exactly as ratified: the reviewer verdict wins over a stale bounce.
    expect(classifyPr(bare([REVIEW_LABELS.accepted, REVIEW_LABELS.changes])).decision).toBe('merge');
  });

  // ── ROUND-2 MINOR 5: the #2832 interaction, resolved rather than inherited. ───────────────────────────────
  it('#2832 — a stale re-park still strips ready-to-merge, WITH or WITHOUT the staleAcceptance filter', () => {
    // `decideParkReadyStrip`'s `staleAcceptance` option shipped filtering `review:accepted` out of the effective
    // set BECAUSE "this same park is about to REMOVE it". #x9xqexm ends that removal, so the stated reason is
    // gone. The filter is kept (see its docstring) but the OUTCOME must no longer depend on it — otherwise a
    // future reader deleting the now-pointless filter silently leaves the go-ahead standing on a held PR. That
    // independence is what `hasUnclearedReviewLabel` refusing `accepted + pending` buys, and it is pinned here.
    const observed = [READY_TO_MERGE_LABEL, REVIEW_LABELS.accepted];
    for (const applyLabel of [REVIEW_LABELS.pending, REVIEW_LABELS.human]) {
      expect(decideParkReadyStrip(observed, { applyLabel, staleAcceptance: true })).toBe(true);
      expect(decideParkReadyStrip(observed, { applyLabel, staleAcceptance: false })).toBe(true);
    }
    // …and a legitimately queued PR (accepted + go-ahead, no hold) is still never un-queued, either way.
    expect(decideParkReadyStrip(observed, { applyLabel: null, staleAcceptance: false })).toBe(false);
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

describe('latestRequiredCheck — a superseded run must not outvote the one that finished (#xkfv491)', () => {
  // The exact PR #1042 rollup: a concurrency-cancelled run at index 0, the real SUCCESS at index 1.
  const supersededThenGreen = {
    statusCheckRollup: [
      { name: 'test', conclusion: 'CANCELLED', startedAt: '2026-08-05T18:34:02Z' },
      { name: 'test', conclusion: 'SUCCESS', startedAt: '2026-08-05T18:35:32Z' },
    ],
  };

  it('reads the LATEST run, not the first-listed one — the jam that held #1042/#1046/#1012', () => {
    expect(latestRequiredCheck(supersededThenGreen).conclusion).toBe('SUCCESS');
    expect(isRequiredCheckGreen(supersededThenGreen)).toBe(true);
  });

  it('the ci:failed twin no longer fires on the superseded cancelled run', () => {
    expect(isRequiredCheckFailed(supersededThenGreen)).toBe(false);
  });

  it('LATEST-WINS, not ignore-CANCELLED: a cancelled newest run means no current verdict', () => {
    const greenThenCancelled = {
      statusCheckRollup: [
        { name: 'test', conclusion: 'SUCCESS', startedAt: '2026-08-05T18:34:02Z' },
        { name: 'test', conclusion: 'CANCELLED', startedAt: '2026-08-05T18:35:32Z' },
      ],
    };
    expect(isRequiredCheckGreen(greenThenCancelled)).toBe(false);
    expect(isRequiredCheckFailed(greenThenCancelled)).toBe(true);
  });

  it('an in-flight run listed last suppresses the stale SUCCESS before it (live shape from PR #1046)', () => {
    // The run still executing is the newest, so it decides — the PR is neither green nor red while it runs.
    // No timestamp is consulted, so GitHub's `0001-01-01T00:00:00Z` sentinel for an unfinished run is inert.
    const staleGreenPlusQueued = {
      statusCheckRollup: [
        { name: 'test', conclusion: 'SUCCESS', status: 'COMPLETED', startedAt: '2026-08-05T18:35:32Z', completedAt: '2026-08-05T18:36:10Z' },
        { name: 'test', conclusion: '', status: 'QUEUED', startedAt: '2026-08-05T21:04:30Z', completedAt: '0001-01-01T00:00:00Z' },
      ],
    };
    expect(latestRequiredCheck(staleGreenPlusQueued).status).toBe('QUEUED');
    expect(isRequiredCheckGreen(staleGreenPlusQueued)).toBe(false); // in flight ⇒ no current verdict
    expect(isRequiredCheckFailed(staleGreenPlusQueued)).toBe(false); // and not red either
  });

  it('ignores timestamps entirely — creation order alone decides (no clock is read)', () => {
    // A rollup whose stamps CONTRADICT its order still resolves by order. This pins the trust-GitHub's-order
    // rule: the earlier cut ranked by a timestamp and, on this shape, returned the FAILURE instead.
    const stampsContradictOrder = {
      statusCheckRollup: [
        { name: 'test', conclusion: 'FAILURE', startedAt: '2026-08-05T18:40:00Z', completedAt: '2026-08-05T18:50:00Z' },
        { name: 'test', conclusion: 'SUCCESS', startedAt: '2026-08-05T18:30:00Z', completedAt: '2026-08-05T18:31:00Z' },
      ],
    };
    expect(isRequiredCheckGreen(stampsContradictOrder)).toBe(true);
    const noTimes = { statusCheckRollup: [{ name: 'test', conclusion: 'CANCELLED' }, { name: 'test', conclusion: 'SUCCESS' }] };
    expect(isRequiredCheckGreen(noTimes)).toBe(true);
    const badTimes = {
      statusCheckRollup: [
        { name: 'test', conclusion: 'CANCELLED', startedAt: 'not-a-date' },
        { name: 'test', conclusion: 'SUCCESS', startedAt: 'also-not-a-date' },
      ],
    };
    expect(isRequiredCheckGreen(badTimes)).toBe(true);
  });

  it('a LONE StatusContext decides when the workflow produced no `test` CheckRun', () => {
    // The only reachable shape for this branch. GitHub's combined status is DEDUPLICATED per context (and
    // `StatusContext` carries no `name`), so a rollup can hold at most ONE `test` StatusContext — an earlier
    // cut of this test asserted over two of them, a shape GitHub cannot emit, and left the single-entry case
    // (the one that actually reaches the `pool = matches` fallback) uncovered.
    const withStatus = (state) => ({
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'cla', conclusion: 'SUCCESS', startedAt: '2026-08-05T18:30:00Z' },
        { __typename: 'StatusContext', context: 'test', state, createdAt: '2026-08-05T18:35:32Z' },
      ],
    });
    expect(latestRequiredCheck(withStatus('SUCCESS')).context).toBe('test');
    expect(isRequiredCheckGreen(withStatus('SUCCESS'))).toBe(true);
    expect(isRequiredCheckGreen(withStatus('FAILURE'))).toBe(false);
    expect(isRequiredCheckFailed(withStatus('FAILURE'))).toBe(true);
    // A `cla` CheckRun is not a `test` CheckRun — the preference is PER NAME, so it must not suppress the
    // `test` status above and leave the check reading as unreported.
    expect(latestRequiredCheck(withStatus('SUCCESS'))).not.toBeNull();
  });

  it('a posted commit status can NEVER override the real check run (merge-gate bypass, PR #1049 review)', () => {
    // A `StatusContext` is postable through the commit-statuses API by anyone holding `statuses:write` — a
    // collaborator, a bot, an installed App. Plain last-wins across both shapes would let one posted AFTER the
    // real run clear the gate on a red tree. CheckRuns win whenever any exists. The live rollup shape: every
    // row carries `__typename` (verified against `gh pr view 1049 --json statusCheckRollup`).
    const spoofedGreen = {
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'test', conclusion: 'FAILURE', startedAt: '2026-08-05T18:00:00Z', completedAt: '2026-08-05T18:10:00Z' },
        { __typename: 'StatusContext', context: 'test', state: 'SUCCESS', createdAt: '2026-08-05T18:11:00Z' },
      ],
    };
    expect(latestRequiredCheck(spoofedGreen).conclusion).toBe('FAILURE');
    expect(isRequiredCheckGreen(spoofedGreen)).toBe(false);
    expect(isRequiredCheckFailed(spoofedGreen)).toBe(true);
  });

  it('single-run, missing-check and non-required cases are unchanged', () => {
    expect(latestRequiredCheck({ statusCheckRollup: [] })).toBeNull();
    expect(latestRequiredCheck({ statusCheckRollup: [{ name: 'cla', conclusion: 'SUCCESS' }] })).toBeNull();
    expect(isRequiredCheckGreen({ statusCheckRollup: [{ name: 'test', conclusion: 'SUCCESS' }] })).toBe(true);
    expect(isRequiredCheckGreen({ statusCheckRollup: [{ name: 'test', conclusion: 'CANCELLED' }] })).toBe(false);
    expect(isRequiredCheckFailed({ statusCheckRollup: [] })).toBe(false);
    expect(isRequiredCheckGreen(undefined)).toBe(false);
  });

  it('a PR whose ONLY run is cancelled still reads not-green (never landed on a superseded verdict)', () => {
    const onlyCancelled = { statusCheckRollup: [{ name: 'test', conclusion: 'CANCELLED', startedAt: '2026-08-05T18:34:02Z' }] };
    expect(isRequiredCheckGreen(onlyCancelled)).toBe(false);
    expect(isRequiredCheckFailed(onlyCancelled)).toBe(true);
  });
});

describe('collapseRollupToLatestPerName — the #2925 shared seam every rollup-folding reader routes through', () => {
  // The decisive #2925 case: CANCELLED at index 0, SUCCESS at index 1 for the SAME name.
  const cancelledThenSuccess = [
    { __typename: 'CheckRun', name: 'test', conclusion: 'CANCELLED' },
    { __typename: 'CheckRun', name: 'test', conclusion: 'SUCCESS' },
  ];

  it('collapses to ONE row per name, keeping the latest tier-preferred entry (CANCELLED at index 0 loses)', () => {
    const collapsed = collapseRollupToLatestPerName(cancelledThenSuccess);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].conclusion).toBe('SUCCESS');
  });

  it('preserves EVERY distinct name — only within-name entries collapse', () => {
    const roll = [
      { __typename: 'CheckRun', name: 'test', conclusion: 'CANCELLED' },
      { __typename: 'CheckRun', name: 'test', conclusion: 'SUCCESS' },
      { __typename: 'CheckRun', name: 'cla', conclusion: 'SUCCESS' },
    ];
    const collapsed = collapseRollupToLatestPerName(roll);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.find((c) => c.name === 'test').conclusion).toBe('SUCCESS');
    expect(collapsed.find((c) => c.name === 'cla').conclusion).toBe('SUCCESS');
  });

  it('is the SAME rule `latestRequiredCheck` uses — a by-name lookup over this output', () => {
    const pr = { statusCheckRollup: cancelledThenSuccess };
    expect(latestRequiredCheck(pr).conclusion)
      .toBe(collapseRollupToLatestPerName(cancelledThenSuccess).find((c) => c.name === 'test').conclusion);
  });

  it('tolerant of an absent/odd rollup', () => {
    expect(collapseRollupToLatestPerName(null)).toEqual([]);
    expect(collapseRollupToLatestPerName(undefined)).toEqual([]);
    expect(collapseRollupToLatestPerName([])).toEqual([]);
  });
});

describe('rollupRowKind — the union member comes off `__typename`, it is not guessed from `name` (#1049 r3)', () => {
  it('reads the authoritative tag when present', () => {
    expect(rollupRowKind({ __typename: 'CheckRun', name: 'test' })).toBe('CheckRun');
    expect(rollupRowKind({ __typename: 'StatusContext', context: 'test' })).toBe('StatusContext');
  });

  it('an ABSENT or unrecognised `__typename` is UNTAGGED — never promoted to CheckRun', () => {
    expect(rollupRowKind({ name: 'test', conclusion: 'SUCCESS' })).toBe('untagged');
    expect(rollupRowKind({ __typename: 'SomeFutureContext', name: 'test' })).toBe('untagged');
    expect(rollupRowKind(null)).toBe('untagged');
    expect(rollupRowKind({})).toBe('untagged');
  });

  it('falls back to shape ONLY for the unambiguous legacy case: a `context` with no `name`', () => {
    expect(rollupRowKind({ context: 'test', state: 'SUCCESS' })).toBe('StatusContext');
    // `rollupToCheckRows` (we:scripts/fetch-parked.mjs#rollupToCheckRows) normalises a StatusContext to
    // `{ name: c.name || c.context }`. Under the old `name`-presence inference that row classified as a
    // CheckRun; it must not.
    expect(rollupRowKind({ name: 'test', bucket: 'pass' })).toBe('untagged');
  });

  it('a TAGGED CheckRun outranks an untagged row listed after it', () => {
    // The tier ladder is CheckRun → untagged → StatusContext, so a row of unknown provenance cannot displace
    // the verdict of a row GitHub itself labelled a CheckRun.
    const pr = {
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'test', conclusion: 'FAILURE' },
        { name: 'test', conclusion: 'SUCCESS' }, // untagged — lower tier, so it never decides
      ],
    };
    expect(latestRequiredCheck(pr).conclusion).toBe('FAILURE');
    expect(isRequiredCheckGreen(pr)).toBe(false);
  });

  it('a tagged StatusContext still decides when NO CheckRun reported that name', () => {
    const pr = { statusCheckRollup: [{ __typename: 'StatusContext', context: 'test', state: 'SUCCESS' }] };
    expect(latestRequiredCheck(pr).state).toBe('SUCCESS');
    expect(isRequiredCheckGreen(pr)).toBe(true);
  });

  it('an all-untagged rollup still resolves latest-wins (fixtures / re-normalised rows keep working)', () => {
    const pr = { statusCheckRollup: [{ name: 'test', conclusion: 'CANCELLED' }, { name: 'test', conclusion: 'SUCCESS' }] };
    expect(isRequiredCheckGreen(pr)).toBe(true);
  });
});

describe('#2899 A5 — resolveIdsForLandedPass: which ids the LABEL lander resolves after JIT numbering', () => {
  // Context: this drain single-sourced lane-drain's NUMBERING but never its RESOLVING, so it assigned the NNN
  // and left `status:` untouched — delivered work kept ranking Tier-A agent-ready and got re-packed (#2880,
  // #2450). The flip now runs here, and it must target the id the card carries AFTER numbering, not before.
  it('re-keys a hash-born item to the NNN numbering just minted for it', () => {
    expect(resolveIdsForLandedPass({
      landedItems: new Set(['xdxlevu']),
      assigned: [{ hash: 'xdxlevu', nnn: '2899' }],
    })).toEqual(['2899']);
  });

  it('leaves an already-numeric item alone', () => {
    expect(resolveIdsForLandedPass({ landedItems: new Set([2880]), assigned: [] })).toEqual([2880]);
  });

  it('KEEPS a hash with no assignment rather than dropping it', () => {
    // Numbering can legitimately be a no-op (the card landed already-numbered, or a concurrent lander minted
    // it). Dropping the id here would silently re-open the stranded-item hole this closes; `resolveLandedItem`
    // is itself a safe no-op when the path does not resolve, so keeping it costs nothing.
    expect(resolveIdsForLandedPass({ landedItems: new Set(['xnomatch']), assigned: [{ hash: 'xother', nnn: '1' }] }))
      .toEqual(['xnomatch']);
  });

  it('de-duplicates when a hash and its minted NNN both appear, preserving first-seen order', () => {
    expect(resolveIdsForLandedPass({
      landedItems: ['xaaa', 'xbbb', '2900', 'xaaa'],
      assigned: [{ hash: 'xaaa', nnn: '2900' }, { hash: 'xbbb', nnn: '2901' }],
    })).toEqual(['2900', '2901']);
  });

  it('is empty for a pass that landed nothing, and tolerates junk inputs', () => {
    expect(resolveIdsForLandedPass({ landedItems: new Set(), assigned: [] })).toEqual([]);
    expect(resolveIdsForLandedPass()).toEqual([]);
    expect(resolveIdsForLandedPass({ landedItems: [null, undefined, 'x1'], assigned: null })).toEqual(['x1']);
    expect(resolveIdsForLandedPass({ landedItems: ['x1'], assigned: [{ hash: 'x1' }, null, { nnn: '5' }] })).toEqual(['x1']);
  });
});

describe('#2899 B5 — the resolve gate requires the WHOLE couple to have landed, not just the carrier', () => {
  // PR #1012 round-3 review, B5. The original gate rested on a comment claiming "WE-last ordering means the
  // carrier merges only after its impl half did". Running the cascade disproves it: the couple decision is
  // computed once at PLAN time and the in-cascade `replan` re-runs planLabelDrain WITHOUT the couple join, so an
  // impl whose `gh pr merge` throws flips to `skip` while the carrier still lands. Resolving off the carrier
  // alone then marks the card resolved on main with the implementation PR still OPEN — nothing re-dispatches it,
  // which is the forever-block this item exists to close, reappearing inside the fix.
  const carrier = { item: 'xcarr01', headRef: 'lane/xcarr01-we', manifestRefs: ['lane/xcarr01-fui', 'lane/xcarr01-we'] };

  it('DEFERS the flip when a sibling half is still open (the impl merge failed mid-cascade)', () => {
    expect(resolveIdsForLandedPass({
      landedItems: new Set(['xcarr01']),
      assigned: [{ hash: 'xcarr01', nnn: '2910' }],
      carriers: [carrier],
      openHeadRefs: ['lane/xcarr01-fui'],          // the impl PR never merged — still open after the cascade
    })).toEqual([]);
  });

  it('RESOLVES when every sibling ref has left the open set (the whole couple landed)', () => {
    expect(resolveIdsForLandedPass({
      landedItems: new Set(['xcarr01']),
      assigned: [{ hash: 'xcarr01', nnn: '2910' }],
      carriers: [carrier],
      openHeadRefs: ['lane/unrelated-other'],
    })).toEqual(['2910']);
  });

  it('ignores the carrier\'s OWN head ref — it is the half that just merged, not a blocker', () => {
    expect(resolveIdsForLandedPass({
      landedItems: new Set(['xcarr01']),
      assigned: [],
      carriers: [carrier],
      openHeadRefs: ['lane/xcarr01-we'],           // the carrier itself, stale in the pass-start snapshot
    })).toEqual(['xcarr01']);
  });

  it('is unchanged for a caller that supplies no couple shape (single-repo item, or an older caller)', () => {
    expect(resolveIdsForLandedPass({ landedItems: new Set(['xsolo01']), assigned: [{ hash: 'xsolo01', nnn: '2911' }] }))
      .toEqual(['2911']);
    // A carrier entry with no refs blocks nothing.
    expect(resolveIdsForLandedPass({
      landedItems: new Set(['xsolo01']),
      assigned: [],
      carriers: [{ item: 'xsolo01', headRef: 'lane/xsolo01-we', manifestRefs: [] }],
      openHeadRefs: ['lane/whatever'],
    })).toEqual(['xsolo01']);
  });

  it('gates per couple — one blocked couple does not suppress a healthy one', () => {
    const other = { item: 'xcarr02', headRef: 'lane/xcarr02-we', manifestRefs: ['lane/xcarr02-fui', 'lane/xcarr02-we'] };
    expect(resolveIdsForLandedPass({
      landedItems: ['xcarr01', 'xcarr02'],
      assigned: [],
      carriers: [carrier, other],
      openHeadRefs: ['lane/xcarr01-fui'],          // only couple 01 is half-landed
    })).toEqual(['xcarr02']);
  });
});

describe('#2899 jury J2/J4 — planResolveOnLand is TOTAL: nothing is silently withheld', () => {
  // The first cut returned only the ids to flip, so a couple the B5 gate withheld vanished with no log line, no
  // --json key and no retry — while the comment claimed it would "defer to a later pass". That is false:
  // `landedThisPass` is only populated when a carrier merges IN that pass, so a later pass never re-lists it.
  // The deferral is right; the silence was the defect. A silent skip inside a fix for silent skips cannot ship.
  const we = { item: 'xcarr01', repo: null, isWe: true, headRef: 'lane/xcarr01-we', manifestRefs: ['lane/xcarr01-fui', 'lane/xcarr01-we'] };

  it('every landed item lands in exactly ONE bucket — resolve or deferred, never neither', () => {
    const p = planResolveOnLand({
      landedItems: ['xcarr01', 'xsolo01'],
      assigned: [{ hash: 'xcarr01', nnn: '2910' }, { hash: 'xsolo01', nnn: '2911' }],
      carriers: [we],
      openHeadRefs: ['lane/xcarr01-fui'],
    });
    expect(p.resolve).toEqual(['2911']);
    expect(p.deferred.map((d) => d.id)).toEqual(['2910']);
    // TOTALITY: the union covers every distinct landed item, with no overlap.
    expect([...p.resolve, ...p.deferred.map((d) => d.id)].sort()).toEqual(['2910', '2911']);
  });

  it('names the blocking ref in the deferral reason, so the report is actionable', () => {
    const p = planResolveOnLand({ landedItems: ['xcarr01'], assigned: [], carriers: [we], openHeadRefs: ['lane/xcarr01-fui'] });
    expect(p.deferred[0].reason).toMatch(/lane\/xcarr01-fui/);
  });

  it('J4 — the WE carrier wins the couple key even when the impl half is seen LAST', () => {
    // Both halves carry a manifest for one item. With an item-only last-write-wins key the impl's headRef won,
    // and the gate's `r !== couple.headRef` exemption then SKIPPED the still-open impl ref — the safety check
    // disabling itself. Ordered impl-last on purpose: this is the input that used to pass.
    const impl = { item: 'xcarr01', repo: 'chalbert/frontierui', isWe: false, headRef: 'lane/xcarr01-fui', manifestRefs: ['lane/xcarr01-fui', 'lane/xcarr01-we'] };
    const p = planResolveOnLand({
      landedItems: ['xcarr01'],
      assigned: [],
      carriers: [we, impl],
      openHeadRefs: ['lane/xcarr01-fui'],       // the impl half never merged
    });
    expect(p.resolve).toEqual([]);
    expect(p.deferred.map((d) => d.id)).toEqual(['xcarr01']);
  });

  it('the back-compat shim still returns just the ids to flip', () => {
    expect(resolveIdsForLandedPass({ landedItems: ['xcarr01'], assigned: [], carriers: [we], openHeadRefs: ['lane/xcarr01-fui'] })).toEqual([]);
    expect(resolveIdsForLandedPass({ landedItems: ['xcarr01'], assigned: [], carriers: [we], openHeadRefs: [] })).toEqual(['xcarr01']);
  });

  it('is total for the trivial cases too', () => {
    expect(planResolveOnLand()).toEqual({ resolve: [], deferred: [] });
    expect(planResolveOnLand({ landedItems: [null, undefined] })).toEqual({ resolve: [], deferred: [] });
  });
});

describe('merge-ai-prs — #xc7p3q9: couple-join decoupled from the ready-to-merge / candidate scope', () => {
  // Sibling of PR #2880/xq985wu (which decoupled merge-ORDERING). This decouples the COUPLE-JOIN gate: a coupled
  // impl half must defer/land off its carrier's HEALTH read from the label/only/repo-BLIND, constellation-wide
  // open-PR context — NOT off the carrier's presence in the `--only`/`--repos`-NARROWED candidate list. Every
  // case drives the REAL runCli sequence through the SHARED `planDrainPass` (narrowPrsByRepo → buildDrainVerdicts
  // (classifyPr + attach) → buildCarrierHealth → joinImplToCouples → planLabelDrain). No hand-built verdicts, no
  // re-typed composition (B12) — a future edit that drops `truncated`/`contextComplete` from the join breaks here.
  const WE = null;                                   // the local WE clone (repo=null, key 'cwd') — runCli's convention
  const FUI = 'chalbert/frontierui';
  const localSlug = 'chalbert/web-everything';
  const isLocalRepo = (repo) => repo == null || repo === localSlug;
  const claude = { authors: [{ name: 'Claude Opus 4.8', email: 'noreply@anthropic.com' }] };
  const green = [{ name: 'test', conclusion: 'SUCCESS' }];
  // a landable AI PR object shaped exactly as `gh pr list --json …` returns it (classifyPr rules it 'merge')
  const ghPr = (number, headRefName, { labels = [] } = {}) =>
    ({ number, title: 't', body: 'what changed and why', headRefName, statusCheckRollup: green, mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', labels });

  // The label/only-BLIND openPrContext (constellation-wide, as collectOpenPrContext produces over CONTEXT_REPOS)
  // holding ONE WE carrier — present here regardless of how the candidate sweep was narrowed. It is built through
  // the SHARED, exported `reduceOpenPrContext` (the ONE place `contextComplete` is computed), so the tests drive
  // the real relationship, never a re-typed formula (R4 — the round-1 hole was a hand-computed `contextComplete`).
  //   - `degradedRead:true`  → the REAL thrown-read shape `{manifest:null, degraded:true}` (readPrManifest threw).
  //   - `degraded:true`      → the commits-only failure (valid manifest + degraded flag) — the harmless half.
  //   - `listingFailed:true` → a swallowed `gh pr list` error (B2): the carrier is ABSENT from the context maps.
  //   - `truncated:true`     → the listing hit the `--limit` cap (the REAL trigger: a padded, over-cap page).
  //   - `extraOpenPrs`       → additional open PRs the blind context shows (e.g. the impl half, for R7).
  const contextWithCarrier = ({ carrierNum = 77, carrierRepo = null, item = 'xcarr01', refs = ['lane/xcarr01-fui', 'lane/xcarr01-we'], labels = ['ready-to-merge'], manifest = null, degraded = false, degradedRead = false, truncated = false, listingFailed = false, extraOpenPrs = [] } = {}) => {
    const m = degradedRead ? null : (manifest ?? { item, repos: refs.map((ref) => ({ repo: ref.endsWith('-we') ? 'we' : 'fui', ref })), blockedBy: [], stackParents: [] });
    const key = `${carrierRepo || 'cwd'}::${carrierNum}`;
    const isDeg = degraded || degradedRead;
    const carrierRef = (m && m.repos.find((r) => r.repo === 'we')?.ref) || refs.find((r) => r.endsWith('-we')) || refs[0];
    // build the per-repo listing + per-PR reads the way collectOpenPrContext does, then REDUCE via the ONE shared
    // fn — so `truncated` is derived from a REAL over-cap page and `contextComplete` from the shared formula.
    const carrierPr = ghPr(carrierNum, carrierRef, { labels });
    const pad = truncated ? Array.from({ length: OPEN_PR_LIST_LIMIT }, (_, i) => ghPr(900000 + i, `lane/pad-${i}`, {})) : [];
    const listings = [{ repo: carrierRepo, prs: listingFailed ? [] : [carrierPr, ...extraOpenPrs, ...pad], ...(listingFailed ? { failed: true } : {}) }];
    const reads = new Map();
    if (!listingFailed) reads.set(key, { manifest: m, commits: [], degraded: isDeg });
    for (const p of extraOpenPrs) reads.set(`${carrierRepo || 'cwd'}::${p.number}`, { manifest: null, commits: [], degraded: false });
    return reduceOpenPrContext({ listings, reads, reconcileRan: true });
  };

  // Faithful reproduction of runCli's post-listing sequence via the SHARED `planDrainPass` — the ONE wiring runCli
  // itself calls (B12). Returns { verdicts, plan } so a test can assert the DISCRIMINATING per-verdict fields
  // (coupleDeferReason / joinedToCouple / coupleCarrier), not just the ready/deferred number arrays.
  const drivePlan = ({ listings, REPOS, onlyPr = null, onlyRepo = null, openPrContext, reads, escalationRelief = { prs: [], passWide: false }, label = 'ready-to-merge' }) =>
    planDrainPass({
      listings,
      openPrContext,
      repos: REPOS,
      onlyPr,
      onlyRepo,
      readOf: (repo, num) => reads.get(`${repo || 'cwd'}::${num}`),
      requiredCheck: 'test',
      escalationRelief,
      label,
      isLocalRepo,
      localSlug,
    });

  // #xc7p3q9 (B7 invariant) — for a plan built from >1-repo manifests, no carrier may be in `ready` while a verdict
  // JOINED to it is in `deferred` (the couple would land WE-first with its impl still open).
  const noWeFirstSplit = ({ verdicts, plan }) => {
    const readyNums = new Set(plan.ready.map((c) => c.num));
    const deferredNums = new Set(plan.deferred.map((d) => d.num));
    return verdicts
      .filter((v) => v.joinedToCouple != null && v.coupleCarrier && deferredNums.has(v.num))
      .every((v) => !readyNums.has(v.coupleCarrier.num));
  };

  // `--only <impl half>` narrows the candidate list to the ONE frontierui PR; the WE carrier is absent from it
  // (stripped / narrowed) but present in the blind context.
  const implOnly = (openPrContext, { implNum = 55, headRef = 'lane/xcarr01-fui' } = {}) => ({
    REPOS: [WE, FUI],
    listings: [{ repo: WE, prs: [] }, { repo: FUI, prs: [ghPr(implNum, headRef)] }],
    reads: new Map([[`${FUI}::${implNum}`, { commits: [claude, claude], manifest: null }]]),
    onlyPr: String(implNum),
    onlyRepo: FUI,
    openPrContext,
  });

  it('carrierDeferDecision — the pure fail-closed table (truncated → absent×completeness → degraded → unnameable → held)', () => {
    expect(carrierDeferDecision({ health: { held: false, nameable: true, degraded: false }, truncated: true })).toEqual({ defer: true, reason: 'truncated', humanTerminal: false });
    // B1/B2/B3 — absence in an INCOMPLETE context is UNKNOWN → fail closed; only a COMPLETE context proves "landed".
    expect(carrierDeferDecision({ health: null, contextComplete: false })).toEqual({ defer: true, reason: 'incomplete-context', humanTerminal: false });
    expect(carrierDeferDecision({ health: null })).toEqual({ defer: true, reason: 'incomplete-context', humanTerminal: false });   // default: not proven complete
    expect(carrierDeferDecision({ health: null, contextComplete: true })).toEqual({ defer: false, reason: 'absent-landed', humanTerminal: false });
    expect(carrierDeferDecision({ health: { held: false, nameable: true, degraded: true }, contextComplete: true })).toEqual({ defer: true, reason: 'degraded', humanTerminal: false });
    expect(carrierDeferDecision({ health: { held: false, nameable: false, degraded: false }, contextComplete: true })).toEqual({ defer: true, reason: 'unnameable', humanTerminal: false });
    expect(carrierDeferDecision({ health: { held: true, nameable: true, degraded: false }, contextComplete: true })).toEqual({ defer: true, reason: 'held', humanTerminal: true });
    expect(carrierDeferDecision({ health: { held: false, nameable: true, degraded: false }, contextComplete: true })).toEqual({ defer: false, reason: 'healthy', humanTerminal: false });
    // #xc7p3q9 (R9) — a HELD carrier with read noise defers on the noisier reason, but `humanTerminal` still flags
    // the hold (it won't clear by polling) so idle accounting treats the couple as settled.
    expect(carrierDeferDecision({ health: { held: true, nameable: true, degraded: true }, contextComplete: true })).toEqual({ defer: true, reason: 'degraded', humanTerminal: true });
    expect(carrierDeferDecision({ health: { held: true, nameable: true, degraded: false }, truncated: true })).toEqual({ defer: true, reason: 'truncated', humanTerminal: true });
  });

  it('AC1 (Fix 1) — `--only <impl>` with a HEALTHY open labelled carrier in a COMPLETE context → impl LANDS', () => {
    const { verdicts, plan } = drivePlan(implOnly(contextWithCarrier({ labels: ['ready-to-merge'] })));
    expect(plan.ready.map((c) => c.num)).toEqual([55]);
    expect(plan.deferred).toEqual([]);
    // B11 — DISCRIMINATING assertion so this fails on a diff-revert (not a baseline-guard): the impl was JOINED to
    // the healthy carrier and cleared by its HEALTH read, not merely treated as an orphan.
    const impl = verdicts.find((v) => v.num === 55);
    expect(impl.joinedToCouple).toBe('xcarr01');
    expect(impl.coupleDeferReason).toBe('healthy');
  });

  it('AC1-mirror (B3) — a FULL sweep with an EMPTY/INCOMPLETE context (RECONCILE false) → the impl DEFERS', () => {
    // The old mirror asserted "empty context → impl ready" — that WAS the B3 fail-open. An incomplete context can
    // never prove the carrier landed, so the coupled impl must fail closed. The carrier is a live candidate here
    // (a full sweep), so the impl joins it and defers; the two-sided defer (B7) holds the carrier back too.
    const emptyCtx = { prsByRepo: new Map(), manifestByPr: new Map(), degradedByPr: new Map(), openItems: new Set(), truncated: false, contextComplete: false };
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const res = drivePlan({
      REPOS: [WE, FUI],
      listings: [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }],
      onlyPr: null,
      onlyRepo: null,
      openPrContext: emptyCtx,
      reads: new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]),
    });
    expect(res.plan.ready).toEqual([]);                                   // neither half lands
    expect(res.plan.deferred.map((d) => d.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(res.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('incomplete-context');
    expect(noWeFirstSplit(res)).toBe(true);
  });

  it('AC2 — `--only <impl>` with a HELD carrier → impl DEFERS (the gate still fires when it should)', () => {
    const { plan } = drivePlan(implOnly(contextWithCarrier({ labels: [REVIEW_LABELS.changes] })));
    expect(plan.ready).toEqual([]);
    expect(plan.deferred.map((d) => d.num)).toEqual([55]);
    expect(plan.deferred[0].heldCoupleOnly).toBe(true);
  });

  it('AC3 (Fix 1/2) — `--repos=<implSlug>` scope where WE is NOT a candidate → fail CLOSED past a held carrier', () => {
    // The candidate scope is frontierui ALONE (WE excluded), but the constellation-wide blind context still holds
    // the held WE carrier — so the impl joins it and defers rather than orphan-landing.
    const { plan } = drivePlan({
      REPOS: [FUI],
      listings: [{ repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }],
      onlyPr: null,
      onlyRepo: null,
      openPrContext: contextWithCarrier({ labels: [REVIEW_LABELS.human] }),
      reads: new Map([[`${FUI}::55`, { commits: [claude, claude], manifest: null }]]),
    });
    expect(plan.ready).toEqual([]);
    expect(plan.deferred.map((d) => d.num)).toEqual([55]);
  });

  it('AC4 (B4) — UNNAMEABLE carrier via the REAL NaN→JSON→"item":null→0 round-trip → fail CLOSED', () => {
    // Reproduce the PRODUCTION shape end-to-end: buildManifest stamps `item: NaN`, JSON.stringify prints it as
    // `"item": null`, and the drain RE-READS that off the PR body — so the manifest the gate sees carries
    // `item: null`, which the OLD `isItemId` re-normalized to `0` (nameable:true → healthy → land). The fix reads
    // it unnameable. Driving the full round-trip (not an in-memory NaN) is what the review required.
    const built = buildManifest({ item: undefined, repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }] });
    expect(Number.isNaN(built.item)).toBe(true);
    const m = JSON.parse(JSON.stringify(built));        // the re-read shape the drain actually consumes
    expect(m.item).toBe(null);                          // NaN serialized to null (NOT preserved as NaN)
    // sanity: the health map derives `nameable` from the SAME item expression, and reads this shape unnameable.
    const ctx = contextWithCarrier({ manifest: m, labels: ['ready-to-merge'] });
    expect([...buildCarrierHealth(ctx).values()][0].nameable).toBe(false);
    const { verdicts, plan } = drivePlan(implOnly(ctx));
    expect(plan.ready).toEqual([]);
    expect(plan.deferred.map((d) => d.num)).toEqual([55]);
    expect(verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('unnameable');
    // NOT a held-couple defer (fail-closed on a bad id, not a human hold) → does NOT count as idle.
    expect(plan.deferred[0].heldCoupleOnly).toBeUndefined();
  });

  it('AC5 (Fix 2) — a TRUNCATED listing → fail CLOSED (and NOT idle)', () => {
    const t = drivePlan(implOnly(contextWithCarrier({ labels: ['ready-to-merge'], truncated: true })));
    expect(t.plan.deferred.map((d) => d.num)).toEqual([55]);
    expect(t.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('truncated');
    expect(deferralsAllHeldCouple(t.plan.deferred)).toBe(false);
  });

  it('AC5b (B1) — the REAL degraded read `{manifest:null, degraded:true}` (readPrManifest THREW) → fail CLOSED', () => {
    // The old `buildCarrierHealth` did `if (!manifest || !Array.isArray(manifest.repos)) continue;` — dropping the
    // EXACT shape a thrown read emits BEFORE the `degraded` branch could fire, so the degraded branch was
    // unreachable in the case it exists for. Drive that real shape through a FULL sweep (the carrier is a live
    // candidate so its refs come from the sweep read; only the CONTEXT read threw). Both halves must fail closed.
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const ctx = contextWithCarrier({ carrierNum: 77, degradedRead: true });   // manifestByPr → null + degradedByPr → true
    expect(ctx.manifestByPr.get('cwd::77')).toBe(null);                        // the thrown-read shape (not a valid manifest)
    expect([...buildCarrierHealth(ctx).values()][0]).toMatchObject({ degraded: true, unreadable: true, nameable: false });
    const res = drivePlan({
      REPOS: [WE, FUI],
      listings: [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }],
      onlyPr: null,
      onlyRepo: null,
      openPrContext: ctx,
      reads: new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]),
    });
    expect(res.plan.ready).toEqual([]);
    expect(res.plan.deferred.map((d) => d.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(res.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('degraded');
    expect(deferralsAllHeldCouple(res.plan.deferred)).toBe(false);            // an error may clear on re-fetch → keep polling
    expect(noWeFirstSplit(res)).toBe(true);
  });

  it('AC6 (Fix 3) — a pass whose ONLY deferral is a human-held couple counts as IDLE; a fail-closed defer does not', () => {
    const held = drivePlan(implOnly(contextWithCarrier({ labels: [REVIEW_LABELS.human] }))).plan;
    expect(deferralsAllHeldCouple(held.deferred)).toBe(true);   // human hold won't clear by polling → idle
    const trunc = drivePlan(implOnly(contextWithCarrier({ labels: ['ready-to-merge'], truncated: true }))).plan;
    expect(deferralsAllHeldCouple(trunc.deferred)).toBe(false); // may clear on a re-fetch → keep polling
    expect(deferralsAllHeldCouple([])).toBe(false);             // an empty deferred set is not "held-couple idle"
  });

  it('AC6b (B5/R6) — decideBatchesIdleExit SUBTRACTS the held couple\'s members from `considered` (not a wholesale waiver)', () => {
    // The production launcher (drain-push-at-close) runs `--watch --until-batches-idle` with NO `--max-idle`, so it
    // exits via `decideBatchesIdleExit` — where `considered = verdicts.length` counts BOTH held-couple halves. R6:
    // subtract those members rather than waiving the queue-empty check wholesale (which exited with in-flight,
    // still-running-CI candidates in the count).
    const heldDeferred = drivePlan(implOnly(contextWithCarrier({ labels: [REVIEW_LABELS.human] }))).plan.deferred;
    const truncDeferred = drivePlan(implOnly(contextWithCarrier({ labels: ['ready-to-merge'], truncated: true }))).plan.deferred;
    // the whole queue IS the held couple (both members) → EXIT (was blocked forever on `considered>0`).
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 2, deferred: heldDeferred, heldCoupleMembers: 2, batchNonRunningStreak: 2, debounce: 2 })).toBe(true);
    // R6 REGRESSION — in-flight NON-held candidates (running CI) ALONGSIDE the held couple → NO exit (the wholesale
    // waiver wrongly exited here, dropping the in-flight PRs).
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 9, deferred: heldDeferred, heldCoupleMembers: 1, batchNonRunningStreak: 2, debounce: 2 })).toBe(false);
    // a truncated fail-closed defer is NOT a held member (heldCoupleMembers 0) → keep polling.
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 2, deferred: truncDeferred, heldCoupleMembers: 0, batchNonRunningStreak: 2, debounce: 2 })).toBe(false);
    // an empty queue still exits (the pre-existing behaviour is preserved).
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 0, heldCoupleMembers: 0, batchNonRunningStreak: 2, debounce: 2 })).toBe(true);
    // a queue of non-held work (red PRs churning, nothing deferred) still keeps polling.
    expect(decideBatchesIdleExit({ enabled: true, idlePass: true, considered: 3, heldCoupleMembers: 0, batchNonRunningStreak: 2, debounce: 2 })).toBe(false);
  });

  it('AC7 — no regression: FULL sweep, all couples healthy → same ready/deferred partition as the merge base', () => {
    const item = 'xcarr01';
    const carrierManifest = { item, repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const { verdicts, plan } = drivePlan({
      REPOS: [WE, FUI],
      listings: [
        { repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] },
        { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] },
      ],
      onlyPr: null,
      onlyRepo: null,
      openPrContext: contextWithCarrier({ carrierNum: 77, item, manifest: carrierManifest, labels: ['ready-to-merge'] }),
      reads: new Map([
        [`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }],
        [`${FUI}::55`, { commits: [claude, claude], manifest: null }],
      ]),
    });
    expect(plan.ready.map((c) => c.num).sort((a, b) => a - b)).toEqual([55, 77]);   // carrier + impl both land
    expect(plan.deferred).toEqual([]);
    // B11 — DISCRIMINATING assertion (fails on a diff-revert): the impl actually JOINED the couple and cleared on
    // its carrier's HEALTH, rather than passing merely because it read as an unjoined orphan.
    const impl = verdicts.find((v) => v.num === 55);
    expect(impl.joinedToCouple).toBe('xcarr01');
    expect(impl.coupleDeferReason).toBe('healthy');
  });

  it('B2 — a SWALLOWED `gh pr list` failure (carrier ABSENT from an incomplete context) → fail CLOSED, not orphan-land', () => {
    // `collectOpenPrContext`'s `catch { return [repo, [], true] }` now marks the context INCOMPLETE. The carrier is
    // a live candidate in the SWEEP (so the impl joins it), but ABSENT from the CONTEXT maps (its listing threw).
    // Absence in an incomplete context is UNKNOWN → defer. Contrast: the SAME absence in a COMPLETE context is a
    // real land → the impl proceeds.
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const listings = [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }];
    const reads = new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]);
    const failed = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: contextWithCarrier({ listingFailed: true }) });
    expect(failed.plan.ready).toEqual([]);
    expect(failed.plan.deferred.map((d) => d.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(failed.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('incomplete-context');
    // the discriminating contrast: the SAME sweep with a COMPLETE context (listing succeeded, carrier present +
    // healthy) → the impl reads its carrier's real HEALTH and lands (it is the FAILED-listing flag, not the
    // absence itself, that fails the case closed).
    const complete = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge'] }) });
    expect(complete.plan.ready.map((c) => c.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(complete.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('healthy');
  });

  it('B6 — the couple gate\'s `held` agrees with classifyPr\'s under the `--no-review-escalation` waiver', () => {
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const listings = [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge', REVIEW_LABELS.pending] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }];
    const reads = new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]);
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge', REVIEW_LABELS.pending] });
    // WITHOUT the waiver: the carrier is review:pending → classifyPr skips it AND the gate reads it held → impl defers.
    const noWaiver = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: ctx });
    expect(noWaiver.plan.ready).toEqual([]);
    expect(noWaiver.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('held');
    // WITH the pass-wide waiver + a label: classifyPr lands the carrier AND the gate must read it NOT held (else the
    // couple lands WE-first — the B6 inversion). Both halves land; the two `held` notions agree.
    const waiver = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: ctx, escalationRelief: { prs: [], passWide: true }, label: 'ready-to-merge' });
    expect(waiver.plan.ready.map((c) => c.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(waiver.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('healthy');
  });

  // #3308 (round-2 correctness fix) — THE REGRESSION TEST THE ROUND-1 REVIEW OWED, and it is deliberately
  // DRIVEN, not hand-stamped. Every other `reliefWaived` assertion in this file sets the flag by hand and so
  // could not see the actual bug: `v.reliefWaived` is written ONLY inside the escalation loop, which
  // `REVIEW_ESCALATION = label && !escalationRelief.passWide` switches OFF for the bare/pass-wide form of
  // `--no-review-escalation` — so a PR merged past its review hold by that form reached the coverage reader
  // with NO relief flag set at all and was announced as if nothing had been waived. These cases drive the same
  // `drivePlan` (→ `planDrainPass` → `buildDrainVerdicts` → `classifyPr`) harness B6 uses, so the flag is
  // DERIVED from the real wiring; hand-setting it could not have reddened.
  it('B6b — the PASS-WIDE waiver is recorded on the verdict it waived (#3308), not only the scoped one', () => {
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const listings = [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge', REVIEW_LABELS.pending] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }];
    const reads = new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]);
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge', REVIEW_LABELS.pending] });
    const waiver = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: ctx, escalationRelief: { prs: [], passWide: true }, label: 'ready-to-merge' });
    const carrier = waiver.verdicts.find((v) => v.num === 77);
    expect(carrier.decision).toBe('merge');           // it really does land past its review:pending hold
    expect(carrier.reliefPassWide).toBe(true);        // ...and the verdict now says a waiver is why
    // and the coverage reader, fed from THAT verdict exactly as the land path feeds it, announces the gap.
    const gaps = reviewCoverageGaps({ comments: [], headSha: null, reliefWaived: carrier.reliefWaived === true, reliefPassWide: carrier.reliefPassWide === true });
    expect(gaps.map((g) => g.code)).toContain('relief-waived-pass-wide');
  });

  // The other side of the same wiring: a SCOPED `=<pr#>` run must NOT be tagged pass-wide, or every scoped
  // relief would be announced as "the rubric was off for the whole pass" — a strictly false statement.
  it('B6c — a SCOPED --no-review-escalation=<pr#> is NOT recorded as a pass-wide waiver (#3308)', () => {
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const listings = [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge', REVIEW_LABELS.pending] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }];
    const reads = new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]);
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge', REVIEW_LABELS.pending] });
    const scoped = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: ctx, escalationRelief: { prs: [77], passWide: false }, label: 'ready-to-merge' });
    const carrier = scoped.verdicts.find((v) => v.num === 77);
    expect(carrier.decision).toBe('merge');
    expect(carrier.reliefPassWide).toBeUndefined();
  });

  // A bare `--no-review-escalation` with NO `--label` waived nothing: `REVIEW_ESCALATION = label && ...` is
  // already falsy on the missing label, so the rubric was never going to run and the flag changed no outcome.
  // Announcing a waiver there would be this item's own error pointed the other way — a false record.
  it('B6d — a pass-wide flag with NO --label records no waiver, because none happened (#3308)', () => {
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const listings = [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }];
    const reads = new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]);
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge'] });
    const unlabelled = drivePlan({ REPOS: [WE, FUI], listings, onlyPr: null, onlyRepo: null, reads, openPrContext: ctx, escalationRelief: { prs: [], passWide: true }, label: null });
    expect(unlabelled.verdicts.find((v) => v.num === 77).reliefPassWide).toBeUndefined();
  });

  it('B7 — a healthy carrier whose impl fails closed (truncated) DEFERS BOTH halves (never lands WE-first)', () => {
    const carrierManifest = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };
    const res = drivePlan({
      REPOS: [WE, FUI],
      listings: [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [ghPr(55, 'lane/xcarr01-fui')] }],
      onlyPr: null,
      onlyRepo: null,
      openPrContext: contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifest, labels: ['ready-to-merge'], truncated: true }),
      reads: new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifest }], [`${FUI}::55`, { commits: [claude, claude], manifest: null }]]),
    });
    // the carrier is HEALTHY (green, labelled, not held) — without the two-sided defer it would land alone.
    expect(res.plan.ready).toEqual([]);
    expect(res.plan.deferred.map((d) => d.num).sort((a, b) => a - b)).toEqual([55, 77]);
    expect(noWeFirstSplit(res)).toBe(true);
  });

  it('B8 — resolveContextRepos never holds BOTH `null` and the local slug (no double-listing of the local repo)', () => {
    const hasBoth = (arr) => arr.includes(null) && arr.includes(localSlug);
    // `--this-repo` (REPOS=[null]) + the constellation self-slug: the local repo must appear ONCE (as null).
    expect(hasBoth(resolveContextRepos([null], localSlug))).toBe(false);
    // the default full constellation (REPOS carries the self slug): once, as the slug.
    expect(hasBoth(resolveContextRepos([localSlug, FUI, 'chalbert/plateau-app'], localSlug))).toBe(false);
    // `--repos=<implSlug>` (WE narrowed out): the constellation still adds WE once, never doubled.
    expect(hasBoth(resolveContextRepos([FUI], localSlug))).toBe(false);
    // and the widened context DOES still include the frontierui + plateau-app carriers for the blind health read.
    expect(resolveContextRepos([null], localSlug)).toEqual(expect.arrayContaining([FUI, 'chalbert/plateau-app']));
    // R10 — a short-name `--repos=frontierui` normalizes to `chalbert/frontierui`, so the context never holds a
    // bogus short-name whose listing throws (which pre-R3 latched contextComplete:false permanently).
    expect(resolveRepos({ repos: 'frontierui', self: localSlug })).toEqual([FUI]);
    expect(resolveRepos({ repos: 'frontierui,chalbert/plateau-app', self: localSlug })).toEqual([FUI, 'chalbert/plateau-app']);
  });

  const carrierManifestFull = { item: 'xcarr01', repos: [{ repo: 'we', ref: 'lane/xcarr01-we' }, { repo: 'fui', ref: 'lane/xcarr01-fui' }], blockedBy: [], stackParents: [] };

  it('R4 structural — reduceOpenPrContext is the ONE place contextComplete is computed (binds mutations 2/3/4)', () => {
    const carrierPr = ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] });
    const okReads = new Map([['cwd::77', { manifest: carrierManifestFull, commits: [1], degraded: false }]]);
    // healthy + reconcile ran + no failure/truncation/degrade → COMPLETE
    expect(reduceOpenPrContext({ listings: [{ repo: null, prs: [carrierPr] }], reads: okReads, reconcileRan: true }).contextComplete).toBe(true);
    // mutation 3 — reconcile never ran (a bare /merge sweep / --no-reconcile-labels) → INCOMPLETE by construction
    expect(reduceOpenPrContext({ listings: [{ repo: null, prs: [carrierPr] }], reads: okReads, reconcileRan: false }).contextComplete).toBe(false);
    // mutation 2 — a swallowed `gh pr list` (failed) → INCOMPLETE
    expect(reduceOpenPrContext({ listings: [{ repo: null, prs: [], failed: true }], reads: new Map(), reconcileRan: true }).contextComplete).toBe(false);
    // mutation 4 — a degraded per-PR read → INCOMPLETE, and degradedByPr records the truth
    const deg = reduceOpenPrContext({ listings: [{ repo: null, prs: [carrierPr] }], reads: new Map([['cwd::77', { manifest: carrierManifestFull, commits: [1], degraded: true }]]), reconcileRan: true });
    expect(deg.contextComplete).toBe(false);
    expect(deg.degradedByPr.get('cwd::77')).toBe(true);
  });

  it('R4 structural — collectOpenPrContext (injectable) fails a THROWING listing CLOSED (binds the swallowed-listing catch)', async () => {
    const good = await collectOpenPrContext({ contextRepos: [null, FUI], listOpenPrs: async () => [], fetchReads: async () => new Map() });
    expect(good.contextComplete).toBe(true);
    const failed = await collectOpenPrContext({
      contextRepos: [null, FUI],
      listOpenPrs: async (repo) => { if (repo === FUI) throw new Error('gh: server error (HTTP 500)'); return []; },
      fetchReads: async () => new Map(),
    });
    expect(failed.contextComplete).toBe(false);   // a swallowed throw → INCOMPLETE (fail closed)
  });

  it('R3 — isContentsNotFound: a 404 is definitive-absent (degraded:false); other throws degrade', () => {
    expect(isContentsNotFound({ stderr: 'gh: Not Found (HTTP 404)' })).toBe(true);
    expect(isContentsNotFound({ message: 'HTTP 404' })).toBe(true);
    expect(isContentsNotFound({ stderr: 'HTTP 500 Internal Server Error' })).toBe(false);
    expect(isContentsNotFound({ stderr: 'could not connect to github.com' })).toBe(false);
    expect(isContentsNotFound(null)).toBe(false);
  });

  it('R3 — readRemoteManifestViaApi error taxonomy: 404 → degraded:false; 5xx → degraded:true (stubbed exec)', async () => {
    const throwing = (err) => async () => { throw err; };
    const notFound = await readRemoteManifestViaApi({ exec: throwing(Object.assign(new Error('x'), { stderr: 'gh: Not Found (HTTP 404)' })), repo: FUI, headRef: 'lane/x-fui', apiArgs: () => [] });
    expect(notFound).toEqual({ manifest: null, degraded: false });   // confirmed absent — NOT degraded (R3 root fix)
    const serverErr = await readRemoteManifestViaApi({ exec: throwing(Object.assign(new Error('x'), { stderr: 'HTTP 502 Bad Gateway' })), repo: FUI, headRef: 'lane/x-fui', apiArgs: () => [] });
    expect(serverErr).toEqual({ manifest: null, degraded: true });   // transport failure — fail closed
    // a realistic constellation (WE carrier + a manifest-less impl half whose contents 404s) is NOT degraded → COMPLETE
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifestFull, extraOpenPrs: [ghPr(55, 'lane/xcarr01-fui')] });
    expect(ctx.contextComplete).toBe(true);   // a flag whose production value is a constant is not a gate
  });

  it('R1 — the PLAN-WIDE invariant: an UN-joined manifest-less non-WE verdict in an INCOMPLETE context DEFERS', () => {
    // The un-joined orphan the per-carrier gate structurally misses (no carrier readable → no couple key to join).
    const orphanImpl = { num: 55, repo: FUI, headRef: 'lane/x-fui', hasManifest: false, item: null, blockedBy: [], stackParents: [], decision: 'merge' };
    const inc = planLabelDrain([orphanImpl], { contextComplete: false, isWeRepo: isLocalRepo });
    expect(inc.ready).toEqual([]);                                   // fail closed — MIGHT be a coupled impl
    expect(inc.deferred.map((d) => d.num)).toEqual([55]);
    const comp = planLabelDrain([orphanImpl], { contextComplete: true, isWeRepo: isLocalRepo });
    expect(comp.ready.map((c) => c.num)).toEqual([55]);             // a COMPLETE context proves absence → lands
    // a WE-repo orphan is NOT force-deferred (only non-WE manifest-less verdicts might be a coupled impl half)
    const weOrphan = { num: 7, repo: WE, headRef: 'lane/x-we', hasManifest: false, item: null, blockedBy: [], stackParents: [], decision: 'merge' };
    expect(planLabelDrain([weOrphan], { contextComplete: false, isWeRepo: isLocalRepo }).ready.map((c) => c.num)).toEqual([7]);
  });

  it('R2 — a verdict never waitOn its OWN item (no self-referential livelock)', () => {
    const selfBlock = { num: 9, repo: WE, item: 2200, blockedBy: [2200], stackParents: [], decision: 'merge', hasManifest: true };
    // the self-edge is stripped — WITHOUT the strip this defers forever (structurally unsatisfiable, the livelock)
    expect(planLabelDrain([selfBlock]).ready.map((c) => c.num)).toEqual([9]);
    expect(planLabelDrain([selfBlock]).deferred).toEqual([]);
  });

  it('R2 — the --assume-complete-context escape hatch (forcing contextComplete) lands a couple stuck on an incomplete context', () => {
    const ctx = contextWithCarrier({ listingFailed: true });   // carrier ABSENT from an incomplete context
    const stuck = drivePlan(implOnly(ctx));
    expect(stuck.plan.ready).toEqual([]);                       // normally fails closed (livelock territory)
    const forced = drivePlan(implOnly({ ...ctx, contextComplete: true }));   // what --assume-complete-context does
    expect(forced.plan.ready.map((c) => c.num)).toEqual([55]);  // absent-landed → the impl lands
  });

  it('R5 — the couple gate reads the carrier\'s FINAL decision (candidateHeldByKey), not the pre-escalation label', () => {
    const refs = ['lane/xcarr01-we', 'lane/xcarr01-fui'];
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifestFull, labels: ['ready-to-merge'] });
    const mkVerdicts = () => ([
      { num: 55, repo: FUI, headRef: 'lane/xcarr01-fui', hasManifest: false, item: null, blockedBy: [], stackParents: [], decision: 'merge', prLabels: [] },
      { num: 77, repo: WE, headRef: 'lane/xcarr01-we', hasManifest: true, item: 'xcarr01', manifestRefs: refs, blockedBy: [], stackParents: [], decision: 'skip', prLabels: ['ready-to-merge'] },
    ]);
    // the carrier's LABELS read healthy (only ready-to-merge), but the escalation pass PARKED it → decision skip.
    const held = new Map([['cwd::77', true], [`${FUI}::55`, false]]);
    const withHeld = planDrainPass({ verdicts: mkVerdicts(), openPrContext: ctx, candidateHeldByKey: held, isLocalRepo, localSlug, label: 'ready-to-merge' });
    expect(withHeld.plan.ready).toEqual([]);                                              // impl defers with its PARKED carrier
    expect(withHeld.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('held');
    // WITHOUT the final-decision override, the label read (healthy) would let the impl land while the carrier sits parked (the R5 bug).
    const noOverride = planDrainPass({ verdicts: mkVerdicts(), openPrContext: ctx, isLocalRepo, localSlug, label: 'ready-to-merge' });
    expect(noOverride.verdicts.find((v) => v.num === 55).coupleDeferReason).toBe('healthy');
  });

  it('R7 — a carrier must not enter ready while its impl half is OPEN in the blind context (carrier-only narrow)', () => {
    const implPr = ghPr(55, 'lane/xcarr01-fui');
    const ctx = contextWithCarrier({ carrierNum: 77, item: 'xcarr01', manifest: carrierManifestFull, labels: ['ready-to-merge'], extraOpenPrs: [implPr] });
    const res = drivePlan({
      REPOS: [WE, FUI],
      listings: [{ repo: WE, prs: [ghPr(77, 'lane/xcarr01-we', { labels: ['ready-to-merge'] })] }, { repo: FUI, prs: [] }],
      onlyPr: '77', onlyRepo: WE,
      openPrContext: ctx,
      reads: new Map([[`cwd::77`, { commits: [claude, claude], manifest: carrierManifestFull }]]),
    });
    expect(res.plan.ready).toEqual([]);                                                  // carrier defers — impl still open
    expect(res.verdicts.find((v) => v.num === 77).coupleDeferReason).toBe('impl-open');
  });

  it('R4 structural — isPassIdle / isConfirmSweepSettled: the held-couple allowance both watch-exit paths consult (binds mutations 5/6)', () => {
    const held = [{ num: 55, heldCoupleOnly: true }];
    const real = [{ num: 55, waitOn: ['x'] }];   // a truncated/degraded fail-closed defer — may clear on re-fetch
    expect(isPassIdle({ merged: 0, pendingRebased: 0, deferred: held })).toBe(true);    // human hold → idle
    expect(isPassIdle({ merged: 0, pendingRebased: 0, deferred: real })).toBe(false);   // real defer → keep polling
    expect(isPassIdle({ merged: 1, pendingRebased: 0, deferred: [] })).toBe(false);     // merged → not idle
    expect(isPassIdle({ merged: 0, pendingRebased: 0, deferred: [] })).toBe(true);      // nothing → idle
    expect(isConfirmSweepSettled({ merged: 0, pendingRebased: 0, considered: 2, deferred: held })).toBe(true);
    expect(isConfirmSweepSettled({ merged: 0, pendingRebased: 0, considered: 2, deferred: real })).toBe(false);
    expect(isConfirmSweepSettled({ merged: 0, pendingRebased: 0, considered: 0, deferred: [] })).toBe(true);
  });
});

// #3004 — `blockWait` could clear a dependent's edge on a blocker whose WE carrier landed while its impl half was
// still OPEN. `landedThisPass` is stamped on the WE-CARRIER merge, but a couple is impl-first/WE-last ACROSS repos,
// so that set proves only half a couple. The fix adds NEGATIVE counter-evidence (`coupleIncomplete`) subtracted from
// BOTH `provenLanded` and `stackProven`'s proof (1), derived IN THE CASCADE against refs that ACTUALLY merged.
//
// The load-bearing tests in here are the last three: the DISJOINTNESS/REACHABILITY case (which proves a plan-time
// derivation would be inert, so this fix is not decorative), the REAL-WINDOW case (the impl's merge throws), and the
// MERGED-SIBLING no-regression case (which pins the `\ mergedRefs` subtraction).
describe('merge-ai-prs — #3004 coupleIncomplete: a half-landed couple no longer clears a dependent\'s edge', () => {
  const WE = null;                                    // the local WE clone (repo=null, key 'cwd') — runCli's convention
  const FUI = 'chalbert/frontierui';
  const localSlug = 'chalbert/web-everything';
  const isLocalRepo = (repo) => repo == null || repo === localSlug;
  const green = [{ name: 'test', conclusion: 'SUCCESS' }];
  const ghPr = (number, headRefName, labels = []) =>
    ({ number, title: 't', body: 'what changed and why', headRefName, statusCheckRollup: green, mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', labels });

  // ── the couple under test ──────────────────────────────────────────────────────────────────────────────────
  // item 100 is a cross-repo couple: impl #55 (frontierui, manifest-less, joined) + WE carrier #77 (the resolve
  // carrier, where `bornAs` — and therefore `landedThisPass` — is stamped). item 101 (#88) is `blockedBy: [100]`.
  const REFS_A = ['lane/a-fui', 'lane/a-we'];
  const mkVerdicts = ({ implDecision = 'merge' } = {}) => ([
    { num: 55, repo: FUI, headRef: 'lane/a-fui', hasManifest: false, item: 100, blockedBy: [], stackParents: [], decision: implDecision },
    { num: 77, repo: WE, headRef: 'lane/a-we', hasManifest: true, manifestRefs: REFS_A, item: 100, blockedBy: [], stackParents: [], decision: 'merge' },
    { num: 88, repo: WE, headRef: 'lane/b-we', hasManifest: true, manifestRefs: ['lane/b-we'], item: 101, blockedBy: [100], stackParents: [], decision: 'merge' },
  ]);
  // the PASS-START open-PR snapshot (`openPrContext.prsByRepo`) — frozen before any merge, exactly as the real pass
  // holds it. All three PRs are open here; the cascade's job is to subtract what it actually merged.
  const mkPrsByRepo = () => new Map([
    [WE, [ghPr(77, 'lane/a-we'), ghPr(88, 'lane/b-we')]],
    [FUI, [ghPr(55, 'lane/a-fui')]],
  ]);
  const extraOpenItems = new Set([100, 101]);

  // A FAITHFUL MINI of runCli's cascade loop (scripts/merge-ai-prs.mjs, the `for (;;)` at the `replan` call site):
  // same `remaining` copy, same `sameCand` bookkeeping, same per-iteration re-derivation, same `landedThisPass`
  // stamp keyed on `hasManifest`, same failed-merge `decision = 'skip'` flip, same `!progressed` break. The ONLY
  // stubbed thing is the `gh pr merge` write itself — every plan/derivation call below is the REAL production
  // function. `deriveCoupleIncomplete: false` reproduces TODAY's code (no counter-evidence reaches `replan`).
  const runCascade = ({ verdicts, prsByRepo, failRefs = new Set(), deriveIncomplete = true }) => {
    const landedThisPass = new Set();
    const merged = [];
    const sameCand = (a, b) => a.num === b.num && a.repo === b.repo;
    let remaining = verdicts.map((v) => ({ ...v }));
    const replan = (cands, coupleIncomplete = new Set()) => planLabelDrain(cands, { landedThisPass, coupleIncomplete, extraOpenItems });
    const seenIncomplete = [];
    let deferred = [];
    for (let guard = 0; guard < 20; guard++) {
      const coupleIncomplete = deriveIncomplete ? deriveCoupleIncomplete({ verdicts, merged, prsByRepo }) : new Set();
      seenIncomplete.push(new Set(coupleIncomplete));
      const plan = replan(remaining, coupleIncomplete);
      deferred = plan.deferred;
      if (!plan.ready.length) break;
      let progressed = false;
      for (const c of plan.ready) {
        if (failRefs.has(c.headRef)) {                                   // the `gh pr merge` THROW
          const cc = remaining.find((x) => sameCand(x, c)); if (cc) cc.decision = 'skip';
          continue;
        }
        merged.push({ num: c.num, repo: c.repo });
        remaining = remaining.filter((x) => !sameCand(x, c));
        if (c.hasManifest && c.item != null) landedThisPass.add(asItemId(c.item));
        progressed = true;
      }
      if (!progressed) break;
    }
    return { merged: merged.map((m) => m.num), deferred, landedThisPass, seenIncomplete };
  };

  // ── 1. the reproduction from the card, both directions ─────────────────────────────────────────────────────
  const repro = (proof) => planLabelDrain(
    [{ num: 20, item: 100, decision: 'skip', hasManifest: true },
      { num: 30, item: 101, blockedBy: [100], decision: 'merge', hasManifest: true }],
    proof);

  it('the reproduction UNCHANGED still yields ready [30] — the default is a pure no-op on #999\'s liveness fix', () => {
    const plan = repro({ landedThisPass: new Set([100]) });
    expect(plan.ready.map((c) => c.num)).toEqual([30]);
    expect(plan.deferred).toEqual([]);
  });

  it('the reproduction WITH coupleIncomplete yields deferred [30] waiting on item 100', () => {
    const plan = repro({ landedThisPass: new Set([100]), coupleIncomplete: new Set([100]) });
    expect(plan.ready).toEqual([]);
    expect(plan.deferred).toEqual([{ num: 30, item: 101, waitOn: [100] }]);
  });

  // ── 2. the SIBLING predicate — stackProven proof (1) makes the same subtraction ─────────────────────────────
  const stackCand = (num, item, stackParents) => ({ num, item, blockedBy: [], stackParents, decision: 'merge' });

  it('stackProven: a stackParent in BOTH landedThisPass and coupleIncomplete is NOT proven → descendant defers', () => {
    const proven = planLabelDrain([stackCand(30, 101, [100])], { landedThisPass: new Set([100]) });
    expect(proven.ready.map((c) => c.num)).toEqual([30]);                 // control: proof (1) alone frees it
    const withCounter = planLabelDrain([stackCand(30, 101, [100])], { landedThisPass: new Set([100]), coupleIncomplete: new Set([100]) });
    expect(withCounter.ready).toEqual([]);
    expect(withCounter.deferred).toEqual([{ num: 30, item: 101, waitOn: [100] }]);
  });

  it('stackProven: the subtraction SHORT-CIRCUITS — a weaker later arm cannot undo the counter-evidence', () => {
    // proof (3) `provenOnMain` and proof (4) `numeric-and-absent` both read "landed" for item 100. Neither may
    // resurrect a couple the cascade has positively shown to be half-landed.
    const plan = planLabelDrain([stackCand(30, 101, [100])], {
      landedThisPass: new Set([100]), provenOnMain: new Set([100]), coupleIncomplete: new Set([100]),
    });
    expect(plan.ready).toEqual([]);
    expect(plan.deferred.map((d) => d.waitOn)).toEqual([[100]]);
  });

  it('provenLanded: the subtraction applies to the provenOnMain arm too (counter-evidence beats positive proof)', () => {
    const plan = planLabelDrain([{ num: 30, item: 101, blockedBy: [100], decision: 'merge' }], {
      provenOnMain: new Set([100]), extraOpenItems: new Set([100, 101]), coupleIncomplete: new Set([100]),
    });
    expect(plan.ready).toEqual([]);
    expect(plan.deferred).toEqual([{ num: 30, item: 101, waitOn: [100] }]);
  });

  it('an empty coupleIncomplete leaves #999 F1/F2 byte-identical (explicit no-op control)', () => {
    const bare = planLabelDrain([{ num: 2, item: 200, blockedBy: [100], decision: 'merge' }], { landedThisPass: new Set([100]), extraOpenItems: new Set([100, 200]) });
    const seeded = planLabelDrain([{ num: 2, item: 200, blockedBy: [100], decision: 'merge' }], { landedThisPass: new Set([100]), extraOpenItems: new Set([100, 200]), coupleIncomplete: new Set() });
    expect(seeded).toEqual(bare);
    expect(seeded.ready.map((c) => c.num)).toEqual([2]);
  });

  // ── 3. ONE exported predicate — neither call site may re-inline its own copy ────────────────────────────────
  const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  it('single-source: coupleImplOpen is the ONLY couple-completeness test — joinImplToCouples does not re-inline it', () => {
    // definition + the joinImplToCouples call site + the deriveCoupleIncomplete call site (docblock @link
    // references are excluded by requiring the call parenthesis).
    const calls = SRC.match(/coupleImplOpen\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    // the retired inline loop's own identifiers — a re-inline reintroduces one of these
    expect(SRC).not.toContain('const implOpenNotLanding');
    expect(SRC).not.toContain('openRefs.has(ref)');
    // and the shared open-ref construction is single-sourced too (definition + cascade + resolve-on-land gate)
    expect((SRC.match(/liveOpenHeadRefs\(/g) || []).length).toBeGreaterThanOrEqual(3);
    // the pass-start-minus-merged subtraction exists EXACTLY once — in `liveOpenHeadRefs` itself. A second
    // occurrence means a call site re-inlined it (the drift that produced #3004).
    expect((SRC.match(/!mergedRefs\.has\(p\.headRefName\)/g) || []).length).toBe(1);
  });

  it('single-source, behavioural: joinImplToCouples stamps impl-open EXACTLY when coupleImplOpen says so', () => {
    const openHeadRefs = new Set(['lane/a-fui', 'lane/a-we']);
    const both = (implDecision) => {
      const vs = mkVerdicts({ implDecision });
      joinImplToCouples(vs, { contextComplete: true, openHeadRefs });
      const carrier = vs.find((v) => v.num === 77);
      const readyImplRefs = new Set(vs.filter((v) => v && !v.hasManifest && v.decision === 'merge' && v.coupleDefer !== true).map((v) => v.headRef).filter(Boolean));
      return { stamped: carrier.coupleDeferReason === 'impl-open', predicate: coupleImplOpen(carrier, { openHeadRefs, landingRefs: readyImplRefs }) };
    };
    const landing = both('merge');                 // impl planned to merge → the couple reads whole
    expect(landing.stamped).toBe(false);
    expect(landing.predicate).toBe(false);
    const notLanding = both('skip');               // impl red/held → the couple is NOT whole
    expect(notLanding.stamped).toBe(true);
    expect(notLanding.predicate).toBe(true);
  });

  it('coupleImplOpen: a manifest-less verdict is never a carrier, and a carrier never blocks on its OWN ref', () => {
    expect(coupleImplOpen({ hasManifest: false, headRef: 'lane/a-fui', manifestRefs: REFS_A }, { openHeadRefs: new Set(REFS_A) })).toBe(false);
    expect(coupleImplOpen({ hasManifest: true, headRef: 'lane/a-we', manifestRefs: ['lane/a-we'] }, { openHeadRefs: new Set(['lane/a-we']) })).toBe(false);
    expect(coupleImplOpen({ hasManifest: true, headRef: 'lane/a-we', manifestRefs: REFS_A }, { openHeadRefs: new Set(REFS_A) })).toBe(true);
    expect(coupleImplOpen({ hasManifest: true, headRef: 'lane/a-we', manifestRefs: REFS_A }, { openHeadRefs: new Set(REFS_A), landingRefs: new Set(['lane/a-fui']) })).toBe(false);
  });

  // ── 4. THE REACHABILITY / DISJOINTNESS TEST ────────────────────────────────────────────────────────────────
  // This is the one that proves the fix is not decorative. A `coupleIncomplete` derived at PLAN time, from the SAME
  // helper and the SAME plan-time inputs as the R7 `impl-open` gate, is DISJOINT from anything that can reach
  // `landedThisPass`: every carrier the helper flags is already `coupleDefer:'impl-open'`, therefore absent from
  // `plan.ready`, therefore never merged, therefore never in `landedThisPass`. Subtracting it could not change one
  // answer. A future refactor that moves the derivation back to plan time fails HERE instead of going quietly inert.
  describe('reachability — a PLAN-TIME derivation is provably inert (do not move it back)', () => {
    const manifestFor = (item, refs) => ({ item, repos: refs.map((ref) => ({ repo: ref.endsWith('-we') ? 'we' : 'fui', ref })), blockedBy: [], stackParents: [] });
    const ctxFor = () => reduceOpenPrContext({
      listings: [
        { repo: WE, prs: [ghPr(77, 'lane/a-we', ['ready-to-merge']), ghPr(88, 'lane/b-we', ['ready-to-merge'])] },
        { repo: FUI, prs: [ghPr(55, 'lane/a-fui')] },
      ],
      reads: new Map([
        ['cwd::77', { manifest: manifestFor(100, REFS_A), commits: [], degraded: false }],
        ['cwd::88', { manifest: manifestFor(101, ['lane/b-we']), commits: [], degraded: false }],
        [`${FUI}::55`, { manifest: null, commits: [], degraded: false }],
      ]),
      reconcileRan: true,
    });

    // the plan-time inputs, rebuilt exactly as planDrainPass / joinImplToCouples build them
    const planTimeFlagged = (ctx, verdicts) => {
      const openHeadRefs = new Set();
      for (const prs of ctx.prsByRepo.values()) for (const p of prs) if (p && p.headRefName) openHeadRefs.add(p.headRefName);
      const readyImplRefs = new Set(verdicts.filter((v) => v && !v.hasManifest && v.decision === 'merge' && v.coupleDefer !== true).map((v) => v.headRef).filter(Boolean));
      return new Set(verdicts.filter((v) => v && v.hasManifest && v.item != null && coupleImplOpen(v, { openHeadRefs, landingRefs: readyImplRefs })).map((v) => asItemId(v.item)));
    };

    it('every carrier a plan-time coupleIncomplete would flag is ALREADY impl-open-deferred and absent from plan.ready', () => {
      let sawNonEmpty = false;
      for (const implDecision of ['merge', 'skip']) {                    // both shapes, so the assertion is not vacuous
        const ctx = ctxFor();
        const res = planDrainPass({ verdicts: mkVerdicts({ implDecision }), openPrContext: ctx, isLocalRepo, localSlug, label: 'ready-to-merge' });
        const flagged = planTimeFlagged(ctx, res.verdicts);
        if (flagged.size) sawNonEmpty = true;
        for (const v of res.verdicts) {
          if (!flagged.has(v.item == null ? null : asItemId(v.item)) || !v.hasManifest) continue;
          expect(v.coupleDeferReason).toBe('impl-open');                 // the R7 gate already caught it
        }
        // DISJOINTNESS: nothing flagged can reach `ready` → can never reach `landedThisPass` → nothing to subtract
        const readyItems = new Set(res.plan.ready.map((c) => (c.item == null ? null : asItemId(c.item))));
        for (const id of flagged) expect(readyItems.has(id)).toBe(false);
      }
      expect(sawNonEmpty).toBe(true);                                    // the `skip` shape really does flag one
    });

    it('and the CASCADE derivation is NOT disjoint — it flags an item that DID reach landedThisPass', () => {
      // Same pass, `implDecision: 'merge'` (the R7 gate clears the carrier, plan-time flagged set is EMPTY), but the
      // impl's merge then throws. This is the exact gap a plan-time set structurally cannot see.
      const ctx = ctxFor();
      const verdicts = mkVerdicts({ implDecision: 'merge' });
      planDrainPass({ verdicts, openPrContext: ctx, isLocalRepo, localSlug, label: 'ready-to-merge' });
      expect(planTimeFlagged(ctx, verdicts).size).toBe(0);               // plan time sees NOTHING
      const run = runCascade({ verdicts: mkVerdicts({ implDecision: 'merge' }), prsByRepo: mkPrsByRepo(), failRefs: new Set(['lane/a-fui']) });
      expect(run.landedThisPass.has(100)).toBe(true);                    // the carrier landed anyway
      expect([...run.seenIncomplete.at(-1)]).toContain(100);             // and the cascade DID flag it
    });
  });

  // ── 5. THE REAL-WINDOW TEST — the impl's `gh pr merge` throws mid-cascade ───────────────────────────────────
  it('real window: the impl merge THROWS, the carrier lands anyway, and the dependent DEFERS on the next replan', () => {
    const run = runCascade({ verdicts: mkVerdicts(), prsByRepo: mkPrsByRepo(), failRefs: new Set(['lane/a-fui']) });
    expect(run.merged).toEqual([77]);                                    // only the WE carrier landed
    expect(run.landedThisPass.has(100)).toBe(true);                      // …and it stamped item 100 as landed
    expect(run.deferred).toEqual([{ num: 88, item: 101, waitOn: [100] }]);  // the dependent held back
  });

  it('real window CONTROL: on today\'s wiring (no re-derived set reaching replan) the dependent wrongly LANDS', () => {
    const run = runCascade({ verdicts: mkVerdicts(), prsByRepo: mkPrsByRepo(), failRefs: new Set(['lane/a-fui']), deriveIncomplete: false });
    expect(run.merged).toEqual([77, 88]);                                // #88 merged past a half-landed blocker
    expect(run.deferred).toEqual([]);
  });

  // ── 6. THE MERGED-SIBLING NO-REGRESSION TEST — pins the `\ mergedRefs` subtraction ──────────────────────────
  it('merged sibling: an ordinary impl-first/WE-last couple stays whole — its dependent still lands the same pass', () => {
    const run = runCascade({ verdicts: mkVerdicts(), prsByRepo: mkPrsByRepo() });
    expect(run.merged).toEqual([55, 77, 88]);                            // impl → carrier → dependent, all in one pass
    expect(run.deferred).toEqual([]);
    expect([...run.seenIncomplete.at(-1)]).toEqual([]);                  // nothing incomplete once both halves merged
  });

  it('the \\ mergedRefs subtraction is load-bearing: WITHOUT it the healthy couple reads incomplete', () => {
    const verdicts = mkVerdicts();
    const prsByRepo = mkPrsByRepo();
    const merged = [{ num: 55, repo: FUI }, { num: 77, repo: WE }];
    expect([...deriveCoupleIncomplete({ verdicts, merged, prsByRepo })]).toEqual([]);          // with the subtraction
    expect([...deriveCoupleIncomplete({ verdicts, merged: [], prsByRepo })]).toEqual([100]);   // without it → every healthy couple defers
  });

  it('liveOpenHeadRefs: a merged entry matching no verdict is REPORTED and fails the couple closed (#2899 J5)', () => {
    const out = liveOpenHeadRefs({ verdicts: mkVerdicts(), merged: [{ num: 999, repo: FUI }], prsByRepo: mkPrsByRepo() });
    expect(out.unmatchedMerges).toEqual([`${FUI}#999`]);
    expect(out.mergedRefs.size).toBe(0);
    expect(out.openHeadRefs.sort()).toEqual(['lane/a-fui', 'lane/a-we', 'lane/b-we']);
  });

  // ── 7. the residual is documented with the CORRECTED reason ────────────────────────────────────────────────
  it('the provenOnMain carve-out is documented as a COST call, not "unrecoverable"', () => {
    // unwrap the jsdoc line prefixes so an assertion is about the PROSE, not where the comment happens to wrap
    const doc = SRC.slice(SRC.indexOf('#3004 residual'), SRC.indexOf('#3004 residual') + 1400).replace(/\n\s*\*\s?/g, ' ');
    expect(doc).toContain('provenOnMain');
    expect(doc).toContain('#2411');                        // the manifest lives in the PR BODY and survives the merge
    expect(doc).toMatch(/JOIN KEY|join key/);              // what is actually missing
    expect(doc).toMatch(/COST call, not an impossibility/); // the corrected framing, not "unrecoverable"
    expect(doc).toMatch(/gh pr view <num> --json body/);    // the concrete read that makes it recoverable
  });
});

/**
 * `needsAcceptanceRestamp` (#x5e2ldj) — the drain re-stamping the acceptance its OWN rebase invalidated.
 *
 * THE MEASURED LOOP, PR #1445 on 2026-08-19: a clearance landed at 13:06:48; the drain rebased that lane onto
 * the newly-merged main a minute later; `review:human` came back. The rebase preserves the contribution, but a
 * rebase onto a moved base can change the context-run lengths the contribution digest keeps — so the markers
 * went stale on the PR the drain was itself about to land. Clear, rebase, re-park, repeat.
 *
 * The fix is the one `review-escalation.mjs` already named in its POSITION section — attribute the move to its
 * actor. These tests pin that the escape stays NARROW, because a re-stamp that fired too widely would carry an
 * acceptance across a head change the drain did NOT make, which is the staleness gate's whole reason to exist.
 */
describe('needsAcceptanceRestamp (#x5e2ldj — carrying an acceptance across the drain\'s own rebase)', () => {
  const accepted = { humanCleared: true, reviewHeld: false };
  const rebased = { action: 'rebased', newCommit: 'f5bc7940' };

  it('fires for the one case it exists for: THIS drain rebased an accepted, unheld PR', () => {
    expect(needsAcceptanceRestamp(accepted, rebased)).toBe(true);
  });

  it('does NOT fire without a live acceptance — there is nothing to carry', () => {
    expect(needsAcceptanceRestamp({ humanCleared: false, reviewHeld: false }, rebased)).toBe(false);
  });

  // DEFENCE IN DEPTH, and labelled as such because the review of PR #1482 was right that it is not a scenario
  // `classifyPr` can currently produce: `reviewHeld` is only set when the review hold is the SOLE blocker, which
  // requires no live `review:accepted` — so `humanCleared && reviewHeld` is unreachable through the real drain
  // today. The guard stays because the cost is one `&&` and the failure it prevents is carrying an acceptance
  // onto a held PR; but a reader must not mistake this for a case that happens.
  it('does NOT fire on an uncleared hold — unreachable via classifyPr today, kept as depth', () => {
    expect(needsAcceptanceRestamp({ humanCleared: true, reviewHeld: true }, rebased)).toBe(false);
  });

  it('does NOT fire when no new head was minted — `current` rebuilt nothing', () => {
    // The idempotency path: the tip was already on main and manifest-free, so no SHA moved and no marker went
    // stale. Re-stamping there would post a comment for a rebase that never happened.
    expect(needsAcceptanceRestamp(accepted, { action: 'current' })).toBe(false);
    expect(needsAcceptanceRestamp(accepted, { action: 'skip', reason: 'real conflict beyond manifest' })).toBe(false);
  });

  it('does NOT fire without a rebase result at all — an author push is not this', () => {
    expect(needsAcceptanceRestamp(accepted, undefined)).toBe(false);
    expect(needsAcceptanceRestamp(accepted, null)).toBe(false);
    expect(needsAcceptanceRestamp(undefined, rebased)).toBe(false);
  });
});

/**
 * `restampAcceptance` (#3202) — WHICH TREE the re-stamp fingerprints.
 *
 * The single home computes its `reviewed-diff` fingerprint from a git read with NO explicit `cwd`, and says so:
 * the CLI was single-PR and operator-invoked, so it ran from the PR's own repo, and the condition that would
 * break that is a caller passing a `--repo` naming a different one. The #3200 re-stamp became that caller and
 * spawned the child with no `cwd`, while the drain sweeps three repos in one process and never `chdir`s.
 *
 * It failed SOFT most of the time — the head ref does not resolve in the wrong tree, the read throws, no marker
 * is stamped, and the gate falls back to SHA identity, which is stricter. The case that did not is a branch of
 * the same name existing there, which `lane/<NNN>-<slug>` makes possible across the constellation. Then an
 * unrelated repo's diff is stamped as this PR's, and a wrong fingerprint never matches — so the PR re-parks on
 * every pass, which is the loop #3200 exists to end.
 *
 * So these assert the `cwd` that REACHES the spawn, not merely that a spawn happened. A test that only checked
 * the argv would have passed throughout the defect.
 */
describe('restampAcceptance (#3202 — the re-stamp reads the PR\'s OWN tree)', () => {
  const spy = (status = 0) => {
    const calls = [];
    const spawn = (cmd, argv, opts) => { calls.push({ cmd, argv, opts }); return { status, stdout: '', stderr: '' }; };
    return { calls, spawn };
  };

  it('pins the child to the sibling repo\'s clone — the wrong-tree fingerprint this exists to prevent', () => {
    const { calls, spawn } = spy();
    const out = restampAcceptance({ pr: 42, repo: 'plateau-app', newHead: 'f5bc7940', cwd: '/ws/plateau-app', spawn });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts.cwd).toBe('/ws/plateau-app');
  });

  // `undefined` means "inherit", which for a WE PR is already the right tree — so a local-repo re-stamp must
  // NOT acquire a pinned cwd it never needed.
  it('inherits the drain\'s cwd for a local-repo PR', () => {
    const { calls, spawn } = spy();
    restampAcceptance({ pr: 7, repo: 'chalbert/web-everything', newHead: 'abc1234', spawn });
    expect(calls[0].opts.cwd).toBeUndefined();
  });

  // The SCRIPT is this checkout's; only the working directory moves. Resolving the CLI relative to cwd would
  // run a sibling repo's copy of the label arc — a second implementation of the thing #2644 made singular.
  it('still runs THIS checkout\'s review-set-label.mjs, not the pinned repo\'s', () => {
    const { calls, spawn } = spy();
    restampAcceptance({ pr: 42, repo: 'frontierui', newHead: 'f5bc7940', cwd: '/ws/frontierui', spawn });
    expect(calls[0].argv[0]).toMatch(/scripts\/review-set-label\.mjs$/);
    expect(calls[0].argv[0].startsWith('/ws/frontierui')).toBe(false);
    expect(calls[0].argv).toContain('--to=restamp');
    expect(calls[0].argv).toContain('--repo=frontierui');
  });

  // The allowlist for `--body-file` is rooted at `process.cwd()`, so a body staged under THIS checkout would be
  // refused by a child pinned elsewhere. The re-stamp passes none; this pins that it stays that way.
  it('passes no --body-file, which a pinned cwd would make unreadable', () => {
    const { calls, spawn } = spy();
    restampAcceptance({ pr: 42, repo: 'plateau-app', newHead: 'f5bc7940', cwd: '/ws/plateau-app', spawn });
    expect(calls[0].argv.some((a) => String(a).startsWith('--body-file='))).toBe(false);
  });

  it('never throws, and reports a non-zero exit as a failed re-stamp', () => {
    const { spawn } = spy(1);
    expect(restampAcceptance({ pr: 42, repo: 'plateau-app', newHead: 'f5bc7940', cwd: '/ws/plateau-app', spawn }).ok).toBe(false);
    const thrower = () => { throw new Error('spawn ENOENT'); };
    expect(restampAcceptance({ pr: 42, repo: 'plateau-app', newHead: 'f', spawn: thrower }))
      .toEqual({ ok: false, reason: 'spawn ENOENT' });
  });
});

/* ------------------------------------------------------------------ #3308 review-coverage announcement */

// #3308 — a skipped or degraded review must SAY SO on the PR. These pin the two halves that make that true:
// the gap READER (which conditions count as degraded, and — just as load-bearing — which do not), and the
// RENDERER + its marker, which is the surface a review that never ran gets when there is no verdict comment
// to host the announcement of its own absence.
//
// The record bodies below are trimmed from real recorded verdicts (see
// `scripts/review-corpus/__tests__/fixtures/comments/1561.json`), so the parser is pinned against the bytes
// `buildVerdictComment` actually writes rather than against a shape invented here.
const HEAD_SHA = 'eaa1bc906bd2fc088789a2c9b87a54ac9d2faa33';
const BASE_SHA = 'e9aa38f6eacb7ed0341cdcb4a191c5f9e56f0b15';
const panelTable = (rows) => ['### Panel verdicts', '', '| lens | weight | verdict |', '| --- | --- | --- |',
  ...rows.map(([lens, weight, verdict]) => `| ${lens} | ${weight} | ${verdict} |`)].join('\n');
const verdictRecord = ({ rows = [['correctness', 'mandatory', 'accept'], ['security', 'mandatory', 'accept']], head = HEAD_SHA, basis = true, single = false } = {}) => ({
  body: ['✅ review — accepted', '', 'Recorded by operator via the declared `review-pr` operation (#3035).', '',
    panelTable(rows), '',
    single ? '**Lens:** `correctness` — a SINGLE-LENS run. One `judge` step, one juror, one lens.' : '',
    basis ? `Net basis: \`${BASE_SHA}..${head}\` (rev \`origin/lane/x\` at review time)` : ''].join('\n') });
const cleanPr = { comments: [verdictRecord()] };

describe('#3308 — reviewRecordKind / recordedReviewRecords', () => {
  it('recognizes each of the four durable review-record headlines', () => {
    expect(reviewRecordKind('✅ review — accepted\n\nbody')).toBe('accepted');
    expect(reviewRecordKind('🔁 review — changes requested\n\nbody')).toBe('changes');
    expect(reviewRecordKind('✅ review — `review:human` cleared via the sanctioned path')).toBe('clear-human');
    expect(reviewRecordKind('📌 review — acceptance re-stamped after a rebase (no new review)')).toBe('restamp');
  });
  // A re-stamp's heading is the one that must win: it is a DIFFERENT record from the accept it carries
  // forward, and reading it as that accept would report a fresh review where none happened.
  it('reads a re-stamp as a re-stamp even when the accept headline is quoted alongside it', () => {
    expect(reviewRecordKind('📌 review — acceptance re-stamped after a rebase (no new review)\n\nre-stamping ✅ review — accepted from #1')).toBe('restamp');
  });
  it('is null for a non-record comment — including the drain\'s own stamps', () => {
    expect(reviewRecordKind(buildDrainReasonComment('land', LAND_REASON))).toBe(null);
    expect(reviewRecordKind(buildDrainReasonComment(REVIEW_COVERAGE_KIND, 'x'))).toBe(null);
    expect(reviewRecordKind('')).toBe(null);
    expect(reviewRecordKind(undefined)).toBe(null);
  });
  it('collects records in recorded order and tolerates an odd comments shape', () => {
    const recs = recordedReviewRecords([{ body: 'noise' }, null, 42, verdictRecord(), { body: '📌 review — acceptance re-stamped after a rebase (no new review)' }]);
    expect(recs.map((r) => r.kind)).toEqual(['accepted', 'restamp']);
    expect(recordedReviewRecords(null)).toEqual([]);
  });
});

describe('#3308 — readReviewRecord', () => {
  it('pulls the examined revision range and the panel rows', () => {
    const r = readReviewRecord(verdictRecord({ rows: [['correctness', 'mandatory', 'accept']] }).body);
    expect(r.basis).toEqual({ base: BASE_SHA, head: HEAD_SHA });
    expect(r.lensRows).toEqual([{ lens: 'correctness', weight: 'mandatory', verdict: 'accept' }]);
  });
  // `renderPanelVerdictTable` renders an unjudged seat as the literal `(no verdict)`. A tight verdict-cell
  // pattern skips that row, and the skip is not neutral: a run whose only MANDATORY seat rendered
  // `(no verdict)` would read as having no mandatory row at all — the right alarm for the wrong reason.
  it('captures a seat rendered `(no verdict)`, so the weight column is what decides', () => {
    expect(readReviewRecord(verdictRecord({ rows: [['security', 'mandatory', '(no verdict)']] }).body).lensRows)
      .toEqual([{ lens: 'security', weight: 'mandatory', verdict: '(no verdict)' }]);
    expect(reviewCoverageGaps({ comments: [verdictRecord({ rows: [['security', 'mandatory', '(no verdict)'], ['simplicity', 'advisory', 'accept']] })] })).toEqual([]);
  });
  // The corpus miner's `parseVerdict` returns null here (corpus policy: no range ⇒ not replayable ⇒ exclude).
  // Excluding is exactly wrong for this reader — a record naming no range is the thing being announced, so it
  // must survive parsing to be reported.
  it('survives a record with no Net basis instead of discarding it', () => {
    const r = readReviewRecord(verdictRecord({ basis: false }).body);
    expect(r.basis).toBe(null);
    expect(r.lensRows).toHaveLength(2);
  });
});

describe('#3308 — reviewCoverageGaps: the degraded set', () => {
  // THE NOISE GUARD, and the most important assertion in this block. A normally-reviewed PR must produce an
  // EMPTY list, because an announcement on every PR trains readers to skip it — which recreates the problem
  // this item exists to fix.
  it('reports NOTHING for a panel-reviewed PR merging the tree that was reviewed', () => {
    expect(reviewCoverageGaps(cleanPr)).toEqual([]);
  });
  it('announces a PR landing with no recorded review at all — the 22.5% case', () => {
    expect(reviewCoverageGaps({ comments: [{ body: 'looks good to me' }] }).map((g) => g.code))
      .toEqual(['no-recorded-review']);
  });
  // The `--lens=<advisory>` unseating: the run completes, the table renders, and every seat in it is advisory,
  // so nothing in the panel could have blocked the accept.
  it('announces a verdict whose panel seats NO mandatory lens', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ rows: [['simplicity', 'advisory', 'accept']] })] });
    expect(gaps.map((g) => g.code)).toEqual(['unseated-mandatory-lens']);
  });
  // MEASURED 21/60 (35%) of recent merges, and such a record already says so IN BOLD in its own body. At that
  // rate it is the operating norm, not a departure — announcing it is how this channel gets tuned out. #3319
  // has since retired the sentence from the renderer, settling it twice over. What survives is the sharp
  // half: a single-lens run seating an ADVISORY lens still fires `unseated-mandatory-lens`.
  it('does NOT announce a single-lens run that still seated a mandatory lens', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ single: true, rows: [['correctness', 'mandatory', 'accept']] })] });
    expect(gaps).toEqual([]);
  });
  it('DOES announce a single-lens run that seated only an advisory lens — no blocking floor', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ single: true, rows: [['simplicity', 'advisory', 'accept']] })] });
    expect(gaps.map((g) => g.code)).toEqual(['unseated-mandatory-lens']);
  });
  // MEASURED 12/60 (20%) of recent merges — and every one a FALSE positive. The drain already refuses to
  // merge a PR whose acceptance does not cover its head (#2409), and reviewed-diff/reviewed-contribution
  // deliberately keep an acceptance valid across a content-preserving rebase — which the drain's own
  // manifest-drop pass causes on nearly every lane. A sha difference that survives to the merge cascade is
  // therefore PROOF the staleness gate ran and cleared it, not evidence of a skipped review.
  it('does NOT announce a moved head — a stale acceptance never reaches the merge cascade (#2409)', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ head: '1111111111111111111111111111111111111111' })] });
    expect(gaps).toEqual([]);
  });
  it('announces a verdict that names no revision range — unknown coverage, not clean coverage', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ basis: false })] });
    expect(gaps.map((g) => g.code)).toEqual(['unstated-basis']);
  });
  // MEASURED 31/60 (52%) of recent merges. The re-stamp is the drain's OWN rebase mechanism, granted only
  // after the reviewed-contribution markers show the contribution unchanged — evidence the staleness gate
  // RAN. Announcing it would put a notice on half of all merges.
  it('does NOT announce a re-stamped acceptance — the drain\'s own routine rebase path', () => {
    const gaps = reviewCoverageGaps({ comments: [verdictRecord(), { body: '📌 review — acceptance re-stamped after a rebase (no new review)' }] });
    expect(gaps).toEqual([]);
  });
  // ...and a terminal record must STOP the analysis, not fall through. Neither a re-stamp nor a clearance
  // carries a panel table or a `Net basis`, so reading either as an accept would manufacture
  // `unstated-basis` on that same 53% — the identical noise, arriving by a different door.
  it('a terminal record does not fall through into basis checks it structurally cannot satisfy', () => {
    for (const body of ['📌 review — acceptance re-stamped after a rebase (no new review)', '✅ review — `review:human` cleared via the sanctioned path']) {
      expect(reviewCoverageGaps({ comments: [{ body }] })).toEqual([]);
    }
  });
  it('announces an operator relief that waived this PR\'s review park', () => {
    expect(reviewCoverageGaps({ ...cleanPr, reliefWaived: true }).map((g) => g.code)).toEqual(['relief-waived']);
  });
  // #3308 (round-2 correctness fix) — the DEPRECATED bare form gets its OWN code, because it is a wider
  // statement than the scoped one: the rubric was off for every candidate in the pass, not waived for one
  // named PR. Collapsing the two would under-report the bare form on exactly the PRs that were never scored.
  it('announces the DEPRECATED pass-wide waiver as its own gap, distinct from the scoped one', () => {
    expect(reviewCoverageGaps({ ...cleanPr, reliefPassWide: true }).map((g) => g.code)).toEqual(['relief-waived-pass-wide']);
    expect(REVIEW_COVERAGE_GAP_META['relief-waived-pass-wide']).not.toBe(REVIEW_COVERAGE_GAP_META['relief-waived']);
  });
  it('reports BOTH relief codes rather than silently collapsing them if a caller passes both', () => {
    expect(reviewCoverageGaps({ ...cleanPr, reliefWaived: true, reliefPassWide: true }).map((g) => g.code).sort())
      .toEqual(['relief-waived', 'relief-waived-pass-wide']);
  });
  // Two expected states that already carry their own durable record. Re-announcing them here would be volume
  // without information, which is how an announcement channel gets tuned out.
  it('does NOT announce a human-ceremony clearance (its own comment states what it proves)', () => {
    expect(reviewCoverageGaps({ comments: [{ body: '✅ review — `review:human` cleared via the sanctioned path\n\nCleared by nic.' }] })).toEqual([]);
  });
  it('judges the LATEST record, so a bounce-then-re-review is not reported on its history', () => {
    const gaps = reviewCoverageGaps({ comments: [{ body: '🔁 review — changes requested\n\nno panel table, no basis' }, verdictRecord()] });
    expect(gaps).toEqual([]);
  });
  it('tolerates an abbreviated sha in the record rather than calling it stale', () => {
    const gaps = reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ head: HEAD_SHA.slice(0, 12) })] });
    expect(gaps).toEqual([]);
  });
  // "We could not read the head" is a different statement from "the review is stale". The reader must not
  // manufacture a finding out of an unknown any more than it may manufacture a pass out of one.
  it('leaves staleness unreported when the landing head sha is unknown', () => {
    expect(reviewCoverageGaps({ comments: [verdictRecord({ head: '1111111111111111111111111111111111111111' })], headSha: null })).toEqual([]);
  });
  it('accumulates independent gaps rather than reporting only the first', () => {
    const gaps = reviewCoverageGaps({ reliefWaived: true, comments: [verdictRecord({ rows: [['simplicity', 'advisory', 'accept']], basis: false })] });
    expect(gaps.map((g) => g.code).sort()).toEqual(['relief-waived', 'unseated-mandatory-lens', 'unstated-basis']);
  });
  it('every emitted gap carries the explanatory line from the meta table', () => {
    for (const code of Object.keys(REVIEW_COVERAGE_GAP_META)) expect(REVIEW_COVERAGE_GAP_META[code]).toBeTruthy();
    expect(reviewCoverageGaps({ comments: [] })[0]).toEqual({ code: 'no-recorded-review', line: REVIEW_COVERAGE_GAP_META['no-recorded-review'] });
  });
  it('defaults to announcing the absence when called with nothing at all', () => {
    expect(reviewCoverageGaps().map((g) => g.code)).toEqual(['no-recorded-review']);
  });
});

describe('#3308 — the announcement surface', () => {
  // A review that never ran produces no verdict comment, so it cannot host the announcement of its own
  // absence. This fourth `drainReasonMarker` kind IS that surface — its own marker, so it dedupes
  // independently of the park/skip/land stamps rather than colliding with them.
  it('is its own marker kind, distinct from park/skip/land', () => {
    expect(drainReasonMarker(REVIEW_COVERAGE_KIND)).toBe('<!-- drain-review-coverage-reason -->');
    for (const k of ['park', 'skip', 'land']) expect(drainReasonMarker(k)).not.toBe(drainReasonMarker(REVIEW_COVERAGE_KIND));
  });
  it('renders a heading that says a review is MISSING, never that the drain approved something', () => {
    const body = buildDrainReasonComment(REVIEW_COVERAGE_KIND, buildReviewCoverageReason(reviewCoverageGaps({ comments: [] })));
    expect(body.startsWith('<!-- drain-review-coverage-reason -->')).toBe(true);
    expect(body).toContain('Incomplete review — what was not examined');
    expect(body).not.toContain('Landed by the drain');
    expect(body).toContain('`no-recorded-review`');
    expect(body).toContain(REVIEW_COVERAGE_GAP_META['no-recorded-review']);
  });
  it('states that nothing on the list blocked the merge — it is a record, not a gate', () => {
    expect(buildReviewCoverageReason(reviewCoverageGaps({ comments: [] }))).toContain('None of the above blocked the merge');
  });
  // The `--watch` loop re-scores the same PR every pass. An unchanged notice must dedupe against the one
  // already on the PR; a CHANGED set of gaps must post fresh.
  it('dedupes an unchanged notice and posts a fresh one when the gaps change', () => {
    const reason = buildReviewCoverageReason(reviewCoverageGaps({ comments: [] }));
    const posted = [{ body: buildDrainReasonComment(REVIEW_COVERAGE_KIND, reason) }];
    expect(hasDrainReasonComment(posted, REVIEW_COVERAGE_KIND, reason)).toBe(true);
    const other = buildReviewCoverageReason(reviewCoverageGaps({ ...cleanPr, comments: [verdictRecord({ basis: false })] }));
    expect(hasDrainReasonComment(posted, REVIEW_COVERAGE_KIND, other)).toBe(false);
  });
});

describe('#3184 — the drain records a fingerprint READ MISS instead of collapsing it into a marker-less null', () => {
  // The pure verdict is pinned in `scripts/lib/__tests__/review-escalation.test.mjs`. What belongs HERE is the
  // drain's half of Done-when 4: the CALLER must tell `decideReviewGate` which kind of `null` it is holding.
  // The gate cannot infer it — "this accept recorded no fingerprint" and "a fingerprint was recorded and this
  // pass could not read the live side" arrive as the same `headDiff: null`, and the whole defect is the drain
  // handing over one story for both. Source-level for the same reason the #x9xqexm block above is: the read
  // sits inline in `runCli`'s per-candidate loop behind two `execFileSync` calls, with no other observable seam.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');

  it('the drain hands the gate an explicit read-failed signal, not a bare null', () => {
    expect(src).toMatch(/headReadFailed:\s*liveDiffReadFailed/);
  });

  it('the signal is derived from an OWED read, so a marker-less accept can never raise it', () => {
    // `liveDiffReadOwed` is the predicate that separates the two nulls. It must require a recorded marker —
    // without that clause an accept that stamped no fingerprint reports a read miss it never owed, and the
    // #3184 tier would swallow every pre-#x169fqe stale re-park.
    expect(src).toMatch(/const liveDiffReadOwed = !!\(\(acceptedDiff \|\| acceptedContribution\)/);
    // …and the miss is the owed read coming back empty, in EITHER of its three ways (throw, unscored result,
    // or the repo guard refusing the read). Assigning anything else here — a constant, or the catch alone —
    // loses one of them.
    expect(src).toMatch(/liveDiffReadFailed = liveDiffReadOwed && !liveHeadDiff;/);
  });

  it('the repo guard still gates the READ itself — a sibling PR never resolves refs against the local clone', () => {
    // PR #1087 blocker 1, unchanged by #3184: the guard was split out of the condition so the miss could be
    // RECORDED, never so the read could happen without it. It must still stand between the owed read and the
    // `computeNetDiffText` call.
    expect(src).toMatch(/if \(liveDiffReadOwed && \(isLocalRepo\(v\.repo\) \|\| escCwd\)\) \{/);
  });

  it('a suppressed re-park is STILL not waivable by the relief valve — staleAcceptance carries it', () => {
    // The one behavioural risk of returning `applyLabel: null`: `applyEscalationRelief`'s later checks key on
    // the label, and a null would fall past the `review:human` refusal. It never gets there — the
    // `staleAcceptance` refusal is checked FIRST. This test is why that ordering is not free to change.
    const suppressed = decideReviewGate({
      escalate: true,
      humanRequired: true,
      labels: [{ name: REVIEW_LABELS.accepted }],
      acceptedSha: '2d4cc065',
      headSha: 'ed32bba83fee',
      acceptedDiff: 'a'.repeat(64),
      acceptedContribution: 'b'.repeat(64),
      headDiff: null,
      headContribution: null,
      headReadFailed: true,
      operatorClearance: { actor: 'Nicolas Gilbert' },
    });
    expect(suppressed.action).toBe('park');
    expect(suppressed.applyLabel).toBe(null);       // the #3184 suppression
    expect(suppressed.staleAcceptance).toBe(true);
    expect(applyEscalationRelief(suppressed, { relieved: true }).waive).toBe(false);
    expect(applyEscalationRelief(suppressed, { relieved: true }).reason).toContain('stale acceptance');
  });

  // ── PRE-EXISTING STRUCTURE THAT SUPPRESSION NOW DEPENDS ON ───────────────────────────────────────────────
  // BOTH OF THE TWO TESTS BELOW WERE GREEN BEFORE #3184 AND PROVE NOTHING ABOUT IT. They are stated plainly as
  // what they are, because a green-before assertion sitting unlabelled inside a change's describe block reads
  // as evidence for that change and is not. What they DO buy: `applyLabel: null` is a new caller of two
  // guards whose shape was previously incidental, and if either is later re-keyed the failure is silent and
  // in the operator's least-recoverable direction. They are regression pins on someone else's code.
  it('[green before #3184 — pinned, not proven] the revocation notice hangs off `gate.applyLabel`', () => {
    // A null label skips the notice structurally, and `revokesClearance` is false as well, so the structural
    // and the flag guard agree. Announcing a revocation that did not happen would send the operator to
    // re-clear a clearance that is still live.
    expect(src).toMatch(/if \(gate\.applyLabel && !DRY_RUN\) \{/);
    expect(src.indexOf('if (gate.revokesClearance) {'))
      .toBeGreaterThan(src.indexOf('if (gate.applyLabel && !DRY_RUN) {'));
  });

  it('[green before #3184 — pinned, not proven] the #2324 body block keys on humanRequired, not the label', () => {
    // Suppression removes the label write, and in the drain the park COMMENT hangs off that write. The durable
    // record survives only because the human-park body block is a separate branch keyed on `gate.humanRequired`
    // — which suppression deliberately leaves true. Re-key that guard to the label and a suppressed park
    // becomes a silent one, which is the #xmnl36p defect coming back by another door.
    expect(src).toMatch(/if \(gate\.humanRequired && !DRY_RUN\) \{/);
  });
});

// ── #3343 — the basis's trust question has to REACH the scorer. `computeNetDiffSignals` is the one derivation
//    both production callers use (pr-land's `applyReviewEscalationLabel` and the drain's scoring loop), so the
//    `basisKind` / `basisNarrowed` the basis resolved must ride out of it — otherwise the distinction exists
//    only inside a function nobody in production calls directly. ────────────────────────────────────────────
describe('computeNetDiffSignals carries the basis trust question (#3343)', () => {
  const fakeExec = (script = {}) => {
    const exec = (cmd, args) => {
      const intent = args.filter((a) => a !== '--end-of-options' && a !== '--verify' && a !== '--no-ext-diff');
      const h = script[`${cmd} ${intent.join(' ')}`];
      if (h && h.throw) throw new Error(h.throw);
      if (h && 'stdout' in h) return h.stdout;
      if (args[0] === 'diff') throw new Error('unknown revision (unstubbed)');
      if (args[0] === 'log') throw new Error('unknown revision range (unstubbed)');
      return '';
    };
    return { exec };
  };

  it("a merge-base basis reports `basisKind:'merge-base'` and `basisNarrowed:true`", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main origin/lane/x': { stdout: 'forkpoint\n' },
      'git diff --numstat forkpoint origin/lane/x': { stdout: '3\t1\tREADME.md\n' },
      'git diff forkpoint origin/lane/x': { stdout: 'diff --git a/README.md b/README.md\n' },
    });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.scored).toBe(true);
    expect(sig.basisKind).toBe('merge-base');
    expect(sig.basisNarrowed).toBe(true);
  });

  it("an ancestry basis reports `basisKind:'ancestry'` and is still NARROWED — it is the PR's own file set", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main origin/lane/x': { throw: 'no common ancestors' },
      'git diff --numstat origin/main origin/lane/x': { stdout: '2\t0\tbacklog/a.md\n4\t4\tdocs/agent/platform-decisions.md\n' },
      'git log --numstat --diff-merges=first-parent --pretty=format: origin/main..origin/lane/x --': { stdout: '2\t0\tbacklog/a.md\n' },
      'git diff origin/main origin/lane/x': { stdout: 'diff --git a/backlog/a.md b/backlog/a.md\n' },
    });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.basisKind).toBe('ancestry');
    expect(sig.basisNarrowed).toBe(true);
    expect(sig.humanBasisFiles).toEqual(['backlog/a.md']);
  });

  it("a base-tip basis reports `basisNarrowed:false` — the signal the producer threads into the human gate", () => {
    const { exec } = fakeExec({
      'git merge-base origin/main origin/lane/x': { throw: 'no common ancestors' },
      'git diff --numstat origin/main origin/lane/x': { stdout: '2\t0\tbacklog/a.md\n4\t4\tdocs/agent/platform-decisions.md\n' },
      'git diff origin/main origin/lane/x': { stdout: 'diff --git a/backlog/a.md b/backlog/a.md\n' },
    });
    const sig = computeNetDiffSignals({ exec, rev: 'lane/x', fetchExtraRefs: ['lane/x'] });
    expect(sig.basisKind).toBe('base-tip');
    expect(sig.basisNarrowed).toBe(false);
  });

  it('an UNRESOLVED basis is not reported as un-narrowed — nothing was measured, which is a different fact', () => {
    const { exec } = fakeExec({});
    const sig = computeNetDiffSignals({ exec, rev: 'lane/gone' });
    expect(sig.scored).toBe(false);
    expect(sig.basisKind).toBe(null);
  });
});
