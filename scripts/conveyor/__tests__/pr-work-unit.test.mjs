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

  // #xcla4iv — the standard file-item-in-PR workflow: the card and the code that delivers it land in the SAME
  // PR, so `findItem` (which reads only `main`) misses it, but the PR's own diff carries the card. Live case:
  // `chalbert/web-everything` PR #2553 (branch `lane/xzi292i-stuck-pr-watch`) — see the file header.
  describe('#xcla4iv — the item\'s own card is filed IN this PR\'s diff, not yet on `main`', () => {
    it('attributes to the ITEM and reads the card\'s own committed `scope:` at the PR head, when found', () => {
      const calls = [];
      const unit = resolvePrWorkUnit({
        repo: 'we',
        pr: { number: 2553, headRefName: 'lane/xzi292i-stuck-pr-watch', headRefOid: 'deadbeef'.repeat(5) },
        findItem: boundFindItem([]), // nothing on `main` yet
        fetchDiffPaths: () => ['backlog/xzi292i-stuck-pr-watch-launch-a-diagnosis-only-inspection-agent-when.md', 'scripts/conveyor/stuck-pr-watch-core.mjs'],
        fetchCardScopeAtRef: (path, ref) => {
          calls.push({ path, ref });
          return ['we:scripts/conveyor/stuck-pr-watch-core.mjs', 'we:scripts/conveyor/stuck-pr-watch.mjs'];
        },
      });
      expect(calls).toEqual([{
        path: 'backlog/xzi292i-stuck-pr-watch-launch-a-diagnosis-only-inspection-agent-when.md',
        ref: 'deadbeef'.repeat(5),
      }]);
      expect(unit.attribution).toBe('item');
      expect(unit.itemNum).toBe('xzi292i');
      expect(unit.scope).toEqual(['we:scripts/conveyor/stuck-pr-watch-core.mjs', 'we:scripts/conveyor/stuck-pr-watch.mjs']);
      expect(unit.scopeSource).toBe('card');
    });

    it('falls back to the PR\'s own diff paths, repo-prefixed, when the card itself declares no `scope:`', () => {
      const unit = resolvePrWorkUnit({
        repo: 'plateau-app',
        pr: { number: 90, headRefName: 'lane/xabc123-new-thing', headRefOid: 'cafe'.repeat(10) },
        findItem: boundFindItem([]),
        fetchDiffPaths: () => ['backlog/xabc123-new-thing.md', 'src/Thing.tsx'],
        fetchCardScopeAtRef: () => [],
      });
      expect(unit.attribution).toBe('item');
      expect(unit.itemNum).toBe('xabc123');
      expect(unit.scope).toEqual(['plateau:backlog/xabc123-new-thing.md', 'plateau:src/Thing.tsx']);
      expect(unit.scopeSource).toBe('diff');
    });

    it('falls back to the diff paths when `fetchCardScopeAtRef` throws — never crashes the resolution', () => {
      const unit = resolvePrWorkUnit({
        repo: 'we',
        pr: { number: 91, headRefName: 'lane/xabc123-new-thing', headRefOid: 'cafe'.repeat(10) },
        findItem: boundFindItem([]),
        fetchDiffPaths: () => ['backlog/xabc123-new-thing.md'],
        fetchCardScopeAtRef: () => { throw new Error('gh unreachable'); },
      });
      expect(unit.attribution).toBe('item');
      expect(unit.scope).toEqual(['we:backlog/xabc123-new-thing.md']);
      expect(unit.scopeSource).toBe('diff');
    });

    it('skips the card read (no `headRefOid`) and falls straight to the diff-paths fallback', () => {
      const calls = [];
      const unit = resolvePrWorkUnit({
        repo: 'we',
        pr: { number: 92, headRefName: 'lane/xabc123-new-thing' }, // no headRefOid at all
        findItem: boundFindItem([]),
        fetchDiffPaths: () => ['backlog/xabc123-new-thing.md'],
        fetchCardScopeAtRef: () => { calls.push(1); return ['we:should/not/be/used.mjs']; },
      });
      expect(calls).toEqual([]);
      expect(unit.attribution).toBe('item');
      expect(unit.scope).toEqual(['we:backlog/xabc123-new-thing.md']);
      expect(unit.scopeSource).toBe('diff');
    });

    it('a GENUINE ghost — no matching card anywhere in the diff — still attributes to the PR, unaffected', () => {
      const calls = [];
      const unit = resolvePrWorkUnit({
        repo: 'we',
        pr: { number: 93, headRefName: 'lane/9999-ghost', headRefOid: 'cafe'.repeat(10) },
        findItem: boundFindItem([]),
        fetchDiffPaths: () => ['scripts/unrelated.mjs'], // no `backlog/9999-*.md` in the diff at all
        fetchCardScopeAtRef: () => { calls.push(1); return ['we:should/not/be/used.mjs']; },
      });
      expect(calls).toEqual([]); // never even attempted the card read — no candidate path found
      expect(unit.attribution).toBe('pr');
      expect(unit.itemNum).toBeNull();
      expect(unit.scope).toEqual(['we:scripts/unrelated.mjs']);
    });

    it('does not false-positive on a card path whose number is merely a PREFIX of another item\'s (boundary check)', () => {
      // itemNum `338` must not match `backlog/3383-....md` — the hyphen boundary in `cardPrefix` prevents it.
      const unit = resolvePrWorkUnit({
        repo: 'we',
        pr: { number: 94, headRefName: 'lane/338-short-num', headRefOid: 'cafe'.repeat(10) },
        findItem: boundFindItem([]),
        fetchDiffPaths: () => ['backlog/3383-a-background-mechanical-dispatcher.md'],
        fetchCardScopeAtRef: () => { throw new Error('must not be called — no matching card for `338`'); },
      });
      expect(unit.attribution).toBe('pr');
      expect(unit.itemNum).toBeNull();
    });
  });
});
