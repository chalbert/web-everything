#!/usr/bin/env node
/**
 * @file scripts/review-corpus/stability.mjs
 * @description Measure run-to-run stability of a review: given the same input twice, how much of the
 * finding set changes? Coverity caps run-to-run churn under 5% per release and bans randomisation
 * outright; published LLM-judge test-retest consistency runs 50–91%. Nobody had measured ours.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHICH KIND OF RUN IS MEASURED — read this before quoting any number this file prints.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * There were two honest options and they measure different things:
 *
 *   LIVE REPEATED RUNS   invoke the real juror on the same PR N times. Measures the thing that
 *                        actually ships. Costs ~$0.43 per run per PR and needs a model, so it is
 *                        neither runnable in CI nor repeatable by a reader.
 *   REPLAYED RUNS        re-run the deterministic gates against recorded cases. Free and repeatable,
 *                        but the gates are `if` statements — measuring them measures the harness,
 *                        NOT the juror whose stability is in question.
 *
 * This file reports BOTH, kept apart, because neither alone answers the card:
 *
 *   SECTION 1 — RECORDED LIVE REPEATS (the headline). Not a fresh live run and not a replay: the
 *   corpus already contains pairs of REAL juror rounds that ran against the SAME head sha. Those are
 *   genuine live repeat runs on identical input, paid for once, recorded, and free to read now. This
 *   is the only section that says anything about the juror.
 *
 *   SECTION 2 — REPLAY DETERMINISM. Runs the gate replay twice over the same cases and checks the
 *   two results are identical. This is the "ban randomisation" check for the deterministic layer.
 *   It is a PRE-CONDITION for stability, not a measure of it: 0% churn here is compatible with any
 *   amount of juror churn in section 1.
 *
 * WHAT SECTION 1 THEREFORE DOES NOT MEASURE, stated so nobody over-reads the figure:
 *
 *   - It is not a fresh experiment. It reports the stability the corpus HAPPENS to have recorded.
 *   - The repeat pairs are a CONVENIENCE SAMPLE, not a random one. A round repeats against an
 *     unchanged head because a human re-ran the review — which correlates with rounds that were
 *     going badly. The sample is plausibly biased toward the unstable end, and the direction of the
 *     bias cannot be estimated from the corpus.
 *   - The sample is small. `--json` prints `pairs` and `pooledFindings`; quote them next to the rate.
 *   - The corpus does not record the model id, prompt revision, roster or care setting of a round,
 *     so "identical input" here means identical HEAD SHA, not identical reviewer configuration.
 *     A pair whose two rounds ran different reviewer builds is indistinguishable from one that did
 *     not. Some of what is counted as churn may be version drift.
 *   - It covers only PRs whose recorded rounds happen to repeat a head. It says nothing about the
 *     other PRs in the corpus, and nothing at all about PRs outside it.
 *   - `--missed-on-unchanged-input` reports a WIDER same-input signal from a WEAKER premise; its
 *     own section says how it is weaker.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT COUNTS AS CHURN
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Churn is the share of the pooled finding set that appears in one run of a pair and not the other:
 * `1 − |A ∩ B| / |A ∪ B|`. The whole question is what makes two findings "the same finding", because
 * a matcher keyed on prose measures how the reviewer WRITES, not how it JUDGES. So three matchers
 * run at once and the report brackets the answer between them:
 *
 *   locus   same file. Survives every rewording and every line-number drift. Cannot tell two
 *           different defects in one file apart, so it UNDER-reports churn.
 *   defect  (headline) same file AND (line within `--tol` · OR the same finding category · OR
 *           content-token similarity over the threshold). Category and locus are structured fields
 *           the reviewer picks from a fixed vocabulary, so agreement on them survives a total
 *           rewrite of the prose. The similarity arm is the backstop for a re-categorised finding.
 *   strict  same file AND (line within `--tol` OR high content similarity). Prose-sensitive by
 *           design, so it OVER-reports churn. Reported as the pessimistic bound only.
 *
 * Content similarity is Sørensen–Dice over content tokens, not raw text: the summary is lowercased,
 * markdown and punctuation stripped, camelCase identifiers additionally split into their parts, and
 * a stoplist of English and review boilerplate removed. What survives is identifiers, paths, numbers
 * and domain nouns — the parts two descriptions of ONE defect share even when every connective word
 * differs. That is why it survives harmless rewording, and it is also its limit: two genuinely
 * different defects about the same identifier score high, which is why it is only one arm of three.
 *
 * NOT A GATE. This file measures and prints. It has no threshold, exits 0 on any number, and nothing
 * blocks on it. A threshold is a later decision that needs evidence, and this is the first evidence.
 *
 * Usage:
 *   node scripts/review-corpus/stability.mjs [--cases=scripts/review-corpus/cases]
 *                                            [--tol=3] [--dice=0.35] [--strict-dice=0.6]
 *                                            [--mode=live-pairs|replay|both]   # default: both
 *                                            [--replay-cases=6|all]
 *                                            [--missed-on-unchanged-input]
 *                                            [--json]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/* ------------------------------------------------------------------ tokenising */

