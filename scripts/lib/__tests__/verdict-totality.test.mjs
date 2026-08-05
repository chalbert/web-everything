import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVerdictTotality, VERDICT_TOTAL_MARKER, IMPACT_ENROLMENT } from '../verdict-totality.mjs';
import { VERDICTS, IMPACT_LEVELS } from '../jury-core.mjs';

// A SYNTHETIC enum proves the gate derives its member set from the passed VERDICTS object — never a hardcoded list.
const SYN = Object.freeze({ A: 'aa-x', B: 'bb-x', C: 'cc-x' });
const SYN2 = Object.freeze({ A: 'aa-x', B: 'bb-x' });
const doc = (content) => [{ file: 'fixture.mjs', content }];
const run = (content, verdicts = SYN) => checkVerdictTotality(doc(content), verdicts);

describe('checkVerdictTotality — TOTALITY of a marked structure (#2823 xiqj3w9)', () => {
  it('passes an object literal + a branch reducer that each handle EVERY member', () => {
    const src = `
/** a strictness table.
 *  @verdicts-total */
export const TABLE = Object.freeze({ 'aa-x': 0, 'bb-x': 1, 'cc-x': 2 });

/** a reducer.
 *  @verdicts-total */
export function reduce(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  if (v === VERDICTS.C) return 3;
  return 0;
}
`;
    expect(run(src).errors).toEqual([]);
  });

  it('ERRORS when a member is removed from a covered OBJECT-LITERAL table, naming the member + symbol', () => {
    const src = `
/** @verdicts-total */
export const TABLE = Object.freeze({ 'aa-x': 0, 'bb-x': 1 });
export function reduce(v) { if (v === VERDICTS.A) return 1; if (v === VERDICTS.B) return 2; if (v === VERDICTS.C) return 3; return 0; }
`;
    const { errors } = run(src);
    // TABLE is missing cc; reduce is unmarked (a second, separate error).
    const tableErr = errors.find((e) => e.includes('TABLE'));
    expect(tableErr).toBeDefined();
    expect(tableErr).toMatch(/not total/i);
    expect(tableErr).toContain('cc');
  });

  it('ERRORS when a member is dropped from a covered BRANCH reducer (marked, no fallthrough)', () => {
    const src = `
/** @verdicts-total */
export function reduce(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  return 0; // C silently rides this fall-through — the defect
}
`;
    const { errors } = run(src);
    expect(errors.some((e) => e.includes('reduce') && e.includes('cc'))).toBe(true);
  });
});

describe('checkVerdictTotality — DISCOVERY (coverage derived, not a hand list)', () => {
  it('ERRORS on an UNANNOTATED verdict consumer — the miss the gate exists to catch', () => {
    const src = `
export function sneaky(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  return 0;
}
`;
    const { errors } = run(src);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/no `@verdicts-total` marker/);
    expect(errors[0]).toContain('sneaky');
  });

  it('catches a NEW verdict-keyed table added PARTIAL — the discovery, not a listed table, fails it', () => {
    // A brand-new table nobody added to any hand list. Marked total but missing a member → flagged by the scan.
    const src = `
/** a freshly-introduced glyph map.
 *  @verdicts-total */
export const GLYPHS = Object.freeze({ 'aa-x': 'x', 'cc-x': 'z' });
`;
    const { errors } = run(src);
    expect(errors.some((e) => e.includes('GLYPHS') && e.includes('bb'))).toBe(true);
  });

  it('a symbol referencing FEWER than two verdicts is not a consumer — never flagged', () => {
    const src = `
export function onlyOne(v) { return v === VERDICTS.A ? 1 : 0; }
`;
    expect(run(src).errors).toEqual([]);
  });
});

