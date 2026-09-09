#!/usr/bin/env node
/**
 * @file scripts/operations/review-dispatch-wrapper.mjs
 * @description THE PURELY MECHANICAL REVIEW-DISPATCH WRAPPER (#xu2pp2m, downstream of #3627/#3628) — the
 * SECOND minimal-context dispatch mechanism to graduate, and the one the design card
 * (`we:backlog/xu2pp2m-review-and-fix-dispatch-should-get-the-same-minimal-context.md`) predicted would need
 * NO live Claude session in its critical path at all, unlike `we:scripts/operations/deliver-item-wrapper.mjs`
 * (#3627), which spawns a real, tool-bearing delivery agent through `CLAUDE_RESTRICTED_PROVIDER`.
 *
 * ================================================================================================
 * HONESTY LABEL, SAME CONVENTION `deliver-item-wrapper.mjs` USES. This file is NOT wired into
 * `we:scripts/operations/review-dispatch.mjs` / `we:scripts/conveyor/reconcile-core.mjs`'s dispatch decision,
 * is NOT imported by production code, and has NOT been run against a real PR end to end — per
 * `we:docs/agent/prototype-based-dev.md`'s "park until genuinely exercised" rule, that live run (a driver +
 * observer pair, against a real PR) is EXPLICITLY the next phase, not this one. Every function below is REAL —
 * every CLI surface it shells was read directly from the live source it calls (`review-loop-cli.mjs`,
 * `completion-cli.mjs`, `lane-pool.mjs`) — but "the code is real" and "the pipeline has been proven end to
 * end" are different claims; only the second is what graduation requires.
 * ================================================================================================
 *
 * ============================== STEP 1'S VERIFICATION, RECORDED HERE (not asserted) ==============================
 * THE DESIGN CARD'S OWN CENTRAL CLAIM — "a dispatched reviewer session does almost nothing but shell
 * `review-loop-cli.mjs` once and report its verdict verbatim; the real judging already happens inside that
 * CLI's own independently-spawned jurors" — was VERIFIED from source before this file was written, not taken
 * on the card's word (this item's own instructions required it):
 *
 *   1. `we:scripts/operations/review-loop-cli.mjs#runReviewLoopOnce` drives the ENTIRE `review-pr` operation
 *      unattended: `driveRun` with an injected `autoConfirm` (`we:scripts/lib/review-loop-policy.mjs
 *      #reviewLoopAutoConfirm`, a PURE function of the verdict already computed) — read the diff, spawn TWO
 *      independent jurors via `we:scripts/lib/judge-spawn.mjs` (tool-bearing `claude -p --safe-mode` juror
 *      subprocesses, each a structurally distinct actor by construction — see that file's own header), reduce
 *      their findings, and either bounce (`changes`), auto-clear (`accept`/`prevention-outstanding`, on the
 *      AGENT-addressed `review:pending` tier only), or park for a human (`review:human`, gate-self, or a
 *      declined confirm). NONE of this needs an LLM turn from the CALLING process — every judgment-shaped step
 *      happens INSIDE `review-loop-cli.mjs`'s own sub-spawned jurors, which this wrapper never sees or drives.
 *   2. `we:scripts/lib/review-independence.mjs#currentActorId` reads `CLAUDE_CODE_SESSION_ID` off
 *      `process.env` — PLAIN. Not gated on being inside a live Claude Code session, not read from any
 *      Claude-specific IPC. ANY process — a live Claude session, a `claude --bg` dispatch, or a bare `node`
 *      process like this wrapper — establishes the SAME independence signal by setting that one env var to a
 *      fresh value before running `review-loop-cli.mjs`. Confirmed by direct source read, not inferred from
 *      behavior.
 *   3. `we:skills-src/review/review-agent-brief.md`'s own step 2 confirms the dispatched session's job, in its
 *      own words: run `review-loop-cli.mjs` once, read what it printed, do not re-interpret it, do not
 *      improvise, do not retry. There is no OPEN judgment call left in that arc for a live session to make —
 *      the brief already forbids one.
 *
 * VERDICT: THE CLAIM HOLDS, undiluted. This wrapper's own critical path — acquire a lane, set a fresh
 * `CLAUDE_CODE_SESSION_ID`, run `review-loop-cli.mjs --json` once, classify its structured output, report,
 * release — needs NO `DeliveryAgentProvider`-shaped spawn anywhere in it. `we:scripts/operations/
 * minimal-context-provider.mjs`'s `CLAUDE_RESTRICTED_PROVIDER`-adjacent exports (`buildRestrictedProviderArgv`,
 * `createHooksSettingsWriter`) exist for a future FIXER mechanism (explicitly out of scope for this item — a
 * fixer performs real code-editing judgment, the SAME shape a builder does, and genuinely needs a spawned
 * agent turn) — this file imports none of them, on purpose, because the verified reality it is built against
 * has nothing for them to do.
 *
 * ONE NARROWER RESIDUAL, NAMED RATHER THAN PAPERED OVER (mirrors `we:scripts/operations/review-dispatch.mjs`'s
 * own "what this file does not close" section — the #2895 discipline: a residual left silent is worse than one
 * left open). `review-loop-cli.mjs`'s two jurors are independently spawned and tool-free by default
 * (`judge-spawn.mjs`'s `--tools ''`) — but a TOOL-BEARING juror variant exists and, per that file's own header,
 * is what a real `review-pr` round actually seats (nine real reviews found real defects specifically because a
 * juror COULD act). So while this WRAPPER's own critical path is genuinely zero-LLM-turn, the review it
 * triggers is not "no LLM anywhere" — it is "no LLM turn in the DISPATCHING process", exactly the claim under
 * verification, and precisely as strong as `review-loop-cli.mjs` already was before this wrapper existed. This
 * wrapper adds no new judgment and removes none that was there.
 *
 * IMPURE: `node:child_process` (via the shared module's `run`), `node:crypto` (a fresh session id). Every
 * impure call is injectable, mirroring `we:scripts/operations/review-dispatch.mjs`'s own convention.
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, acquireLane, releaseAllPools } from './minimal-context-provider.mjs';
import { reviewSessionSlug } from '../conveyor/review-session-slug.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The lane-pool `--purpose` this wrapper's acquire carries — matches `we:skills-src/review/
 *  review-agent-brief.md` step 1's own `--purpose=review-loop`, never `conveyor-delivery`. */
