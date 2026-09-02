/**
 * @file scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs
 * @description Part of the merge-ai-prs.test.mjs split (originally one 4650-line file — see git history for the
 *   full-file description). This file covers: the ci-lifecycle labels (shouldLabelOnGreen/labelOnGreenVerdict,
 *   isRequiredCheckFailed, lifecycleLabelFromCiTruth, planCiLifecycleLabelUpdate), the review-label-collision
 *   detector, spawnReviewSetLabel, the rebase-drop candidate gate (#2198/#3350), isStackedWeCoupleHalf,
 *   resolveRepos/siblingCloneName, and the land-time side effects (manifest-strip, derived regen, numbering
 *   push, primary-path resolve/sync, detached-cwd resync, and the drain reason comment) — all exported from
 *   `scripts/merge-ai-prs.mjs`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { labelOnGreenVerdict, isRequiredCheckGreen, isRequiredCheckFailed, hasLabel, classifyPr, isRebaseDropCandidate, needsManifestStripBeforeMerge, restampAcceptance, spawnReviewSetLabel, isStackedWeCoupleHalf, shouldRepollForLabelLag, shouldLabelOnGreen, resolveRepos, siblingCloneName, regenDerivedOnLand, pushNumberingOnLand, resolvePrimaryPath, syncPrimaryOnLand, resyncDetachedCwdForLand, drainReasonMarker, buildDrainReasonComment, buildHeldReviewHoldReason, hasDrainReasonComment, shouldPostParkReasonComment, LAND_REASON, CI_LIFECYCLE_LABELS, CI_LIFECYCLE_LABEL_META, lifecycleLabelFromCiTruth, planCiLifecycleLabelUpdate, hasStaleReviewPendingBesideAccept, remoteManifestApiArgs, landedIdsForCandidate } from '../merge-ai-prs.mjs';
import { REVIEW_LABELS } from '../lib/review-escalation.mjs';
import { claudeCommit, humanCommit, greenRollup, aiPr } from './fixtures/merge-ai-prs-fixtures.mjs';


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

describe('hasStaleReviewPendingBesideAccept — the label-collision detector (chunk 1 of the operator-supervisor port)', () => {
  it('true when both review:accepted and review:pending are present at once', () => {
    expect(hasStaleReviewPendingBesideAccept({ currentLabels: [{ name: 'review:accepted' }, { name: 'review:pending' }] })).toBe(true);
  });
  it('false with only review:accepted', () => {
    expect(hasStaleReviewPendingBesideAccept({ currentLabels: [{ name: 'review:accepted' }] })).toBe(false);
  });
  it('false with only review:pending', () => {
    expect(hasStaleReviewPendingBesideAccept({ currentLabels: [{ name: 'review:pending' }] })).toBe(false);
  });
  it('false with neither', () => {
    expect(hasStaleReviewPendingBesideAccept({ currentLabels: [{ name: 'ready-to-merge' }] })).toBe(false);
  });
  it('false with no labels at all', () => {
    expect(hasStaleReviewPendingBesideAccept({})).toBe(false);
  });
  it('tolerates string-shaped labels too (hasLabel\'s own tolerance)', () => {
    expect(hasStaleReviewPendingBesideAccept({ currentLabels: ['review:accepted', 'review:pending'] })).toBe(true);
  });
});

describe('spawnReviewSetLabel (#1671 review finding — repoFlag() is the WRONG shape for review-set-label.mjs)', () => {
  const spy = (status = 0) => {
    const calls = [];
    const spawn = (cmd, argv, opts) => { calls.push({ cmd, argv, opts }); return { status, stdout: '', stderr: '' }; };
    return { calls, spawn };
  };

  it('emits the SINGLE-token --repo= form review-set-label.mjs actually parses, never repoFlag()\'s two-token gh form', () => {
    const { calls, spawn } = spy();
    const out = spawnReviewSetLabel({ pr: 1671, repo: 'chalbert/web-everything', to: 'accepted', spawn });
    expect(out).toEqual({ ok: true });
    expect(calls[0].argv).toContain('--repo=chalbert/web-everything');
    expect(calls[0].argv).not.toContain('--repo'); // the gh-CLI two-token form — never emitted here
  });

  it('pins the child to a sibling repo\'s clone, exactly like restampAcceptance does for the same CLI (#3202)', () => {
    const { calls, spawn } = spy();
    spawnReviewSetLabel({ pr: 9, repo: 'frontierui', to: 'accepted', cwd: '/ws/frontierui', spawn });
    expect(calls[0].opts.cwd).toBe('/ws/frontierui');
  });

  it('inherits the caller\'s cwd (undefined) for a local-repo PR', () => {
    const { calls, spawn } = spy();
    spawnReviewSetLabel({ pr: 9, repo: 'chalbert/web-everything', to: 'accepted', spawn });
    expect(calls[0].opts.cwd).toBeUndefined();
  });

  it('a non-zero exit reports ok:false with a reason, never throws — the #1671 bug\'s failure was silent, this one is not', () => {
    const { spawn } = spy(2);
    expect(() => spawnReviewSetLabel({ pr: 1671, repo: 'chalbert/web-everything', to: 'accepted', spawn })).not.toThrow();
    const out = spawnReviewSetLabel({ pr: 1671, repo: 'chalbert/web-everything', to: 'accepted', spawn: () => ({ status: 2, stdout: '{"error":"invalid --repo"}', stderr: '' }) });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/invalid --repo/);
  });

  it('a thrown spawn (e.g. ENOENT) is caught, never propagates', () => {
    const spawn = () => { throw new Error('spawn ENOENT'); };
    expect(() => spawnReviewSetLabel({ pr: 1, repo: 'chalbert/web-everything', to: 'accepted', spawn })).not.toThrow();
    expect(spawnReviewSetLabel({ pr: 1, repo: 'chalbert/web-everything', to: 'accepted', spawn }).ok).toBe(false);
  });

  it('passes through optional --actor/--channel/--reason only when supplied', () => {
    const { calls, spawn } = spy();
    spawnReviewSetLabel({ pr: 1, repo: 'chalbert/web-everything', to: 'accepted', spawn });
    expect(calls[0].argv.some((a) => a.startsWith('--actor='))).toBe(false);
    calls.length = 0;
    spawnReviewSetLabel({ pr: 1, repo: 'chalbert/web-everything', to: 'clear-human', actor: 'nic', reason: 'operator said so', spawn });
    expect(calls[0].argv).toContain('--actor=nic');
    expect(calls[0].argv).toContain('--reason=operator said so');
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

describe('#3350 — the rebase livelock is documented where the precondition lives', () => {
  const SRC_3350 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'merge-ai-prs.mjs'), 'utf8');
  const ANCHOR = 'export function isRebaseDropCandidate';
  const INVARIANT = /do not rebase a queued PR from outside the drain/i;
  const WINDOW = 1200;

  /**
   * The card's own shell probe, hardened. It answers ONE question about ONE file: does the invariant sentence
   * appear in the `WINDOW` characters immediately before the `isRebaseDropCandidate` declaration?
   *
   * The hardening matters: the card's snippet used `s.slice(Math.max(0, i - 1200), i)` with an un-checked `i`,
   * so on a file with no such declaration `i === -1` and it slices `s.slice(0, -1)` — very nearly the WHOLE
   * file. That variant reports "documented" for any file that merely mentions the sentence anywhere. Returning
   * false on a missing anchor is what makes this a real check rather than one that passes on any file; the
   * `no anchor` case below pins it.
   */
  const noteNearPredicate = (src) => {
    const i = src.indexOf(ANCHOR);
    if (i < 0) return false;
    return INVARIANT.test(src.slice(Math.max(0, i - WINDOW), i));
  };

  it('states the invariant in the predicate\'s own docblock', () => {
    expect(noteNearPredicate(SRC_3350)).toBe(true);
  });

  it('states the REASON too — the bare instruction reads as territorial and gets routed around', () => {
    const i = SRC_3350.indexOf(ANCHOR);
    const doc = SRC_3350.slice(Math.max(0, i - WINDOW), i);
    // A rebase moves the head → `test` restarts → `testGreen` is false → not a candidate → the drain skips it.
    expect(doc).toMatch(/restarts?\b[^.]*\btest\b/i);
    expect(doc).toMatch(/testGreen/);
    expect(doc).toMatch(/livelock/i);
  });

  it('the note discriminates — removing the sentence makes the check FAIL', () => {
    const stripped = SRC_3350.replace(INVARIANT, 'this predicate is gated on the required check');
    expect(stripped).not.toBe(SRC_3350);
    expect(noteNearPredicate(stripped)).toBe(false);
  });

  it('proximity is load-bearing — the sentence far from the predicate does NOT satisfy the check', () => {
    const far = `// do not rebase a queued PR from outside the drain\n${'// filler\n'.repeat(400)}${ANCHOR}(v) {}\n`;
    expect(INVARIANT.test(far)).toBe(true);
    expect(noteNearPredicate(far)).toBe(false);
  });

  it('no anchor ⇒ false (the un-hardened slice would have said true)', () => {
    const noAnchor = 'do not rebase a queued PR from outside the drain\n';
    expect(noteNearPredicate(noAnchor)).toBe(false);
    // The card's un-hardened form, shown failing on the same input.
    const j = noAnchor.indexOf(ANCHOR);
    expect(INVARIANT.test(noAnchor.slice(Math.max(0, j - WINDOW), j))).toBe(true);
  });

  it('the rebase pass itself carries the invariant at its call site', () => {
    const pass = SRC_3350.indexOf('const rebased = [];');
    expect(pass).toBeGreaterThan(0);
    expect(SRC_3350.slice(Math.max(0, pass - WINDOW), pass)).toMatch(INVARIANT);
  });

  // What the note protects, stated as behaviour on ONE PR through the red→green transition a rebase causes.
  // The standing coverage is the '#2198' block above (a red `test` is NOT a candidate / a BEHIND certified+green
  // PR IS one); this restates it as the livelock's two ends so the block reads on its own.
  it('a certified BEHIND PR is NOT a candidate while `test` re-runs, and IS one once green', () => {
    const rerunning = classifyPr(aiPr({ number: 3350, mergeable: 'MERGEABLE', mergeStateStatus: 'BEHIND', statusCheckRollup: [{ name: 'test', status: 'IN_PROGRESS', conclusion: null }] }), {});
    expect(rerunning.testGreen).toBe(false);
    expect(isRebaseDropCandidate(rerunning)).toBe(false);
    const green = classifyPr(aiPr({ number: 3350, mergeable: 'MERGEABLE', mergeStateStatus: 'BEHIND' }), {});
    expect(green.testGreen).toBe(true);
    expect(isRebaseDropCandidate(green)).toBe(true);
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

describe('pushNumberingOnLand — the #3379 extraction (#1664/#1665 stranded a hash each, silently)', () => {
  it('shouldPush=false is a no-op: no exec call, not pushed', () => {
    const calls = [];
    const exec = (...a) => { calls.push(a); };
    const r = pushNumberingOnLand({ exec, shouldPush: false });
    expect(r).toEqual({ pushed: false });
    expect(calls.length).toBe(0);
  });

  it('a successful push reports pushed:true, with no warning', () => {
    const calls = [];
    const exec = (cmd, args, opts) => { calls.push({ cmd, args, opts }); };
    const r = pushNumberingOnLand({ exec, shouldPush: true, remote: 'origin', base: 'main' });
    expect(r).toEqual({ pushed: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ cmd: 'git', args: ['push', 'origin', 'HEAD:main'] });
    expect(calls[0].opts.env.MAIN_PUSH_OK).toBe('1'); // gated main write, as the drain
  });

  it('a failed push reports pushed:false with a `warning` — the exact #1664/#1665 shape, never thrown', () => {
    const exec = () => { throw new Error('! [rejected] HEAD -> main (non-fast-forward)'); };
    expect(() => pushNumberingOnLand({ exec, shouldPush: true })).not.toThrow();
    const r = pushNumberingOnLand({ exec, shouldPush: true });
    expect(r.pushed).toBe(false);
    expect(r.warning).toMatch(/numbering\/resolve committed locally but push FAILED/);
    expect(r.warning).toMatch(/non-fast-forward/);
  });

  it('no exec function supplied is a no-op, not a crash', () => {
    expect(pushNumberingOnLand({ shouldPush: true })).toEqual({ pushed: false });
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

  // xsbyo56 — the #2832 held-reconcile comment must name the SPECIFIC file(s) that forced the hold (read back
  // from the PR body's #2324 `## Escalation reason` block), not just the hold label. PR #1814 is the observed
  // failure: it touched 3 files but only `docs/agent/platform-decisions.md` is gate-self/sensitive, and the
  // comment the drain actually posted named only `review:human` — no file. Fixture below is that PR's real
  // shape, verbatim.
  describe('buildHeldReviewHoldReason (xsbyo56 — name the file(s), not just the label)', () => {
    const PR_1814_BODY = [
      '## Summary',
      '',
      'some PR body text unrelated to escalation',
      '',
      '## Escalation reason',
      '',
      '- blast-radius (docs/agent/platform-decisions.md)',
      '- statute (docs/agent/platform-decisions.md) — human review required',
      '',
      '<!-- policy-set: v1 87688229b08c -->',
    ].join('\n');

    it('names the specific file(s) from the escalation-reason block when the PR body carries one', () => {
      const reason = buildHeldReviewHoldReason({ labels: [{ name: 'review:human' }], body: PR_1814_BODY });
      expect(reason).toContain('docs/agent/platform-decisions.md');
      expect(reason).toContain('statute (docs/agent/platform-decisions.md) — human review required');
      // The generic scaffolding survives — this ADDS detail, it doesn't replace the existing wording.
      expect(reason).toContain('held — a review hold (review:human) stands');
      expect(reason).toContain('Clear the review to release it.');
    });

    it('falls back to the pre-existing generic wording when the body carries no escalation-reason block', () => {
      const reason = buildHeldReviewHoldReason({ labels: [{ name: 'review:pending' }], body: 'no block here' });
      expect(reason).toBe('held — a review hold (review:pending) stands, so the "ready-to-merge" go-ahead is withheld even though the required check is green (#2832). Clear the review to release it.');
    });

    it('falls back to the generic wording when the body is absent entirely', () => {
      const reason = buildHeldReviewHoldReason({ labels: [{ name: 'review:changes' }] });
      expect(reason).not.toContain('Specifically:');
      expect(reason).toContain('held — a review hold (review:changes) stands');
    });

    it('names every hold label present, same as before (multi-label case unaffected)', () => {
      const reason = buildHeldReviewHoldReason({ labels: [{ name: 'review:pending' }, { name: 'review:changes' }], body: '' });
      expect(reason).toContain('review:pending, review:changes');
    });

    it('respects a non-default label name in the go-ahead phrase', () => {
      const reason = buildHeldReviewHoldReason({ labels: [{ name: 'review:human' }], body: '', label: 'custom-label' });
      expect(reason).toContain('the "custom-label" go-ahead is withheld');
    });
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

// #3441 — the resolve-on-land non-manifest path (#3412's incident: a single-locus WE PR merged and its
// backlog item stayed `active` forever, because resolve-on-land only ever looked at manifest carriers).
describe('landedIdsForCandidate (#3441 — resolve-on-land for a plain single-locus WE PR, not just manifest couples)', () => {
  const isLocalRepo = (repo) => repo == null || repo === 'web-everything';

  it('manifest carrier — unchanged: contributes its own .item, ignoring headRef/title entirely', () => {
    expect(landedIdsForCandidate({ hasManifest: true, item: 3457, repo: null, headRef: 'lane/xdecoy-nope' }, { isLocalRepo })).toEqual([3457]);
  });

  it('manifest carrier with no item → contributes nothing (unchanged)', () => {
    expect(landedIdsForCandidate({ hasManifest: true, item: null }, { isLocalRepo })).toEqual([]);
  });

  it('no manifest, WE repo — derives the item from a plain lane/<NNN>-<slug> headRef (the #3412 shape)', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: null, headRef: 'lane/3412-resolve-fix', title: 'WE #3412: resolve fix' }, { isLocalRepo })).toEqual([3412]);
  });

  it('no manifest, WE repo, headRef carries no number — falls back to the title\'s #NNN', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: null, headRef: 'some-feature-branch', title: 'Fix the drain (#2330)' }, { isLocalRepo })).toEqual([2330]);
  });

  it('no manifest, NON-WE repo — an impl half of a cross-locus couple must NEVER resolve on its own', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: 'frontierui', headRef: 'lane/3412-resolve-fix', title: '' }, { isLocalRepo })).toEqual([]);
  });

  it('no manifest, WE repo, no extractable number — safe empty result', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: null, headRef: 'release-2026', title: '' }, { isLocalRepo })).toEqual([]);
  });

  it('a batch ref can name several ids at once', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: null, headRef: 'lane/batch-2026-07-08-2245-2281', title: '' }, { isLocalRepo })).toEqual([2245, 2281]);
  });

  it('null/undefined candidate → empty, never throws', () => {
    expect(landedIdsForCandidate(null, { isLocalRepo })).toEqual([]);
    expect(landedIdsForCandidate(undefined, { isLocalRepo })).toEqual([]);
  });

  it('defaults isLocalRepo to always-false when omitted — a non-manifest candidate resolves nothing by default', () => {
    expect(landedIdsForCandidate({ hasManifest: false, item: null, repo: null, headRef: 'lane/3412-resolve-fix', title: '' })).toEqual([]);
  });
});
