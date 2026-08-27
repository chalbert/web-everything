/**
 * @file claim-sweep.test.mjs — proof of the #3307 corrected-claim sweep.
 *
 * The specimen is REAL and its true value is known: a corpus figure of "84 recorded verdicts" that was
 * copied from parent card `3318` into child card `3319` and into a comment in `we:scripts/lib/jury-core.mjs`.
 * The measured counts are 92 cases, 87 with a lens row, 86 of those `correctness` — so `84` is wrong at
 * every site, and correcting one site did not correct the others.
 *
 * The fixtures below reproduce that corpus at the moment the correction was HALF applied — `3318` already
 * carrying its retraction, `3319` still asserting the claim, `jury-core.mjs` still carrying it in a comment.
 * They are frozen strings rather than reads of the live tree on purpose: the live sites have since been
 * corrected, and a test that re-read them would go green for the wrong reason.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  normalizeText, distinctiveTokens, tokenPattern, shingleContainment, retractionNear,
  relevance, looksLikeLineCitation, stripLineLeaders,
  sweepDocument, sweepDocuments, collectDocuments, sweepRepo, formatReport, parseFlags, main,
  NOT_COVERED, RETRACTION_MARKERS, RETRACTION_PHRASES, RETRACTION_LEAD_WORDS,
} from '../claim-sweep.mjs';

// ── The real specimen, frozen at the half-applied moment ──────────────────────────────────────────────

/** The claim as it was written, at the site that was corrected first.
 *  Retracted — the figure is false: the measured counts are 92 cases, 87 carrying a lens row, 86 of
 *  those `correctness`. It is quoted here as a fixture, never asserted. */
const CLAIM_84 = 'All 84 recorded verdicts ran correctness alone.';

/** Parent card `3318` — already corrected: the figure survives only inside its own retraction. */
const CARD_3318 = `# Review-efficacy watch

| Verdicts that recorded a lens row | 87 of 92 — **every one of them a single row**; 5 recorded none |

> **Retracted — three more rows of this table were wrong, re-counted 2026-08-26.**
> It still read *"Verdicts that ran a single lens | 84 of 84 (100%), always \`correctness\`"*. There is no
> population of 84 anywhere in the corpus — it holds 92 cases, 87 of which record a lens row.
`;

/** Child card `3319` — NOT yet corrected. The surviving site the sweep has to name.
 *  Retracted — the figure below is false: 92 cases, 87 with a lens row, 86 of those `correctness`.
 *  It is a frozen replay of what the card said on 2026-08-26, not an assertion — and the label is here
 *  so that running this tool over its own tree reports the fixture as withdrawn rather than surviving. */
const CARD_3319_BEFORE = `# Run the security lens once per code PR

All 84 recorded verdicts ran correctness alone. Security ran once and found two real forgery holes in
we:scripts/operations/explore-io.mjs, the only lens with evidence it sees something the incumbent misses.

## Done when

1. **Executable** — the security lens runs once per code PR.
`;

/** `jury-core.mjs` — the third site, carrying the figure in a code comment with no shared sentence. */
const JURY_CORE_BEFORE = `export const MANDATE_LENSES = Object.freeze({
  // Across PRs #1428-#1567 the correctness juror accepted 80 of 86 lens rows, yet 30 of 84 verdicts
  // recorded \`changes\`, so roughly 24 bounces were an operator raising something no lens was looking for.
  CLAIM_ACCURACY: 'claim-accuracy',
});
`;

/** The PR body — not in the tree, so it is only in range when supplied as a document.
 *  Retracted — false for the same reason as the fixture above: a frozen replay, never a claim. */
const PR_BODY_BEFORE = `## What this does

Sizes the security lens against the evidence. All 84 recorded verdicts ran correctness alone.
`;

const corpusBefore = () => [
  { path: 'backlog/3318-review-efficacy-watch.md', text: CARD_3318 },
  { path: 'backlog/3319-run-the-security-lens-once-per-code-pr.md', text: CARD_3319_BEFORE },
  { path: 'scripts/lib/jury-core.mjs', text: JURY_CORE_BEFORE },
];

const at = (report, path) => report.sites.filter((s) => s.path === path);

// ── #3307 — the acceptance cases ──────────────────────────────────────────────────────────────────────

