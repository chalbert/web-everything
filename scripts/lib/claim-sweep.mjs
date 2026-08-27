/**
 * claim-sweep.mjs — sweep a CORRECTED claim across every site that still carries it, and REPORT the sweep
 * (#3307, under the review-efficacy watch #3318).
 *
 * ── THE DEFECT THIS EXISTS FOR ────────────────────────────────────────────────────────────────────────
 * A correction lands where the error was NOTICED, and the same claim survives everywhere it was copied.
 * `3290` records it bouncing one PR four rounds in a row; every round fixed the site the reviewer had
 * quoted and left a site the reviewer had not reached yet. Four instances from a single day in this repo:
 *
 *   • A corpus figure of **84 recorded verdicts** (the measured counts are 92 cases, 87 with a lens row,
 *     86 of those `correctness`). It was copied from parent card `3318` into child card `3319` and into a
 *     comment in `we:scripts/lib/jury-core.mjs`. Correcting one did not correct the others.
 *   • A card id believed nonexistent was "corrected" to a new id across a commit message, a PR title and a
 *     PR body — and the original turned out to be real and in flight. Three sites rewritten, all wrong.
 *   • Retracted — "the gate never runs against backlog cards" is FALSE; it does. It was written into a
 *     card, quoted into a second card, and repeated in a PR body before being refuted, and two of the
 *     three had to be chased down separately. Quoted here as a specimen, never asserted.
 *   • A retraction that named its own mistake correctly and then MISNAMED the sibling retraction it cited.
 *
 * The shape is always the same: **a claim has more sites than the person correcting it remembers.**
 *
 * ── WHY THIS REPORTS AND DOES NOT REWRITE ─────────────────────────────────────────────────────────────
 * Blind rewriting is what produced the second case above: three sites confidently "corrected" to a value
 * that was itself wrong, which is strictly worse than the one wrong site it started from. A sweep that
 * rewrites turns "I remembered one site" into "I damaged N sites" whenever the replacement is wrong, and
 * whether the replacement is right is exactly the judgment a sweep cannot make (#51 hookable-vs-judgment:
 * FIND the sites mechanically, leave the RULING to a human). So there is no rewrite path here, not even a
 * confirmed one — `--fix` / `--rewrite` are recognised and REFUSED with that reason, so a caller reaching
 * for them gets the argument rather than an "unknown flag".
 *
 * ── WHAT IS AND IS NOT FILTERED (this section used to overclaim; see the retraction below) ────────────
 * A near-match, an ambiguous paraphrase, and a bare number in an unrelated context are precisely what the
 * human doing the correcting needs to see; a sweep that silently drops them is worse than one that admits
 * uncertainty, because it reads as completeness. A site that scores into a tier is REPORTED and labelled,
 * and whether it scores does NOT depend on what else its paragraph happens to contain:
 *
 *   exact       verbatim substring                              → confidence `confirmed`
 *   normalized  matches once blockquote markers, emphasis,      → confidence `confirmed`
 *               smart quotes and whitespace are folded (prose
 *               wraps — pinning a wrap is the `doc-prose.mjs` lesson)
 *   near        sentence shingle-containment AT OR ABOVE the    → confidence `undecided`
 *               threshold, top of the range included
 *   token       a distinctive token (a numeral, a `#NNNN`, a    → confidence `undecided`
 *               born-as hash, a `we:` path, a backticked span)
 *               in a sentence that is otherwise unrelated
 *
 * RETRACTED — this section used to head itself "WHY NOTHING IS SILENTLY FILTERED" and to promise, flatly,
 * "Every site this finds is REPORTED". False when written, in FIVE ways, all found by review #1620 —
 * THREE that dropped a site to no tier at all, and TWO that laundered a live one into ALREADY RETRACTED
 * and took the exit code to 0 "clean". Dropped to no tier:
 *   • the `near` tier excluded a containment of exactly 1, so the STRONGEST non-substring paraphrase it
 *     could see reached no tier at all and left no trace in the report;
 *   • the paragraph scan recorded a folded hit and then `continue`d past the whole sentence loop, so an
 *     independent, token-less paraphrase sharing that paragraph reached no tier — absent from survivors,
 *     from undecided, from retractedSites AND from `coverage.skipped` alike. The same two sentences split
 *     across two paragraphs both reported, so the answer depended on the blank line, not on the text;
 *   • the numeral scanner swallowed a following comma into the token itself, so a claim writing `84,`
 *     looked for that exact comma-adjacency and never saw `84` written bare (`NUMERAL_RE`). Its mirror
 *     was in `tokenPattern`, whose numeric tail rejected ANY following comma, so a SITE writing `84,`
 *     was dropped just as silently. Round 5; the review prescribed the first half, the second was found
 *     by testing the fix.
 * Laundered into ALREADY RETRACTED:
 *   • `retractionNear` matched a dozen short English phrases as bare substrings anywhere in a ±6-line
 *     window, so an unretracted claim beside "…on the old display it read as a jumble of digits" was
 *     filed under ALREADY RETRACTED and the CLI exited 0 "clean";
 *   • a `~~strike~~` ANYWHERE on the site's own line counted as retracting it, without asking whether the
 *     strike covered the claim — against this repo's DOMINANT strike shape, old value struck and the
 *     corrected one asserted beside it (`struckCovers`). Round 4.
 *
 * RETRACTED, SECOND ORDER — this paragraph previously read "Both are fixed and both are pinned by tests
 * that redden on reversion". The first half was true and the second was not, for the FIRST fix's own
 * sibling change: removing the near tier's per-block `break` was pinned by a test named for it whose two
 * fixture lines were literal substrings of the claim, so the `exact` scan answered it and the near tier
 * never ran. Re-introducing the `break` left the suite green. That is round-1 finding 3 — "fixed here,
 * with nothing protecting it" — recurring inside the round-2 prevention. All five are now fixed and each
 * is pinned by a mutation that was actually re-run in the lane, not asserted.
 *
 * RETRACTED, THIRD ORDER — the list above said "THREE ways", and the two counts below said "All three".
 * That was written at round 3 and left standing through rounds 4 and 5, each of which found another way:
 * the strike-coverage laundering and the numeral-comma drop. Five, not three. Corrected here, on the card
 * and in the PR body together — leaving a count corrected in one place and stale in another is the exact
 * defect this module exists to catch, and it is the one this PR has been bounced for most.
 *
 * A promise of completeness is exactly the thing this module must not make loosely, because the whole
 * point of it is that "no output" reads as "nothing to find". The wording is now scoped to what the code
 * actually does.
 *
 * Retraction is an annotation rather than a filter, but it is NOT free of judgment: marking a site
 * retracted removes it from `survivors` and can take the exit code to 0, so the detector is deliberately
 * ANCHORED (see `retractionNear`) and errs toward leaving a site a SURVIVOR. An over-reported survivor
 * costs one glance; a laundered one costs a bounce round. A site sitting under a retraction LABEL is the
 * correction quoting the claim, not a survival of it — and it is still listed, with `retracted: true`, so
 * the sweep can be seen to have looked at it. Only an UNRETRACTED `confirmed` site is a survivor, and
 * only survivors drive the exit status.
 *
 * ── WHAT THIS CANNOT COVER (stated in every report, never implied away) ───────────────────────────────
 * The corpus is `git ls-files` over the CURRENT working tree plus any documents the caller supplies with
 * `--document` (a PR body or title dumped to a file). It therefore does NOT see, and says so:
 *   • commit messages already written — history is not editable in place, so a surviving claim there is
 *     found only by re-reading the log, and is corrected by an erratum, not by an edit;
 *   • PR titles, bodies and review comments on GitHub, unless the caller dumps them in via `--document`;
 *   • merged PRs, whose bodies are effectively immutable in the same way;
 *   • the sibling repos in the constellation (Frontier UI, plateau-app) — a separate checkout each;
 *   • untracked, ignored and binary files, and files past the size cap (all counted, never hidden);
 *   • a paraphrase that shares no distinctive token with the claim — nothing to key on.
 * `report.completeness` is therefore ALWAYS `'partial'`. There is no code path that sets it otherwise.
 *
 * The module is I/O-free at its core: `sweepDocuments` is pure over an array of `{ path, text }`, and the
 * filesystem/git side (`collectDocuments`, `sweepRepo`) takes an injected `run`/`readFile` so the whole
 * thing is exercisable from a fixture with no repo.
 *
 * TODO(#3299/#3301): those two rules need the same retraction-marker vocabulary. When the first of them
 * lands, hoist `RETRACTION_MARKERS` to a shared module rather than letting two copies drift apart — two
 * lists disagreeing would make one rule fire exactly where the other negates.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeAllSync } from './write-all-sync.mjs';

// ── Vocabulary and tunables ───────────────────────────────────────────────────────────────────────────

/**
 * RETRACTED — this list used to be matched as a bare substring ANYWHERE in the neighbourhood:
 *
 *     export const RETRACTION_MARKERS = Object.freeze([
 *       'retracted', 'retraction', 'withdrawn', 'withdraws', 'superseded', 'no longer true',
 *       'this used to read', 'it read', 'used to say', 'this said', 'was wrong', 'were wrong',
 *       'corrected to', 'now reads', 'erratum', '~~',
 *     ]);
 *
 * That was wrong, and wrong in the one direction this tool cannot afford. Half those entries are ordinary
 * English. Measured over the tracked markdown at `origin/main` (4133 files, 300929 lines): the substring
 * rule put 11620 lines — 3.86% — inside a "retraction" window across 536 files, and the three commonest
 * markers were `superseded` (424), `it read` (133) and `was wrong` (124), EACH outnumbering `retracted`
 * (91) itself. (Quoted at `origin/main`, not at this branch: the branch's own retraction prose moves the
 * figures.) So an exact, verbatim, never-retracted claim sitting six lines from a sentence
 * like "on the old display it read as a jumble of digits" was reported under ALREADY RETRACTED and the CLI
 * exited 0 "clean" — the tool laundering the very miss it exists to catch.
 *
 * Detection is now ANCHORED, in the direction that fails loud: a neighbourhood is a retraction only when
 * it carries one of the shapes a retraction is actually written in. When in doubt the site stays a
 * SURVIVOR, because an over-reported survivor costs one glance and a laundered one costs a bounce round.
 */

