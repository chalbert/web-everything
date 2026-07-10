/**
 * @file review-core.test.mjs — proof of the #2325 shared review-verdict core: the canonical `Finding` shape
 *   normalization, the `{findings, verdict}` derivation (humanRequired always wins; outstanding findings vs
 *   resolved-by-outcome), and the mandate-text builder every "read a diff, judge it" caller renders from.
 *   Also proves #2311's v2 editor↔reviewer negotiation-loop primitives: the editor mandate builder and the
 *   round-cap outcome derivation (continue / land / escalate). Also proves #2310's v3 multi-mandate panel
 *   reduction: per-lens mandate text, the lens-tagged findings merge, and the panel→single-verdict derivation
 *   (unanimous mandatory-lens accept lands; a genuine conflict or the global humanRequired flag escalates).
 */
import { describe, it, expect } from 'vitest';
import {
  VERDICTS,
  DEFAULT_MANDATE,
  NEGOTIATION_ROUND_CAP,
  NEGOTIATION_OUTCOMES,
  MANDATE_LENSES,
  MANDATORY_LENSES,
  ADVISORY_LENSES,
  PANEL_LENSES,
  normalizeFinding,
  normalizeFindings,
  deriveVerdict,
  buildMandate,
  buildEditorMandate,
  deriveNegotiationOutcome,
  REVIEW_DISPOSITIONS,
  REVIEW_REASONS,
  deriveReviewDisposition,
  buildPanelMandate,
  buildPanelFindings,
  derivePanelVerdict,
  renderPanelVerdictTable,
} from '../review-core.mjs';

describe('normalizeFinding', () => {
  it('accepts a well-formed raw finding, coercing types', () => {
    const f = normalizeFinding({ file: 'a.mjs', summary: ' off-by-one ', line: '12', verdict: 'CONFIRMED' });
    expect(f).toEqual({ file: 'a.mjs', summary: 'off-by-one', line: 12, verdict: 'CONFIRMED' });
  });

  it('accepts the legacy `finding` field as summary (dismissal-record shape)', () => {
    expect(normalizeFinding({ finding: 'stale cache read' })).toEqual({ summary: 'stale cache read' });
  });

  it('drops an invalid verdict/outcome tag rather than passing it through', () => {
    const f = normalizeFinding({ summary: 'x', verdict: 'bogus', outcome: 'also-bogus' });
    expect(f).toEqual({ summary: 'x' });
  });

  it('returns null for non-objects and objects with no usable summary', () => {
    expect(normalizeFinding(null)).toBeNull();
    expect(normalizeFinding('a string')).toBeNull();
    expect(normalizeFinding({ file: 'a.mjs' })).toBeNull();
    expect(normalizeFinding({ summary: '   ' })).toBeNull();
  });
});

describe('normalizeFindings', () => {
  it('maps a mixed list, dropping anything unusable, never throwing', () => {
    const out = normalizeFindings([{ summary: 'a' }, null, 'garbage', { summary: 'b', line: 3 }, {}]);
    expect(out).toEqual([{ summary: 'a' }, { summary: 'b', line: 3 }]);
  });

  it('degrades a non-array to an empty list', () => {
    expect(normalizeFindings(undefined)).toEqual([]);
    expect(normalizeFindings({ not: 'an array' })).toEqual([]);
  });
});

describe('deriveVerdict', () => {
  it('accepts a clean diff — no findings', () => {
    expect(deriveVerdict({ findings: [] })).toBe(VERDICTS.ACCEPT);
    expect(deriveVerdict()).toBe(VERDICTS.ACCEPT);
  });

  it('needs changes when a fresh (no-outcome) finding is present — first-pass review', () => {
    expect(deriveVerdict({ findings: [{ summary: 'bug' }] })).toBe(VERDICTS.CHANGES);
  });

  it('accepts once every finding is resolved by outcome (fixed / no_change_needed)', () => {
    const findings = [
      { summary: 'a', outcome: 'fixed' },
      { summary: 'b', outcome: 'no_change_needed' },
    ];
    expect(deriveVerdict({ findings })).toBe(VERDICTS.ACCEPT);
  });

  it('a SKIPPED finding stays outstanding — still changes', () => {
    const findings = [{ summary: 'a', outcome: 'fixed' }, { summary: 'b', outcome: 'skipped' }];
    expect(deriveVerdict({ findings })).toBe(VERDICTS.CHANGES);
  });

  it('humanRequired ALWAYS wins, even over an empty findings list', () => {
    expect(deriveVerdict({ findings: [], humanRequired: true })).toBe(VERDICTS.NEEDS_HUMAN);
    expect(deriveVerdict({ findings: [{ summary: 'a', outcome: 'fixed' }], humanRequired: true }))
      .toBe(VERDICTS.NEEDS_HUMAN);
  });
});

