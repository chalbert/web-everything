/**
 * @file scripts/conveyor/__tests__/pr-work-unit.test.mjs — #xdx3ifb multi-repo slice 3:
 *   {@link resolvePrWorkUnit} resolves ANY constellation-repo PR to the work unit it delivers, per the
 *   ratified `#conveyor-multi-repo-model` (we:backlog/xx478x6-*.md): a declared backlog item when its branch
 *   names one `findItem` can resolve (now including a renamed card's `bornAs`), else the PR itself,
 *   attributed by its own diff under its OWN repo's canonical scope prefix.
 *
 * Uses the REAL `we:scripts/operations/dispatch-lane-io.mjs#findItem` (with a stubbed `loadItems`) rather
 * than a hand-rolled stub for the item-lookup cases, so the `bornAs` fallback this slice adds there is
 * exercised end-to-end through the resolver, not just re-asserted in isolation.
 */
import { describe, it, expect } from 'vitest';
import { resolvePrWorkUnit } from '../pr-work-unit.mjs';
import { findItem as realFindItem } from '../../operations/dispatch-lane-io.mjs';

// Bind the real `findItem` to a fixed item corpus, arity-1 — the shape `resolvePrWorkUnit` expects.
const boundFindItem = (items) => (key) => realFindItem(key, () => items);

describe('resolvePrWorkUnit (#xdx3ifb)', () => {
  it('attributes to the ITEM when the head ref names one `findItem` resolves by `num`', () => {
    const items = [{ num: '3959', slug: 'multi-repo-slice-3', scope: ['we:scripts/conveyor/pr-work-unit.mjs'] }];
    const unit = resolvePrWorkUnit({
      repo: 'we',
      pr: { number: 2600, headRefName: 'lane/3959-multi-repo-slice-3' },
      findItem: boundFindItem(items),
      fetchDiffPaths: () => { throw new Error('must not be called — an item was found'); },
    });
    expect(unit.attribution).toBe('item');
    expect(unit.itemNum).toBe('3959');
    expect(unit.scope).toEqual(['we:scripts/conveyor/pr-work-unit.mjs']);
  });

  it('attributes to the ITEM via a renamed card\'s `bornAs` — the live #2518/x3izqob→#3945 shape', () => {
    const items = [{ num: '3945', bornAs: 'x3izqob', slug: 'review-human-advisory-gap', scope: ['we:scripts/conveyor/reconcile-pass.mjs'] }];
    const unit = resolvePrWorkUnit({
      repo: 'we',
      pr: { number: 2518, headRefName: 'lane/x3izqob-review-human-advisory-gap' },
      findItem: boundFindItem(items),
      fetchDiffPaths: () => { throw new Error('must not be called — the renamed card was found via bornAs'); },
    });
    expect(unit.attribution).toBe('item');
    expect(unit.itemNum).toBe('3945');
    expect(unit.scope).toEqual(['we:scripts/conveyor/reconcile-pass.mjs']);
  });

  it('attributes to the PR itself, scope from its own diff under the repo\'s canonical prefix, when no item resolves', () => {
    const unit = resolvePrWorkUnit({
      repo: 'plateau-app',
      pr: { number: 77, headRefName: 'lane/wip-quick-fix' }, // no item number in the ref at all
      findItem: boundFindItem([]),
      fetchDiffPaths: (pr) => { expect(pr).toBe(77); return ['src/App.tsx', 'src/App.test.tsx']; },
    });
    expect(unit.attribution).toBe('pr');
    expect(unit.itemNum).toBeNull();
    expect(unit.scope).toEqual(['plateau:src/App.tsx', 'plateau:src/App.test.tsx']);
  });

  it('attributes to the PR when the ref names an item number `findItem` cannot resolve at all (ghost/deleted card)', () => {
    const unit = resolvePrWorkUnit({
      repo: 'frontierui',
      pr: { number: 88, headRefName: 'lane/9999-ghost' },
      findItem: boundFindItem([]),
      fetchDiffPaths: () => ['components/Button.tsx'],
    });
    expect(unit.attribution).toBe('pr');
    expect(unit.itemNum).toBeNull();
    expect(unit.scope).toEqual(['fui:components/Button.tsx']);
  });

  it('returns null for an unrecognized repo — nothing else is resolvable without a profile', () => {
    expect(resolvePrWorkUnit({
      repo: 'some-other-repo-entirely',
      pr: { number: 1, headRefName: 'lane/1-x' },
      findItem: () => null,
      fetchDiffPaths: () => [],
    })).toBeNull();
  });

  it('a `fetchDiffPaths` failure degrades to an empty scope, never throws the whole resolution', () => {
    const unit = resolvePrWorkUnit({
      repo: 'we',
      pr: { number: 5, headRefName: 'lane/wip-x' },
      findItem: boundFindItem([]),
      fetchDiffPaths: () => { throw new Error('gh unreachable'); },
    });
    expect(unit.attribution).toBe('pr');
    expect(unit.scope).toEqual([]);
  });
});
