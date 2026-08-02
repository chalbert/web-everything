import { describe, it, expect } from 'vitest';
import { checkVerdictTotality, VERDICT_TOTAL_MARKER } from '../verdict-totality.mjs';
import { VERDICTS } from '../jury-core.mjs';

// A SYNTHETIC enum proves the gate derives its member set from the passed VERDICTS object — never a hardcoded list.
const SYN = Object.freeze({ A: 'aa', B: 'bb', C: 'cc' });
const doc = (content) => [{ file: 'fixture.mjs', content }];
const run = (content, verdicts = SYN) => checkVerdictTotality(doc(content), verdicts);

describe('checkVerdictTotality — TOTALITY of a marked structure (#2823 xiqj3w9)', () => {
  it('passes an object literal + a branch reducer that each handle EVERY member', () => {
    const src = `
/** a strictness table.
 *  @verdicts-total */
export const TABLE = Object.freeze({ aa: 0, bb: 1, cc: 2 });

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
export const TABLE = Object.freeze({ aa: 0, bb: 1 });
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
export const GLYPHS = Object.freeze({ aa: 'x', cc: 'z' });
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
/** @verdicts-total fallthrough=cc */
export function reduce(v) {
  if (v === VERDICTS.A) return 1;
  if (v === VERDICTS.B) return 2;
  return 0; // cc is the documented default
}
`;
    expect(run(src).errors).toEqual([]);
  });

  it('a fallthrough does NOT excuse a DIFFERENT missing member (a new member still cannot ride it)', () => {
    // A 4-member enum: A + B explicit, dd the documented fallthrough, cc neither → still an error. This IS the
    // round-3 shape (prevention-outstanding was neither explicit nor the intended `changes` fall-through).
    const SYN4 = Object.freeze({ A: 'aa', B: 'bb', C: 'cc', D: 'dd' });
    const src = `
/** @verdicts-total fallthrough=dd */
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
/** @verdicts-total fallthrough=bb,cc */
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
export const TABLE = Object.freeze({ aa: 0, bb: 1, cc: 2 });
`;
    expect(run(src, SYN).errors).toEqual([]);
    // Grow the enum — the SAME source is now missing the new member, proving coverage tracks the enum, not a list.
    const GROWN = Object.freeze({ ...SYN, D: 'dd' });
    expect(run(src, GROWN).errors.some((e) => e.includes('TABLE') && e.includes('dd'))).toBe(true);
  });

  it('the REAL repo VERDICTS enum has the expected four members (guards the gate against an enum rename)', () => {
    expect(new Set(Object.values(VERDICTS))).toEqual(new Set(['accept', 'changes', 'needs-human', 'prevention-outstanding']));
    expect(VERDICT_TOTAL_MARKER).toBe('@verdicts-total');
  });
});