describe('checkVerdictTotality — the documented fall-through exemption', () => {
  it('a single documented `fallthrough=` member is exempt; every OTHER member must be explicit', () => {
    const src = `
/** @verdicts-total fallthrough=cc-x */
export function reduce(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  return 0; // cc-x is the documented default
}
`;
    expect(run(src).errors).toEqual([]);
  });

  it('a fallthrough does NOT excuse a DIFFERENT missing member (a new member still cannot ride it)', () => {
    // A 4-member enum: A + B explicit, dd the documented fallthrough, cc neither → still an error. This IS the
    // round-3 shape (prevention-outstanding was neither explicit nor the intended `changes` fall-through).
    const SYN4 = Object.freeze({ A: 'aa-x', B: 'bb-x', C: 'cc-x', D: 'dd-x' });
    const src = `
/** @verdicts-total fallthrough=dd-x */
export function reduce(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  return 0;
}
`;
    const { errors } = run(src, SYN4);
    expect(errors.some((e) => e.includes('reduce') && e.includes('cc'))).toBe(true);
  });

  it('rejects MORE than one fallthrough member — the exemption can not list away a real miss', () => {
    const src = `
/** @verdicts-total fallthrough=bb-x,cc-x */
export function reduce(v) { if (v === VERDICTS.A) return 1; if (v === VERDICTS.B) return 2; return 0; }
`;
    expect(run(src).errors.some((e) => e.includes('more than one'))).toBe(true);
  });
});

describe('checkVerdictTotality — the @verdicts-partial opt-out', () => {
  it('accepts a documented intentional partial (has a reason)', () => {
    const src = `
/** keyed only on A vs B for rendering.
 *  @verdicts-partial renderer keyed on A/B distinction only, not a totality structure */
export function render(v) { return v === VERDICTS.A ? 'a' : (v === VERDICTS.B ? 'b' : ''); }
`;
    expect(run(src).errors).toEqual([]);
  });

  it('rejects a BARE @verdicts-partial with no reason', () => {
    const src = `
/** @verdicts-partial */
export function render(v) { return v === VERDICTS.A ? 'a' : (v === VERDICTS.B ? 'b' : ''); }
`;
    expect(run(src).errors.some((e) => e.includes('bare') && e.includes('reason'))).toBe(true);
  });
});

