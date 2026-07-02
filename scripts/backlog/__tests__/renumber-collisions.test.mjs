/**
 * @file scripts/backlog/__tests__/renumber-collisions.test.mjs
 * Tests the merge-time new-item id-collision renumber core (#2071) against in-memory fixtures: it
 * detects a two-lane NNN collision, yields the LATER-landing file to the next free id (a refile, not a
 * git mv), rewrites EVERY inbound reference shape, honours the base-id boundary, and is idempotent.
 */
import { describe, it, expect } from 'vitest';
import {
  parseBacklogFilename, findCollisions, pickYielder, allocateFreeNum, rewriteRefs, planRenumber,
} from '../renumber-collisions.mjs';

const mk = (num, slug, body = '', ordinal = 0) => ({
  name: `${num}-${slug}.md`,
  text: `---\nkind: story\nsize: 3\nstatus: active\ndateOpened: "2026-07-01"\ntags: []\n---\n\n# ${slug}\n\n${body}\n`,
  ordinal,
});

describe('parseBacklogFilename', () => {
  it('splits NNN-slug.md; rejects non-items', () => {
    expect(parseBacklogFilename('2068-foo-bar.md')).toEqual({ num: '2068', slug: 'foo-bar' });
    expect(parseBacklogFilename('README.md')).toBeNull();
    expect(parseBacklogFilename('2068.md')).toBeNull();
  });
});

describe('findCollisions', () => {
  it('returns only ids with >1 file, sorted by id', () => {
    const files = [mk('2067', 'a'), mk('2068', 'x'), mk('2068', 'y'), mk('2069', 'b')];
    const c = findCollisions(files);
    expect(c).toHaveLength(1);
    expect(c[0].num).toBe('2068');
    expect(c[0].files.map((f) => f.slug).sort()).toEqual(['x', 'y']);
  });
  it('no collision → empty', () => {
    expect(findCollisions([mk('1', 'a'), mk('2', 'b')])).toEqual([]);
  });
});

describe('pickYielder', () => {
  it('the higher-ordinal (later-landing) file yields; keepers hold the id', () => {
    const group = [
      { name: '2068-early.md', slug: 'early', ordinal: 100 },
      { name: '2068-late.md', slug: 'late', ordinal: 200 },
    ];
    const { yielder, keepers } = pickYielder(group);
    expect(yielder.slug).toBe('late');
    expect(keepers.map((k) => k.slug)).toEqual(['early']);
  });
  it('equal ordinal → deterministic slug tie-break (later slug yields)', () => {
    const { yielder } = pickYielder([
      { name: '2068-aaa.md', slug: 'aaa', ordinal: 0 },
      { name: '2068-zzz.md', slug: 'zzz', ordinal: 0 },
    ]);
    expect(yielder.slug).toBe('zzz');
  });
});

describe('allocateFreeNum', () => {
  it('picks max+1, padded, skipping used/allocated/base', () => {
    const used = new Set(['2067', '2068', '2069']);
    expect(allocateFreeNum(used, new Set(), new Set())).toBe('2070');
    expect(allocateFreeNum(used, new Set(['2070']), new Set())).toBe('2071');
    expect(allocateFreeNum(used, new Set(), new Set(['2070', '2071']))).toBe('2072');
  });
  it('keeps 3-digit padding for small ids', () => {
    expect(allocateFreeNum(new Set(['007', '008']), new Set(), new Set())).toBe('009');
  });
});

