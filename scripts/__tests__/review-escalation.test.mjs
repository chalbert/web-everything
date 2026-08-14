/**
 * @file scripts/__tests__/review-escalation.test.mjs
 * @description Pure-function coverage for `scripts/lib/review-escalation.mjs`'s #2324 escalation-reason-in-body
 *   helpers: the drain augments a `review:human` PR's body with WHY a human is required (never replacing it),
 *   and a cheap marker check lets the gate verify the write actually landed.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEscalationReasonBlock, bodyHasEscalationReason, ESCALATION_REASON_MARKER, hasUnclearedReviewLabel, REVIEW_LABELS, READY_TO_MERGE_LABEL, REVIEW_HOLD_LABELS, isReviewHoldLabel, readyMergeConflictsWithHold, decideParkReadyStrip, decideReviewGate, parsePolicyStamp, bodyAlreadyCarriesReasonBlock, reconcileEscalationReasonBlock } from '../lib/review-escalation.mjs';
import { POLICY_VERSION, POLICY_DIGEST } from '../lib/review-policy.mjs';
import { buildAuthorActorMarker } from '../lib/review-independence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('review-escalation — #2324 escalation-reason-in-body', () => {
  it('builds a marked block listing every reason', () => {
    const block = buildEscalationReasonBlock(['gate-self (scripts/merge-ai-prs.mjs) — human review required']);
    expect(block).toContain(ESCALATION_REASON_MARKER);
    expect(block).toContain('gate-self (scripts/merge-ai-prs.mjs) — human review required');
  });
  it('returns empty string for no/empty reasons (nothing to append)', () => {
    expect(buildEscalationReasonBlock([])).toBe('');
    expect(buildEscalationReasonBlock(undefined)).toBe('');
  });
  it('APPENDS to (never replaces) the existing body', () => {
    const existing = 'This PR does X.';
    const block = buildEscalationReasonBlock(['reason one']);
    const combined = existing + block;
    expect(combined.startsWith(existing)).toBe(true);
    expect(combined).toContain('reason one');
  });
  // The escalation record said WHAT fired and never WHICH RULES were in force. A threshold change therefore
  // split the history into two incomparable halves with no marker at the seam — which is why `gate-health`
  // reports `parameterSet: null` and why retrospective A/B is impossible today.
  describe('the policy stamp — which parameter set scored this PR', () => {
    it('rides the reason block and round-trips', () => {
      const block = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);
      const stamp = parsePolicyStamp(block);
      expect(stamp).not.toBeNull();
      expect(stamp.version).toBe(String(POLICY_VERSION));
      expect(stamp.digest).toBe(POLICY_DIGEST);
    });

    // An unstamped body is every PR opened before this shipped. It must stay DISTINGUISHABLE from a stamped
    // one — defaulting it to "the current set" would silently claim old PRs were scored under today's rules,
    // which is the exact false-attribution this stamp exists to prevent.
    it('reads null for an unstamped body rather than assuming the current set', () => {
      expect(parsePolicyStamp('a PR body with no stamp')).toBeNull();
      expect(parsePolicyStamp('')).toBeNull();
      expect(parsePolicyStamp(undefined)).toBeNull();
    });

    // THE LOAD-BEARING PROPERTY. `version` is hand-declared and nothing forces a bump, so it can read `1`
    // across edits that moved the thresholds. The digest is derived from the contract's bytes, so it cannot.
    // If this ever fails, the stamp has stopped tracking the thing it exists to track.
    it('the digest is derived from the contract text, so it moves when the contract does', () => {
      const contract = readFileSync(resolve(HERE, '..', 'lib', 'review-policy.contract.json'), 'utf8');
      const expected = createHash('sha256').update(contract).digest('hex').slice(0, 12);
      expect(POLICY_DIGEST).toBe(expected);
      // …and a one-character edit changes it, which `version` alone would not reflect.
      const nudged = createHash('sha256').update(`${contract} `).digest('hex').slice(0, 12);
      expect(nudged).not.toBe(POLICY_DIGEST);
    });

    it('an empty reason list still produces no block, so an unescalated PR is not stamped', () => {
      expect(buildEscalationReasonBlock([])).toBe('');
    });
  });

  // THE RENDER BOUNDARY AT THE READ SEAM. PR #1167 shipped both markers and its own description documented
  // them in a fenced example — so `bodyHasEscalationReason` returned true and `parsePolicyStamp` returned a
  // stamp the drain never wrote. The digest in that example was the true current value, so the forged reading
  // was CORRECT, which is worse: nothing about the output looked wrong.
  describe('a quoted marker is documentation, not a stamp', () => {
    const real = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);

    it('still detects the block the drain actually writes', () => {
      expect(bodyHasEscalationReason(real)).toBe(true);
      expect(parsePolicyStamp(real)).not.toBeNull();
    });

    it('ignores the exact PR #1167 shape — the real block inside a fence', () => {
      const documented = `Here is what it looks like:\n\n\`\`\`\n${real}\n\`\`\`\n\nEnd.`;
      expect(bodyHasEscalationReason(documented)).toBe(false);
      expect(parsePolicyStamp(documented)).toBeNull();
    });

    it('ignores an inline span and a tilde fence', () => {
      expect(bodyHasEscalationReason('see `## Escalation reason` above')).toBe(false);
      expect(bodyHasEscalationReason('~~~\n## Escalation reason\n~~~')).toBe(false);
    });

    // An unclosed fence blanks to end-of-body. The cost is a MISSING block, which is visible; the alternative
    // is trusting whatever follows an opener, which is not.
    it('blanks to the end of the body on an unclosed fence', () => {
      expect(bodyHasEscalationReason('```\n## Escalation reason\n')).toBe(false);
    });

    // A ``` inside a ~~~~ block is content, not a terminator.
    it('closes a fence only on the same character, at least as long', () => {
      expect(bodyHasEscalationReason('~~~~\n```\n## Escalation reason\n~~~~')).toBe(false);
    });

    // FOUR MORE FORGERIES, each found by review against the first cut of this boundary and each verified
    // twice: the scanner accepted it AND a markdown renderer showed it as a code block. A reader would have
    // seen documentation while the gate saw a record.
    const M = '## Escalation reason';
    for (const [label, body] of [
      // CommonMark forbids an info string on a CLOSING fence, so ```js is content. The first cut read it as a
      // close, and everything after became scannable.
      ['an info-string "closer" does not close the fence', '```\ntext\n```js\n' + M + '\n```'],
      // `> ``` ` never matched a `^[ \t]*` anchor, so a quoted fence inside a blockquote was invisible.
      ['a fence inside a blockquote', '> ```\n> ' + M + '\n> ```'],
      // The likeliest accidental repeat of the original defect: pasting the block with an indent.
      ['a four-space indented code block', 'para\n\n    ' + M + '\n\npara'],
      ['an HTML <pre> block', '<pre>\n' + M + '\n</pre>'],
      ['an HTML <code> block', '<code>\n' + M + '\n</code>'],
    ]) {
      it(`ignores ${label}`, () => {
        expect(bodyHasEscalationReason(body), label).toBe(false);
      });
    }

    // Stripping blockquote prefixes must not eat an ordinary `>` in prose.
    it('a bare > in prose is not a blockquote prefix', () => {
      expect(bodyHasEscalationReason(`a > b in prose, and ${M} here`)).toBe(true);
    });

    // ROUND 3 — five more, each found by review against the round-2 boundary. Two themes: the CLOSE rule was
    // too permissive, and "indented code starts after a blank line" was the wrong model.
    for (const [label, body] of [
      // CommonMark caps a closing fence's indent at three spaces. Four is content, so the block never closed.
      ['a four-space-indented "closer"', '```\n    ```\n' + M + '\n```'],
      ['a tab-indented "closer"', '```\n\t```\n' + M + '\n```'],
      // The round-2 code STRIPPED `>` and re-scanned, which turned quoted fence content into a bare closer.
      // A blockquote is quoted by definition; the line is now blanked whole and never looked inside.
      ['a blockquoted line used as a closer', '```\n> ```\n' + M + '\n```'],
      // Indented code needs a blank line only to interrupt a PARAGRAPH. After a closed fence or a heading it
      // starts immediately — which the `prevBlank` model missed.
      ['an indented marker straight after a closed fence', '```\nx\n```\n    ' + M],
      ['an indented marker straight after a heading', '# Title\n    ' + M],
      // The drain writes at top level, so nothing legitimate lives behind a `>`.
      ['a plainly blockquoted marker', '> ' + M],
    ]) {
      it(`ignores ${label}`, () => {
        expect(bodyHasEscalationReason(body), label).toBe(false);
      });
    }

    // The paragraph model must not swallow a legitimate indented continuation line.
    it('an indented lazy continuation of a paragraph is not code', () => {
      expect(bodyHasEscalationReason(`a paragraph\n    continued lazily\n${real}`)).toBe(true);
    });

    // ROUND 4 — five more, and the point at which hand-modelling CommonMark was abandoned for markdown-it's
    // own block tokenizer. Sixteen shapes across three rounds, each fix correct and the set never closed:
    // a hand-rolled subset is only as good as its author's knowledge of the grammar.
    for (const [label, body] of [
      ['a marker indented after a setext h1', 'Title\n=====\n    ' + M],
      ['a marker indented after a setext h2', 'x\n---\n    ' + M],
      ['a marker indented after a thematic break', 'p\n\n***\n    ' + M],
      ['a fence inside a bullet list item', '- ```\n  ' + M + '\n  ```'],
      ['a fence inside an ordered list item', '1. ```\n   ' + M + '\n   ```'],
    ]) {
      it(`ignores ${label}`, () => {
        expect(bodyHasEscalationReason(body), label).toBe(false);
      });
    }

    // markdown-it classifies a standalone HTML COMMENT as an `html_block`, and the policy stamp IS a comment —
    // blanking that token type wholesale ate the drain's own stamp. Only code-bearing HTML is blanked.
    it('an HTML comment is not a quoted region, because the stamp is one', () => {
      expect(parsePolicyStamp(real)).not.toBeNull();
    });
  });

  // THE WRITE GUARD IS A DIFFERENT QUESTION, and conflating the two created an append loop.
  // `bodyHasEscalationReason` asks "does a trustworthy record exist" and must ignore quoted text.
  // `bodyAlreadyCarriesReasonBlock` asks "would appending duplicate what is already here" — for which quoted
  // or not is irrelevant, because the bytes are there either way.
  describe('the raw write-guard, so the drain can see its own write', () => {
    const real = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);

    it('sees a block that the trusted reader blanks', () => {
      // A body whose earlier content blanks the appended block: the drain could never see its own write, so
      // it re-appended on EVERY park pass until the body hit its size cap.
      const selfBlanking = '```\n' + real;
      expect(bodyHasEscalationReason(selfBlanking)).toBe(false);
      expect(bodyAlreadyCarriesReasonBlock(selfBlanking)).toBe(true);
    });

    it('is false on a body with no block at all, so a first write still happens', () => {
      expect(bodyAlreadyCarriesReasonBlock('a plain description')).toBe(false);
      expect(bodyAlreadyCarriesReasonBlock('')).toBe(false);
      expect(bodyAlreadyCarriesReasonBlock(undefined)).toBe(false);
    });
  });

  // AGREEMENT-OR-NOTHING, not first-match. First-match is POSITIONAL, not temporal — a body has no clock in
  // it, so a forger who PREPENDS a stamp wins outright. Same reasoning as the author-actor marker.
  describe('two disagreeing stamps resolve to unknown', () => {
    it('a prepended stamp cannot shadow the drain\'s real one', () => {
      const real = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);
      expect(parsePolicyStamp(`<!-- policy-set: v9 ffffffffffff -->\n${real}`)).toBeNull();
    });

    it('two different stamps read as unstamped', () => {
      expect(parsePolicyStamp('<!-- policy-set: v1 aaaaaaaaaaaa -->\n<!-- policy-set: v2 bbbbbbbbbbbb -->')).toBeNull();
    });

    it('the SAME stamp repeated still resolves — repetition is not disagreement', () => {
      const twice = '<!-- policy-set: v1 aaaaaaaaaaaa -->\n<!-- policy-set: v1 aaaaaaaaaaaa -->';
      expect(parsePolicyStamp(twice)).toEqual({ version: '1', digest: 'aaaaaaaaaaaa' });
    });

    // The combination that matters: a real stamp plus a fenced decoy. The fence is blanked first, so the
    // decoy never reaches the agreement test and the real stamp still resolves.
    it('a fenced decoy alongside a real stamp does not poison it', () => {
      const real = buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);
      const withDecoy = `${real}\n\n\`\`\`\n<!-- policy-set: v9 ffffffffffff -->\n\`\`\``;
      expect(parsePolicyStamp(withDecoy)).not.toBeNull();
    });
  });

  it('bodyHasEscalationReason detects the marker (present/absent/non-string)', () => {
    expect(bodyHasEscalationReason('some body\n\n## Escalation reason\n\n- x')).toBe(true);
    expect(bodyHasEscalationReason('plain body, no marker')).toBe(false);
    expect(bodyHasEscalationReason('')).toBe(false);
    expect(bodyHasEscalationReason(null)).toBe(false);
    expect(bodyHasEscalationReason(undefined)).toBe(false);
  });
});

// #3044 — the block was stamped ONCE (guard-then-append on the RAW-text `bodyAlreadyCarriesReasonBlock`
// guard) and never refreshed, so a re-park that scored MORE or FEWER reasons than the first park left the
// block a stale snapshot — a fail-open, since #2908 made the block write-authorizing for the converge loop's
// editor-enablement band. `reconcileEscalationReasonBlock` re-derives the block against the CURRENT reason
// set every time. Independently re-parses each resulting block (never reusing the function's own internal
// boundary reader) so these tests can't pass merely because both sides share a bug.
describe('review-escalation — #3044 reconcileEscalationReasonBlock (re-derive-and-replace, not stamp-once)', () => {
  // Deliberately NOT `bodyHasEscalationReason`/`ESCALATION_REASON_MARKER`-aware parsing — an independent,
  // dumber re-read of the resulting body, so a bug shared between the implementation and the test can't hide.
  function parsedReasonsOf(body) {
    const afterMarker = body.split('## Escalation reason')[1] || '';
    const bulletsPart = afterMarker.split('<!--')[0];
    return bulletsPart.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
  }

  it('APPENDS when no real marker is present and reasons are non-empty (today\'s behavior, unchanged)', () => {
    const result = reconcileEscalationReasonBlock('Plain PR body.', ['size (500 ≥ 400 changed lines)']);
    expect(result).toEqual({
      body: 'Plain PR body.' + buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']),
      changed: true,
    });
  });

  it('is a no-op, byte-identical body, when a re-park scores the SAME set in a different order', () => {
    const body = 'PR description.'
      + buildEscalationReasonBlock(['blast-radius (…)', 'size (602 ≥ 400 changed lines)']);
    const result = reconcileEscalationReasonBlock(
      body,
      ['size (602 ≥ 400 changed lines)', 'blast-radius (…)'], // same set, reversed order
    );
    expect(result.changed).toBe(false);
    expect(result.body).toBe(body); // byte-identical — a routine re-park with nothing new writes nothing
  });

  it('REPLACES on growth — the live PR #1018 shape from the #3044 card', () => {
    const recorded = ['blast-radius (dep bump touches 12 files)'];
    const fresh = ['blast-radius (dep bump touches 12 files)', 'size (602 ≥ 400 changed lines)'];
    const body = 'PR description.' + buildEscalationReasonBlock(recorded);
    const result = reconcileEscalationReasonBlock(body, fresh);
    expect(result.changed).toBe(true);
    expect(new Set(parsedReasonsOf(result.body))).toEqual(new Set(fresh));
  });

  it('REPLACES on shrink — a re-score that drops a reason updates the block too, not only growth', () => {
    const recorded = ['blast-radius (dep bump touches 12 files)', 'size (602 ≥ 400 changed lines)'];
    const fresh = ['blast-radius (dep bump touches 12 files)'];
    const body = 'PR description.' + buildEscalationReasonBlock(recorded);
    const result = reconcileEscalationReasonBlock(body, fresh);
    expect(result.changed).toBe(true);
    expect(new Set(parsedReasonsOf(result.body))).toEqual(new Set(fresh));
  });

  it('is a no-op when fresh reasons are empty and no marker is present (nothing to append)', () => {
    const result = reconcileEscalationReasonBlock('Plain PR body.', []);
    expect(result).toEqual({ body: 'Plain PR body.', changed: false });
  });

  it('is a no-op when fresh reasons are empty and a marker IS present — a de-escalation is left as first-park history, never blanked', () => {
    const body = 'PR description.' + buildEscalationReasonBlock(['size (500 ≥ 400 changed lines)']);
    const result = reconcileEscalationReasonBlock(body, []);
    expect(result).toEqual({ body, changed: false });
  });

  it('a quoted/fenced example of the marker is never mistaken for a real block — appends fresh instead of "replacing" the documentation', () => {
    const documented = 'Here is what the block looks like:\n\n```\n'
      + buildEscalationReasonBlock(['old documented reason']) + '\n```\n\nEnd.';
    const result = reconcileEscalationReasonBlock(documented, ['new real reason']);
    expect(result.changed).toBe(true);
    // The quoted example survives verbatim — the write only ever appends past it.
    expect(result.body.startsWith(documented)).toBe(true);
    expect(result.body).toContain('old documented reason'); // untouched inside the fence
    expect(result.body).toContain('new real reason'); // the freshly appended real block
  });

  it('preserves content before the marker byte-for-byte on a replace, including an authored-by-actor stamp', () => {
    // we:scripts/pr-body-edit.mjs exists precisely because a body rewrite that forgets to carry this stamp
    // forward disarms the #2844 independence check. reconcileEscalationReasonBlock never rewrites the body
    // WHOLESALE — a replace only ever touches the marker onward — so there is nothing to carry forward, but
    // that guarantee is worth proving directly rather than assuming.
    const stamp = buildAuthorActorMarker('sess-abc123');
    expect(stamp).not.toBe(''); // sanity: the fixture id actually produced a stamp
    const before = `## Summary\n\nDoes a thing.\n\n${stamp}\n`;
    const body = before + buildEscalationReasonBlock(['blast-radius (dep bump touches 12 files)']);
    const result = reconcileEscalationReasonBlock(
      body,
      ['blast-radius (dep bump touches 12 files)', 'size (602 ≥ 400 changed lines)'],
    );
    expect(result.changed).toBe(true);
    expect(result.body.startsWith(before)).toBe(true);
    expect(result.body).toContain(stamp);
  });

  it('fails safe — non-blank content after the block\'s end boundary leaves the body untouched rather than deleting it', () => {
    const block = buildEscalationReasonBlock(['blast-radius (dep bump touches 12 files)']);
    // Not a shape either writer produces today (the block is always last) — exactly the "in practice: never"
    // case the card names, which is why it must fail safe rather than assume it can locate the block.
    const body = 'PR description.' + block + 'A human added this paragraph after the block.\n';
    const result = reconcileEscalationReasonBlock(
      body,
      ['blast-radius (dep bump touches 12 files)', 'size (602 ≥ 400 changed lines)'],
    );
    expect(result).toEqual({ body, changed: false });
  });
});

describe('review-escalation — #2366 hasUnclearedReviewLabel (the concurrent-lander merge refusal)', () => {
  it('refuses a PR carrying review:pending alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }])).toBe(true);
  });
  it('refuses a PR carrying review:human alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }])).toBe(true);
  });
  it('refuses a PR carrying review:changes alone', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }])).toBe(true);
  });
  it('review:accepted clears it — and alongside a stale review:changes too (#2974)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.accepted }])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }])).toBe(false);
  });
  // #x9xqexm — the two HOLD pairs no longer clear. Both are producible by NO sanctioned writer (`--to=accepted`
  // and `--to=clear-human` remove `pending` as they add `accepted`, and `--to=accepted` is refused outright on a
  // `review:human` PR), so each means "the drain re-parked a stale accept" — and since #x9xqexm the drain no
  // longer deletes the accept, this NON-SCORING predicate is the only thing that reads that state. `pending` is
  // the common one: the re-park applies it whenever the fresh score is not `humanRequired` (the PR #984 shape).
  it('…but NOT alongside review:human, and NOT alongside review:pending', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }])).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(true);
    // The #2423 relief valve still waives the pending pair — an operator naming ONE PR explicitly, exactly as
    // it waives a bare review:pending. It never waives the human pair.
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(true);
  });
  it('a PR with no review labels at all is never refused', () => {
    expect(hasUnclearedReviewLabel([])).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: 'ready-to-merge' }])).toBe(false);
  });
  it('tolerant of a missing/odd labels shape (never throws)', () => {
    expect(hasUnclearedReviewLabel(null)).toBe(false);
    expect(hasUnclearedReviewLabel(undefined)).toBe(false);
  });
  it('accepts plain string labels too (not only {name} objects)', () => {
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.pending])).toBe(true);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.accepted, REVIEW_LABELS.changes])).toBe(false);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.accepted, REVIEW_LABELS.pending])).toBe(true); // #x9xqexm
  });
});

describe('review-escalation — #2832 label/hold self-consistency primitives', () => {
  it('REVIEW_HOLD_LABELS is exactly the three hold labels (accepted/redteam are NOT holds)', () => {
    expect(REVIEW_HOLD_LABELS).toEqual([REVIEW_LABELS.pending, REVIEW_LABELS.changes, REVIEW_LABELS.human]);
    expect(REVIEW_HOLD_LABELS).not.toContain(REVIEW_LABELS.accepted);
  });
  it('isReviewHoldLabel is true for each hold label, false for accepted/ready/anything else', () => {
    expect(isReviewHoldLabel(REVIEW_LABELS.pending)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.changes)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.human)).toBe(true);
    expect(isReviewHoldLabel(REVIEW_LABELS.accepted)).toBe(false);
    expect(isReviewHoldLabel(READY_TO_MERGE_LABEL)).toBe(false);
    expect(isReviewHoldLabel('some:other')).toBe(false);
    expect(isReviewHoldLabel(undefined)).toBe(false);
  });
  describe('readyMergeConflictsWithHold — the contradictory (held AND ready) state', () => {
    for (const hold of ['review:pending', 'review:changes', 'review:human']) {
      it(`ready-to-merge + ${hold} → CONFLICT (must be stripped)`, () => {
        expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: hold }])).toBe(true);
      });
      it(`${hold} WITHOUT ready-to-merge → no conflict (nothing to strip)`, () => {
        expect(readyMergeConflictsWithHold([{ name: hold }])).toBe(false);
      });
    }
    it('ready-to-merge alone (no hold) → consistent, not a conflict', () => {
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }])).toBe(false);
    });
    it('review:accepted clears a review:changes hold, so ready-to-merge alongside it is consistent (#2974)', () => {
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }])).toBe(false);
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.accepted }])).toBe(false);
    });
    it('…but accepted + pending IS contradictory since #x9xqexm — that pair is a stale re-park, not a clearance', () => {
      // It inherits directly from `hasUnclearedReviewLabel`, which is the point: ONE hold predicate, so the
      // go-ahead strip and the merge refusal can never disagree about what a label set means.
      expect(readyMergeConflictsWithHold([{ name: READY_TO_MERGE_LABEL }, { name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }])).toBe(true);
    });
    it('tolerant of a missing/odd labels shape (never throws)', () => {
      expect(readyMergeConflictsWithHold(null)).toBe(false);
      expect(readyMergeConflictsWithHold([])).toBe(false);
    });
  });
});

describe('review-escalation — #984 F2 decideParkReadyStrip (the drain park strip, keyed on OBSERVED holds)', () => {
  // THE REGRESSION THIS BLOCK EXISTS FOR. The shipped strip lived inside `if (gate.applyLabel && !DRY_RUN)`,
  // so it ran only for the two holds whose `applyLabel` decideReviewGate re-returns every pass
  // (review:pending / review:human). `review:changes` returns `wait-author` with NO applyLabel — so a PR that
  // reached `review:changes` + `ready-to-merge` stayed contradictory forever, with no sweeper (the per-pass
  // reconcile strip was deliberately dropped from #984 — see backlog `xtw8e93`). PR #984 itself was in that
  // state when the review that found this was recorded.
  it('review:changes yields NO applyLabel from decideReviewGate, yet the go-ahead is still stripped', () => {
    const labels = [REVIEW_LABELS.changes, READY_TO_MERGE_LABEL];
    const gate = decideReviewGate({ escalate: true, labels });
    // The precondition that made the applyLabel-nested strip unreachable for this hold:
    expect(gate.action).toBe('wait-author');
    expect(gate.applyLabel).toBeFalsy();
    // The OLD key, spelled out: `isReviewHoldLabel(gate.applyLabel)` is FALSE here, so the shipped strip could
    // not fire no matter how the surrounding guard was written.
    expect(isReviewHoldLabel(gate.applyLabel)).toBe(false);
    // The NEW key fires. This is the assertion that fails on the pre-hoist shape.
    expect(decideParkReadyStrip(labels, { applyLabel: gate.applyLabel })).toBe(true);
  });
  it('a review:changes PR is stripped even when the drain applies nothing at all (no applyLabel argument)', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.changes, READY_TO_MERGE_LABEL])).toBe(true);
  });

  for (const hold of REVIEW_HOLD_LABELS) {
    it(`an ALREADY-held ${hold} PR carrying the go-ahead is stripped with no applyLabel (standing reconcile)`, () => {
      expect(decideParkReadyStrip([{ name: hold }, { name: READY_TO_MERGE_LABEL }])).toBe(true);
    });
    it(`a FRESH ${hold} park (hold not yet observed) still strips — the atomic park strip survives the hoist`, () => {
      expect(decideParkReadyStrip([{ name: READY_TO_MERGE_LABEL }], { applyLabel: hold })).toBe(true);
    });
    it(`${hold} WITHOUT the go-ahead is never a strip target (nothing to remove)`, () => {
      expect(decideParkReadyStrip([{ name: hold }])).toBe(false);
      expect(decideParkReadyStrip([], { applyLabel: hold })).toBe(false);
    });
  }

  // THE HOISTING SAFETY PROPERTY the review asked to be proven: a legitimately QUEUED PR must never be
  // un-queued by the widened key.
  it('a legitimately queued PR (review:accepted + ready-to-merge) is NEVER stripped', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(false);
    // …and it does not even reach a park branch: decideReviewGate merges it.
    expect(decideReviewGate({ escalate: true, labels: [REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL] }).action).toBe('merge');
  });
  it('review:accepted clears a leftover review:changes — that accepted PR keeps its go-ahead (#2974)', () => {
    expect(decideParkReadyStrip([REVIEW_LABELS.changes, REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(false);
  });
  it('…but a leftover review:pending next to accepted DOES strip since #x9xqexm', () => {
    // The accept no longer deletes on re-park, so `[accepted, pending]` is a live state rather than a
    // transient one — and it means the re-score found the accept stale. A held PR may not keep the go-ahead.
    expect(decideParkReadyStrip([REVIEW_LABELS.pending, REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL])).toBe(true);
  });
  it('an unlabelled/clean PR carrying only the go-ahead is never stripped', () => {
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL])).toBe(false);
    expect(decideParkReadyStrip([READY_TO_MERGE_LABEL], { applyLabel: null })).toBe(false);
  });

  // #2409 / #x9xqexm — a stale-acceptance re-park must strip the go-ahead. The `staleAcceptance` input shipped
  // meaning "this same park is about to REMOVE review:accepted, so do not let it clear the hold". #x9xqexm ends
  // that removal — a re-score never deletes a human's verdict — so the option's original reason is gone and its
  // narrower one (the accept is KNOWN STALE, so it may not clear the hold being written) takes over. The
  // OUTCOME must be identical either way: `hasUnclearedReviewLabel` now refuses `accepted + pending` and
  // `accepted + human` directly, which are the only labels a stale re-park applies. That redundancy is
  // deliberate — the round-2 review flagged that a reader could delete the now-pointless filter and leave the
  // go-ahead standing on a held PR, and the fix is to make the deletion HARMLESS rather than to forbid it.
  it('a #2409 stale-acceptance re-park strips — WITH the staleAcceptance filter and, since #x9xqexm, without it', () => {
    const labels = [REVIEW_LABELS.accepted, READY_TO_MERGE_LABEL];
    for (const applyLabel of [REVIEW_LABELS.human, REVIEW_LABELS.pending]) {
      expect(decideParkReadyStrip(labels, { applyLabel, staleAcceptance: true })).toBe(true);
      expect(decideParkReadyStrip(labels, { applyLabel, staleAcceptance: false })).toBe(true);
    }
    // …and the gate really does produce that shape.
    const gate = decideReviewGate({ escalate: true, labels, acceptedSha: 'a'.repeat(40), headSha: 'b'.repeat(40) });
    expect(gate.staleAcceptance).toBe(true);
    expect(decideParkReadyStrip(labels, { applyLabel: gate.applyLabel, staleAcceptance: gate.staleAcceptance })).toBe(true);
  });

  it('accepts plain-string and {name} label shapes alike, and never throws on an odd one', () => {
    expect(decideParkReadyStrip([{ name: REVIEW_LABELS.human }, READY_TO_MERGE_LABEL])).toBe(true);
    expect(decideParkReadyStrip(null)).toBe(false);
    expect(decideParkReadyStrip(undefined, { applyLabel: REVIEW_LABELS.human })).toBe(false);
    expect(decideParkReadyStrip([null, undefined, { name: null }, READY_TO_MERGE_LABEL], { applyLabel: REVIEW_LABELS.changes })).toBe(true);
  });
});

describe('review-escalation — #2366 hasUnclearedReviewLabel { allowPending } (the --no-review-escalation operator override)', () => {
  // allowPending: true is the `--label ... --no-review-escalation` path — the operator deliberately waived the
  // rubric to land a green-but-parked review:pending PR (#2262), so review:pending no longer refuses; but the
  // human-only / reviewer-rejected gates are NEVER waivable by this flag and must still refuse (#2285).
  it('honors the operator on review:pending (no longer refused under the override)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([REVIEW_LABELS.pending], { allowPending: true })).toBe(false);
  });
  it('STILL refuses review:human under the override (gate-self is human-only, never waivable — #2285)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }], { allowPending: true })).toBe(true);
  });
  it('STILL refuses review:changes under the override (reviewer rejected; author must re-push)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }], { allowPending: true })).toBe(true);
  });
  it('refuses review:human even when a stale review:pending rides alongside under the override', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.human }], { allowPending: true })).toBe(true);
  });
  it('review:accepted clears pending and a stale changes under the override (#2974: the verdict wins)', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.changes }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(false);
  });
  // #x9xqexm — the ONE pair that is no longer cleared. The drain stopped DELETING a stale `review:accepted` when
  // it re-parks (deleting a human's recorded clearance was never what stopped the merge), so `accepted + human`
  // is now a state this non-scoring path can actually observe — and it must fail closed on it.
  it('review:accepted does NOT clear a co-present review:human — the pair fails closed', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }], { allowPending: true })).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.human }, { name: REVIEW_LABELS.accepted }])).toBe(true);
  });
  it('default (allowPending omitted / false) is the bare-sweep behaviour — review:pending still refuses', () => {
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }])).toBe(true);
    expect(hasUnclearedReviewLabel([{ name: REVIEW_LABELS.pending }], { allowPending: false })).toBe(true);
  });
});