/** Phrases specific enough to mark a retraction ANYWHERE in the neighbourhood. Word-bounded, never a
 *  bare substring — `no longer true` cannot be said by accident, `it read` can. */
export const RETRACTION_PHRASES = Object.freeze([
  'no longer true', 'no longer accurate', 'this used to read', 'this used to say',
  'used to read', 'used to say', 'corrected to', 'erratum',
]);

/** Words that mark a retraction only when the line LEADS with one, once blockquote, list, comment and
 *  emphasis leaders are stripped — the shape this repo actually writes:
 *    `**Retracted — it read …**`   `> Retracted:`   `// RETRACTED:`   `- Superseded by #1234`
 *  `superseded` in the middle of a sentence ("the superseded design") is NOT a retraction of the claim
 *  beside it; leading a line with it is. */
export const RETRACTION_LEAD_WORDS = Object.freeze([
  'retracted', 'retraction', 'retract', 'retracts', 'withdrawn', 'withdraws', 'withdrawal',
  'superseded', 'supersedes', 'erratum', 'correction',
]);

/** The combined vocabulary, kept as one export because `3299`/`3301` need to import exactly this and the
 *  TODO at the head of the file is about hoisting it. Membership here is NOT on its own a match — see
 *  `retractionNear` for which half is anchored how. */
export const RETRACTION_MARKERS = Object.freeze([...RETRACTION_LEAD_WORDS, ...RETRACTION_PHRASES]);

/** Lines either side of a site that count as its retraction neighbourhood. Six covers a quoted
 *  blockquote retraction of the shape this repo writes without reaching the next unrelated paragraph. */
export const RETRACTION_WINDOW = 6;

/** Default sentence shingle-containment above which a sentence is a `near` match. Deliberately loose:
 *  a false `near` costs one glance, a missed site costs a bounce round. */
export const NEAR_THRESHOLD = 0.6;

