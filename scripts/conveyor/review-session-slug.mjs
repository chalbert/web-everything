/**
 * @file scripts/conveyor/review-session-slug.mjs
 * @description The `review-<pr>` session-name convention (#3279), single-sourced.
 *
 * WHY THIS IS ITS OWN FILE (#3437). `we:scripts/operations/review-dispatch.mjs` used to be the only definer of
 * `reviewSessionSlug`, but that file transitively imports `node:child_process`/`node:crypto`/`node:fs` (via
 * `dispatch-lane-io.mjs`) — impure by the standard `we:scripts/conveyor/reconcile-core.mjs` declares for
 * itself ("PURE: no fs, no clock, no process, no network"). `reconcile-core.mjs` needs this exact slug to bind
 * a live review session to the PR it is reviewing (the name is the only PR-specific identity a review-dispatch
 * session carries — see that file's own header), so the slug function moved here, where both a pure consumer
 * and an impure one can import it with no transitive impurity either way. `review-dispatch.mjs` re-exports it
 * unchanged so nothing that already imports it from there has to change — the same move
 * `we:scripts/conveyor/reconcile-core.mjs` already made importing `countRearmComments` from
 * `we:scripts/conveyor/rearm-review.mjs`.
 *
 * PURE: no fs, no clock, no process, no network.
 */

/** The lane-lease session slug a dispatched review carries — deliberately its OWN namespace (`review-<pr>`),
 *  distinct from `we:scripts/operations/dispatch-lane.mjs#sessionSlugFor`'s `conveyor-<num>` / `prepare-<num>`
 *  slugs: a review dispatch is not a build or a prepare, and a shared namespace risks two different dispatch
 *  kinds racing to release the SAME slug's lane lease. */
export function reviewSessionSlug(pr) {
  const id = String(pr ?? '').trim();
  if (!id) throw new Error('review-session-slug: needs a PR number to derive a session slug');
  return `review-${id}`;
}
