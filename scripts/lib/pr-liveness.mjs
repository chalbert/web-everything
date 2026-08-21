/**
 * @file scripts/lib/pr-liveness.mjs
 * @description IS THIS PR STILL A THING A REVIEW CAN ACT ON? (#xwp8ioh) — the single home (#2644) for the
 *   "inert verdict" predicate that `we:scripts/review-set-label.mjs` has enforced since #2953.
 *
 * THE PREDICATE WAS NEVER THE PROBLEM; ITS POSITION WAS. #2953 put it at the WRITE side, where it works
 * exactly as designed: a verdict aimed at a merged or closed PR fails closed instead of reporting
 * `{"ok":true}` for a label swap nobody will ever read. What it could not do from there is stop the *cost*.
 * `we:scripts/operations/review-pr.mjs` never asked for the PR's state at all — `PR_VIEW_FIELDS` did not
 * carry `state` — so a review of a merged PR ran the full `judge` step, paid a juror, produced findings, and
 * only discovered the PR was inert when CI refused to apply the result.
 *
 * Measured, 2026-08-20: PR #1503 merged at 22:17. Three correctness rounds ran against it afterwards at
 * 22:37, 23:15 and 00:13, each finding a real defect, each fix pushed to a branch whose PR was closed. Cost:
 * ~$4 of juror time, five orphaned commits, and a verdict staged against a merged PR that the #2953 guard
 * then correctly refused. Every one of those refusals was right and every one of them was too late.
 *
 * So this file does NOT introduce a new rule. It gives the existing rule one definition, so the read side and
 * the write side cannot drift into two answers to one question — the failure #2644 exists to prevent, and the
 * one `we:scripts/operations/verify.mjs` calls out in its own header for the same reason.
 *
 * PURE. No `gh`, no fs, no clock. The caller supplies the state string it already read; neither call site
 * spends an extra hop for this (both ride a `gh pr view` they were making anyway — the "one more json field,
 * no extra hop" pattern #2953 and #2844 both used).
 */

/**
 * The only PR state a review verdict can act on. A closed-but-unmerged PR is just as inert as a merged one:
 * nothing downstream reads a label on either, so both refuse.
 */
export const REVIEWABLE_PR_STATE = 'OPEN';

/**
 * Classify a PR's state for reviewability. THREE-VALUED, and the third value is the point.
 *
 * `unknown` is NOT folded into `reviewable`, and it is NOT folded into `inert` either. A state string that is
 * empty or unrecognised means the read did not answer the question — which is a different fact from "the PR
 * is merged", and the caller may reasonably treat it differently (a `review-pr` read can refuse and ask the
 * caller to retry; a write-side guard that already holds a credential may prefer to fail closed). Collapsing
 * it either way is how "absence of evidence" becomes "evidence", the shape `verify`'s `unrun` outcome and
 * #3203's killed-vs-crashed juror both exist to keep apart.
 *
 * @param {{state?: string}} view - anything carrying a `state` field, e.g. a parsed `gh pr view --json state`.
 * @returns {{outcome: 'reviewable'|'inert'|'unknown', state: string}}
 */
export function classifyPrLiveness({ state } = {}) {
  const raw = typeof state === 'string' ? state.trim().toUpperCase() : '';
  if (!raw) return { outcome: 'unknown', state: '' };
  if (raw === REVIEWABLE_PR_STATE) return { outcome: 'reviewable', state: raw };
  // MERGED / CLOSED, and anything else a host might report. Deliberately NOT an allow-list of inert states:
  // a state this file has never heard of is still not `OPEN`, and treating it as reviewable would be the
  // permissive default the whole predicate exists to refuse.
  return { outcome: 'inert', state: raw };
}

/**
 * The refusal sentence, worded ONCE. Both call sites emit this same text through their own error channel
 * (`fail()`'s `{"error":…}` JSON on the write side, a thrown `Error` on the read side), so an operator who
 * has seen one recognises the other.
 *
 * It names the remedy, not just the problem: the findings belong on a NEW PR. That clause is load-bearing —
 * the failure mode it prevents is an agent "fixing" the finding and pushing it to the merged PR's branch,
 * which is precisely what happened before this predicate moved forward.
 *
 * @param {{pr: number|string, state: string, phase?: 'read'|'write'}} o
 * @returns {string}
 */
export function inertPrMessage({ pr, state, phase = 'write' } = {}) {
  const base = `PR ${pr} is ${state || 'in an unreadable state'}, not ${REVIEWABLE_PR_STATE} — a review `
    + 'verdict here would be inert (the merge, if any, already happened); open a new PR for the findings '
    + 'instead of relabeling this one';
  // The read-side refusal adds WHY IT IS REFUSING EARLY, because the whole point of the forward position is
  // that nothing has been spent yet and the operator should understand that this is the cheap refusal.
  return phase === 'read'
    ? `${base}. Refusing BEFORE the \`judge\` step, so no juror is paid for a verdict that cannot be applied.`
    : base;
}