export const REVIEW_LOOP_LANE_PURPOSE = 'review-loop';

/** How long the acquire tolerates a momentary "no free lane" before genuinely giving up — matches the brief's
 *  own `--wait-ms=30000` (`#x3jmao3`: a momentary capacity flicker under real concurrent load self-heals
 *  within this window without anyone having to notice and manually retry). */
export const REVIEW_LOOP_ACQUIRE_WAIT_MS = 30000;

/**
 * SHAPE one dispatch request. PURE — mirrors `we:scripts/operations/review-dispatch.mjs#planReviewDispatch`
 * (the SAME validation, deliberately not re-derived differently), so the two never silently diverge on what a
 * valid `--pr`/`--repo` looks like even though this file does not import that one (it is impure — importing it
 * would pull in `node:child_process`/`node:crypto`/`node:fs` this file does not otherwise need before its own
 * impure section).
 *
 * @param {{pr: number|string, repo: string}} o
 * @returns {{pr: number, repo: string, sessionSlug: string}}
 */
export function planReviewDispatchWrapper({ pr, repo } = {}) {
  const prNum = Number(pr);
  if (!Number.isInteger(prNum) || prNum <= 0) {
    throw new Error(`review-dispatch-wrapper: --pr must be a positive integer, got ${JSON.stringify(pr)}`);
  }
  const repoStr = String(repo ?? '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoStr)) {
    throw new Error(`review-dispatch-wrapper: --repo must be an \`owner/repo\` slug, got ${JSON.stringify(repo)}`);
  }
  return { pr: prNum, repo: repoStr, sessionSlug: reviewSessionSlug(prNum) };
}

