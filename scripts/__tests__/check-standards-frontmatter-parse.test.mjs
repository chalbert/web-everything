import { describe, it, expect } from 'vitest';
import { describeUnparseableFrontmatter, validateBacklogItem } from '../check-standards-rules.mjs';

describe('describeUnparseableFrontmatter (#4451)', () => {
  it('reports a non-colon parse failure (unclosed quote) the colon scan misses', () => {
    const r = describeUnparseableFrontmatter('---\nkind: "story\n---\n');
    expect(r.parseReason).toBeTruthy();
    expect(r.colonHits).toEqual([]);
  });
  it('reports both the colon hit and the parse reason for an unquoted colon', () => {
    const r = describeUnparseableFrontmatter('---\ngraduatedTo: x: y\n---\n');
    expect(r.colonHits.length).toBeGreaterThan(0);
    expect(r.parseReason).toBeTruthy();
  });
  it('is clean for valid frontmatter', () => {
    expect(describeUnparseableFrontmatter('---\nkind: story\n---\nbody\n')).toEqual({ colonHits: [], parseReason: null });
  });
  it('is clean when there is no frontmatter fence', () => {
    expect(describeUnparseableFrontmatter('# just markdown\n')).toEqual({ colonHits: [], parseReason: null });
  });
});

describe('validateBacklogItem required frontmatter fields (pin)', () => {
  const base = { id: '9999-x', title: 'T', kind: 'story', status: 'open', summary: 's', dateOpened: '2026-01-01' };
  const ctx = {
    projectById: new Map(), graduatedKinds: new Set(), knownNums: new Set(), reportExists: () => true,
    kindByNum: new Map(), parentByNum: new Map(),
  };
  for (const f of ['kind', 'status', 'dateOpened']) {
    it(`errors on missing ${f}`, () => {
      const { [f]: _omit, ...item } = base;
      const { errors } = validateBacklogItem(item, ctx);
      expect(errors.map((e) => e.message)).toContainEqual(expect.stringContaining(`missing required field "${f}"`));
    });
  }
});
