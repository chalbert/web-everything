/**
 * @file scripts/conveyor/advisory-round-count.mjs
 * @description THE DURABLE, RESTART-SURVIVING ATTEMPT COUNT FOR A `review:human` PR'S ADVISORY ROUNDS
 *   (epic #3383, mechanical-dispatcher). Mirrors `we:scripts/conveyor/rearm-review.mjs#countRearmComments`'s
 *   own shape and reason for existing, for a population that marker cannot see.
 *
 * THE GAP THIS CLOSES — confirmed live on PR #2117, 2026-09-14: SIX separate full advisory-panel runs posted
 * against the IDENTICAL commit range `a443ada1..e0769309` (zero commits between them), roughly every 20-50
 * minutes, with no end condition. `we:scripts/conveyor/reconcile-core.mjs#planReconcile`'s round cap
 * (`NEGOTIATION_ROUND_CAP`, 5) is real and correctly wired for a `bounced` PR — but for `needs-human`, the
 * `attempts` figure it fed on was `countRearmComments`, which counts the re-arm marker `record`'s label swap
 * posts after a repaired `review:changes` bounce. A `review:human` PR's label swap is REFUSED by
 * `we:scripts/review-set-label.mjs#decideSetLabel` (INVARIANT 2, correct and untouched) — `review:pending`
 * never clears, no bounce ever happens, and so no re-arm comment is EVER posted for this population. The
 * counter that was supposed to bind the cap stayed at 0 (or 1, if a human separately bounced it once) across
 * all six rounds, so `attempts >= roundCap` never fired.
 *
 * THE FIX: count the THING THAT ACTUALLY HAPPENED EACH ROUND instead — the automatic advisory-panel comment
 * `we:scripts/operations/review-pr.mjs`'s `advise` step posts on every completed run for a `review:human` PR
 * (#xlw02hw). One advisory round posts exactly one such comment, so counting them recovers "how many times the
 * panel has already run against this PR" from the PR's own durable thread — no parallel state store (#2612
 * invariant), same discipline `countRearmComments` already uses.
 *
 * BUILD AND COUNT SHARE ONE MARKER SO THEY CAN NEVER DRIFT (the same rule `REARM_COMMENT_MARKER` states for
 * itself). `renderAdvisoryNote` (`we:scripts/operations/review-pr.mjs`) imports {@link ADVISORY_NOTE_MARKER}
 * from HERE and opens its comment with it; changing the wording changes it in the one place both sides read.
 *
 * WHY A NEW LEAF FILE AND NOT A CONSTANT INSIDE `review-pr.mjs`. `review-pr.mjs` is the operation declaration —
 * heavy, with a wide import graph (codex/antigravity judge-spawn, model-probation, the whole jury core). Pulling
 * that into `we:scripts/conveyor/reconcile-core.mjs`, which is deliberately PURE and leaf-light (no fs, no
 * clock, no process, no network — see that file's own header), would be exactly the kind of drift risk this
 * repo's "widen the shared thing, don't grow a private copy" rule exists to prevent. This file is a true leaf —
 * no imports of its own — so either side can depend on it with no new edge to anything heavy. The DIRECTION
 * (`operations/review-pr.mjs` → `conveyor/advisory-round-count.mjs`) already has precedent: `we:scripts/
 * operations/review-dispatch.mjs` already imports `we:scripts/conveyor/autofix-review-findings.mjs`, and
 * `we:scripts/operations/clear-stuck-session.mjs` already imports `bindAgents`/`assessLiveness` straight out of
 * `reconcile-core.mjs` itself.
 *
 * PURE. No fs, no clock, no process, no network.
 */

/**
 * we:scripts/conveyor/advisory-round-count.mjs#ADVISORY_NOTE_MARKER — the stable FIRST LINE of the automatic
 * advisory-panel comment `we:scripts/operations/review-pr.mjs#renderAdvisoryNote` renders. Single-sourced HERE,
 * exactly as `REARM_COMMENT_MARKER` is single-sourced in `rearm-review.mjs`: the renderer opens its comment with
 * this literal, and {@link countAdvisoryComments} matches it, so the two can never say two different things.
 * Treat this as fixed — changing it orphans the count on every open `review:human` PR's existing thread (an
 * already-run PR would read as zero advisory rounds again, reopening the exact unbounded-redispatch bug this
 * file exists to close).
 */
export const ADVISORY_NOTE_MARKER = '**⚠️ THIS IS AN ADVISORY REVIEW, NOT A RECORDED VERDICT.**';

/**
 * we:scripts/conveyor/advisory-round-count.mjs#countAdvisoryComments — how many times the automatic advisory
 * panel has already run against this PR, read back off its OWN comment thread (#3383). Pure — the caller passes
 * the PR's `comments` exactly as `gh pr view <pr> --json comments` returns them (`[{ body }]`); a bare-string
 * array is tolerated too. A comment counts only when the marker is its LEADING line (`trimStart().startsWith`,
 * the same narrowing `countRearmComments` uses), so a human quoting the advisory comment in a reply — or citing
 * it from a different PR — never inflates the count.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of advisory-panel comments on the PR (0 for a non-array / empty input)
 */
export function countAdvisoryComments(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(ADVISORY_NOTE_MARKER)) n += 1;
  }
  return n;
}
