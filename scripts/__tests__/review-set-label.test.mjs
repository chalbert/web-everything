/**
 * @file review-set-label.test.mjs — proof of the PURE `decideSetLabel` (#2470, increment 2). The `gh` calls are
 *   the I/O boundary (the CLI's concern); the verdict → label-swap decision — including INVARIANT 2 (a
 *   review:human PR is never cleared to accepted here) — is decided in the pure decider and unit-tested here
 *   against fixtures, no network.
 */
import { describe, it, expect } from 'vitest';
import { decideSetLabel, presentRemoveLabels, buildVerdictComment } from '../review-set-label.mjs';
import { REVIEW_LABELS } from '../lib/review-escalation.mjs';

const human = [{ name: REVIEW_LABELS.human }, { name: 'ready-to-merge' }];
const pending = [{ name: REVIEW_LABELS.pending }, { name: 'ready-to-merge' }];
const accepted = [{ name: REVIEW_LABELS.accepted }, { name: 'ready-to-merge' }];
const neither = [{ name: 'ready-to-merge' }];

describe('decideSetLabel — INVARIANT 2 (review:human is human-ceremony-only)', () => {
  it('REFUSES accepted on a review:human PR (gate-self reason, no swap)', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: human });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('gate-self: review:human is human-ceremony-only — clear via /review in a session');
    expect(d.addLabel).toBe('');
    expect(d.removeLabels).toEqual([]);
  });
});

describe('decideSetLabel — accepted', () => {
  it('on a review:pending PR: adds review:accepted, removes review:pending', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: pending });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.pending]);
  });

  it('with neither human nor pending: still allowed (no human gate), adds review:accepted', () => {
    const d = decideSetLabel({ to: 'accepted', currentLabels: neither });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.pending]);
  });
});

describe('decideSetLabel — changes (a bounce lands nothing)', () => {
  it('on a review:human PR: allowed, adds review:changes, does NOT remove review:human', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: human });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.changes);
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
  });

  it('on a review:pending PR: allowed, adds review:changes, removes review:pending', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: pending });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.changes);
    expect(d.removeLabels).toContain(REVIEW_LABELS.pending);
  });

  it('strips a stale review:accepted (a bounce must never leave the PR looking accepted)', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: accepted });
    expect(d.allowed).toBe(true);
    expect(d.removeLabels).toContain(REVIEW_LABELS.accepted);
    // review:human is never in the removal set, even on the changes path.
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
  });
});

describe('decideSetLabel — rearm (#2644, folded in from the conveyor decideRearm)', () => {
  const changes = [{ name: REVIEW_LABELS.changes }, { name: 'ready-to-merge' }];
  const humanChanges = [{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.changes }];

  it('re-arms a review:changes bounce → review:pending, dropping review:changes', () => {
    const d = decideSetLabel({ to: 'rearm', currentLabels: changes });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]);
    expect(d.keepsHuman).toBe(false);
  });

  it('NEVER emits review:accepted and NEVER removes review:human (the #2630 invariant)', () => {
    const d = decideSetLabel({ to: 'rearm', currentLabels: humanChanges });
    expect(d.allowed).toBe(true);
    expect(d.addLabel).toBe(REVIEW_LABELS.pending);
    expect(d.addLabel).not.toBe(REVIEW_LABELS.accepted);
    expect(d.removeLabels).toEqual([REVIEW_LABELS.changes]);
    expect(d.removeLabels).not.toContain(REVIEW_LABELS.human);
    expect(d.keepsHuman).toBe(true);
  });

  it('refuses (idempotent no-op) when there is no review:changes to re-arm', () => {
    expect(decideSetLabel({ to: 'rearm', currentLabels: pending }).allowed).toBe(false);
    expect(decideSetLabel({ to: 'rearm', currentLabels: human }).allowed).toBe(false);
    expect(decideSetLabel({ to: 'rearm', currentLabels: [] }).allowed).toBe(false);
  });
});

describe('presentRemoveLabels — intersect the decision removals with the labels actually present', () => {
  it('a removeLabel NOT in currentLabels is not passed through (never handed to gh)', () => {
    // changes wants to drop [pending, accepted], but the PR only carries pending → accepted must not survive.
    const d = decideSetLabel({ to: 'changes', currentLabels: pending });
    const removals = presentRemoveLabels(d.removeLabels, pending);
    expect(removals).toEqual([REVIEW_LABELS.pending]);
    expect(removals).not.toContain(REVIEW_LABELS.accepted);
  });

  it('keeps only present labels when both are carried', () => {
    const carries = [{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }];
    const d = decideSetLabel({ to: 'changes', currentLabels: carries });
    expect(presentRemoveLabels(d.removeLabels, carries)).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.accepted]);
  });

  it('never intersects review:human into the removals on a bounce', () => {
    const d = decideSetLabel({ to: 'changes', currentLabels: human });
    expect(presentRemoveLabels(d.removeLabels, human)).not.toContain(REVIEW_LABELS.human);
  });
});

describe('decideSetLabel — bad input', () => {
  it('throws on an unknown verdict', () => {
    expect(() => decideSetLabel({ to: 'merge', currentLabels: neither })).toThrow();
    expect(() => decideSetLabel({ to: undefined, currentLabels: neither })).toThrow();
  });
});

describe('buildVerdictComment — the reviewed-sha stamp and the caller body (#2882/#2409)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';

  it('stamps the marker FIRST on an accept, so a body quoting an older marker cannot win parseReviewedSha', () => {
    const older = '0123456789abcdef0123456789abcdef01234567';
    const out = buildVerdictComment({
      to: 'accepted', actor: 'op', headSha: SHA,
      body: `discussing the prior round: <!-- reviewed-sha: ${older} -->`,
    });
    expect(out.startsWith(`<!-- reviewed-sha: ${SHA} -->`)).toBe(true);
    // parseReviewedSha takes the LAST marker; a leading stamp only loses to a later one the caller wrote, which
    // is why the order matters. Assert the stamped marker precedes the quoted one.
    expect(out.indexOf(SHA)).toBeLessThan(out.indexOf(older));
  });

  it('omits the marker on a changes verdict', () => {
    const out = buildVerdictComment({ to: 'changes', actor: 'op', headSha: SHA, body: 'fix these' });
    expect(out).not.toContain('reviewed-sha');
    expect(out).toContain('🔁 review — changes requested');
  });

  it('omits the marker (never a garbage one) when the head SHA is unavailable', () => {
    expect(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: '' })).not.toContain('reviewed-sha');
    expect(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: 'not-a-sha' })).not.toContain('reviewed-sha');
  });

  it('includes the caller body, and stays the one-liner when none is passed', () => {
    const withBody = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA, body: '## Findings\n1 major' });
    expect(withBody).toContain('## Findings');
    const bare = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA });
    expect(bare).toContain('Recorded by op via the Plateau Loop review console.');
    expect(bare.trim().endsWith('review console.')).toBe(true);
  });
});
