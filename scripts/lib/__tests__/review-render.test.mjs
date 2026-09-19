/**
 * @file review-render.test.mjs — proof of #2432's PURE PR-comment renderer (`renderPanelComment`): from a
 *   review panel's structured `{findings, verdict, disposition}` result it renders the full PR-comment markdown
 *   — a heading, the overall verdict, the disposition, the embedded per-lens verdict table (extending
 *   `renderPanelVerdictTable`), and a findings section grouped by lens/category. These pin that the markdown
 *   CONTAINS each structured field (the renderer can't drift from its input), the empty-findings case, and the
 *   human-required verdict case. The verdict/disposition DERIVATIONS themselves are proved in
 *   `review-core.test.mjs`; here we only prove the render.
 */
import { describe, it, expect } from 'vitest';
import {
  renderPanelComment, deriveResolutionBasis, renderResolutionBasisBanner, graduatedToFromDiff, graduatedToFromBody,
  normalizeGraduatedTo,
} from '../review-render.mjs';
import { VERDICTS, REVIEW_DISPOSITIONS, MANDATORY_LENSES, deriveVerdict } from '../review-core.mjs';

describe('renderPanelComment — the full PR-comment body', () => {
  it('renders heading, verdict, disposition, verdict table, and every finding', () => {
    const md = renderPanelComment({
      verdict: VERDICTS.CHANGES,
      disposition: { mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true },
      lensVerdicts: { correctness: 'changes', security: 'accept', simplicity: 'accept', 'standards-conformance': 'accept' },
      findings: [
        { file: 'retry.mjs', line: 12, summary: 'off-by-one in the retry loop', failure_scenario: 'retries N+1 times', category: 'correctness', verdict: 'CONFIRMED' },
        { summary: 'nested ternary is hard to read', category: 'simplicity' },
      ],
    });
    expect(md).toContain('## PR review');
    expect(md).toContain('**Verdict:**');
    expect(md).toContain('changes requested');
    expect(md).toContain('**Disposition:**');
    expect(md).toContain('an agent may land it');
    // embedded per-lens table (extends renderPanelVerdictTable)
    expect(md).toContain('| lens | weight | verdict |');
    expect(md).toContain('| correctness | mandatory | changes |');
    expect(md).toContain('| security | mandatory | accept |');
    // findings, grouped by category, with file:line + failure scenario + verify tag
    expect(md).toContain('### Findings (2)');
    expect(md).toContain('**correctness** (1)');
    expect(md).toContain('`retry.mjs:12`');
    expect(md).toContain('off-by-one in the retry loop');
    expect(md).toContain('retries N+1 times');
    expect(md).toContain('_[CONFIRMED]_');
    expect(md).toContain('**simplicity** (1)');
    expect(md).toContain('nested ternary is hard to read');
  });

  it('renders a passing verdict with no findings (empty case)', () => {
    const md = renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [] });
    expect(md).toContain('✅ pass');
    expect(md).toContain('### Findings (0)');
    expect(md).toContain('_No findings._');
    // no per-lens verdicts supplied → no table
    expect(md).not.toContain('| lens | weight | verdict |');
  });

  it('renders the human-required verdict', () => {
    const md = renderPanelComment({
      verdict: VERDICTS.NEEDS_HUMAN,
      disposition: { mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false },
      findings: [{ summary: 'touches the trust chain', category: 'security' }],
    });
    expect(md).toContain('human review required');
    expect(md).toContain('a human must still clear it');
    expect(md).toContain('touches the trust chain');
  });

  it('renders the deadlock (human) disposition', () => {
    const md = renderPanelComment({
      verdict: VERDICTS.CHANGES,
      disposition: { mode: REVIEW_DISPOSITIONS.HUMAN, autoLand: false },
      findings: [],
    });
    expect(md).toContain('park for a human — no further convergence');
  });

  it('accepts a bare-string disposition verbatim', () => {
    const md = renderPanelComment({ verdict: VERDICTS.ACCEPT, disposition: 'wait-author', findings: [] });
    expect(md).toContain('**Disposition:** wait-author');
  });

  it('omits the disposition line when none is supplied', () => {
    const md = renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [] });
    expect(md).not.toContain('**Disposition:**');
  });

  it('is tolerant of missing/malformed fields (no throw, deterministic)', () => {
    // no verdict → pending; findings with only a summary; a garbage finding dropped by normalize.
    const md = renderPanelComment({ findings: [{ summary: 'only a summary' }, { nope: 1 }, null] });
    expect(md).toContain('**Verdict:** (pending)');
    expect(md).toContain('### Findings (1)');
    expect(md).toContain('only a summary');
    // pure/deterministic: same input → same output
    expect(renderPanelComment({ findings: [{ summary: 'only a summary' }, { nope: 1 }, null] })).toBe(md);
  });

  it('groups findings lacking a category under "general"', () => {
    const md = renderPanelComment({ verdict: VERDICTS.CHANGES, findings: [{ summary: 'no category here' }] });
    expect(md).toContain('**general** (1)');
  });

  it('falls back to the raw token for an unknown verdict', () => {
    const md = renderPanelComment({ verdict: 'weird', findings: [] });
    expect(md).toContain('**Verdict:** weird');
  });

  it('respects a custom heading and default mandatory lenses in the table', () => {
    const md = renderPanelComment({
      heading: 'Auto-review',
      verdict: VERDICTS.ACCEPT,
      lensVerdicts: { correctness: 'accept', security: 'accept', simplicity: 'accept', 'standards-conformance': 'accept' },
      mandatoryLenses: MANDATORY_LENSES,
      findings: [],
    });
    expect(md).toContain('## Auto-review');
    expect(md).toContain('### Panel verdicts');
  });
});