/**
 * English filler plus review boilerplate. Boilerplate is dropped for the same reason filler is: every
 * finding in the corpus says "the card", "this line", "the file", so those words carry no evidence
 * that two findings are about the SAME thing — they only inflate the similarity of unrelated pairs.
 */
export const STOPWORDS = new Set([
  'the', 'and', 'but', 'that', 'this', 'these', 'those', 'with', 'from', 'for', 'not', 'its', 'has',
  'have', 'had', 'was', 'were', 'are', 'is', 'be', 'been', 'being', 'which', 'when', 'where', 'what',
  'who', 'why', 'how', 'all', 'any', 'can', 'cannot', 'does', 'did', 'will', 'would', 'should',
  'could', 'than', 'then', 'there', 'their', 'they', 'them', 'into', 'onto', 'over', 'under', 'only',
  'also', 'just', 'even', 'ever', 'never', 'still', 'already', 'actually', 'however', 'because',
  'since', 'while', 'both', 'each', 'some', 'none', 'more', 'most', 'less', 'least', 'same', 'other',
  'another', 'such', 'very', 'per', 'out', 'off', 'one', 'two', 'three', 'own', 'here', 'itself',
  'about', 'against', 'between', 'after', 'before', 'above', 'below', 'through', 'during', 'without',
  'within', 'across', 'behind', 'beyond', 'upon', 'nor', 'yet', 'via', 'now', 'new', 'old',
  // review boilerplate — present in nearly every finding, so it discriminates nothing
  'line', 'lines', 'file', 'files', 'card', 'cards', 'review', 'reviewer', 'reviews', 'finding',
  'findings', 'says', 'said', 'state', 'states', 'stated', 'claim', 'claims', 'claimed', 'reads',
  'read', 'actual', 'actually', 'current', 'currently', 'wrong', 'never', 'always', 'section',
]);

/**
 * The content-token bag of one finding summary. camelCase identifiers contribute BOTH the joined
 * form and their parts, so `assertWins` matches a later run that wrote "the assert-wins helper".
 */
export function contentTokens(text) {
  const out = new Set();
  const add = (t) => {
    const s = t.toLowerCase();
    if (s.length >= 3 && !STOPWORDS.has(s)) out.add(s);
  };
  // Word characters only, so `scripts/lib/foo.mjs` contributes scripts · lib · foo · mjs and the
  // markdown around a summary (backticks, quotes, emphasis) never becomes part of a token.
  for (const m of String(text ?? '').matchAll(/[A-Za-z0-9][A-Za-z0-9$_-]*/g)) {
    const word = m[0].replace(/[-_]+$/, '');
    add(word);
    const parts = word.split(/[-_]+/).flatMap((p) => p.split(/(?<=[a-z0-9])(?=[A-Z])/));
    if (parts.length > 1) for (const p of parts) add(p);
  }
  return out;
}

