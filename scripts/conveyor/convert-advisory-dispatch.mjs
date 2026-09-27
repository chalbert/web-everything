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
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createGhProvider } from '../lib/review-label-provider.mjs';
import {
  hasConvertedAdvisoryNote, renderConvertedAdvisoryNote, targetedCheckQuestion,
  REVIEW_LABELS, hasReviewLabel, extractTestGamingPaths, narrowTargetedCheckOutcome,
  planConvertSupersededVerdict,
} from '../lib/review-escalation.mjs';
import { planAdvisoryLabels } from '../lib/advisory-labels.mjs';
import { judgeSpawn } from '../lib/judge-spawn.mjs';
import { resolveNetDiffBasis } from '../merge-ai-prs.mjs';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The forced JSON shape the targeted-check judge's answer must satisfy (#xconv1). One verdict, one citing
 *  note — never a re-derivation of `review-core.mjs`'s own multi-finding panel shape, because this is
 *  deliberately NOT a panel: one question, one answer.
 *
 *  #xconv1-evidence (chalbert/web-everything#2766/#2767 misfire) — `inconclusive` was added as a THIRD allowed
 *  verdict alongside `accept`/`changes`: the judge must be able to say "I cannot decide this from what I was
 *  given" without that reading as either a clean clearance or a manufactured finding. See
 *  `we:scripts/lib/review-escalation.mjs#TARGETED_CHECK_OUTCOMES` for why `inconclusive` deliberately maps to
 *  NO `advisory:*` label at all. */
