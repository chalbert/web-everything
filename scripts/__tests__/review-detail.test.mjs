/**
 * @file review-detail.test.mjs — proof of the PURE `assembleReviewDetail` (#2470). The `gh pr view` call is the
 *   I/O boundary (the CLI's concern); the body/label/comment/file → contract distillation is decided in the pure
 *   assembler and unit-tested here against fixtures, no network.
 */
import { describe, it, expect } from 'vitest';
import { assembleReviewDetail, parseEscalationReason } from '../review-detail.mjs';
import { buildEscalationReasonBlock } from '../lib/review-escalation.mjs';

// #3101 — a REAL PR body, captured via `gh pr view 1177 --json body` (2026-08-14), not hit over the network in
// this test. PR #1177 was parked with two escalation reasons AND the drain's trailing policy-stamp comment
// (`buildEscalationReasonBlock` appends that stamp unconditionally whenever it writes any reasons). Proves the
// parser against an ACTUAL drain-written body, not a synthetic reconstruction of the bug shape.
const PR_1177_BODY = "Second slice of `#3072`.\n\nA **verdict** judges one review. An **outcome** says whether the loop should continue. `deriveLoopOutcome` separates them — because `converged` and `exhausted` both *end* the loop and mean opposite things, and a loop that reports success on exhaustion is worse than one that never terminates, since the second is at least visible.\n\n| verdict | round | outcome |\n| --- | --- | --- |\n| `accept` | any | **converged** |\n| `changes` | < cap | in-progress |\n| `changes` | ≥ cap | **exhausted** — says UNRESOLVED, names a human |\n| `prevention-outstanding` | ≥ cap | exhausted (another pass is owed either way) |\n| `needs-human` | any | escalated — the loop does not decide this |\n\n## The round needs no new state\n\nThe verdict ledger already appends a row per review, so `priorRounds` is a fold over its history. That also means **the count survives a dead session** — which three reviewers this week did not.\n\n## Three outcomes, not four, and the missing one is the point\n\nI designed a `stuck` detector — *finding count stops shrinking* — and then tested it against the only real multi-round case in the repo before shipping it.\n\n**PR #1164's four rounds ran 3 → 1 → 1 → 1 findings.** A count rule flags that as stuck at round three. Every one of those rounds found a **new, real bypass** that was then fixed. The detector would have killed the most productive review of the week.\n\nTelling *thrashing* from *converging slowly* needs finding **identity** — is this the same finding recurring? — and the ledger records only counts. That is a genuine input to the observability spike `#3077`, not something to approximate here. Approximating it would have been worse than the gap.\n\n## The cap is 5, from the same evidence\n\nThe longest productive run observed was four rounds. A cap at or below that truncates real work. The cap exists to catch a loop that is **not** progressing — not to ration one that is. Pinned by a test that walks rounds 1–4 and asserts none of them exhausts.\n\n## One annotation worth reading\n\n`@verdicts-partial` on the decider: `changes` and `prevention-outstanding` deliberately share one branch, because both mean another pass is owed and the loop treats them identically. So it is **total in behaviour, partial in reference** — and a verdict added to the enum later lands in the fall-through as \"another pass owed\", which is the safe default for a loop.\n\n## Gate\n\n- `npm run test:unit` — **322 files, 7287 passed**, 3 skipped\n- `npm run check:standards` — **0 errors**, 1293 warnings\n\n\n<!-- authored-by-actor: 01f39b97-274a-4078-8eeb-e7f8d6008673 -->\n\n\n## Escalation reason\n\n- blast-radius (scripts/lib/__tests__/jury-core.test.mjs, scripts/lib/judge-spawn.mjs, scripts/lib/jury-core.mjs, …)\n- gate-derivation (scripts/lib/review-core.mjs) — gate derivation code, independent committee review\n\n<!-- policy-set: v1 08da26b668de -->\n";

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

// #3101 — parseEscalationReason stopped only at the next `##` heading, so it read the drain's trailing
// `<!-- policy-set: … -->` HTML-comment stamp as a bogus extra "reason". buildEscalationReasonBlock appends
// that stamp UNCONDITIONALLY whenever it writes any reasons, so this hit every real park. Fixed: the loop also
// stops at the first non-blank, non-heading, non-bullet line.
describe('parseEscalationReason — the trailing policy-stamp comment does not read as a reason (#3101)', () => {
  it('a real buildEscalationReasonBlock body (single reason + stamp, end-of-body) returns exactly the one reason', () => {
    const body = `An unrelated PR description.${buildEscalationReasonBlock(['size (602 ≥ 400 changed lines)'])}`;
    expect(parseEscalationReason(body)).toEqual(['size (602 ≥ 400 changed lines)']);
  });

  it('a real PR #1177 body (two reasons + stamp, captured, not synthetic) returns exactly those two reasons', () => {
    expect(parseEscalationReason(PR_1177_BODY)).toEqual([
      'blast-radius (scripts/lib/__tests__/jury-core.test.mjs, scripts/lib/judge-spawn.mjs, scripts/lib/jury-core.mjs, …)',
      'gate-derivation (scripts/lib/review-core.mjs) — gate derivation code, independent committee review',
    ]);
  });

  // Named for what it actually proves — the bullet check (not a heading-specific check) ends the block at
  // the first non-bullet line. A `##` heading is just one instance of "non-bullet content"; it has no
  // special-cased stop condition of its own (see the docblock on `parseEscalationReason`).
  it('trailing non-bullet content (here, a "## Something else" heading) ends the block, not just the stamp', () => {
    const body = [
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
    ].join('\n');
    expect(parseEscalationReason(body)).toEqual([
      'gate-self (docs/agent/platform-decisions.md) — human review required',
      'size (612 ≥ 400 changed lines)',
    ]);
  });

  // #3101 F1 — the docblock claims the stop-on-first-non-bullet-line design "protects against any future
  // trailing content appended after the stamp", not just the ONE known stamp shape. Pin that: a bullet
  // appearing AFTER the stamp must not be read back in. Reddens if the stop is weakened from `break` to
  // `continue` (which would skip the stamp instead of ending the block there).
  it('a bullet appearing AFTER the trailing policy-stamp comment is not read back in as a reason', () => {
    const body = `An unrelated PR description.${buildEscalationReasonBlock(['size (602 ≥ 400 changed lines)'])}- not a reason`;
    expect(parseEscalationReason(body)).toEqual(['size (602 ≥ 400 changed lines)']);
  });

  it('a legacy body with the reason block but NO trailing stamp (pre-#2567 shape) still parses unchanged', () => {
    const body = [
      'Original PR body describing the change.',
      '',
      '## Escalation reason',
      '',
      '- size (500 lines)',
    ].join('\n');
    expect(parseEscalationReason(body)).toEqual(['size (500 lines)']);
  });
});

// #3101 — assembleReviewDetail must resolve a real disposition once the parse is correct, not swallow the
// unknown-reason throw from the trailing stamp into `disposition: null`.
describe('assembleReviewDetail — disposition resolves on a stamped size-only park (#3101)', () => {
  it('returns {mode:"converge", autoLand:true}, not null', () => {
    const body = `An unrelated PR description.${buildEscalationReasonBlock(['size (602 ≥ 400 changed lines)'])}`;
    const d = assembleReviewDetail({ view: { ...parkedHumanView, body } });
    expect(d.disposition).toEqual({ mode: 'converge', autoLand: true });
  });
});