// THE AUDIT TRAIL ON THE MERGE PATH (review blocker 3B) — the OUTPUT half of the compensating control for
// `PREVENTION_IMPACT_BAR`; rationale lives once at `blocksAcceptance` in `jury-core.mjs`. These assert the rendered
// SURFACE, not the predicate: the declared impact and the owed guard must be in the posted comment body, because
// that body is what the drain's auto-land branch posts when the bar is what un-blocked a guard.
describe('renderFindingLine carries impactIfUnfixed + the owed prevention (review blocker 3B)', () => {
  it('a resolved below-bar guard ACCEPTS, and the rendered comment still names the guard and the impact', () => {
    const finding = {
      file: 'scripts/lib/thing.mjs',
      line: 7,
      summary: 'a stale comment',
      category: 'simplicity',
      outcome: 'fixed',
      impactIfUnfixed: 'cosmetic',
      prevention: 'a check:standards rule that errors on a stale @see target',
      preventionCaptured: false,
    };
    // the verdict really does un-block — this is the path with no escalation notice
    const verdict = deriveVerdict({ findings: [finding] });
    expect(verdict).toBe(VERDICTS.ACCEPT);

    const md = renderPanelComment({ verdict, findings: [finding] });
    expect(md).toContain('impact if unfixed: cosmetic');
    expect(md).toContain('a check:standards rule that errors on a stale @see target');
    expect(md).toContain('OWED');
  });

  it('marks an already-CAPTURED guard as captured rather than owed', () => {
    const md = renderPanelComment({
      verdict: VERDICTS.ACCEPT,
      findings: [{ summary: 'x', outcome: 'fixed', impactIfUnfixed: 'broken', prevention: 'the existing lint', preventionCaptured: true }],
    });
    expect(md).toContain('_Prevention (captured):_ the existing lint');
    expect(md).not.toContain('OWED');
  });

  it('omits both fields when the finding declares neither (old-shape findings render byte-stable)', () => {
    const md = renderPanelComment({ verdict: VERDICTS.CHANGES, findings: [{ summary: 'plain finding' }] });
    expect(md).not.toContain('impact if unfixed');
    expect(md).not.toContain('_Prevention');
  });

  it('DROPS an invented impact word rather than printing it (normalizeFindings validates the enum)', () => {
    const md = renderPanelComment({ verdict: VERDICTS.CHANGES, findings: [{ summary: 'x', impactIfUnfixed: 'high' }] });
    expect(md).not.toContain('impact if unfixed');
  });
});

