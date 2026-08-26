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
import { describe, it, expect } from 'vitest';
import {
  normalizeText, distinctiveTokens, tokenPattern, shingleContainment, retractionNear,
  relevance, looksLikeLineCitation,
  sweepDocument, sweepDocuments, collectDocuments, sweepRepo, formatReport, parseFlags, main,
  NOT_COVERED, RETRACTION_MARKERS,
} from '../claim-sweep.mjs';

// ── The real specimen, frozen at the half-applied moment ──────────────────────────────────────────────

/** The claim as it was written, at the site that was corrected first. */
const CLAIM_84 = 'All 84 recorded verdicts ran correctness alone.';

/** Parent card `3318` — already corrected: the figure survives only inside its own retraction. */
const CARD_3318 = `# Review-efficacy watch

| Verdicts that recorded a lens row | 87 of 92 — **every one of them a single row**; 5 recorded none |

> **Retracted — three more rows of this table were wrong, re-counted 2026-08-26.**
> It still read *"Verdicts that ran a single lens | 84 of 84 (100%), always \`correctness\`"*. There is no
> population of 84 anywhere in the corpus — it holds 92 cases, 87 of which record a lens row.
`;

/** Child card `3319` — NOT yet corrected. The surviving site the sweep has to name.
 *  RETRACTED as fact: the figure below is false (92 cases, 87 with a lens row, 86 of those `correctness`).
 *  It is a frozen replay of what the card said on 2026-08-26, not an assertion — and the marker is here
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
 *  RETRACTED as fact, for the same reason as the fixture above: a frozen replay, never a claim. */
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
    // into a second card and repeated in a PR body before being refuted. RETRACTED as fact — the gate
    // does run against backlog cards; these two strings are a frozen replay, never an assertion.
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

  it('#3307 retractionNear reads the RAW neighbourhood so `~~` survives', () => {
    const lines = ['~~old claim~~', 'the claim'];
    expect(retractionNear(lines, 2).retracted).toBe(true);
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
