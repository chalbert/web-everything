/**
 * @file scripts/__tests__/citation-check.test.mjs
 * @description Unit harness for the CITATION-VERIFICATION gate family (backlog #2821 — proven subset).
 *
 * Reproduces the real instances the #957 ratification review bounced on, as fixtures that FAIL today and
 * PASS once the citation is corrected:
 *   • the `#agent-convergence-independent-validation` anchor attributed to `#2439` FAILS (its codifiedIn
 *     ruling is `#2398`); the same attributed to `#2398` PASSES — the 11-vs-1 core (#2821 gate 10).
 *   • a dangling `we:scripts/nope.mjs:999` FAILS; a valid in-repo `we:<path>:<line>` PASSES; a `fui:` /
 *     `plateau:` cross-repo locus is NOT errored (#2821 gate 5).
 *   • a `xNNNNNN` hash-slug in a `reports/` file FAILS; the same in a `backlog/` file PASSES (in-scope,
 *     self-heals at land) (#2821 gate 3).
 *
 * Non-shallow: each case asserts the message/locus of the finding, not just a count. The pure detectors
 * are I/O-free, so filesystem facts are injected — the test never touches the real tree except the one
 * "real data stays warn-clean at ERROR promotion" guard the wiring relies on.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildAnchorOwners,
  findAnchorRulingMismatches,
  findDanglingLoci,
  findOutOfScopeHashSlugs,
  countSourceLines,
  CROSS_REPO_LOCI,
  findUnresolvedIdentifiers,
  buildIdentifierIndex,
  isIndexableSourcePath,
  regionMarkerPayload,
  stripSourceComments,
  parseIdentifierSpan,
  codeSpans,
  PROVENANCE_ESCAPE_MARKERS,
} from '../lib/citation-check.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('buildAnchorOwners', () => {
  it('maps an anchor to the SET of backlog items whose codifiedIn owns it', () => {
    const owners = buildAnchorOwners([
      { num: '2398', codifiedIn: 'docs/agent/platform-decisions.md#agent-convergence-independent-validation' },
      { num: '2439', codifiedIn: undefined },
      { num: '020', codifiedIn: '"docs/agent/platform-decisions.md#constellation-placement"' },
    ]);
    expect(owners.get('agent-convergence-independent-validation')).toEqual(new Set(['2398']));
    expect(owners.get('constellation-placement')).toEqual(new Set(['020']));
    expect(owners.has('nonexistent')).toBe(false);
  });

  it('UNIONS every owner of a MULTI-OWNER anchor — the corpus reality (32+ anchors have 2+ owners)', () => {
    // #constellation-placement has 43 codifiedIn owners on the real tree; the single-owner premise kept only
    // whichever readdirSync yielded first and mislabeled the rest. The union keeps them all.
    const owners = buildAnchorOwners([
      { num: '020', codifiedIn: 'docs/agent/platform-decisions.md#constellation-placement' },
      { num: '021', codifiedIn: 'docs/agent/platform-decisions.md#constellation-placement' },
      { num: '022', codifiedIn: 'docs/agent/platform-decisions.md#constellation-placement' },
    ]);
    expect(owners.get('constellation-placement')).toEqual(new Set(['020', '021', '022']));
  });

  it('confers ownership via graduatedTo too (an item that graduated INTO the anchor)', () => {
    // 14 items on the real tree graduate to a platform-decisions anchor; that is just as much an authority
    // for it as codifiedIn. #1832 owns #composition-preserves-a11y-contract via graduatedTo.
    const owners = buildAnchorOwners([
      { num: '1795', codifiedIn: 'docs/agent/platform-decisions.md#composition-preserves-a11y-contract' },
      { num: '1832', graduatedTo: '"docs/agent/platform-decisions.md#composition-preserves-a11y-contract"' },
    ]);
    expect(owners.get('composition-preserves-a11y-contract')).toEqual(new Set(['1795', '1832']));
  });
});

describe('findAnchorRulingMismatches — gate 10 (the 11-vs-1 core)', () => {
  const owners = buildAnchorOwners([
    { num: '2398', codifiedIn: 'docs/agent/platform-decisions.md#agent-convergence-independent-validation' },
  ]);

  it('FAILS when the anchor is attributed to #2439 (its ruling is #2398) — shape A `#anchor (#NNN)`', () => {
    const text = 'a landed PR is accepted by an agent that did not author the fix ' +
      '(`#agent-convergence-independent-validation` (#2439)). No knob relaxes it.';
    const hits = findAnchorRulingMismatches(text, owners);
    expect(hits).toHaveLength(1);
    expect(hits[0].anchor).toBe('agent-convergence-independent-validation');
    expect(hits[0].citedNum).toBe('2439');
    expect(hits[0].owners).toEqual(['2398']);
  });

  it('FAILS on the real #2563 shape — anchor and number in one paren `(`#anchor`, #2439)` (shape B)', () => {
    const text = 'accepted by an agent that did not author the fix ' +
      '(`#agent-convergence-independent-validation`, #2439). No knob relaxes it.';
    const hits = findAnchorRulingMismatches(text, owners);
    expect(hits).toHaveLength(1);
    expect(hits[0].shape).toBe('B');
    expect(hits[0].citedNum).toBe('2439');
    expect(hits[0].owners).toEqual(['2398']);
  });

  it('PASSES when the anchor is attributed to the correct ruling #2398', () => {
    const text = 'did not author the fix (`#agent-convergence-independent-validation` (#2398)).';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });

  it('does NOT fire on a bare cross-reference with no attributing number (a trailing PROSE paren)', () => {
    // Line 3186 of the real platform-decisions.md — anchor followed by a prose parenthetical, no #NNN.
    const text = 'Extends [#agent-convergence-independent-validation](#agent-convergence-independent-validation) ' +
      '(independence rests on a distinct validator, never peer/self agreement).';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });

  it('does NOT fire when a number belongs to a DIFFERENT paren than the anchor', () => {
    // Real line-2839 shape: a preceding `(#2563)` ratified-marker, then the anchor mentioned in prose.
    const text = '**Ratified 2026-07-18 (#2563).** Composes with — does not alter — ' +
      '[#agent-convergence-independent-validation](#agent-convergence-independent-validation): a care signal.';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });

  it('does NOT fire on an INCIDENTAL number sharing the SAME paren as the anchor (no comma attribution)', () => {
    // Shape-B precision: `#2439` here is a build-slice mention, not a ruling attribution — there is no
    // `anchor, #NNN` (or `#NNN, anchor`) comma-adjacency, so co-residence in one paren must NOT fire.
    const text = 'the convergence gate (#2439 introduced the check enforced by ' +
      '`#agent-convergence-independent-validation`) holds.';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });

  it('does NOT fire on the heading-definition form `{#anchor}` followed by its `**Ratified (#NNN)**` line', () => {
    const text = '### Agent fix/convergence {#agent-convergence-independent-validation}\n\n' +
      '**Ratified 2026-07-10 (#2398, graduated to epic #2410).**';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });
});

describe('findAnchorRulingMismatches — MULTI-OWNER authority (32+ anchors have 2+ owners on the corpus)', () => {
  // `#component-dc` is one of the real multi-owner anchors. A citation to ANY of its legitimate owners must
  // PASS; only a number that owns NONE of it is a genuine mis-attribution and FAILS.
  const owners = buildAnchorOwners([
    { num: '043', codifiedIn: 'docs/agent/platform-decisions.md#component-dc' },
    { num: '854', codifiedIn: 'docs/agent/platform-decisions.md#component-dc' },
    { num: '900', codifiedIn: 'docs/agent/platform-decisions.md#component-dc' },
    // graduatedTo also confers ownership — mirror the real #compose-dont-handroll / #933 case.
    { num: '933', graduatedTo: '"docs/agent/platform-decisions.md#compose-dont-handroll"' },
    { num: '1394', codifiedIn: 'docs/agent/platform-decisions.md#compose-dont-handroll' },
  ]);

  it('PASSES when the cited #NNN is ONE of several legitimate owners (not the first-seen)', () => {
    // #854 is not the first owner, yet it genuinely owns #component-dc — the single-owner premise wrongly
    // flagged this as a mismatch (16 of the 17 corpus false positives were exactly this).
    const text = 'the definition-of-component rule (`#component-dc` (#854)) governs here.';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });

  it('FAILS when the cited #NNN owns NONE of the anchor (a genuinely wrong attribution)', () => {
    const text = 'the definition-of-component rule (`#component-dc` (#2439)) governs here.';
    const hits = findAnchorRulingMismatches(text, owners);
    expect(hits).toHaveLength(1);
    expect(hits[0].citedNum).toBe('2439');
    expect(hits[0].owners).toEqual(['043', '854', '900']); // the full sorted owner set, none of them #2439
  });

  it('PASSES when the cited #NNN owns the anchor via graduatedTo (demo-workflow #compose-dont-handroll #933)', () => {
    // The reviewer's own example: `demo-workflow.md` citing `#compose-dont-handroll (#933)` must PASS, since
    // #933 owns it via graduatedTo even though #1394 owns it via codifiedIn.
    const text = 'compose over hand-rolling (`#compose-dont-handroll` (#933)).';
    expect(findAnchorRulingMismatches(text, owners)).toHaveLength(0);
  });
});

describe('findDanglingLoci — gate 5 (`we:<path>:<line>` must resolve)', () => {
  const tree = { 'scripts/real.mjs': 200 };
  const fileExists = (p) => Object.hasOwn(tree, p);
  const lineCount = (p) => tree[p] ?? null;

  it('FAILS on a dangling path — `we:scripts/nope.mjs:999` (no such file)', () => {
    const hits = findDanglingLoci('see we:scripts/nope.mjs:999 for the call', { fileExists, lineCount });
    expect(hits).toHaveLength(1);
    expect(hits[0].locus).toBe('we:scripts/nope.mjs:999');
    expect(hits[0].reason).toBe('missing-file');
  });

  it('FAILS on an out-of-range line — file exists but line is past EOF', () => {
    const hits = findDanglingLoci('defined at we:scripts/real.mjs:999', { fileExists, lineCount });
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('line-out-of-range');
    expect(hits[0].path).toBe('scripts/real.mjs');
  });

  it('PASSES on a valid in-repo locus (file exists, line in range), incl. a range on both bounds', () => {
    expect(findDanglingLoci('at we:scripts/real.mjs:144', { fileExists, lineCount })).toHaveLength(0);
    expect(findDanglingLoci('at we:scripts/real.mjs:1-200', { fileExists, lineCount })).toHaveLength(0);
  });

  it('does NOT error a cross-repo `fui:` / `plateau:` locus (target not in this checkout)', () => {
    const text = 'see fui:scripts/gone.mjs:9999 and plateau:src/missing.ts:4242';
    expect(findDanglingLoci(text, { fileExists, lineCount })).toHaveLength(0);
    expect(CROSS_REPO_LOCI.has('fui:')).toBe(true);
    expect(CROSS_REPO_LOCI.has('plateau:')).toBe(true);
  });

  it('does NOT match a symbol-anchor form `we:path#symbol` (no `:line`) — gate 6 is not in this subset', () => {
    expect(findDanglingLoci('we:scripts/real.mjs#applyLedger', { fileExists, lineCount })).toHaveLength(0);
  });

  it('SKIPS a `..`-escaping or absolute path WITHOUT ever calling the fs readers (no traversal read)', () => {
    // A locus whose path climbs out of the repo (or is absolute) must never reach fileExists/lineCount — the
    // caller resolves those against ROOT with readFileSync, so a huge/streaming target would hang the gate.
    const calls = [];
    const spyExists = (p) => { calls.push(p); return true; };
    const spyCount = (p) => { calls.push(p); return 10; };
    const text = 'see we:../../../../dev/urandom:1 and we:/etc/passwd:1 for the call';
    expect(findDanglingLoci(text, { fileExists: spyExists, lineCount: spyCount })).toHaveLength(0);
    expect(calls).toHaveLength(0); // never resolved — the guard skips before any fs read
  });
});

describe('countSourceLines — gate 5 line-count (no trailing-newline overcount)', () => {
  it('does not count the terminator of a newline-terminated file as an extra line', () => {
    expect(countSourceLines('a\nb\n')).toBe(2); // two lines, trailing \n is a terminator not a 3rd line
    expect(countSourceLines('a\nb')).toBe(2);   // no trailing newline — still two lines
    expect(countSourceLines('a')).toBe(1);
    expect(countSourceLines('a\n')).toBe(1);
    expect(countSourceLines('')).toBe(0);       // empty file has no lines
  });

  it('makes a locus one line past the true end read as OUT of range (the off-by-one the naive split missed)', () => {
    const tree = { 'scripts/real.mjs': 'l1\nl2\n' }; // 2 real lines, trailing newline
    const fileExists = (p) => Object.hasOwn(tree, p);
    const lineCount = (p) => countSourceLines(tree[p] ?? '');
    const hits = findDanglingLoci('at we:scripts/real.mjs:3', { fileExists, lineCount });
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('line-out-of-range');
    expect(findDanglingLoci('at we:scripts/real.mjs:2', { fileExists, lineCount })).toHaveLength(0);
  });
});

describe('findOutOfScopeHashSlugs — gate 3 (hash-slug outside the at-land rewrite scope)', () => {
  it('FAILS on a `#xNNNNNN` hash-ref in a reports/ file (rewriter never touches reports/)', () => {
    const hits = findOutOfScopeHashSlugs('the read slice #xntcdet re-estimates', 'reports/2026-07-20-slice.md');
    expect(hits).toHaveLength(1);
    expect(hits[0].slug).toBe('xntcdet');
    expect(hits[0].form).toBe('hash-ref');
  });

  it('FAILS on a `xNNNNNN-slug.md` file link in a research-descriptions njk', () => {
    const hits = findOutOfScopeHashSlugs('[the item](x9kptqv-ratify-gate.md)',
      'src/_includes/research-descriptions/topic.njk');
    expect(hits).toHaveLength(1);
    expect(hits[0].slug).toBe('x9kptqv');
    expect(hits[0].form).toBe('file-link');
  });

  it('PASSES (empty) for the SAME hash-slug in a backlog/ file — in-scope, self-heals at land', () => {
    expect(findOutOfScopeHashSlugs('cites #xntcdet', 'backlog/2565-epic.md')).toHaveLength(0);
    expect(findOutOfScopeHashSlugs('cites #xntcdet', 'docs/agent/backlog-workflow.md')).toHaveLength(0);
  });

  it('does NOT fire on a word that merely starts with x + letters but is not a hash-slug form', () => {
    // `xoverflow` has 8 chars after x; a real slug is exactly `x`+6 and cited as `#x...` or `x...-slug.md`.
    expect(findOutOfScopeHashSlugs('the xoverflow example and extended prose', 'reports/r.md')).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// The PROVENANCE gate (#3026) — a backticked identifier in prose must resolve, or be marked
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** A tree that knows only these names. `validateTodoMarker` is real; `validateTodoMarkerBlock` never was —
 *  that pair IS the round-3 regression this gate exists to catch. */
