/**
 * @file scripts/__tests__/pr-land.test.mjs
 * @description Unit proof of the pure helpers in `scripts/pr-land.mjs` — the self-approved-PR landing
 *   substrate for #2138 Fork 5 (#2153): the `gh pr create`/`gh pr merge` arg construction and the
 *   check-classification that decides merge-vs-wait-vs-abort. The live gh/git driver is the I/O boundary.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mergeMethodFlag, buildCreateArgs, prCreateBodyGuard, buildMergeArgs, buildRenumberHealArgs, buildRegenArgs, buildAddLabelArgs, classifyChecks, planPrLand, pollVerdict, isPostLandTreeDirty, postLandSkips, postLandReport, scopeHealChangedPaths, resolveProducerReviewLabel, resolveRosterReconcile, resolveParkLabel, PARK_LABELS } from '../pr-land.mjs';
import { REVIEW_LABELS, REVIEW_LABEL_META } from '../lib/review-escalation.mjs';
import { deriveReviewDisposition } from '../lib/review-core.mjs';

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// #2785 review-fix — THE CODIFICATION SMUGGLE TABLE, driven through the REAL PRODUCER STACK over REAL `git diff`
// output of the REAL `docs/agent/platform-decisions.md`.
//
// WHY IT LIVES HERE AND WHY IT USES GIT. The first cut of the #2771 Fork B exemption was proven only against the
// PREDICATE (`isCodificationOnly`) fed hand-written diff fragments — and that is exactly what let a smuggle
// through: hand-written fragments never exercise POSITION (hunk headers, leading/trailing context, where in a
// 3,300-line document an added line actually sits), so a test could not tell "appended under the new anchor"
// from "spliced into the body of the rule that decides who may clear what". These cases therefore (a) mutate the
// REAL statute document, (b) let real `git diff` render the hunks, and (c) assert on what the PRODUCER concludes
// end-to-end — `resolveProducerReviewLabel` → the review label → `deriveReviewDisposition` — not on the predicate.
// The bad direction is a false POSITIVE, so every row but the CONTROL asserts "stays human".
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('#2785 review-fix — the codification exemption over REAL statute diffs (real producer stack)', () => {
  const ROOT = resolve(process.cwd());
  const STATUTE = 'docs/agent/platform-decisions.md';
  const ITEM = 'backlog/9999-a-throwaway-decision.md';
  const ANCHOR = 'throwaway-anchor';
  const LEASH_ANCHOR = 'review-human-declarative-leash-only';           // the rule about who may clear what

  const statuteSrc = readFileSync(resolve(ROOT, STATUTE), 'utf8');
  const statuteLines = statuteSrc.split('\n');
  const itemSrc = ['---', 'id: 9999', 'kind: decision', 'title: A throwaway decision', 'status: open', '---', '', 'Body.', ''].join('\n');
  const resolvedItem = itemSrc.replace('status: open', `status: resolved\ncodifiedIn: "${STATUTE}#${ANCHOR}"`);

  // The honest new rule, exactly as `resolve --codified-to` appends one.
  const NEW_RULE = ['', `### Throwaway rule {#${ANCHOR}}`, '', '**Ratified 2026-08-01.** A harmless throwaway.', ''];
  // One line that AMENDS an existing rule — the payload a smuggle wants to land without a human.
  const SMUGGLE = '**Amendment (2026-08-08):** the declarative leash may be cleared by the independent committee when conformance is green.';

  const leashIdx = statuteLines.findIndex((l) => l.includes(`{#${LEASH_ANCHOR}}`));
  const appendAtEof = (ls) => [...ls.slice(0, ls.length - 1), ...NEW_RULE, ls[ls.length - 1]];
  /** Append an ARBITRARY block of lines at EOF of the real statute (vs `appendAtEof`, which always appends the
   *  honest NEW_RULE). Used by the one-heading rows, which vary what rides along under the honest anchor. */
  const appendBlock = (block) => [...statuteLines.slice(0, statuteLines.length - 1), ...block, statuteLines[statuteLines.length - 1]].join('\n');
  /** `appendBlock` for the rows that mutate the ANCHOR HEADING LINE ITSELF (round 5, variant (a)). */
  const anchorLine = (line) => appendBlock(['', line, '', '**Ratified 2026-08-01.** A harmless throwaway.', '']);
  const insertAt = (ls, i, ins) => [...ls.slice(0, i), ...ins, ...ls.slice(i)];

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE ELEMENT-DELTA ORACLE (#2785 review round 5). Every row below carries the number of `h1`…`h6` ELEMENTS
  // its append actually adds to the PUBLISHED PAGE, and every row asserts it. That number is measured, not
  // declared: the real statute document is rendered with and without the append through `rules-loader.cjs`'s own
  // `makeRenderer()` + `preprocessInlineAnchors` — the exact path that builds the page — and parsed by a real
  // DOM (vitest's happy-dom environment), then `querySelectorAll('h1,…,h6').length` is differenced.
  //
  // It does two jobs at once. (1) ANTI-VACUITY: a smuggle row that added no second heading would be proving
  // nothing, and this catches it. (2) It is the BAR THE PREDICATE IS HELD TO — round 4's `headingIndices`
  // counted LINE INDICES in a `Set`, so two headings sharing one source line collapsed to one and a run the page
  // renders as TWO sections scored `autoLand: true`. A row whose delta is ≥ 2 but which does not stay human is
  // that bug, by construction. The predicate must equal this delta or refuse; it may never under-count it.
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const { makeRenderer, preprocessInlineAnchors } = createRequire(import.meta.url)('../lib/rules-loader.cjs');
  const renderedHeadings = (src) => {
    document.body.innerHTML = makeRenderer().render(preprocessInlineAnchors(src));
    return document.body.querySelectorAll('h1,h2,h3,h4,h5,h6').length;
  };
  let baseHeadings = 0;
  const headingDelta = (statute) => renderedHeadings(statute) - baseHeadings;

  let repo = null;
  const write = (p, c) => { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), c); };
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'we-codify-smuggle-'));
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    write(STATUTE, statuteSrc); write(ITEM, itemSrc);
    git('add', STATUTE, ITEM); git('commit', '-qm', 'base');
    baseHeadings = renderedHeadings(statuteSrc);
  });
  afterAll(() => { if (repo) rmSync(repo, { recursive: true, force: true }); });

  /** Mutate the scratch tree, take a REAL `git diff`, and run the producer end-to-end. Restores the tree after. */
  const producerVerdict = (statute, item = resolvedItem) => {
    write(STATUTE, statute); write(ITEM, item);
    const diffText = git('diff', '--', STATUTE, ITEM);
    const changedFiles = git('diff', '--name-only', '--', STATUTE, ITEM).split('\n').filter(Boolean);
    write(STATUTE, statuteSrc); write(ITEM, itemSrc);
    const v = resolveProducerReviewLabel({ changedFiles, diffLines: 20, humanBasisFiles: changedFiles, diffText });
    return { ...v, disposition: deriveReviewDisposition({ reasons: v.reasons }), changedFiles };
  };

  it('the real statute doc still carries the leash anchor the smuggle rows target', () => {
    expect(leashIdx).toBeGreaterThan(0);                                 // else the rows below are testing nothing
  });

  // CASE 0 — the CONTROL. If this stops clearing, the exemption has been narrowed into uselessness and Fork B
  // should be dropped rather than kept as dead code.
  it('CASE 0 CONTROL — an honest codify (resolve + the named anchor appended at EOF, nothing else) CLEARS to the committee', () => {
    const statute = appendAtEof(statuteLines).join('\n');
    expect(headingDelta(statute)).toBe(1);                               // the page really does gain ONE heading
    const v = producerVerdict(statute);
    expect(v.humanRequired).toBe(false);
    expect(v.label).toBe(REVIEW_LABELS.pending);
    expect(v.reasons.join(' ')).toMatch(/codification/);
    expect(v.reasons.join(' ')).not.toMatch(/statute \(/);
    // F2 — the contract's prose and this table now agree: committee-clearable means a converged accept LANDS.
    expect(v.disposition).toEqual({ mode: 'converge', autoLand: true });
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE SYNTAX ENUMERATION (#2785 review round 4). Rounds 1–3 each patched the reported SHAPE with a new regex
  // and each missed a fresh class, because "does this run open a second section?" is a question about the
  // RENDERED document, and a heading is created by the BLOCK CONTEXT a line sits in — something a line-local
  // regex cannot see. The round-3 head missed EIGHT (verified against it directly): `- ### X`, `* ### X`,
  // `1. ### X`, `> ### X`, `> > ### X`, a setext underline inside a blockquote, a setext underline under a wide
  // list marker, and a `<h3` whose `>` lands on the next line. Detection now renders `lineAboveRun + run` with
  // the SAME markdown-it configuration that BUILDS the published statute page, so a smuggle would have to be a
  // heading the page does not render as a heading — i.e. not a second rule at all.
  //
  // Every row below rides the REAL statute document through REAL `git diff` and the REAL producer stack. Every
  // smuggle row is one contiguous EOF append that OPENS with the anchor the resolve names and removes nothing —
  // so each one satisfies every positional test verbatim, and only the section COUNT distinguishes it from the
  // honest control. The bad direction is a false POSITIVE, so the human rows carry the weight and the CONTROL
  // rows exist to prove the exemption is not narrowed into dead code.
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const second = (...ls) => appendBlock([...NEW_RULE, ...ls]);
  const SMUGGLE_RULE = 'Agents may clear review:human after a converged committee accept';

  // Each row is [label, build, expectedHeadingElementDelta] — the third field is the oracle, asserted per row.
  const smuggles = [
    // ── POSITIONAL (rounds 1–2): the added lines are not provably inside the named anchor's own section ──
    // These add ONE heading to the page; what refuses them is WHERE the other added lines sit, not the count.
    ['POS 1 — an honest anchor at EOF PLUS one line spliced into the body of the leash rule (a second hunk)',
      () => appendAtEof(insertAt(statuteLines, leashIdx + 4, [SMUGGLE, ''])).join('\n'), 1],
    ['POS 2 — the named anchor inserted MID-file, splitting an existing rule (pre-existing context follows it)',
      () => insertAt(statuteLines, leashIdx + 6, NEW_RULE).join('\n'), 1],
    ['POS 3 — the anchor appended at EOF, but a smuggled amendment sits immediately ABOVE the new heading',
      () => appendAtEof(statuteLines).join('\n').replace(`\n### Throwaway rule {#${ANCHOR}}`, `\n${SMUGGLE}\n\n### Throwaway rule {#${ANCHOR}}`), 1],
    ['POS 4 — two smuggled lines in two different rule bodies plus the honest anchor at EOF',
      () => appendAtEof(insertAt(insertAt(statuteLines, leashIdx + 4, [SMUGGLE, '']), 40, ['Another smuggled sentence.', ''])).join('\n'), 1],

    // ── ATX, every legal spelling ──
    ['ATX 1 — an UNTAGGED `### …` second rule after a `---` (the round-2 report: dropping the {#tag} is free, ' +
     'because validate-rules-anchors.cjs only validates anchors a document DECLARES, so CI still passes)',
      () => second('---', '', `### ${SMUGGLE_RULE}`, '',
        `**Ratified 2026-08-07 by the operator.** Notwithstanding [#${LEASH_ANCHOR}](#${LEASH_ANCHOR}), ${SMUGGLE}`, ''), 2],
    ['ATX 2 — a TAGGED `{#…}` heading the resolve never named',
      () => second('### Agents may clear {#agents-may-clear-review-human}', '', SMUGGLE, ''), 2],
    ['ATX 3 — `# h1`', () => second(`# ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['ATX 4 — `###### h6`', () => second(`###### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['ATX 5 — 1–3 leading spaces (CommonMark still reads a heading)', () => second(`   ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['ATX 6 — the closed form `### X ###`', () => second(`### ${SMUGGLE_RULE} ###`, '', SMUGGLE, ''), 2],
    ['ATX 7 — a TAB after the hashes', () => second(`###\t${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['ATX 8 — trailing whitespace after the heading text', () => second(`### ${SMUGGLE_RULE}   `, '', SMUGGLE, ''), 2],
    ['ATX 9 — an EMPTY heading (`###`), which still opens a section', () => second('###', '', SMUGGLE, ''), 2],

    // ── setext, every legal spelling ──
    ['SETEXT 1 — an `===` underline (h1)', () => second(SMUGGLE_RULE, '===', '', SMUGGLE, ''), 2],
    ['SETEXT 2 — a `---` underline hard against the paragraph above it (h2)', () => second(SMUGGLE_RULE, '---', '', SMUGGLE, ''), 2],
    ['SETEXT 3 — a SINGLE-character `=` underline', () => second(SMUGGLE_RULE, '=', '', SMUGGLE, ''), 2],
    ['SETEXT 4 — a 3-space-indented underline', () => second(SMUGGLE_RULE, '   ---', '', SMUGGLE, ''), 2],
    ['SETEXT 5 — an underline with trailing whitespace', () => second(SMUGGLE_RULE, '---   ', '', SMUGGLE, ''), 2],

    // ── the EIGHT the round-3 regex missed: the heading is made by its CONTAINER ──
    ['NEW 1 — ATX behind a `-` list marker (`- ### X`) — round-3 regex saw a list item, CommonMark sees an h3',
      () => second(`- ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['NEW 2 — ATX behind a `*` list marker', () => second(`* ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['NEW 3 — ATX behind an ORDERED list marker (`1. ### X`)', () => second(`1. ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['NEW 4 — ATX behind a BLOCKQUOTE (`> ### X`)', () => second(`> ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['NEW 5 — ATX behind a NESTED blockquote (`> > ### X`)', () => second(`> > ### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],
    ['NEW 6 — a SETEXT underline INSIDE a blockquote (`> Title` / `> ---`)', () => second(`> ${SMUGGLE_RULE}`, '> ---', '', SMUGGLE, ''), 2],
    ['NEW 7 — a SETEXT underline under a WIDE list marker (`10. Title` / a 4-space `---`)',
      () => second(`10. ${SMUGGLE_RULE}`, '    ---', '', SMUGGLE, ''), 2],
    ['NEW 8 — `<h3` whose `>` sits on the NEXT line, so no line carries a complete tag',
      () => second('<h3', `>${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],

    // ── raw HTML passthrough ──
    ['HTML 1 — `<h3>X</h3>`', () => second(`<h3>${SMUGGLE_RULE}</h3>`, '', SMUGGLE, ''), 2],
    ['HTML 2 — `<h3 class="…">X</h3>` (attributes)', () => second(`<h3 class="rule">${SMUGGLE_RULE}</h3>`, '', SMUGGLE, ''), 2],
    ['HTML 3 — UPPERCASE `<H3>`', () => second(`<H3>${SMUGGLE_RULE}</H3>`, '', SMUGGLE, ''), 2],
    ['HTML 4 — `<h6>` (every level h1…h6 counts)', () => second(`<h6>${SMUGGLE_RULE}</h6>`, '', SMUGGLE, ''), 2],
    // A bare close tag is not an ELEMENT (the oracle says the page gains one heading, not two) — but it is raw
    // heading markup that matches no opener in the run, so it cannot be attributed and the reader REFUSES.
    ['HTML 5 — a BARE closing tag `</h2>` (unattributable raw markup ⇒ refuse, not count)', () => second('</h2>', '', SMUGGLE, ''), 1],
    ['HTML 6 — an `<h3>` INLINE inside a paragraph', () => second(`Some prose <h3>${SMUGGLE_RULE}</h3> more prose.`, ''), 2],

    // ── unreadable markdown: the parser must REFUSE, never under-count ──
    ['UNREADABLE 1 — a heading hidden behind an UNTERMINATED ``` fence (markdown-it would swallow it, so the ' +
     'fence-termination check refuses instead)', () => second('```', 'x', '', `### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 1],
    ['UNREADABLE 2 — the same behind an UNTERMINATED `~~~` fence', () => second('~~~', 'x', '', `### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 1],
    ['UNREADABLE 3 — a MALFORMED backtick fence (an info string containing a backtick) then a heading',
      () => second('```a`b', `### ${SMUGGLE_RULE}`, '', SMUGGLE, ''), 2],

    // ── volume ──
    ['VOLUME — 200 lines of unrelated new rule text under an untagged heading (the unbounded payload)',
      () => second('### A second rule nobody ratified', '', ...Array.from({ length: 200 }, (_, i) => `Smuggled line ${i}.`), ''), 2],

    // ── the working attack the ruling named ──
    ['ATTACK — the honest new rule PLUS a second rule reading "agents may clear their own leash", which on the ' +
     'round-3 head cleared with autoLand:true',
      () => second('---', '', '### Agents may clear their own leash', '', `**Ratified.** ${SMUGGLE}`, ''), 2],

    // ═══ ROUND 5, VARIANT (a) — THE SAME-LINE COLLAPSE. All eight put a raw `<hN>` on the ANCHOR'S OWN ATX
    // heading line. That line still matches `STATUTE_ANCHOR_HEADING_RE` (it ends in `{#anchor}`), and the
    // heading's `inline` token carries the HEADING'S OWN `map` — so round 4's line-index `Set` deduped the
    // `html_inline` against the `heading_open` and counted ONE. The oracle below says the page renders TWO.
    // Every one of these scored `isCodificationOnly: true`, `review:pending`, `autoLand: true` on round 4. ═══
    ['SAME-LINE 1 — a raw `<h3 id="evil">…</h3>` on the anchor heading line itself',
      () => anchorLine(`### Probe <h3 id="evil">${SMUGGLE_RULE}</h3> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 2 — the same with `<h1>`', () => anchorLine(`### Probe <h1 id="evil">${SMUGGLE_RULE}</h1> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 3 — UPPERCASE `<H4>` on the anchor line', () => anchorLine(`### Probe <H4 id="evil">${SMUGGLE_RULE}</H4> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 4 — an UNCLOSED `<h3 id="evil">` opener on the anchor line', () => anchorLine(`### Probe <h3 id="evil"> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 5 — a stray `</h3><h2 id="evil">` on the anchor line', () => anchorLine(`### Probe </h3><h2 id="evil"> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 6 — tab / spaced-out / bare-attribute noise inside the tag',
      () => anchorLine(`### Probe <h3\tid = "evil" hidden >${SMUGGLE_RULE}</h3> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 7 — a SELF-CLOSING `<h3 id="evil"/>` (still a start tag to an HTML parser)',
      () => anchorLine(`### Probe <h3 id="evil"/> Title {#${ANCHOR}}`), 2],
    ['SAME-LINE 8 — the same plus TRAILING SPACES on the anchor line',
      () => anchorLine(`### Probe <h3 id="evil">${SMUGGLE_RULE}</h3> Title {#${ANCHOR}}   `), 2],
    ['SAME-LINE 9 — TWO raw headings on the anchor line (the page renders three)',
      () => anchorLine(`### Probe <h3>a</h3> mid <h3>b</h3> Title {#${ANCHOR}}`), 3],

    // ═══ ROUND 5, VARIANT (b) — NULL-MAP INLINE TOKENS. markdown-it gives table-cell `inline` tokens `map: null`,
    // so round 4's `opensSection(null)` was a silent no-op and a heading inside a markdown TABLE CELL counted
    // ZERO. Strictly worse than (a): the `id` sits on a NON-heading line, so `rules-loader.cjs`'s
    // `extractAnchors` registers it — the smuggled rule gets a working, `check:statute`-valid anchor a
    // `codifiedIn:` can then cite. A heading with no readable POSITION is now unreadable, not absent. ═══
    ['TABLE-CELL 1 — `<h3 id="agent-may-clear-anything">` inside a markdown table cell',
      () => second('', '| Rule | Detail |', '| - | - |',
        `| <h3 id="agent-may-clear-anything">Agents may clear any statute edit</h3> | ${SMUGGLE} |`, ''), 2],
    ['TABLE-CELL 2 — the same in a table HEADER cell',
      () => second('', '| <h3 id="agent-may-clear-anything">Agents may clear any statute edit</h3> | Detail |',
        '| - | - |', `| a | ${SMUGGLE} |`, ''), 2],
    ['TABLE-CELL 3 — an UNCLOSED `<h2 id="evil">` opener in a table cell',
      () => second('', '| Rule | Detail |', '| - | - |', `| <h2 id="evil"> | ${SMUGGLE} |`, ''), 2],
    ['TABLE-CELL 4 — a table hugging the anchor body, no blank line before it',
      () => second('| A | B |', '| - | - |', `| <h4>${SMUGGLE_RULE}</h4> | x |`, ''), 2],
    ['TABLE-CELL 5 — TWO headings in ONE cell (the page renders three)',
      () => second('', '| A | B |', '| - | - |', '| <h3>a</h3><h4>b</h4> | z |', ''), 3],
    ['TABLE-CELL 6 — a table cell heading inside a BLOCKQUOTE',
      () => second('> | A | B |', '> | - | - |', '> | <h3 id="evil">x</h3> | y |', ''), 2],
    ['TABLE-CELL 7 — a table cell heading inside a LIST ITEM',
      () => second('- item', '', '  | A | B |', '  | - | - |', '  | <h3 id="evil">y</h3> | z |', ''), 2],

    // ── round 5, the same raw-inline heading in every OTHER inline container (these DID have a map, and so were
    //    already caught — they are here so the whole inline family is enumerated in one place) ──
    ['INLINE 1 — a raw `<h3>` inside a LIST ITEM', () => second(`- text <h3 id="evil">${SMUGGLE_RULE}</h3>`, ''), 2],
    ['INLINE 2 — a raw `<h3>` inside a BLOCKQUOTE paragraph', () => second(`> text <h3 id="evil">${SMUGGLE_RULE}</h3>`, ''), 2],
    ['INLINE 3 — a raw `<h3>` on the SECOND line of a multi-line paragraph',
      () => second('First line of prose,', `second line <h3 id="evil">${SMUGGLE_RULE}</h3>.`, ''), 2],
    ['INLINE 4 — a raw `<h3>` inside LINK TEXT', () => second(`Prose [<h3 id="evil">x</h3>](#z) more.`, ''), 2],
    ['INLINE 5 — a raw `<h3>` inside EMPHASIS', () => second(`Prose *<h3 id="evil">x</h3>* more.`, ''), 2],
    ['INLINE 6 — a raw `<h3>` inside a `<details>` html_block',
      () => second('<details><summary>s</summary>', `<h3 id="evil">${SMUGGLE_RULE}</h3>`, '</details>', ''), 2],
    ['INLINE 7 — a heading inside an UNTERMINATED html comment (unstrippable ⇒ over-count ⇒ refuse)',
      () => second('<!-- <h3 id="evil">x</h3>', ''), 1],
  ];
  for (const [label, build, delta] of smuggles) {
    it(`stays review:human — ${label}`, () => {
      const statute = build();
      // THE ORACLE, first: this row's append really does do to the PAGE what its label claims. Without this a
      // smuggle row could pass by adding no heading at all, which is what makes a count bug invisible.
      expect(headingDelta(statute)).toBe(delta);
      const v = producerVerdict(statute);
      expect(v.humanRequired).toBe(true);
      expect(v.label).toBe(REVIEW_LABELS.human);
      expect(v.reasons.join(' ')).not.toMatch(/codification/);
      expect(v.disposition.autoLand).toBe(false);                        // no agent may land an unproven statute edit
    });
  }

  // The counterweight rows. The one-section rule must bound the append to one SECTION without bounding its
  // CONTENT — if these stop clearing the exemption is dead code and Fork B should be dropped, not kept. They are
  // also where the parser earns its keep in the OTHER direction: a `#` inside a fence, a `#` mid-paragraph, a
  // `###` with no space, a 4-space-indented `###`, and a blank-preceded `---` are all NOT headings in CommonMark,
  // and a checker that refused them would bounce honest codifications to the operator for no reason.
  const clears = [
    ['CTRL 1 — several paragraphs and a blank-preceded `---` under the anchor (a thematic break, not setext)',
      () => second('A second paragraph of the SAME rule.', '', '---', '')],
    ['CTRL 2 — a FENCED code block in the anchor body whose first line is a `#` shell comment',
      () => second('```sh', '# regenerate the roster', 'npm run check:standards', '```', '')],
    ['CTRL 3 — a `~~~` fenced block containing a literal `### not a heading`',
      () => second('~~~', '### not a heading', '~~~', '')],
    ['CTRL 4 — a long anchor body: 200 lines of prose under the one heading, still one section',
      () => second(...Array.from({ length: 200 }, (_, i) => `Paragraph ${i} of the same rule.`), '')],
    ['CTRL 5 — `###NoSpace` is not an ATX heading in CommonMark', () => second('###NoSpaceSoNotAHeading', '')],
    ['CTRL 6 — a 4-space-indented `### X` at top level is an indented code block, not a heading',
      () => second('', '    ### indented code, not a heading', '')],
    ['CTRL 7 — a `#` in the MIDDLE of a paragraph', () => second('Some prose with a # hash in the middle.', '')],
    // ── round 5 counterweights. The null-map refusal must fire on a table cell carrying a HEADING, not on tables
    //    (or on inline HTML) as such, or an honest codification with a table in its body would bounce.
    ['CTRL 8 — a markdown TABLE with no heading in it is ordinary anchor-body content',
      () => second('', '| Rule | Detail |', '| - | - |', '| plain | text |', '')],
    ['CTRL 9 — an inline `<span id="…">` (exactly what preprocessInlineAnchors injects) is not a heading',
      () => second('Prose with <span id="an-inline-marker"></span> a marker.', '')],
    ['CTRL 10 — `<hr>`, `<header>` and `<hgroup>` are not `<h1>`…`<h6>`',
      () => second('<hr>', '', '<header>not a heading</header>', '', '<hgroup>still not</hgroup>', '')],
    ['CTRL 11 — a `<h3>` written inside an HTML COMMENT renders no element',
      () => second('<!-- an example of the wrong way: <h3>x</h3> -->', '')],
    ['CTRL 12 — a `<h3>` inside a TERMINATED fence, and inside a CODE SPAN, are both escaped text',
      () => second('```html', '<h3 id="evil">x</h3>', '```', '', 'And inline: `<h3 id="evil">x</h3>`.', '')],
    ['CTRL 13 — an escaped `&lt;h3&gt;` is text', () => second('Prose with &lt;h3 id="evil"&gt; escaped.', '')],
    ['CTRL 14 — a self-closing `<br/>` on the anchor heading line itself',
      () => anchorLine(`### Probe <br/> Title {#${ANCHOR}}`)],
  ];
  for (const [label, build] of clears) {
    it(`CLEARS to the committee — ${label}`, () => {
      const statute = build();
      expect(headingDelta(statute)).toBe(1);                             // the oracle: exactly ONE new heading
      const v = producerVerdict(statute);
      expect(v.humanRequired).toBe(false);
      expect(v.label).toBe(REVIEW_LABELS.pending);
      expect(v.reasons.join(' ')).toMatch(/codification/);
      expect(v.disposition).toEqual({ mode: 'converge', autoLand: true });
    });
  }
  it('CTRL 2 is load-bearing — the SAME lines with the code fence removed are a real second heading', () => {
    const statute = second('# regenerate the roster', 'npm run check:standards', '');
    expect(headingDelta(statute)).toBe(2);
    expect(producerVerdict(statute).humanRequired).toBe(true);
  });
  it('CTRL 6 is load-bearing — the SAME line at 3 spaces of indent IS a heading', () => {
    const statute = second('', '   ### indented three, still a heading', '');
    expect(headingDelta(statute)).toBe(2);
    expect(producerVerdict(statute).humanRequired).toBe(true);
  });
  it('CTRL 8 is load-bearing — the SAME table with a `<h3>` in one cell is a second heading and REFUSES', () => {
    const statute = second('', '| Rule | Detail |', '| - | - |', '| <h3 id="evil">smuggled</h3> | text |', '');
    expect(headingDelta(statute)).toBe(2);
    expect(producerVerdict(statute).humanRequired).toBe(true);
  });

  it('stays review:human — an added anchor with no accompanying resolve is unchanged by the positional test', () => {
    const v = producerVerdict(appendAtEof(statuteLines).join('\n'), itemSrc);
    expect(v.humanRequired).toBe(true);
    expect(v.label).toBe(REVIEW_LABELS.human);
  });
});

describe('resolveProducerReviewLabel — #2307 deterministic review-escalation label AT PR-OPEN', () => {
  it('a policy-core diff (edits the leash-defining trust chain) → review:human, applied', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/lib/review-escalation.mjs'], diffLines: 10 });
    expect(v.label).toBe(REVIEW_LABELS.human);
    expect(v.apply).toBe(true);
    expect(v.humanRequired).toBe(true);
    expect(v.reasons.join(' ')).toMatch(/gate-self/);
  });
  it('#2785 — `diffText` is optional and fail-closed: a statute diff with no proof stays review:human', () => {
    const statute = { changedFiles: ['docs/agent/platform-decisions.md'], diffLines: 10 };
    expect(resolveProducerReviewLabel(statute).label).toBe(REVIEW_LABELS.human);
    expect(resolveProducerReviewLabel({ ...statute, diffText: null }).label).toBe(REVIEW_LABELS.human);
    expect(resolveProducerReviewLabel({ ...statute, diffText: 'diff --git a/x b/x\n+noise' }).label).toBe(REVIEW_LABELS.human);
  });
  it('an escalating non-gate-self diff (blast-radius) → review:pending, applied', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 10 });
    expect(v.label).toBe(REVIEW_LABELS.pending);
    expect(v.apply).toBe(true);
    expect(v.humanRequired).toBe(false);
  });
  it('a leaf diff with no escalation signal → no review label at all', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['backlog/2307-x.md'], diffLines: 10 });
    expect(v.label).toBe(null);
    expect(v.apply).toBe(false);
  });
  it('cross-repo + dismissed-findings signals off the manifest also escalate (review:pending)', () => {
    expect(resolveProducerReviewLabel({ crossRepo: true }).label).toBe(REVIEW_LABELS.pending);
    expect(resolveProducerReviewLabel({ dismissedFindings: 2 }).label).toBe(REVIEW_LABELS.pending);
  });
  it('a PR that already carries the verdict label is NOT re-applied (idempotent — never a double-apply)', () => {
    const v = resolveProducerReviewLabel({ changedFiles: ['scripts/pr-land.mjs'], diffLines: 10, currentLabels: [REVIEW_LABELS.pending] });
    expect(v.label).toBe(REVIEW_LABELS.pending);
    expect(v.apply).toBe(false);
  });
});

describe('pr-land post-land dirty-probe (#2225 — deps-symlinked clone must still heal/regen)', () => {
  it('a tree whose ONLY dirt is the untracked node_modules symlink is NOT blocking-dirty', () => {
    // `git status --porcelain --untracked-files=no` already hides it; the extra guard covers a tracked symlink.
    expect(isPostLandTreeDirty('?? node_modules\n')).toBe(false);
    expect(isPostLandTreeDirty(' M node_modules\n')).toBe(false);
    expect(isPostLandTreeDirty('')).toBe(false);
  });
  it('a genuinely TRACKED-dirty file blocks (a detached checkout could sweep it into the post-land commit)', () => {
    expect(isPostLandTreeDirty(' M .claude/skills/batch-backlog-items/claims.json\n')).toBe(true);
    expect(isPostLandTreeDirty(' M src/_data/blocks.json\n?? node_modules\n')).toBe(true);
  });
  it('postLandSkips lists only the steps that actually skipped (loud-skip surfacing)', () => {
    expect(postLandSkips({ skipped: true }, { done: [], failed: [] })).toEqual(['heal']);
    expect(postLandSkips({ healed: false }, { skipped: true })).toEqual(['regen']);
    expect(postLandSkips({ skipped: true }, { skipped: true })).toEqual(['heal', 'regen']);
    expect(postLandSkips({ healed: true }, { done: ['x'] })).toEqual([]);
    expect(postLandSkips(null, null)).toEqual([]);
  });
});

describe('postLandReport — the success line never throws when regen/heal is skipped or unset (#2218)', () => {
  it('SKIPPED regen (dirty checkout) reports "skipped", it does NOT read regen.done.length and crash', () => {
    // The reported bug: `regen` is `{ skipped:true, done:[], failed:[] }` (or unset) on the dirty-checkout /
    // --no-regen path; the old `regen.done.length` read threw a TypeError and misreported a successful land.
    const regen = { skipped: true, done: [], failed: [], warning: 'skipped derived-artifact regen — …' };
    expect(() => postLandReport(null, regen)).not.toThrow();
    expect(postLandReport(null, regen)).toBe('; derived-artifact regen: skipped (tracked-dirty tree)');
  });
  it('--no-regen / --no-heal (both null) → empty suffix, no throw', () => {
    expect(postLandReport(null, null)).toBe('');
  });
  it('a regen that ran but changed nothing reports "regenerated: none" (not a crash, not silence)', () => {
    expect(postLandReport(null, { done: [], failed: [] })).toBe('; regenerated: none');
  });
  it('reports the healed collisions and the regenerated artifacts on the happy path', () => {
    const heal = { healed: true, renumbered: [{ oldNum: '2219', newNum: '2220' }] };
    const regen = { done: ['npm run gen:inventory'], failed: [] };
    expect(postLandReport(heal, regen)).toBe('; healed id collision(s): #2219→#2220; regenerated: npm run gen:inventory');
  });
  it('a skipped heal reports skipped; a non-fatal regen failure is surfaced', () => {
    expect(postLandReport({ skipped: true }, { done: [], failed: [{ cmd: 'npm run gen:reference-index' }] }))
      .toBe('; id-collision heal: skipped (tracked-dirty tree); regen failed (non-fatal): npm run gen:reference-index');
  });
  it('tolerates a regen object missing its arrays entirely (optional-chained reads)', () => {
    expect(() => postLandReport({}, {})).not.toThrow();
    expect(postLandReport({}, {})).toBe('; regenerated: none');
  });
});

describe('pr-land pure helpers (#2138 Fork 5 / #2153)', () => {
  it('maps merge methods to gh flags (default = --merge, the no-ff history the drain wants)', () => {
    expect(mergeMethodFlag('merge')).toBe('--merge');
    expect(mergeMethodFlag('squash')).toBe('--squash');
    expect(mergeMethodFlag('rebase')).toBe('--rebase');
    expect(mergeMethodFlag(undefined)).toBe('--merge');
    expect(mergeMethodFlag('bogus')).toBe('--merge');
  });

  it('builds a self-approved PR create (NO reviewer; body never dropped; --fill only when nothing given)', () => {
    // Bare create (no title, no body): --fill autofills both from commits — the fallback branch.
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' }))
      .toEqual(['pr', 'create', '--base', 'main', '--head', 'lane/2153-x', '--fill']);
    // No --reviewer is ever added — self-approved (0 required approvals, #2152).
    expect(buildCreateArgs({ base: 'main', head: 'lane/2153-x' })).not.toContain('--reviewer');
    // With an explicit title+body: --title/--body, NO --fill (an explicit pair is complete on its own).
    const withTitle = buildCreateArgs({ base: 'main', head: 'lane/2153-x', title: 'land #2153', body: 'b' });
    expect(withTitle).toContain('--title');
    expect(withTitle).not.toContain('--fill');
    expect(withTitle[withTitle.indexOf('--body') + 1]).toBe('b');
    // BODY WITHOUT TITLE (the #2170 dismissals path): the body is HONORED, not dropped — and no --fill (which
    // is unusable for a remote-only lane/* head). The pr-land CLI derives a title from the commit subject so
    // a real create is always complete; this pure builder faithfully keeps the body regardless.
    const bodyOnly = buildCreateArgs({ base: 'main', head: 'lane/2170-x', body: '## Dismissed review findings\n- x' });
    expect(bodyOnly).toContain('--body');                     // body is present…
    expect(bodyOnly[bodyOnly.indexOf('--body') + 1]).toBe('## Dismissed review findings\n- x'); // …and unmangled
    expect(bodyOnly).not.toContain('--fill');                 // never --fill when a body is supplied
    // TITLE WITHOUT BODY (#2176): a title-only argv drops gh into an interactive body prompt and fails
    // headless — so the builder must ALWAYS carry a body when a title is present (an empty `--body ""`),
    // and never fall back to --fill (unusable for a remote-only lane/* head).
    const titleOnly = buildCreateArgs({ base: 'main', head: 'lane/2176-x', title: 'land #2176', body: null });
    expect(titleOnly).toContain('--body');                    // a body is always present…
    expect(titleOnly[titleOnly.indexOf('--body') + 1]).toBe(''); // …an explicit empty body (non-interactive)
    expect(titleOnly).not.toContain('--fill');                // never --fill for a lane/* head
  });

  it('#2332 prCreateBodyGuard — refuses a bodyless create, allows a non-empty body (producer fail-fast)', () => {
    // A real, non-empty body → ok (the create proceeds).
    expect(prCreateBodyGuard('## Real body\n- x').ok).toBe(true);
    expect(prCreateBodyGuard('## Real body\n- x').reason).toBeUndefined();
    // The bodyless cases the #2324 drain gate would later refuse to LAND — the producer must fail fast now.
    for (const empty of [null, undefined, '', '   ', '\n\t ']) {
      const g = prCreateBodyGuard(empty);
      expect(g.ok).toBe(false);            // refused at open…
      expect(g.reason).toMatch(/bodyless/); // …with a reason naming the omission (#2332)
    }
  });

  it('builds a one-PR merge that deletes the lane ref (not --auto on a native queue)', () => {
    expect(buildMergeArgs({ pr: 4, method: 'merge' }))
      .toEqual(['pr', 'merge', '4', '--merge', '--delete-branch']);
    expect(buildMergeArgs({ pr: 7, method: 'squash' })).not.toContain('--auto'); // drain owns ordering
  });

  it('omits --onto-ref when no pre-merge main sha is known (falls back to the git-ordinal heuristic, #2071)', () => {
    expect(buildRenumberHealArgs()).toEqual(['scripts/backlog-renumber-collisions.mjs', '--json']);
    expect(buildRenumberHealArgs({}).some((a) => a.startsWith('--onto-ref'))).toBe(false);
    expect(buildRenumberHealArgs()).not.toContain('--force');
  });

  it('passes --onto-ref=<pre-merge-main sha> so a published id is never yielded (resume-land fix, #2213)', () => {
    // Files already on the branch being landed ONTO are immutable keepers: only the INCOMING lane's new file
    // may yield — otherwise a lagging lane authored first, landing last, would renumber a live main item.
    const sha = 'a'.repeat(40);
    expect(buildRenumberHealArgs({ ontoRef: sha })).toEqual(['scripts/backlog-renumber-collisions.mjs', '--json', `--onto-ref=${sha}`]);
  });

  it('returns the derived-artifact regen command set in lock-step with the drain (gen:inventory + gen:reference-index, #2182)', () => {
    const cmds = buildRegenArgs();
    // Must be an array of [cmd, ...args] tuples (same shape as lane-drain.mjs DERIVED_REGEN).
    expect(Array.isArray(cmds)).toBe(true);
    expect(cmds.length).toBeGreaterThan(0);
    // Every entry is itself an array (the [cmd, ...args] tuple shape).
    for (const entry of cmds) expect(Array.isArray(entry)).toBe(true);
    // The two drain-equivalent generators must be present.
    const flat = cmds.map((c) => c.join(' '));
    expect(flat).toContain('npm run gen:inventory');
    expect(flat).toContain('npm run gen:reference-index');
    // No generator that writes OUTSIDE the WE repo (no impl-repo commands).
    for (const f of flat) expect(f).not.toMatch(/frontierui|plateau-app/);
  });

  it('builds the ready-to-merge label-apply args, and skips when disabled (#2196)', () => {
    // Default: apply the producer-certified label so the label lander (/drain) collects the PR.
    expect(buildAddLabelArgs({ pr: 60, label: 'ready-to-merge' }))
      .toEqual(['pr', 'edit', '60', '--add-label', 'ready-to-merge']);
    // --label=<name> overrides the label name.
    expect(buildAddLabelArgs({ pr: 5, label: 'draft-ok' }))
      .toEqual(['pr', 'edit', '5', '--add-label', 'draft-ok']);
    // --no-label (label null) → no args (PR opened UNlabelled, not auto-collected).
    expect(buildAddLabelArgs({ pr: 60, label: null })).toBe(null);
    // No PR number known → nothing to label.
    expect(buildAddLabelArgs({ pr: null, label: 'ready-to-merge' })).toBe(null);
  });

  it('classifies checks: pass → merge, any fail → abort, any pending → wait', () => {
    expect(classifyChecks([]).status).toBe('passed');                                  // no required checks
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'skipping' }]).status).toBe('passed');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'pending' }]).status).toBe('pending');
    expect(classifyChecks([{ bucket: 'pass' }, { bucket: 'fail' }]).status).toBe('failed');
    // fail dominates pending (never merge a red PR even if something else is still running).
    expect(classifyChecks([{ bucket: 'pending' }, { bucket: 'fail' }]).status).toBe('failed');
    // tolerates the raw `state` field when `bucket` is absent.
    expect(classifyChecks([{ state: 'in_progress' }]).status).toBe('pending');
  });
});

describe('pollVerdict — producer labels a BEHIND-but-green PR, never aborts (#2284 residual 1)', () => {
  const green = { checkStatus: 'passed', requiredCount: 1 };
  it('CLEAN/UNSTABLE + green → label (either mode)', () => {
    expect(pollVerdict({ state: 'CLEAN', ...green, labelWhenGreen: true })).toBe('label');
    expect(pollVerdict({ state: 'UNSTABLE', ...green, labelWhenGreen: false })).toBe('label');
  });
  it('BEHIND + green in PRODUCER mode → label & hand off (the fix — was previously aborting)', () => {
    expect(pollVerdict({ state: 'BEHIND', ...green, labelWhenGreen: true })).toBe('label');
  });
  it('BEHIND in a non-producer (merge) path → abort behind (up-to-date still required to merge)', () => {
    expect(pollVerdict({ state: 'BEHIND', ...green, labelWhenGreen: false })).toBe('behind');
  });
  it('BEHIND + EMPTY required set → wait, never a premature label (empty-set green races a not-yet-registered check)', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'passed', requiredCount: 0, labelWhenGreen: true })).toBe('wait');
  });
  it('BEHIND + checks pending → wait', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'pending', requiredCount: 1, labelWhenGreen: true })).toBe('wait');
  });
  it('a red required check → red, in every state/mode', () => {
    expect(pollVerdict({ state: 'BEHIND', checkStatus: 'failed', requiredCount: 1, labelWhenGreen: true })).toBe('red');
    expect(pollVerdict({ state: 'CLEAN', checkStatus: 'failed', requiredCount: 1, labelWhenGreen: true })).toBe('red');
  });
  it('CONFLICTING / DIRTY → conflict (dominates)', () => {
    expect(pollVerdict({ state: 'CLEAN', ...green, labelWhenGreen: true, conflicting: true })).toBe('conflict');
    expect(pollVerdict({ state: 'DIRTY', ...green, labelWhenGreen: true })).toBe('conflict');
  });
  it('BLOCKED / pending → wait', () => {
    expect(pollVerdict({ state: 'BLOCKED', checkStatus: 'pending', requiredCount: 1, labelWhenGreen: true })).toBe('wait');
  });
});