/**
 * PURE — turn `review-loop-cli.mjs --json`'s structured output into the SAME three-word vocabulary
 * `we:skills-src/review/review-agent-brief.md` step 3 already names (`bounced` / `auto-cleared` / `parked`),
 * the way a dispatched session reading that CLI's own printed lines would have classified them, done
 * DETERMINISTICALLY over the JSON fields instead of by prose-reading:
 *
 *   - `queued === 'accept-needs-human'` (the queued-accept branch, `we:scripts/lib/review-loop-policy.mjs
 *     #isQueuedAcceptStop`) → `parked` — a clean, independent verdict on `review:pending` still needs a human
 *     to run the resume command it printed; this wrapper does not, and must not, do that itself.
 *   - `preventionFiled` present (the prevention-outstanding auto-clear branch, `#isPreventionOutstandingClear`)
 *     → `auto-cleared` — every real finding was already resolved; the named prevention guard(s) were filed to
 *     the learnings pool by the CLI itself.
 *   - `stopped` is `'complete'`/`'effect-in-flight'` (the operation actually wrote a record) — `auto-cleared`
 *     when the top-level `verdict.verdict` is `'accept'`, `bounced` otherwise (a `changes` record).
 *   - `stopped === 'confirm'` (a HUMAN-addressed park, `review:human`/gate-self — the ordinary case
 *     `reviewLoopAutoConfirm` declines and `driveRun` suspends on) → `parked`.
 *   - anything else (`'refused'`, `'help'`, or output this wrapper's own reading does not cover) →
 *     `blocked-on-infra` — the SAME word the brief's own step 1 uses when no lane is available: the review
 *     loop itself could not genuinely run, which is an infra/wrapper-level fact, not a review verdict.
 *
 * @param {object} parsed - `review-loop-cli.mjs --json`'s parsed stdout.
 * @returns {{outcome: string, verdict: (string|null), loopOutcome: (string|null), runId: (string|null)}}
 */
export function classifyReviewLoopOutcome(parsed) {
  const runId = parsed && typeof parsed.runId === 'string' ? parsed.runId : null;
  const verdict = parsed && parsed.verdict && typeof parsed.verdict.verdict === 'string' ? parsed.verdict.verdict : null;
  const loopOutcome = parsed && parsed.verdict && parsed.verdict.loop && typeof parsed.verdict.loop.outcome === 'string'
    ? parsed.verdict.loop.outcome
    : null;

  if (parsed && parsed.queued === 'accept-needs-human') {
    return { outcome: 'parked', verdict, loopOutcome, runId };
  }
  if (parsed && Array.isArray(parsed.preventionFiled)) {
    return { outcome: 'auto-cleared', verdict, loopOutcome, runId };
  }
  const stopped = parsed && typeof parsed.stopped === 'string' ? parsed.stopped : null;
  if (stopped === 'complete' || stopped === 'effect-in-flight') {
    return { outcome: verdict === 'accept' ? 'auto-cleared' : 'bounced', verdict, loopOutcome, runId };
  }
  if (stopped === 'confirm') {
    return { outcome: 'parked', verdict, loopOutcome, runId };
  }
  return { outcome: 'blocked-on-infra', verdict, loopOutcome, runId };
}

/**
 * REAL — `we:scripts/operations/completion-cli.mjs report ...`, the SAME durable-trace mechanism
 * `we:skills-src/review/review-agent-brief.md` steps 0/3 already use (`#3436`): the one record that answers
 * "did the dispatch that just ran conclude anything" without `claude logs` archaeology.
 */
