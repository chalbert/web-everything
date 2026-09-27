#!/usr/bin/env node
/**
 * @file scripts/conveyor/convert-advisory-dispatch.mjs
 * @description #xconv1 (chalbert/web-everything#2766/#2767 unblock, epic #3383/#4075) — the IO shell that turns
 *   one `we:scripts/conveyor/reconcile-core.mjs#planReconcile` `kind:'convert-advisory'` dispatch entry into its
 *   real effects, MECHANICALLY — no Claude wrapper session, mirroring `we:scripts/operations/review-job.mjs`'s
 *   own "nothing here needs judgment beyond one narrow question, so nothing here spawns a session" reasoning:
 *
 *   1. Post the CONVERTED advisory note (`we:scripts/lib/review-escalation.mjs#renderConvertedAdvisoryNote`) —
 *      a RENDER of the prior jury verdict + the escalation reason the planner already resolved. No new judging
 *      happens for the note's own body; it is the ORIGINAL verdict, quoted.
 *   2. Run the ONE targeted-check judge seat the escalation's own reason asks
 *      (`targetedCheckQuestion`) — a single TOOL-FREE `we:scripts/lib/judge-spawn.mjs#judgeSpawn` call. Passing
 *      no `allowedTools` means `assertLaneCwd` imposes NO lane requirement at all (see that function's own
 *      docblock: the lane isolation only protects against a TOOL-BEARING juror that could write into a shared
 *      tree — a tool-free juror cannot write anywhere, so the restriction does not apply). This is what makes
 *      running the whole arc directly inside the review daemon's own tick — no lane acquire, no spawned
 *      process, no background job — a faithful use of the existing primitive rather than a new bypass of it.
 *   3. Apply `advisory:accepted`/`advisory:changes` (`we:scripts/lib/advisory-labels.mjs#planAdvisoryLabels`,
 *      keyed off the targeted check's OWN verdict — the prior, already-quoted verdict was itself a clean
 *      accept by construction, see `planConvertSupersededVerdict`'s own docblock) and clear
 *      `review:awaiting-advisory` if still present — the SAME two label effects `review-pr.mjs`'s `advise` step
 *      applies, just driven mechanically instead of from inside that operation's step graph.
 *
 * IDEMPOTENT ACROSS TICKS, NOT JUST WITHIN ONE (#xconv1): `hasConvertedAdvisoryNote` checks the PR's own
 * comments for a note already covering this exact head before doing ANY work — a re-tick before the label
 * write lands (or before `review:awaiting-advisory` clears) never reposts or re-spawns the judge a second time.
 * No durable ledger of its own is needed: the comment IS the ledger, exactly like `reviewed-sha` is for a real
 * accept.
 *
 * PURE-CORE / IO-SHELL, mirroring `review-hold-reconcile.mjs`'s own split: {@link planConvertAdvisoryEffects} is
 * the pure decision (given the live labels/comments and the targeted check's answer, what to post/apply);
 * {@link dispatchConvertAdvisory} is the IO shell (the provider + the judge call), fully injectable so the
 * whole arc is unit-tested with fakes, no real `gh`/`claude` — same discipline `review-daemon.mjs`'s own header
 * states as this repo's standing rule for daemon effects. `dryRun` computes and returns the exact plan (comment
 * body, label diff, targeted-check answer) with NO `gh` write and, deliberately, no real judge spawn either
 * (an injectable `runJudge` fake stands in) — the shape the operator's own "show me what it would post, don't
 * post" proof needs.
 */
import { createGhProvider } from '../lib/review-label-provider.mjs';
import {
  hasConvertedAdvisoryNote, renderConvertedAdvisoryNote, targetedCheckQuestion,
  REVIEW_LABELS, hasReviewLabel,
} from '../lib/review-escalation.mjs';
import { planAdvisoryLabels } from '../lib/advisory-labels.mjs';
import { judgeSpawn } from '../lib/judge-spawn.mjs';

/** The forced JSON shape the targeted-check judge's answer must satisfy (#xconv1). One verdict, one citing
 *  note — never a re-derivation of `review-core.mjs`'s own multi-finding panel shape, because this is
 *  deliberately NOT a panel: one question, one answer. */