describe('planPrLand — label only after CI green (#2199), never merges (#2290)', () => {
  it('default (land): wait → label when green → TRIGGER a single-couple drain; NEVER merges here (#2290)', () => {
    expect(planPrLand({ wait: true, labelOnGreen: false })).toEqual({ waitForChecks: true, labelWhenGreen: true, mergeWhenGreen: false, triggerDrain: true, mode: 'land' });
  });
  it('no mode EVER merges (the drain is the sole writer to main, #2290)', () => {
    for (const w of [true, false]) for (const g of [true, false]) {
      expect(planPrLand({ wait: w, labelOnGreen: g }).mergeWhenGreen).toBe(false);
    }
  });
  it('--label-on-green (producer): wait → label when green → STOP; no merge, no drain trigger (standalone drain lands it)', () => {
    const p = planPrLand({ wait: true, labelOnGreen: true });
    expect(p.mode).toBe('label-on-green');
    expect(p.waitForChecks).toBe(true);
    expect(p.labelWhenGreen).toBe(true);
    expect(p.mergeWhenGreen).toBe(false);
    expect(p.triggerDrain).toBe(false);
  });
  it('bare --no-wait (open-only): NEVER labels (CI unconfirmed) and never waits/merges/triggers', () => {
    const p = planPrLand({ wait: false, labelOnGreen: false });
    expect(p.mode).toBe('open-only');
    expect(p.waitForChecks).toBe(false);
    expect(p.labelWhenGreen).toBe(false); // the #2199 fix: no label before green
    expect(p.mergeWhenGreen).toBe(false);
    expect(p.triggerDrain).toBe(false);
  });
  it('--label-on-green forces the wait even alongside --no-wait (the label REQUIRES a green confirmation)', () => {
    expect(planPrLand({ wait: false, labelOnGreen: true }).mode).toBe('label-on-green');
  });
  it('no mode ever labels without waiting for checks first', () => {
    for (const w of [true, false]) for (const g of [true, false]) {
      const p = planPrLand({ wait: w, labelOnGreen: g });
      if (p.labelWhenGreen) expect(p.waitForChecks).toBe(true); // labelWhenGreen ⇒ waitForChecks
    }
  });
});