const REAL = new Set(['validateTodoMarker', 'validateContract', 'countSourceLines', 'computeAgreementMetric',
  'resolveLandMode', 'ciStatus', 'POLICY_SPEC_BASENAMES']);
const resolves = (t) => REAL.has(t);
/** Report the whole body (the wired gate always passes a real added-line set; `null` means "all lines"). */
const scan = (text, opts = {}) => findUnresolvedIdentifiers(text, { resolves, addedLines: null, ...opts });
const tokens = (text, opts) => scan(text, opts).filter((f) => f.kind === 'unresolved').map((f) => f.token);

describe('parseIdentifierSpan — what shape reads as an existence claim', () => {
  it('accepts camelCase and SCREAMING_SNAKE, bare', () => {
    expect(parseIdentifierSpan('validateTodoMarker')).toEqual({ token: 'validateTodoMarker', form: 'bare' });
    expect(parseIdentifierSpan('POLICY_SPEC_BASENAMES')).toEqual({ token: 'POLICY_SPEC_BASENAMES', form: 'bare' });
  });

  it('accepts a call WITH ARGUMENTS — the strongest existence claim, and the one #3026 as filed missed', () => {
    // The statute asserts `enforceFlipReady({ ciStatus, reviewShadowLedger })`. #3026's design said only
    // "a trailing `()` tolerated", which does not match that span at all — so the single most-cited false
    // symbol in the briefing would have walked straight through the gate built to its literal spec.
    expect(parseIdentifierSpan('enforceFlipReady({ ciStatus, reviewShadowLedger })'))
      .toEqual({ token: 'enforceFlipReady', form: 'call' });
    expect(parseIdentifierSpan('judgeSpawn()')).toEqual({ token: 'judgeSpawn', form: 'call' });
    expect(parseIdentifierSpan('ns.deep.someHelper(a, b)')).toEqual({ token: 'someHelper', form: 'call' });
  });

  it('rejects the shapes that are ENGLISH, not citations — the false-positive floor', () => {
    for (const notACitation of ['status', 'the walk', 'TODO', 'WE', 'CustomStore', 'kebab-case', 'a.b']) {
      expect(parseIdentifierSpan(notACitation)).toBeNull();
    }
  });
});

