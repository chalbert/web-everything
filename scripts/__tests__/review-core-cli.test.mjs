/**
 * @file review-core-cli.test.mjs — proof of the PURE glue layer of the `scripts/review-core-cli.mjs` CLI
 *   (#2435): `parseFlags`, `reduceReview` (the reduction that collapses the drain's 5× inline `node -e` calls
 *   into one testable fn), and `buildMandateText`. The stdin/--file/print I/O is the CLI's boundary; the
 *   derivations are decided in these pure helpers and unit-tested here against fixtures — no spawning, no
 *   shelling out.
 *
 *   These assert the GLUE (which lib fn fires for which input, and how the results compose) — the derivations
 *   themselves are proved in `scripts/lib/__tests__/review-core.test.mjs`; we only pin that the CLI wires them.
 */
import { describe, it, expect } from 'vitest';
import { parseFlags, reduceReview, buildMandateText, buildComment } from '../review-core-cli.mjs';
import {
  VERDICTS,
  NEGOTIATION_OUTCOMES,
  PLAN_OUTCOMES,
  MANDATORY_LENSES,
  PANEL_LENSES,
} from '../lib/review-core.mjs';

describe('parseFlags', () => {
  it('parses --k=v pairs and bare --flag booleans, ignoring positionals', () => {
    expect(parseFlags(['reduce', '--file=x.json', '--json', '--round=2'])).toEqual({
      file: 'x.json',
      json: true,
      round: '2',
    });
  });

  it('returns an empty object for no flags', () => {
    expect(parseFlags([])).toEqual({});
  });
});

