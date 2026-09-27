import { describe, it, expect } from 'vitest';
import {
  computeAlreadyLandedVerdict, attributeCarrierPr, parseRawDiffZ, addedContentIntact,
} from '../already-landed-content.mjs';

describe('addedContentIntact — an added file is carried only while the PR\'s whole text sits in main\'s tip unbroken (PR #2769 review, round 2)', () => {
  const PR = 'l1\nl2\n';

  it('intact when main\'s tip is the PR text, or the PR text with lines added before / after it', () => {
    expect(addedContentIntact(PR, PR)).toBe(true);
    expect(addedContentIntact('l1\nl2\nrefined\n', PR)).toBe(true);
    expect(addedContentIntact('header\nl1\nl2\n', PR)).toBe(true);
  });

  it('NOT intact when main rewrote, removed, or inserted between the PR\'s lines', () => {
    expect(addedContentIntact('l1\nL2\n', PR)).toBe(false);
    expect(addedContentIntact('l1\n', PR)).toBe(false);
    expect(addedContentIntact('l1\nmid\nl2\n', PR)).toBe(false);
  });

  it('matches whole lines only — never a PR text that starts mid-line in the tip', () => {
    expect(addedContentIntact('xl1\nl2\n', PR)).toBe(false);
  });

  it('refuses the ambiguous and the unreadable: no trailing newline, empty, binary, non-string', () => {
    expect(addedContentIntact('l1\nl2more\n', 'l1\nl2')).toBe(false);
    expect(addedContentIntact('anything\n', '')).toBe(false);
    expect(addedContentIntact('a\0b\nl1\nl2\n', PR)).toBe(false);
    expect(addedContentIntact(null, PR)).toBe(false);
  });
});

describe('parseRawDiffZ', () => {
  const Z = (...parts) => parts.join('\0') + '\0';
  const B1 = '1'.repeat(40);
  const B2 = '2'.repeat(40);
  const NULL = '0'.repeat(40);

  it('parses modify / add / delete records with status, path, destination mode and blob', () => {
    const out = parseRawDiffZ(Z(
      `:100644 100644 ${B1} ${B2} M`, 'a.mjs',
      `:000000 100644 ${NULL} ${B1} A`, 'dir/new file.mjs',
      `:100644 000000 ${B1} ${NULL} D`, 'gone.mjs',
    ));
    expect(out).toEqual([
      { status: 'M', path: 'a.mjs', dstMode: '100644', dstBlob: B2 },
      { status: 'A', path: 'dir/new file.mjs', dstMode: '100644', dstBlob: B1 },
      { status: 'D', path: 'gone.mjs', dstMode: '000000', dstBlob: NULL },
    ]);
  });

  it('keeps a mode-only change visible (same blob, new mode)', () => {
    expect(parseRawDiffZ(Z(`:100644 100755 ${B1} ${B1} M`, 's.sh'))).toEqual([
      { status: 'M', path: 's.sh', dstMode: '100755', dstBlob: B1 },
    ]);
  });

  it('returns [] for empty or malformed input — never a partial guess', () => {
    expect(parseRawDiffZ('')).toEqual([]);
    expect(parseRawDiffZ(null)).toEqual([]);
    expect(parseRawDiffZ(Z('garbage', 'a.mjs'))).toEqual([]);
    expect(parseRawDiffZ(Z(`:100644 100644 ${B1} ${B2} M`, 'a.mjs', 'not-a-meta-line', 'b.mjs'))).toEqual([]);
  });
});

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
