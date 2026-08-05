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
import { renderPanelComment } from '../review-render.mjs';
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

// ─────────────────────────────────────────────────────────────────────────────
// #xdompzx review, blocker 3B — THE AUDIT TRAIL ON THE MERGE PATH.
// `PREVENTION_IMPACT_BAR` lets a below-bar finding's uncaptured guard ride a clean `accept`. That is a SCALING of
// the gate rather than a silent loosening only if the two facts that justified un-blocking it still reach a reader
// on the path the relaxation opens: the impact the reviewer DECLARED, and the guard the repo still OWES. The
// operator notice (`renderPreventionSummary`) fires only on the ESCALATED event — exactly the path a below-bar
// finding no longer takes. So the POSTED COMMENT must carry both. These assert the surface, not the predicate.
// ─────────────────────────────────────────────────────────────────────────────
describe('renderFindingLine carries impactIfUnfixed + the owed prevention (#xdompzx review, blocker 3B)', () => {
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
