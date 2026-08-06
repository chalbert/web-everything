import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVerdictTotality, VERDICT_TOTAL_MARKER, IMPACT_ENROLMENT } from '../verdict-totality.mjs';
import { VERDICTS, IMPACT_LEVELS } from '../jury-core.mjs';

// A SYNTHETIC enum proves the gate derives its member set from the passed VERDICTS object — never a hardcoded list.
const SYN = Object.freeze({ A: 'aa', B: 'bb', C: 'cc' });
const SYN2 = Object.freeze({ A: 'aa', B: 'bb' });
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

// ── round-2 finding 3, RE-SITED in round 5 — BARE-KEY DISCOVERY IS A PER-ENROLMENT DIAL. ──────────────
// The concern is real: an enum of ordinary English words (`broken`, `degraded`, `cosmetic`) matched in bare key
// position across all of `scripts/` + `skills-src/` turns any unrelated `const HEALTH = { ok, degraded, broken }`
// into a nonsense totality error, whose cheapest escape is a bogus `@impact-partial` on innocent code.
//
// Round 3 implemented that as a PER-VALUE filter on the SHARED matcher (skip hyphen-free values unless the span
// names the enum) and broke the incumbent `VERDICTS` gate three ways — see `keyRefsEnabled`'s doc for the full
// autopsy. It is now a PER-ENROLMENT, ALL-OR-NOTHING-PER-SPAN flag: `genericKeysNeedSymbol`. `VERDICTS` does NOT
// set it (unrestricted, exactly as on main); `IMPACT_ENROLMENT` does, and pays for it in the blindness pinned
// below. The regression fixtures at the end of this file are what stop round 3 from happening again.
describe('checkVerdictTotality — bare-key discovery is a per-ENROLMENT dial (round-2 finding 3, round-5 re-site)', () => {
  const GENERIC = Object.freeze({ A: 'degraded', B: 'broken', C: 'cosmetic' });

  it('an UNRELATED table whose keys happen to be generic enum words is NOT discovered under IMPACT_ENROLMENT', () => {
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

  it('the flag is a property of the ENROLMENT, not of a value — the SAME table IS discovered under VERDICTS rules', () => {
    // Identical source, identical member set; only the enrolment differs. Under the default (unrestricted)
    // enrolment the bare keys count, so the table is a consumer. This is the assertion round 3 could not have made.
    const src = `
export const HEALTH = Object.freeze({ ok: 0, degraded: 1, broken: 2 });
`;
    const { errors } = checkVerdictTotality(doc(src), GENERIC, { enumSymbol: 'GENERIC' });
    expect(errors.some((e) => e.includes('HEALTH') && e.includes('@verdicts-total'))).toBe(true);
  });

  it('HYPHENATED members are matched in bare key position — a genuinely partial table is still caught', () => {
    const src = `
/** @verdicts-total */
export const T = Object.freeze({ 'needs-human': 1, 'prevention-outstanding': 2 });
`;
    // accept + changes are genuinely absent from the source — this really is not total.
    const { errors, sites } = checkVerdictTotality(doc(src), VERDICTS);
    expect(sites).toHaveLength(1);
    expect(errors.some((e) => /NOT total/i.test(e) && e.includes('accept') && e.includes('changes'))).toBe(true);
  });
});

// ══ ROUND-5 REGRESSION FIXTURES — the three defects round 3 shipped, one test each. ═══════════════════
// Round 3 restricted bare-key matching to hyphen-bearing values inside the SHARED matcher and renamed every
// synthetic fixture ('aa' → 'aa-x') so the suite stayed green. The renames are what HID the regression: with a
// hyphen in every fixture value there was no test left that exercised a generic bare key. These fixtures are
// deliberately generic and deliberately hyphen-free. If someone re-adds a per-value restriction to the shared
// matcher, (a) and (b) fail immediately.
describe('REGRESSION — the incumbent VERDICTS gate keeps its full bare-key reach (round-4 blocker, a + b)', () => {
  it('(a) an unannotated consumer using ONLY the two most GENERIC verdicts is still discovered', () => {
    // `accept` and `changes` are hyphen-free ordinary English words, and this span never names `VERDICTS`.
    // Round 3 made this exact source zero sites / zero errors. It is the post-#976 class the gate exists for.
    const src = `
export const DECISION_COPY = Object.freeze({ accept: 'ship it', changes: 'bounce it' });
`;
    const { errors, sites } = checkVerdictTotality(doc(src), VERDICTS);
    expect(sites).toHaveLength(1);
    expect(sites[0].symbol).toBe('DECISION_COPY');
    expect(sites[0].referenced.sort()).toEqual(['accept', 'changes']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no `@verdicts-total` marker/);
  });

  it('(b) a MIXED-SHAPE total table (generic + hyphenated bare keys) is total — no false "missing member"', () => {
    // The reference set must be collected ALL-OR-NOTHING per span. A per-value filter collected only the two
    // hyphenated members here, so this genuinely-total table errored `NOT total … missing [accept, changes]`,
    // and its only sanctioned escape was `@verdicts-partial` — permanently exempting a real consumer.
    const src = `
/** @verdicts-total */
export const T = Object.freeze({ accept: 1, changes: 2, 'needs-human': 3, 'prevention-outstanding': 4 });
`;
    const { errors, sites } = checkVerdictTotality(doc(src), VERDICTS);
    expect(errors).toEqual([]);
    expect(sites).toHaveLength(1);
    expect(sites[0].missing).toEqual([]);
    expect(sites[0].referenced.sort()).toEqual(Object.values(VERDICTS).sort());
  });

  it('(b) a member spelled bare, quoted or multi-line is not reported missing — the shapes the key pass reads', () => {
    // The structural property behind (b), over the three spellings the key pass actually reads: bare, quoted, and
    // the same two across lines. Guards against any future filter that could yield a partial reference set.
    // NOT covered here, and deliberately: computed/template-literal keys (`['accept']:`) are invisible to the
    // matcher — a pre-existing limit of its reach (see `keyRefsEnabled`), not a property this test claims.
    const shapes = [
      `Object.freeze({ accept: 1, changes: 2, 'needs-human': 3, 'prevention-outstanding': 4 })`,
      `Object.freeze({ 'accept': 1, 'changes': 2, 'needs-human': 3, 'prevention-outstanding': 4 })`,
      `Object.freeze({\n  accept: 1,\n  changes: 2,\n  'needs-human': 3,\n  'prevention-outstanding': 4,\n})`,
    ];
    for (const shape of shapes) {
      const { errors } = checkVerdictTotality(doc(`/** @verdicts-total */\nexport const T = ${shape};`), VERDICTS);
      expect(errors, `shape: ${shape}`).toEqual([]);
    }
  });
});

describe('REGRESSION — what the IMPACT_LEVELS enrolment does and does NOT see (round-4 blocker, c)', () => {
  it('(c) CHARACTERIZATION: a bare-key impact table that never names the enum is INVISIBLE — by choice', () => {
    // This is the acknowledged cost of `genericKeysNeedSymbol: true`. It is pinned, not hidden: every
    // `IMPACT_LEVELS` value is an ordinary English word, so the alternative (unrestricted bare keys) makes any
    // unrelated `{ ok, degraded, broken }` a false error. The coverage for the two NAMED tables is the module-load
    // totality assert in `jury-core.mjs`, asserted in `jury-core.test.mjs` — not this gate.
    const src = `
export const IMPACT_WEIGHTS = Object.freeze({ cosmetic: 0, degraded: 1, broken: 2, unrecoverable: 3 });
`;
    const { errors, sites } = checkVerdictTotality(doc(src), IMPACT_LEVELS, IMPACT_ENROLMENT);
    expect(errors).toEqual([]);
    expect(sites).toEqual([]);
  });

  it('(c) WHAT IT DOES BUY: a THIRD symbolic consumer — invisible to the module-load assert — IS discovered', () => {
    // The module-load loop checks IMPACT_STRICTNESS and IMPACT_GLOSS BY NAME. A new glyph table written the way
    // every real consumer in this repo writes one is caught only here, which is why the enrolment is kept.
    const src = `
export const IMPACT_GLYPHS = frozenLookup({
  [IMPACT_LEVELS.COSMETIC]: '·',
  [IMPACT_LEVELS.DEGRADED]: '!',
});
`;
    const { errors } = checkVerdictTotality(doc(src), IMPACT_LEVELS, IMPACT_ENROLMENT);
    expect(errors.some((e) => e.includes('IMPACT_GLYPHS') && e.includes('@impact-total'))).toBe(true);
  });

  it('(c) and a marked-total third consumer that DROPS a level is caught as non-total', () => {
    const src = `
/** @impact-total */
export const IMPACT_GLYPHS = frozenLookup({
  [IMPACT_LEVELS.COSMETIC]: '·',
  [IMPACT_LEVELS.DEGRADED]: '!',
  [IMPACT_LEVELS.BROKEN]: '✗',
});
`;
    const { errors } = checkVerdictTotality(doc(src), IMPACT_LEVELS, IMPACT_ENROLMENT);
    expect(errors.some((e) => e.includes('IMPACT_GLYPHS') && e.includes('unrecoverable'))).toBe(true);
  });
});
