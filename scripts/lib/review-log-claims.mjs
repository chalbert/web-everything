#!/usr/bin/env node
/**
 * @file scripts/lib/review-log-claims.mjs
 * @description RE-DERIVE A QUANTITATIVE REVIEW-LOG CLAIM FROM THE VERDICT RECORD (#3336) — so the figure an
 *   author writes under `## Review log` comes from a run, not a recollection.
 *
 * WHY IT EXISTS. A `## Review log` entry records this programme's own results under a header promising the
 * next reader need not re-derive them, so a wrong number there is read as settled. Two rounds on PR #1576
 * bounced on exactly that, three wrong claims in one entry: *"cleared in one round each"* (zero of four did —
 * 4 / 2 / 3 / 5), *"found nine wrong figures"* (the record produces four), *"no test finding at all"* (both
 * pre-split verdicts recorded one). A fourth, *"100 files"*, was 120 then 123. Every one was written from
 * memory about material that is machine-readable: the structured verdict comments
 * `we:scripts/review-set-label.mjs` renders and `gh pr view <n> --json comments` returns verbatim.
 *
 * RETRACTED 2026-08-27 (PR #1617 review round 1, operator finding 1). The line above previously read
 * *"zero of four did — **2** / 2 / 3 / 5"*. That 2 was **wrong for the basis this module ships**: it counted
 * only #1569's two POST-SPLIT rounds, while `rounds(1569)` counts every recorded review round and gives
 * **4** — as `derive 1569 1570 1571 1572` prints. A correction that the shipped checker would itself flag is
 * the defect this item exists to stop, so the figure now matches the metric. `METRICS.rounds` deliberately
 * cannot express "rounds since some event": there is no such basis in the verdict record.
 *
 * ── THE TWO HALVES, AND WHY BOTH ────────────────────────────────────────────────────────────────────────────
 *
 * **`derive`** is the half that fixes the defect the card names. Before writing a figure, run it and read the
 * number off the record. It asserts nothing and cannot fail; it prints what the verdict comments say.
 *
 * **`check`** is the half that keeps a written figure true. It verifies claims the author MARKED, and only
 * those.
 *
 * ── WHY MARKED, NOT SNIFFED ─────────────────────────────────────────────────────────────────────────────────
 *
 * The obvious build is a regex over prose that spots "N rounds" and re-derives N. It is the build that gets
 * this checker uninstalled. Natural-language quantity claims are unbounded — "two rounds", "a couple of
 * rounds", "both rounds", "one round each", "the second round" — so a sniffer both misses and over-fires, and
 * a checker that flags correct prose is ignored within a day, after which it protects nothing. So NOTHING here
 * is sniffed. A claim is examined only where the author wrote a marker:
 *
 *     PR #1572 took **5** rounds. <!-- claim: rounds(1572)=5 -->
 *
 * The false-positive population is therefore structurally empty: the only way to trip `check` is to assert a
 * number the record contradicts, or to let a marker drift from the sentence it annotates.
 *
 * **State the weakness rather than hide it: a marking convention protects only marked claims.** It is not a
 * guarantee, because it needs authors to adopt it — and the lesson of the very entry that produced this item
 * is that a mechanism depending on universal participation is not a guarantee. That is exactly why `derive`,
 * not `check`, is the primary deliverable: `derive` helps an author who has adopted nothing.
 *
 * ── THE MARKER IS CHECKED AGAINST ITS OWN PROSE, TOO ────────────────────────────────────────────────────────
 *
 * A marker asserting `=2` next to a sentence that says "five" would be decoration. So {@link evaluateClaim}
 * makes two checks, not one: the asserted value must match the record, AND the asserted value must appear as a
 * number **in the prose on the marker's own line** (number words `zero`–`twenty`, plus `no`/`none` → `0`, are
 * normalised first). A marker that drifts from its sentence fails as loudly as a wrong figure.
 *
 * ── WHAT IS DELIBERATELY NOT CHECKED ────────────────────────────────────────────────────────────────────────
 *
 * - **Durations, spend, timings.** *"1 merged in 30 minutes"*, *"$1.39 / 456s"* — the wall-clock a claim
 *   describes is not what the timestamps measure, and a figure measured while a broken tool interfered is a
 *   real number and invalid evidence. Nothing in the comment stream distinguishes those.
 * - **Whether a finding is right.** The corpus records what was SAID, not what was true. This module counts
 *   what the record contains and reads nothing as adjudicated.
 * - **Comparisons, adjectives, lessons.** *"the sharper finding"*, *"always `correctness`"*, *"no path to
 *   convergence"*. A universal quantifier over a population this module cannot enumerate is not derivable
 *   here; the counts underneath one usually are, and those are what a marker should carry.
 * - **Distributive claims.** Multiple PR arguments SUM. "Each" is not expressible; mark each row separately.
 *
 * ── FAIL vs WARN vs ANNOTATE ────────────────────────────────────────────────────────────────────────────────
 *
 * **A contradicted marker FAILS (exit 1).** Warn would be wrong here for the reason it is usually right: a
 * warning is the correct register when the checker might be the one that is wrong, and marking removes that
 * possibility — the author volunteered a machine-checkable assertion, so a contradiction is the author's
 * error every time. There is no false-positive population to soften the blow for.
 *
 * **An unreachable record is UNKNOWN, and unknown never fails.** `gh` needs a credential and a network, and
 * neither is guaranteed where this runs. *"I cannot read the record"* means unknown, never *"the claim is
 * wrong"* — the same discipline the repo already applies to a hash-named card. Unknown warns on stderr and
 * exits 0; `--strict` promotes it for a caller that guarantees the network.
 *
 * **Nothing is annotated or auto-fixed.** The defect one level up in the entry that produced this item is
 * *fix-only-where-quoted*: a corrected claim left standing at its other sites. A rewriter that patched the one
 * marked site would reproduce that pattern mechanically. Sweeping a correction to its other sites is #3307's
 * job, and it is a different job.
 *
 * **NOT wired into `check:standards`, deliberately.** The gate is offline and must stay deterministic; a rule
 * that shells out to `gh` makes it flaky, and a flaky gate is a gate people learn to re-run until it passes.
 * This is an author-run command whose logic is unit-tested offline.
 *
 * PURE CORE, IMPURE RIM. Everything above {@link deriveRecords} is a pure function of comment bodies, so the
 * suite exercises the real parser against real recorded comment text with no network at all. Only the CLI and
 * {@link ghCommentFetcher} touch a subprocess.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/* ───────────────────────────────────────────────────────────────────── the record: parsing one comment ── */