/** Sørensen–Dice over two token sets. Two empty bags are treated as no evidence, not as a match. */
export function dice(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/* ------------------------------------------------------------------ matching */

export const MATCHERS = ['locus', 'defect', 'strict'];

/**
 * Are these two recorded findings the same finding, at the given strictness? See the header for why
 * three strictnesses run at once rather than one being picked.
 */
export function sameFinding(a, b, { mode = 'defect', tol = 3, diceMin = 0.35, strictDice = 0.6 } = {}) {
  if (!a || !b) return false;
  if (a.path !== b.path) return false;
  if (mode === 'locus') return true;
  const lineClose = a.line != null && b.line != null && a.line !== 0 && b.line !== 0
    && Math.abs(a.line - b.line) <= tol;
  if (lineClose) return true;
  const sim = dice(contentTokens(a.summary), contentTokens(b.summary));
  if (mode === 'strict') return sim >= strictDice;
  if (a.category && b.category && a.category === b.category) return true;
  return sim >= diceMin;
}

/**
 * Greedy one-to-one overlap of two finding lists. Greedy rather than optimal because the lists are
 * tiny (0–4 findings) and a maximum-matching implementation would be more machinery than the numbers
 * can bear; on this corpus the two agree, and where they could not, greedy under-counts the
 * intersection, i.e. errs toward reporting MORE churn.
 */
export function overlap(listA, listB, opts = {}) {
  const used = new Set();
  const paired = [];
  for (const a of listA) {
    const i = listB.findIndex((b, idx) => !used.has(idx) && sameFinding(a, b, opts));
    if (i !== -1) { used.add(i); paired.push([a, listB[i]]); }
  }
  const intersection = paired.length;
  const union = listA.length + listB.length - intersection;
  return {
    intersection,
    union,
    paired,
    // Two runs that both reported nothing AGREED completely. `0/0` is 1.0 here, not NaN.
    jaccard: union === 0 ? 1 : intersection / union,
    churn: union === 0 ? 0 : 1 - intersection / union,
  };
}

/* ------------------------------------------------------------------ the repeat pairs */

export function loadCases(dir) {
  return readdirSync(dir)
    .filter((f) => /^\d+-r\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

/**
 * Every pair of recorded rounds on the SAME pr at the SAME head sha — a real juror, invoked twice,
 * on byte-identical input. Adjacent rounds only: rounds r and r+2 on one sha would double-count the
 * same disagreement, and a pair is a comparison of two consecutive answers.
 */
export function repeatPairs(cases) {
  const byPr = new Map();
  for (const k of cases) {
    if (!byPr.has(k.pr)) byPr.set(k.pr, []);
    byPr.get(k.pr).push(k);
  }
  const pairs = [];
  for (const [pr, rounds] of byPr) {
    rounds.sort((x, y) => x.round - y.round);
    for (let i = 1; i < rounds.length; i += 1) {
      if (rounds[i].head === rounds[i - 1].head) pairs.push({ pr, head: rounds[i].head, a: rounds[i - 1], b: rounds[i] });
    }
  }
  return pairs.sort((x, y) => x.pr - y.pr || x.a.round - y.a.round);
}

/** One pair scored under all three matchers, plus the round-level verdict comparison. */
export function scorePair(pair, opts = {}) {
  const per = {};
  for (const mode of MATCHERS) per[mode] = overlap(pair.a.findings, pair.b.findings, { ...opts, mode });
  return {
    pr: pair.pr,
    head: pair.head,
    rounds: [pair.a.round, pair.b.round],
    findings: [pair.a.findings.length, pair.b.findings.length],
    decisions: [pair.a.decision, pair.b.decision],
    verdictFlipped: pair.a.decision !== pair.b.decision,
    per,
  };
}

/**
 * Pool the pairs. MICRO is the Coverity-shaped number — what share of the whole pooled finding
 * population changed. MACRO averages the per-pair rates, which weights a 1-finding pair the same as
 * a 4-finding one; both are printed because with a handful of pairs they can differ a lot.
 */
export function summarisePairs(scored) {
  const per = {};
  for (const mode of MATCHERS) {
    const inter = scored.reduce((a, s) => a + s.per[mode].intersection, 0);
    const union = scored.reduce((a, s) => a + s.per[mode].union, 0);
    const macro = scored.length ? scored.reduce((a, s) => a + s.per[mode].churn, 0) / scored.length : 0;
    per[mode] = { intersection: inter, union, microChurn: union === 0 ? 0 : 1 - inter / union, macroChurn: macro };
  }
  const flips = scored.filter((s) => s.verdictFlipped).length;
  return {
    pairs: scored.length,
    pooledFindings: scored.reduce((a, s) => a + s.findings[0] + s.findings[1], 0),
    bothEmpty: scored.filter((s) => s.findings[0] === 0 && s.findings[1] === 0).length,
    verdictFlips: flips,
    verdictFlipRate: scored.length ? flips / scored.length : 0,
    per,
  };
}

/* ------------------------------------------------------------------ the wider, weaker signal */

/**
 * The corpus's own `missedHere`: a finding raised in a LATER round whose FILE was byte-identical at
 * this round's head, so it was present and findable and this round did not report it.
 *
 * WEAKER PREMISE, stated so it is not quoted as the headline. A repeat pair holds the WHOLE input
 * fixed; `missedHere` holds only the one file fixed, and the rest of the PR may have changed between
 * the two rounds. A later round also reviews a smaller remaining diff, which can free attention. So
 * this is evidence about attention drift on unchanged input, not a clean test-retest.
 */
export function missedOnUnchangedInput(cases) {
  const missed = cases.reduce((a, k) => a + (k.missedHere?.length ?? 0), 0);
  const reported = cases.reduce((a, k) => a + k.findings.length, 0);
  const roundsAffected = cases.filter((k) => (k.missedHere?.length ?? 0) > 0).length;
  return { missed, reported, rounds: cases.length, roundsAffected, shareOfRounds: cases.length ? roundsAffected / cases.length : 0 };
}

/* ------------------------------------------------------------------ replay determinism */

/**
 * Run the deterministic gate replay twice over the same cases and compare. Any difference means the
 * "no randomisation" precondition is broken somewhere under `runGates`. Imported lazily so the
 * live-pairs section — the section that answers the card — never pays for `git show`.
 */
export async function replayDeterminism(cases, { limit = 6 } = {}) {
  const { scoreCase } = await import('./replay-gates.mjs');
  const picked = limit === 'all' ? cases : cases.slice(0, limit);
  const differing = [];
  for (const kase of picked) {
    const one = fingerprintScore(scoreCase(kase));
    const two = fingerprintScore(scoreCase(kase));
    if (one !== two) differing.push(`${kase.pr}-r${kase.round}`);
  }
  return { casesRun: picked.length, differing, deterministic: differing.length === 0 };
}

/** Everything a gate emitted, in a stable order, as one comparable string. */
export function fingerprintScore(res) {
  const hit = (h) => `${h.gate}|${h.path}|${h.line}|${h.subject ?? ''}|${h.message ?? ''}`;
  return JSON.stringify({
    matched: res.matched.map((m) => `${m.label.path}|${m.label.line}|${hit(m.hit)}`).sort(),
    missed: res.missed.map((l) => `${l.path}|${l.line}|${l.summary}`).sort(),
    extras: res.extras.map(hit).sort(),
  });
}

/* ------------------------------------------------------------------ cli */

const pct = (x) => `${(100 * x).toFixed(1)}%`;

export function parseArgs(argv) {
  const o = {
    cases: 'scripts/review-corpus/cases', tol: 3, dice: 0.35, strictDice: 0.6,
    mode: 'both', replayCases: 6, missedSignal: false, json: false,
  };
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'cases') o.cases = m[2];
    if (m[1] === 'tol') o.tol = Number(m[2]);
    if (m[1] === 'dice') o.dice = Number(m[2]);
    if (m[1] === 'strict-dice') o.strictDice = Number(m[2]);
    if (m[1] === 'mode') o.mode = m[2];
    if (m[1] === 'replay-cases') o.replayCases = m[2] === 'all' ? 'all' : Number(m[2]);
    if (m[1] === 'missed-on-unchanged-input') o.missedSignal = true;
    if (m[1] === 'json') o.json = true;
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cases = loadCases(resolve(ROOT, opts.cases));
  const matchOpts = { tol: opts.tol, diceMin: opts.dice, strictDice: opts.strictDice };

  const wantPairs = opts.mode === 'both' || opts.mode === 'live-pairs';
  const wantReplay = opts.mode === 'both' || opts.mode === 'replay';

  const scored = wantPairs ? repeatPairs(cases).map((p) => scorePair(p, matchOpts)) : [];
  const summary = wantPairs ? summarisePairs(scored) : null;
  const replay = wantReplay ? await replayDeterminism(cases, { limit: opts.replayCases }) : null;
  const missed = opts.missedSignal ? missedOnUnchangedInput(cases) : null;

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ corpusCases: cases.length, summary, pairs: scored, replay, missedOnUnchangedInput: missed }, null, 2)}\n`);
    return;
  }

  process.stdout.write('\nRun-to-run stability of a review\n');
  process.stdout.write(`corpus: ${cases.length} recorded cases   matcher tol +/-${opts.tol} lines, dice >= ${opts.dice} (strict ${opts.strictDice})\n`);

  if (wantPairs) {
    process.stdout.write('\n── Section 1 — RECORDED LIVE REPEATS (the real juror, same head sha, twice) ──\n');
    if (!scored.length) {
      process.stdout.write('no repeated-head round pairs in this corpus — nothing to measure.\n');
    } else {
      process.stdout.write(`${'PR'.padEnd(8)}${'rounds'.padEnd(9)}${'findings'.padEnd(11)}${'verdicts'.padEnd(20)}${'churn locus/defect/strict'}\n`);
      process.stdout.write(`${'-'.repeat(80)}\n`);
      for (const s of scored) {
        const v = `${s.decisions[0]}→${s.decisions[1]}${s.verdictFlipped ? ' FLIP' : ''}`;
        const c = MATCHERS.map((m) => pct(s.per[m].churn)).join(' / ');
        process.stdout.write(`#${String(s.pr).padEnd(7)}${`r${s.rounds[0]}→r${s.rounds[1]}`.padEnd(9)}${`${s.findings[0]}→${s.findings[1]}`.padEnd(11)}${v.padEnd(20)}${c}\n`);
      }
      process.stdout.write(`${'-'.repeat(80)}\n`);
      process.stdout.write(`pairs ${summary.pairs}   pooled findings ${summary.pooledFindings}   pairs where both runs found nothing ${summary.bothEmpty}\n\n`);
      for (const m of MATCHERS) {
        const s = summary.per[m];
        const tag = m === 'defect' ? ' <- headline' : m === 'locus' ? ' (under-reports)' : ' (over-reports)';
        process.stdout.write(`  ${m.padEnd(7)} churn ${pct(s.microChurn).padStart(6)} pooled  ${pct(s.macroChurn).padStart(6)} per-pair mean   (${s.intersection}/${s.union} findings agreed)${tag}\n`);
      }
      process.stdout.write(`\n  verdict flips: ${summary.verdictFlips}/${summary.pairs} pairs = ${pct(summary.verdictFlipRate)} — the same diff got a different accept/changes answer.\n`);
      process.stdout.write('\n  Reference points, not targets: Coverity caps release-over-release churn under 5% and bans\n  randomisation; published LLM-judge test-retest consistency runs 50-91%.\n');
      process.stdout.write('  This is a CONVENIENCE SAMPLE of rounds that happened to be re-run, and the corpus does not\n  record each round\'s model or prompt revision, so some of this churn may be version drift.\n  Quote the pair count with the rate. NOT A GATE — nothing blocks on this number.\n');
    }
  }

  if (missed) {
    process.stdout.write('\n── Wider, weaker signal — findings a round missed on a file that had not changed ──\n');
    process.stdout.write(`${missed.missed} such findings across ${missed.roundsAffected}/${missed.rounds} recorded rounds (${pct(missed.shareOfRounds)}), against ${missed.reported} findings actually reported.\n`);
    process.stdout.write('  Weaker premise than section 1: only the ONE file is held fixed, not the whole input, and a\n  later round reviews a smaller remaining diff. Attention drift, not a clean test-retest.\n');
  }

  if (wantReplay) {
    process.stdout.write('\n── Section 2 — REPLAY DETERMINISM (the gates, not the juror) ──\n');
    process.stdout.write(`ran the gate replay twice over ${replay.casesRun} cases: ${replay.deterministic ? 'identical both times' : `DIFFERED on ${replay.differing.join(', ')}`}\n`);
    process.stdout.write('  This is the "no randomisation" precondition for the deterministic layer. It is NOT a measure\n  of review stability: a perfect score here is compatible with any amount of juror churn above.\n');
  }

  process.stdout.write('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
