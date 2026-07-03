/**
 * @file scripts/__tests__/merge-ai-prs.test.mjs
 * @description Proof of the pure classifier in `scripts/merge-ai-prs.mjs` — the `/merge` sweep that lands
 *   OPEN AI-generated PRs (orphans the queue-scoped drain never touches). The gh calls are the I/O boundary;
 *   the merge/skip verdict (AI-gate + green-gate + mergeable-gate) is decided here and unit-tested.
 */
import { describe, it, expect } from 'vitest';
import { isAiAuthor, isAiCommit, isAiGeneratedPr, isMechanicalMergeCommit, isRequiredCheckGreen, classifyPr } from '../merge-ai-prs.mjs';

const mechMerge = { messageHeadline: "Merge branch 'main' into lane/x", messageBody: '', authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }] };

const claudeCommit = (extra = {}) => ({ authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }, { name: 'Claude Opus 4.8 (1M context)', email: 'noreply@anthropic.com' }], ...extra });
const humanCommit = { authors: [{ name: 'Nicolas Gilbert', email: 'nic@x.com' }] };
const greenRollup = [{ name: 'test', conclusion: 'SUCCESS' }, { name: 'cla', conclusion: 'FAILURE' }];
const aiPr = (extra = {}) => ({ number: 1, title: 't', commits: [claudeCommit(), claudeCommit()], statusCheckRollup: greenRollup, mergeable: 'MERGEABLE', mergeStateStatus: 'UNSTABLE', ...extra });

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
});
