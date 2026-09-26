import { describe, it, expect } from 'vitest';
import { computeAlreadyLandedVerdict, attributeCarrierPr } from '../already-landed-content.mjs';

describe('computeAlreadyLandedVerdict', () => {
  it('is landed when every file matches a commit on main', () => {
    const v = computeAlreadyLandedVerdict([
      { file: 'a.mjs', matchedCommit: 'aaa' },
      { file: 'b.mjs', matchedCommit: 'bbb' },
    ]);
    expect(v).toEqual({ landed: true, unmatchedFiles: [] });
  });

  it('is NOT landed when any file has no match — never guesses a partial containment', () => {
    const v = computeAlreadyLandedVerdict([
      { file: 'a.mjs', matchedCommit: 'aaa' },
      { file: 'b.mjs', matchedCommit: null },
    ]);
    expect(v.landed).toBe(false);
    expect(v.unmatchedFiles).toEqual(['b.mjs']);
  });

  it('is NOT landed on an empty file list — absence of evidence is not evidence of containment', () => {
    expect(computeAlreadyLandedVerdict([]).landed).toBe(false);
    expect(computeAlreadyLandedVerdict(null).landed).toBe(false);
  });

  it('tolerates a null/undefined entry in the list without throwing', () => {
    const v = computeAlreadyLandedVerdict([null, { file: 'a.mjs', matchedCommit: 'aaa' }]);
    expect(v.landed).toBe(false);
  });
});

describe('attributeCarrierPr', () => {
  const files = [
    { file: 'a.mjs', matchedCommit: 'c1' },
    { file: 'b.mjs', matchedCommit: 'c2' },
  ];

  it('attributes the single common PR across every matched commit', () => {
    const pr = attributeCarrierPr(files, { c1: [2759], c2: [2759] });
    expect(pr).toBe(2759);
  });

  it('dedupes a repeated matchedCommit into one lookup and still attributes', () => {
    const repeated = [
      { file: 'a.mjs', matchedCommit: 'c1' },
      { file: 'b.mjs', matchedCommit: 'c1' },
    ];
    expect(attributeCarrierPr(repeated, { c1: [2759] })).toBe(2759);
  });

  it('declines to attribute when the two commits share no common PR', () => {
    expect(attributeCarrierPr(files, { c1: [2759], c2: [2800] })).toBeNull();
  });

  it('declines to attribute when a matched commit has zero associated PRs', () => {
    expect(attributeCarrierPr(files, { c1: [2759], c2: [] })).toBeNull();
  });

  it('declines to attribute when a matched commit maps to MULTIPLE PRs and the intersection is not exactly one', () => {
    expect(attributeCarrierPr(files, { c1: [2759, 2800], c2: [2800] })).toBe(2800);
    expect(attributeCarrierPr(files, { c1: [2759, 2800], c2: [2800, 2900] })).toBe(2800);
    expect(attributeCarrierPr(files, { c1: [2759, 2800], c2: [2900, 3000] })).toBeNull();
  });

  it('returns null with no matched commits at all', () => {
    expect(attributeCarrierPr([{ file: 'a.mjs', matchedCommit: null }], {})).toBeNull();
    expect(attributeCarrierPr([], {})).toBeNull();
  });
});
