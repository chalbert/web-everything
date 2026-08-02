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
import {
  buildAnchorOwners,
  findAnchorRulingMismatches,
  findDanglingLoci,
  findOutOfScopeHashSlugs,
  countSourceLines,
  CROSS_REPO_LOCI,
} from '../lib/citation-check.mjs';

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
