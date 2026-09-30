import { describe, it, expect } from 'vitest';
import { machinePrTitle, readMainCard } from '../machine-pr-title.mjs';
import { groupPrsByDeliveredItem } from '../../conveyor/duplicate-pr-watch.mjs';
import { isAnnotationPr } from '../../backlog-stranded-sweep.mjs';
import { deliveredItemNumsFromPr, deliveredHashFromPr, itemNumsFromPr } from '../../lib/open-pr-items.mjs';

const card = { title: 'Planner build: plan schema and routing inputs' };
describe('machine PR titles', () => {
  it.each(['prepare', 'build', 'gate-fix'])('keeps identity and %s before the card title', (kind) => {
    expect(machinePrTitle({ item: 4427, kind, card })).toBe(`WE #4427: ${kind} — ${card.title}`);
  });
  it.each([
    ['prepare', 'prepare item — Design/MVP/Test plan/Proof plan/Follow-ups'],
    ['build', 'delivery build'], ['gate-fix', 'gate-failure fix'],
    ['prevention', 'file the prevention guard(s) owed by an independent review'],
  ])('retains the legacy %s fallback', (kind, fallback) => {
    expect(machinePrTitle({ item: 42, kind })).toBe(`WE #42: ${fallback}`);
  });
  it('strips control, bidi, shell/markup characters and caps Unicode titles', () => {
    const title = machinePrTitle({ repo: 'PLATEAU', item: 'xabcdef', kind: 'build',
      card: { title: 'A\n\u0000\u202e`$<>\\ B ' + '😀'.repeat(80) } });
    expect(title).toMatch(/^PLATEAU #xabcdef: build — A B /);
    expect(Array.from(title)).toHaveLength(70);
    expect(title.endsWith('…')).toBe(true);
  });
  it('summarizes prevention without confusing guarded PRs with backlog ids', () => {
    const title = machinePrTitle({ item: 'xjhjcjn', kind: 'prevention', card: {
      title: "File the prevention guard(s) owed by chalbert/web-everything#3158's independent review",
      raw: '1. `we:scripts/a.mjs:918` — Reject malformed flags\n2. Another guard',
    } });
    expect(title).toBe('WE #xjhjcjn: prevention — PR 3158 — Reject malformed flags');
    expect(itemNumsFromPr('lane/xjhjcjn-prevention-card', title)).not.toContain('3158');
    expect(deliveredHashFromPr('lane/xjhjcjn-prevention-card', title)).toBeNull();
  });
  it('retains duplicate grouping and hash delivery without crediting a cited PR', () => {
    const title = machinePrTitle({ item: 4333, kind: 'build', card });
    const groups = groupPrsByDeliveredItem([{ number: 1, title }, { number: 2, title }]);
    expect(groups.get('4333')).toEqual([1, 2]);
    const hashTitle = machinePrTitle({ item: 'xabcdef', kind: 'build', card });
    expect(deliveredHashFromPr('', hashTitle)).toBe('xabcdef');
  });

  it('preserves prepare detection and build delivery even with misleading card prose', () => {
    for (const kind of ['prepare', 'prevention', 'build', 'gate-fix']) {
      const title = machinePrTitle({ item: 4333, kind, card: { title: 'File checks: prepare scope' } });
      const annotation = ['prepare', 'prevention'].includes(kind);
      expect(isAnnotationPr({ title })).toBe(annotation);
      expect(deliveredItemNumsFromPr('', title)).toEqual(annotation ? [] : ['4333']);
    }
  });
});

describe('card titles citing other items never leak delivery identity', () => {
  it.each(['Stop auto-resolve #3443 false positives', '#3443: fix thing', 'Fixes #12 and #abcdef', 'Planner build: fix #4400 routing'])(
    'round-trips %s through the delivery extractors', (cardTitle) => {
      for (const kind of ['prepare', 'build', 'gate-fix']) {
        const ref = 'lane/4333-x';
        const title = machinePrTitle({ item: 4333, kind, card: { title: cardTitle } });
        expect(title).not.toMatch(/#(?!4333:)/);
        expect(itemNumsFromPr(ref, title)).toEqual(['4333']);
        if (kind !== 'prepare') expect(deliveredItemNumsFromPr(ref, title)).toEqual(['4333']);
        expect(deliveredHashFromPr(ref, title)).toBeNull();
      }
    });
});

describe('origin/main card metadata', () => {
  it('reads the exact remote card, never the worktree or HEAD', () => {
    const calls = [];
    const git = (args) => { calls.push(args); return args[0] === 'ls-tree'
      ? 'backlog/4427-card.md\nbacklog/44270-other.md\n' : '---\nstatus: open\n---\n# Planner build\n'; };
    expect(readMainCard(4427, git)?.title).toBe('Planner build');
    expect(calls[1]).toEqual(['show', 'origin/main:backlog/4427-card.md']);
  });
  it.each(['missing', 'ambiguous', 'unreadable', 'no-heading'])('falls back for %s metadata', (failure) => {
    const git = (args) => {
      if (failure === 'unreadable') throw new Error('unavailable');
      if (args[0] === 'show') return 'no heading';
      return failure === 'missing' ? '' : failure === 'ambiguous'
        ? 'backlog/42-one.md\nbacklog/42-two.md' : 'backlog/42-one.md';
    };
    expect(machinePrTitle({ item: 42, kind: 'build', card: readMainCard(42, git) })).toBe('WE #42: delivery build');
  });
});