describe('checkVerdictTotality — DERIVES its member set from the enum', () => {
  it('a table total over a 3-member enum becomes NON-total the moment the enum grows a 4th member', () => {
    const src = `
/** @verdicts-total */
export const TABLE = Object.freeze({ 'aa-x': 0, 'bb-x': 1, 'cc-x': 2 });
`;
    expect(run(src, SYN).errors).toEqual([]);
    // Grow the enum — the SAME source is now missing the new member, proving coverage tracks the enum, not a list.
    const GROWN = Object.freeze({ ...SYN, D: 'dd-x' });
    expect(run(src, GROWN).errors.some((e) => e.includes('TABLE') && e.includes('dd'))).toBe(true);
  });

  it('the REAL repo VERDICTS enum has the expected four members (guards the gate against an enum rename)', () => {
    expect(new Set(Object.values(VERDICTS))).toEqual(new Set(['accept', 'changes', 'needs-human', 'prevention-outstanding']));
    expect(VERDICT_TOTAL_MARKER).toBe('@verdicts-total');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #xdompzx review, finding 5 — a SECOND ENUM enrols in the same discovery machinery. `IMPACT_LEVELS` /
// `IMPACT_STRICTNESS` / `IMPACT_GLOSS` (jury-core) reproduces the enum+rank-table shape this gate exists for; it
// was originally covered only by a module-load loop local to jury-core that knew the two tables it was written
// next to. These prove the enrolment is real: the symbol name and the marker pair are parameters, not constants.
// ─────────────────────────────────────────────────────────────────────────────
describe('checkVerdictTotality — a second enum enrols via { enumSymbol, totalMarker, partialMarker }', () => {
  const SRC = `
/** the rank table.
 *  @impact-total */
export const IMPACT_STRICTNESS = frozenLookup({
  [IMPACT_LEVELS.A]: 0,
  [IMPACT_LEVELS.B]: 1,
});

/** an UNANNOTATED second structure total over the same enum — the drift this gate exists to catch. */
export const IMPACT_GLYPHS = frozenLookup({
  [IMPACT_LEVELS.A]: '·',
  [IMPACT_LEVELS.B]: '!',
});
`;

  it('checks the enrolled enum under ITS marker, and flags an unannotated consumer of it', () => {
    const { errors } = checkVerdictTotality(doc(SRC), SYN2, IMPACT_ENROLMENT);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('IMPACT_GLYPHS');
    expect(errors[0]).toContain('@impact-total');
    expect(errors[0]).toContain('IMPACT_LEVELS');
  });

  it('ERRORS when a marked structure is not total over the enrolled enum', () => {
    const partial = `
/** @impact-total */
export const IMPACT_STRICTNESS = frozenLookup({ [IMPACT_LEVELS.A]: 0, [IMPACT_LEVELS.B]: 1 });
`;
    const THREE = Object.freeze({ A: 'aa', B: 'bb', C: 'cc' });
    const { errors } = checkVerdictTotality(doc(partial), THREE, IMPACT_ENROLMENT);
    expect(errors.some((e) => e.includes('IMPACT_STRICTNESS') && e.includes('cc'))).toBe(true);
  });

  it('does NOT confuse the two enrolments — a VERDICTS pass ignores an @impact-total-only consumer', () => {
    expect(checkVerdictTotality(doc(SRC), SYN2).errors).toEqual([]);
  });

  it('the REAL IMPACT_LEVELS tables in jury-core are total and annotated', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'jury-core.mjs'), 'utf8');
    const { errors, sites } = checkVerdictTotality([{ file: 'jury-core.mjs', content: src }], IMPACT_LEVELS, IMPACT_ENROLMENT);
    expect(errors).toEqual([]);
    expect(sites.map((s) => s.symbol).sort()).toEqual(['IMPACT_GLOSS', 'IMPACT_STRICTNESS']);
  });
});

// ── round-2 finding 3 — THE OBJECT-KEY MATCHER MUST NOT GRAB GENERIC ENGLISH WORDS. ────────────────────
// Enum values here are ordinary status words (`accept`, `broken`, `degraded`). Matching those in bare key position
// across all of `scripts/` + `skills-src/` turns any unrelated `const HEALTH = { ok, degraded, broken }` into a
// nonsense totality error, and the author's cheapest escape is to silence an unrelated gate with a bogus
// `@impact-partial`. So a generic (hyphen-free) member is matched in bare key position ONLY when the span itself
// names the enum symbol; otherwise it needs a symbolic `ENUM.MEMBER` reference, which is what a real consumer
// writes anyway. Hyphenated members stay matchable — no unrelated literal spells `needs-human` by accident.
describe('checkVerdictTotality — the key matcher only grabs DISTINCTIVE values (finding 3)', () => {
  const GENERIC = Object.freeze({ A: 'degraded', B: 'broken', C: 'cosmetic' });

  it('an UNRELATED table whose keys happen to be generic enum words is NOT discovered', () => {
    const src = `
export const HEALTH = Object.freeze({ ok: 0, degraded: 1, broken: 2 });
`;
    const { errors, sites } = checkVerdictTotality(doc(src), GENERIC, IMPACT_ENROLMENT);
    expect(errors).toEqual([]);
    expect(sites).toEqual([]);
  });

  it('the same table IS discovered once the span names the enum symbol — deliberate co-location', () => {
    const src = `
export const HEALTH = Object.freeze({ ok: 0, degraded: 1, broken: 2, note: IMPACT_LEVELS });
`;
    const { errors } = checkVerdictTotality(doc(src), GENERIC, IMPACT_ENROLMENT);
    expect(errors.some((e) => e.includes('HEALTH') && e.includes('@impact-total'))).toBe(true);
  });

  it('a real consumer using SYMBOLIC refs is discovered regardless of how generic the values are', () => {
    const src = `
export const RANKS = frozenLookup({ [IMPACT_LEVELS.A]: 0, [IMPACT_LEVELS.B]: 1 });
`;
    const { errors } = checkVerdictTotality(doc(src), GENERIC, IMPACT_ENROLMENT);
    expect(errors.some((e) => e.includes('RANKS') && e.includes('@impact-total'))).toBe(true);
  });

  it('HYPHENATED members are still matched in bare key position — no unrelated literal spells them', () => {
    const src = `
/** @verdicts-total */
export const T = Object.freeze({ 'needs-human': 1, 'prevention-outstanding': 2 });
`;
    // Both hyphenated members are found by the key matcher; the two generic ones are simply missing → not total.
    const { errors, sites } = checkVerdictTotality(doc(src), VERDICTS);
    expect(sites).toHaveLength(1);
    expect(errors.some((e) => /NOT total/i.test(e) && e.includes('accept') && e.includes('changes'))).toBe(true);
  });
});
