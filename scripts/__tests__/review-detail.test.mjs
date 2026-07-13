/**
 * @file review-detail.test.mjs — proof of the PURE `assembleReviewDetail` (#2470). The `gh pr view` call is the
 *   I/O boundary (the CLI's concern); the body/label/comment/file → contract distillation is decided in the pure
 *   assembler and unit-tested here against fixtures, no network.
 */
import { describe, it, expect } from 'vitest';
import { assembleReviewDetail, parseEscalationReason } from '../review-detail.mjs';

// A review:human park: the drain stamped an escalation block + posted its advisory AI-review comment, and a
// human already bounced it once (🔁). Mirrors a real `gh pr view … --json` object shape (labels/comments/files
// are arrays of objects).
const parkedHumanView = {
  number: 2470,
  repo: 'chalbert/webeverything',
  title: 'scripts: something touching the gate policy',
  url: 'https://github.com/chalbert/webeverything/pull/2470',
  body: [
    'Original PR body describing the change.',
    '',
    '## Escalation reason',
    '',
    '- gate-self (docs/agent/platform-decisions.md) — human review required',
    '- size (612 ≥ 400 changed lines)',
    '',
    '## Something else',
    '',
    'trailing content that must NOT be read as a reason',
  ].join('\n'),
  labels: [{ name: 'review:human' }, { name: 'ready-to-merge' }],
  comments: [
    { body: 'some unrelated chatter' },
    { body: '🤖 advisory AI review\n\nThe panel found a correctness issue in the retry path.' },
    { body: '🔁 human review — bounced: please add a test for the retry path.' },
  ],
  files: [
    { path: 'docs/agent/platform-decisions.md', additions: 12, deletions: 3 },
    { path: 'scripts/foo.mjs', additions: 40, deletions: 8 },
  ],
};

// An unparked plain PR: no escalation block, no review labels, no advisory/human comments.
const unparkedView = {
  number: 2471,
  repo: 'chalbert/webeverything',
  title: 'docs: fix a typo',
  url: 'https://github.com/chalbert/webeverything/pull/2471',
  body: 'Just a small docs fix. No escalation here.',
  labels: [{ name: 'ready-to-merge' }],
  comments: [{ body: 'lgtm' }],
  files: [{ path: 'README.md', additions: 1, deletions: 1 }],
};

describe('assembleReviewDetail — a review:human parked PR', () => {
  const d = assembleReviewDetail({ view: parkedHumanView });

  it('flags humanRequired and reviewClass "human" from the review:human label', () => {
    expect(d.humanRequired).toBe(true);
    expect(d.reviewClass).toBe('human');
  });

  it('parses the escalation-reason block lines (bullets stripped, next heading not bled in)', () => {
    expect(d.escalationReason).toEqual([
      'gate-self (docs/agent/platform-decisions.md) — human review required',
      'size (612 ≥ 400 changed lines)',
    ]);
  });

  it('derives the disposition from the block (gate-self → converge, no auto-land)', () => {
    expect(d.disposition).toEqual({ mode: 'converge', autoLand: false });
  });

  it('captures the drain advisory comment and the prior human comment', () => {
    expect(d.advisoryComment).toContain('advisory AI review');
    expect(d.humanComment).toContain('🔁 human review');
  });

  it('carries the labels, diff stat, and file count', () => {
    expect(d.labels).toEqual(['review:human', 'ready-to-merge']);
    expect(d.filesChanged).toBe(2);
    expect(d.diffStat[0]).toEqual({ path: 'docs/agent/platform-decisions.md', additions: 12, deletions: 3 });
  });

  it('carries the pr/repo/title/url passthrough', () => {
    expect(d.pr).toBe(2470);
    expect(d.repo).toBe('chalbert/webeverything');
    expect(d.title).toBe('scripts: something touching the gate policy');
    expect(d.url).toBe('https://github.com/chalbert/webeverything/pull/2470');
  });
});

describe('assembleReviewDetail — an unparked PR', () => {
  const d = assembleReviewDetail({ view: unparkedView });

  it('has an empty escalation reason, null disposition, and reviewClass "none"', () => {
    expect(d.escalationReason).toEqual([]);
    expect(d.disposition).toBeNull();
    expect(d.reviewClass).toBe('none');
    expect(d.humanRequired).toBe(false);
  });

  it('has no advisory or human comment', () => {
    expect(d.advisoryComment).toBeNull();
    expect(d.humanComment).toBeNull();
  });
});

describe('assembleReviewDetail — tolerance of missing fields', () => {
  it('an empty view degrades to the empty contract, never throws', () => {
    const d = assembleReviewDetail({ view: {} });
    expect(d.pr).toBe(0);
    expect(d.labels).toEqual([]);
    expect(d.escalationReason).toEqual([]);
    expect(d.disposition).toBeNull();
    expect(d.reviewClass).toBe('none');
    expect(d.diffStat).toEqual([]);
    expect(d.filesChanged).toBe(0);
  });

  it('a missing arg object does not throw', () => {
    expect(() => assembleReviewDetail()).not.toThrow();
  });
});

describe('parseEscalationReason', () => {
  it('returns [] for an absent or non-string body', () => {
    expect(parseEscalationReason(undefined)).toEqual([]);
    expect(parseEscalationReason(null)).toEqual([]);
    expect(parseEscalationReason('no marker here')).toEqual([]);
  });
});
