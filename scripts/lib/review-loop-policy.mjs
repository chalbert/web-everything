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
 * THE 2026-08-31 RULING THIS FILE USED TO ENCODE, VERBATIM, NOW SUPERSEDED (operator, 2026-09-01, `#3434` /
 * `backlog/xpfuj64-*.md`, "I want the acceptance to be mechanical from the verdict" — found live: two real
 * PRs, `#1764` and `#1765`, both reduced to a clean `accept` during this same epic's own live-fire test and
 * sat queued for a human for no reason other than this policy's old refusal). The ORIGINAL ruling (2026-08-31)
 * said an AGENT actor may unattended-answer `changes` or `abstain` but must NEVER unattended-answer `accept`.
 * `#3434` REVERSES that specifically for the AGENT-addressed (`review:pending`) tier: a genuinely independent
 * `accept` now answers unattended, exactly like `changes` already did — a clean, independent verdict IS the
 * clearance. `review:human` is UNCHANGED and UNTOUCHED by this reversal: it never reaches the accept branch
 * below at all, because refusal 1 (the actor check) declines it first, same as always — that tier's own
 * human-only ceremony (`--to=clear-human`) is exactly what `#3434` confirmed should stay in place.
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
import { VERDICTS, hasUncapturedPrevention } from './jury-core.mjs';
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
 * ONE REFUSAL, THEN TWO ANSWERS:
 *
 *   1. `pending.of !== CONFIRM_ACTORS.AGENT` → decline. A HUMAN-addressed confirm (`review:human`, gate-self)
 *      is precisely the case the step exists to stop for — see `review-pr.mjs`'s `of` derivation. This policy
 *      must not know better than that classification; it only ever activates on the tier the operation itself
 *      already decided is agent-answerable. UNCHANGED by `#3434` — `review:human` never reaches the branches
 *      below at all; its own human-only ceremony (`--to=clear-human`) is exactly what `#3434` confirmed stays.
 *   2. `run.verdict.verdict === VERDICTS.ACCEPT` → answer `accept`. A genuinely independent, clean verdict on
 *      the AGENT-addressed (`review:pending`) tier IS the clearance — `#3434` (2026-09-01) reversed the prior
 *      2026-08-31 ruling that declined here unconditionally, found live-fire against two real PRs (`#1764`,
 *      `#1765`) both queued for no reason other than this line.
 *
 *   3. `run.verdict.verdict === VERDICTS.PREVENTION_OUTSTANDING` → answer `accept` (#3442, `#3434`'s SECOND
 *      ratified item, finished here — the first item's own docblock used to call this DEFERRED). Every actual
 *      finding is already resolved by definition of this verdict (`deriveVerdict`/`derivePanelVerdict` only
 *      reach it once no finding still blocks) — the sole remaining debt is a named prevention guard nobody
 *      filed. Nothing about the CODE is wrong, so re-entering the bounce/retry loop over documentation debt the
 *      code itself doesn't have would spend a round fixing nothing (the exact thing `#1765`/`#1764` did,
 *      repeatedly, the night this decision was made). This function stays PURE — it does not file the guard(s)
 *      itself; the impure caller does that off the SAME `run.verdict.findings` this branch answered from, one
 *      {@link buildPreventionQueueEntry} per outstanding guard, once {@link isPreventionOutstandingClear} says
 *      so, mirroring {@link buildAcceptQueueEntry}'s file-then-notify shape exactly as `#3434` asked.
 *
 * EVERYTHING ELSE (`changes`, `needs-human` reaching here at all, any future verdict this fails open on)
 * answers `changes` — safe and reversible by construction, since `record`'s own reasonless-bounce guard only
 * refuses a `changes` answer when the juror(s) returned ZERO findings, and a non-accept, non-prevention verdict
 * from `derivePanelVerdict` implies at least one admitted finding drove it (see that guard in `review-pr.mjs`'s
 * `record` step) — so this policy never needs to compose a `--reason` of its own to satisfy it.
 *
 * @verdicts-partial `changes` and `needs-human` are never referenced by name: BOTH intentionally fall through
 * to the SAME `UNATTENDED_ANSWER` branch above (undeclared-verdict fail-safe included) rather than earning
 * their own `=== VERDICTS.X` line — `needs-human` cannot reach this function's body at all in practice (refusal
 * 1 always declines a HUMAN-addressed confirm first), so writing a branch for it would assert a case this
 * policy structurally never sees. Only `accept` and `prevention-outstanding` are the REVIEWED, RATIFIED
 * branches this file's own canary test (`review-loop-policy.test.mjs`) pins to exactly these two.
 *
 * @param {{of?: string}|null} pending - the run's `pending` record at an `awaiting-confirm` stop.
 * @param {{verdict?: {verdict?: string}}} run - the run so far; `run.verdict` is `reduce`'s full finding.
 * @returns {{value: string}|null}
 */
