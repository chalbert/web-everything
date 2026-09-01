/**
 * @file review-status-tag.test.mjs — `review-status:<state>` is purely informative, derived fresh from
 * `claude agents --json` on every read (never cached, never a second source of truth). PURE logic tests +
 * one IO test over injected fakes — no `claude`/`gh` process anywhere in this file.
 */
import { describe, it, expect } from 'vitest';

import { deriveReviewStatus, planStatusLabelChange, tagReviewStatus } from '../review-status-tag.mjs';

describe('deriveReviewStatus', () => {
  it('null when no agent is bound to this PR by name', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'conveyor-3412', state: 'working' }] })).toBeNull();
  });

  it('reviewing: a live review-<pr> session that is actually working', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'review-1765', state: 'working' }] }))
      .toEqual({ role: 'review', state: 'reviewing' });
  });

  it('review-stalled: a review-<pr> session that is blocked, not working', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'review-1765', state: 'blocked' }] }))
      .toEqual({ role: 'review', state: 'review-stalled' });
  });

  it('fixing: a live fix-<pr> session that is actually working', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'fix-1765', state: 'working' }] }))
      .toEqual({ role: 'fix', state: 'fixing' });
  });

  it('fix-stalled: a fix-<pr> session that is blocked, not working', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'fix-1765', state: 'blocked' }] }))
      .toEqual({ role: 'fix', state: 'fix-stalled' });
  });

  it('null for a `done` session — claude agents --json never prunes finished ones, and "done" is not "stuck"', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'review-1765', state: 'done' }] })).toBeNull();
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'fix-1765', state: 'done' }] })).toBeNull();
  });

  it('null for an unrecognized state — only working/blocked count as live', () => {
    expect(deriveReviewStatus({ pr: 1765, agents: [{ name: 'review-1765', state: 'idle' }] })).toBeNull();
  });

  it('review takes precedence when (implausibly) both a review and a fix session exist for the same PR', () => {
    const agents = [{ name: 'fix-1765', state: 'working' }, { name: 'review-1765', state: 'working' }];
    expect(deriveReviewStatus({ pr: 1765, agents })?.role).toBe('review');
  });

  it('picks the working entry over a stale sibling sharing the same name', () => {
    // claude agents --json never prunes finished sessions -- several "review-1765" rows can coexist.
    const agents = [{ name: 'review-1765', state: 'done' }, { name: 'review-1765', state: 'working' }];
    expect(deriveReviewStatus({ pr: 1765, agents })).toEqual({ role: 'review', state: 'reviewing' });
  });

  it('never matches a different PR number by accident', () => {
    expect(deriveReviewStatus({ pr: 176, agents: [{ name: 'review-1765', state: 'working' }] })).toBeNull();
  });
});

describe('planStatusLabelChange', () => {
  it('adds a status label to a PR carrying none', () => {
    expect(planStatusLabelChange({ status: { state: 'reviewing' }, currentLabels: [] }))
      .toEqual({ add: 'review-status:reviewing', remove: [] });
  });

  it('is a no-op when already correct', () => {
    expect(planStatusLabelChange({ status: { state: 'reviewing' }, currentLabels: [{ name: 'review-status:reviewing' }] }))
      .toEqual({ add: null, remove: [] });
  });

  it('swaps a stale status for the new one', () => {
    expect(planStatusLabelChange({ status: { state: 'fixing' }, currentLabels: [{ name: 'review-status:reviewing' }] }))
      .toEqual({ add: 'review-status:fixing', remove: ['review-status:reviewing'] });
  });

  it('removes the label with NO replacement when nothing is live (status: null)', () => {
    expect(planStatusLabelChange({ status: null, currentLabels: [{ name: 'review-status:reviewing' }] }))
      .toEqual({ add: null, remove: ['review-status:reviewing'] });
  });

  it('is a no-op when nothing is live and no stale label exists either', () => {
    expect(planStatusLabelChange({ status: null, currentLabels: [{ name: 'review:pending' }] }))
      .toEqual({ add: null, remove: [] });
  });

  it('leaves every other label untouched', () => {
    const currentLabels = [{ name: 'review:pending' }, { name: 'review-status:fixing' }, { name: 'ready-to-merge' }];
    expect(planStatusLabelChange({ status: { state: 'reviewing' }, currentLabels }))
      .toEqual({ add: 'review-status:reviewing', remove: ['review-status:fixing'] });
  });
});

describe('tagReviewStatus — IO shell over injected fakes (no claude/gh process)', () => {
  const fakeProvider = (labels) => {
    const calls = [];
    return {
      calls,
      readLabels: (repo, pr) => { calls.push(['readLabels', repo, pr]); return labels; },
      setLabels: (repo, pr, spec) => { calls.push(['setLabels', repo, pr, spec]); },
      ensureLabel: (repo, name) => { calls.push(['ensureLabel', repo, name]); },
    };
  };

  it('tags a PR whose review is actively working, ensuring the label exists first', () => {
    const provider = fakeProvider([]);
    const listAgents = () => [{ name: 'review-42', state: 'working' }];
    const result = tagReviewStatus({ pr: 42, repo: 'o/n', listAgents, provider });
    expect(result).toEqual({ changed: true, label: 'review-status:reviewing', removed: [] });
    expect(provider.calls).toEqual([
      ['readLabels', 'o/n', 42],
      ['ensureLabel', 'o/n', 'review-status:reviewing'],
      ['setLabels', 'o/n', 42, { add: 'review-status:reviewing', remove: [] }],
    ]);
  });

  it('clears a stale status label once the session is gone, adding nothing back (no ensureLabel call)', () => {
    const provider = fakeProvider([{ name: 'review-status:reviewing' }]);
    const listAgents = () => [];
    const result = tagReviewStatus({ pr: 42, repo: 'o/n', listAgents, provider });
    expect(result).toEqual({ changed: true, label: null, removed: ['review-status:reviewing'] });
    expect(provider.calls).toEqual([
      ['readLabels', 'o/n', 42],
      ['setLabels', 'o/n', 42, { add: undefined, remove: ['review-status:reviewing'] }],
    ]);
  });

  it('is idempotent — no write call when the label already matches live state', () => {
    const provider = fakeProvider([{ name: 'review-status:fixing' }]);
    const listAgents = () => [{ name: 'fix-42', state: 'working' }];
    const result = tagReviewStatus({ pr: 42, repo: 'o/n', listAgents, provider });
    expect(result).toEqual({ changed: false, label: 'review-status:fixing', removed: [] });
    expect(provider.calls).toEqual([['readLabels', 'o/n', 42]]);
  });
});
