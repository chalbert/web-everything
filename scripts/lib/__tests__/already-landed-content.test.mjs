import { describe, it, expect } from 'vitest';
import {
  computeAlreadyLandedVerdict, attributeCarrierPr, parseRawDiffZ, parseUnifiedHunks, tipPreservesChange,
} from '../already-landed-content.mjs';

describe('parseUnifiedHunks', () => {
  it('reads every -U0 hunk header, defaulting an omitted count to 1', () => {
    expect(parseUnifiedHunks('diff --git a/x b/x\n@@ -3 +3,2 @@ ctx\n-a\n+b\n+c\n@@ -9,2 +10,0 @@\n-d\n-e\n')).toEqual([
      { oldStart: 3, oldCount: 1, newStart: 3, newCount: 2 },
      { oldStart: 9, oldCount: 2, newStart: 10, newCount: 0 },
    ]);
  });
  it('is [] for an empty diff but null for content with no hunk (binary) — "no hunks" never reads as "no change"', () => {
    expect(parseUnifiedHunks('')).toEqual([]);
    expect(parseUnifiedHunks('Binary files a/x and b/x differ\n')).toBeNull();
  });
});

describe('tipPreservesChange — main\'s later edits must leave every line the PR wrote alone (PR #2769 review, round 2)', () => {
  const h = (oldStart, oldCount, newStart, newCount) => ({ oldStart, oldCount, newStart, newCount });
  const PR_LINE_2 = [h(2, 1, 2, 1)]; // the PR rewrote line 2 (line 2 of X)

  it('preserved when main only edited or inserted elsewhere', () => {
    expect(tipPreservesChange(PR_LINE_2, [h(6, 1, 6, 1)])).toBe(true);
    expect(tipPreservesChange(PR_LINE_2, [h(2, 0, 3, 4)])).toBe(true); // inserted right after the PR's line
    expect(tipPreservesChange(PR_LINE_2, [h(1, 0, 2, 1)])).toBe(true); // inserted right before it
    expect(tipPreservesChange(PR_LINE_2, [h(1, 1, 1, 1), h(3, 1, 3, 1)])).toBe(true); // neighbours edited
  });

  it('NOT preserved when main changed or removed a line the PR wrote — the transient carry / revert shapes', () => {
    expect(tipPreservesChange(PR_LINE_2, [h(2, 1, 2, 1)])).toBe(false);
    expect(tipPreservesChange(PR_LINE_2, [h(2, 1, 1, 0)])).toBe(false);
    expect(tipPreservesChange(PR_LINE_2, [h(2, 1, 2, 1), h(6, 1, 6, 1)])).toBe(false); // revert + unrelated edit
    expect(tipPreservesChange(PR_LINE_2, [h(1, 3, 1, 3)])).toBe(false); // a wider rewrite spanning it
  });

  it('NOT preserved when main inserted between two of the PR\'s own lines', () => {
    expect(tipPreservesChange([h(0, 0, 1, 3)], [h(1, 0, 2, 1)])).toBe(false);
    expect(tipPreservesChange([h(0, 0, 1, 3)], [h(3, 0, 4, 1)])).toBe(true); // appended after an added file
  });

  it('NOT preserved when main re-inserted at the exact spot the PR deleted from', () => {
    const PR_DELETED_AFTER_2 = [h(3, 1, 2, 0)];
    expect(tipPreservesChange(PR_DELETED_AFTER_2, [h(2, 0, 3, 1)])).toBe(false);
    expect(tipPreservesChange(PR_DELETED_AFTER_2, [h(2, 2, 2, 2)])).toBe(false); // rewrote across the deletion point
    expect(tipPreservesChange(PR_DELETED_AFTER_2, [h(5, 1, 5, 1)])).toBe(true);
  });

  it('an empty added file clashes with any content main put in it', () => {
    expect(tipPreservesChange([h(0, 0, 0, 0)], [h(0, 0, 1, 2)])).toBe(false);
  });

  it('never preserved on an unreadable hunk list', () => {
    expect(tipPreservesChange(null, [])).toBe(false);
    expect(tipPreservesChange([], null)).toBe(false);
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
