/**
 * @file review-set-label.test.mjs — proof of the PURE `decideSetLabel` (#2470, increment 2). The `gh` calls are
 *   the I/O boundary (the CLI's concern); the verdict → label-swap decision — including INVARIANT 2 (a
 *   review:human PR is never cleared to accepted here) — is decided in the pure decider and unit-tested here
 *   against fixtures, no network.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideSetLabel, presentRemoveLabels, buildVerdictComment, stripReviewedShaMarkers } from '../review-set-label.mjs';
import { parseReviewedSha } from '../lib/review-escalation.mjs';
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

describe('buildVerdictComment — the stamp must survive the REAL reader (#2882/#2409)', () => {
  const SHA = 'abf7d85700a3336a0ec77d94ab455162d4b8e00d';
  const OLDER = '0123456789abcdef0123456789abcdef01234567';
  // Round-trip through the actual consumer, never a string-position assertion. The first cut of #2882 asserted
  // `indexOf(SHA) < indexOf(older)` and passed while being WRONG: parseReviewedSha is last-match-wins, so the
  // leading stamp lost to a quoted marker. Verifying producer and consumer independently is what hid it.
  const readBack = (comment) => parseReviewedSha([{ body: comment }]);

  it('round-trips to the stamped sha even when the body quotes an OLDER marker', () => {
    const comment = buildVerdictComment({
      to: 'accepted', actor: 'op', headSha: SHA,
      body: `re-accepting; the prior round covered <!-- reviewed-sha: ${OLDER} -->, the head only moved by rebase`,
    });
    expect(readBack(comment)).toBe(SHA);
  });

  it('round-trips when the body quotes SEVERAL markers, including one at the very end', () => {
    const comment = buildVerdictComment({
      to: 'accepted', actor: 'op', headSha: SHA,
      body: `first <!-- reviewed-sha: ${OLDER} --> and last <!-- reviewed-sha: ${'a'.repeat(40)} -->`,
    });
    expect(readBack(comment)).toBe(SHA);
  });

  it('neutralises quoted markers but keeps them READABLE — the write-up still says what it meant', () => {
    const out = stripReviewedShaMarkers(`prior round: <!-- reviewed-sha: ${OLDER} -->`);
    expect(out).toContain(OLDER);
    expect(out).not.toContain('<!--');
  });

  it('reads back nothing on a changes verdict, even with a quoted marker in the body', () => {
    const comment = buildVerdictComment({
      to: 'changes', actor: 'op', headSha: SHA, body: `see <!-- reviewed-sha: ${OLDER} -->`,
    });
    expect(readBack(comment)).toBe(null);
    expect(comment).toContain('🔁 review — changes requested');
  });

  it('stamps nothing (never a garbage marker) when the head SHA is unavailable', () => {
    expect(readBack(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: '' }))).toBe(null);
    expect(readBack(buildVerdictComment({ to: 'accepted', actor: 'op', headSha: 'not-a-sha' }))).toBe(null);
  });

  it('includes the caller body, and stays the one-liner when none is passed', () => {
    const withBody = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA, body: '## Findings\n1 major' });
    expect(withBody).toContain('## Findings');
    expect(readBack(withBody)).toBe(SHA);
    const bare = buildVerdictComment({ to: 'accepted', actor: 'op', headSha: SHA });
    expect(bare).toContain('Recorded by op via the Plateau Loop review console.');
    expect(readBack(bare)).toBe(SHA);
  });
});

describe('--body-file size pre-flight projects with the ACTUAL actor (the partial-swap guard)', () => {
  // The projection is inside the `IS_CLI` block, so the only honest test is to RUN the CLI. It refuses before
  // the first `gh` call (the body-file checks all precede `runReviewLabelCli`), so no stub is needed.
  //
  // The bug this pins: the projection used to assume `actor: 'x'.repeat(64)` while `--actor` is unbounded caller
  // input rendered verbatim into the attribution line. That made the check an ESTIMATE, not the upper bound the
  // guard needs — and it erred in the one direction that matters. A body sized to pass the estimate posts OVER
  // GitHub's cap, by which point `gh pr edit` has already applied the label: the PR is left `review:accepted`
  // with NO `reviewed-sha` marker, and `acceptanceCoversHead` fails OPEN on a missing marker, so the drain lands
  // it. That is exactly the accepted-without-a-marker state this pre-flight exists to prevent.
  // vitest hands `import.meta.url` as a bare path in some modes, so only run it through `fileURLToPath` when it
  // really is a file: URL. Deriving from this module's own location keeps the test cwd-independent.
  const HERE = import.meta.url.startsWith('file:') ? dirname(fileURLToPath(import.meta.url)) : dirname(import.meta.url);
  const CLI = join(HERE, '..', 'review-set-label.mjs');

  /** Run the CLI with a body file of `bodyLen` chars and an actor of `actorLen` chars. Returns parsed stdout. */
  const runWithBody = (bodyLen, actorLen) => {
    // Under the repo root — the CLI constrains --body-file to the cwd or the temp dir (a public-PR leak guard).
    const file = join(tmpdir(), `review-set-label-size-${bodyLen}-${actorLen}.md`);
    writeFileSync(file, 'x'.repeat(bodyLen));
    try {
      const out = execFileSync(process.execPath, [
        CLI, '999', '--repo=o/n', '--to=accepted', `--actor=${'a'.repeat(actorLen)}`, `--body-file=${file}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(out);
    } catch (e) {
      // A refusal exits non-zero with the machine-readable error on stdout.
      return JSON.parse(String(e.stdout || '{}'));
    } finally { unlinkSync(file); }
  };

  it('REFUSES a body that only overflows because of a long --actor', () => {
    // 65000-char body + 400-char actor renders 65537 — one char over. The old 64-char stand-in projected 65201
    // and let it through.
    const res = runWithBody(65000, 400);
    expect(res.error).toMatch(/over GitHub's 65536 limit/);
    expect(res.error).toMatch(/65537-char comment/);
    expect(res.ok).toBeUndefined();
  });

  it('the projected length it reports MATCHES what buildVerdictComment actually renders', () => {
    const res = runWithBody(65000, 400);
    const actual = buildVerdictComment({
      to: 'accepted', actor: 'a'.repeat(400), headSha: 'f'.repeat(40), body: 'x'.repeat(65000),
    }).length;
    // The number in the refusal is the projection; it must be the real render, not an estimate near it.
    expect(res.error).toContain(`${actual}-char comment`);
  });

  it('still ACCEPTS a body that fits once the real actor is accounted for', () => {
    // Same body, a short actor — under the cap, so the size gate must not fire. It gets past the pre-flight and
    // fails later on the fake repo, which is proof enough that the size check passed.
    const res = runWithBody(65000, 4);
    expect(String(res.error || '')).not.toMatch(/over GitHub's/);
  });
});