describe('reduceReview — findings → verdict (single-reviewer path)', () => {
  it('an outstanding finding (no outcome) → changes', () => {
    const r = reduceReview({ findings: [{ summary: 'off-by-one in retry' }] });
    expect(r.verdict).toBe(VERDICTS.CHANGES);
    expect(r.findingsCount).toBe(1);
    expect(r.findings).toEqual([{ summary: 'off-by-one in retry' }]);
  });

  it('no findings → accept, and an empty normalized list', () => {
    const r = reduceReview({ findings: [] });
    expect(r.verdict).toBe(VERDICTS.ACCEPT);
    expect(r.findingsCount).toBe(0);
    expect(r.verdictTable).toBeUndefined();
  });

  it('humanRequired always wins over clean findings', () => {
    const r = reduceReview({ findings: [], humanRequired: true });
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('a resolved finding (outcome: fixed) no longer outstands → accept', () => {
    const r = reduceReview({ findings: [{ summary: 'x', outcome: 'fixed' }] });
    expect(r.verdict).toBe(VERDICTS.ACCEPT);
  });

  it('drops malformed findings via normalizeFindings (no summary → dropped)', () => {
    const r = reduceReview({ findings: [{ nope: 1 }, { summary: 'real' }] });
    expect(r.findingsCount).toBe(1);
  });
});

describe('reduceReview — panel reduction (per-lens verdicts)', () => {
  it('unanimous mandatory-lens accept → accept, and renders the verdict table', () => {
    const lensVerdicts = {
      correctness: 'accept',
      security: 'accept',
      simplicity: 'changes',
      'standards-conformance': 'accept',
    };
    const r = reduceReview({ lensVerdicts });
    expect(r.verdict).toBe(VERDICTS.ACCEPT); // advisory `simplicity: changes` never blocks
    expect(r.verdictTable).toContain('| lens | weight | verdict |');
    expect(r.verdictTable).toContain('| correctness | mandatory | accept |');
    expect(r.verdictTable).toContain('| simplicity | advisory | changes |');
  });

  it('a mandatory lens wanting changes → changes', () => {
    const r = reduceReview({ lensVerdicts: { correctness: 'changes', security: 'accept' } });
    expect(r.verdict).toBe(VERDICTS.CHANGES);
  });

  it('an explicit conflict → needs-human', () => {
    const r = reduceReview({ lensVerdicts: { correctness: 'accept', security: 'accept' }, conflict: true });
    expect(r.verdict).toBe(VERDICTS.NEEDS_HUMAN);
  });

  it('honors a custom mandatoryLenses set', () => {
    const r = reduceReview({
      lensVerdicts: { correctness: 'accept', security: 'changes' },
      mandatoryLenses: ['correctness'],
    });
    expect(r.verdict).toBe(VERDICTS.ACCEPT); // security not mandatory here
  });

  it('propagates a missing-mandatory-verdict error from the pure derivation', () => {
    expect(() => reduceReview({ lensVerdicts: { correctness: 'accept' } })).toThrow(/missing verdict/);
  });
});

describe('reduceReview — disposition (escalation reasons)', () => {
  it('a bare gate-self reason → converge, no auto-land', () => {
    const r = reduceReview({ reason: 'gate-self' });
    expect(r.disposition).toEqual({ mode: 'converge', autoLand: false });
  });

  it('a decorated blast-radius reason → converge, auto-land', () => {
    const r = reduceReview({ reasons: ['blast-radius (a.mjs, b.mjs)'] });
    expect(r.disposition).toEqual({ mode: 'converge', autoLand: true });
  });

  it('a deadlock reason (non-convergence) → human, no auto-land', () => {
    const r = reduceReview({ reasons: ['non-convergence'] });
    expect(r.disposition).toEqual({ mode: 'human', autoLand: false });
  });

  it('omits disposition entirely when no reason is supplied', () => {
    const r = reduceReview({ findings: [] });
    expect(r.disposition).toBeUndefined();
  });

  it('propagates an unknown-reason error from the pure derivation', () => {
    expect(() => reduceReview({ reason: 'not-a-real-reason' })).toThrow(/unknown reason/);
  });

  it('#2567 — also carries the advisory careLevel + rigor from the reason set', () => {
    const r = reduceReview({ reasons: ['blast-radius (a.mjs, b.mjs)'] });
    expect(r.careLevel).toBe('elevated');
    expect(r.rigor.rounds).toBe(2);
    expect(r.rigor.aggregation).toBe('diversity-selection');
  });

  it('#2567 — omits careLevel/rigor entirely when no reason is supplied', () => {
    const r = reduceReview({ findings: [] });
    expect(r.careLevel).toBeUndefined();
    expect(r.rigor).toBeUndefined();
  });
});

describe('reduceReview — negotiation / plan outcome', () => {
  it('changes + round < cap → continue (negotiation, the default phase)', () => {
    const r = reduceReview({ findings: [{ summary: 'x' }], round: 2, roundCap: 5 });
    expect(r.verdict).toBe(VERDICTS.CHANGES);
    expect(r.outcome).toBe(NEGOTIATION_OUTCOMES.CONTINUE);
  });

  it('accept + a round → land (negotiation)', () => {
    const r = reduceReview({ findings: [], round: 1 });
    expect(r.outcome).toBe(NEGOTIATION_OUTCOMES.LAND);
  });

  it('changes + round >= cap → escalate (negotiation)', () => {
    const r = reduceReview({ findings: [{ summary: 'x' }], round: 5, roundCap: 5 });
    expect(r.outcome).toBe(NEGOTIATION_OUTCOMES.ESCALATE);
  });

  it('phase: plan derives the plan-handshake outcome (accept → agreed)', () => {
    const r = reduceReview({ findings: [], round: 1, phase: 'plan' });
    expect(r.outcome).toBe(PLAN_OUTCOMES.AGREED);
  });

  it('omits outcome when no round is supplied', () => {
    const r = reduceReview({ findings: [] });
    expect(r.outcome).toBeUndefined();
  });
});

describe('buildMandateText', () => {
  it('kind lens → the panel reviewer mandate for that lens', () => {
    const text = buildMandateText({ kind: 'lens', lens: MANDATORY_LENSES[0] });
    expect(text).toContain('mandate reviewers');
    expect(text).toContain(PANEL_LENSES.join(', '));
  });

  it('kind validator → the independent-validator mandate', () => {
    const text = buildMandateText({ kind: 'validator', lens: 'security' });
    expect(text).toContain('INDEPENDENT FINAL VALIDATOR');
  });

  it('kind editor → the editor-round mandate carrying the findings', () => {
    const text = buildMandateText({
      kind: 'editor',
      findings: [{ file: 'a.mjs', summary: 'off-by-one' }],
      round: 2,
      roundCap: 5,
    });
    expect(text).toContain('round 2/5');
    expect(text).toContain('a.mjs: off-by-one');
  });

  it('an unknown lens propagates the lib error', () => {
    expect(() => buildMandateText({ kind: 'lens', lens: 'bogus' })).toThrow(/unknown lens/);
  });

  it('an unknown kind throws', () => {
    expect(() => buildMandateText({ kind: 'nope' })).toThrow(/unknown mandate kind/);
  });
});

describe('buildComment — the comment subcommand glue (renders via renderPanelComment)', () => {
  it('renders the supplied verdict + disposition + findings', () => {
    const md = buildComment({
      verdict: VERDICTS.CHANGES,
      disposition: { mode: 'converge', autoLand: true },
      findings: [{ summary: 'off-by-one', category: 'correctness' }],
    });
    expect(md).toContain('## PR review');
    expect(md).toContain('changes requested');
    expect(md).toContain('off-by-one');
  });

  it('DERIVES the verdict from findings when none is supplied (matches reduce)', () => {
    const clean = buildComment({ findings: [] });
    expect(clean).toContain('✅ pass');
    const dirty = buildComment({ findings: [{ summary: 'a real bug' }] });
    expect(dirty).toContain('changes requested');
  });

  it('DERIVES the disposition from a reason set when none is supplied', () => {
    const md = buildComment({ findings: [{ summary: 'x' }], reasons: ['gate-self'] });
    // gate-self → converge, autoLand:false → "a human must still clear it"
    expect(md).toContain('a human must still clear it');
  });

  it('leaves the disposition line off when neither disposition nor reasons are supplied', () => {
    const md = buildComment({ findings: [] });
    expect(md).not.toContain('**Disposition:**');
  });
});
