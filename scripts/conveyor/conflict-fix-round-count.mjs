/**
 * @file scripts/conveyor/conflict-fix-round-count.mjs
 * @description THE DURABLE, RESTART-SURVIVING ATTEMPT COUNT FOR A MECHANICAL CONFLICT-RESOLUTION ROUND (#xkmu3gv).
 *   Mirrors `we:scripts/conveyor/advisory-round-count.mjs`'s own shape and reason for existing, for a population
 *   that neither the ordinary rearm marker nor the advisory marker can see.
 *
 * WHY ITS OWN MARKER AND CAP, NOT `REARM_COMMENT_MARKER` / `NEGOTIATION_ROUND_CAP`. `we:scripts/conveyor/
 * reconcile-core.mjs`'s shared round cap (5) exists to stop ordinary review<->fix PING-PONG — a human/AI
 * reviewer raises a substantive finding, a fixer addresses it, a human re-verdicts, repeat. A mechanical
 * conflict-resolution round is a DIFFERENT kind of work — rebase-and-resolve against `main`, never judgment over
 * a reviewer's finding — introduced by `origin/lane/xdhidso-review-human-statute-fixer` (PR #2577): a
 * `review:human`, statute-tier merge conflict that does not overlap `main`'s own edits since the merge base is
 * routed to the fixer via `we:scripts/conveyor/reconcile-finding.mjs`, which bounces the PR `review:changes`
 * exactly like an ordinary reviewer finding would. CONFIRMED LIVE, 2026-09-24: `chalbert/web-everything#2549`
 * had already spent 5 of 5 ordinary rounds (`review-round:5`) by the time #2577's routing rule newly offered it
 * a mechanical conflict fix — `runReconcilePass` refused it `cap-exhausted` before the fixer ever ran, even
 * though ZERO conflict-resolution rounds had ever actually run on this PR (real `runReconcilePass({repo:
 * 'chalbert/web-everything'})`, no writes). Mirrors `we:scripts/conveyor/reconcile-core.mjs#CI_HEAL_ROUND_CAP`'s
 * own reasoning exactly: a different KIND of round needs its own floor, never a shared one that lets a PR burn
 * through one cap doing the other kind's work.
 *
 * BUILD AND COUNT SHARE ONE MARKER SO THEY CAN NEVER DRIFT. `we:scripts/conveyor/rearm-review.mjs`'s CLI posts a
 * comment starting with {@link CONFLICT_FIX_COMMENT_MARKER} when invoked `--round=conflict` — the SAME
 * `review:changes → review:pending` swap an ordinary rearm makes (a mechanical conflict fix still hands back to
 * the SAME human-ceremony-only gate; `review:human` is never touched either way) — only the comment's marker
 * differs, so this population's rounds can never silently inflate `countRearmComments`, and vice versa.
 *
 * WHY A NEW LEAF FILE AND NOT A CONSTANT INSIDE `reconcile-fix-dispatch.mjs` or `parked-pr-conflict-watch.mjs`.
 * Both of those carry a wide, impure import graph; this file is a true leaf (no imports at all) so
 * `we:scripts/conveyor/reconcile-core.mjs` — deliberately PURE and leaf-light — can depend on it with no new
 * edge to anything heavy. Same reasoning `advisory-round-count.mjs`'s own header states for itself.
 *
 * PURE. No fs, no clock, no process, no network.
 */

/**
 * we:scripts/conveyor/conflict-fix-round-count.mjs#CONFLICT_FIX_COMMENT_MARKER — the stable FIRST LINE of the
 * durable comment a completed mechanical conflict-resolution round posts. Single-sourced HERE:
 * `we:scripts/conveyor/rearm-review.mjs` (`--round=conflict`) POSTS a comment starting with it, and
 * {@link countConflictFixComments} MATCHES it. Treat this line as fixed — changing it orphans the count on
 * every open conflict-routed PR's existing history.
 */
export const CONFLICT_FIX_COMMENT_MARKER = '🔧 conveyor fix — conflict resolved and re-armed (mechanical round, #xkmu3gv)';

/**
 * we:scripts/conveyor/conflict-fix-round-count.mjs#countConflictFixComments — how many mechanical
 * conflict-resolution rounds have already run against this PR, read back off its OWN comment thread (#xkmu3gv).
 * Pure — the caller passes the PR's `comments` exactly as `gh pr view <pr> --json comments` returns them
 * (`[{ body }]`); a bare-string array is tolerated too. A comment is counted only when the marker is its
 * LEADING line (`trimStart().startsWith`, the same narrowing every sibling counter in this repo uses), so a
 * human quoting the comment in a reply never inflates the count.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of conveyor conflict-fix comments on the PR (0 for a non-array / empty input)
 */
export function countConflictFixComments(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(CONFLICT_FIX_COMMENT_MARKER)) n += 1;
  }
  return n;
}