describe('buildMandate', () => {
  it('defaults to the correctness mandate + diff-only isolation', () => {
    const text = buildMandate();
    expect(text).toContain(DEFAULT_MANDATE);
    expect(text).toContain('ONLY the diff');
    expect(text).toMatch(/Judge only/);
  });

  it('forbids checking out the PR branch in the shared tree (#2336)', () => {
    // The seed runs inside the drain's shared primary checkout; it must never move HEAD onto the PR branch.
    const text = buildMandate();
    expect(text).toMatch(/do NOT `git checkout`/);
    expect(text).toMatch(/throwaway `git clone`/);
  });

  it('joins a multi-mandate array (the #2285 v3 reviewer-panel shape)', () => {
    const text = buildMandate({ mandate: ['correctness', 'security', 'simplicity'] });
    expect(text).toContain('correctness, security, simplicity');
  });

  it('renders a custom contextIsolation label instead of the diff-only default', () => {
    const text = buildMandate({ contextIsolation: 'diff+pr-description' });
    expect(text).toContain('Context isolation: diff+pr-description');
    expect(text).not.toContain('ONLY the diff');
  });
});

describe('buildEditorMandate (#2311)', () => {
  it('lists each finding with file + summary + failure scenario', () => {
    const text = buildEditorMandate({
      round: 1,
      findings: [{ file: 'a.mjs', summary: 'off-by-one', failure_scenario: 'index 0 skipped' }],
    });
    expect(text).toContain('a.mjs: off-by-one — index 0 skipped');
    expect(text).toMatch(/round 1\/3/);
  });

  it('defaults the round cap to NEGOTIATION_ROUND_CAP and reflects a custom one', () => {
    expect(buildEditorMandate({ round: 2, findings: [{ summary: 'x' }] })).toMatch(`round 2/${NEGOTIATION_ROUND_CAP}`);
    expect(buildEditorMandate({ round: 2, roundCap: 5, findings: [{ summary: 'x' }] })).toMatch('round 2/5');
  });

  it('forbids editing in the shared checkout — isolated clone, push back to the same branch', () => {
    const text = buildEditorMandate({ findings: [{ summary: 'x' }] });
    expect(text).toMatch(/ISOLATED THROWAWAY CLONE/);
    expect(text).toMatch(/push back to the SAME/);
  });

  it('degrades gracefully when called with an empty findings list', () => {
    const text = buildEditorMandate({ findings: [] });
    expect(text).toContain('(none —');
  });
});

describe('deriveNegotiationOutcome (#2311)', () => {
  it('lands once the reviewer accepts, regardless of round', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: 1 })).toBe(NEGOTIATION_OUTCOMES.LAND);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.ACCEPT, round: NEGOTIATION_ROUND_CAP })).toBe(NEGOTIATION_OUTCOMES.LAND);
  });

  it('continues on changes while under the round cap', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 1 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: NEGOTIATION_ROUND_CAP - 1 })).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
  });

  it('escalates on changes once the round cap is reached — non-convergence', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: NEGOTIATION_ROUND_CAP })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: NEGOTIATION_ROUND_CAP + 1 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('escalates on needs-human at ANY round — no budget saves a conflict-of-interest revision', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.NEEDS_HUMAN, round: 1 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('honors a caller-supplied roundCap instead of the default', () => {
    expect(deriveNegotiationOutcome({ verdict: VERDICTS.CHANGES, round: 1, roundCap: 1 })).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });
});