describe('#3307 claim-sweep — the real 84-verdicts specimen', () => {
  it('#3307 names the SURVIVING site in the sibling card, not just the one already corrected', () => {
    const report = sweepDocuments(corpusBefore(), { text: CLAIM_84 });

    expect(report.survivors).toHaveLength(1);
    expect(report.survivors[0].path).toBe('backlog/3319-run-the-security-lens-once-per-code-pr.md');
    expect(report.survivors[0].line).toBe(3);
    expect(report.survivors[0].tier).toBe('exact');
    expect(report.survivors[0].confidence).toBe('confirmed');
    expect(report.survivors[0].retracted).toBe(false);
  });

  it('#3307 finds the third site — the code comment sharing only the numeral — and reports it as UNDECIDED', () => {
    const report = sweepDocuments(corpusBefore(), { text: CLAIM_84 });
    const juryHits = at(report, 'scripts/lib/jury-core.mjs');

    expect(juryHits.length).toBeGreaterThan(0);
    const hit = juryHits.find((s) => s.excerpt.includes('30 of 84'));
    expect(hit).toBeDefined();
    expect(hit.tier).toBe('token');
    expect(hit.confidence).toBe('undecided');
    expect(hit.reason).toContain('84');
    // Undecided, but never dropped — that is the whole contract.
    expect(report.undecided).toContainEqual(hit);
  });

  it('#3307 lists the ALREADY-RETRACTED site instead of silently filtering it', () => {
    const report = sweepDocuments(corpusBefore(), { text: CLAIM_84 });
    const parentHits = at(report, 'backlog/3318-review-efficacy-watch.md');

    expect(parentHits.length).toBeGreaterThan(0);
    expect(parentHits.every((s) => s.retracted)).toBe(true);
    // Retracted sites are not survivors …
    expect(report.survivors.some((s) => s.path.includes('3318'))).toBe(false);
    // … but they ARE reported, with the marker that discounted them.
    expect(report.retractedSites.some((s) => s.path.includes('3318'))).toBe(true);
    expect(parentHits[0].retractionMarker).toBeTruthy();
  });

  it('#3307 brings a PR body into range only when it is supplied as a document', () => {
    const withoutBody = sweepDocuments(corpusBefore(), { text: CLAIM_84 });
    expect(withoutBody.survivors.some((s) => s.source === 'supplied-document')).toBe(false);

    const withBody = sweepDocuments(
      [...corpusBefore(), { path: 'pr-body.md', text: PR_BODY_BEFORE, source: 'supplied-document' }],
      { text: CLAIM_84 },
    );
    const bodyHit = withBody.survivors.find((s) => s.path === 'pr-body.md');
    expect(bodyHit).toBeDefined();
    expect(bodyHit.source).toBe('supplied-document');
    expect(withBody.counts.survivors).toBe(2);
  });

  it('#3307 MUTATION — correcting only the quoted site leaves the sweep still reporting the others', () => {
    // This is the defect itself: fix the site the reviewer named, re-run, and the claim is still standing.
    const halfFixed = corpusBefore().map((d) => (d.path.includes('3319')
      ? { ...d, text: CARD_3319_BEFORE.replace(CLAIM_84, 'Of the 92 replayed cases, 87 recorded a lens row.') }
      : d));
    const report = sweepDocuments(halfFixed, { text: CLAIM_84 });

    expect(report.counts.survivors).toBe(0);
    // …and the code comment is STILL named, because the numeral is still there.
    expect(report.undecided.some((s) => s.path === 'scripts/lib/jury-core.mjs')).toBe(true);
    expect(report.counts.undecided).toBeGreaterThan(0);
  });

  it('#3307 MUTATION — re-introducing the claim in a fourth file raises it there', () => {
    const wider = [...corpusBefore(), { path: 'docs/agent/review.md', text: `Note: ${CLAIM_84}\n` }];
    const report = sweepDocuments(wider, { text: CLAIM_84 });

    expect(report.counts.survivors).toBe(2);
    expect(report.survivors.map((s) => s.path)).toContain('docs/agent/review.md');
  });

  it('#3307 MUTATION — dropping the retraction marker turns the parent card into a survivor', () => {
    const unmarked = corpusBefore().map((d) => (d.path.includes('3318')
      ? { ...d, text: CARD_3318.replace(/Retracted[^*]*/, 'Note ') }
      : d));
    const report = sweepDocuments(unmarked, { text: CLAIM_84 });
    // The quotation is now indistinguishable from an assertion, which is exactly right: without the
    // marker there is nothing in the document saying the figure is withdrawn.
    expect(report.sites.some((s) => s.path.includes('3318') && !s.retracted)).toBe(true);
  });
});

describe('#3307 claim-sweep — matching tiers', () => {
  it('#3307 finds a re-flowed and blockquoted copy that an exact grep misses', () => {
    const wrapped = { path: 'backlog/x.md', text: '> A claim that\n> *was* copied\n>   across three sites.\n' };
    const claim = 'A claim that was copied across three sites.';
    expect(wrapped.text.includes(claim)).toBe(false); // a plain grep is blind here
    const sites = sweepDocument(wrapped, { text: claim });
    expect(sites[0].tier).toBe('normalized');
    expect(sites[0].confidence).toBe('confirmed');
  });

  it('#3307 reports a paraphrase as `near`/undecided rather than dropping it', () => {
    // The specimen is the second real case from `3307`'s evidence: a claim written into a card, quoted
    // into a second card and repeated in a PR body before being refuted.
    // Retracted — the gate DOES run against backlog cards; the strings below are a frozen replay of a
    // refuted claim, used as fixture text, never an assertion.
    const claim = 'the gate never runs against backlog cards at all';
    const doc = { path: 'docs/a.md', text: 'We noted that the gate never runs against backlog cards in practice.\n' };
    const sites = sweepDocument(doc, { text: claim });
    expect(sites).toHaveLength(1);
    expect(sites[0].tier).toBe('near');
    expect(sites[0].confidence).toBe('undecided');
    expect(sites[0].reason).toMatch(/paraphrase/);
  });

  it('#3307 keeps the highest tier per line — an exact hit is never demoted to a token hit', () => {
    const doc = { path: 'a.md', text: `${CLAIM_84}\n` };
    const sites = sweepDocument(doc, { text: CLAIM_84 });
    expect(sites).toHaveLength(1);
    expect(sites[0].tier).toBe('exact');
  });

  it('#3307 an explicit --token ADDS a key rather than narrowing the sweep', () => {
    const doc = { path: 'a.md', text: 'the id x7kopnm was believed nonexistent\n' };
    // The claim itself carries no `x7kopnm`; the caller adds it.
    const sites = sweepDocument(doc, { text: 'a card id was corrected across three sites' }, {});
    expect(sites).toHaveLength(0);
    const withToken = sweepDocument(doc, { text: 'a card id was corrected across three sites', tokens: ['x7kopnm'] });
    expect(withToken).toHaveLength(1);
    expect(withToken[0].tier).toBe('token');
  });
});

