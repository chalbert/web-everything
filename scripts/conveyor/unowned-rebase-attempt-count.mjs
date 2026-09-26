/**
 * @file scripts/conveyor/unowned-rebase-attempt-count.mjs
 * @description THE DURABLE, RESTART-SURVIVING ATTEMPT COUNT for the UNOWNED population's mechanical rebase-drop
 *   attempt (#xu38vlf, epic #4075/#3383). Mirrors `we:scripts/conveyor/conflict-fix-round-count.mjs`'s own shape
 *   and reason for existing (a leaf, PR-comment-backed counter with its own marker and cap — never a shared one,
 *   for the same reason that file states: a different KIND of round needs its own floor).
 *
 * WHY THIS EXISTS. The flow checker (`we:scripts/conveyor/flows/check.mjs`) flagged
 * `we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultAttemptUnownedConflictRebase` (state
 * `unowned-mechanical-rebase-attempt`, `we:scripts/conveyor/flows/conflict.flow.json`) as `uncapped-retry`: every
 * ~120s sweep re-attempts the rebase-drop against `main` with NO per-PR counter of its own. The ordinary
 * `action:'skip'`/`'error'` fall-through USUALLY exits this population within the same sweep (it labels the PR
 * `review:changes` + `merge-status:conflicting`, which reclassifies it as PARKED next sweep, inheriting
 * `CONFLICT_FIX_ROUND_CAP` there) — but a THROW from the git-level attempt itself (a stale lock, a corrupted
 * ref, a protected-branch push denial) used to abort the WHOLE per-PR handler before that label ever applied,
 * leaving the PR unowned again next sweep with nothing durable recording that an attempt had even been made:
 * silently retried forever, with no cap and no operator-visible trace beyond a per-tick `entry.error` line
 * nobody centrally watches.
 *
 * MARKER POSTED THE MOMENT THE OUTCOME IS KNOWN TO BE RETRY-WORTHY, NEVER ON A CLEAN SUCCESS. Unlike
 * `conflict-fix-round-count.mjs`'s marker (posted only once a round FULLY completes and re-arms), this marker
 * is posted by the IO shell right after `attemptMechanicalRebase` returns (or throws) `'skip'`/`'error'` —
 * BEFORE anything else that could itself throw (the comment/dispatch/label writes below it), so a persistently
 * failing attempt still durably advances the count even if everything downstream of it also fails. A clean
 * `'rebased'`/`'current'` result posts nothing: the common healthy path pays no extra write, and there is no
 * "next attempt" to bound in the first place once the conflict is actually resolved.
 *
 * PURE reader (this file, mirrors every sibling counter's split); the writer (posting the marker comment) lives
 * in the IO shell (`parked-pr-conflict-watch.mjs`), same split as every sibling counter in this directory.
 */
import { isTrustedMarkerAuthor } from '../lib/marker-authorship.mjs';

/**
 * we:scripts/conveyor/unowned-rebase-attempt-count.mjs#UNOWNED_REBASE_ATTEMPT_MARKER — the stable FIRST LINE of
 * the durable comment posted right after each unowned-population mechanical rebase-drop attempt that came back
 * (or threw) `'skip'`/`'error'`. Single-sourced HERE: `parked-pr-conflict-watch.mjs` posts it,
 * {@link countUnownedRebaseAttempts} matches it. Treat this line as fixed — changing it orphans the count on
 * every open unowned-conflict PR's existing history.
 */
export const UNOWNED_REBASE_ATTEMPT_MARKER = '🔁 conveyor — unowned mechanical rebase attempted (#xu38vlf)';

/**
 * we:scripts/conveyor/unowned-rebase-attempt-count.mjs#UNOWNED_REBASE_ATTEMPT_CAP — the attempt cap for the
 * unowned population's mechanical rebase-drop, before it stops retrying and falls through to the ordinary
 * bounce/stand-down with an operator-visible note. Mirrors `we:scripts/conveyor/reconcile-core.mjs
 * #CONFLICT_FIX_ROUND_CAP`'s own value (3) — the same "a mechanical, no-judgment round gets a small, fixed
 * floor" reasoning, not re-derived from it (this population's rounds are counted off a DIFFERENT marker, so
 * sharing the numeric value only, not the constant itself, keeps the two populations' caps independently
 * tunable without a cross-file edit).
 */
export const UNOWNED_REBASE_ATTEMPT_CAP = 3;

/**
 * we:scripts/conveyor/unowned-rebase-attempt-count.mjs#countUnownedRebaseAttempts — how many unowned-population
 * mechanical rebase-drop attempts have already run against this PR, read back off its OWN comment thread.
 * Pure — the caller passes the PR's `comments` exactly as `gh pr view <pr> --json comments` returns them
 * (`[{ body }]`); a bare-string array is tolerated too. A comment is counted only when the marker is its
 * LEADING line (`trimStart().startsWith`, the same narrowing every sibling counter in this repo uses) AND its
 * author passes {@link isTrustedMarkerAuthor} — a forged marker from an untrusted login must never inflate this
 * population's attempt cap (the same authz rule every other durable marker reader in this file's sibling
 * modules already applies).
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of durable unowned-rebase-attempt comments on the PR (0 for a non-array / empty input)
 */
export function countUnownedRebaseAttempts(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(UNOWNED_REBASE_ATTEMPT_MARKER) && isTrustedMarkerAuthor(c)) n += 1;
  }
  return n;
}
