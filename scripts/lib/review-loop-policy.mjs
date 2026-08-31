/**
 * @file scripts/lib/review-loop-policy.mjs
 * @description THE CONCRETE UNATTENDED-CONFIRM POLICY for `review-pr` (#3072's remaining slice) — and the pure
 * decision for what an unattended run does when its own verdict would otherwise ACCEPT (#3072 / #3279).
 *
 * WHAT ALREADY EXISTED BEFORE THIS FILE, AND WHY IT WAS NOT ENOUGH. `driveRun`'s `autoConfirm` SEAM
 * (`we:scripts/operations/cli-adapter.mjs`, "#3072 third slice", landed 2026-08-12) is generic machinery: a
 * function of `(pending, run)` that MAY answer an AGENT-addressed confirm and MUST decline (return `null`) a
 * HUMAN-addressed one. Nothing shipped a CONCRETE policy — every caller, production and test, either supplied
 * none or a test-local stub built to prove the mechanism works (`we:scripts/operations/__tests__/review-pr.
 * test.mjs`'s `agentOnly`), and that stub answers `accept` unattended, which is exactly the case the operator's
 * 2026-08-31 ruling (below) forbids. This file is the first PRODUCTION policy, meant for a real loop driver
 * (`we:scripts/operations/review-loop-cli.mjs`) to pass to `driveRun`.
 *
 * THE ROUND CAP ITSELF NEEDED NO NEW CODE HERE. `deriveLoopOutcome` (`we:scripts/lib/jury-core.mjs`, "#3072
 * second slice", 2026-08-12) already computes `converged` / `in-progress` / `exhausted` / `escalated` per round
 * from the verdict ledger's own history (`read.priorRounds`), and `review-pr.mjs`'s `reduce` step already
 * stamps it onto `run.verdict.loop` on every run. A `stuck` fourth outcome was DESIGNED and then REFUSED on
 * evidence, in that same commit: the obvious detector (finding count stops shrinking) was tested against PR
 * #1164's real four-round history (3 → 1 → 1 → 1 findings) and would have killed the most productive review of
 * the week at round three. Telling thrashing from converging-slowly needs finding IDENTITY, which the ledger
 * does not record — a genuine input to a future observability spike, not something to approximate here. So
 * this file does not re-litigate that call; it reads `run.verdict.loop` as the settled fact it already is.
 *
 * THE RULING THIS FILE ENCODES, VERBATIM (operator, 2026-08-31, under epic #3383, consulted specifically on how
 * much unattended trust an AI review verdict gets): an AGENT actor may unattended-answer `confirm` with
 * `changes` or `abstain` — both are safe and reversible, a bounce just asks for more work, exactly like the
 * existing automated fix-loop already does unattended — but must NEVER unattended-answer `accept`. A verdict
 * that would otherwise accept is instead QUEUED for a human to clear on their own time, mirroring the
 * "gated, not blocking" shape `backlog/3421-*.md` / `backlog/3422-*.md` already ratified for a blocking
 * delivery hiccup: file it into the pool, do not stop the world, let a human clear it when they get to it.
 *
 * WHY THE QUEUE REUSES `learnings-drop.mjs` AS-IS RATHER THAN EXTENDING ITS SCHEMA. `#3421` (the general
 * "approval-pending flag on a learnings-pool entry" mechanism) is NOT YET BUILT — it is still an open story
 * with its own scope. This file does not pre-build it: `learnings-drop.mjs`'s schema is a deliberate, narrow
 * ALLOW-LIST (`kind` / `summary` / `area` / `suggestion`, see that file's own header on why — "if the schema
 * has no field for it, it can't leak"), and adding an ad hoc `approvalPending` field here would both jump
 * #3421's own scope and give the pool a second, un-ratified shape for the same idea. The actual GATE — the
 * property that nothing here ever mechanically records an accept — is enforced in CODE, by construction
 * (see {@link reviewLoopAutoConfirm}): the learnings entry this file files is the NOTIFICATION layer only, so
 * a human actually notices the parked run instead of having to poll run records for it. The gate does not
 * depend on the notification being read; the notification exists so it usually is, promptly.
 *
 * PURE THROUGHOUT. No fs, no clock, no process — `driveRun` calls {@link reviewLoopAutoConfirm} directly, and
 * `review-loop-cli.mjs` is the only place {@link buildAcceptQueueEntry}'s output is actually appended anywhere.
 */