/**
 * The comment headings `we:scripts/review-set-label.mjs` renders, and what each one IS.
 *
 * `round: true` is the load-bearing field. Only two of the four headings are a recorded review round; the
 * other two are label bookkeeping that a naive "count the ✅/🔁 comments" would fold in and inflate. A
 * re-stamp says *"no new review"* in its own heading, and a `clear-human` records that the human ceremony ran
 * on an existing acceptance. Counting either as a round would silently answer a question about review effort
 * with a number about label churn.
 */
export const VERDICT_HEADINGS = Object.freeze([
  Object.freeze({ kind: 'changes', round: true, decision: 'changes', prefix: '🔁 review — changes requested' }),
  Object.freeze({ kind: 'accepted', round: true, decision: 'accept', prefix: '✅ review — accepted' }),
  Object.freeze({ kind: 'restamp', round: false, decision: null, prefix: '📌 review — acceptance re-stamped' }),
  Object.freeze({ kind: 'clear-human', round: false, decision: null, prefix: '✅ review — `review:human` cleared' }),
]);

/** `### Findings (N)` — the declared total the renderer writes. */
const FINDINGS_HEADER_RE = /^###\s+Findings\s*\((\d+)\)\s*$/m;
/** `**category** (n)` — one group header inside the findings section. */
const FINDINGS_GROUP_RE = /^\*\*(.+?)\*\*\s*\((\d+)\)\s*$/;
/** `Net basis: … — 123 net changed file(s)`. */
const NET_FILES_RE = /—\s*(\d+)\s+net changed file/;
/** A top-level finding bullet. Sub-bullets (`  - _Prevention…`) are indented and must not count. */
const FINDING_BULLET_RE = /^-\s+\S/;