export const TARGETED_CHECK_SHAPE = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'note'],
  properties: {
    verdict: { enum: ['accept', 'changes'] },
    note: { type: 'string', minLength: 1 },
  },
});

/** Deliberately BELOW `judge-spawn.mjs`'s own panel-seat defaults (`DEFAULT_EFFORT`/`DEFAULT_BUDGET_USD`) —
 *  this is the "cheap" half of "ONE small targeted-check judge" the item asks for: one narrow question off
 *  material the planner already resolved (the escalation reason + the prior verdict), never a fresh diff read
 *  or a multi-lens panel. Tuning knobs, named here rather than inlined, for the same reason every other cap in
 *  this codebase is: a re-tune is one edit, never scattered. */
export const TARGETED_CHECK_EFFORT = 'low';
export const TARGETED_CHECK_BUDGET_USD = 0.5;

/** Pure: the mandate (system-prompt suffix) the targeted-check juror receives. Names the question, states the
 *  forced shape, and is explicit that this is NOT a re-review of the whole diff — a tool-free juror judging a
 *  narrow prompt drifting into "let me review everything" is exactly the failure a narrow mandate forecloses. */
export function buildTargetedCheckMandate(escalation) {
  return [
    'You are a narrow, single-question judge (#xconv1). A PR already carries a completed jury verdict that',
    'ACCEPTED it; that verdict was superseded by a later escalation, not by any defect the panel found. You are',
    'NOT re-reviewing the whole diff — only answering the ONE question below, from the material you are given.',
    '',
    targetedCheckQuestion(escalation),
    '',
    'Answer ONLY the forced JSON shape: `verdict` (`accept` or `changes`) and `note` (one or two sentences,',
    'citing the specific evidence named in the escalation reason). Do not ask for more material — decide from',
    'what you are given, and say so in `note` if the material is genuinely insufficient (that is a `changes`',
    'answer, not a request for more input).',
  ].join('\n');
}

/** Pure: the judged material (stdin) — the escalation's own reason plus the prior (superseded) verdict, quoted
 *  verbatim. Deliberately NOT a fresh diff fetch: the escalation reason already names the specific evidence
 *  (e.g. the removed test file(s)), and re-fetching the diff here would make this the very panel re-run
 *  #xconv1 exists to avoid. */
export function buildTargetedCheckInput({ acceptComment, escalation } = {}) {
  return [
    '## Escalation reason', '',
    escalation?.reasonText ?? '', '',
    '## Prior jury verdict (accepted, now superseded by the escalation above — quoted, not re-run)', '',
    acceptComment?.body ?? '',
  ].join('\n');
}

/**
 * Run the ONE targeted-check judge seat. Thin wrapper over `judgeSpawn` — injectable as `judge` so a caller (or
 * a test) substitutes a fake with no subprocess at all. Returns `{verdict, note}`, always one of the two
 * allowed verdicts (`judgeSpawn`'s forced shape already guarantees this; the `=== 'changes'` narrowing is
 * belt-and-braces against a malformed injected fake, never a real disagreement with the CLI's own validation).
 * @param {{acceptComment?: object, escalation?: object, runId?: string, judge?: Function}} o
 * @returns {Promise<{verdict: ('accept'|'changes'), note: string}>}
 */
export async function runTargetedCheck({
  acceptComment, escalation, runId, judge = judgeSpawn,
} = {}) {
  const result = await judge({
    mandate: buildTargetedCheckMandate(escalation),
    input: buildTargetedCheckInput({ acceptComment, escalation }),
    shape: TARGETED_CHECK_SHAPE,
    effort: TARGETED_CHECK_EFFORT,
    budget: TARGETED_CHECK_BUDGET_USD,
    runId,
    lens: 'xconv1-targeted-check',
  });
  const verdict = result?.value?.verdict === 'changes' ? 'changes' : 'accept';
  const note = typeof result?.value?.note === 'string' ? result.value.note : '';
  return { verdict, note };
}