function reportStarted({ sessionSlug, pr }, { run: runFn = run } = {}) {
  runFn('node', [
    'scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--kind=review',
    `--pr=${pr}`, '--status=started',
  ]);
}

/** REAL — the `--status=done` completion report, carrying the classified outcome/verdict/runId. */
function reportDone({ sessionSlug, classified }, { run: runFn = run } = {}) {
  const args = ['scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--status=done', `--outcome=${classified.outcome}`];
  if (classified.loopOutcome) args.push(`--verdict=${classified.loopOutcome}`);
  if (classified.runId) args.push(`--runId=${classified.runId}`);
  runFn('node', args);
}

/**
 * THE ENTRY POINT — dispatch ONE mechanical review round for `repo#pr`, purely mechanically: acquire a lane,
 * establish independence with a fresh session id (no live Claude session — see the file header's verification
 * trail), run `review-loop-cli.mjs` exactly once, classify + report its structured verdict, release the lane,
 * return. NO Claude spawn anywhere in this function.
 *
 * @param {{pr: number|string, repo: string}} o
 * @param {{run?: Function, newActorId?: () => string, waitMs?: number}} [io]
 * @returns {{pr: number, repo: string, sessionSlug: string, lanePath: string, classified: object, raw: object}}
 */
export function dispatchReviewMechanical({ pr, repo } = {}, { run: runFn = run, newActorId = randomUUID, waitMs = REVIEW_LOOP_ACQUIRE_WAIT_MS } = {}) {
  const planned = planReviewDispatchWrapper({ pr, repo });

  // Durable trace BEFORE anything else can fail (mirrors the brief's own step-0 reasoning).
  reportStarted(planned, { run: runFn });

  // A fresh, unforgeable-by-construction identity for THIS review round — never the wrapper's own inherited
  // CLAUDE_CODE_SESSION_ID (if any). See the file header's verification point 2: any process may set this.
  const reviewActorId = String(newActorId());

  const lanePath = acquireLane(
    { sessionSlug: planned.sessionSlug, claudeSessionId: reviewActorId, purpose: REVIEW_LOOP_LANE_PURPOSE, waitMs },
    { run: runFn },
  );
  if (!lanePath) {
    // The pool genuinely has no free lane after the bounded wait — report and stop, exactly as the brief's own
    // step 1 does; no retry loop here either.
    const classified = { outcome: 'blocked-on-infra', verdict: null, loopOutcome: null, runId: null };
    reportDone({ sessionSlug: planned.sessionSlug, classified }, { run: runFn });
    return { ...planned, lanePath: null, classified, raw: null };
  }

  let raw = null;
  let classified;
  try {
    const out = runFn('node', [
      'scripts/operations/review-loop-cli.mjs', `--pr=${planned.pr}`, `--repo=${planned.repo}`,
      `--cwd=${lanePath}`, '--json',
    ], { env: { ...process.env, CLAUDE_CODE_SESSION_ID: reviewActorId } });
    raw = JSON.parse(out);
    classified = classifyReviewLoopOutcome(raw);
  } catch (e) {
    // Whatever this session's stdout carried (`e.stdout`, when the CLI itself refused/crashed) is preserved
    // for the completion record's own detail, mirroring `runVerifyOperation`'s "an operation-level crash is
    // reported, never silently swallowed" discipline (`we:scripts/operations/minimal-context-provider.mjs`).
    raw = { error: String(e && (e.stdout || e.message) || e) };
    classified = { outcome: 'blocked-on-infra', verdict: null, loopOutcome: null, runId: null };
  }

  reportDone({ sessionSlug: planned.sessionSlug, classified }, { run: runFn });
  releaseAllPools(planned.sessionSlug, { run: runFn });

  return { ...planned, lanePath, classified, raw };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  try {
    const result = dispatchReviewMechanical({ pr: flag('pr'), repo: flag('repo') });
    writeAllSync(1, `${JSON.stringify(result, null, 2)}\n`);
  } catch (e) {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  }
}