describe('findUnresolvedIdentifiers — the regression the gate was built for', () => {
  it('THE REAL ONE: `validateTodoMarkerBlock` fires, `validateTodoMarker` does not', () => {
    // Round 3 of PR #1112, verbatim in shape: a name that ought to have existed, shipped in the past tense.
    const body = 'Where it is today: `validateTodoMarkerBlock` / the reasons walk in `validateContract`.';
    const found = scan(body);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'unresolved', token: 'validateTodoMarkerBlock', form: 'bare', line: 1 });
    expect(scan('the real helper is `validateTodoMarker`')).toHaveLength(0);
  });

  it('catches the statute call-form cite `enforceFlipReady({ … })` that resolves to nothing', () => {
    expect(tokens('gated by a readiness predicate, `enforceFlipReady({ ciStatus, reviewShadowLedger })`, that arms it'))
      .toEqual(['enforceFlipReady']);
  });

  it('stays silent on names that DO resolve, including inside a call', () => {
    expect(scan('the proven `computeAgreementMetric` bar and `resolveLandMode()` path')).toHaveLength(0);
  });

  it('never reads a fenced code block as prose', () => {
    const body = ['prose is checked: `realOne`', '```js', 'const totallyFakeSymbol = 1; // `alsoFake`', '```',
      'and `anotherFake` after the fence'].join('\n');
    expect(tokens(body)).toEqual(['realOne', 'anotherFake']);
  });
});