import { CONFIRM_ACTORS, CONFIRM_OPTIONS } from '../operations/review-pr.mjs';
import { VERDICTS } from './jury-core.mjs';
import { FIELD_CAPS, KINDS } from '../conveyor/learnings-drop.mjs';

/**
 * THE ANSWER THIS POLICY MAY GIVE UNATTENDED, other than declining. `abstain` is deliberately NOT this policy's
 * choice even though the ruling permits it: `abstain` writes nothing (see `review-pr.mjs`'s `record` step), so
 * an unattended loop that abstained on every non-accept verdict would make no progress at all — indistinguishable
 * from a stop, except silent. `changes` is the one that lets the round-cap loop actually converge or exhaust,
 * which is the entire point of mechanizing it. The ruling's permission for `abstain` is exercised by a HUMAN
 * who reads a parked run and decides the review isn't worth recording either way — not by this policy.
 */
const UNATTENDED_ANSWER = CONFIRM_OPTIONS.includes('changes') ? 'changes' : (() => {
  throw new Error('review-loop-policy: `changes` is no longer one of review-pr\'s CONFIRM_OPTIONS — this policy has nothing safe to answer with');
})();

/**
 * THE POLICY. Matches `driveRun`'s `autoConfirm(pending, run)` contract exactly (`we:scripts/operations/
 * cli-adapter.mjs`): return `null` to decline (the run stays suspended, exactly as if no policy had been
 * supplied), or `{ value: <one of CONFIRM_OPTIONS> }` to answer.
 *
 * TWO REFUSALS, IN ORDER, EACH ENOUGH ON ITS OWN TO EXPLAIN THE WHOLE FUNCTION:
 *
 *   1. `pending.of !== CONFIRM_ACTORS.AGENT` → decline. A HUMAN-addressed confirm (`review:human`, gate-self)
 *      is precisely the case the step exists to stop for — see `review-pr.mjs`'s `of` derivation. This policy
 *      must not know better than that classification; it only ever activates on the tier the operation itself
 *      already decided is agent-answerable.
 *   2. `run.verdict.verdict === VERDICTS.ACCEPT` → decline, UNCONDITIONALLY, no matter how clean the review.
 *      This is the whole of the operator's 2026-08-31 ruling, and it is the one line in this file that must
 *      never change without a fresh ruling: an unattended agent actor may never be the one that lets a PR merge
 *      on its own recorded acceptance.
 *
 * EVERYTHING ELSE (`changes`, `prevention-outstanding`, any future verdict this fails open on) answers
 * `changes` — safe and reversible by construction, since `record`'s own reasonless-bounce guard only refuses a
 * `changes` answer when the juror(s) returned ZERO findings, and a non-accept verdict from `derivePanelVerdict`
 * implies at least one admitted finding drove it (see that guard in `review-pr.mjs`'s `record` step) — so this
 * policy never needs to compose a `--reason` of its own to satisfy it.
 *
 * @param {{of?: string}|null} pending - the run's `pending` record at an `awaiting-confirm` stop.
 * @param {{verdict?: {verdict?: string}}} run - the run so far; `run.verdict` is `reduce`'s full finding.
 * @returns {{value: string}|null}
 */
export function reviewLoopAutoConfirm(pending, run) {
  if (!pending || pending.of !== CONFIRM_ACTORS.AGENT) return null;
  if (run?.verdict?.verdict === VERDICTS.ACCEPT) return null;
  return { value: UNATTENDED_ANSWER };
}

/** Where a queued-accept entry is filed from, for a reader of the pool who has never heard of this operation. */
export const ACCEPT_QUEUE_AREA = 'review-loop unattended confirm (#3279)';

