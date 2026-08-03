/**
 * @file review-skill-guard.test.mjs — proof of the #2882 `check:standards` rule that keeps the review-verdict
 *   label swap inside its single home (`we:scripts/review-set-label.mjs`). Pure fixtures, no fs.
 *
 *   The rule exists because the raw path is silently lossy: it skips the `reviewed-sha` stamp the drain's
 *   staleness gate reads (#2409) and bypasses INVARIANT 2, which lives in `decideSetLabel` and so only binds
 *   callers that come through the module. Observed on PR #983 — five re-parks.
 */
import { describe, it, expect } from 'vitest';
import { checkReviewLabelSingleHome, isGuardedDoc, GUARDED_DOC_PREFIXES } from '../review-skill-guard.mjs';
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

describe('wrapped commands — the shape that hid the real instance (#1005 review, major 2)', () => {
  // The VERBATIM bytes from we:skills-src/drain/SKILL.md — a real raw swap on the auto-land path, wrapped so
  // `--add-label` ends one line and `review:accepted` opens the next. The line-anchored first cut MISSED this
  // and flagged a benign note elsewhere in the same file instead, then the PR claimed it had caught this one.
  const WRAPPED = [
    '       on the combined verdict: **combined `land`** (BOTH the panel and the independent validator accepted) →',
    '       apply `redteam:accepted` THEN `review:accepted` (`gh pr edit <num> --repo <repo> --add-label',
    '       redteam:accepted --add-label review:accepted`) and **re-run the drain** — the non-author-accepts invariant',
  ].join('\n');

  // The benign note from the SAME file — the one the first cut actually flagged. It is prose about label
  // provisioning, not an instruction to swap, and it must stay clean.
  const BENIGN = '> if it is missing, `gh pr edit --add-label review:human` silently no-ops. Ensure it exists once:';

  it('FLAGS the wrapped auto-land swap', () => {
    const { errors } = checkReviewLabelSingleHome(doc(WRAPPED));
    expect(errors).toHaveLength(1);
  });

  it('does NOT flag the label-must-exist note', () => {
    // It is a bare mention with no swap intent; the rule keys on an edit that carries a review label, and this
    // one does carry it — so the honest statement is that it IS matched and the DRAIN FILE is out of scope.
    // Assert the file-scope decision instead of pretending the regex distinguishes prose here.
    expect(isGuardedDoc('skills-src/drain/SKILL.md')).toBe(false);
    expect(checkReviewLabelSingleHome([{ file: 'skills-src/drain/SKILL.md', content: BENIGN }]).errors).toHaveLength(0);
  });

  it('does not run a match across a paragraph break', () => {
    const across = 'gh pr edit 12 --repo x/y\n\nunrelated paragraph mentioning --add-label review:accepted';
    expect(checkReviewLabelSingleHome(doc(across)).errors).toHaveLength(0);
  });

  it('reports EVERY occurrence, not just the first on a line or in a file', () => {
    const two = 'gh pr edit 1 --add-label review:accepted\nand gh pr edit 2 --add-label review:changes\n';
    expect(checkReviewLabelSingleHome(doc(two)).errors).toHaveLength(2);
  });

  it('an elided command is NOT exempt — the carve-out is gone (#1005 review, major 3)', () => {
    // A fully runnable template with an elision slipped through the old carve-out.
    const runnable = 'gh pr edit <PR> --repo … --add-label review:accepted --remove-label review:pending';
    expect(checkReviewLabelSingleHome(doc(runnable)).errors).toHaveLength(1);
    // And an elided mention no longer launders a real command later on the same line.
    const laundered = 'never `gh pr edit … --add-label review:*`; instead gh pr edit 12 --add-label review:accepted';
    expect(checkReviewLabelSingleHome(doc(laundered)).errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe('the fs walk cannot drift from the guarded set', () => {
  it('GUARDED_DOC_PREFIXES is the single source the check-standards walk derives its roots from', () => {
    // Pins minor 1: the walk must not hardcode a second copy, or a widening here silently no-ops.
    const source = readFileSync(join(ROOT, 'scripts/check-standards.mjs'), 'utf8');
    expect(source).toContain('GUARDED_DOC_PREFIXES.map');
    expect(source).not.toMatch(/scanDirs = \['skills-src', 'docs\/agent'\]/);
  });
});
