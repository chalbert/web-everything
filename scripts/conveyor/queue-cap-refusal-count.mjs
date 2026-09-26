/**
 * @file scripts/conveyor/queue-cap-refusal-count.mjs
 * @description THE DURABLE, RESTART-SURVIVING QUEUE-CAP REFUSAL COUNT for a fix-dispatch PR (#4229, bornAs
 *   xo2emdz, epic #4075/#3383). Mirrors `we:scripts/conveyor/unowned-rebase-attempt-count.mjs`'s own shape and
 *   reason for existing: a leaf, PR-comment-backed counter with its own marker and cap, for a population neither
 *   `we:scripts/conveyor/ci-heal-mark.mjs` nor `we:scripts/conveyor/conflict-fix-round-count.mjs` can see.
 *
 * WHY THIS EXISTS. The flow checker (`node scripts/conveyor/flows/check.mjs`) flags
 * `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s own queue admission check (state `queue-cap-hit`,
 * `we:scripts/conveyor/flows/fix.flow.json`) as `uncapped-retry`: `createQueueBudget#tryAdmit` refuses a fix
 * dispatch `'queue-cap'` whenever the projected heavy-test queue wait would exceed budget, with no durable count
 * and no escalation — a persistently saturated heavy queue can refuse the SAME PR indefinitely with nothing
 * surfaced to a human beyond a per-pass, in-memory refusal line nobody centrally watches.
 *
 * NEVER STOPS RETRYING — ONLY STOPS BEING SILENT. Unlike the unowned-rebase-drop cap (a genuinely broken
 * mechanical action, correctly abandoned once its cap is spent) queue congestion is expected to clear on its
 * own; refusing forever IS the correct behavior while the queue stays saturated. So
 * `we:scripts/conveyor/reconcile-fix-dispatch.mjs` keeps calling `tryAdmit` every pass past the cap exactly as
 * before — this counter only gates (a) whether another durable attempt-marker comment gets posted (capped at
 * {@link QUEUE_CAP_REFUSAL_CAP}, so a saturated queue's own refusal history can never spam the PR thread once a
 * human has already been told) and (b) whether the one-time `round-cap-exhausted` note
 * (`capKind: 'queue-cap'`, `we:scripts/conveyor/reconcile-note-comment.mjs#noteEpisodeKey`) still needs posting.
 *
 * PURE reader (this file, mirrors every sibling counter's split); the writer (posting the marker comment) lives
 * in the IO shell (`reconcile-fix-dispatch.mjs`), same split as every sibling counter in this directory.
 */
import { isTrustedMarkerAuthor } from '../lib/marker-authorship.mjs';

/**
 * we:scripts/conveyor/queue-cap-refusal-count.mjs#QUEUE_CAP_REFUSAL_MARKER — the stable FIRST LINE of the
 * durable comment posted for each of the first {@link QUEUE_CAP_REFUSAL_CAP} `queue-cap` refusals a PR's fix
 * dispatch sees. Single-sourced HERE: `we:scripts/conveyor/reconcile-fix-dispatch.mjs` posts it,
 * {@link countQueueCapRefusals} matches it. Treat this line as fixed — changing it orphans the count on every
 * open PR's existing history.
 */
export const QUEUE_CAP_REFUSAL_MARKER = '⏳ conveyor — fix dispatch refused, queue-cap (#4229)';

/**
 * we:scripts/conveyor/queue-cap-refusal-count.mjs#QUEUE_CAP_REFUSAL_CAP — the queue-cap refusal cap, before this
 * PR's fix dispatch stops posting a fresh durable marker comment for every further refusal and instead surfaces
 * the one-time `round-cap-exhausted` note. Mirrors `we:scripts/conveyor/reconcile-core.mjs#CI_HEAL_ROUND_CAP` /
 * `we:scripts/conveyor/unowned-rebase-attempt-count.mjs#UNOWNED_REBASE_ATTEMPT_CAP`'s own value (3) — the same
 * "a small, fixed floor before a human is told" reasoning, not re-derived from either (this population is
 * counted off its own marker, so sharing the numeric value only keeps the two independently tunable).
 */
export const QUEUE_CAP_REFUSAL_CAP = 3;

/**
 * we:scripts/conveyor/queue-cap-refusal-count.mjs#buildQueueCapRefusalComment — the durable per-refusal comment
 * body: {@link QUEUE_CAP_REFUSAL_MARKER} as the FIRST line (so {@link countQueueCapRefusals} matches it), the
 * human-readable reason below. Pure.
 * @param {string} [why] - `we:scripts/conveyor/reconcile-fix-dispatch.mjs#queueCapWhy`'s own text.
 * @returns {string}
 */
export function buildQueueCapRefusalComment(why) {
  return `${QUEUE_CAP_REFUSAL_MARKER}\n\n${why || 'fix dispatch refused this pass (queue-cap)'}`;
}

/**
 * we:scripts/conveyor/queue-cap-refusal-count.mjs#countQueueCapRefusals — how many `queue-cap` refusals have
 * already been durably recorded against this PR, read back off its OWN comment thread. Pure — the caller passes
 * the PR's `comments` exactly as `gh pr view <pr> --json comments` returns them (`[{ body }]`); a bare-string
 * array is tolerated too. A comment is counted only when the marker is its LEADING line
 * (`trimStart().startsWith`, the same narrowing every sibling counter in this repo uses) AND its author passes
 * {@link isTrustedMarkerAuthor} — a forged marker from an untrusted login must never inflate this population's
 * cap.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of durable queue-cap-refusal comments on the PR (0 for a non-array / empty input)
 */
export function countQueueCapRefusals(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(QUEUE_CAP_REFUSAL_MARKER) && isTrustedMarkerAuthor(c)) n += 1;
  }
  return n;
}