/** Extensions swept by default. Everything else is counted as skipped, never silently dropped. */
export const TEXT_EXTENSIONS = Object.freeze([
  '.md', '.mjs', '.js', '.cjs', '.jsx', '.ts', '.tsx', '.json', '.jsonl', '.html', '.css',
  '.yml', '.yaml', '.txt', '.sh', '.toml',
]);

/** How many undecided sites the TEXT renderer prints in full before summarising the tail by file. A
 *  rendering budget only: the report object and `--json` always carry every site. */
export const DEFAULT_PRINTED_UNDECIDED = 15;

/** Files larger than this are skipped (and counted) rather than read — a lockfile or a bundled asset. */
export const MAX_FILE_BYTES = 1_000_000;

/** The standing coverage gaps. Emitted with EVERY report; there is no "complete sweep" branch. */
export const NOT_COVERED = Object.freeze([
  'commit messages already written — git history is not editable in place; a surviving claim there needs an erratum, not an edit',
  'PR titles, bodies and review comments on GitHub — supply them with --document=<file> to bring them in range',
  'merged PRs, whose bodies are immutable in the same practical way as commit messages',
  'the sibling constellation repos (Frontier UI, plateau-app) — a separate checkout, so a separate sweep',
  'untracked, git-ignored, binary and over-size files (counted in coverage.skipped, never hidden)',
  'a paraphrase sharing no distinctive token with the claim — there is nothing to key on',
  'a retraction written WITHOUT a label — no leading `Retracted`/`Superseded`/`Correction`, no struck '
    + 'claim, no unambiguous phrase — is not recognised, so the site it covers is reported as a SURVIVOR. '
    + 'Deliberate: the detector errs toward over-reporting, because an over-reported survivor costs one '
    + 'glance and a laundered one costs a bounce round. Real example on this tree: '
    + 'we:backlog/3350-an-automated-rebase-defeats-the-drain-s-re-sync.md:76, where the retraction strikes '
    + 'the OLD wording two lines above and quotes the claim below it',
]);

// ── Pure text helpers ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fold a span of markdown/source prose to a single comparable line: blockquote markers and comment
 * leaders dropped, emphasis/backticks/strikethrough removed, smart quotes and dashes flattened,
 * whitespace collapsed, lowercased. Pure.
 *
 * Deliberately small — this must not become a markdown parser. It exists because prose WRAPS, and an
 * exact-substring-only sweep misses a claim purely because a paragraph was re-flowed or re-indented
 * (`we:scripts/lib/__tests__/doc-prose.mjs` records that lesson on this repo).
 * @param {string} s
 * @returns {string}
 */