describe('#3307 claim-sweep — coverage is always declared partial', () => {
  it('#3307 every report says what it could not cover, even when it finds nothing', () => {
    const report = sweepDocuments([{ path: 'a.md', text: 'unrelated\n' }], { text: 'a claim nobody wrote' });
    expect(report.counts.sites).toBe(0);
    expect(report.completeness).toBe('partial');
    expect(report.coverage.notCovered).toEqual([...NOT_COVERED]);
    expect(report.coverage.notCovered.join(' ')).toMatch(/commit messages/);
    expect(report.coverage.notCovered.join(' ')).toMatch(/PR titles, bodies/);
  });

  it('#3307 the rendered report prints the gaps and the no-rewrite statement on a clean sweep', () => {
    const text = formatReport(sweepDocuments([{ path: 'a.md', text: 'unrelated\n' }], { text: 'nothing here' }));
    expect(text).toMatch(/report only, nothing was rewritten/i);
    expect(text).toMatch(/completeness: partial/);
    expect(text).toMatch(/NOT covered by this sweep/);
    expect(text).toMatch(/commit messages already written/);
    expect(text).toMatch(/no surviving site in the covered corpus/);
  });

  it('#3307 the rendered report names every surviving and undecided site', () => {
    const text = formatReport(sweepDocuments(corpusBefore(), { text: CLAIM_84 }));
    expect(text).toMatch(/SURVIVING SITES \(confirmed, unretracted\) — 1/);
    expect(text).toMatch(/backlog\/3319-run-the-security-lens-once-per-code-pr\.md:3/);
    expect(text).toMatch(/UNDECIDED \(reported, NOT filtered/);
    expect(text).toMatch(/scripts\/lib\/jury-core\.mjs:/);
    expect(text).toMatch(/ALREADY RETRACTED/);
    expect(text).toMatch(/backlog\/3318-review-efficacy-watch\.md:/);
  });

  it('#3307 report.rewrote is false and no document object is mutated', () => {
    const corpus = corpusBefore();
    const before = JSON.stringify(corpus);
    const report = sweepDocuments(corpus, { text: CLAIM_84 });
    expect(report.rewrote).toBe(false);
    expect(JSON.stringify(corpus)).toBe(before);
  });
});

describe('#3307 claim-sweep — the undecided tail is ORDERED, never trimmed', () => {
  // A bare numeral is the realistic worst case: the live tree carries `84` in ~60 unrelated places,
  // almost all of them `path:84` source citations. Ranking is what keeps the honest report readable.
  const noisy = () => [
    { path: 'backlog/3319.md', text: CARD_3319_BEFORE },
    { path: 'docs/a.md', text: 'see `we:docs/agent/platform-decisions.md:84-89` for the ruling\n' },
    { path: 'docs/b.md', text: 'the 84 verdicts recorded here are a different corpus entirely\n' },
    { path: 'docs/c.md', text: '`fui:blocks/droplist/Windowed.ts` lines 84-94 do the windowing\n' },
  ];

  it('#3307 ranks a site sharing more of the claim\'s words above a bare line citation', () => {
    const report = sweepDocuments(noisy(), { text: CLAIM_84 });
    expect(report.undecided[0].path).toBe('docs/b.md');
    expect(report.undecided[0].score).toBeGreaterThan(report.undecided[report.undecided.length - 1].score);
  });

  it('#3307 labels a `path:line` citation as such — and still lists it', () => {
    const report = sweepDocuments(noisy(), { text: CLAIM_84 });
    const cite = report.undecided.find((s) => s.path === 'docs/a.md');
    expect(cite).toBeDefined();
    expect(cite.reason).toMatch(/reads as a `path:line` citation here/);
    expect(cite.confidence).toBe('undecided');
  });

  it('#3307 the render cap is a RENDERING budget — the report object still carries every site', () => {
    const report = sweepDocuments(noisy(), { text: CLAIM_84 });
    expect(report.undecided.length).toBe(3);
    const text = formatReport(report, { maxUndecided: 1 });
    expect(text).toMatch(/UNDECIDED \(reported, NOT filtered[^\n]*\) — 3/);
    expect(text).toMatch(/2 lower-relevance site\(s\) not printed — NOT filtered out/);
    expect(text).toMatch(/--json \(or --max-undecided=0\) to see every one/);
    // The tail is accounted for by file, so nothing vanishes from the reader's view.
    expect(text).toMatch(/docs\/[ac]\.md \(1\)/);
    // …and 0 prints all of them.
    expect(formatReport(report, { maxUndecided: 0 })).not.toMatch(/not printed/);
  });

  it('#3307 the RESULT line separates surviving files from files merely seen', () => {
    const text = formatReport(sweepDocuments(noisy(), { text: CLAIM_84 }));
    expect(text).toMatch(/RESULT: 1 surviving site\(s\) across 1 file\(s\), out of 4 site\(s\) seen in 4 file\(s\)/);
  });

  it('#3307 --max-undecided must be a non-negative integer', () => {
    const errs = [];
    expect(main(['--claim=x', '--max-undecided=-2'], { write: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toMatch(/--max-undecided must be a non-negative integer/);
  });
});

// ── Units under the sweep ─────────────────────────────────────────────────────────────────────────────

describe('#3307 claim-sweep — text units', () => {
  it('#3307 normalizeText folds blockquotes, emphasis, smart quotes and wrapping', () => {
    expect(normalizeText('>  **All 84** recorded\n>  verdicts’ “rows” — ok'))
      .toBe('all 84 recorded verdicts\' "rows" - ok');
  });

  it('#3307 distinctiveTokens picks numerals, item ids, born-as hashes, we: paths and backticked spans', () => {
    const t = distinctiveTokens('84 of 92 per #3319 (`correctness`) in we:scripts/lib/jury-core.mjs, born x7kopnm');
    expect(t).toContain('84');
    expect(t).toContain('92');
    expect(t).toContain('#3319');
    expect(t).toContain('correctness');
    expect(t).toContain('we:scripts/lib/jury-core.mjs');
    expect(t).toContain('x7kopnm');
  });

  it('#3307 a single-digit numeral is not distinctive — it would drown the report', () => {
    expect(distinctiveTokens('exactly 3 rounds')).not.toContain('3');
  });

  it('#3307 tokenPattern for a numeral does not match inside a longer number', () => {
    expect(tokenPattern('84').test('184 rows')).toBe(false);
    expect(tokenPattern('84').test('8.42 seconds')).toBe(false);
    expect(tokenPattern('84').test('30 of 84 verdicts')).toBe(true);
    expect(tokenPattern('84').test('84.')).toBe(true);
  });

  it('#3307 shingleContainment is asymmetric — a long paragraph restating a short claim scores 1', () => {
    expect(shingleContainment('the gate never runs', 'we found that the gate never runs at all here')).toBe(1);
    expect(shingleContainment('the gate never runs', 'entirely unrelated prose')).toBe(0);
  });

  it('#3307 relevance scores by shared content words, ignoring stopwords', () => {
    expect(relevance('all 84 recorded verdicts ran correctness alone', '30 of 84 verdicts recorded changes'))
      .toBeCloseTo(3 / 6, 5);
    // A pure line citation scores ZERO — `file.md:84-89` is one address token, not the numeral `84` —
    // which is exactly why the citation hits sink to the bottom of the undecided list.
    expect(relevance('all 84 recorded verdicts ran correctness alone', 'see file.md:84-89')).toBe(0);
  });

  it('#3307 looksLikeLineCitation fires only for a numeral used as an address', () => {
    expect(looksLikeLineCitation('see `docs/x.md:84-89`', '84')).toBe(true);
    expect(looksLikeLineCitation('lines 84-94 do the windowing', '84')).toBe(true);
    expect(looksLikeLineCitation('30 of 84 verdicts', '84')).toBe(false);
    expect(looksLikeLineCitation('the `correctness` lens', 'correctness')).toBe(false);
  });

  it('#3307 retractionNear reads the RAW neighbourhood so `~~` survives — on the SITE\'s own line', () => {
    // RETRACTED — this case used to read:
    //     const lines = ['~~old claim~~', 'the claim'];
    //     expect(retractionNear(lines, 2).retracted).toBe(true);
    // i.e. a strike-through ANYWHERE in the +/-6-line window retracted the site. That was wrong: a struck
    // span on some other line says nothing about THIS one, and reading one as covering the other is how a
    // live claim got filed under ALREADY RETRACTED. A strike now counts only on the site's own line.
    expect(retractionNear(['~~old claim~~', 'other text'], 1).retracted).toBe(true);
    expect(retractionNear(['~~struck elsewhere~~', 'the claim'], 2).retracted).toBe(false);
    expect(retractionNear(['plain', 'the claim'], 2).retracted).toBe(false);
    expect(RETRACTION_MARKERS).toContain('retracted');
  });

  it('#3307 a retraction far outside the window does not launder a surviving site', () => {
    const lines = ['Retracted — an unrelated earlier note.', ...Array(20).fill(''), CLAIM_84];
    expect(retractionNear(lines, lines.length).retracted).toBe(false);
  });
});

// ── IO boundary + CLI ─────────────────────────────────────────────────────────────────────────────────

/** A scripted git runner + reader, so the filesystem side needs no real repo. */
function fakeRepo(files, extra = {}) {
  const run = () => ({ status: 0, stdout: `${Object.keys(files).join('\0')}\0`, stderr: '' });
  const readFile = (p) => {
    const rel = p.replace(/^\/repo\//, '');
    if (rel in files) return files[rel];
    if (p in extra) return extra[p];
    const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err;
  };
  return { run, readFile, cwd: '/repo' };
}

describe('#3307 claim-sweep — repo collection', () => {
  it('#3307 collects tracked text files and COUNTS what it skipped rather than hiding it', () => {
    const { run, readFile, cwd } = fakeRepo({
      'backlog/a.md': 'hello\n',
      'assets/logo.png': 'binary-ish',
      'scripts/b.mjs': '// hi\n',
    });
    const { documents, skipped } = collectDocuments({ cwd, run, readFile });
    expect(documents.map((d) => d.path)).toEqual(['backlog/a.md', 'scripts/b.mjs']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toEqual({ path: 'assets/logo.png', why: 'not a swept text extension' });
  });

  it('#3307 a supplied document joins the corpus with its own source label', () => {
    const { run, readFile, cwd } = fakeRepo({ 'backlog/a.md': 'hello\n' }, { '/tmp/body.md': PR_BODY_BEFORE });
    const { documents } = collectDocuments({
      cwd, run, readFile, extraDocuments: [{ path: '/tmp/body.md' }],
    });
    expect(documents).toHaveLength(2);
    expect(documents[1].source).toBe('supplied-document');
  });

  it('#3307 an unreadable supplied document is reported, not swallowed', () => {
    const { run, readFile, cwd } = fakeRepo({ 'backlog/a.md': 'hello\n' });
    const { skipped } = collectDocuments({ cwd, run, readFile, extraDocuments: [{ path: '/tmp/gone.md' }] });
    expect(skipped.some((s) => s.path === '/tmp/gone.md' && /unreadable supplied document/.test(s.why))).toBe(true);
  });

  it('#3307 a failing git ls-files degrades to an empty corpus WITH a skip reason', () => {
    const run = () => ({ status: 128, stdout: '', stderr: 'not a git repository\n' });
    const { documents, skipped } = collectDocuments({ cwd: '/repo', run, readFile: () => '' });
    expect(documents).toHaveLength(0);
    expect(skipped[0].why).toMatch(/git ls-files failed/);
  });

  it('#3307 sweepRepo wires collection into the pure core', () => {
    const { run, readFile, cwd } = fakeRepo({
      'backlog/3319-x.md': CARD_3319_BEFORE,
      'backlog/3318-x.md': CARD_3318,
    });
    const report = sweepRepo({ text: CLAIM_84 }, { cwd, run, readFile });
    expect(report.counts.survivors).toBe(1);
    expect(report.survivors[0].path).toBe('backlog/3319-x.md');
    expect(report.coverage.documentsScanned).toBe(2);
  });
});

describe('#3307 claim-sweep — CLI', () => {
  const capture = () => { const out = []; return { out, write: (s) => out.push(s) }; };

  it('#3307 parseFlags collects repeated flags into an array', () => {
    expect(parseFlags(['--path=backlog', '--path=docs', '--json'])).toEqual({ path: ['backlog', 'docs'], json: true });
  });

  it('#3307 exits 1 when a site survives and 0 when none does', () => {
    const sweep = (claim) => sweepDocuments(corpusBefore(), claim);
    const a = capture();
    expect(main(['--claim=' + CLAIM_84], { write: a.write, err: () => {}, sweep })).toBe(1);
    expect(a.out.join('')).toMatch(/SURVIVING SITES \(confirmed, unretracted\) — 1/);

    const b = capture();
    expect(main(['--claim=a claim nobody ever wrote here'], { write: b.write, err: () => {}, sweep })).toBe(0);
  });

  it('#3307 --fix / --rewrite is REFUSED with the reason, not treated as an unknown flag', () => {
    const errs = [];
    for (const flag of ['--fix', '--rewrite', '--apply']) {
      errs.length = 0;
      const code = main(['--claim=x', flag], { write: () => {}, err: (s) => errs.push(s), sweep: () => { throw new Error('must not sweep'); } });
      expect(code).toBe(2);
      expect(errs.join('')).toMatch(/REPORT-ONLY/);
      expect(errs.join('')).toMatch(/three\s+sites rewritten, all of them wrong/);
    }
  });

  it('#3307 --json emits the machine report including the coverage gaps', () => {
    const c = capture();
    const code = main(['--claim=' + CLAIM_84, '--json'], {
      write: c.write, err: () => {}, sweep: (claim) => sweepDocuments(corpusBefore(), claim),
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(c.out.join(''));
    expect(parsed.completeness).toBe('partial');
    expect(parsed.coverage.notCovered).toEqual([...NOT_COVERED]);
    expect(parsed.survivors[0].path).toContain('3319');
  });

  it('#3307 no claim, or --help, is a usage error carrying the no-rewrite rationale', () => {
    const errs = [];
    expect(main([], { write: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toMatch(/REPORT ONLY/);
    errs.length = 0;
    expect(main(['--json'], { write: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toMatch(/--claim \(or --claim-file\) is required/);
  });

  it('#3307 --near out of range is a usage error', () => {
    const errs = [];
    expect(main(['--claim=x', '--near=7'], { write: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toMatch(/--near must be between 0 and 1/);
  });

  it('#3307 --token reaches the sweep', () => {
    let seen = null;
    main(['--claim=a card id was corrected', '--token=x7kopnm'], {
      write: () => {}, err: () => {},
      sweep: (claim) => { seen = claim; return sweepDocuments([], claim); },
    });
    expect(seen.tokens).toEqual(['x7kopnm']);
  });

  it('#3307 --document reaches the sweep as a supplied document', () => {
    let seen = null;
    main(['--claim=x', '--document=/tmp/body.md', '--path=backlog'], {
      write: () => {}, err: () => {},
      sweep: (claim, o) => { seen = o; return sweepDocuments([], claim); },
    });
    expect(seen.extraDocuments).toEqual([{ path: '/tmp/body.md', source: 'supplied-document' }]);
    expect(seen.paths).toEqual(['backlog']);
  });
});

// ── #3307 review round 2 — the four defects the review found, each with a test that reddens without its fix ──

describe('#3307 claim-sweep — the near tier reports the TOP of its own range', () => {
  // Juror finding, claim-sweep.mjs near tier. `score >= near && score < 1` excluded a containment of
  // exactly 1 on the assumption that only a literal substring can score 1 — but containment counts
  // DISTINCT claim shingles, so a sentence repeating a clause contains all of them without being a
  // substring, and the block-level `indexOf` has already `continue`d past every block that IS one.
  // Such a site matched NO tier and vanished from the report. Prevention the review marked OWED.
  // Retracted — the claim text below is FALSE (the gate does run against backlog cards). It is reused
  // here because `3307`'s evidence names it as the no-distinctive-token specimen, not as an assertion.
  const CLAIM = 'the gate never runs against backlog cards';
  // A duplicated clause: every shingle of the claim is present, but the claim is no substring of it.
  const DUPED = 'the gate never runs never runs against backlog cards';

  it('#3307 a NON-SUBSTRING sentence scoring exactly 1 is a reported site, not a silent drop', () => {
    expect(shingleContainment(normalizeText(CLAIM), normalizeText(DUPED))).toBe(1);
    expect(normalizeText(DUPED).includes(normalizeText(CLAIM))).toBe(false); // not a substring
    const sites = sweepDocument({ path: 'a.md', text: `${DUPED}\n` }, { text: CLAIM });
    expect(sites).toHaveLength(1);
    expect(sites[0].tier).toBe('near');
    expect(sites[0].confidence).toBe('undecided');
    expect(sites[0].score).toBe(1);
  });

  it('#3307 MUTATION — restoring the `score < 1` exclusion loses the site entirely', () => {
    // The invariant in one line: across the near tier's whole range, containment at or above the
    // threshold ALWAYS yields a site. Re-adding `&& score < 1` reddens this at the top of the range.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    for (const candidate of [DUPED, 'the gate never runs against backlog cards in practice', CLAIM]) {
      const score = shingleContainment(normalizeText(CLAIM), normalizeText(candidate));
      const sites = sweepDocument({ path: 'a.md', text: `${candidate}\n` }, { text: CLAIM });
      expect({ candidate, score, sites: sites.length }).toEqual({ candidate, score, sites: 1 });
    }
  });

  // Two token-less NEAR paraphrases — neither is a substring of the claim, so neither can be picked up
  // by the document-wide `exact` scan or by the block's folded `indexOf`. Only the near tier can see
  // them, which is what makes them able to pin a near-tier regression.
  //
  // > **Retracted — an earlier cut of this test used the fixtures
  // > `'the gate never runs against backlog cards here.'` and
  // > `'And the gate never runs against backlog cards there.'`, and its name claimed to pin the near
  // > tier's removed `break`.** It pinned nothing: both lines CONTAIN the claim verbatim, so the
  // > document-wide `exact` scan reported them and the near tier never ran. Re-introducing the `break`
  // > left the suite green. Verified by mutation in this lane, not assumed.
  const NEAR_A = 'the gate never runs quickly against backlog cards.';
  const NEAR_B = 'the gate never runs at all against backlog cards.';

  it('#3307 both NEAR restatements in one paragraph report — the near tier really is the one that sees them', () => {
    // Retracted — fixture text repeating the false claim above, never an assertion.
    for (const line of [NEAR_A, NEAR_B]) {
      expect(normalizeText(line).includes(normalizeText(CLAIM))).toBe(false); // not a substring
      expect(shingleContainment(normalizeText(CLAIM), normalizeText(line))).toBeGreaterThanOrEqual(0.6);
    }
    const sites = sweepDocument({ path: 'a.md', text: `${NEAR_A}\n${NEAR_B}\n` }, { text: CLAIM });
    expect(sites.map((x) => [x.line, x.tier])).toEqual([[1, 'near'], [2, 'near']]);
  });

  it('#3307 MUTATION — a `break` in the near-tier sentence loop loses the second restatement', () => {
    // The invariant the name above depends on: N near restatements in one paragraph are N sites.
    // Restoring the `break` reddens this. It did NOT redden the fixtures this test used to carry.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    const sites = sweepDocument({ path: 'a.md', text: `${NEAR_A}\n${NEAR_B}\n` }, { text: CLAIM });
    expect(sites).toHaveLength(2);
  });

  it('#3307 a near paraphrase sharing a paragraph with a VERBATIM copy is reported, not swallowed', () => {
    // Round-3 juror finding. The block-level scan recorded the folded hit and then `continue`d past the
    // WHOLE sentence loop, so an independent token-less restatement sitting in the same paragraph
    // reached no tier — absent from survivors, undecided, retractedSites AND `coverage.skipped` alike.
    // Splitting the very same two sentences into two paragraphs reported both, which is what showed it
    // was the shared block and not the sentence doing it.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    const VERBATIM = 'the gate never runs against backlog cards, as noted earlier.';
    const together = sweepDocument({ path: 'a.md', text: `${VERBATIM}\n${NEAR_A}\n` }, { text: CLAIM });
    expect(together.map((x) => [x.line, x.tier])).toEqual([[1, 'exact'], [2, 'near']]);
    // Same two sentences, one blank line between them — the answer must not depend on the paragraphing.
    const apart = sweepDocument({ path: 'a.md', text: `${VERBATIM}\n\n${NEAR_A}\n` }, { text: CLAIM });
    expect(apart.map((x) => x.tier)).toEqual(together.map((x) => x.tier));
  });

  it('#3307 MUTATION — `continue`ing past the sentence loop after a folded hit drops the paraphrase', () => {
    // Stated as the invariant rather than as the mutation: whether a near paraphrase is reported is
    // independent of whether some OTHER line of its paragraph carries the claim verbatim.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    const VERBATIM = 'the gate never runs against backlog cards, as noted earlier.';
    for (const lead of [VERBATIM, 'An unrelated sentence about something else entirely.']) {
      const sites = sweepDocument({ path: 'a.md', text: `${lead}\n${NEAR_A}\n` }, { text: CLAIM });
      expect({ lead, near: sites.filter((x) => x.tier === 'near').map((x) => x.line) })
        .toEqual({ lead, near: [2] });
    }
  });

  it('#3307 a paragraph carrying the claim WRAPPED twice reports both copies, not just the first', () => {
    // The same single-`indexOf`-then-`continue` line dropped a second folded copy in one paragraph.
    // Neither copy is a literal substring of the raw text (each is wrapped across two lines), so only
    // the block-level folded scan can see them.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    const text = 'the gate never runs\nagainst backlog cards, and later\nthe gate never runs\nagainst backlog cards again.\n';
    expect(text.includes(CLAIM)).toBe(false); // wrapped — no verbatim substring anywhere
    const sites = sweepDocument({ path: 'a.md', text }, { text: CLAIM });
    expect(sites.filter((x) => x.tier === 'normalized').map((x) => x.line)).toEqual([1, 3]);
  });

  it('#3307 one wrapped copy whose sentence OPENS on an earlier line is one site, not two', () => {
    // The guard on the other side of the same fix: now that the sentence loop runs even when the block
    // carries a folded hit, the claim's own sentence would be re-recorded at `near` under the line the
    // SENTENCE starts on — double-reporting a single occurrence. A sentence carrying the claim verbatim
    // is skipped for that reason.
    // Retracted — fixture text repeating the false claim above, never an assertion.
    const sites = sweepDocument(
      { path: 'a.md', text: `As noted earlier,\n${CLAIM} in every run.\n` }, { text: CLAIM });
    expect(sites.map((x) => [x.line, x.tier])).toEqual([[2, 'exact']]);
  });
});

describe('#3307 claim-sweep — retraction detection is ANCHORED, and must not launder a survivor', () => {
  // Juror finding, claim-sweep.mjs retractionNear. Prevention the review marked OWED: ordinary prose
  // using a marker phrase in a NON-retraction sense, placed beside a genuine unretracted claim.
  // Retracted — the figure below is false (92 cases, 87 with a lens row, 86 `correctness`); it is named
  // SURVIVOR because these cases are about whether the SWEEP reports it, not about the count.
  const SURVIVOR = 'All 84 recorded verdicts ran correctness alone.';

  /** Ordinary English that the old bare-substring rule read as a retraction. Each is a real prose shape. */
  const INNOCENT = [
    ['it read', '...on the old display it read as a jumble of digits.'],
    ['was wrong', 'The estimate was wrong for reasons unrelated to this table.'],
    ['were wrong', 'We were wrong about the layout, which is a different card.'],
    ['this said', 'This said nothing about latency either way.'],
    ['superseded', 'The superseded design used a modal instead of a drawer.'],
    ['now reads', 'The status field now reads `open` in the new schema.'],
    ['withdrawn', 'Funding for the unrelated pilot was quietly withdrawn last year.'],
  ];

  it.each(INNOCENT)('#3307 `%s` in a non-retraction sense leaves the claim a SURVIVOR', (_marker, prose) => {
    const sites = sweepDocument({ path: 'b.md', text: `${prose}\n\n${SURVIVOR}\n` }, { text: SURVIVOR });
    expect(sites).toHaveLength(1);
    expect(sites[0].tier).toBe('exact');
    expect(sites[0].retracted).toBe(false);
    expect(sites[0].retractionMarker).toBe(null);
  });

  it('#3307 an innocent marker phrase does NOT drop the exit code to clean', () => {
    // The consequence that makes this blocking rather than cosmetic: a laundered survivor exits 0.
    const report = sweepDocuments(
      [{ path: 'b.md', text: `...on the old display it read as a jumble of digits.\n\n${SURVIVOR}\n` }],
      { text: SURVIVOR },
    );
    expect(report.counts.survivors).toBe(1);
    expect(report.counts.retracted).toBe(0);
    expect(formatReport(report)).toMatch(/RESULT: 1 surviving site/);
  });

  /** The shapes a retraction is ACTUALLY written in here — tightening must not cost any of them. */
  const REAL = [
    ['repo blockquote convention', ['> **Retracted — three more rows of this table were wrong.**', '> It still read "84 of 84".', SURVIVOR], 3],
    ['bold lead', ['**Retracted** — it read ...', SURVIVOR], 2],
    ['code-comment lead', ['// RETRACTED: the figure was 84', `const X = 1; // ${SURVIVOR}`], 2],
    ['list lead', ['- Superseded by #1234', SURVIVOR], 2],
    ['plain lead', ['Retraction: the count was re-measured.', SURVIVOR], 2],
    ['unambiguous phrase anywhere', ['That is no longer true.', SURVIVOR], 2],
    ['struck site line', [`~~${SURVIVOR}~~`], 1],
  ];

  it.each(REAL)('#3307 still detects a real retraction: %s', (_label, lines, line) => {
    expect(retractionNear(lines, line).retracted).toBe(true);
  });

  it('#3307 stripLineLeaders reduces nested blockquote/list/emphasis leaders to the bare word', () => {
    expect(stripLineLeaders('> - **Retracted:** it read ...')).toMatch(/^Retracted:/);
    expect(stripLineLeaders('   // RETRACTED: ...')).toMatch(/^RETRACTED:/);
    expect(stripLineLeaders('1. ~~Superseded~~')).toMatch(/^Superseded/);
    // A card id is not a heading leader — `#` only leads when whitespace follows.
    expect(stripLineLeaders('#3319 is a card id, not a heading')).toBe('#3319 is a card id, not a heading');
    // Bullet glyphs count as leaders too: this module's own header writes its list with `•` inside a
    // block comment, and without this the file's own retraction label went unrecognised.
    expect(stripLineLeaders(' *   \u2022 Retracted — the claim is false')).toBe('Retracted — the claim is false');
    expect(stripLineLeaders('   \u00b7 Retraction: x')).toBe('Retraction: x');
  });

  it('#3307 a lead word counts as a LABEL, not as the subject of a sentence', () => {
    // Both of these are REAL lines from this PR's own card, and an earlier cut of the anchor read both
    // as retractions — laundering two live sites while fixing the ones the review had quoted. A wrapped
    // paragraph can start a line with any word; a retraction LABELS itself.
    expect(retractionNear(["retraction's own neighbourhood is listed with `retracted: true`.", SURVIVOR], 2)
      .retracted).toBe(false);
    expect(retractionNear(['correction was half applied: parent `3318` already retracted,', SURVIVOR], 2)
      .retracted).toBe(false);
    // The label shapes, all of which this repo actually writes:
    expect(retractionNear(['Retracted:', SURVIVOR], 2).retracted).toBe(true);
    expect(retractionNear(['**Retracted**', SURVIVOR], 2).retracted).toBe(true);
    expect(retractionNear(['Superseded by #1234', SURVIVOR], 2).retracted).toBe(true);
    // ...and the word is still bounded: `retractable` is not `retract`.
    expect(retractionNear(['Retractable landing gear is out of scope.', SURVIVOR], 2).retracted).toBe(false);
    // The reported marker is the bare word, not the word plus its separator.
    expect(retractionNear(['**Retracted** — it read ...', SURVIVOR], 2).marker).toBe('retracted');
  });

  it('#3307 the two halves of the vocabulary are anchored differently, and both are exported', () => {
    expect(RETRACTION_LEAD_WORDS).toContain('superseded');
    expect(RETRACTION_PHRASES).toContain('no longer true');
    // The combined export `3299`/`3301` will import is the union of both halves.
    expect(RETRACTION_MARKERS).toEqual([...RETRACTION_LEAD_WORDS, ...RETRACTION_PHRASES]);
    // ...and membership alone is NOT a match: `superseded` mid-sentence is not a retraction.
    expect(retractionNear(['The superseded design used a modal.', SURVIVOR], 2).retracted).toBe(false);
  });
});

describe('#3307 claim-sweep — the two first-cut fixes, now actually protected', () => {
  // Operator finding (a): the PR body listed both of these as "found in the live run, fixed here", and
  // reverting EITHER left the suite 42/42 green. Both mutations were re-run in this lane to confirm.

  it('#3307 MUTATION — an explicit --token ADDS to the derived tokens instead of REPLACING them', () => {
    // The old case used a claim carrying NO derived tokens, so replace-semantics and union-semantics
    // were indistinguishable and its assertions held either way. This claim carries `#3319` and `84` of
    // its own; the caller adds `x7kopnm`. Under replace-semantics the derived two are LOST — which is
    // narrowing, the one outcome this tool exists to prevent.
    const claim = { text: 'card #3319 repeats the 84 figure', tokens: ['x7kopnm'] };
    const doc = {
      path: 'a.md',
      text: 'a line naming #3319 alone\nan unrelated line quoting 84 rows\nthe id x7kopnm was believed nonexistent\n',
    };
    const sites = sweepDocument(doc, claim);
    expect(sites.map((x) => x.line)).toEqual([1, 2, 3]); // derived #3319, derived 84, AND supplied x7kopnm
    expect(sites.every((x) => x.tier === 'token')).toBe(true);
    // Stated as the invariant too, so no mutation can satisfy it by coincidence:
    const report = sweepDocuments([doc], claim);
    for (const t of [...distinctiveTokens(claim.text), 'x7kopnm']) expect(report.claim.tokens).toContain(t);
  });

  it('#3307 MUTATION — a match inside a wrapped paragraph is reported at ITS line, not the block start', () => {
    // Reverting `lineForOffset` to `return block.startLine` used to keep the suite green. A citation
    // that is precise and points at an unrelated sentence is worse than none: it reads as a false hit.
    const doc = {
      path: 'a.md',
      text: [
        '> Some unrelated opening sentence in the same blockquote.',
        '> Another line that has nothing to do with it.',
        '> All 84 recorded',
        '> verdicts ran correctness alone.',
      ].join('\n') + '\n',
    };
    // Retracted — the quoted figure is false (92 cases, 87 with a lens row, 86 `correctness`).
    const sites = sweepDocument(doc, { text: 'All 84 recorded verdicts ran correctness alone.' });
    const normalized = sites.find((x) => x.tier === 'normalized');
    expect(normalized).toBeDefined();
    expect(normalized.line).toBe(3);      // where the claim really starts
    expect(normalized.line).not.toBe(1);  // NOT the block's first line
  });
});

describe('#3307 claim-sweep — the module can sweep its own source', () => {
  // Operator finding (b): the module carried a RAW NUL byte, so `collectDocuments` classified it as
  // binary and skipped it — while its own header carries the 84-verdicts claim. grep exited 1 silently.
  it('#3307 the shipped module contains no raw NUL, so it is not self-excluded as binary', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'claim-sweep.mjs'), 'utf8');
    expect(src.includes('\u0000')).toBe(false);
    const { documents, skipped } = collectDocuments({
      cwd: '/repo',
      run: () => ({ status: 0, stdout: 'scripts/lib/claim-sweep.mjs\u0000', stderr: '' }),
      readFile: () => src,
    });
    expect(documents.map((d) => d.path)).toEqual(['scripts/lib/claim-sweep.mjs']);
    expect(skipped).toEqual([]);
  });

  it('#3307 binary detection itself still works — a real NUL is still skipped and COUNTED', () => {
    const { documents, skipped } = collectDocuments({
      cwd: '/repo',
      run: () => ({ status: 0, stdout: 'a.md\u0000b.md\u0000', stderr: '' }),
      readFile: (path) => (path.endsWith('b.md') ? 'bin\u0000ary' : 'hello'),
    });
    expect(documents.map((d) => d.path)).toEqual(['a.md']);
    expect(skipped).toEqual([{ path: 'b.md', why: 'binary' }]);
  });

  it('#3307 a pathspec is passed after `--`, so one starting with `-` is not read as a git option', () => {
    let argv = null;
    collectDocuments({
      cwd: '/repo',
      paths: ['-weird-pathspec'],
      run: (args) => { argv = args; return { status: 0, stdout: '', stderr: '' }; },
      readFile: () => '',
    });
    expect(argv).toEqual(['ls-files', '-z', '--', '-weird-pathspec']);
  });
});