// ── round-2 finding 5 — THE SIBLING LOOKUP TABLES HAD THE SAME PROTOTYPE HOLE AS THE RANK TABLES. ──────
// `VERDICT_LABELS` was a frozen NORMAL-prototype object read with `VERDICT_LABELS[verdict] ?? String(verdict)`.
// `Object.freeze` seals own properties but does not detach `Object.prototype`, and `??` only fires on
// null/undefined — so an inherited member is truthy, the raw-token fallback never runs, and
// `renderPanelComment({ verdict: 'toString' })` rendered `**Verdict:** function toString() { [native code] }` into
// a posted PR comment. The table is now built through `frozenLookup`; these probe the real prototype members.
describe('VERDICT_LABELS is prototype-proof — an unknown verdict falls back to its raw token (finding 5)', () => {
  const PROTO_KEYS = ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable'];

  it.each(PROTO_KEYS)('renderPanelComment({ verdict: "%s" }) prints the raw token, not an inherited member', (key) => {
    const md = renderPanelComment({ verdict: key, findings: [] });
    expect(md).toContain(`**Verdict:** ${key}`);
    expect(md).not.toContain('[native code]');
    expect(md).not.toContain('function ');
  });

  it('a real verdict still renders its human label', () => {
    expect(renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [] })).toContain('✅ pass — no blocking findings');
  });
});