/**
 * Parse ONE comment body into a verdict record, or `null` when it is not a verdict comment at all.
 *
 * Tolerant by construction about everything except the heading: a drain park notice, an independent
 * reviewer-notes comment and an ordinary human remark all return `null` and are simply not part of the
 * record. That matters for honesty about scope — the review log entry behind this item counted findings from
 * verdicts on one side and from verdicts *plus* a notes comment on the other, with neither basis stated. This
 * module has exactly one basis, always: **the structured verdict comments**. A findings count derived here is
 * a count of what the verdicts carry, and nothing else.
 *
 * @param {{body?: string, createdAt?: string}} comment
 * @returns {null | {kind: string, round: boolean, decision: string|null, createdAt: string|null,
 *   findings: number|null, findingsNote: string|null, groups: Array<{category: string, count: number}>,
 *   netFiles: number|null, lenses: string[]}}
 */
export function parseVerdictComment(comment) {
  const body = String(comment?.body ?? '');
  const heading = VERDICT_HEADINGS.find((h) => body.trimStart().startsWith(h.prefix));
  if (!heading) return null;

  const { findings, findingsNote, groups } = countFindings(body);
  const netMatch = body.match(NET_FILES_RE);
  return {
    kind: heading.kind,
    round: heading.round,
    decision: heading.decision,
    createdAt: comment?.createdAt ?? null,
    findings,
    findingsNote,
    groups,
    netFiles: netMatch ? Number(netMatch[1]) : null,
    lenses: parseLensRows(body),
  };
}

/**
 * Count findings THREE INDEPENDENT WAYS and refuse to answer when they disagree.
 *
 * The renderer writes the total in `### Findings (N)`, writes a per-category count in every group header, and
 * writes one bullet per finding. All three come from the same array, so on an untouched comment they agree —
 * but a verdict comment is markdown on a mutable host, and *"the record produces four"* was the correction to
 * a claim of nine. A checker that reads one of the three and is quietly wrong about which is a worse artifact
 * than no checker, so disagreement yields `findings: null` plus a note naming the disagreement, and every
 * claim resting on it resolves UNKNOWN rather than mismatch.
 */