describe('resolveParkLabel + planPrLand park mode — #2622 held-for-review open', () => {
  it('PARK_LABELS is exactly the two held-for-review labels (sourced from REVIEW_LABELS, no drift)', () => {
    expect(PARK_LABELS).toEqual([REVIEW_LABELS.human, REVIEW_LABELS.pending]);
  });
  it('flag absent → not a park run', () => {
    expect(resolveParkLabel(undefined)).toEqual({ park: false });
    expect(resolveParkLabel(false)).toEqual({ park: false });
    expect(resolveParkLabel(null)).toEqual({ park: false });
  });
  it('a valid held-for-review label resolves ok', () => {
    expect(resolveParkLabel('review:human')).toEqual({ park: true, ok: true, label: REVIEW_LABELS.human });
    expect(resolveParkLabel('review:pending')).toEqual({ park: true, ok: true, label: REVIEW_LABELS.pending });
  });
  it('a bare --park (no value → true) is a validation failure, not a silent pass', () => {
    const r = resolveParkLabel(true);
    expect(r.park).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no value/);
  });
  it('an off-list label (even a real non-held review label) is rejected', () => {
    for (const bad of ['review:accepted', 'review:changes', 'ready-to-merge', 'redteam:accepted', 'nonsense']) {
      const r = resolveParkLabel(bad);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/--park must be one of/);
    }
  });
  it('park mode: open with the review label, do NOT wait/label-ready/merge/trigger a drain', () => {
    const p = planPrLand({ wait: true, labelOnGreen: false, park: REVIEW_LABELS.pending });
    expect(p.mode).toBe('park');
    expect(p.parkLabel).toBe(REVIEW_LABELS.pending);
    expect(p.waitForChecks).toBe(false);   // held for review — never waited/landed by this run
    expect(p.labelWhenGreen).toBe(false);  // NEVER applies ready-to-merge
    expect(p.mergeWhenGreen).toBe(false);
    expect(p.triggerDrain).toBe(false);
  });
  it('park takes precedence over --label-on-green and --no-wait (a held PR must not carry the auto-land signal)', () => {
    expect(planPrLand({ wait: true, labelOnGreen: true, park: REVIEW_LABELS.human }).mode).toBe('park');
    expect(planPrLand({ wait: false, labelOnGreen: true, park: REVIEW_LABELS.human }).mode).toBe('park');
  });
  it('no park label → the ordinary wait/label/open-only modes are unchanged', () => {
    expect(planPrLand({ wait: true, labelOnGreen: false, park: null }).mode).toBe('land');
    expect(planPrLand({ wait: true, labelOnGreen: true, park: null }).mode).toBe('label-on-green');
    expect(planPrLand({ wait: false, labelOnGreen: false, park: null }).mode).toBe('open-only');
  });
});