// #2447 — the graduatedTo RESOLUTION BASIS. The regression the item names: a backlog-only resolve whose deliverable
// already landed (#2403 / PR #421, graduatedTo 6b5874f7) must say so up front, and a normal code resolve must not.
describe('resolution basis — the graduatedTo banner (#2447)', () => {
  const RESOLVE_DIFF = [
    'diff --git a/backlog/2403-review-disposition.md b/backlog/2403-review-disposition.md',
    '--- a/backlog/2403-review-disposition.md',
    '+++ b/backlog/2403-review-disposition.md',
    '@@ -3,3 +3,5 @@',
    '-status: active',
    '+status: resolved',
    '+dateResolved: "2026-07-11"',
    '+graduatedTo: 6b5874f7 (review-core deriveReviewDisposition)',
  ].join('\n');

  it('renders the banner up front for a backlog-only graduatedTo resolve', () => {
    const resolutionBasis = deriveResolutionBasis({ diffText: RESOLVE_DIFF, changedFiles: ['backlog/2403-review-disposition.md'] });
    expect(resolutionBasis).toEqual({ graduatedTo: '6b5874f7 (review-core deriveReviewDisposition)', ref: '6b5874f7', isCommit: true, source: 'frontmatter' });
    const md = renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [], resolutionBasis });
    expect(md).toContain('`graduatedTo: 6b5874f7 (review-core deriveReviewDisposition)`');
    expect(md).toContain('no code change — deliverable already landed in `6b5874f7`');
    // UP FRONT: the banner precedes the verdict line.
    expect(md.indexOf('Resolution basis')).toBeLessThan(md.indexOf('**Verdict:**'));
  });

  it('is ABSENT for a normal code resolve — even one that also sets graduatedTo', () => {
    const codeDiff = `diff --git a/scripts/foo.mjs b/scripts/foo.mjs\n+export const x = 1;\n${RESOLVE_DIFF.replace('6b5874f7 (review-core deriveReviewDisposition)', 'scripts/foo.mjs')}`;
    const basis = deriveResolutionBasis({ diffText: codeDiff, changedFiles: ['scripts/foo.mjs', 'backlog/2403-review-disposition.md'] });
    expect(basis).toBe(null);
    const md = renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [], resolutionBasis: basis });
    expect(md).not.toContain('Resolution basis');
    expect(md).toBe(renderPanelComment({ verdict: VERDICTS.ACCEPT, findings: [] })); // byte-identical to before
  });

  it('never claims "no code change" without a KNOWN, all-backlog file list, or for a cross-repo couple', () => {
    const graduatedTo = '6b5874f7';
    expect(deriveResolutionBasis({ graduatedTo, changedFiles: null })).toBe(null);
    expect(deriveResolutionBasis({ graduatedTo, changedFiles: [] })).toBe(null);
    expect(deriveResolutionBasis({ graduatedTo, changedFiles: ['backlog/x.md', 42] })).toBe(null);
    expect(deriveResolutionBasis({ graduatedTo, changedFiles: ['backlog/x.md'], crossRepo: true })).toBe(null);
    expect(deriveResolutionBasis({ manifest: { graduatedTo, repos: [{ repo: 'frontierui' }, { repo: 'we' }] }, changedFiles: ['backlog/x.md'] })).toBe(null);
  });

  it('a graduatedTo that names no deliverable (none / empty / non-string) yields no basis', () => {
    for (const graduatedTo of ['none', 'None', '', '   ', '"none"', null, 7, {}]) {
      expect(deriveResolutionBasis({ graduatedTo, changedFiles: ['backlog/x.md'] })).toBe(null);
    }
  });

  it('prefers manifest → frontmatter → body, and reads a path/item pointer as a non-commit ref', () => {
    const changedFiles = ['backlog/2403-review-disposition.md'];
    const body = 'Resolved as a dedup.\n\n- **graduatedTo:** `b54f49a8`\n';
    expect(deriveResolutionBasis({ manifest: { graduatedTo: 'f6384ac5' }, diffText: RESOLVE_DIFF, body, changedFiles }).source).toBe('manifest');
    expect(deriveResolutionBasis({ diffText: RESOLVE_DIFF, body, changedFiles }).source).toBe('frontmatter');
    expect(deriveResolutionBasis({ body, changedFiles })).toMatchObject({ graduatedTo: 'b54f49a8', source: 'body', isCommit: true });
    expect(deriveResolutionBasis({ bodyGraduatedTo: 'b54f49a8', changedFiles })).toMatchObject({ ref: 'b54f49a8', source: 'body' });
    expect(deriveResolutionBasis({ graduatedTo: '"we:scripts/backlog/capacity.mjs"', changedFiles })).toMatchObject({ ref: 'we:scripts/backlog/capacity.mjs', isCommit: false });
  });

  it('graduatedToFromDiff reads only an ADDED line inside a backlog item section', () => {
    expect(graduatedToFromDiff('diff --git a/docs/x.md b/docs/x.md\n+graduatedTo: 6b5874f7')).toBe(null);
    expect(graduatedToFromDiff('diff --git a/backlog/1-a.md b/backlog/1-a.md\n-graduatedTo: 6b5874f7')).toBe(null);
    expect(graduatedToFromDiff('diff --git a/backlog/1-a.md b/backlog/1-a.md\n+graduatedTo: none')).toBe(null);
    // an unparseable (quoted-path) header still CLOSES the previous backlog section
    expect(graduatedToFromDiff('diff --git a/backlog/1-a.md b/backlog/1-a.md\n+status: resolved\ndiff --git "a/sp ace.mjs" "b/sp ace.mjs"\n+graduatedTo: 6b5874f7')).toBe(null);
    expect(graduatedToFromDiff(null)).toBe(null);
  });

  it('graduatedToFromBody ignores fenced examples and quotes, and tolerates bullets/bold/code spans', () => {
    expect(graduatedToFromBody('```\ngraduatedTo: 6b5874f7\n```')).toBe(null);
    expect(graduatedToFromBody('> graduatedTo: 6b5874f7')).toBe(null);
    expect(graduatedToFromBody('the graduatedTo: field is great')).toBe(null);
    expect(graduatedToFromBody('`graduatedTo: 6b5874f7`')).toBe('6b5874f7');
    expect(graduatedToFromBody('* __graduatedTo__: 6b5874f7')).toBe('6b5874f7');
    expect(graduatedToFromBody(undefined)).toBe(null);
  });

  it('the banner is one safe line: backticks/newlines stripped, over-long free text truncated', () => {
    const banner = renderResolutionBasisBanner({ graduatedTo: 'abc1234 `evil`\nline two', ref: 'abc1234' });
    expect(banner).not.toMatch(/\n/);
    expect(banner).toContain('`graduatedTo: abc1234 evil line two`');
    const long = normalizeGraduatedTo(`abc1234 ${'x'.repeat(400)}`);
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
    expect(renderResolutionBasisBanner(null)).toBe(null);
  });
});