export function reviewLoopAutoConfirm(pending, run) {
  if (!pending || pending.of !== CONFIRM_ACTORS.AGENT) return null;
  if (run?.verdict?.verdict === VERDICTS.ACCEPT) return { value: 'accept' };
  if (run?.verdict?.verdict === VERDICTS.PREVENTION_OUTSTANDING) return { value: 'accept' };
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

/** Where a filed-prevention entry is filed from, for a reader of the pool who has never heard of this operation. */
export const PREVENTION_QUEUE_AREA = 'review-loop prevention-outstanding auto-accept (#3442)';

/**
 * BUILD ONE learnings-pool entry for ONE outstanding prevention guard. PURE — mirrors {@link buildAcceptQueueEntry}
 * field-for-field (same defensive cap assertions, same "refuse rather than truncate" posture), one finding at a
 * time rather than one entry per run: a `prevention-outstanding` verdict can carry several named guards at once
 * (`derivePanelVerdict` does not cap it at one), and folding them all into a single `summary`/`suggestion` would
 * risk exactly the overflow this file already refuses to silently truncate — one entry per guard keeps each
 * comfortably inside `FIELD_CAPS` on its own.
 *
 * @param {{repo: string, pr: number|string, runId: string, finding: {prevention?: string}}} o
 * @returns {{kind: string, summary: string, area: string, suggestion: string}}
 */
export function buildPreventionQueueEntry({ repo, pr, runId, finding } = {}) {
  const subject = `${repo}#${pr}`;
  const entry = {
    kind: 'improvement',
    summary: `${subject}'s independent review reduced to PREVENTION-OUTSTANDING and auto-cleared to accept — `
      + 'a named prevention guard was never filed as its own backlog item.',
    area: PREVENTION_QUEUE_AREA,
    suggestion: `File as a backlog item (run ${runId}): ${finding?.prevention ?? '(no guard text recorded)'}`,
  };
  // SAME DEFENSIVE ASSERTION AS buildAcceptQueueEntry, AND FOR THE SAME REASON — a human acts on this field;
  // silently cutting a guard's own text short would hand them a broken lead instead of a working one.
  for (const [field, cap] of Object.entries(FIELD_CAPS)) {
    if (entry[field].length > cap) {
      throw new Error(
        `review-loop-policy: the filed-prevention entry's \`${field}\` is ${entry[field].length} chars, over `
        + `the pool's ${cap}-char cap — ${JSON.stringify(subject)}, the run id, or the guard text is unusually `
        + 'long. Refusing to truncate a value a human will act on; shorten the inputs or widen the cap deliberately.',
      );
    }
  }
  if (!KINDS.includes(entry.kind)) {
    throw new Error(`review-loop-policy: 'improvement' is no longer one of learnings-drop's KINDS (${KINDS.join(', ')}) — pick a live one`);
  }
  return entry;
}

/**
 * IS THIS OUTCOME THE "PREVENTION-OUTSTANDING AUTO-CLEARED TO ACCEPT" CASE? PURE — the one fact
 * `review-loop-cli.mjs` needs to decide whether to file one {@link buildPreventionQueueEntry} per outstanding
 * guard, mirroring {@link isQueuedAcceptStop}'s role for the OTHER file-then-notify branch. (The caller does
 * its OWN `findings.filter(hasUncapturedPrevention)` to get the list to file — kept there, not wrapped in a
 * `buildPreventionQueueEntries` batch helper here, so a single oversized guard's `buildPreventionQueueEntry`
 * throw can be caught PER FINDING and never blocks filing the others in the same run; see the caller.)
 *
 * DELIBERATELY A DIFFERENT SHAPE FROM `isQueuedAcceptStop`: that predicate matches a STOP (the policy declined,
 * the run is still parked at `confirm`). This one matches the OPPOSITE — the policy ANSWERED `accept` for this
 * verdict (see {@link reviewLoopAutoConfirm}), so the run already advanced past `confirm` and `pending` is
 * cleared. `outcome.stopped !== 'confirm'` is the guard that keeps this `false` for a `review:human` PR
 * carrying the same verdict — refusal 1 in `reviewLoopAutoConfirm` declines it unconditionally, so THAT run is
 * still sitting at `confirm` with nothing to file yet.
 *
 * `hasUncapturedPrevention` (`we:scripts/lib/jury-core.mjs`, #2823) is the WIDE "notice" predicate — NOT the
 * same one `deriveVerdict` gates the verdict itself on (`blocksAcceptance`, that same file, narrows it further
 * by `impactIfUnfixed` against `PREVENTION_IMPACT_BAR`). Using the wide predicate here is deliberate, matching
 * `renderPreventionSummary`'s own convention (see that file's "notice-wide / verdict-narrow split"): a finding
 * whose guard is real but sits BELOW the bar still gets filed, even though it did not by itself drive this run
 * to `PREVENTION_OUTSTANDING` — the debt exists either way, and this only ever runs once at least one OTHER
 * finding already crossed the bar and produced this verdict in the first place.
 *
 * A KNOWN, ACCEPTED GAP (review, finding 2, deliberately not closed here): this reads the run's TERMINAL
 * state, not "did the confirm step answer THIS call" — so a stale re-`--resume=<id>` of an already-COMPLETE
 * `prevention-outstanding` run (an operator/automation checking status, a retried dispatch) re-satisfies this
 * predicate every time and re-files duplicate learnings-pool entries. `driveRun` short-circuits to `stopped:
 * 'complete'` at TURN ZERO for an already-finished run (`we:scripts/operations/cli-adapter.mjs`), so nothing
 * here can tell "just answered" from "answered a while ago" without a durable per-run "already filed" marker
 * this size-scoped item does not add. This is the SAME shape `isQueuedAcceptStop`'s permanently-parked
 * `confirm` state already has (a repeated status check there re-files too) — not a new class of risk, only a
 * wider surface, since `complete` is far cheaper to re-hit than a park. A cheap-looking fix (require
 * `outcome.applied.length > 0`, i.e. "this call itself did the work") was considered and rejected: a run that
 * resumes past an `effect-in-flight` halt whose effect later resolved via `wake.mjs` (out of process) can
 * legitimately reach `complete` with an EMPTY `applied` on the call that observes it — that guard would silently
 * DROP a real, first-time filing, which is worse than an occasional duplicate. Left as a follow-up rather than
 * guessed at here.
 *
 * FIXED (independent review of PR #1784, CONFIRMED): this predicate used to read `outcome?.stopped !==
 * 'confirm'`, which does not mean "this run actually succeeded" — it means "this run stopped anywhere other
 * than the human-park stop", and `driveRun` (`we:scripts/operations/cli-adapter.mjs`) has several OTHER
 * terminal stops that are failures, not successes: `'effect-halted'` (an effect — e.g. the accept label swap —
 * threw), `'step-refused'` (a declaration fn refused deterministically) and `'stuck'` (the run made no
 * progress). A `prevention-outstanding` verdict can still be sitting on `run.verdict` when any of those fires
 * (the verdict is computed at `reduce`, upstream of `confirm`/the effect apply this predicate is meant to gate
 * on), so the old check would call a HALTED or REFUSED run "clear" and the caller below would file the
 * prevention guard(s) and report success for a PR whose accept never actually landed. The only two terminal
 * stops that legitimately mean "the accept went through" are named two paragraphs up: `'complete'` and
 * `'effect-in-flight'` (a dispatched effect that will resolve later, out of process — still a SUCCESSFUL stop,
 * per `driveRun`'s own comment on that branch). Narrowed to exactly those two, matching the success set
 * `renderOutcome`'s own JSON-code branch uses (`stopped === 'complete' || stopped === 'confirm' || stopped ===
 * 'effect-in-flight'`) minus `'confirm'`, which is excluded here on purpose — that stop means the run is still
 * PARKED (only reachable for a `review:human` PR, since refusal 1 in `reviewLoopAutoConfirm` declines those
 * unconditionally), not cleared.
 *
 * @param {{stopped?: string, run?: {pending?: object, verdict?: {verdict?: string, findings?: Array<object>}}}} outcome
 * @returns {boolean}
 */
export function isPreventionOutstandingClear(outcome) {
  return (outcome?.stopped === 'complete' || outcome?.stopped === 'effect-in-flight')
    && outcome?.run?.verdict?.verdict === VERDICTS.PREVENTION_OUTSTANDING
    && Array.isArray(outcome?.run?.verdict?.findings)
    && outcome.run.verdict.findings.some(hasUncapturedPrevention);
}