describe('findUnresolvedIdentifiers — the escapes, and their limits', () => {
  it('the inline marker suppresses, and all three spellings work', () => {
    expect(scan('a new `mountLaneBoard` (proposed) helper')).toHaveLength(0);
    expect(scan('`enforceFlipReady` (does not exist) in the tree')).toHaveLength(0);
    expect(scan('names like `detectAnomalies` (example) illustrate the class')).toHaveLength(0);
    // Emphasis inside the parens is the form actually written in #3013 prep.
    expect(scan('`enforceFlipReady` (**does not exist**) — refuted')).toHaveLength(0);
  });

  it('the escape vocabulary is CLOSED — a near-miss word does not suppress', () => {
    // Greppability is the whole value; an open synonym list would make `grep '(proposed)'` incomplete.
    expect(tokens('a new `mountLaneBoard` (planned) helper')).toEqual(['mountLaneBoard']);
    expect(tokens('a new `mountLaneBoard` (future) helper')).toEqual(['mountLaneBoard']);
    expect(PROVENANCE_ESCAPE_MARKERS).toEqual(['proposed', 'does not exist', 'example']);
  });

  it('the marker binds to the token it FOLLOWS, not to the whole line', () => {
    expect(tokens('`firstFake` and `secondFake` (proposed)')).toEqual(['firstFake']);
  });

  it('a reasoned `provenance-lint: off` region suppresses; `on` re-arms', () => {
    const body = ['<!-- provenance-lint: off — historical citations, these never existed -->',
      '| `collectOpenItemIds` | `validateTodoMarkerBlock` |',
      '<!-- provenance-lint: on -->', 'but `escapedNothing` here fires'].join('\n');
    expect(tokens(body)).toEqual(['escapedNothing']);
  });

  it('a REASONLESS `provenance-lint: off` suppresses NOTHING and is reported itself (fail-closed)', () => {
    const body = ['<!-- provenance-lint: off -->', '`stillFires` must still fire'].join('\n');
    const found = scan(body);
    expect(found.map((f) => f.kind)).toEqual(['escape-no-reason', 'unresolved']);
    expect(found[1].token).toBe('stillFires');
  });

  it('`## Done when` / `## Design` are escape zones, and a SUBSECTION inherits the zone', () => {
    const body = ['# Item', 'lede cites `ledeFake`', '## Done when', '- `doneWhenFake` exists',
      '### sub of done-when', '- `subFake` too', '## Provenance', 'cites `provenanceFake`'].join('\n');
    expect(tokens(body)).toEqual(['ledeFake', 'provenanceFake']);
  });

  it('a marker QUOTED in prose or in an inline code span does NOT open a region (the self-disarm defect)', () => {
    // THE DEFECT. The region regex used to be tested against the RAW line, so any sentence containing the
    // words "provenance-lint: off" opened a region whose "reason" was the rest of the sentence — and nothing
    // ever closed it. A page merely DOCUMENTING the escape therefore switched the gate off for its own
    // remainder. Every one of these shapes must be inert.
    const quoted = ['A bare `provenance-lint: off` suppresses nothing and is reported in its own right.',
      '`stillFiresAfterInlineSpan` must fire'].join('\n');
    expect(tokens(quoted)).toEqual(['stillFiresAfterInlineSpan']);

    const doubled = ['Write `` `provenance-lint: off — some reason` `` to open one.',
      '`stillFiresAfterDoubledSpan` must fire'].join('\n');
    expect(tokens(doubled)).toEqual(['stillFiresAfterDoubledSpan']);

    // Even the whole HTML-comment form, quoted as code, is a marker being DISCUSSED, not issued.
    const quotedComment = ['Open one with `<!-- provenance-lint: off — why -->` and close it after the block.',
      '`stillFiresAfterQuotedComment` must fire'].join('\n');
    expect(tokens(quotedComment)).toEqual(['stillFiresAfterQuotedComment']);

    // Bare prose with no comment opener at all — the exact shape that disarmed conventions.md.
    const barePr0se = ['The provenance-lint: off marker needs a reason to do anything at all.',
      '`stillFiresAfterBareProse` must fire'].join('\n');
    expect(tokens(barePr0se)).toEqual(['stillFiresAfterBareProse']);

    // …and a fenced example, which was already inert, stays inert AND stays non-suppressing.
    const fenced = ['```', '<!-- provenance-lint: off — an example in a fence -->', '```',
      '`stillFiresAfterFence` must fire'].join('\n');
    expect(tokens(fenced)).toEqual(['stillFiresAfterFence']);

    // The REAL marker — an actual HTML comment, unquoted — still works. Not a hollow tightening.
    const real = ['<!-- provenance-lint: off — historical names -->', '`suppressed` here',
      '<!-- provenance-lint: on -->', '`firesAgain` here'].join('\n');
    expect(tokens(real)).toEqual(['firesAgain']);
  });

  it('THE FIXTURE: docs/agent/conventions.md documents the escape without ARMING it (#3026 self-disarm)', () => {
    // This reads the REAL file on purpose. The defect was found by seeding a fake identifier before and after
    // the "Provenance" section of this very page: the one before fired, the one after was silent, because the
    // sentence "A bare `provenance-lint: off` suppresses nothing" opened a region that ran to EOF. Reworded
    // prose can reintroduce that at any time, so the assertion is against the shipped page, not a paraphrase.
    const real = readFileSync(join(REPO_ROOT, 'docs/agent/conventions.md'), 'utf8');
    expect(real).toContain('provenance-lint: off');           // the page really does discuss the marker
    const lines = real.split('\n');
    const sectionAt = lines.findIndex((l) => /^##\s+Provenance:/.test(l));
    expect(sectionAt).toBeGreaterThan(-1);

    // Seed the same probe the reviewer used: one before the section, one at the very END of the file.
    const seeded = [...lines];
    seeded.push('Trailing prose citing `zzSeededAfterProvenanceSection` here.');
    seeded.splice(sectionAt, 0, 'Leading prose citing `zzSeededBeforeProvenanceSection` here.', '');
    const probe = (t) => !t.startsWith('zzSeeded');
    const found = findUnresolvedIdentifiers(seeded.join('\n'), { resolves: probe, addedLines: null });
    const seen = found.map((f) => f.token);
    expect(seen).toContain('zzSeededBeforeProvenanceSection');
    expect(seen).toContain('zzSeededAfterProvenanceSection');  // ← was silent before the fix

    // And the page must open no region at all: nothing on it is left suppressing at EOF.
    expect(found.filter((f) => f.kind === 'escape-unclosed')).toEqual([]);
    expect(found.filter((f) => f.kind === 'escape-no-reason')).toEqual([]);
  });

  it('an `off` region left OPEN at end of file is reported (it suppresses everything after it)', () => {
    // Design-accepted that it suppresses to EOF; NOT accepted that it does so silently.
    const body = ['<!-- provenance-lint: off — historical names, never closed -->', '`quietlySuppressed` here'].join('\n');
    const found = scan(body);
    expect(found.map((f) => f.kind)).toEqual(['escape-unclosed']);
    expect(found[0].line).toBe(1);
    // Closing it clears the report.
    expect(scan([body, '<!-- provenance-lint: on -->'].join('\n'))).toEqual([]);
    // Diff-scoped: an unclosed region whose OPENING line the change did not add is not re-litigated.
    expect(findUnresolvedIdentifiers(body, { resolves, addedLines: new Set([2]) })).toEqual([]);
  });

  it('only ADDED lines are reported, but escape state is read from the WHOLE file', () => {
    // The heading and the fence are untouched context; the added line must still inherit them.
    const body = ['## Done when', '- `underUntouchedHeading`', '## Elsewhere', '- `reportedHere`',
      '- `notAddedSoSilent`'].join('\n');
    const found = findUnresolvedIdentifiers(body, { resolves, addedLines: new Set([2, 4]) });
    expect(found.map((f) => f.token)).toEqual(['reportedHere']);
  });
});

describe('codeSpans — both markdown inline-code forms', () => {
  it('reads the DOUBLE-backtick form, which docs/agent/conventions.md uses throughout', () => {
    // Found by observation, not by design: the first wiring reported CLEAN on a docs page deliberately
    // seeded with two bad names, because every example on it was written `` `x` `` (the wrapper you need
    // when the displayed code contains a backtick). A gate that reads a file and sees nothing is worse
    // than no gate, so both forms are extracted.
    const line = 'bare (`` `countSourceLines` ``) or as a call (`` `enforceFlipReady({ ciStatus })` ``)';
    expect(codeSpans(line).map((s) => s.inner)).toEqual(['countSourceLines', 'enforceFlipReady({ ciStatus })']);
    expect(tokens(line)).toEqual(['enforceFlipReady']);
  });

  it('still reads the plain single-backtick form, and does not double-count a doubled span', () => {
    expect(codeSpans('a `single` span').map((s) => s.inner)).toEqual(['single']);
    expect(codeSpans('`` `wrapped` ``').map((s) => s.inner)).toEqual(['wrapped']);
  });

  it('an escape marker after a DOUBLED span still binds', () => {
    expect(scan('`` `mountLaneBoard` `` (proposed) is unbuilt')).toHaveLength(0);
  });
});

describe('findUnresolvedIdentifiers — comment syntax, for the `leash: spec` surface', () => {
  it('reads JSDoc as prose and IGNORES the code around it', () => {
    // The round-1 miss of PR #1112 lived in exactly this shape: a false symbol asserted in a conformance
    // suite's JSDoc header, where no compiler and no gate could reach it.
    const body = ['/**', ' * `collectOpenItemIds` in we:scripts/lib/validate-rules-anchors.cjs', ' */',
      'const someLocalThing = 1;', 'export function anotherCodeSymbol() {}'].join('\n');
    expect(tokens(body, { syntax: 'comment' })).toEqual(['collectOpenItemIds']);
  });

  it('reads a `//` line comment as prose too', () => {
    expect(tokens('// the helper `lineCommentFake` does the walk', { syntax: 'comment' })).toEqual(['lineCommentFake']);
  });

  it('a comment resolves against its OWN file\'s code — the local index that stops the over-correction', () => {
    // Test files are excluded from the tree-wide index (their fixtures name things that must not exist).
    // Excluding them wholesale over-corrected: a conformance suite's JSDoc legitimately names helpers
    // defined right below it, and 6 such names went red on PR #1112's diff. The wiring therefore resolves
    // a comment against the tree PLUS this file's own CODE — reproduced here with the same composition.
    const body = ['/**', ' * `definedRightBelow` walks it; `neverDefinedAnywhere` does not exist.', ' */',
      'export function definedRightBelow() { return 1; }'].join('\n');
    const local = buildIdentifierIndex([body]);
    const composed = (t) => REAL.has(t) || local.has(t);
    const found = findUnresolvedIdentifiers(body, { resolves: composed, addedLines: null, syntax: 'comment' });
    expect(found.map((f) => f.token)).toEqual(['neverDefinedAnywhere']);
  });
});

describe('regionMarkerPayload — where a `provenance-lint:` directive may legitimately live', () => {
  it('markdown: only inside an HTML comment, and never inside a code span', () => {
    expect(regionMarkerPayload('<!-- provenance-lint: off — why -->')).toBe(' provenance-lint: off — why ');
    expect(regionMarkerPayload('prose saying provenance-lint: off out loud')).toBeNull();
    expect(regionMarkerPayload('a `provenance-lint: off` quoted marker')).toBeNull();
    expect(regionMarkerPayload('a `` `<!-- provenance-lint: off — x -->` `` quoted comment')).toBeNull();
  });

  it('comment syntax: the whole comment line qualifies, punctuation stripped', () => {
    expect(regionMarkerPayload(' * provenance-lint: off — historical names', 'comment').trim())
      .toBe('provenance-lint: off — historical names');
    expect(regionMarkerPayload('// provenance-lint: on', 'comment').trim()).toBe('provenance-lint: on');
    expect(regionMarkerPayload('/* provenance-lint: off — why */', 'comment').trim())
      .toBe('provenance-lint: off — why');
    expect(regionMarkerPayload('// a `provenance-lint: off` quoted marker', 'comment'))
      .not.toMatch(/provenance-lint/);
  });

  it('the region escape works end-to-end in a `leash: spec` source comment', () => {
    const body = ['/**', ' * provenance-lint: off — historical misses, none of these ever existed',
      ' * `collectOpenItemIds` and `validateTodoMarkerBlock`', ' * provenance-lint: on',
      ' * but `stillFiresHere` does', ' */'].join('\n');
    expect(tokens(body, { syntax: 'comment' })).toEqual(['stillFiresHere']);
  });

  it('a marker on a CODE line in comment mode is inert — a directive must live in a comment', () => {
    const body = ['const s = "provenance-lint: off — not a directive, just a string";',
      '// cites `fakeAfterStringLiteral`'].join('\n');
    expect(tokens(body, { syntax: 'comment' })).toEqual(['fakeAfterStringLiteral']);
  });
});

describe('isIndexableSourcePath — the resolution index\'s vocabulary, and what is kept OUT of it', () => {
  it('indexes ordinary source, in any indexable extension', () => {
    for (const p of ['scripts/lib/citation-check.mjs', 'src/index.ts', 'src/x.njk', 'scripts/tool.cjs',
      'src/css/style.css', 'config/thing.yml']) {
      expect(isIndexableSourcePath(p)).toBe(true);
    }
  });

  it('EXCLUDES test files — the mutation-fragile line the gate depends on', () => {
    // Delete this exclusion and this very file's string literals ('enforceFlipReady', 'collectOpenItemIds',
    // 'validateTodoMarkerBlock') enter the index, so all three historical regressions start "resolving" and
    // the gate reports clean on the defects it exists to catch. It was previously covered only by an
    // end-to-end probe, i.e. not covered.
    for (const p of ['scripts/__tests__/citation-check.test.mjs', 'src/lib/__mocks__/thing.mjs',
      'src/lib/__fixtures__/data.json', 'src/thing.test.ts', 'src/thing.spec.js']) {
      expect(isIndexableSourcePath(p)).toBe(false);
    }
  });

  it('EXCLUDES prose dirs — else a false citation resolves against the sentence that invented it', () => {
    for (const p of ['backlog/3026-x.md', 'docs/agent/conventions.md', 'reports/r.md', 'plans/p.md',
      'research/t.md']) {
      expect(isIndexableSourcePath(p)).toBe(false);
    }
  });

  it('EXCLUDES non-source and degenerate paths', () => {
    for (const p of ['src/assets/icons/a.svg', 'README', 'bin/tool', '', null, 42]) {
      expect(isIndexableSourcePath(p)).toBe(false);
    }
  });
});

describe('buildIdentifierIndex / stripSourceComments — what "resolves" means', () => {
  it('indexes identifier-shaped tokens from code', () => {
    const idx = buildIdentifierIndex(['export function realHelper() { const MY_CONST = 1; return MY_CONST; }']);
    expect(idx.has('realHelper')).toBe(true);
    expect(idx.has('MY_CONST')).toBe(true);
    expect(idx.has('export')).toBe(false); // not identifier-SHAPED (no interior capital)
  });

  it('EXCLUDES comment text — the miss that a naive index caused on replay', () => {
    // Replaying PR #1112 round 1 with comments indexed, `collectOpenItemIds` did NOT fire: the token
    // resolved against the very JSDoc line that invented it. A citation asserts something about the CODE.
    const src = ['/** the helper `inventedInJsdoc` walks the tree */', 'export function realCode() {}'].join('\n');
    const idx = buildIdentifierIndex([src]);
    expect(idx.has('realCode')).toBe(true);
    expect(idx.has('inventedInJsdoc')).toBe(false);
  });

  it('does NOT strip a trailing `//` — it would eat every https:// URL and delete real code tokens', () => {
    const kept = stripSourceComments('const u = "https://example.com/someRealPath";');
    expect(kept).toContain('someRealPath');
    expect(buildIdentifierIndex(['const homeUrl = "https://x.dev/api";']).has('homeUrl')).toBe(true);
  });

  it('handles a NUL-sentinel file without choking — plain grep silently reports nothing on these', () => {
    // guard-bash.mjs, renumber-collisions.mjs and component-render-build-hook.cjs carry deliberate NUL
    // bytes. readFileSync+regex treat \0 as an ordinary character, so they must index normally.
    // Written as an ESCAPE, never a literal NUL byte in this file — a committed raw NUL is the very
    // footgun under test (plain `grep` reports nothing on such a file; `grep -a` is needed to see it).
    const NUL = '\0';
    const nulSrc = `const before = 1;${NUL}${NUL} export function afterTheNul() {}`;
    const idx = buildIdentifierIndex([nulSrc]);
    expect(idx.has('afterTheNul')).toBe(true);
    // and the prose scanner must not throw or mis-scan on one either
    const nulProse = `prose with ${NUL} a NUL and \`someFakeName\` after`;
    expect(() => scan(nulProse)).not.toThrow();
    expect(tokens(nulProse)).toEqual(['someFakeName']);
  });
});

describe('findUnresolvedIdentifiers — degenerate input never throws', () => {
  it('tolerates empty / non-string / missing resolver', () => {
    expect(findUnresolvedIdentifiers('', { resolves })).toEqual([]);
    expect(findUnresolvedIdentifiers(null, { resolves })).toEqual([]);
    expect(findUnresolvedIdentifiers('`someFake`', {})).toEqual([]);
  });

  it('tolerates an unterminated fence and an unterminated escape region', () => {
    expect(() => scan('```\nunclosed fence with `fakeOne`')).not.toThrow();
    expect(scan('```\nunclosed fence with `fakeOne`')).toHaveLength(0);
    // The unclosed region still suppresses the token (design-accepted) — but now says so out loud.
    const unclosed = scan('<!-- provenance-lint: off — never closed -->\n`fakeTwo`');
    expect(unclosed.map((f) => f.kind)).toEqual(['escape-unclosed']);
    expect(unclosed.filter((f) => f.kind === 'unresolved')).toEqual([]);
  });
});
