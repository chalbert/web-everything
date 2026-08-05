/**
 * @file doc-prose.test.mjs — proof of the whitespace-normalizing markdown-prose matcher (#xdompzx round-4,
 *   finding 3). This helper decides whether a SAFETY assertion passes (the drain skill's bar-un-blocked prevention
 *   control), so it gets its own proof rather than being trusted because it looks obvious. The two properties that
 *   matter are opposite in sign: a phrase must survive REFLOW and RE-INDENT, and a phrase that genuinely is not
 *   there must still be reported missing.
 */
import { describe, it, expect } from 'vitest';
import { normalizeProse, proseContains, blockquoteBlockAt, functionNamesInCodeSpans } from './doc-prose.mjs';

describe('normalizeProse', () => {
  it('strips blockquote markers at any indent and collapses all whitespace', () => {
    expect(normalizeProse('   > the guarantee is\n   > narrow\n')).toBe('the guarantee is narrow');
    expect(normalizeProse('>> nested\n>> quote')).toBe('nested quote');
  });

  it('leaves emphasis, backticks and punctuation ALONE — a test may be pinning them on purpose', () => {
    expect(normalizeProse('  > **no** land, `blocksAcceptance(f)` — silently.'))
      .toBe('**no** land, `blocksAcceptance(f)` — silently.');
  });

  it('never throws on null/undefined/non-string', () => {
    for (const bad of [null, undefined, 42, {}]) expect(() => normalizeProse(bad)).not.toThrow();
    expect(normalizeProse(null)).toBe('');
  });
});

describe('proseContains — reflow-proof, but not blind', () => {
  // The exact defect: the old assertion pinned 'no\n       > land that the bar un-blocked happens silently'.
  const md = [
    '       > exact: **no',
    '       > land that the bar un-blocked happens silently.** Say it that way anywhere.',
  ].join('\n');

  it('finds a phrase that WRAPS mid-sentence across a blockquote line break', () => {
    expect(proseContains(md, 'no land that the bar un-blocked happens silently')).toBe(true);
  });

  it('finds the SAME phrase after a reflow and a re-indent — the failure mode this exists for', () => {
    const reflowed = '  > exact: **no land that the bar un-blocked\n  > happens silently.** Say it that way anywhere.';
    expect(proseContains(reflowed, 'no land that the bar un-blocked happens silently')).toBe(true);
  });

  it('still reports a genuinely ABSENT phrase as absent — normalization is not a wildcard', () => {
    expect(proseContains(md, 'every finding is posted on every land')).toBe(false);
    expect(proseContains(md, 'the bar un-blocked happens loudly')).toBe(false);
  });

  it('a word-order change is NOT matched — this is not a bag of words', () => {
    expect(proseContains(md, 'silently happens un-blocked bar the that land no')).toBe(false);
  });
});

describe('blockquoteBlockAt — scoping a negative assertion to the block that makes the claim', () => {
  const doc = [
    '  1. a step that says: first run THE CHECK, then apply the labels.',
    '',
    '     > **THE CHECK.** always visible is a phrase we must not use here.',
    '     > second line of the same block.',
    '',
    '  2. an unrelated later step.',
    '',
    '     > a different block that may legitimately say always visible about something else.',
  ].join('\n');

  it('starts at the BLOCKQUOTE line, not at an earlier cross-reference to it from prose', () => {
    const block = blockquoteBlockAt(doc, 'THE CHECK');
    expect(block.split('\n')).toHaveLength(2); // not the 1-line slice a prose match would give
    expect(block).toContain('second line of the same block');
  });

  it('stops at the end of the contiguous block, so a later block cannot fail a scoped assertion', () => {
    const block = blockquoteBlockAt(doc, 'THE CHECK');
    expect(block).not.toContain('a different block');
    expect(doc).toMatch(/always visible/i); // the whole doc would fail a file-scope assertion …
    expect(blockquoteBlockAt(doc, 'a different block')).not.toMatch(/THE CHECK/); // … but the scopes are disjoint
  });

  it('returns "" for an absent marker, so a scoped not.toMatch cannot vacuously pass on a typo', () => {
    expect(blockquoteBlockAt(doc, 'NO SUCH MARKER')).toBe('');
  });
});

describe('functionNamesInCodeSpans', () => {
  it('picks camelCase calls out of code spans and ignores prose', () => {
    const md = 'test each for `hasUncapturedPrevention(f) === true` and post `renderPanelComment({ x })` (see above).';
    expect(functionNamesInCodeSpans(md)).toEqual(['hasUncapturedPrevention', 'renderPanelComment']);
  });

  it('ignores an all-lowercase word followed by a paren — English prose is not an API promise', () => {
    expect(functionNamesInCodeSpans('run `node scripts/x.mjs` and `filter(x)` the list')).toEqual([]);
  });

  it('ignores calls OUTSIDE a code span — an unformatted mention is not an instruction to call', () => {
    expect(functionNamesInCodeSpans('we used to call deriveVerdict(f) here')).toEqual([]);
  });

  it('de-duplicates and sorts', () => {
    expect(functionNamesInCodeSpans('`buildPanelFindings(a)` `buildPanelFindings(b)` `aardvarkCall(c)`'))
      .toEqual(['aardvarkCall', 'buildPanelFindings']);
  });
});