describe('pr-land contract guards (source-level, mirrors gated-push-wiring)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/pr-land.mjs'), 'utf8');
  it('#2199: the label is applied only after the green-wait — never eagerly at PR open', () => {
    // applyLabel() must be invoked AFTER the check-wait loop (`labelWhenGreen`), not in the open/3b block.
    expect(src).toMatch(/if \(PLAN\.labelWhenGreen\) applyLabel\(\)/);
    // the open-only (--no-wait) path emits UNLABELLED
    expect(src).toMatch(/opened UNLABELLED|UNLABELLED — CI not confirmed/);
    // the eager pre-CI add-label call is gone from the open path (applyLabel is a deferred closure)
    expect(src).toMatch(/const applyLabel = \(\) =>/);
  });
  it('only ever pushes a lane/* head (guard carve-out) and never force-pushes', () => {
    expect(src).toMatch(/\/\^lane\\\//);        // enforces --ref starts with lane/
    expect(src).not.toMatch(/--force/);          // never force
  });
  it('aborts on a red required check (never merges a red PR)', () => {
    expect(src).toMatch(/check-red/);            // the abort path exists
    // The functional guarantee that no --auto native-queue flag is ever emitted is covered by the
    // buildMergeArgs test above (…).not.toContain('--auto') — the drain owns ordering, not GitHub.
  });
  it('retains a git-merge fallback (#2138 Fork 5 (a))', () => {
    expect(src).toMatch(/fallback-git/);
    expect(src).toMatch(/merge', '--no-ff'/);
  });
  it('#2622: --park opens the review label at open then STOPS — before the wait loop, no ready-to-merge/drain', () => {
    // The park branch exists and emits the `parked` outcome without waiting.
    expect(src).toMatch(/if \(PLAN\.mode === 'park'\)/);
    expect(src).toMatch(/reason: 'parked'/);
    // An invalid --park value is a fail-fast BEFORE any push/create (never a silently-ignored flag).
    expect(src).toMatch(/reason: 'bad-park'/);
    // The park branch is placed BEFORE the check-wait loop (so it never waits/labels ready-to-merge).
    expect(src.indexOf("PLAN.mode === 'park'")).toBeLessThan(src.indexOf('// 4. Wait until GitHub'));
    // An invalid --park fails fast BEFORE the lane-ref push / PR create — never after touching origin.
    expect(src.indexOf("reason: 'bad-park'")).toBeLessThan(src.indexOf('Publish the source commit to the lane ref'));
    // The plan is built with the validated park label threaded in.
    expect(src).toMatch(/park: PARK\.ok \? PARK\.label : null/);
  });
  it('#2833: the verification finish-guard is wired BEFORE the lane-ref push and refuses an unfinished/absent verification', () => {
    // The guard calls the shared pure decision core (never a re-implementation of the gate).
    expect(src).toMatch(/verifyGateDecision/);
    expect(src).toMatch(/from '\.\/lib\/lane-verify\.mjs'/);
    // #2833 finding 2 — the marker read is SINGLE-SOURCED via `readVerifyMarker`, NEVER a hand-inlined JSON.parse
    // of the marker here (pr-land's old inline parser caught only a throw, so a valid-JSON non-object slipped
    // through as untracked and landed unverified). Source-contract: pr-land calls the shared reader, and contains
    // no bare `JSON.parse(...VERIFY_FILENAME...)` / `JSON.parse(readFileSync(markerPath...))` of the marker.
    expect(src).toMatch(/readVerifyMarker\(gitDir\)/);
    expect(src).not.toMatch(/JSON\.parse\([^)]*VERIFY_FILENAME/);
    expect(src).not.toMatch(/JSON\.parse\(readFileSync\(markerPath/);
    // It reads the HEAD's marker and refuses (non-ok) on the source commit BEFORE publishing to the lane ref.
    expect(src).toMatch(/headSha: refSha/);
    // Anchor the ordering on a token unique to the guard BODY — NOT the bare identifier `verifyGateDecision`,
    // which also appears in the top-of-file ESM import (line ~98) and so ALWAYS sorts before the push, making the
    // assertion tautological (#2833 finding 3). "#2833's stall guard" lives only in the guard's emit() detail, so
    // moving the guard below the push actually flips this comparison and fails the test (house precedent: the
    // #2622 assertion anchors on `reason: 'bad-park'`, a body-unique token).
    const GUARD_BODY = "this is #2833's stall guard";
    expect(src).toContain(GUARD_BODY);
    expect(src.indexOf(GUARD_BODY)).toBeLessThan(src.indexOf('Publish the source commit to the lane ref'));
    // #2833 finding 5 — the require-verified / break-glass options are resolved through the SHARED
    // `resolveVerifyOptions` resolver (same as `verify-lane check`), never hand-inlined here, so the two entry
    // points can never disagree on the same flag/env pair.
    expect(src).toMatch(/resolveVerifyOptions\(\{ flags, env: process\.env \}\)/);
    expect(src).toMatch(/WE_LAND_UNVERIFIED/);
  });
  it('#2622: every PARK_LABELS value has REVIEW_LABEL_META (so the park label provision never crashes on undefined)', () => {
    for (const label of PARK_LABELS) {
      expect(REVIEW_LABEL_META[label]).toBeDefined();
      expect(REVIEW_LABEL_META[label].color).toBeTruthy();
      expect(REVIEW_LABEL_META[label].description).toBeTruthy();
    }
  });
  it('self-heals id collisions AFTER the merge, non-destructively, without ever failing the land (#2071)', () => {
    expect(src).toMatch(/function runHeal/);                      // the heal step exists
    expect(src).toMatch(/const HEAL = !flags\['no-heal'\]/);      // on by default, --no-heal opts out
    // Non-destructive sync: detached checkout of the post-merge base, NEVER `git reset --hard` on a branch
    // (so an accidental --repo=<primary-with-work> can't be reset out from under the user).
    expect(src).toMatch(/checkout', '--detach'/);
    expect(src).not.toMatch(/reset', '--hard'/);
    // Skips a dirty tree, and gates the healed tree before the (non-force) push.
    expect(src).toMatch(/skipped id-collision heal/);
    expect(src).toMatch(/check:standards/);
    // #2290 — the heal now runs only in the (break-glass-gated) --fallback-git path, after its local merge.
    expect(src.indexOf('const heal = HEAL ? runHeal')).toBeGreaterThan(src.indexOf("gitC(['merge', '--no-ff'"));
    // #2312 — `runHeal` must scope its commit to the renumber's OWN files (`scopeHealChangedPaths`), never a
    // bare `git diff --name-only` (that swept foreign checkout state into the healed commit, observed live,
    // PR #168): the bare diff is only ever fed straight into the scoping helper, never straight into `git add`.
    expect(src).toMatch(/scopeHealChangedPaths\(plan, allChanged\)/);
    expect(src).toMatch(/if \(foreign\.length\) return \{ healed: false, renumbered, warning:/);
    expect(src.indexOf("gitC(['add', ...changed])")).toBeGreaterThan(src.indexOf('scopeHealChangedPaths'));
  });
  it('#2312 — reproduces the leaky heal: a foreign dirty tracked file must never ride the renumber commit', () => {
    // The exact incident shape (PR #168, 2026-07-06): a clean single-file backlog renumber ran in a checkout
    // that ALSO carried unrelated uncommitted tracked work (agent-memory + skill + script edits from other
    // in-flight items) — a bare `git diff --name-only` would report ALL of it as "changed".
    const plan = { writePaths: ['2283-file.md'], deletePaths: ['2301-file.md'] };
    const allChanged = [
      'backlog/2283-file.md',
      'backlog/2301-file.md',
      'agent-memory-src/index-meta.md',
      'backlog/2301-force-agent-memory.md',
      'scripts/merge-ai-prs.mjs',
      'scripts/lane-drain.mjs',
      'scripts/__tests__/lane-drain.test.mjs',
      'skills-src/closing-session/SKILL.md',
    ];
    const { changed, foreign } = scopeHealChangedPaths(plan, allChanged);
    // BUG (pre-fix behaviour, if `changed` were just `allChanged`): all 8 paths would ride the heal commit.
    // FIX: only the renumber's own two paths are "changed"; every unrelated path is flagged "foreign" so the
    // caller aborts instead of committing them.
    expect(changed).toEqual(['backlog/2283-file.md', 'backlog/2301-file.md']);
    expect(foreign).toEqual([
      'agent-memory-src/index-meta.md',
      'backlog/2301-force-agent-memory.md',
      'scripts/merge-ai-prs.mjs',
      'scripts/lane-drain.mjs',
      'scripts/__tests__/lane-drain.test.mjs',
      'skills-src/closing-session/SKILL.md',
    ]);
  });
  it('#2312 — a checkout with ONLY the renumber\'s own diff has no foreign paths (the common, safe case)', () => {
    const plan = { writePaths: ['2283-file.md'], deletePaths: ['2301-file.md'] };
    const allChanged = ['backlog/2283-file.md', 'backlog/2301-file.md'];
    expect(scopeHealChangedPaths(plan, allChanged)).toEqual({ changed: allChanged, foreign: [] });
  });
  it('#2312 — tolerates a plan missing writePaths/deletePaths (older CLI output) without throwing', () => {
    expect(scopeHealChangedPaths({}, ['backlog/2283-file.md'])).toEqual({ changed: [], foreign: ['backlog/2283-file.md'] });
    expect(scopeHealChangedPaths(null, [])).toEqual({ changed: [], foreign: [] });
  });
  it('regenerates derived artifacts AFTER the merge (and after heal), without ever failing the land (#2182)', () => {
    expect(src).toMatch(/function runRegen/);                       // the regen step exists
    expect(src).toMatch(/const REGEN = !flags\['no-regen'\]/);     // on by default, --no-regen opts out
    // runRegen must be defined/called AFTER runHeal — heal wins ordering over regen (#2071 before #2182).
    expect(src.indexOf('function runRegen')).toBeGreaterThan(src.indexOf('function runHeal'));
    // Non-destructive: detached checkout (reuses runHeal's pattern), NEVER reset --hard on a branch.
    expect(src.indexOf('function runRegen')).toBeGreaterThan(src.indexOf('checkout', '--detach'.length));
    expect(src).not.toMatch(/reset', '--hard'/);
    // Skips a dirty tree (can't regen against uncommitted inputs).
    expect(src).toMatch(/skipped derived-artifact regen/);
    // A regen failure is surfaced but never fails the land.
    expect(src).toMatch(/regen failed \(non-fatal\)/);
    // Never force-pushes the regen commit.
    expect(src).not.toMatch(/--force/);
  });
  it('#2290: pr-land NEVER merges on the default path — the drain is the sole writer to main', () => {
    // No `gh pr merge` (or buildMergeArgs invocation) anywhere in the runCli land flow.
    expect(src).not.toMatch(/ghC\(buildMergeArgs/);
    // The default path triggers a single-couple fast drain instead of merging.
    expect(src).toMatch(/triggerSingleCoupleDrain/);
    expect(src).toMatch(/merge-ai-prs\.mjs/);
    expect(src).toMatch(/--only=/);
  });
  it('#2659: a post-push PR-open failure on an outside dependency routes to the infra-blocked state, not a hard fail', () => {
    // the create-fail catch routes through onCreateFailed (classify → record → blocked-on-infra), never straight
    // to a hard ghFailed — so built + PUSHED work is never stranded on a transient GitHub/network fault.
    expect(src).toMatch(/catch \(e\) \{ return onCreateFailed\(e\); \}/);
    expect(src).toMatch(/function onCreateFailed/);
    expect(src).toMatch(/classifyPrOpenFailure/);
    // a NON-infra failure (bad body / auth / already-exists) still hard-fails via ghFailed — never a doomed loop.
    expect(src).toMatch(/if \(!infra\) return ghFailed/);
    // it records the RESUMABLE handle (into the primary store, via the clone's alternates) and emits
    // blocked-on-infra (exit 4) with the resume handle so the conveyor can auto-retry/resume.
    expect(src).toMatch(/recordInfraBlockIO/);
    expect(src).toMatch(/primaryRootFromClone/);
    expect(src).toMatch(/reason: 'blocked-on-infra'/);
    expect(src).toMatch(/resumeHandle:/);
  });
  it('#2290: the --fallback-git local merge is routed through the shared gate (break-glass only)', () => {
    // fallback-git is a write to main → it must assert the caller may merge (blocked unless break-glass).
    expect(src).toMatch(/assertMayMerge\(\{ caller: 'pr-land'/);
    // still ff-syncs the user's primary checkout, best-effort, after a land.
    expect(src).toMatch(/function syncPrimaryMain/);
    expect(src).toMatch(/'pull', '--ff-only', '--autostash'/);
    expect(src).toMatch(/NOT fast-forwarded/);
  });
});

describe('resolveRosterReconcile — #2635 bind + reconcile the jury roster from the REAL diff at PR-open', () => {
  it('a care=none (non-escalating) PR recomputes an EMPTY roster and reconciles to a pure bind', () => {
    const r = resolveRosterReconcile({ careLevel: 'none', changedFiles: ['src/components/thing.ts'] });
    expect(r.effective).toEqual([]);
    expect(r.expanded).toBe(false);
    expect(r.humanAlignmentRequired).toBe(false);
  });

  it('a falsy care-level short-circuits to an empty recompute (no jury) — pure bind, no throw', () => {
    const r = resolveRosterReconcile({ careLevel: undefined, changedFiles: ['scripts/pr-land.mjs'] });
    expect(r.effective).toEqual([]);
    expect(r.humanAlignmentRequired).toBe(false);
  });

  it('an escalating UI diff with NO pre-registered roster → binds the recomputed roster (incl. perspective lenses), no re-alignment', () => {
    // careLevel high → the static PANEL_LENSES; a UI file in the diff → the a11y + visual perspective lenses.
    const r = resolveRosterReconcile({ careLevel: 'high', changedFiles: ['src/components/widget.css'] });
    expect(r.effective).toEqual(expect.arrayContaining(['correctness', 'security', 'a11y', 'visual-vs-target']));
    expect(r.humanAlignmentRequired).toBe(false); // nothing pre-registered → nothing to have drifted past
  });

  it('a UI diff whose earned lenses EXCEED the pre-registered set → expansion re-triggers human alignment', () => {
    // The charter pre-registered only the static lenses; the real diff moved a page file, earning a11y/visual/perf.
    const r = resolveRosterReconcile({
      careLevel: 'high',
      changedFiles: ['demos/loan/index.html'],
      preRegistered: ['correctness', 'security', 'simplicity', 'standards-conformance'],
    });
    expect(r.expanded).toBe(true);
    expect(r.added).toEqual(expect.arrayContaining(['a11y', 'visual-vs-target', 'perf']));
    expect(r.humanAlignmentRequired).toBe(true);
  });

  it('a script-only diff that matches its pre-registered roster → no expansion, no re-alignment', () => {
    const r = resolveRosterReconcile({
      careLevel: 'high',
      changedFiles: ['scripts/pr-land.mjs'],
      preRegistered: ['correctness', 'security', 'simplicity', 'standards-conformance'],
    });
    expect(r.expanded).toBe(false);
    expect(r.humanAlignmentRequired).toBe(false);
  });
});
