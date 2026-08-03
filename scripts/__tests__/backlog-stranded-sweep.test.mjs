/**
 * @file scripts/__tests__/backlog-stranded-sweep.test.mjs
 * @description Unit proof of the #2899 A4 stranded-item sweep's PURE core. The whole value of this sweep is
 * PRECISION: the naive offline inference ("numeric id + a `bornAs` hash ⇒ its lane landed") flags 218 of 2874
 * cards on the live corpus, almost all of them correctly-open items that were merely FILED by someone else's
 * landing PR — a report nobody can act on. So these tests are mostly about what must NOT be reported: the
 * annotation, housekeeping, filing and batch-slug shapes that name an item without delivering it.
 */
import { describe, it, expect } from 'vitest';
import { readFrontmatterField, idTokenOf, isAnnotationPr, prDeliveredItem, sweepStrandings } from '../backlog-stranded-sweep.mjs';

const card = (stem, fm) => ({ stem, body: `---\n${fm}\n---\n\n# Title\n\nBody.\n` });

describe('#2899 A4 — readFrontmatterField / idTokenOf', () => {
  it('reads only the leading frontmatter block, never a body line (#2603 frontmatter-strict)', () => {
    const body = '---\nstatus: open\n---\n\n# T\n\nA body line saying status: resolved should NOT win.\n';
    expect(readFrontmatterField(body, 'status')).toBe('open');
  });
  it('strips quotes, and is null for a missing field or a body with no frontmatter', () => {
    expect(readFrontmatterField('---\ndateStarted: "2026-08-03"\n---\n', 'dateStarted')).toBe('2026-08-03');
    expect(readFrontmatterField('---\nstatus: open\n---\n', 'bornAs')).toBe(null);
    expect(readFrontmatterField('# no frontmatter\n', 'status')).toBe(null);
  });
  it('takes the id token up to the first dash', () => {
    expect(idTokenOf('2899-jit-numbering-at-land')).toBe('2899');
    expect(idTokenOf('xdxlevu-jit-numbering')).toBe('xdxlevu');
  });
});

describe('#2899 A4 — isAnnotationPr: the flows that name an item without delivering it', () => {
  // Each of these lands, edits the card, and CORRECTLY leaves it open. Reporting them is how the sweep would
  // turn back into the noise it exists to replace.
  it.each([
    ['WE #2412: author scope: for #2412', ''],
    ['WE #907: prepare scope — publish + FUI-migration touch-set', ''],
    ['WE #2446: prepare Plateau Loop placement decision — forks + defaults', ''],
    ['File #x4hbiu0: merge-gate consumer totality', ''],
    ['WE #2405: file story — unresolved review:* label must veto the land', ''],
    ['', 'lane/2422-scope-run-tooling-guard'],
    ['', 'lane/2446-prep-placement'],
    ['', 'lane/slice-epics-2551-2610-2531'],
    ['', 'lane/backlog-scaffold-2555-2505'],
    ['', 'lane/file-xrq396a-repo-qualify-relief'],
    ['', 'lane/capture-2676-deferrals'],
  ])('is annotation: title=%j ref=%j', (title, headRefName) => {
    expect(isAnnotationPr({ title, headRefName })).toBe(true);
  });

  it.each([
    ['2899: decouple the resolve-on-land seam', 'lane/2899-resolve-on-land'],
    ['Harden the couple-join gate', 'lane/couple-join-decouple'],
    ['', 'lane/2350-reserved-memory-lane'],
  ])('is NOT annotation: title=%j ref=%j', (title, headRefName) => {
    expect(isAnnotationPr({ title, headRefName })).toBe(false);
  });
});