describe('deriveReviewDisposition (#2285 — one reason→disposition derivation, all reviews)', () => {
  it('gate-self converges to fix but NEVER auto-lands — a human gates the trust-chain edit', () => {
    expect(deriveReviewDisposition({ reason: REVIEW_REASONS.GATE_SELF }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
  });

  it('a plain sensitivity park converges AND may auto-land (today\'s agent-reviewable path)', () => {
    for (const reason of [REVIEW_REASONS.BLAST_RADIUS, REVIEW_REASONS.SIZE, REVIEW_REASONS.DISMISSED_FINDINGS, REVIEW_REASONS.CROSS_REPO, REVIEW_REASONS.SAMPLING]) {
      expect(deriveReviewDisposition({ reason })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
    }
  });

  it('a deadlock reason hands straight to a human — no (re-)convergence', () => {
    for (const reason of [REVIEW_REASONS.NON_CONVERGENCE, REVIEW_REASONS.MANDATE_CONFLICT]) {
      expect(deriveReviewDisposition({ reason })).toEqual({ mode: REVIEW_DISPOSITIONS.HUMAN, autoLand: false });
    }
  });

  it('strictest reason wins when several apply — deadlock beats gate-self beats plain', () => {
    expect(deriveReviewDisposition({ reasons: [REVIEW_REASONS.BLAST_RADIUS, REVIEW_REASONS.GATE_SELF] }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false }); // gate-self pins autoLand:false
    expect(deriveReviewDisposition({ reasons: [REVIEW_REASONS.GATE_SELF, REVIEW_REASONS.NON_CONVERGENCE] }))
      .toEqual({ mode: REVIEW_DISPOSITIONS.HUMAN, autoLand: false }); // deadlock wins outright
  });

  it('is exhaustive — every REVIEW_REASONS value derives a disposition (no unknown-reason throw)', () => {
    for (const reason of Object.values(REVIEW_REASONS)) {
      expect(() => deriveReviewDisposition({ reason })).not.toThrow();
    }
  });

  it('throws on an unknown reason and on no reason at all (exhaustive discipline)', () => {
    expect(() => deriveReviewDisposition({ reason: 'made-up' })).toThrow(/unknown reason/);
    expect(() => deriveReviewDisposition({})).toThrow(/at least one reason/);
  });

  // Regression guard (#2285): the drain's real `reasons` array (from scoreEscalation) carries DECORATED strings,
  // NOT bare tokens. These literals are copied VERBATIM from scoreEscalation's `reasons.push(...)` templates in
  // `scripts/lib/review-escalation.mjs` — if that file's format drifts, this test is the tripwire that catches
  // the two files silently disagreeing (the parked-PR branch would otherwise wedge on an `unknown reason(s)` throw).
  describe('canonicalizes the DECORATED scoreEscalation reason strings the drain actually carries', () => {
    it('a decorated gate-self reason converges but never auto-lands (the exact scoreEscalation format)', () => {
      expect(deriveReviewDisposition({ reason: 'gate-self (scripts/lib/review-escalation.mjs) — human review required' }))
        .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
    });

    it('each decorated sensitivity reason converges AND may auto-land', () => {
      const decorated = [
        'blast-radius (scripts/foo.mjs, scripts/bar.mjs, scripts/baz.mjs, …)',
        'size (1080 ≥ 400 changed lines)',
        'dismissed-findings (2 pre-PR review finding(s) the lane dismissed)',
        'cross-repo impl+WE couple',
        'sampling floor (1-in-10)',
      ];
      for (const reason of decorated) {
        expect(deriveReviewDisposition({ reason })).toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
      }
    });

    it('accepts the parked `reasons` array VERBATIM — decorated strings, strictest wins (gate-self pins autoLand:false)', () => {
      // Exactly the shape the drain's `parked` JSON stamps: several decorated reasons, mixed families.
      const parkedReasons = [
        'blast-radius (scripts/lib/review-core.mjs)',
        'size (1080 ≥ 400 changed lines)',
        'gate-self (scripts/merge-ai-prs.mjs) — human review required',
        'sampling floor (1-in-10)',
      ];
      expect(() => deriveReviewDisposition({ reasons: parkedReasons })).not.toThrow();
      expect(deriveReviewDisposition({ reasons: parkedReasons }))
        .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: false });
    });

    it('mixes bare and decorated tokens freely, and still throws on a genuinely unknown decorated reason', () => {
      expect(deriveReviewDisposition({ reasons: [REVIEW_REASONS.BLAST_RADIUS, 'sampling floor (1-in-10)'] }))
        .toEqual({ mode: REVIEW_DISPOSITIONS.CONVERGE, autoLand: true });
      expect(() => deriveReviewDisposition({ reason: 'sizeable rewrite (not a real signal)' })).toThrow(/unknown reason/);
    });
  });
});

describe('MANDATE_LENSES / MANDATORY_LENSES / ADVISORY_LENSES / PANEL_LENSES (#2310)', () => {
  it('splits the four /code-review lenses into a mandatory pair and an advisory pair', () => {
    expect(MANDATORY_LENSES).toEqual([MANDATE_LENSES.CORRECTNESS, MANDATE_LENSES.SECURITY]);
    expect(ADVISORY_LENSES).toEqual([MANDATE_LENSES.SIMPLICITY, MANDATE_LENSES.STANDARDS]);
  });

  it('PANEL_LENSES is the mandatory + advisory union, mandatory first', () => {
    expect(PANEL_LENSES).toEqual([...MANDATORY_LENSES, ...ADVISORY_LENSES]);
    expect(PANEL_LENSES).toHaveLength(4);
  });
});

describe('buildPanelMandate (#2310)', () => {
  it('renders the lens into the base buildMandate text', () => {
    const text = buildPanelMandate({ lens: MANDATE_LENSES.SECURITY });
    expect(text).toContain('reviewing a diff against this mandate: security');
  });

  it('frames the reviewer as one of several independent lenses, told not to soften its verdict', () => {
    const text = buildPanelMandate({ lens: MANDATE_LENSES.CORRECTNESS });
    expect(text).toMatch(/ONE of several independent mandate reviewers/);
    expect(text).toMatch(/do not soften or withhold your/);
  });

  it('throws on an unknown lens rather than silently building a bogus mandate', () => {
    expect(() => buildPanelMandate({ lens: 'vibes' })).toThrow(/unknown lens/);
  });
});

describe('buildPanelFindings (#2310)', () => {
  it('flattens per-lens findings into one list, tagging category with the originating lens', () => {
    const merged = buildPanelFindings({
      correctness: [{ summary: 'off-by-one', category: 'bug' }],
      simplicity: [{ summary: 'nested ternary' }],
    });
    expect(merged).toEqual([
      { summary: 'off-by-one', category: 'correctness/bug' },
      { summary: 'nested ternary', category: 'simplicity' },
    ]);
  });

  it('degrades to an empty list when called with no lenses', () => {
    expect(buildPanelFindings()).toEqual([]);
  });

  it('drops unusable raw findings the same way normalizeFindings does', () => {
    expect(buildPanelFindings({ security: [{ file: 'a.mjs' }, { summary: 'real one' }] })).toEqual([
      { summary: 'real one', category: 'security' },
    ]);
  });
});

describe('derivePanelVerdict (#2310)', () => {
  const allAccept = { correctness: VERDICTS.ACCEPT, security: VERDICTS.ACCEPT, simplicity: VERDICTS.ACCEPT, 'standards-conformance': VERDICTS.ACCEPT };

  it('lands only once every MANDATORY lens unanimously accepts', () => {
    expect(derivePanelVerdict({ lensVerdicts: allAccept })).toBe(VERDICTS.ACCEPT);
  });

  it('an outstanding ADVISORY-lens verdict never blocks the mandatory-unanimous accept', () => {
    const verdicts = { ...allAccept, simplicity: VERDICTS.CHANGES, 'standards-conformance': VERDICTS.CHANGES };
    expect(derivePanelVerdict({ lensVerdicts: verdicts })).toBe(VERDICTS.ACCEPT);
  });

  it('a single MANDATORY lens wanting changes yields changes, not an immediate escalate', () => {
    const verdicts = { ...allAccept, security: VERDICTS.CHANGES };
    expect(derivePanelVerdict({ lensVerdicts: verdicts })).toBe(VERDICTS.CHANGES);
  });

  it('a MANDATORY lens returning needs-human escalates the whole panel', () => {
    const verdicts = { ...allAccept, correctness: VERDICTS.NEEDS_HUMAN };
    expect(derivePanelVerdict({ lensVerdicts: verdicts })).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('the global humanRequired conflict-of-interest flag always wins, same as deriveVerdict', () => {
    expect(derivePanelVerdict({ lensVerdicts: allAccept, humanRequired: true })).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('a caller-flagged genuine mandate conflict escalates even when every lens individually accepted', () => {
    expect(derivePanelVerdict({ lensVerdicts: allAccept, conflict: true })).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('throws if a mandatory lens has no verdict at all, rather than silently treating it as accept', () => {
    expect(() => derivePanelVerdict({ lensVerdicts: { correctness: VERDICTS.ACCEPT } })).toThrow(/missing verdict/);
  });

  it('honors a caller-supplied mandatoryLenses set instead of the default pair', () => {
    expect(derivePanelVerdict({
      lensVerdicts: { simplicity: VERDICTS.ACCEPT },
      mandatoryLenses: [MANDATE_LENSES.SIMPLICITY],
    })).toBe(VERDICTS.ACCEPT);
  });

  it('throws on an empty mandatoryLenses set rather than vacuously accepting (Array#every trap)', () => {
    expect(() => derivePanelVerdict({ lensVerdicts: allAccept, mandatoryLenses: [] })).toThrow(/must be non-empty/);
  });
});

describe('renderPanelVerdictTable (#2310)', () => {
  it('renders one row per lens, tagged mandatory/advisory, with each verdict', () => {
    const table = renderPanelVerdictTable({
      lensVerdicts: { correctness: VERDICTS.ACCEPT, security: VERDICTS.CHANGES, simplicity: VERDICTS.ACCEPT, 'standards-conformance': VERDICTS.ACCEPT },
    });
    expect(table).toContain('| correctness | mandatory | accept |');
    expect(table).toContain('| security | mandatory | changes |');
    expect(table).toContain('| simplicity | advisory | accept |');
    expect(table).toContain('| standards-conformance | advisory | accept |');
  });

  it('renders a placeholder for a lens with no verdict yet, instead of throwing', () => {
    const table = renderPanelVerdictTable({ lensVerdicts: {} });
    expect(table).toContain('| correctness | mandatory | (no verdict) |');
  });
});
