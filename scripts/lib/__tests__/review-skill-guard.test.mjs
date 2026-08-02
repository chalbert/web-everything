/**
 * @file review-skill-guard.test.mjs — proof of the #2882 `check:standards` rule that keeps the review-verdict
 *   label swap inside its single home (`we:scripts/review-set-label.mjs`). Pure fixtures, no fs.
 *
 *   The rule exists because the raw path is silently lossy: it skips the `reviewed-sha` stamp the drain's
 *   staleness gate reads (#2409) and bypasses INVARIANT 2, which lives in `decideSetLabel` and so only binds
 *   callers that come through the module. Observed on PR #983 — five re-parks.
 */
import { describe, it, expect } from 'vitest';
import { checkReviewLabelSingleHome, isGuardedDoc } from '../review-skill-guard.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const doc = (content, file = 'skills-src/review/SKILL.md') => [{ file, content }];

describe('checkReviewLabelSingleHome — the raw swap is an error', () => {
  it('flags a raw accept swap, naming the file and line', () => {
    const { errors } = checkReviewLabelSingleHome(doc(
      'intro\nrun `gh pr edit <PR> --repo <repo> --add-label review:accepted --remove-label review:pending`\n',
    ));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('skills-src/review/SKILL.md:2');
    expect(errors[0]).toContain('review-set-label.mjs');
  });

  it('flags a raw REMOVE of a review label too (the swap has two halves)', () => {
    const { errors } = checkReviewLabelSingleHome(doc('gh pr edit 12 --remove-label review:human\n'));
    expect(errors).toHaveLength(1);
  });

  it('flags the raw line even when the doc ALSO names the single home', () => {
    // #1001 offered both; offering both is how the wrong path was entrenched. Naming the right one is not a cure.
    const { errors } = checkReviewLabelSingleHome(doc(
      'prefer `node scripts/review-set-label.mjs 12 --to=accepted`\nor `gh pr edit 12 --add-label review:accepted`\n',
    ));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(':2');
  });
});

describe('checkReviewLabelSingleHome — what it must NOT flag', () => {
  it('allows a non-review label edit', () => {
    expect(checkReviewLabelSingleHome(doc('gh pr edit 12 --add-label ready-to-merge\n')).errors).toHaveLength(0);
  });

  it('allows merely MENTIONING the labels or the drain\'s behaviour', () => {
    const { errors } = checkReviewLabelSingleHome(doc(
      'the drain applies review:pending when it parks, and drops review:accepted when stale\n',
    ));
    expect(errors).toHaveLength(0);
  });

  it('allows the CLI invocation itself', () => {
    const { errors } = checkReviewLabelSingleHome(doc(
      'node scripts/review-set-label.mjs <PR> --repo=<owner/name> --to=accepted --body-file=<f.md>\n',
    ));
    expect(errors).toHaveLength(0);
  });

  it('allows an ELIDED pattern — a doc explaining the rule must be able to name it', () => {
    // `…` is not valid shell, so an elided form is a description. The gate's own first run flagged the
    // paragraph documenting it; this cell pins the carve-out.
    const { errors } = checkReviewLabelSingleHome(doc(
      'check:standards errors on a raw `gh pr edit … --add-label review:*` in this file\n',
    ));
    expect(errors).toHaveLength(0);
  });

  it('but the carve-out does not launder a REAL command that merely trails an ellipsis', () => {
    const { errors } = checkReviewLabelSingleHome(doc('gh pr edit 12 --add-label review:accepted … then drain\n'));
    expect(errors).toHaveLength(1);
  });

  it('ignores docs outside the guarded prefixes', () => {
    expect(isGuardedDoc('reports/x.md')).toBe(false);
    expect(isGuardedDoc('skills-src/review/SKILL.md')).toBe(true);
    expect(isGuardedDoc('docs/agent/backlog-workflow.md')).toBe(true);
    // Deliberately NOT guarded yet — the drain skill has a real instance on its auto-land path, filed
    // separately because fixing it is a behaviour change, not a doc edit. See GUARDED_DOC_PREFIXES.
    expect(isGuardedDoc('skills-src/drain/SKILL.md')).toBe(false);
    const { errors } = checkReviewLabelSingleHome([
      { file: 'reports/postmortem.md', content: 'we ran `gh pr edit 12 --add-label review:accepted`\n' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('tolerates a missing/odd docs shape', () => {
    expect(checkReviewLabelSingleHome().errors).toHaveLength(0);
    expect(checkReviewLabelSingleHome([null, {}, { file: 'skills-src/a.md' }]).errors).toHaveLength(0);
  });
});

describe('the live review skill obeys its own rule', () => {
  it('skills-src/review/SKILL.md instructs no raw review-label swap', () => {
    const file = 'skills-src/review/SKILL.md';
    const { errors } = checkReviewLabelSingleHome([{ file, content: readFileSync(join(ROOT, file), 'utf8') }]);
    expect(errors).toEqual([]);
  });

  it('and it does route through the single home', () => {
    const content = readFileSync(join(ROOT, 'skills-src/review/SKILL.md'), 'utf8');
    expect(content).toContain('scripts/review-set-label.mjs');
  });
});