describe('#2899 A4 — prDeliveredItem', () => {
  const item = { id: '2899', bornAs: 'xdxlevu' };

  it('matches a lane ref naming the item, by NNN or by its birth hash', () => {
    expect(prDeliveredItem({ headRefName: 'lane/2899-resolve-on-land' }, item).matched).toBe(true);
    expect(prDeliveredItem({ headRefName: 'lane/xdxlevu-resolve-on-land' }, item).matched).toBe(true);
  });

  it('matches the `<id>: subject` and `Resolve #<id>` title conventions', () => {
    expect(prDeliveredItem({ title: '2899: wire resolve-on-land' }, item).matched).toBe(true);
    expect(prDeliveredItem({ title: 'Resolve #2899: verify it landed' }, item).matched).toBe(true);
  });

  it('matches the lane manifest in the PR body (#2411 — the manifest rides the body)', () => {
    expect(prDeliveredItem({ body: 'blah\n{"item": "xdxlevu", "repos": []}\n' }, item).via).toBe('lane manifest in PR body');
    expect(prDeliveredItem({ body: '{"item": 2899}' }, item).via).toBe('lane manifest in PR body');
  });

  it('does NOT match a bare citation in the body — that is exactly how a filed-in-passing item looks', () => {
    expect(prDeliveredItem({ body: 'This is the couple-join twin of #2899, see also #2899.' }, item).matched).toBe(false);
  });

  it('does NOT credit a BATCH lane for every item named in its slug — only the trailing one', () => {
    // `lane/batch-2026-08-02-2880-2450-2457-2450` delivered 2450; 2880 and 2457 are just slug residue.
    const ref = 'lane/batch-2026-08-02-2880-2450-2457-2450';
    expect(prDeliveredItem({ headRefName: ref }, { id: '2450' }).matched).toBe(true);
    expect(prDeliveredItem({ headRefName: ref }, { id: '2880' }).matched).toBe(false);
    expect(prDeliveredItem({ headRefName: ref }, { id: '2457' }).matched).toBe(false);
  });

  it('does NOT match an annotation PR even when it names the item exactly', () => {
    expect(prDeliveredItem({ headRefName: 'lane/2899-scope-x', title: 'WE #2899: author scope: for #2899' }, item).matched).toBe(false);
  });

  it('never matches an item with no usable tokens', () => {
    expect(prDeliveredItem({ headRefName: 'lane/2899-x' }, {}).matched).toBe(false);
    expect(prDeliveredItem({ headRefName: 'lane/2899-x' }, { id: '', bornAs: 'null' }).matched).toBe(false);
  });
});

describe('#2899 A4 — sweepStrandings', () => {
  const prs = [{ number: 900, headRefName: 'lane/2899-resolve-on-land', title: '2899: wire it' }];

  it('reports an open/active card that a merged PR delivered', () => {
    const hits = sweepStrandings([card('2899-jit', 'kind: story\nstatus: active\ndateStarted: "2026-08-03"\nbornAs: xdxlevu')], prs);
    expect(hits).toEqual([{ id: '2899', status: 'active', bornAs: 'xdxlevu', dateStarted: '2026-08-03', mergedPrs: [{ pr: 900, via: 'lane-ref lane/2899-resolve-on-land' }] }]);
  });

  it('ignores a card that is already resolved — nothing to heal', () => {
    expect(sweepStrandings([card('2899-jit', 'kind: story\nstatus: resolved\nbornAs: xdxlevu')], prs)).toEqual([]);
  });

  it('ignores an EPIC — it legitimately outlives every PR that lands one of its slices', () => {
    expect(sweepStrandings([card('2899-jit', 'kind: epic\nstatus: open\nbornAs: xdxlevu')], prs)).toEqual([]);
  });

  it('ignores an open card that no merged PR delivered', () => {
    expect(sweepStrandings([card('2899-jit', 'kind: story\nstatus: open')], [{ number: 1, headRefName: 'lane/other', title: 'other' }])).toEqual([]);
  });

  it('caps the evidence listed per item and tolerates junk input', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ number: i, headRefName: 'lane/2899-x', title: '' }));
    expect(sweepStrandings([card('2899-jit', 'kind: story\nstatus: open')], many)[0].mergedPrs).toHaveLength(3);
    expect(sweepStrandings()).toEqual([]);
    expect(sweepStrandings([null, undefined], null)).toEqual([]);
  });
});
