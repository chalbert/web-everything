/**
 * @file scripts/conveyor/pr-work-unit.mjs
 * @description #xdx3ifb multi-repo slice 3 — RESOLVE ANY PR TO A WORK UNIT, across any constellation repo, per
 *   the ratified `#conveyor-multi-repo-model` (we:backlog/xx478x6-*.md, see we:reports/2026-09-23-conveyor-
 *   multi-repo-gap-map.md "Proposed design" B / root cause 1): ONE backlog (WE's) for every repo, with
 *   repo-prefixed scope (`we:`/`fui:`/`plateau:`); a PR that names no backlog item is attributed to the PR
 *   itself, with scope taken from its own diff under its OWN repo's prefix — never `we:` by default.
 *
 * THE TWO GAPS THIS CLOSES (both audited live, see the item's own backlog card):
 *   1. `we:scripts/operations/dispatch-lane-io.mjs#findItem` matches an item's `num` only. When a WE half
 *      lands, the drain JIT-renumbers its card (`xHASH → NNNN`, #2288) — the still-open impl-repo branch,
 *      cut before that rename and still named `lane/xHASH-…`, has no way to learn the new number. `findItem`
 *      now also matches `bornAs` (see its own docblock), so this resolver's item lookup recovers that
 *      population automatically, with no change here.
 *   2. `we:scripts/conveyor/reconcile-fix-dispatch.mjs#fetchPrDiffScope`'s fallback scope was hard-coded
 *      `we:` regardless of which repo the PR actually lives in — correct only for WE itself. This resolver's
 *      pr-attribution branch prefixes with `repoProfile(repo).canonicalPrefix`, the SAME per-repo prefix table
 *      slice 1 (`we:scripts/lib/repo-profile.mjs`) gives every other multi-repo consumer, so plateau/fui diffs
 *      are never mislabeled as WE's.
 *
 * PURE, given its two injected IO seams (`findItem`, `fetchDiffPaths`) — this file itself touches no `fs` /
 * `gh` / `git`. `repoProfile`/`gateFor` are called directly (not injected) because they are themselves already
 * the single, injectable-at-their-own-level IO seam (`we:scripts/lib/repo-profile.mjs`); adding a second layer
 * of indirection here would just be a wrapper around a wrapper.
 */
import { repoProfile, gateFor } from '../lib/repo-profile.mjs';
import { laneRefItemNum } from './lease-reaper.mjs';

/**
 * we:scripts/conveyor/pr-work-unit.mjs#resolvePrWorkUnit — resolve ONE pull request (in any constellation
 * repo) to the work unit it actually delivers: a declared backlog item when its branch names one findable by
 * {@link findItem} (which itself now also matches a renamed card's `bornAs`), or the PR itself — attributed by
 * its own already-changed files, repo-prefixed — when it names none, or names one `findItem` cannot resolve.
 *
 * `attribution: 'item'` NEVER falls back to the diff: a declared `scope:` is the item's own predicted fence,
 * trusted over whatever files a PR happens to have touched so far (mirrors `planFixesFromReconcile`'s own
 * item-scope-wins-over-diff order). `attribution: 'pr'` is the diff-derived fallback the ratified model calls
 * for — every changed path, prefixed with THIS repo's canonical scope prefix (never a fixed `we:`).
 *
 * @param {object} o
 * @param {string} o.repo - any vocabulary {@link repoProfile} accepts (key / gh slug / slug tag / scope
 *   prefix, with or without a trailing `:`) — e.g. `'we'`, `'plateau-app'`, `'plateau'`, `'chalbert/plateau-app'`.
 * @param {{number: number|string, headRefName?: string|null}} o.pr - the PR's own number and head ref name
 *   (the same two fields `reconcile-pass.mjs`'s dispatch entries already carry as `prNumber`/`headRefName`).
 * @param {(itemNum: string) => ({num:string, slug:string, specPath:string, scope:string[]}|null)} o.findItem -
 *   injected, arity-1 (the caller binds the real `we:scripts/operations/dispatch-lane-io.mjs#findItem`'s
 *   `loadItems` closure so this resolver never has to know how the ONE backlog is loaded).
 * @param {(pr: number) => string[]} o.fetchDiffPaths - injected: the PR's own changed-file paths, REPO-RELATIVE
 *   and un-prefixed (this resolver adds the prefix) — the real binding is `reconcile-fix-dispatch.mjs`'s
 *   `fetchPrDiffScope`'s underlying `gh pr diff --name-only` read, minus that function's own `we:` prefixing.
 * @returns {{attribution:'item'|'pr', itemNum:string|null, scope:string[], gate:string|null}|null} `null` when
 *   `repo` is not a recognized constellation repo — nothing else here is resolvable without a profile.
 */
export function resolvePrWorkUnit({ repo, pr, findItem, fetchDiffPaths }) {
  const profile = repoProfile(repo);
  if (!profile) return null;

  const prNumber = pr && typeof pr === 'object' ? Number(pr.number) : Number(pr);
  const headRefName = pr && typeof pr === 'object' ? (pr.headRefName ?? null) : null;
  const gate = gateFor(profile.key);

  const itemNum = laneRefItemNum(headRefName);
  const item = itemNum ? findItem(itemNum) : null;
  if (item) {
    return {
      attribution: 'item',
      itemNum: String(item.num),
      scope: Array.isArray(item.scope) ? item.scope.map(String) : [],
      gate,
    };
  }

  let diffPaths = [];
  try { diffPaths = fetchDiffPaths(prNumber) || []; } catch { diffPaths = []; }
  const scope = (Array.isArray(diffPaths) ? diffPaths : [])
    .map((p) => String(p).trim())
    .filter(Boolean)
    .map((p) => `${profile.canonicalPrefix}:${p}`);

  return { attribution: 'pr', itemNum: null, scope, gate };
}
