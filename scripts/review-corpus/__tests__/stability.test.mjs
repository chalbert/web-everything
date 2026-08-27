import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentTokens,
  dice,
  sameFinding,
  overlap,
  repeatPairs,
  scorePair,
  summarisePairs,
  missedOnUnchangedInput,
  replayDeterminism,
  loadCases,
  parseArgs,
  MATCHERS,
} from '../stability.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = resolve(HERE, '..', 'cases');
const SOURCE = readFileSync(resolve(HERE, '..', 'stability.mjs'), 'utf8');

const f = (over = {}) => ({ path: 'backlog/a.md', line: 10, category: 'correctness', summary: 'x', ...over });

/* ------------------------------------------------------------------ the comparison itself */

describe('#3310 churn comparison — survives rewording, not just prose-diffing', () => {
  it('matches one defect described twice in different words', () => {
    // Both sentences are about the same real finding recorded on PR #1556 r6. Every connective word
    // differs; the identifiers, the card id and the numbers do not. That is what the matcher keys on.
    const original = 'Card #3233 cites two current-state line numbers for review-prep.mjs that are each off by one from the actual file.';
    const reworded = 'Two of the line citations for `review-prep.mjs` on card #3233 are each one off.';
    const sim = dice(contentTokens(original), contentTokens(reworded));
    expect(sim).toBeGreaterThan(0.6); // clears even the STRICT arm, on prose sharing no sentence structure
    expect(sameFinding(f({ line: null, summary: original }), f({ line: null, summary: reworded, category: 'other' }), {}))
      .toBe(true);
  });

  it('does not match two unrelated findings that happen to sit in one file', () => {
    const a = 'Card #3233 cites two current-state line numbers for review-prep.mjs that are off by one.';
    const b = 'The scope entry omits the Done-when file, so the gate cannot resolve it.';
    expect(dice(contentTokens(a), contentTokens(b))).toBe(0);
    // Different category, far-apart lines, no shared content — every arm of the defect matcher misses.
    expect(sameFinding(f({ line: 10, category: 'citation-accuracy', summary: a }), f({ line: 400, category: 'scope', summary: b }), {}))
      .toBe(false);
    // …but the locus matcher DOES pair them, which is exactly why it is reported as the under-reporting
    // bound rather than as the answer.
    expect(sameFinding(f({ line: 10, summary: a }), f({ line: 400, summary: b }), { mode: 'locus' })).toBe(true);
  });

  it('splits camelCase identifiers so a renamed mention still shares tokens', () => {
    // Regression: an earlier splitter rewrote `execFileSync` to "exec ile ync" — it ate a letter from
    // every part and dropped the joined form, so identifier agreement (the strongest signal there is)
    // scored near zero.
    const t = contentTokens('`execFileSync` throws when `assertWins` runs');
    expect(t.has('execfilesync')).toBe(true);
    expect(t.has('sync')).toBe(true);
    expect(t.has('assertwins')).toBe(true);
    expect(t.has('assert')).toBe(true);
    expect(t.has('wins')).toBe(true);
    expect(t.has('ile')).toBe(false);
  });

  it('drops review boilerplate so "the card says the line is wrong" is not evidence of anything', () => {
    expect([...contentTokens('The card says the line number is wrong')]).toEqual(['number']);
  });

  it('never matches across different files, at any strictness', () => {
    for (const mode of MATCHERS) {
      expect(sameFinding(f({ path: 'a.md' }), f({ path: 'b.md' }), { mode })).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ the churn arithmetic */

describe('#3310 overlap arithmetic', () => {
  it('scores an identical finding set as zero churn', () => {
    const list = [f({ line: 10 }), f({ path: 'backlog/b.md', line: 20 })];
    const o = overlap(list, list.map((x) => ({ ...x })), {});
    expect(o.intersection).toBe(2);
    expect(o.churn).toBe(0);
  });

  it('treats two runs that both found nothing as agreement, not as NaN', () => {
    const o = overlap([], [], {});
    expect(o.union).toBe(0);
    expect(o.jaccard).toBe(1);
    expect(o.churn).toBe(0);
  });

  it('scores a disjoint finding set as total churn', () => {
    const o = overlap([f({ path: 'a.md' })], [f({ path: 'b.md' })], {});
    expect(o.intersection).toBe(0);
    expect(o.union).toBe(2);
    expect(o.churn).toBe(1);
  });

  it('pairs each finding at most once', () => {
    // One run reports the defect once, the other reports it twice. Only ONE pair can be formed, so
    // the second copy is unmatched and counts as churn — the counterpart is not re-used to hide it.
    const a = [f({ summary: 'the same defect' })];
    const b = [f({ summary: 'the same defect' }), f({ summary: 'the same defect' })];
    const o = overlap(a, b, {});
    expect(o.intersection).toBe(1);
    expect(o.union).toBe(2); // 1 + 2 − 1
    expect(o.churn).toBe(0.5);
  });
});

/* ------------------------------------------------------------------ what a repeatable run is */

describe('#3310 a repeatable run is a recorded round pair on one head sha', () => {
  const round = (pr, r, head, findings = [], decision = 'changes') => ({ pr, round: r, head, decision, findings, missedHere: [] });

  it('pairs only ADJACENT rounds that share a head', () => {
    const pairs = repeatPairs([
      round(1, 1, 'aaa'), round(1, 2, 'aaa'), round(1, 3, 'bbb'),
      round(2, 1, 'ccc'), round(2, 2, 'ddd'),
    ]);
    expect(pairs.map((p) => [p.pr, p.a.round, p.b.round])).toEqual([[1, 1, 2]]);
  });

  it('ignores rounds whose input changed — a different head is not a repeat', () => {
    expect(repeatPairs([round(1, 1, 'aaa'), round(1, 2, 'bbb')])).toHaveLength(0);
  });

  it('reports a verdict flip on identical input', () => {
    const s = scorePair({ pr: 9, head: 'aaa', a: round(9, 1, 'aaa', [], 'accept'), b: round(9, 2, 'aaa', [], 'changes') }, {});
    expect(s.verdictFlipped).toBe(true);
    // The finding sets agreed (both empty) and the ANSWER still changed — the two are measured apart
    // for exactly this reason.
    expect(s.per.defect.churn).toBe(0);
  });

  it('brackets every pair: locus churn <= defect churn <= strict churn', () => {
    const a = round(1, 1, 'aaa', [f({ line: 10, category: 'x', summary: 'alpha beta gamma delta' })]);
    const b = round(1, 2, 'aaa', [f({ line: 300, category: 'y', summary: 'epsilon zeta eta theta' })]);
    const s = scorePair({ pr: 1, head: 'aaa', a, b }, {});
    expect(s.per.locus.churn).toBeLessThanOrEqual(s.per.defect.churn);
    expect(s.per.defect.churn).toBeLessThanOrEqual(s.per.strict.churn);
  });
});

/* ------------------------------------------------------------------ against the real corpus */

describe('#3310 a real figure comes off the real corpus', () => {
  const cases = loadCases(CASES);
  const scored = repeatPairs(cases).map((p) => scorePair(p, {}));
  const summary = summarisePairs(scored);

  it('finds recorded live repeats to measure', () => {
    expect(cases.length).toBeGreaterThan(50);
    expect(summary.pairs).toBeGreaterThan(0);
    expect(summary.pooledFindings).toBeGreaterThan(0);
  });

  it('produces a churn rate in range under every matcher, bracketed by the loose and strict arms', () => {
    for (const m of MATCHERS) {
      expect(summary.per[m].microChurn).toBeGreaterThanOrEqual(0);
      expect(summary.per[m].microChurn).toBeLessThanOrEqual(1);
    }
    expect(summary.per.locus.microChurn).toBeLessThanOrEqual(summary.per.defect.microChurn);
    expect(summary.per.defect.microChurn).toBeLessThanOrEqual(summary.per.strict.microChurn);
  });

  it('reports the verdict flip rate separately from the finding-set rate', () => {
    expect(summary.verdictFlipRate).toBeGreaterThanOrEqual(0);
    expect(summary.verdictFlipRate).toBeLessThanOrEqual(1);
    expect(summary.verdictFlips).toBeLessThanOrEqual(summary.pairs);
  });

  it('counts the wider same-file signal without confusing it for the headline', () => {
    const m = missedOnUnchangedInput(cases);
    expect(m.rounds).toBe(cases.length);
    expect(m.missed).toBeGreaterThanOrEqual(0);
    expect(m.roundsAffected).toBeLessThanOrEqual(m.rounds);
  });
});

/* ------------------------------------------------------------------ the deterministic layer */

describe('#3310 the replay layer is free of randomisation', () => {
  it('gives byte-identical results when the same case is scored twice', async () => {
    const two = readdirSync(CASES).filter((x) => /^\d+-r\d+\.json$/.test(x)).sort().slice(0, 2)
      .map((x) => JSON.parse(readFileSync(join(CASES, x), 'utf8')));
    const r = await replayDeterminism(two, { limit: 'all' });
    expect(r.casesRun).toBe(2);
    expect(r.differing).toEqual([]);
    expect(r.deterministic).toBe(true);
  }, 60_000);
});

/* ------------------------------------------------------------------ it is not a gate, yet */

describe('#3310 the measurement does not gate anything', () => {
  it('has no threshold and no failing exit path', () => {
    // Deliberate: a stability number nobody has read yet must not block a merge. A threshold is a
    // later decision, and this run is the first evidence it would be based on.
    expect(SOURCE).not.toMatch(/process\.exit/);
    expect(SOURCE).not.toMatch(/exitCode\s*=/);
  });

  it('defaults to reporting both the live-repeat and the replay section', () => {
    expect(parseArgs([]).mode).toBe('both');
    expect(parseArgs(['--mode=live-pairs']).mode).toBe('live-pairs');
    expect(parseArgs(['--replay-cases=all']).replayCases).toBe('all');
    expect(parseArgs(['--tol=7']).tol).toBe(7);
  });

  it('states in its own header which kind of run it measures and what that excludes', () => {
    // The distinction is the deliverable, so it is pinned rather than left to drift out of the doc.
    expect(SOURCE).toMatch(/WHICH KIND OF RUN IS MEASURED/);
    expect(SOURCE).toMatch(/CONVENIENCE SAMPLE/);
    expect(SOURCE).toMatch(/NOT A GATE/);
  });
});
