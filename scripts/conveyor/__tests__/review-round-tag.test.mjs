/**
 * @file review-round-tag.test.mjs — `review-round:<N>` is purely informative, derived from the caller's own
 * round number (never re-derived here). PURE logic tests + one IO test over an injected fake provider — no
 * `gh` process anywhere in this file, mirroring `we:scripts/lib/__tests__/review-label-provider.test.mjs`'s
 * own "assert the argv, not a subprocess" discipline.
 */
import { describe, it, expect } from 'vitest';

import { roundLabel, planRoundLabelChange, tagReviewRound } from '../review-round-tag.mjs';

describe('roundLabel', () => {
  it('formats a positive integer round', () => {
    expect(roundLabel(1)).toBe('review-round:1');
    expect(roundLabel(3)).toBe('review-round:3');
  });
  it('refuses a non-positive-integer round rather than emit a bogus label', () => {
    expect(() => roundLabel(0)).toThrow(/positive integer/);
    expect(() => roundLabel(-1)).toThrow(/positive integer/);
    expect(() => roundLabel('two')).toThrow(/positive integer/);
    expect(() => roundLabel(1.5)).toThrow(/positive integer/);
  });
});

describe('planRoundLabelChange', () => {
  it('adds the round label to a PR that has none', () => {
    expect(planRoundLabelChange({ round: 1, currentLabels: [] })).toEqual({ add: 'review-round:1', remove: [] });
  });

  it('is a no-op when the PR already carries exactly the right label', () => {
    expect(planRoundLabelChange({ round: 2, currentLabels: [{ name: 'review-round:2' }] }))
      .toEqual({ add: null, remove: [] });
  });

  it('replaces a stale round label with the current one', () => {
    expect(planRoundLabelChange({ round: 3, currentLabels: [{ name: 'review-round:2' }] }))
      .toEqual({ add: 'review-round:3', remove: ['review-round:2'] });
  });

  it('leaves every other label untouched — only review-round:* is ever removed', () => {
    const currentLabels = [{ name: 'review:pending' }, { name: 'review-round:1' }, { name: 'ready-to-merge' }];
    expect(planRoundLabelChange({ round: 2, currentLabels })).toEqual({ add: 'review-round:2', remove: ['review-round:1'] });
  });

  it('accepts bare-string labels, not only {name} objects', () => {
    expect(planRoundLabelChange({ round: 2, currentLabels: ['review-round:1'] }))
      .toEqual({ add: 'review-round:2', remove: ['review-round:1'] });
  });

  it('never matches a label that merely starts with the same prefix', () => {
    // e.g. a hypothetical "review-round:1-extra" must not be treated as this module's own stale label.
    const currentLabels = [{ name: 'review-round:1-extra' }];
    expect(planRoundLabelChange({ round: 1, currentLabels })).toEqual({ add: 'review-round:1', remove: [] });
  });
});

describe('tagReviewRound — IO shell over an injected provider (no gh process)', () => {
  const fakeProvider = (labels) => {
    const calls = [];
    return {
      calls,
      readLabels: (repo, pr) => { calls.push(['readLabels', repo, pr]); return labels; },
      setLabels: (repo, pr, spec) => { calls.push(['setLabels', repo, pr, spec]); },
      ensureLabel: (repo, name) => { calls.push(['ensureLabel', repo, name]); },
    };
  };

  it('reads labels, ensures the round label exists, then writes it', () => {
    const provider = fakeProvider([{ name: 'review:pending' }]);
    const result = tagReviewRound({ pr: 42, repo: 'o/n', round: 1, provider });
    expect(result).toEqual({ changed: true, label: 'review-round:1', removed: [] });
    expect(provider.calls).toEqual([
      ['readLabels', 'o/n', 42],
      ['ensureLabel', 'o/n', 'review-round:1'],
      ['setLabels', 'o/n', 42, { add: 'review-round:1', remove: [] }],
    ]);
  });

  it('is idempotent — no ensure/write call when the label already matches', () => {
    const provider = fakeProvider([{ name: 'review-round:1' }]);
    const result = tagReviewRound({ pr: 42, repo: 'o/n', round: 1, provider });
    expect(result).toEqual({ changed: false, label: 'review-round:1', removed: [] });
    expect(provider.calls).toEqual([['readLabels', 'o/n', 42]]); // no ensureLabel/setLabels call
  });

  it('swaps a stale round label for the new one in one write', () => {
    const provider = fakeProvider([{ name: 'review-round:1' }]);
    const result = tagReviewRound({ pr: 42, repo: 'o/n', round: 2, provider });
    expect(result).toEqual({ changed: true, label: 'review-round:2', removed: ['review-round:1'] });
    expect(provider.calls[2]).toEqual(['setLabels', 'o/n', 42, { add: 'review-round:2', remove: ['review-round:1'] }]);
  });

  // #4133 (epic #3383/#4075) — a caller with the tick's own already-fetched labels (`we:skills-src/conveyor/
  // review-daemon.mjs#runReviewTick`) skips the per-PR `gh pr view` entirely.
  describe('currentLabels — skips provider.readLabels entirely when supplied', () => {
    it('never calls readLabels when currentLabels is supplied', () => {
      const provider = fakeProvider([{ name: 'should-never-be-read' }]);
      const result = tagReviewRound({ pr: 42, repo: 'o/n', round: 1, provider, currentLabels: [{ name: 'review:pending' }] });
      expect(result).toEqual({ changed: true, label: 'review-round:1', removed: [] });
      expect(provider.calls.map((c) => c[0])).toEqual(['ensureLabel', 'setLabels']); // no 'readLabels' call
    });

    it('is idempotent off the supplied labels too — no write when they already match', () => {
      const provider = fakeProvider([{ name: 'should-never-be-read' }]);
      const result = tagReviewRound({ pr: 42, repo: 'o/n', round: 1, provider, currentLabels: [{ name: 'review-round:1' }] });
      expect(result).toEqual({ changed: false, label: 'review-round:1', removed: [] });
      expect(provider.calls).toEqual([]); // no readLabels, no ensureLabel/setLabels
    });

    it('omitting it reads fresh — byte-identical to before this option existed', () => {
      const provider = fakeProvider([{ name: 'review:pending' }]);
      tagReviewRound({ pr: 42, repo: 'o/n', round: 1, provider });
      expect(provider.calls[0]).toEqual(['readLabels', 'o/n', 42]);
    });
  });
});