/**
 * PURE: given the live labels + the targeted check's answer, what to post/apply. Never reads `gh`, never calls
 * the judge — a test asserts this against every label combination with no IO at all.
 * @param {{prNumber: number, repo: string, headSha: string, acceptComment: object, escalation: object,
 *   targetedCheckAnswer: {verdict: string, note: string}, currentLabels: Array}} o
 * @returns {{body: string, addLabel: (string|null), removeLabels: string[]}}
 */
export function planConvertAdvisoryEffects({
  prNumber, repo, headSha, acceptComment, escalation, targetedCheckAnswer, currentLabels = [],
} = {}) {
  const body = renderConvertedAdvisoryNote({
    repo, pr: prNumber, headSha, acceptComment, escalation, targetedCheckAnswer,
  });
  const labelPlan = planAdvisoryLabels({ outcome: targetedCheckAnswer.verdict, currentLabels });
  const removeLabels = [...labelPlan.remove];
  if (hasReviewLabel(currentLabels, REVIEW_LABELS.awaitingAdvisory)
    && !removeLabels.includes(REVIEW_LABELS.awaitingAdvisory)) {
    removeLabels.push(REVIEW_LABELS.awaitingAdvisory);
  }
  return { body, addLabel: labelPlan.add, removeLabels };
}

/**
 * THE IO SHELL: convert ONE `kind:'convert-advisory'` dispatch entry (as `we:scripts/conveyor/
 * reconcile-core.mjs#planReconcile` produces it — carries `prNumber`, `headSha`, `acceptComment`, `escalation`)
 * into its real effects. `dryRun` computes the SAME plan (via an injected fake judge, never a real spawn) with
 * no `gh` write at all — the exact shape a "show me what it would post, don't post" proof needs.
 *
 * IDEMPOTENT: a head that already carries the converted note (`hasConvertedAdvisoryNote`) is a no-op, checked
 * BEFORE the judge is ever called — a re-tick before the label write lands never re-spawns the judge either.
 * @param {{prNumber: number, headSha: string, acceptComment: object, escalation: object}} d - one
 *   `plan.dispatch` entry with `kind:'convert-advisory'`.
 * @param {{repo: string, provider?: object, runJudge?: Function, dryRun?: boolean,
 *   comments?: (Array|null), labels?: (Array|null)}} o
 * @returns {Promise<object>}
 */
export async function dispatchConvertAdvisory(d, {
  repo, provider = createGhProvider(), runJudge = runTargetedCheck, dryRun = false,
  comments = null, labels = null,
} = {}) {
  const prNumber = Number(d?.prNumber);
  // A caller that already read this tick's PR state (the daemon's own #4133 shared-read) hands it in; only a
  // caller with neither fetches fresh — mirrors `review-hold-reconcile.mjs`'s own lazy-fetch discipline.
  let state = null;
  if (comments == null || labels == null) state = provider.readPrState(repo, prNumber);
  const liveComments = comments ?? state?.comments ?? [];
  const liveLabels = labels ?? state?.labels ?? [];

  if (hasConvertedAdvisoryNote(liveComments, d?.headSha)) {
    return { prNumber, headSha: d?.headSha, skipped: 'already-converted' };
  }

  const targetedCheckAnswer = await runJudge({
    acceptComment: d?.acceptComment, escalation: d?.escalation, runId: `convert-advisory-${prNumber}`,
  });
  const plan = planConvertAdvisoryEffects({
    prNumber, repo, headSha: d?.headSha, acceptComment: d?.acceptComment, escalation: d?.escalation,
    targetedCheckAnswer, currentLabels: liveLabels,
  });

  if (dryRun) return { prNumber, headSha: d?.headSha, ...plan, targetedCheckAnswer, dryRun: true };

  // COMMENT FIRST (mirrors `review-label-provider.mjs#writeOrder`'s "not already accepted" branch — an orphan
  // comment is inert; an orphan label swap ahead of it is not, since `hasConvertedAdvisoryNote` itself reads
  // the comment back on the next tick and a label with no note behind it would silently look "handled").
  provider.postComment(repo, prNumber, plan.body);
  if (plan.addLabel || plan.removeLabels.length) {
    provider.setLabels(repo, prNumber, { add: plan.addLabel || undefined, remove: plan.removeLabels });
  }
  return { prNumber, headSha: d?.headSha, ...plan, targetedCheckAnswer, posted: true };
}