function countFindings(body) {
  const header = body.match(FINDINGS_HEADER_RE);
  if (!header) return { findings: null, findingsNote: 'no `### Findings (N)` section', groups: [] };

  const section = body.slice(header.index + header[0].length);
  // The findings section ends at the renderer's `---` rule, or at the next `##`-level heading.
  const endRule = section.search(/^---\s*$/m);
  const endHeading = section.search(/^##\s+\S/m);
  const ends = [endRule, endHeading].filter((i) => i !== -1);
  const scoped = ends.length ? section.slice(0, Math.min(...ends)) : section;

  const groups = [];
  let bullets = 0;
  for (const line of scoped.split('\n')) {
    const g = line.match(FINDINGS_GROUP_RE);
    if (g) groups.push({ category: g[1], count: Number(g[2]) });
    else if (FINDING_BULLET_RE.test(line)) bullets += 1;
  }
  const declared = Number(header[1]);
  const grouped = groups.reduce((n, g) => n + g.count, 0);
  if (declared !== bullets || declared !== grouped) {
    return {
      findings: null,
      groups,
      findingsNote: `the comment disagrees with itself — header says ${declared}, `
        + `group counts sum to ${grouped}, ${bullets} bullet(s) enumerated`,
    };
  }
  return { findings: declared, findingsNote: null, groups };
}

/** Lens names from the `### Panel verdicts` table. Reported by `derive`; no metric asserts over them. */
function parseLensRows(body) {
  const at = body.indexOf('### Panel verdicts');
  if (at === -1) return [];
  const rows = [];
  for (const line of body.slice(at).split('\n').slice(1)) {
    if (/^###?\s+\S/.test(line)) break;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    if (cells[0] === 'lens' || /^-+$/.test(cells[0])) continue;
    rows.push(cells[0]);
  }
  return rows;
}

/**
 * The record for one PR: its verdict comments in the order GitHub returned them, split into review ROUNDS and
 * the non-round label bookkeeping.
 *
 * @param {number|string} pr
 * @param {Array<{body?: string, createdAt?: string}>} comments as returned by `gh pr view <n> --json comments`
 */
export function deriveRecord(pr, comments) {
  const parsed = (Array.isArray(comments) ? comments : []).map(parseVerdictComment).filter(Boolean);
  return {
    pr: Number(pr),
    rounds: parsed.filter((v) => v.round),
    nonRounds: parsed.filter((v) => !v.round),
    comments: Array.isArray(comments) ? comments.length : 0,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────── the claim vocabulary ── */

/**
 * THE CLOSED SET OF CHECKABLE METRICS. Small on purpose: every one is a count the verdict comments state
 * outright, so deriving it takes no judgment and no interpretation.
 *
 * `selector` is the `#N` round suffix (`files(1569#2)` — the count the SECOND verdict recorded):
 * `'required'`, `'allowed'`, or `'forbidden'` (asking for "round 2 of the round count" is not a question).
 */
export const METRICS = Object.freeze({
  rounds: Object.freeze({
    selector: 'forbidden', category: false,
    describe: 'recorded review rounds (verdict comments; re-stamps and human clearances excluded)',
    of: (rounds) => rounds.length,
  }),
  changes: Object.freeze({
    selector: 'forbidden', category: false,
    describe: 'rounds that recorded `changes`',
    of: (rounds) => rounds.filter((r) => r.decision === 'changes').length,
  }),
  accepted: Object.freeze({
    selector: 'forbidden', category: false,
    describe: 'rounds that recorded `accept`',
    of: (rounds) => rounds.filter((r) => r.decision === 'accept').length,
  }),
  findings: Object.freeze({
    selector: 'allowed', category: true,
    describe: 'findings enumerated by those rounds',
    of: (rounds, category) => sumOrNull(rounds.map((r) => findingsOf(r, category))),
  }),
  files: Object.freeze({
    selector: 'required', category: false,
    describe: 'net changed files the round recorded as its basis',
    of: (rounds) => sumOrNull(rounds.map((r) => r.netFiles)),
  }),
});

function findingsOf(round, category) {
  if (!category) return round.findings;
  // A category filter reads the group headers, which agree with the total only when `countFindings`
  // said so; when it did not, every derived figure from this round is unknown.
  if (round.findings === null) return null;
  return round.groups
    .filter((g) => g.category.toLowerCase() === category.toLowerCase())
    .reduce((n, g) => n + g.count, 0);
}

/** Sum, unless any term is unknown — in which case the whole sum is unknown. Never treat unknown as zero. */
function sumOrNull(values) {
  return values.some((v) => v === null || v === undefined) ? null : values.reduce((a, b) => a + b, 0);
}

/* ──────────────────────────────────────────────────────────────────────── recognising a marked claim ── */

/** `<!-- claim: metric(args)=value -->`. The ONLY thing this module recognises in prose. */
const CLAIM_RE = /<!--\s*claim:\s*([a-zA-Z]+)\s*\(([^)]*)\)\s*=\s*(-?\d+)\s*-->/g;
/** One argument: a PR number, an optional `#round`, and an optional `;category` on the last one. */
const PR_ARG_RE = /^#?(\d+)(?:#(\d+))?$/;

/**
 * Number words this module normalises before looking for the asserted value in the prose. Bounded on purpose:
 * counts in a review log are small, and a longer table buys nothing but ways to be surprised.
 */
export const NUMBER_WORDS = Object.freeze({
  no: 0, none: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
});

/**
 * Find every marked claim in a markdown document. Returns invalid markers too — a marker the grammar cannot
 * read is an ERROR, not a thing to skip, because skipping it would let a typo disable a check silently.
 *
 * @param {string} text
 * @returns {Array<{lineNo: number, line: string, raw: string, metric: string, prs: Array<{pr: number,
 *   round: number|null}>, category: string|null, asserted: number, invalid: string|null}>}
 */
export function parseClaimMarkers(text) {
  const src = String(text ?? '');
  const out = [];
  for (const m of src.matchAll(CLAIM_RE)) {
    const lineNo = src.slice(0, m.index).split('\n').length;
    const line = src.split('\n')[lineNo - 1] ?? '';
    out.push({ lineNo, line, raw: m[0], ...readClaim(m[1], m[2], Number(m[3])) });
  }
  return out;
}

function readClaim(metricName, argText, asserted) {
  const base = { metric: metricName, prs: [], category: null, asserted, invalid: null };
  const spec = METRICS[metricName];
  if (!spec) {
    return { ...base, invalid: `unknown metric \`${metricName}\` — known: ${Object.keys(METRICS).join(', ')}` };
  }
  const [prPart, ...categoryParts] = argText.split(';');
  const category = categoryParts.join(';').trim() || null;
  if (category && !spec.category) return { ...base, invalid: `\`${metricName}\` takes no category filter` };

  const prs = [];
  for (const rawArg of prPart.split(',').map((s) => s.trim()).filter(Boolean)) {
    const p = rawArg.match(PR_ARG_RE);
    if (!p) return { ...base, category, invalid: `cannot read PR argument \`${rawArg}\`` };
    const round = p[2] === undefined ? null : Number(p[2]);
    if (round !== null && spec.selector === 'forbidden') {
      return { ...base, category, invalid: `\`${metricName}\` is a count OF rounds — a \`#round\` selector on it asks nothing` };
    }
    if (round === null && spec.selector === 'required') {
      return { ...base, category, invalid: `\`${metricName}\` needs a \`#round\` selector (e.g. \`${metricName}(${p[1]}#1)\`) — it is recorded per round, not per PR` };
    }
    if (round !== null && round < 1) return { ...base, category, invalid: `round selector is 1-based, got \`#${round}\`` };
    prs.push({ pr: Number(p[1]), round });
  }
  if (!prs.length) return { ...base, category, invalid: 'no PR number given' };
  if (spec.selector === 'required' && prs.length > 1) {
    return { ...base, prs, category, invalid: `\`${metricName}\` is recorded per round — summing it across PRs describes nothing; mark each site separately` };
  }
  // THE MIS-TAG TRAP, refused rather than answered. `findings(1569; test-coverage)=0` looks like a check of
  // "no test finding at all" and is not one: a category is free text the reviewer chose, so an absent group
  // header is indistinguishable from the same finding filed under a different tag. Answering `0` here would
  // stamp VERIFIED on the exact claim class this item exists to catch — the entry behind #3336 said "no test
  // finding at all" when both verdicts recorded one, tagged elsewhere.
  if (category && asserted === 0) {
    return {
      ...base, prs, category,
      invalid: 'a claim of ZERO findings under a named category is not checkable — the category is free text, '
        + 'so "no group by that name" cannot be told from "the same finding tagged differently". '
        + 'Assert the unfiltered count instead, or state it in prose without a marker.',
    };
  }
  return { ...base, prs, category };
}

/* ─────────────────────────────────────────────────────────────────────────────── evaluating a claim ── */

/** Normalise number words to digits so `**five** rounds` echoes an asserted `5`. */
export function normalizeNumberWords(line) {
  return String(line ?? '').replace(/\b([a-z]+)\b/gi, (word) => {
    const n = NUMBER_WORDS[word.toLowerCase()];
    return n === undefined ? word : String(n);
  });
}

/**
 * Does the asserted value actually appear in the prose the marker annotates?
 *
 * THE ANTI-DECORATION CHECK. Without it a marker is a second, invisible copy of the figure, free to say `2`
 * beside a sentence that says "five" — which is the failure mode of every convention where the machine-read
 * copy and the human-read copy are separate strings. The marker itself is stripped first so it cannot satisfy
 * its own check.
 *
 * Word-bounded, so an asserted `2` does not match inside `123`. Deliberately generous in the other direction:
 * an unrelated `2` elsewhere on the line satisfies it. That asymmetry is the right one — a coincidence here
 * costs a missed drift, while a stricter rule would reject correct prose, and rejecting correct prose is what
 * gets a checker uninstalled.
 */
export function assertedAppearsInProse(line, asserted, raw) {
  // `raw` may be absent on a direct call, and an EMPTY separator would split the line into single characters
  // — scattering every multi-digit number in it, so `123` would satisfy an asserted `2`. Strip only when
  // there is something to strip.
  const prose = raw ? String(line ?? '').split(raw).join(' ') : String(line ?? '');
  return new RegExp(`(?<![\\d.])${asserted}\\b`).test(normalizeNumberWords(prose));
}

/**
 * Evaluate one parsed claim against the derived records.
 *
 * @returns {{status: 'ok'|'mismatch'|'drift'|'invalid'|'unknown', derived: number|null, message: string}}
 */
export function evaluateClaim(claim, recordsByPr) {
  if (claim.invalid) return { status: 'invalid', derived: null, message: claim.invalid };
  const spec = METRICS[claim.metric];

  const rounds = [];
  for (const { pr, round } of claim.prs) {
    const record = recordsByPr instanceof Map ? recordsByPr.get(pr) : recordsByPr?.[pr];
    if (!record) {
      return { status: 'unknown', derived: null, message: `no record read for PR #${pr} — unknown, not wrong` };
    }
    if (round === null) { rounds.push(...record.rounds); continue; }
    const one = record.rounds[round - 1];
    if (!one) {
      return {
        status: 'unknown', derived: null,
        message: `PR #${pr} records ${record.rounds.length} round(s); there is no round #${round} to read`,
      };
    }
    rounds.push(one);
  }

  const derived = spec.of(rounds, claim.category);
  if (derived === null) {
    const note = rounds.map((r) => r.findingsNote).find(Boolean) || 'the record does not state it';
    return { status: 'unknown', derived: null, message: `cannot derive ${claim.metric} — ${note}` };
  }
  if (derived !== claim.asserted) {
    return {
      status: 'mismatch', derived,
      message: `claims ${claim.metric} = ${claim.asserted}; the verdict record gives ${derived} `
        + `(${spec.describe}${claim.category ? `, category \`${claim.category}\`` : ''})`,
    };
  }
  if (!assertedAppearsInProse(claim.line, claim.asserted, claim.raw)) {
    return {
      status: 'drift', derived,
      message: `the marker asserts ${claim.asserted} and the record agrees, but ${claim.asserted} does not `
        + 'appear in the sentence it annotates — the marker has drifted from its prose',
    };
  }
  return { status: 'ok', derived, message: `${claim.metric} = ${derived} — matches the verdict record` };
}

/** Every PR a set of documents' markers refers to, so the caller fetches each record once. */
export function prsReferenced(claims) {
  return [...new Set(claims.flatMap((c) => c.prs.map((p) => p.pr)))].sort((a, b) => a - b);
}

/**
 * Check every marked claim across a set of documents.
 *
 * @param {Array<{file: string, content: string}>} docs
 * @param {Map<number, object>|Record<number, object>} recordsByPr
 * @returns {{results: Array<object>, errors: string[], warnings: string[], checked: number}}
 */
export function checkClaims(docs, recordsByPr) {
  const results = [];
  const errors = [];
  const warnings = [];
  for (const doc of docs ?? []) {
    for (const claim of parseClaimMarkers(doc.content)) {
      const outcome = evaluateClaim(claim, recordsByPr);
      const at = `${doc.file}:${claim.lineNo}`;
      results.push({ ...outcome, file: doc.file, lineNo: claim.lineNo, claim });
      const line = `${at} — ${claim.raw.trim()}: ${outcome.message}`;
      if (outcome.status === 'unknown') warnings.push(line);
      else if (outcome.status !== 'ok') errors.push(line);
    }
  }
  return { results, errors, warnings, checked: results.length };
}

/* ─────────────────────────────────────────────────────────────────────────────────────── the rim: gh ── */

/**
 * The one impure read. `gh pr view <n> --json comments` — the same command the card names, and the same one
 * `we:scripts/lib/pr-view-transport.mjs` documents as the only pinned read that works on this host.
 *
 * A failure returns `null`, never throws and never an empty array: an empty array would derive `rounds = 0`
 * and turn a network outage into a confident wrong answer.
 */
export function ghCommentFetcher({ repo = null, run = execFileSync } = {}) {
  return (pr) => {
    try {
      const argv = ['pr', 'view', String(pr), '--json', 'comments'];
      if (repo) argv.push('--repo', repo);
      const out = run('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const parsed = JSON.parse(out);
      return Array.isArray(parsed?.comments) ? parsed.comments : null;
    } catch {
      return null;
    }
  };
}

/** Fetch and derive every PR named, tolerating an unreachable one as absent-from-the-map (i.e. unknown). */
export function deriveRecords(prs, fetch) {
  const map = new Map();
  for (const pr of prs) {
    const comments = fetch(pr);
    if (comments === null) continue;
    map.set(Number(pr), deriveRecord(pr, comments));
  }
  return map;
}

/* ──────────────────────────────────────────────────────────────────────────────────────────── the CLI ── */

const USAGE = `review-log-claims — re-derive a quantitative review-log claim from the verdict record (#3336)

  node scripts/lib/review-log-claims.mjs derive <pr>...        read the record; write your figure from THIS
  node scripts/lib/review-log-claims.mjs check <file.md>...    verify the <!-- claim: --> markers in a document

  -h, --help  print this usage and exit 0
  --json      machine-readable output
  --strict    an unreadable record fails instead of warning (only where the network is guaranteed)
  --repo O/R  pass through to \`gh pr view --repo\` (\`--repo=O/R\` works too)

Marker grammar, the only thing \`check\` recognises in prose:

  <!-- claim: rounds(1572)=5 -->                 rounds recorded on one PR
  <!-- claim: rounds(1569,1570,1571,1572)=12 --> the SUM across PRs (not "each" — mark each row separately)
  <!-- claim: changes(1569)=2 -->                rounds that recorded \`changes\`
  <!-- claim: accepted(1569)=1 -->               rounds that recorded \`accept\`
  <!-- claim: findings(1569)=4 -->               findings those rounds enumerated
  <!-- claim: findings(1569#2; claim-accuracy)=3 -->   ...one round, one category (a =0 claim is refused)
  <!-- claim: files(1569#2)=123 -->              net changed files that round recorded as its basis

The asserted value must ALSO appear in the sentence the marker sits on, so it cannot drift from its prose.
`;

function renderRecord(record) {
  const lines = [`PR #${record.pr} — ${record.rounds.length} recorded review round(s), ${record.comments} comment(s)`];
  record.rounds.forEach((r, i) => {
    const findings = r.findings === null ? `? (${r.findingsNote})` : String(r.findings);
    const groups = r.groups.map((g) => `${g.category}=${g.count}`).join(', ');
    lines.push(
      `  #${i + 1} ${r.createdAt ?? '(no timestamp)'} — decision \`${r.decision}\``
      + `, findings ${findings}${groups ? ` [${groups}]` : ''}`
      + `, net files ${r.netFiles ?? '?'}${r.lenses.length ? `, lens ${r.lenses.join('/')}` : ''}`,
    );
  });
  for (const n of record.nonRounds) {
    lines.push(`  · ${n.createdAt ?? ''} — \`${n.kind}\`, NOT counted as a review round`);
  }
  return lines.join('\n');
}

const VALUELESS_FLAGS = new Set(['--json', '--strict', '--help', '-h']);

/**
 * Split argv into `{ flags, repo, operands }`, or `{ error }`.
 *
 * `--repo` takes its value in EITHER form — `--repo O/R` (what USAGE documents) or `--repo=O/R`. The first
 * parser here recognised only the `=` form: the bare `--repo` token was dropped as a flag and `O/R` was left
 * behind as an operand, which `derive` then discarded via `Number.isFinite`. `derive 1 --repo cli/cli` read
 * THIS repo and exited 0 — no warning, no error. That is this module's own stated failure class ("an empty
 * array would derive `rounds = 0` and turn an outage into a confident wrong answer") arriving by a different
 * route, on the command the header calls the primary deliverable, so the space form is now consumed properly.
 *
 * An unrecognised dash-prefixed token is an ERROR, never a silently-ignored flag and never an operand — the
 * same reason an unreadable marker errors rather than skipping: a typo must not quietly disable a check.
 */
export function parseArgv(argv) {
  const flags = new Set();
  const operands = [];
  let repo = null;
  const needsValue = '--repo needs a value — `--repo O/R` or `--repo=O/R`';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) return { error: needsValue };
      repo = value;
      i += 1;
    } else if (arg.startsWith('--repo=')) {
      repo = arg.slice('--repo='.length);
      if (!repo) return { error: needsValue };
    } else if (arg.startsWith('-')) {
      if (!VALUELESS_FLAGS.has(arg)) return { error: `unknown flag \`${arg}\`` };
      flags.add(arg);
    } else {
      operands.push(arg);
    }
  }
  return { flags, repo, operands };
}

// `run` is injectable so a test can prove `--repo` REACHES `gh` — the half that was untested when the space
// form silently read the wrong repository. Left undefined it falls through to ghCommentFetcher's execFileSync.
export function main(argv, { fetch, run, log = console.log, err = console.error } = {}) {
  const parsed = parseArgv(argv);
  if (parsed.error) { err(`${parsed.error}\n\n${USAGE}`); return 1; }
  const { flags, repo, operands: rest } = parsed;
  const [command, ...operands] = rest;
  const json = flags.has('--json');
  const strict = flags.has('--strict');
  const fetcher = fetch ?? ghCommentFetcher({ repo, run });

  // An EXPLICIT help request succeeds; a bare invocation with no command at all is misuse and still exits 1.
  if (flags.has('--help') || flags.has('-h')) { log(USAGE); return 0; }
  if (!command) { log(USAGE); return 1; }

  if (command === 'derive') {
    const prs = operands.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (!prs.length) { err('derive: give at least one PR number'); return 1; }
    const records = deriveRecords(prs, fetcher);
    const missing = prs.filter((p) => !records.has(p));
    if (json) log(JSON.stringify({ records: [...records.values()], unreadable: missing }, null, 2));
    else {
      for (const p of prs) {
        log(records.has(p) ? renderRecord(records.get(p)) : `PR #${p} — record UNREADABLE (unknown, not empty)`);
      }
    }
    // `derive` asserts nothing, so it cannot be wrong; an unreadable record is still a failed READ.
    return missing.length && strict ? 1 : 0;
  }

  if (command === 'check') {
    if (!operands.length) { err('check: give at least one markdown file'); return 1; }
    const docs = [];
    for (const file of operands) {
      try { docs.push({ file, content: readFileSync(file, 'utf8') }); }
      catch (e) { err(`check: cannot read ${file} — ${e.message}`); return 1; }
    }
    const claims = docs.flatMap((d) => parseClaimMarkers(d.content));
    if (!claims.length) {
      if (json) log(JSON.stringify({ checked: 0, errors: [], warnings: [] }, null, 2));
      else log(`no <!-- claim: … --> markers in ${docs.length} file(s) — nothing asserted, nothing checked`);
      return 0;
    }
    const records = deriveRecords(prsReferenced(claims), fetcher);
    const { results, errors, warnings, checked } = checkClaims(docs, records);
    if (json) { log(JSON.stringify({ checked, errors, warnings, results: results.map(stripClaim) }, null, 2)); }
    else {
      for (const r of results) {
        const mark = { ok: '✅', unknown: '⚠️', mismatch: '❌', drift: '❌', invalid: '❌' }[r.status];
        log(`${mark} ${r.file}:${r.lineNo} — ${r.message}`);
      }
      log(`\n${checked} marked claim(s): ${errors.length} error(s), ${warnings.length} unreadable.`);
    }
    return errors.length || (strict && warnings.length) ? 1 : 0;
  }

  err(`unknown command \`${command}\`\n\n${USAGE}`);
  return 1;
}

const stripClaim = ({ claim, ...rest }) => ({ ...rest, marker: claim.raw, metric: claim.metric });

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
