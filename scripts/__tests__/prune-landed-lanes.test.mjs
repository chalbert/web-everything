/**
 * @file scripts/__tests__/prune-landed-lanes.test.mjs
 * @description Unit proof of the pure classifier in `scripts/prune-landed-lanes.mjs` — the #2226
 *   content-verified sweep for stale `origin/lane/*` refs. `git merge-tree` / `gh pr list` are the I/O
 *   boundary (the CLI); `classifyLaneBranch` decides delete/keep/skip from precomputed inputs, so the
 *   safety property ("never delete a ref with live or unverifiable content") is provable without git/gh.
 */
import { describe, it, expect } from 'vitest';
import { isLaneBranch, openPrHeadRefs, classifyLaneBranch } from '../prune-landed-lanes.mjs';

describe('prune-landed-lanes — isLaneBranch', () => {
  it('accepts only lane/* refs', () => {
    expect(isLaneBranch('lane/2226-foo')).toBe(true);
    expect(isLaneBranch('lane/_base-batch-x')).toBe(true);
    expect(isLaneBranch('main')).toBe(false);
    expect(isLaneBranch('release/1.0')).toBe(false);
    expect(isLaneBranch(undefined)).toBe(false);
  });
});

describe('prune-landed-lanes — openPrHeadRefs', () => {
  it('collects headRefName from a gh pr list --json headRefName payload', () => {
    const set = openPrHeadRefs([{ headRefName: 'lane/a' }, { headRefName: 'lane/b' }]);
    expect(set.has('lane/a')).toBe(true);
    expect(set.has('lane/c')).toBe(false);
  });
  it('is empty/safe on no PRs or malformed entries', () => {
    expect(openPrHeadRefs([]).size).toBe(0);
    expect(openPrHeadRefs(null).size).toBe(0);
    expect(openPrHeadRefs([{}, { headRefName: null }]).size).toBe(0);
  });
});

describe('prune-landed-lanes — classifyLaneBranch (safety property: never delete live/unverifiable content)', () => {
  it('SKIPS any branch backing an open PR, even if content looks superseded', () => {
    const v = classifyLaneBranch('lane/x', { hasOpenPr: true, mergeTree: { ok: true, treeEqualsMain: true } });
    expect(v.verdict).toBe('skip');
  });
  it('DELETEs only when content is byte-identical to origin/main (three-way merge == main tree)', () => {
    const v = classifyLaneBranch('lane/x', { hasOpenPr: false, mergeTree: { ok: true, treeEqualsMain: true } });
    expect(v.verdict).toBe('delete');
  });
  it('KEEPs a clean merge that still differs from main (real unmerged content, no open PR — orphaned WIP)', () => {
    const v = classifyLaneBranch('lane/x', { hasOpenPr: false, mergeTree: { ok: true, treeEqualsMain: false } });
    expect(v.verdict).toBe('keep');
  });
  it('KEEPs on a merge-tree conflict (git exits non-zero) — never auto-deletes on doubt', () => {
    const v = classifyLaneBranch('lane/x', { hasOpenPr: false, mergeTree: { ok: false } });
    expect(v.verdict).toBe('keep');
  });
  it('KEEPs when the merge-tree computation is missing entirely (e.g. origin/main tree lookup failed)', () => {
    const v = classifyLaneBranch('lane/x', { hasOpenPr: false, mergeTree: null });
    expect(v.verdict).toBe('keep');
  });
});
