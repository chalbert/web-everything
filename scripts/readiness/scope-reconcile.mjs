/**
 * @file scripts/readiness/scope-reconcile.mjs
 * @description Resolve-time scope reconciliation (WE #2803, under the UI-fidelity epic #2804) — the PURE core.
 *   Diffs an item's DECLARED `scope:` against the files its lane ACTUALLY changed, and grades the difference:
 *   an undeclared file that is a presentation / route-graph surface is the epic's hard error (the
 *   self-declared-scope master bypass — declare a narrow non-UI scope, edit the UI anyway, and the UI-fidelity
 *   gate never looks at the item). No fs, no child_process, no `Date` — everything is injected, so the caller
 *   (`we:scripts/backlog.mjs`'s `resolve` verb) owns all IO and this stays unit-testable on plain arrays.
 *
 * COMPOSES, NEVER REINVENTS. Every predicate here is imported:
 *   • `scopeLease(declared, observed).breach` (`./scope-lease.mjs`:214) IS "observed files covered by NO
 *     declared entry" — already generalized past raw set difference to the granularity-aware `coversFile`
 *     contract (a declared SUBTREE covers what is under it; a declared FILE covers only itself, #2679). This
 *     module writes NO new coverage matcher.
 *   • `isVisualTouch(files, opts)` (`../lib/render-check.mjs`:131) IS the presentation predicate — its
 *     path-regex half (WE `*.njk` / `*.css` / `src/_includes/**`; FUI `plugs/webtheme/**`) plus, when a
 *     `routeGraph` is supplied, the route-import-graph half (#2802).
 *
 * TWO FORKS DECIDED HERE (recorded so a later session does not re-litigate them blind):
 *
 *   FORK B — "actually-changed files" are observed from THIS CLONE ONLY. The wider design (union in the
 *   sibling product clone's diff, so a `plateau-app:` edit reconciles too) was REJECTED: there is no durable
 *   resolve-time record of which sibling clone held an item's product-side edits — the item→lane registry
 *   (`lane-pool.mjs` → `.claude/lane-ports.json`) is per-pool, effectively WE-only, and its entries are
 *   dropped on unmap / lane remove / refresh, so by resolve time the mapping may be gone. Making a HARD ERROR
 *   depend on a soft, expiring signal is the worst possible combination. The cross-repo proof is owned by
 *   #2812's commit-bound conformance record. Consequence, stated plainly: in a WE lane the observed set is
 *   `we:`-qualified, so the route-graph half — whose only registered entry modules are `plateau-app:` paths —
 *   cannot fire there today. It is still wired, because `ROUTE_ENTRIES` is intended to grow WE routes and
 *   because #2802's manifest-snapshot follow-up gives the same call site the transitive half with no edit here.
 *
 *   FORK D — only PRESENTATION drift is fatal. An undeclared file that is NOT a presentation / route-graph
 *   surface (a plain `we:scripts/` module, say) is ordinary scope drift, and scope drift is the ADVISORY
 *   signal of `./scope-lease.mjs` (its own header: the whole-clone lease is the real lock). Re-grading all of
 *   it to error at resolve would break most normal resolves — measured, a non-empty `undeclared` set occurs on
 *   426 of 426 recent resolves. So `undeclared` is RETURNED for a later consumer (#2812's record) and is
 *   neither printed per-resolve nor fatal; only `offending` is.
 *
 * NOT the enforcement point. The producer-authored resolve in a lane clone is the only path where this fires:
 *   the drain's on-land `resolveLandedItem` (`../lane-drain.mjs`) runs the same verb in a clone already synced
 *   to merged `origin/main`, where the observed set is EMPTY and the guard passes vacuously (and its
 *   `catch { flipped: false }` would turn a refusal into a silent reopen rather than a visible failure). This
 *   is a cheap producer-side speed bump; the real floor is #2812's gate-side check.
 */

import { scopeLease } from './scope-lease.mjs';
import { isVisualTouch } from '../lib/render-check.mjs';

/**
 * Reconcile an item's declared scope against the files its lane actually changed.
 *
 * @param {object} a
 * @param {string[]} a.declared  the item's frontmatter `scope:` (repo-qualified, already shape-validated at
 *   author time by `check-standards.mjs`'s `scope:` rule — array-of-strings, non-empty, every entry
 *   repo-qualified — so no re-validation happens here).
 * @param {string[]} a.observed  repo-qualified changed files (lane diff ∪ dirty tree).
 * @param {object} [a.routeGraph] forwarded VERBATIM to `isVisualTouch`'s `opts.routeGraph`
 *   (`{ routeEntries, graph }`). Omit it and only the path-regex half runs.
 * @returns {{undeclared: string[], offending: string[], clean: boolean}}
 *   `undeclared` = every observed file no declared entry covers (advisory, Fork D);
 *   `offending`  = the subset of those that IS a presentation / route-graph surface (the hard error);
 *   `clean`      = `offending` is empty. Note `clean` tracks `offending`, NOT `undeclared` — a resolve with
 *                  ordinary non-UI drift is clean by design.
 */
export function reconcileScope({ declared, observed, routeGraph } = {}) {
  const undeclared = scopeLease(declared, observed).breach; // scope-lease.mjs:214 — NOT re-implemented
  // Called PER FILE rather than on the whole set: `isVisualTouch` answers a boolean for a set, and the error
  // message must name the specific offenders.
  const offending = undeclared.filter((f) => isVisualTouch([f], routeGraph ? { routeGraph } : {}));
  return { undeclared, offending, clean: offending.length === 0 };
}