describe('rewriteRefs', () => {
  it('rewrites #NNN short-refs, id-bounded (no substring corruption)', () => {
    expect(rewriteRefs('see #2068 and #20680', '2068', '2072')).toBe('see #2072 and #20680');
  });
  it('rewrites the bare redirect URL and the yielder-slug canonical URL, preserving the slug', () => {
    expect(rewriteRefs('/backlog/2068/ and /backlog/2068-some-slug/', '2068', '2072', 'some-slug'))
      .toBe('/backlog/2072/ and /backlog/2072-some-slug/');
    // a longer id starting with the old id is untouched
    expect(rewriteRefs('/backlog/20680-x/', '2068', '2072', 'x')).toBe('/backlog/20680-x/');
  });
  it('SLUG-DISAMBIGUATION: a keeper\'s slug-bearing URL is NOT rewritten (only the yielder\'s)', () => {
    // yielder slug = "gate"; a URL for the KEEPER "reconcile" (same num, stays) must be left alone,
    // while the bare redirect URL (ambiguous, no slug) and the yielder\'s own URL move.
    const text = '/backlog/2068/ /backlog/2068-gate/ /backlog/2068-reconcile/';
    expect(rewriteRefs(text, '2068', '2072', 'gate'))
      .toBe('/backlog/2072/ /backlog/2072-gate/ /backlog/2068-reconcile/');
  });
  it('rewrites quoted + bare frontmatter edges', () => {
    expect(rewriteRefs('parent: "2068"', '2068', '2072')).toBe('parent: "2072"');
    expect(rewriteRefs('blockedBy: [2067, 2068, 2069]', '2068', '2072')).toBe('blockedBy: [2067, 2072, 2069]');
    expect(rewriteRefs('parent: 2068', '2068', '2072')).toBe('parent: 2072');
  });
  it('leaves unrelated text alone', () => {
    expect(rewriteRefs('the year 2068 in prose', '2068', '2072')).toBe('the year 2068 in prose');
  });
});

describe('planRenumber', () => {
  it('yields the later-landing file, allocates the next free id, and rewrites inbound refs corpus-wide', () => {
    const files = [
      mk('2067', 'base'),
      mk('2068', 'reconcile-fui-runtime', 'from the #2030 SSR work', 100),
      mk('2068', 'gate-item', 'from the #2061 resolve', 200), // later → yields
      // an unrelated item pointing at the yielder via every ref shape, PLUS the keeper's slug-URL:
      {
        name: '1500-ref.md', ordinal: 50,
        text: 'links #2068 and /backlog/2068/ and /backlog/2068-gate-item/ and keeper /backlog/2068-reconcile-fui-runtime/\nparent: "2068"\n',
      },
    ];
    const plan = planRenumber(files, { baseNums: ['2067'] });
    expect(plan.collisions).toHaveLength(1);
    const mv = plan.collisions[0];
    expect(mv.oldNum).toBe('2068');
    expect(mv.newNum).toBe('2069'); // max used (2068) + 1, 2067 is base
    expect(mv.oldName).toBe('2068-gate-item.md');
    expect(mv.newName).toBe('2069-gate-item.md');
    // the later file is re-filed; the earlier keeps 2068
    expect(plan.deletes).toEqual(['2068-gate-item.md']);
    expect(plan.writes.map((w) => w.name)).toContain('2069-gate-item.md');
    // the referencing file was rewritten to point at 2069
    const ref = plan.writes.find((w) => w.name === '1500-ref.md');
    expect(ref.text).toContain('#2069');
    expect(ref.text).toContain('/backlog/2069/');
    expect(ref.text).toContain('/backlog/2069-gate-item/');
    expect(ref.text).toContain('parent: "2069"');
    // the KEEPER's slug-bearing URL is left alone (it still owns 2068)
    expect(ref.text).toContain('/backlog/2068-reconcile-fui-runtime/');
    // and the kept 2068 file is NOT deleted / not renumbered
    expect(plan.deletes).not.toContain('2068-reconcile-fui-runtime.md');
  });

  it('idempotent: a clean tree with no collision is a no-op', () => {
    const plan = planRenumber([mk('1', 'a'), mk('2', 'b'), mk('3', 'c')]);
    expect(plan.collisions).toEqual([]);
    expect(plan.writes).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.summary).toMatch(/no-op/i);
  });

  it('BOUNDARY: never renumbers an id present in the batch base (real edit conflict, not a race)', () => {
    // 2050 collides but IS in the base → it is a genuine edit conflict, left alone.
    const files = [mk('2050', 'x', '', 10), mk('2050', 'y', '', 20)];
    const plan = planRenumber(files, { baseNums: ['2050'] });
    expect(plan.collisions).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('two independent collisions in one run get distinct fresh ids (no re-collision)', () => {
    const files = [
      mk('2068', 'a', '', 10), mk('2068', 'b', '', 20),
      mk('2069', 'c', '', 10), mk('2069', 'd', '', 20),
    ];
    const plan = planRenumber(files);
    const newNums = plan.collisions.map((c) => c.newNum);
    expect(new Set(newNums).size).toBe(2); // distinct
    expect(newNums).toEqual(['2070', '2071']);
  });
});