/**
 * THE RESUME COMMAND a human runs to actually clear a queued accept — printed inside the queue entry's
 * `suggestion` field AND by `review-loop-cli.mjs` at the moment it parks, so the two never say two different
 * things. PURE string composition; the command itself is exactly what `we:scripts/operations/run.mjs`'s own
 * header documents as the `--answer=accept` resume shape.
 *
 * @param {{runId: string, repo: string, pr: number|string}} o
 * @returns {string}
 */
export function acceptResumeCommand({ runId, repo, pr } = {}) {
  return `node scripts/operations/run.mjs review-pr --resume=${runId} --answer=accept`
    + ` # ${repo}#${pr} — clears it; --answer=changes bounces it instead`;
}

/**
 * BUILD the learnings-pool entry filed when an unattended, agent-addressed run parks on what would otherwise
 * be an ACCEPT. PURE — returns the entry object; {@link module:review-loop-cli} is the only impure caller,
 * via `learnings-drop.mjs#appendEntry`.
 *
 * SHAPED TO `learnings-drop.mjs`'s EXISTING, UNEXTENDED SCHEMA (see the file header for why): `kind: 'friction'`
 * — an unattended review being unable to act on its own clean verdict is exactly what that kind means elsewhere
 * in the pool (a place the mechanized loop had to stop and hand back to a person). `summary` and `suggestion`
 * are kept well under `FIELD_CAPS` (asserted by a test that pins this against the live caps, not a copy of the
 * numbers) so a long repo slug or a large run id can never overflow either field.
 *
 * @param {{repo: string, pr: number|string, runId: string}} o
 * @returns {{kind: string, summary: string, area: string, suggestion: string}}
 */
export function buildAcceptQueueEntry({ repo, pr, runId } = {}) {
  const subject = `${repo}#${pr}`;
  const entry = {
    kind: 'friction',
    summary: `${subject}'s independent review reduced to ACCEPT; an unattended agent never records that — `
      + 'a human needs to clear it.',
    area: ACCEPT_QUEUE_AREA,
    suggestion: acceptResumeCommand({ runId, repo, pr }),
  };
  // A DEFENSIVE ASSERTION, NOT A SILENT TRUNCATION. Cutting a resume command short to fit a cap would hand a
  // human a broken command instead of a working one — worse than refusing outright, which at least fails
  // loudly at the moment it happens rather than the moment someone pastes a truncated `--resume=` flag.
  for (const [field, cap] of Object.entries(FIELD_CAPS)) {
    if (entry[field].length > cap) {
      throw new Error(
        `review-loop-policy: the queued-accept entry's \`${field}\` is ${entry[field].length} chars, over the `
        + `pool's ${cap}-char cap — ${JSON.stringify(subject)} or the run id is unusually long. Refusing to `
        + 'truncate a value a human will act on; shorten the inputs or widen the cap deliberately.',
      );
    }
  }
  if (!KINDS.includes(entry.kind)) {
    throw new Error(`review-loop-policy: 'friction' is no longer one of learnings-drop's KINDS (${KINDS.join(', ')}) — pick a live one`);
  }
  return entry;
}

/**
 * IS THIS STOP THE "QUEUED FOR HUMAN ACCEPT" CASE? PURE — the one fact `review-loop-cli.mjs` needs to decide
 * whether to file {@link buildAcceptQueueEntry} and print the queued message, versus rendering a `driveRun`
 * outcome exactly as the ordinary CLI does.
 *
 * DELIBERATELY NOT a re-invocation of {@link reviewLoopAutoConfirm} — the policy already ran (it is what
 * produced this stop); this reads the SAME two facts the policy decided on, off the record the policy left
 * behind, so the two can never drift into disagreeing about why the run parked.
 *
 * @param {{stopped?: string, run?: {pending?: {of?: string}, verdict?: {verdict?: string}}}} outcome -
 *   a `driveRun` outcome.
 * @returns {boolean}
 */
export function isQueuedAcceptStop(outcome) {
  return outcome?.stopped === 'confirm'
    && outcome?.run?.pending?.of === CONFIRM_ACTORS.AGENT
    && outcome?.run?.verdict?.verdict === VERDICTS.ACCEPT;
}