export const TARGETED_CHECK_SHAPE = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'note'],
  properties: {
    verdict: { enum: ['accept', 'changes', 'inconclusive'] },
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
 *  narrow prompt drifting into "let me review everything" is exactly the failure a narrow mandate forecloses.
 *
 *  #xconv1-evidence — the OLD text here told the judge that insufficient material is itself a `changes`
 *  answer ("say so in `note` ... that is a `changes` answer, not a request for more input"). That is what the
 *  live #2766/#2767 misfire actually did: the judge was given no diff at all, correctly said so in its note,
 *  and then — per this exact instruction — answered `changes` anyway, which read as a genuine finding and
 *  burned three advisory-fix rounds on a defect that never existed. The corrected instruction below is the
 *  opposite: insufficient material is `inconclusive`, never a guess in either direction. */
export function buildTargetedCheckMandate(escalation) {
  return [
    'You are a narrow, single-question judge (#xconv1). A PR already carries a completed jury verdict that',
    'ACCEPTED it; that verdict was superseded by a later escalation, not by any defect the panel found. You are',
    'NOT re-reviewing the whole diff — only answering the ONE question below, from the material you are given.',
    '',
    targetedCheckQuestion(escalation),
    '',
    'Answer ONLY the forced JSON shape: `verdict` (`accept`, `changes`, or `inconclusive`) and `note` (one or',
    'two sentences, citing the specific evidence you were given). Decide from what you are given — do not ask',
    'for more material. If you ARE given the actual diff for the file(s) the escalation reason names, decide',
    '`accept` or `changes` from it. If you are NOT given that diff (the material below says so explicitly),',
    'you MUST answer `inconclusive` — say so plainly in `note`. Never answer `changes` or `accept` as a stand-in',
    'for "I could not verify this."',
  ].join('\n');
}

/** Pure: the judged material (stdin) — the escalation's own reason, the named file(s)' OWN net diff when it
 *  could be fetched (#xconv1-evidence — never the whole-PR diff, only the file(s) the escalation itself names,
 *  which keeps this a narrow targeted check rather than the panel re-run #xconv1 exists to avoid), and the
 *  prior (superseded) verdict, quoted verbatim. `evidence` is the diff TEXT (or `''`/omitted when none could be
 *  fetched) — the caller ({@link resolveTargetedCheckEvidence}) decides fetchability; this function only renders
 *  whatever it is handed, so it stays a pure string-builder with no IO of its own. */
export function buildTargetedCheckInput({ acceptComment, escalation, evidence } = {}) {
  const sections = ['## Escalation reason', '', escalation?.reasonText ?? '', ''];
  if (typeof evidence === 'string' && evidence.trim().length > 0) {
    sections.push(
      "## Net diff of the file(s) the escalation reason names (this PR's own base...head diff, those files only)",
      '', '```diff', evidence, '```', '',
    );
  } else if (escalation && escalation.kind === 'test-gaming') {
    sections.push(
      '## Diff evidence', '',
      'No diff could be fetched for the file(s) the escalation reason names in this run. You do NOT have the',
      'actual diff — answer `inconclusive`, not `changes` or `accept`, and say so in `note`.', '',
    );
  }
  sections.push(
    '## Prior jury verdict (accepted, now superseded by the escalation above — quoted, not re-run)', '',
    acceptComment?.body ?? '',
  );
  return sections.join('\n');
}

/**
 * #xconv1-evidence — IO: fetch the NET diff (base...head, `we:scripts/merge-ai-prs.mjs#resolveNetDiffBasis`'s
 * same fork-point basis) of ONLY the file(s) named, never the whole PR. Pure given an injected `exec`
 * (`(cmd, args, opts) => string`, default the real `execFileSync`) — a test fakes `exec` and asserts the exact
 * argv, the same discipline `computeNetDiffText`/`computeNetDiffPaths` (`merge-ai-prs.mjs`) already use.
 * `scored:false` (with `text:''`) on ANY failure — an unresolvable basis, a failed `git diff`, no paths given —
 * so a caller never mistakes "could not fetch" for "the file has no changes".
 * @param {{exec?:Function, remote?:string, base?:string, rev:string, paths:string[]}} o
 * @returns {{text:string, scored:boolean, reason?:string}}
 */
export function fetchTestGamingDiffEvidence({
  exec = execFileSync, remote = 'origin', base = 'main', rev, paths = [],
} = {}) {
  if (typeof exec !== 'function' || !rev || !Array.isArray(paths) || paths.length === 0) {
    return { text: '', scored: false, reason: 'no-paths' };
  }
  const basis = resolveNetDiffBasis({ exec, remote, base, rev });
  if (!basis.ok) return { text: '', scored: false, reason: basis.reason };
  try {
    const text = String(exec('git', [
      'diff', '--no-ext-diff', '--end-of-options', basis.diffBase, basis.candidate, '--', ...paths,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '');
    return { text, scored: true, base: basis.diffBase, rev: basis.candidate };
  } catch {
    return { text: '', scored: false, reason: 'diff-failed' };
  }
}

/**
 * #xconv1-evidence — PURE ORCHESTRATION (given an injected `fetchEvidence`): does this escalation NEED diff
 * evidence, and if so, could it be fetched? Only `kind:'test-gaming'` requires it (manifest-tamper names the
 * exact field to re-check, and heal-mutual-exclusivity is a comment-history question — neither needs a diff
 * fetch; #xconv1's own original design reasoning still holds for those two). Returns
 * `{required, available, text, note}` — `required && !available` is the ONE shape that must force `inconclusive`
 * (see {@link dispatchConvertAdvisory}), never a judge guess.
 * @param {{escalation?: object, headSha?: string, fetchEvidence?: Function}} o
 * @returns {Promise<{required: boolean, available: boolean, text: string, note?: string}>}
 */
export async function resolveTargetedCheckEvidence({ escalation, headSha, fetchEvidence = fetchTestGamingDiffEvidence } = {}) {
  if (!escalation || escalation.kind !== 'test-gaming') return { required: false, available: false, text: '' };
  const paths = extractTestGamingPaths(escalation.reasonText);
  if (paths.length === 0) {
    return {
      required: true, available: false, text: '',
      note: 'no test file path could be parsed from the escalation reason',
    };
  }
  const result = await fetchEvidence({ rev: headSha, paths });
  const available = !!(result && result.scored && typeof result.text === 'string' && result.text.trim().length > 0);
  return {
    required: true, available, text: available ? result.text : '',
    note: available ? undefined
      : `no diff evidence could be fetched for ${paths.join(', ')} (${result?.reason || 'no-diff'})`,
  };
}

/**
 * Run the ONE targeted-check judge seat. Thin wrapper over `judgeSpawn` — injectable as `judge` so a caller (or
 * a test) substitutes a fake with no subprocess at all. Returns `{verdict, note}`, one of the three allowed
 * verdicts (`judgeSpawn`'s forced shape already guarantees this; {@link narrowTargetedCheckOutcome} is
 * belt-and-braces against a malformed injected fake, never a real disagreement with the CLI's own validation —
 * #xconv1-evidence: this used to collapse EVERY non-`changes` value, including a genuine `inconclusive`, into
 * `accept`; it now preserves all three).
 * @param {{acceptComment?: object, escalation?: object, runId?: string, evidence?: string, judge?: Function}} o
 * @returns {Promise<{verdict: ('accept'|'changes'|'inconclusive'), note: string}>}
 */
export async function runTargetedCheck({
  acceptComment, escalation, runId, evidence, judge = judgeSpawn,
} = {}) {
  const result = await judge({
    mandate: buildTargetedCheckMandate(escalation),
    input: buildTargetedCheckInput({ acceptComment, escalation, evidence }),
    shape: TARGETED_CHECK_SHAPE,
    effort: TARGETED_CHECK_EFFORT,
    budget: TARGETED_CHECK_BUDGET_USD,
    runId,
    lens: 'xconv1-targeted-check',
  });
  const verdict = narrowTargetedCheckOutcome(result?.value?.verdict);
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
 * `force` (default `false`, never set by a production tick) bypasses that idempotency check for exactly one
 * call — #xconv1-evidence's own repair mechanism: an operator (or a one-off script) explicitly re-running this
 * for a PR whose EXISTING converted note was produced with no diff evidence (this file's pre-fix behaviour),
 * to get a corrected note posted through the SAME mechanism rather than by hand-editing the thread.
 *
 * #xconv1-evidence — EVIDENCE GATE, ahead of the judge call: for a `kind:'test-gaming'` escalation,
 * {@link resolveTargetedCheckEvidence} decides whether the named file(s)' own diff could be fetched. When it is
 * REQUIRED and NOT available, this function never spends a judge call on a question it already knows cannot be
 * answered — it deterministically records `{verdict:'inconclusive', note}` itself (an `inconclusive` outcome
 * applies NO `advisory:*` label, `we:scripts/lib/advisory-labels.mjs#labelForOutcome` returning `null` for it —
 * so this can never manufacture the `advisory:changes` that burned three advisory-fix rounds on #2766/#2767 for
 * a defect that never existed). `fetchEvidence` is injectable (default {@link fetchTestGamingDiffEvidence}, real
 * `git` IO) so a test never shells out.
 * @param {{prNumber: number, headSha: string, acceptComment: object, escalation: object}} d - one
 *   `plan.dispatch` entry with `kind:'convert-advisory'`.
 * @param {{repo: string, provider?: object, runJudge?: Function, fetchEvidence?: Function, dryRun?: boolean,
 *   force?: boolean, comments?: (Array|null), labels?: (Array|null)}} o
 * @returns {Promise<object>}
 */
export async function dispatchConvertAdvisory(d, {
  repo, provider = createGhProvider(), runJudge = runTargetedCheck, fetchEvidence = fetchTestGamingDiffEvidence,
  dryRun = false, force = false, comments = null, labels = null,
} = {}) {
  const prNumber = Number(d?.prNumber);
  // A caller that already read this tick's PR state (the daemon's own #4133 shared-read) hands it in; only a
  // caller with neither fetches fresh — mirrors `review-hold-reconcile.mjs`'s own lazy-fetch discipline.
  let state = null;
  if (comments == null || labels == null) state = provider.readPrState(repo, prNumber);
  const liveComments = comments ?? state?.comments ?? [];
  const liveLabels = labels ?? state?.labels ?? [];

  if (!force && hasConvertedAdvisoryNote(liveComments, d?.headSha)) {
    return { prNumber, headSha: d?.headSha, skipped: 'already-converted' };
  }

  const evidence = await resolveTargetedCheckEvidence({
    escalation: d?.escalation, headSha: d?.headSha, fetchEvidence,
  });
  const targetedCheckAnswer = (evidence.required && !evidence.available)
    ? { verdict: 'inconclusive', note: evidence.note }
    : await runJudge({
      acceptComment: d?.acceptComment, escalation: d?.escalation, runId: `convert-advisory-${prNumber}`,
      evidence: evidence.text,
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

// ── IO SHELL (runs only as a CLI — every export above stays side-effect-free on import) ───────────────────────
// #xconv1-evidence — the operator-facing "not by hand" repair path: re-run the whole convert-advisory arc for
// ONE PR from its LIVE state. `--dry-run` (no `gh` write, shows the exact prompt/answer/plan) is the read-only
// proof this fix's own evidence needs; `--force` bypasses `hasConvertedAdvisoryNote`'s idempotency for exactly
// one call, so a PR whose EXISTING converted note was produced with no diff evidence (this file's pre-fix
// behaviour) gets a CORRECTED note posted through the same mechanism, never by editing the thread by hand.
// Derives the `kind:'convert-advisory'` dispatch shape itself via `planConvertSupersededVerdict` — the same
// pure decision `we:scripts/conveyor/reconcile-core.mjs#planReconcile` uses — off one fresh `gh pr view`, so this
// CLI never needs the whole reconcile pass just to re-check one already-known PR.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  const fail = (m) => {
    writeLineSync(2, `✗ ${m}`);
    process.exit(1);
  };
  const pr = Number(positionals[0]);
  if (!Number.isInteger(pr) || pr <= 0 || typeof flags.repo !== 'string') {
    fail('usage: convert-advisory-dispatch.mjs <pr> --repo=<owner/name> [--dry-run] [--force]');
  }
  const repo = flags.repo;
  let prState;
  try {
    const raw = execFileSync('gh', [
      'pr', 'view', String(pr), '--repo', repo, '--json', 'headRefOid,comments,labels',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs() });
    prState = JSON.parse(raw);
  } catch (e) {
    fail(`could not read PR #${pr} (${repo}): ${String(e.message || e).split('\n')[0]}`);
  }
  const headSha = String(prState.headRefOid || '').toLowerCase();
  const conversion = planConvertSupersededVerdict({ headSha, reviewedSha: headSha, comments: prState.comments });
  if (!conversion.convert) {
    fail(`PR #${pr} is not in the convert-advisory shape right now (no accepted verdict superseded by a later `
      + 'escalation at this head — nothing for this CLI to re-check)');
  }
  const entry = {
    prNumber: pr, headSha, acceptComment: conversion.acceptComment, escalation: conversion.escalation,
  };
  dispatchConvertAdvisory(entry, {
    repo, dryRun: !!flags['dry-run'], force: !!flags.force,
    comments: prState.comments, labels: prState.labels,
  }).then((result) => {
    writeAllSync(1, `${JSON.stringify(result, null, 2)}\n`);
  }).catch((e) => fail(String((e && e.message) || e).split('\n')[0]));
}