export function normalizeText(s) {
  return String(s == null ? '' : s)
    .replace(/^[ \t]*(?:>+[ \t]?|\/\/[ \t]?|\*[ \t]|#+[ \t])/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * A numeral, with a comma treated as INTERNAL only where it is a thousands separator — i.e. followed by
 * exactly three digits. `300,929` is one token; the `84` in `84, and that changed later` is `84`, and the
 * sentence comma is left where it belongs, outside the token.
 *
 * RETRACTED — this used to be `/(?<![\w.])\d[\d,]*(?:\.\d+)?(?![\w])/g`, whose `[\d,]*` swallowed ANY
 * following comma, sentence punctuation included. Found by review #1620 round 5, reproduced against the
 * shipped module before touching it:
 *
 *     distinctiveTokens('the count moved 84, and that changed later')  ->  ['84,']
 *     tokenPattern('84,').test('the 84 verdicts are correct')          ->  false
 *
 * so a claim that happened to put a comma after its distinguishing numeral could no longer see that
 * numeral written bare anywhere else — the token tier reported NOTHING, with no `coverage.skipped` entry
 * to show for it. The fourth instance of this module's one recurring failure class; see the header.
 */
const NUMERAL_RE = /(?<![\w.])\d+(?:,\d{3})*(?:\.\d+)?(?![\w])/g;

/**
 * Distinctive tokens of a claim — the parts specific enough that their bare appearance elsewhere is worth
 * a human glance even when the surrounding sentence is unrecognisable. That is the tier that catches the
 * `84`-figure case, where the three sites share the numeral and almost nothing else.
 *
 * Numerals need at least two digits: a lone `3` appears everywhere and would drown the report.
 * @param {string} text
 * @returns {string[]} longest-first, so a longer token wins the line over a substring of itself
 */
export function distinctiveTokens(text) {
  const src = String(text == null ? '' : text);
  const out = new Set();
  for (const m of src.matchAll(/`([^`\n]{2,})`/g)) out.add(m[1].trim());
  for (const m of src.matchAll(/#\d{2,}/g)) out.add(m[0]);
  for (const m of src.matchAll(/\bx[a-z0-9]{6,7}\b/g)) out.add(m[0]);
  for (const m of src.matchAll(/\bwe:[^\s,;)`'"]+/g)) out.add(m[0]);
  for (const m of src.matchAll(NUMERAL_RE)) {
    if (m[0].replace(/\D/g, '').length >= 2) out.add(m[0]);
  }
  return [...out].filter(Boolean).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Escape a literal for use inside a RegExp. */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A word-boundary-ish matcher for a token, tightened for numerals so `84` never matches `184` or `8.42`.
 *
 * RETRACTED — the numeric tail used to be `(?![\w,]|\.\d)`, which rejected a match followed by ANY comma.
 * That was the MIRROR of the `NUMERAL_RE` defect above and had to be fixed with it: even once the claim
 * yields a clean `84`, `tokenPattern('84').test('the value is 84, roughly')` was `false`, so a SITE that
 * put a comma after the numeral was dropped just as silently as a CLAIM that did. Review #1620 round 5
 * prescribed only the `NUMERAL_RE` half; the half below was found by testing the fix and is fixed here
 * too, because either one alone leaves the same silent drop reachable from the other side.
 *
 * A comma now blocks the match only where it is a thousands separator (`84` inside `84,000`), never where
 * it is sentence punctuation.
 */
export function tokenPattern(token) {
  const t = String(token);
  const numeric = /^[\d,.]+$/.test(t);
  const lead = numeric ? '(?<![\\w.,])' : (/^[\w]/.test(t) ? '(?<![\\w])' : '');
  const tail = numeric ? '(?!\\w|,\\d{3}|\\.\\d)' : (/[\w]$/.test(t) ? '(?![\\w])' : '');
  return new RegExp(`${lead}${escapeRe(t)}${tail}`, 'g');
}

/** Word shingles (n-grams) of a normalized string, as a Set. */
function shingles(norm, n = 2) {
  const words = norm.split(' ').filter(Boolean);
  if (words.length < n) return new Set(words);
  const out = new Set();
  for (let i = 0; i + n <= words.length; i += 1) out.add(words.slice(i, i + n).join(' '));
  return out;
}

/**
 * Containment of the claim's shingles in a candidate's — |claim ∩ candidate| / |claim|. Asymmetric on
 * purpose: a long paragraph that fully restates a short claim should score 1, not be diluted by its own
 * length (Jaccard would punish exactly the case worth catching).
 * @returns {number} 0..1
 */
export function shingleContainment(claimNorm, candidateNorm) {
  const a = shingles(claimNorm);
  if (a.size === 0) return 0;
  const b = shingles(candidateNorm);
  let hit = 0;
  for (const s of a) if (b.has(s)) hit += 1;
  return hit / a.size;
}

/** Words carrying no discriminating power — dropped before scoring a token hit's relevance. */
const STOPWORDS = new Set(('a an the and or but of in on at to for from by with as is are was were be been '
  + 'it its this that these those not no all any so than then there here we our you your they their he she '
  + 'i do does did has have had can could should would may might will just only over under out up down '
  + 'about into per via each every one two some more most').split(' '));

/** Content words of a normalized string, punctuation stripped. */
export function contentWords(norm) {
  return String(norm || '').split(/[^a-z0-9#:._/-]+/i)
    .map((w) => w.replace(/^[.:_/-]+|[.:_/-]+$/g, ''))
    .filter((w) => w && !STOPWORDS.has(w));
}

/**
 * RELEVANCE of a candidate line to the claim — the share of the claim's content words it also carries.
 * Used ONLY to ORDER the undecided sites, never to drop one: a bare numeral matches everywhere (`84`
 * lands on two dozen `file:84` citations in this repo), and the human needs the plausible ones first.
 * @returns {number} 0..1
 */
export function relevance(claimNorm, candidateNorm) {
  const a = new Set(contentWords(claimNorm));
  if (a.size === 0) return 0;
  const b = new Set(contentWords(candidateNorm));
  let hit = 0;
  for (const w of a) if (b.has(w)) hit += 1;
  return hit / a.size;
}

/** Does `token` appear here as part of a `path:NN` / `NN-NN` source citation rather than as a quantity? */
export function looksLikeLineCitation(rawLine, token) {
  if (!/^\d+$/.test(String(token))) return false;
  const t = escapeRe(token);
  return new RegExp(`[\\w./-]+:\\d*${t}\\b|:\\d+-${t}\\b|\\b${t}-\\d+\\b|\\bline[s]? \\d*${t}\\b`, 'i').test(rawLine);
}

/** Split a normalized paragraph into sentences (crude, deliberately: `. `, `; `, `! `, `? `). */
function sentencesOf(norm) {
  return norm.split(/(?<=[.;!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** 1-based line number of a character offset. */
function lineAt(lineStarts, offset) {
  let lo = 0; let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

/** Offsets at which each line starts. */
function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

/**
 * Paragraph blocks: runs of consecutive non-blank lines. Each block carries its normalized text AND an
 * offset→line map, so a match found in the folded paragraph can be reported at the line it really starts
 * on. Without that map a wrapped match is attributed to the paragraph's FIRST line, which on a long
 * blockquote points the reader at an unrelated sentence — a citation that is precise and wrong.
 */
function paragraphsOf(lines) {
  const blocks = [];
  let cur = null;
  lines.forEach((raw, i) => {
    if (raw.trim() === '') { cur = null; return; }
    if (!cur) { cur = { startLine: i + 1, endLine: i + 1, lines: [raw], lineNos: [i + 1] }; blocks.push(cur); }
    else { cur.endLine = i + 1; cur.lines.push(raw); cur.lineNos.push(i + 1); }
  });
  return blocks.map((b) => {
    const pieces = [];
    const offsets = [];
    let at = 0;
    b.lines.forEach((raw, k) => {
      const n = normalizeText(raw);
      if (!n) return;
      if (pieces.length) at += 1; // the joining space
      offsets.push({ at, line: b.lineNos[k] });
      pieces.push(n);
      at += n.length;
    });
    return { ...b, raw: b.lines.join('\n'), norm: pieces.join(' '), offsets };
  });
}

/** The 1-based source line a character offset into `block.norm` came from. */
function lineForOffset(block, offset) {
  let line = block.startLine;
  for (const o of block.offsets) { if (o.at <= offset) line = o.line; else break; }
  return line;
}

/** Strip the leaders a retraction line can sit behind — blockquote, list bullet, ordered marker, comment
 *  leader, markdown heading, and up to two emphasis characters — so `> - **Retracted:` reduces to
 *  `Retracted:`. Applied to a fixpoint, because these nest in any order. Pure. */
export function stripLineLeaders(line) {
  let s = String(line == null ? '' : line);
  let prev;
  do {
    prev = s;
    s = s.replace(/^\s+/, '')
      .replace(/^>+/, '')
      .replace(/^<!--/, '')
      .replace(/^(?:\/\/+|\/\*+|#{1,6}(?=\s))/, '')
      .replace(/^(?:[-+\u2022\u00b7\u25e6]|\*(?!\*))\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^[*_~]{1,2}/, '');
  } while (s !== prev);
  return s;
}

// A lead word only counts as a LABEL, not as the subject of a sentence. `Retracted — …`, `RETRACTED:`,
// `**Retracted**`, `Superseded by #1234` are labels; `retraction's own neighbourhood is listed …` and
// `correction was half applied` are prose ABOUT retraction, and both of those really do occur in this
// PR's own card — an earlier cut of this anchor read them as retractions and laundered two live sites.
// So the word must be followed by a separator, an emphasis close, ` by `, or end of line.
const LEAD_RE = new RegExp(
  `^(${RETRACTION_LEAD_WORDS.map(escapeRe).join('|')})(?:\\s*[:\\-\u2013\u2014*_~)\\].,]|\\s+by\\b|\\s*$)`,
  'i',
);
const PHRASE_RE = new RegExp(`\\b(?:${RETRACTION_PHRASES.map(escapeRe).join('|')})\\b`, 'i');
/** A struck-through span, e.g. `~~All 84 recorded verdicts~~`. Global — a line can carry several. */
const STRUCK_RE = /~~([^~]+)~~/g;

/**
 * Does a strike on this line cover THIS SITE's own matched text — rather than merely sit somewhere on
 * the same physical line?
 *
 * RETRACTED — this test used to be `STRUCK_RE.test(own)`, i.e. "does the site's line contain a
 * strikethrough span anywhere". Wrong in the one direction this module forbids, and wrong against this
 * repo's DOMINANT strike shape rather than a contrived one: the convention here is to strike the OLD
 * value and assert the corrected one BESIDE it on the same line —
 *
 *     | ~~14 retain / 2 delete~~ -> **delete all 16 (WE holds zero impl)** |
 *
 * — so the strike covers the withdrawn text while the LIVE claim stands verbatim next to it. Sweeping
 * `delete all 16 (WE holds zero impl)` over that real card reported `tier: 'exact'` with
 * `retracted: true`, survivors 0, exit 0 "clean", on a claim that is the ACTIVE ruling there. Same
 * laundering class as the two earlier bugs (bare-substring markers; the block-level `continue`), on a
 * third code path.
 *
 * A strike now counts only when a struck span actually CONTAINS the text this site matched on — the
 * claim for `exact`/`normalized`, the folded sentence for `near`, the token for `token`. Comparison is
 * on `normalizeText`, which drops the `~~` itself, so span and match are compared as prose. When no
 * match text is supplied (`retractionNear` called directly on a line), the fallback is the strict one:
 * the strike counts only if it takes the WHOLE line, leaving no unstruck prose behind. Both directions
 * err toward leaving the site a SURVIVOR.
 *
 * @param {string} raw the site's own RAW line
 * @param {string|null} [covers] the text this site matched on, if known
 * @returns {boolean}
 */
export function struckCovers(raw, covers) {
  const line = String(raw == null ? '' : raw);
  const spans = [...line.matchAll(STRUCK_RE)].map((m) => m[1]);
  if (spans.length === 0) return false;
  const want = normalizeText(covers == null ? '' : covers);
  if (want) return spans.some((s) => normalizeText(s).includes(want));
  // Nothing to locate: only a line whose own content is ENTIRELY struck reads as a retraction of itself.
  return normalizeText(stripLineLeaders(line.replace(STRUCK_RE, ' '))) === '';
}

/**
 * Is the neighbourhood of `line` a retraction — i.e. does the correction itself quote the claim here?
 * Read against the RAW lines (normalisation eats `~~` and the emphasis the anchors key on).
 *
 * ANCHORED, not a substring scan. Exactly three shapes count, and nothing else does:
 *   1. a line in the window that LEADS with a retraction word once its leaders are stripped
 *      (`**Retracted — it read …**`, `> Retracted:`, `- Superseded by #1234`);
 *   2. an unambiguous retraction PHRASE anywhere in the window, word-bounded (`no longer true`);
 *   3. the SITE'S OWN MATCHED TEXT being struck through (`~~the old claim~~`) — a strike elsewhere in
 *      the window says nothing about this line, and a strike elsewhere ON this line says nothing about
 *      this claim. See `struckCovers`: the first rule read a window strike as covering the line, the
 *      second read a line strike as covering the claim, and both laundered live claims.
 * Anything short of those leaves the site a SURVIVOR. See RETRACTION_MARKERS above for the measurement
 * that forced this, and `3299`/`3301` before adding a fourth shape.
 *
 * @param {string[]} lines
 * @param {number} line 1-based
 * @param {{window?:number, covers?:string|null}} [opts] `covers` is the text this site matched on —
 *   without it the strike shape falls back to "the whole line is struck", never to "a strike is present".
 * @returns {{retracted:boolean, marker?:string, markerLine?:number}}
 */
export function retractionNear(lines, line, opts = {}) {
  const { window = RETRACTION_WINDOW, covers = null } = opts;
  const own = lines[line - 1];
  if (own !== undefined && struckCovers(own, covers)) {
    return { retracted: true, marker: '~~', markerLine: line };
  }
  const from = Math.max(0, line - 1 - window);
  const to = Math.min(lines.length, line + window);
  for (let i = from; i < to; i += 1) {
    const raw = String(lines[i] == null ? '' : lines[i]);
    const lead = LEAD_RE.exec(stripLineLeaders(raw));
    if (lead) return { retracted: true, marker: lead[1].toLowerCase(), markerLine: i + 1 };
    const phrase = PHRASE_RE.exec(raw);
    if (phrase) return { retracted: true, marker: phrase[0].toLowerCase(), markerLine: i + 1 };
  }
  return { retracted: false };
}

// ── The sweep ─────────────────────────────────────────────────────────────────────────────────────────

const TIER_RANK = { exact: 4, normalized: 3, near: 2, token: 1 };
const TIER_CONFIDENCE = { exact: 'confirmed', normalized: 'confirmed', near: 'undecided', token: 'undecided' };

/**
 * Every site of `claim` inside ONE document. Pure.
 * @param {{path:string, text:string, source?:string}} doc
 * @param {{text:string, tokens?:string[]}} claim
 * @param {{near?:number}} [opts]
 * @returns {Array<object>} sites, one per (path, line), highest tier kept
 */
export function sweepDocument(doc, claim, opts = {}) {
  const text = String(doc.text == null ? '' : doc.text);
  const claimText = String(claim.text == null ? '' : claim.text);
  if (!claimText.trim()) return [];
  const near = typeof opts.near === 'number' ? opts.near : NEAR_THRESHOLD;
  const lines = text.split('\n');
  const starts = lineStartsOf(text);
  const claimNorm = normalizeText(claimText);
  // UNION, never a replacement: an explicit `--token` adds a key to watch, it does not narrow the sweep.
  // Narrowing is how a site gets silently missed, which is the one outcome this tool exists to prevent.
  const tokens = [...new Set([...distinctiveTokens(claimText), ...(claim.tokens || [])])]
    .filter(Boolean).sort((a, b) => b.length - a.length || a.localeCompare(b));

  /** line → best site */
  const best = new Map();
  // `matched` is the text this site actually scored on — the claim, the folded sentence, or the token.
  // It travels with the site so `retractionNear` can ask whether a strike covers THIS claim rather than
  // whether the line carries a strike at all. It is not reported; it exists for that question alone.
  const record = (line, tier, excerpt, reason, matched) => {
    const prev = best.get(line);
    if (prev && TIER_RANK[prev.tier] >= TIER_RANK[tier]) return;
    best.set(line, { line, tier, excerpt, reason, matched });
  };

  // exact — verbatim substring
  if (claimText.length > 0) {
    let at = text.indexOf(claimText);
    while (at !== -1) {
      const line = lineAt(starts, at);
      record(line, 'exact', lines[line - 1].trim(), 'the claim appears verbatim', claimText);
      at = text.indexOf(claimText, at + Math.max(1, claimText.length));
    }
  }

  // normalized + near — paragraph-level, so a re-flowed or re-indented copy is still found
  for (const block of paragraphsOf(lines)) {
    if (!block.norm || !claimNorm) continue;
    // EVERY folded occurrence in the block, not just the first. This used to be a single `indexOf`
    // followed by `continue`, which dropped a second wrapped copy in the same paragraph outright.
    for (let at = block.norm.indexOf(claimNorm); at !== -1;
      at = block.norm.indexOf(claimNorm, at + Math.max(1, claimNorm.length))) {
      const line = lineForOffset(block, at);
      record(line, 'normalized', (lines[line - 1] || '').trim(),
        'matches once blockquote markers, emphasis and line wrapping are folded — the claim may continue onto the following lines',
        claimText);
    }
    // NO `continue` past this loop. It used to skip the WHOLE sentence scan for any block that carried
    // a substring hit anywhere in it, so an independent, token-less paraphrase sharing the paragraph
    // with a verbatim copy reached no tier at all — not survivors, not undecided, not even
    // `coverage.skipped`. An uncounted omission, in the one report that must not have any.
    let cursor = 0;
    for (const sentence of sentencesOf(block.norm)) {
      const sIdx = block.norm.indexOf(sentence, cursor);
      if (sIdx !== -1) cursor = sIdx + sentence.length;
      // A sentence CARRYING the claim verbatim is already recorded just above at a confirmed tier.
      // Skipping it here is not a drop, and re-recording it would double-report one occurrence under
      // two line numbers whenever its sentence opens on an earlier line than the claim itself.
      if (sentence.includes(claimNorm)) continue;
      const score = shingleContainment(claimNorm, sentence);
      // The TOP of the range is IN it. This used to read `score >= near && score < 1`, on the unstated
      // assumption that a containment of exactly 1 can only mean the claim is a literal substring and was
      // therefore already caught above as `normalized`. That is false: containment counts DISTINCT claim
      // shingles, so a sentence that repeats a clause ("the gate never runs never runs against backlog
      // cards") contains every one of them while being no substring at all — and the substring case is
      // handled by the explicit skip above, not by scoring. Such a site scored 1, matched no other tier,
      // and vanished from a report whose whole promise is that nothing is silently filtered. It is the
      // STRONGEST paraphrase the near tier can see; it is now recorded.
      if (score >= near) {
        // The excerpt is the FOLDED sentence that matched, not the raw first line of the paragraph: a
        // paraphrase is usually mid-blockquote, and quoting the wrong line reads as a false positive.
        // No `break`: a paragraph can restate the claim twice, and stopping at the first sentence hid
        // the second — the same silent-drop family as the `score < 1` bug above. `record` already keeps
        // one site per line, so a repeated sentence on one line still collapses to one entry.
        record(sIdx === -1 ? block.startLine : lineForOffset(block, sIdx), 'near', sentence,
          `paraphrase — ${Math.round(score * 100)}% of the claim's word-pairs appear in this folded sentence`,
          sentence);
      }
    }
  }

  // token — a distinctive token standing in otherwise unrelated prose
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (best.has(line)) return;
    for (const token of tokens) {
      if (tokenPattern(token).test(raw)) {
        // Labelled, never dropped: `84` in `platform-decisions.md:84-89` is a source citation, not the
        // claim's quantity — but deciding that is the reader's call, so it is annotated and still listed.
        const cite = looksLikeLineCitation(raw, token);
        record(line, 'token', raw.trim(),
          `carries the claim's distinctive token \`${token}\` in a sentence that does not otherwise match`
          + (cite ? ' — and reads as a `path:line` citation here, not as the claim\'s quantity' : ''),
          token);
        return;
      }
    }
  });

  return [...best.values()]
    .sort((a, b) => a.line - b.line)
    .map((site) => {
      const r = retractionNear(lines, site.line, { covers: site.matched });
      const score = TIER_RANK[site.tier] >= 3 ? 1 : relevance(claimNorm, normalizeText(site.excerpt));
      return {
        path: doc.path,
        source: doc.source || 'working-tree',
        line: site.line,
        tier: site.tier,
        confidence: TIER_CONFIDENCE[site.tier],
        score: Math.round(score * 100) / 100,
        retracted: r.retracted,
        retractionMarker: r.marker || null,
        retractionLine: r.markerLine || null,
        excerpt: site.excerpt.length > 220 ? `${site.excerpt.slice(0, 217)}…` : site.excerpt,
        reason: site.reason,
      };
    });
}

/**
 * Sweep a whole corpus of already-loaded documents. Pure — this is the testable core.
 * @param {Array<{path:string, text:string, source?:string}>} documents
 * @param {{text:string, tokens?:string[]}} claim
 * @param {{near?:number, skipped?:Array<object>}} [opts]
 * @returns {object} the report
 */
export function sweepDocuments(documents, claim, opts = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  const sites = [];
  for (const doc of docs) sites.push(...sweepDocument(doc, claim, opts));

  const survivors = sites.filter((s) => s.confidence === 'confirmed' && !s.retracted);
  const retractedSites = sites.filter((s) => s.retracted);
  // ORDERED by relevance, not trimmed by it — a bare numeral lands on every `file:84` citation in the
  // tree, so the plausible sites have to come first or the honest ones are unreadable. Every site stays.
  const undecided = sites.filter((s) => s.confidence === 'undecided' && !s.retracted)
    .slice().sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);

  return {
    claim: {
      text: String(claim.text == null ? '' : claim.text),
      tokens: [...new Set([...distinctiveTokens(claim.text || ''), ...(claim.tokens || [])])].filter(Boolean),
    },
    // There is no branch that sets this to anything else — see NOT_COVERED and the module header.
    completeness: 'partial',
    sites,
    survivors,
    undecided,
    retractedSites,
    counts: {
      sites: sites.length,
      survivors: survivors.length,
      undecided: undecided.length,
      retracted: retractedSites.length,
      files: new Set(sites.map((s) => s.path)).size,
      filesWithSurvivors: new Set(survivors.map((s) => s.path)).size,
    },
    coverage: {
      documentsScanned: docs.length,
      sources: [...new Set(docs.map((d) => d.source || 'working-tree'))].sort(),
      skipped: opts.skipped || [],
      notCovered: [...NOT_COVERED],
    },
    // Report-only, always. No call path in this module writes to any swept file.
    rewrote: false,
  };
}

// ── Filesystem / git side (injected, so the core stays testable) ──────────────────────────────────────

/** Default git runner — spawnSync, non-throwing. */
export function gitRun(args, opts = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { status: r.status == null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function hasTextExtension(path) {
  return TEXT_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

/**
 * Load the tracked working-tree corpus plus any caller-supplied documents.
 * @param {{cwd?:string, paths?:string[], extraDocuments?:Array<{path:string, source?:string}>,
 *          run?:typeof gitRun, readFile?:(p:string)=>string}} [o]
 * @returns {{documents:Array<object>, skipped:Array<object>}}
 */
export function collectDocuments(o = {}) {
  const run = o.run || gitRun;
  const readFile = o.readFile || ((p) => readFileSync(p, 'utf8'));
  const cwd = o.cwd || process.cwd();
  const paths = o.paths && o.paths.length ? o.paths : [];

  // `--` first: without it a pathspec beginning with `-` is read by git as an OPTION, and a sweep
  // narrowed with `--path=-foo` would silently run against the wrong corpus.
  const listed = run(['ls-files', '-z', '--', ...paths], { cwd });
  const documents = [];
  const skipped = [];
  if (listed.status !== 0) {
    skipped.push({ path: '(git ls-files)', why: `git ls-files failed: ${listed.stderr.trim() || 'non-zero exit'}` });
  } else {
    for (const rel of listed.stdout.split('\0').filter(Boolean)) {
      if (!hasTextExtension(rel)) { skipped.push({ path: rel, why: 'not a swept text extension' }); continue; }
      let text;
      try { text = readFile(`${cwd}/${rel}`); } catch (err) {
        skipped.push({ path: rel, why: `unreadable: ${err && err.code ? err.code : 'error'}` }); continue;
      }
      if (text.length > MAX_FILE_BYTES) { skipped.push({ path: rel, why: `over ${MAX_FILE_BYTES} bytes` }); continue; }
      if (text.includes('\u0000')) { skipped.push({ path: rel, why: 'binary' }); continue; }
      documents.push({ path: rel, text, source: 'working-tree' });
    }
  }

  for (const extra of o.extraDocuments || []) {
    try {
      documents.push({ path: extra.path, text: readFile(extra.path), source: extra.source || 'supplied-document' });
    } catch (err) {
      skipped.push({ path: extra.path, why: `unreadable supplied document: ${err && err.code ? err.code : 'error'}` });
    }
  }
  return { documents, skipped };
}

/**
 * Sweep the repository for a claim. Thin: collect, then run the pure core.
 * @param {{text:string, tokens?:string[]}} claim
 * @param {object} [o] — as `collectDocuments`, plus `near`
 */
export function sweepRepo(claim, o = {}) {
  const { documents, skipped } = collectDocuments(o);
  return sweepDocuments(documents, claim, { near: o.near, skipped });
}

// ── Reporting ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Render a report as text. Every section is unconditional — a sweep that finds nothing still prints what
 * it could not cover, because "no output" reads as "nothing to find" and that is the failure mode.
 * @param {object} report
 * @returns {string}
 */
export function formatReport(report, opts = {}) {
  // A RENDERING cap on the long undecided tail, never a filter on the report: `--json` and the returned
  // object always carry every site, and the tail line below names exactly how many were not printed.
  const max = typeof opts.maxUndecided === 'number' ? opts.maxUndecided : DEFAULT_PRINTED_UNDECIDED;
  const out = [];
  const claim = report.claim.text.replace(/\s+/g, ' ').trim();
  out.push('CLAIM SWEEP — report only, nothing was rewritten.');
  out.push(`  claim:  ${claim.length > 160 ? `${claim.slice(0, 157)}…` : claim}`);
  out.push(`  tokens: ${report.claim.tokens.length ? report.claim.tokens.map((t) => `\`${t}\``).join(' ') : '(none)'}`);
  out.push('');

  const block = (title, sites, note, limit) => {
    out.push(`${title} — ${sites.length}`);
    if (note) out.push(`  ${note}`);
    if (!sites.length) out.push('  (none)');
    const shown = limit && limit > 0 ? sites.slice(0, limit) : sites;
    for (const s of shown) {
      out.push(`  ${s.path}:${s.line}  [${s.tier} ${s.score}]${s.retracted ? ` (retracted near line ${s.retractionLine})` : ''}`);
      out.push(`      ${s.excerpt}`);
      out.push(`      ↳ ${s.reason}`);
    }
    if (shown.length < sites.length) {
      const rest = sites.slice(shown.length);
      const byFile = new Map();
      for (const s of rest) byFile.set(s.path, (byFile.get(s.path) || 0) + 1);
      out.push(`  … ${rest.length} lower-relevance site(s) not printed — NOT filtered out; re-run with`);
      out.push('    --json (or --max-undecided=0) to see every one. Files carrying them:');
      for (const [path, n] of [...byFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        out.push(`      ${path} (${n})`);
      }
    }
    out.push('');
  };

  block('SURVIVING SITES (confirmed, unretracted)', report.survivors,
    'the claim still stands here — correct each, or mark it retracted.');
  block('UNDECIDED (reported, NOT filtered — a human decides; most relevant first)', report.undecided,
    'a paraphrase, a near-match, or the claim\'s token in unrelated prose.', max);
  block('ALREADY RETRACTED (the correction quoting its own claim)', report.retractedSites,
    'listed so the sweep can be seen to have looked at them; not survivors.');

  out.push('COVERAGE');
  out.push(`  completeness: ${report.completeness} — this sweep is NOT exhaustive.`);
  out.push(`  scanned: ${report.coverage.documentsScanned} documents (${report.coverage.sources.join(', ') || 'none'})`);
  out.push(`  skipped: ${report.coverage.skipped.length} files (wrong extension, binary, over-size or unreadable)`);
  out.push('  NOT covered by this sweep:');
  for (const gap of report.coverage.notCovered) out.push(`    • ${gap}`);
  out.push('');
  out.push(report.counts.survivors
    ? `RESULT: ${report.counts.survivors} surviving site(s) across ${report.counts.filesWithSurvivors} file(s), `
      + `out of ${report.counts.sites} site(s) seen in ${report.counts.files} file(s). Fix each, then re-run.`
    : 'RESULT: no surviving site in the covered corpus. The gaps above are still unswept.');
  return `${out.join('\n')}\n`;
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────────────

export const USAGE = `usage: node scripts/lib/claim-sweep.mjs --claim="<the corrected claim>" [options]

  --claim=<text>        the claim to sweep for, as it was written at the site you corrected
  --claim-file=<path>   read the claim from a file instead (use for multi-line claims)
  --token=<literal>     add a distinctive token to key on (repeatable); defaults are derived
  --path=<pathspec>     limit the working-tree corpus (repeatable), e.g. --path=backlog --path=docs
  --document=<path>     sweep an extra document that is not in the tree (repeatable) — dump a PR
                        body or title to a file and pass it here, or it is NOT covered
  --near=<0..1>         sentence shingle-containment threshold for the \`near\` tier (default 0.6)
  --max-undecided=<n>   how many undecided sites the TEXT report prints in full (default 15, 0 = all).
                        A rendering budget only — the tail is summarised by file and --json is complete
  --json                emit the report as JSON instead of text
  --help                this message

REPORT ONLY. There is no rewrite path, deliberately: a sweep that rewrites turns one wrong site into N
wrong sites whenever the replacement is itself wrong, which is exactly what happened when a card id was
"corrected" across a commit message, a PR title and a PR body and the original turned out to be real.
Whether the replacement is right is a human judgment; finding every site is not.

Exit: 0 no surviving site · 1 surviving site(s) found · 2 usage error.`;

/** Parse `--k=v` / `--k` flags, collecting repeats into arrays. Pure over an explicit argv. */
export function parseFlags(argv) {
  const flags = {};
  for (const arg of argv || []) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq === -1 ? true : arg.slice(eq + 1);
    if (key in flags) flags[key] = [].concat(flags[key], value);
    else flags[key] = value;
  }
  return flags;
}

const asArray = (v) => (v === undefined ? [] : [].concat(v).filter((x) => typeof x === 'string'));

/**
 * CLI entry. Pure over `argv` apart from the injected IO — returns an exit code and never calls
 * `process.exit` itself, so a test can drive it.
 * @param {string[]} argv
 * @param {{write?:(s:string)=>void, err?:(s:string)=>void, sweep?:typeof sweepRepo, readFile?:(p:string)=>string}} [io]
 * @returns {number} exit code
 */
export function main(argv, io = {}) {
  const write = io.write || ((s) => writeAllSync(1, s));
  const err = io.err || ((s) => process.stderr.write(s));
  const flags = parseFlags(argv);

  if (flags.help || argv.length === 0) { err(`${USAGE}\n`); return 2; }

  // Recognised and REFUSED, so reaching for it returns the argument rather than "unknown flag".
  if (flags.fix || flags.rewrite || flags.apply) {
    err('claim-sweep is REPORT-ONLY and has no rewrite path.\n'
      + 'Rewriting every site is how one wrong claim becomes N wrong claims: a card id was once "corrected"\n'
      + 'across a commit message, a PR title and a PR body, and the original turned out to be real — three\n'
      + 'sites rewritten, all of them wrong. Whether the replacement is right is a judgment this tool cannot\n'
      + 'make. Read the report, then edit each site yourself.\n');
    return 2;
  }

  let claimText = typeof flags.claim === 'string' ? flags.claim : '';
  if (typeof flags['claim-file'] === 'string') {
    const readFile = io.readFile || ((p) => readFileSync(p, 'utf8'));
    try { claimText = readFile(flags['claim-file']); } catch {
      err(`cannot read --claim-file=${flags['claim-file']}\n`); return 2;
    }
  }
  if (!claimText.trim()) { err(`--claim (or --claim-file) is required.\n\n${USAGE}\n`); return 2; }

  const near = typeof flags.near === 'string' ? Number(flags.near) : undefined;
  if (near !== undefined && !(near >= 0 && near <= 1)) { err('--near must be between 0 and 1.\n'); return 2; }

  const maxUndecided = typeof flags['max-undecided'] === 'string' ? Number(flags['max-undecided']) : undefined;
  if (maxUndecided !== undefined && !(Number.isInteger(maxUndecided) && maxUndecided >= 0)) {
    err('--max-undecided must be a non-negative integer (0 = print all).\n'); return 2;
  }

  const sweep = io.sweep || sweepRepo;
  const report = sweep(
    { text: claimText, tokens: asArray(flags.token) },
    {
      paths: asArray(flags.path),
      extraDocuments: asArray(flags.document).map((p) => ({ path: p, source: 'supplied-document' })),
      near,
      readFile: io.readFile,
    },
  );

  write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report, { maxUndecided }));
  return report.counts.survivors > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '.')).href) {
  // (a) from write-all-sync.mjs: set exitCode and return, so stdout drains before Node exits.
  process.exitCode = main(process.argv.slice(2));
}
