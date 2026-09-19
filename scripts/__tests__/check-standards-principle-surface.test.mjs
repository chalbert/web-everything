/**
 * @file check-standards-principle-surface.test.mjs — #2892's two check:standards floors for the #2840 principle
 * surface: the LEASH PIN (`validateLeashPin`) and the MARKER PINS (`validateMarkedInvariants`).
 *
 * Both rules run against the LIVE gate here (the same wiring check-standards.mjs uses) and against deliberately
 * broken gates, so the test proves each rule both passes today and actually catches the regression it exists for.
 * Marker lines are spelled with `%` for `@` (see `mk`) so this file carries no real marker.
 */
import { describe, it, expect } from 'vitest';
import { validateLeashPin, validateMarkedInvariants } from '../check-standards-rules.mjs';
import * as gate from '../lib/gate-config.mjs';
import { scoreEscalation, producerReviewLabel, REVIEW_LABELS } from '../lib/review-escalation.mjs';

const mk = (s) => s.replace(/%/g, '@');
const LIVE = {
  floor: gate.RATIFIED_POLICY_SPEC_FLOOR,
  specBasenames: gate.POLICY_SPEC_BASENAMES,
  trustChain: gate.TRUST_CHAIN,
  isPrincipleSurface: gate.isPrincipleSurface,
  scoreEscalation,
  producerReviewLabel,
  humanLabel: REVIEW_LABELS.human,
};

describe('validateLeashPin — no declarative-leash file ever leaves the human gate (#2840 trigger 3, #2838)', () => {
  it('is green on the live gate', () => {
    expect(validateLeashPin(LIVE)).toEqual([]);
  });
  it('catches a ratified floor file that was reclassified out of the leash set', () => {
    const specBasenames = new Set([...gate.POLICY_SPEC_BASENAMES].filter((b) => b !== 'review-policy.contract.json'));
    const out = validateLeashPin({ ...LIVE, specBasenames });
    expect(out.some((m) => m.includes('`review-policy.contract.json` is in RATIFIED_POLICY_SPEC_FLOOR'))).toBe(true);
  });
  it('catches a composition that content-gates the leash (e.g. drops the path floor for whitespace-only diffs)', () => {
    const contentGated = (f, d) => (typeof d === 'string' && /-a {2}b\n\+a b/.test(d) ? false : gate.isPrincipleSurface(f, d));
    const out = validateLeashPin({ ...LIVE, isPrincipleSurface: contentGated });
    expect(out.some((m) => /is not a principle surface for a whitespace-only diff/.test(m))).toBe(true);
  });
  it('catches a scorer that stops routing a leash file to review:human, even when the predicate still fires', () => {
    const leakyScorer = (o) => ({ ...scoreEscalation(o), humanRequired: false });
    const out = validateLeashPin({ ...LIVE, scoreEscalation: leakyScorer });
    expect(out.some((m) => m.includes('review-policy.contract.json') && m.includes('does not route'))).toBe(true);
  });
});

describe('validateMarkedInvariants — every marked block is pinned to its body', () => {
  const grammar = { parseMarkedBlocks: gate.parseMarkedBlocks, markerBlockPin: gate.markerBlockPin };
  const body = ['it("never applies", () => {', '  expect(plan.apply).toBe(false);', '});'];
  const file = (pin, lines = body, id = 'keep') => [mk(`// %invariant ${id} pin:${pin}`), ...lines, mk(`// %end-invariant ${id}`)].join('\n');
  const good = gate.markerBlockPin(body);

  it('a correctly pinned block is green; a reformat needs no re-pin', () => {
    expect(validateMarkedInvariants([{ file: 'a.test.mjs', content: file(good) }], grammar)).toEqual([]);
    const reformatted = body.map((l) => `    ${l.replace(/ /g, '  ')}`);
    expect(validateMarkedInvariants([{ file: 'a.test.mjs', content: file(good, reformatted) }], grammar)).toEqual([]);
  });
  it('a body edit WITHOUT a re-pin is an error naming the expected pin — the half of the design the scorer relies on', () => {
    const weakened = body.map((l) => l.replace('toBe(false)', 'toBe(true)'));
    const out = validateMarkedInvariants([{ file: 'a.test.mjs', content: file(good, weakened) }], grammar);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ file: 'a.test.mjs', line: 1 });
    expect(out[0].message).toContain(`expected pin:${gate.markerBlockPin(weakened)}`);
    // …and the scorer indeed cannot see that edit from a 3-line-context hunk in the middle of the block, which is
    // exactly why this rule must fail it.
    const hunk = 'diff --git a/a.test.mjs b/a.test.mjs\n--- a/a.test.mjs\n+++ b/a.test.mjs\n@@ -3 +3 @@\n-  expect(plan.apply).toBe(false);\n+  expect(plan.apply).toBe(true);\n';
    expect(gate.isMarkedInvariantEdit('a.test.mjs', hunk)).toBe(false);
  });
  it('surfaces structural problems with their line', () => {
    const out = validateMarkedInvariants([{ file: 'b.mjs', content: mk('x\n// %invariant oops') }], grammar);
    expect(out).toEqual([{ file: 'b.mjs', line: 2, message: expect.stringMatching(/malformed/) }]);
  });
  it('rejects one id used in two files', () => {
    const out = validateMarkedInvariants([{ file: 'a.mjs', content: file(good) }, { file: 'b.mjs', content: file(good) }], grammar);
    expect(out).toEqual([{ file: 'b.mjs', line: 1, message: expect.stringContaining('already used at a.mjs:1') }]);
  });
});
