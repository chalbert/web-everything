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
    const result = tagReviewStatus({ pr: 42, repo: 'chalbert/web-everything', listAgents, provider });
    expect(result).toEqual({ changed: true, label: 'review-status:reviewing', removed: [] });
    expect(provider.calls).toEqual([
      ['readLabels', 'chalbert/web-everything', 42],
      ['ensureLabel', 'chalbert/web-everything', 'review-status:reviewing'],
      ['setLabels', 'chalbert/web-everything', 42, { add: 'review-status:reviewing', remove: [] }],
    ]);
  });

  it('clears a stale status label once the session is gone, adding nothing back (no ensureLabel call)', () => {
    const provider = fakeProvider([{ name: 'review-status:reviewing' }]);
    const listAgents = () => [];
    const result = tagReviewStatus({ pr: 42, repo: 'chalbert/web-everything', listAgents, provider });
    expect(result).toEqual({ changed: true, label: null, removed: ['review-status:reviewing'] });
    expect(provider.calls).toEqual([
      ['readLabels', 'chalbert/web-everything', 42],
      ['setLabels', 'chalbert/web-everything', 42, { add: undefined, remove: ['review-status:reviewing'] }],
    ]);
  });

  it('is idempotent — no write call when the label already matches live state', () => {
    const provider = fakeProvider([{ name: 'review-status:fixing' }]);
    const listAgents = () => [{ name: 'fix-42', state: 'working' }];
    const result = tagReviewStatus({ pr: 42, repo: 'chalbert/web-everything', listAgents, provider });
    expect(result).toEqual({ changed: false, label: 'review-status:fixing', removed: [] });
    expect(provider.calls).toEqual([['readLabels', 'chalbert/web-everything', 42]]);
  });

  // #4133 (epic #3383/#4075) — a caller with the tick's own already-fetched `claude agents --json` listing and
  // PR labels (`we:skills-src/conveyor/review-daemon.mjs#runReviewTick`) skips BOTH re-fetches entirely.
  describe('agents / currentLabels — skip listAgents()/provider.readLabels() entirely when supplied', () => {
    it('never calls listAgents or provider.readLabels when both are supplied', () => {
      let listAgentsCalls = 0;
      const listAgents = () => { listAgentsCalls++; return []; };
      const provider = fakeProvider([{ name: 'should-never-be-read' }]);
      const result = tagReviewStatus({
        pr: 42, repo: 'chalbert/web-everything', listAgents, provider,
        agents: [{ name: 'review-42', state: 'working' }], currentLabels: [],
      });
      expect(result).toEqual({ changed: true, label: 'review-status:reviewing', removed: [] });
      expect(listAgentsCalls).toBe(0);
      expect(provider.calls.map((c) => c[0])).toEqual(['ensureLabel', 'setLabels']); // no 'readLabels' call
    });

    it('is idempotent off the supplied data too — no write when it already matches', () => {
      const provider = fakeProvider([{ name: 'should-never-be-read' }]);
      const result = tagReviewStatus({
        pr: 42, repo: 'chalbert/web-everything', provider,
        agents: [{ name: 'review-42', state: 'working' }], currentLabels: [{ name: 'review-status:reviewing' }],
      });
      expect(result).toEqual({ changed: false, label: 'review-status:reviewing', removed: [] });
      expect(provider.calls).toEqual([]);
    });

    it('omitting both reads fresh — byte-identical to before these options existed', () => {
      const provider = fakeProvider([]);
      const listAgents = () => [{ name: 'review-42', state: 'working' }];
      tagReviewStatus({ pr: 42, repo: 'chalbert/web-everything', listAgents, provider });
      expect(provider.calls[0]).toEqual(['readLabels', 'chalbert/web-everything', 42]);
    });
  });
});

it('tags only the matching repo session', () => {
  const agents = [{ name: 'review-fui-49', state: 'working' }];
  expect(deriveReviewStatus({ pr: 49, agents })).toBeNull();
  expect(deriveReviewStatus({ pr: 49, agents, repo: 'frontierui' })).toEqual({ role: 'review', state: 'reviewing' });
  const provider = { readLabels: () => [], ensureLabel: () => {}, setLabels: () => {} };
  expect(tagReviewStatus({ pr: 49, repo: 'chalbert/frontierui', listAgents: () => agents, provider }).label).toBe('review-status:reviewing');
  expect(() => tagReviewStatus({ pr: 49, repo: 'other/repo' })).toThrow(/not a constellation repo/);
});
