#!/usr/bin/env node
/**
 * @file scripts/conveyor/ci-red-recovery-watch.mjs
 * @description we:backlog/x5uqim1-*.md (parent #4075, epic #3383) — THE ACTUAL RECOVERY ACTION.
 * `we:scripts/conveyor/reconcile-core.mjs`'s new `owed-ci-rerun` refusal (see its own docblock, and
 * `we:scripts/conveyor/main-red-recovery.mjs`'s file header for the full 2026-09-25 incident) correctly stops
 * `ci-heal` from misdiagnosing a red-`main`-caused failure as a code defect — but a refusal is not a repair.
 * Something has to actually give the PR a fresh look against the now-recovered `main`. This is that something.
 *
 * CORRECTED MID-BUILD, FROM A LIVE FINDING (see `main-red-recovery.mjs`'s own header for the full story): this
 * file originally called `gh run rerun <id> --failed`. Live-measured that this does NOT work — it re-executes
 * the SAME commit the run already built, so `main`'s fix is never in that tree, and the operator's own manual
 * rerun of #2596/#2622/#2629/#2631/#2634 all concluded `failure` again for the identical reason. The real fix,
 * confirmed against the operator's own emergency correction, is to actually merge current `main` into the PR's
 * head — done here via `we:scripts/lib/rebase-drop-manifest.mjs#rebaseDropManifest`, the SAME proven,
 * no-checkout plumbing the drain itself already uses to rebuild a lane's tip onto `main` (it already knows how
 * to drop the transient `.lane-manifest.json` collision rather than colliding on it, and it is already
 * idempotent — `action:'current'` when nothing needs to change). Never a raw `git merge` or the GitHub
 * `update-branch` REST endpoint, both of which would reintroduce exactly the manifest collision that plumbing
 * exists to avoid.
 *
 * WHERE THIS LIVES, AND WHY (the item's own Fork 1 — a pass-daemon watcher, not the drain and not the
 * fix-dispatch daemon):
 *   - NOT the drain (`we:skills-src/drain/SKILL.md`). The drain's job is landing a PR that is ALREADY green and
 *     reviewed; this pass's job is the opposite direction — making a wrongly-red PR eligible to be looked at
 *     again. Folding it into the drain would conflate "watch CI state" with "land", the same conflation
 *     `ci-heal` was deliberately kept separate from `fix` for (see `reconcile-core.mjs#DISPATCH_KINDS`'s own
 *     docblock).
 *   - NOT the fix-dispatch daemon (`we:scripts/conveyor/reconcile-fix-dispatch.mjs` /
 *     `we:scripts/operations/ci-heal-pr-dispatch.mjs`). Both dispatch an AGENT — acquire a lane, fill a brief,
 *     spend a session — for work that needs JUDGMENT. Refreshing a branch onto `main` needs none: it is exactly
 *     the "script-decidable → hook, deterministic" case `we:docs/agent/platform-decisions.md
 *     #deterministic-core-thin-judgment` and this repo's own Hookable-vs-Judgment doctrine (MEMORY #51) both
 *     name — `rebaseDropManifest` is already pure git plumbing, no judgment anywhere in it. Routing this through
 *     an agent brief would spend a lane and a session on a mechanical rebase, and — worse — would be the SAME
 *     kind of category error `ci-heal` misfiring on a red-`main` PR already is: handing judgment-shaped
 *     machinery a job that has none.
 *   - IS a per-repo `pass-daemon.mjs` watcher (`we:skills-src/conveyor/daemon-manifest.mjs`), the SAME shape as
 *     its siblings in this directory (`ci-queue-watch.mjs`, `parked-pr-conflict-watch.mjs`,
 *     `parked-pr-progress-watch.mjs`) — a periodic, read-mostly CI-state check with one narrow, IDEMPOTENT
 *     side effect (`we:scripts/conveyor/main-red-recovery.mjs#planMainRedRebases`'s own cap: `already-current`
 *     once `main`'s tip is already an ancestor of the PR's head, read back off GitHub's own `compare` endpoint —
 *     no parallel store — AND `rebaseDropManifest`'s own independent `action:'current'` short-circuit). It must
 *     survive a conveyor restart on its own, for the exact reason `reconcile-pass.mjs`'s own header gives for
 *     being a resident daemon rather than folded into the tick: the tick's bookkeeping (`launchedNums`) is
 *     session-ephemeral and dies with the session that launched it.
 *
 * PURE-CORE / IO-SHELL SPLIT, mirroring `ci-queue-watch.mjs`: the pure planner
 * ({@link module:./main-red-recovery.mjs.planMainRedRebases}) is imported, not re-derived; this file owns every
 * `gh`/git call and the CLI.
 *
 * `--apply` GATES THE REAL WRITE (the rebase + push), mirroring `we:scripts/conveyor/orphan-claim-release.mjs`'s
 * own convention: bare `sweep` is a DRY RUN (plans and reports, touches nothing), `sweep --apply` actually
 * refreshes. The daemon manifest entry always passes `--apply`; an operator running this by hand gets a
 * safe-by-default dry run. `rebaseDropManifest` itself needs a real local checkout with an `origin` remote (the
 * SAME requirement every other conveyor dispatcher in this directory already has, e.g.
 * `we:scripts/operations/dispatch-lane-io.mjs#REPO_ROOT`) — it fetches the lane ref and pushes the rebuilt tip.
 */
import { resolve } from 'node:path';
import { repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { execFileSyncThrottled } from '../lib/gh-throttle.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { countTrustedLeadingMarker } from '../lib/marker-authorship.mjs';
import { latestRequiredCheck, isRequiredCheckFailed, CI_LIFECYCLE_LABELS } from '../merge-ai-prs.mjs';
import {
  computeMainRedWindows, planMainRedRebases, DEFAULT_MAIN_WORKFLOW_NAME, DEFAULT_REQUIRED_CHECK,
  buildHungCandidates, planHungCiRecoveries, DEFAULT_HUNG_THRESHOLD_MS, DEFAULT_MAX_HUNG_RETRIES_PER_SHA,
  classifyCiFailureAttribution, countRebaseOntoMainComments, buildRebaseOntoMainComment,
  DEFAULT_MAX_REBASE_RETRIES_PER_SHA,
  DEFAULT_REQUIRED_CONTEXTS, DEFAULT_MISSING_RUN_THRESHOLD_MS, DEFAULT_MAX_MISSING_RUN_RETRIES_PER_SHA,
  buildMissingRunCandidates, planMissingRunRecoveries, countMissingRunComments, buildMissingRunComment,
} from './main-red-recovery.mjs';
import { defaultReadMainRuns, defaultReadAheadBy } from './reconcile-pass.mjs';
import { rebaseDropManifest } from '../lib/rebase-drop-manifest.mjs';
import { REPO_ROOT } from '../operations/dispatch-lane-io.mjs';
import { resolveLanePoolRepoPath } from './lane-pool-health-watch.mjs';

/** How many open PRs one sweep reads — mirrors `we:scripts/conveyor/reconcile-pass.mjs#PR_LIST_LIMIT`. */
export const PR_LIST_LIMIT = 200;

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultReadOpenPrs — the narrow PR read this pass needs:
 * `number`, `headRefName` (the lane ref `rebaseDropManifest` refreshes), `headRefOid` (what `defaultReadAheadBy`
 * compares) and `statusCheckRollup` (what `latestRequiredCheck` reads). `exec` is injectable so the argv is
 * assertable with no `gh` on PATH.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultReadOpenPrs({ exec = execFileSyncThrottled, repo = null, extraFields = [] } = {}) {
  const fields = [...new Set(['number', 'headRefName', 'headRefOid', 'statusCheckRollup', ...extraFields])];
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT), '--json', fields.join(',')];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#buildCandidates — narrow the open-PR listing to the shape
 * {@link planMainRedRebases} wants: one row per PR whose required check is currently failing, with its
 * failure's completion time and how far behind `main` its head is resolved. `readAheadBy` is called ONLY for a
 * PR that actually has a resolvable `headRefOid` — defensive; every real `gh pr list` row carries one.
 * @param {Array<object>} prs
 * @param {{requiredCheck?:string, readAheadBy?:Function, repo?:string|null, defaultBranch?:string}} [o]
 * @returns {Array<{prNumber:number, headRefName:(string|null), aheadBy:(number|null), failureCompletedAt:(string|null)}>}
 */
export function buildCandidates(prs, {
  requiredCheck = DEFAULT_REQUIRED_CHECK, readAheadBy = defaultReadAheadBy, repo = null, defaultBranch = 'main',
} = {}) {
  const out = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    if (!isRequiredCheckFailed(pr, requiredCheck)) continue;
    const prNumber = Number(pr?.number);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const check = latestRequiredCheck(pr, requiredCheck);
    const aheadBy = pr?.headRefOid ? readAheadBy(pr.headRefOid, { repo, base: defaultBranch }) : null;
    out.push({
      prNumber, headRefName: pr?.headRefName ?? null, headSha: pr?.headRefOid ?? null, aheadBy,
      failureCompletedAt: check?.completedAt ?? null,
    });
  }
  return out;
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#refreshOntoMain — refresh ONE PR's lane branch onto current
 * `main`, the ONE write this pass ever performs. A thin wrapper over the shared, proven
 * `we:scripts/lib/rebase-drop-manifest.mjs#rebaseDropManifest` — never a second rebase implementation. Reports
 * `rebaseDropManifest`'s own `action` verbatim (`'rebased'` / `'current'` / `'skip'` / `'error'`) so a reader can
 * tell "refreshed" apart from "was already current" apart from "hit a real conflict, left for a human".
 * @param {string} laneRef
 * @param {{root?:string, base?:string, rebase?:Function}} [o]
 * @returns {{ok:boolean, action:string, error?:string}}
 */
export function refreshOntoMain(laneRef, { root = REPO_ROOT, base = 'origin/main', rebase = rebaseDropManifest } = {}) {
  const result = rebase({ laneRef, base, cwd: root });
  if (result.action === 'error') return { ok: false, action: 'error', error: result.reason };
  if (result.action === 'skip') return { ok: false, action: 'skip', error: result.reason };
  return { ok: true, action: result.action }; // 'rebased' or 'current'
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultPostRebaseComment — post the durable rebase-onto-main
 * marker comment ({@link module:./main-red-recovery.mjs.buildRebaseOntoMainComment}) after EVERY attempt,
 * success or failure — mirrors {@link defaultPostHungCiComment}'s own discipline exactly.
 * @param {number} prNumber
 * @param {{exec?:Function, repo?:string|null, headRefName?:(string|null), headSha?:(string|null),
 *   ok?:boolean, action?:string, error?:(string|null)}} [o]
 */
export function defaultPostRebaseComment(prNumber, {
  exec = execFileSyncThrottled, repo = null, headRefName = null, headSha = null, ok = true, action = 'rebased', error = null,
} = {}) {
  const argv = ['pr', 'comment', String(prNumber), '--body', buildRebaseOntoMainComment({
    headRefName, headSha, ok, action, error,
  })];
  if (repo) argv.push('--repo', repo);
  exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery — THE IO SHELL. Read, plan, and — only with
 * `apply: true` — act. Every reader is injectable so the whole sweep is exercisable with no network and no
 * credential.
 * @param {{repo?:string|null, apply?:boolean, requiredCheck?:string, defaultBranch?:string,
 *   readOpenPrs?:Function, readMainRuns?:Function, readAheadBy?:Function, refresh?:Function}} [o]
 * @returns {{dispatch:Array<object>, refusals:Array<object>, applied:Array<object>, mainRedWindows:Array<object>}}
 */
export function sweepCiRedRecovery({
  repo = null, apply = false, requiredCheck = DEFAULT_REQUIRED_CHECK, defaultBranch = 'main',
  readOpenPrs = defaultReadOpenPrs, readMainRuns = defaultReadMainRuns, readAheadBy = defaultReadAheadBy,
  readComments = defaultReadPrComments, refresh = refreshOntoMain, postComment = defaultPostRebaseComment,
  maxRebaseRetriesPerSha = DEFAULT_MAX_REBASE_RETRIES_PER_SHA,
} = {}) {
  const prs = readOpenPrs({ repo });
  const rawCandidates = buildCandidates(prs, { requiredCheck, readAheadBy, repo, defaultBranch });
  // The `gh run list --branch main` read only matters when there is at least one candidate to judge against it
  // — mirrors `reconcile-pass.mjs#enrichPrsWithMainRedFacts`'s own "pay for it only when needed" discipline.
  const mainRedWindows = rawCandidates.length
    ? computeMainRedWindows(readMainRuns({ repo, branch: defaultBranch, workflowName: DEFAULT_MAIN_WORKFLOW_NAME }))
    : [];
  // x5uqim1 follow-up (#4075/#3383) — the durable per-sha rebase-attempt count (`rebaseAttemptsForSha`,
  // {@link DEFAULT_MAX_REBASE_RETRIES_PER_SHA}'s own safety net) only matters for a candidate that would
  // otherwise actually be dispatched: attributable to a red-`main` window AND still `aheadBy > 0`. Reading a
  // PR's comment thread only for THOSE mirrors `sweepHungCiRecovery`'s own "pay for it only when needed"
  // discipline — never one extra `gh pr view` per open PR on every tick.
  const candidates = rawCandidates.map((c) => {
    if (!(c.aheadBy > 0)) return c;
    const attribution = classifyCiFailureAttribution({ failureCompletedAt: c.failureCompletedAt, mainRedWindows });
    if (attribution !== 'main-red') return c;
    const comments = readComments(c.prNumber, { repo });
    return { ...c, rebaseAttemptsForSha: countRebaseOntoMainComments(comments, c.headSha) };
  });
  const plan = planMainRedRebases({ candidates, mainRedWindows, maxRebaseRetriesPerSha });

  // x5uqim1 follow-up (#4075/#3383) part (c) — "check the owed-ci-rerun path for frontierui/plateau-app too":
  // `rebaseDropManifest` needs a REAL LOCAL checkout of the repo it rebases (this file's own header). Left at
  // its old default (`REPO_ROOT`, WE's own checkout, always) this would have run every mechanical rebase in
  // the WRONG local git repo for frontierui/plateau-app — `git fetch origin <laneRef>` against WE's own
  // `origin` remote, which just fails cleanly (no matching ref) rather than corrupting anything, but never
  // actually refreshes those repos' PRs either. `resolveLanePoolRepoPath` (already used the identical way by
  // `we:scripts/conveyor/lane-pool-health-watch.mjs`) resolves the SAME sibling checkout path every other
  // multi-repo conveyor pass already reads from (`we:scripts/lib/constellation-repos.mjs#CONSTELLATION_REPOS`),
  // returning `null` for `we` itself (kept on `REPO_ROOT`, unchanged).
  const repoRoot = resolveLanePoolRepoPath(repo) ?? REPO_ROOT;

  const applied = [];
  if (apply) {
    for (const d of plan.dispatch) {
      const result = refresh(d.headRefName, { base: `origin/${defaultBranch}`, root: repoRoot });
      // Posted on EVERY attempt, success or failure — mirrors `sweepHungCiRecovery`'s own discipline: a
      // permanently-failing refresh must still trip {@link DEFAULT_MAX_REBASE_RETRIES_PER_SHA}'s cap, not
      // retry forever silently.
      postComment(d.prNumber, {
        repo, headRefName: d.headRefName, headSha: d.headSha, ok: result.ok, action: result.action, error: result.error ?? null,
      });
      applied.push({ prNumber: d.prNumber, headRefName: d.headRefName, ...result });
    }
  }
  return { ...plan, applied, mainRedWindows };
}

// ── HUNG-CI-RUN RECOVERY (we:backlog/xd1sfms-*.md, parent #4075/#3383) ─────────────────────────────────────────
// See `we:scripts/conveyor/main-red-recovery.mjs`'s own "HUNG-CI-RUN RECOVERY" section header for the full
// incident (#2636, run 36161558017) and why this reasons about the whole CI *run*, never just the named
// required check. This half owns every real IO the hung-run pass needs: reading a PR's comment thread (to
// recover the durable per-sha attempt count), the one real write (`gh run cancel` then `gh run rerun`), and
// posting the durable marker comment that write leaves behind.

/** we:scripts/conveyor/ci-red-recovery-watch.mjs#HUNG_CI_COMMENT_MARKER — the stable FIRST LINE of the durable
 *  hung-recovery comment, mirroring `we:scripts/conveyor/ci-heal-mark.mjs#CI_HEAL_COMMENT_MARKER`'s own shape.
 *  Distinct marker text (and, unlike that file, scoped to one head sha per {@link countHungCiComments} AND to
 *  one job name per {@link countHungCiCommentsByJob}) so the two attempt caps never cross-count. Posted on
 *  EVERY attempt now — success or failure (see `sweepHungCiRecovery`'s own docblock for why a failed cancel
 *  must still count) — so the body always states the real outcome, never implying a rerun that never happened. */
export const HUNG_CI_COMMENT_MARKER = '⏱️ conveyor CI-hung-recovery';

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#buildHungCiComment — the durable comment body posted after
 * EVERY hung-run attempt, whatever its outcome. Its first line MUST be {@link HUNG_CI_COMMENT_MARKER}; its body
 * embeds `sha: <headSha>` (so {@link countHungCiComments} can scope its count to the CURRENT head sha only — a
 * new push must start that cap fresh, see `main-red-recovery.mjs`'s own docblock for why) AND `job: <jobName>`
 * (so {@link countHungCiCommentsByJob} can recognise the SAME job hanging again on a later, different sha —
 * the repeat-hang signal `main-red-recovery.mjs#planHungCiRecoveries` escalates on). LIVE 2026-09-25,
 * orchestrator-flagged: the very first version of this function silently dropped the real `gh` stderr on a
 * failed cancel (truncated to the exec error's own first line, "Command failed: gh run cancel …", which never
 * contains the actual reason) — `error` now carries the real text a caller like `cancelAndRerunHungRun`
 * captured, so a permission gap (a GitHub App token missing `actions:write`, the concrete cause found live) or
 * a "run already completing" race is VISIBLE on the PR itself, not just swallowed. PURE.
 * @param {{actor?:string, runId?:(number|string|null), headSha?:(string|null), jobName?:(string|null),
 *   kind?:string, ok?:boolean, action?:string, error?:(string|null)}} o
 * @returns {string}
 */
export function buildHungCiComment({
  actor = 'conveyor CI-hung-recovery', runId = null, headSha = null, jobName = null,
  kind = 'hung-cancel-rerun', ok = true, action = 'cancelled-and-rerun', error = null,
} = {}) {
  const outcome = ok
    ? (kind === 'repeat-hang'
      ? `cancelled run ${runId ?? '?'} (job "${jobName ?? '?'}") and did NOT re-run it — this job has hung before on a different head, so this is handed to ci-heal for a real diagnosis instead of retried again.`
      : kind === 'hung-cap-escalate'
        ? `cancelled run ${runId ?? '?'} (job "${jobName ?? '?'}") and did NOT re-run it — this head sha's own hung-recovery retries are exhausted, so this is handed to ci-heal instead of left for GitHub's own job timeout-minutes, which this PR's branch predates.`
        : `found run ${runId ?? '?'} stuck in_progress/queued past the hung threshold; cancelled it and asked GitHub to re-run it.`)
    : `attempted "${action}" on run ${runId ?? '?'} and it FAILED: ${error ?? '(no error text captured)'} — this attempt still counts toward the retry cap so a permanently-failing action (e.g. a token missing \`actions:write\`) cannot retry forever.`;
  return [
    HUNG_CI_COMMENT_MARKER,
    '',
    `sha: ${headSha ?? '(unknown)'}`,
    `job: ${jobName ?? '(unknown)'}`,
    `${actor} ${outcome}`,
  ].join('\n');
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#countHungCiComments — the DURABLE, restart-surviving hung-run
 * attempt count for ONE head sha, mirroring `we:scripts/conveyor/ci-heal-mark.mjs#countCiHealComments`'s own
 * "the count IS PR state" discipline, narrowed to `headSha` (see {@link buildHungCiComment}'s own docblock for
 * why a new push must not inherit a previous sha's count). Delegates the leading-line-+-trusted-author match
 * itself to `we:scripts/lib/marker-authorship.mjs#countTrustedLeadingMarker` — the ONE shared answer every
 * durable marker counter in this repo now runs through (#3383 adversarial-review finding: a forged marker from
 * an untrusted login must never inflate a real cap) — never re-derived here; this function's only own logic is
 * the per-sha pre-filter that function doesn't know about. Counts EVERY attempt marker regardless of outcome
 * (success or failure — see {@link buildHungCiComment}'s own docblock for why a failed attempt still counts).
 * PURE.
 * @param {Array<{body?:string}|string>|null|undefined} comments - as `gh pr view <pr> --json comments` returns.
 * @param {string|null} [headSha] - when given, only a marker whose body names THIS sha counts; omitted counts
 *   every trusted hung-recovery marker on the PR regardless of sha (used only when the caller has no sha yet).
 * @returns {number}
 */
/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#bodyHasExactLine — does `body` contain `line` as a WHOLE LINE
 * (bounded by string-start/newline on one side and newline/string-end on the other), never merely as a
 * substring? LIVE 2026-09-25, adversarial-review-caught (PR #2693): the original `countHungCiComments`/
 * `countHungCiCommentsByJob` used a bare `body.includes(needle)`, so job name `"test"` matched INSIDE
 * `"job: test-shard (1)"` (confirmed: `'job: test-shard (1)'.includes('job: test')` → `true`) — a job whose
 * name is a text-prefix of a sibling job's name (exactly the `"test"` / `"test-shard (1)"` pair this same PR's
 * own p95 comment names) would inherit the OTHER job's hung-attempt history, denying it its own first
 * legitimate retry. Anchoring the match to a full line closes this for both the `sha:` and `job:` marker
 * fields — never re-derived per call site. PURE.
 * @param {string} body
 * @param {string} line - the exact line to look for, WITHOUT a trailing newline.
 * @returns {boolean}
 */
export function bodyHasExactLine(body, line) {
  if (typeof body !== 'string' || typeof line !== 'string' || !line) return false;
  return body.split('\n').some((l) => l === line);
}

export function countHungCiComments(comments, headSha = null) {
  if (!Array.isArray(comments)) return 0;
  const scoped = headSha
    ? comments.filter((c) => bodyHasExactLine(typeof c === 'string' ? c : c?.body, `sha: ${headSha}`))
    : comments;
  return countTrustedLeadingMarker(scoped, HUNG_CI_COMMENT_MARKER);
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#countHungCiCommentsByJob — the DURABLE count of how many times
 * ONE job name has hung on this PR, ACROSS EVERY head sha it has ever had — the repeat-hang signal
 * `we:scripts/conveyor/main-red-recovery.mjs#planHungCiRecoveries` escalates on (xd1sfms follow-up, live
 * 2026-09-25: #2636's `test-shard (1)` hung on TWO different shas in a row). Deliberately NOT scoped by sha,
 * unlike {@link countHungCiComments} — a rebase/refresh changes the sha but never explains away the SAME shard
 * hanging again; scoping by sha here would reset the very signal this function exists to keep. Matches the
 * `job:` line EXACTLY ({@link bodyHasExactLine}) — see that helper's own docblock for the live adversarial-
 * review finding a bare substring match let through (`"test"` falsely matching inside `"test-shard (1)"`).
 * PURE.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @param {string|null} jobName - when given, only a marker whose body names THIS job counts; omitted counts
 *   every trusted hung-recovery marker on the PR regardless of job (used only when the caller has no job yet).
 * @returns {number}
 */
export function countHungCiCommentsByJob(comments, jobName = null) {
  if (!Array.isArray(comments)) return 0;
  const scoped = jobName
    ? comments.filter((c) => bodyHasExactLine(typeof c === 'string' ? c : c?.body, `job: ${jobName}`))
    : comments;
  return countTrustedLeadingMarker(scoped, HUNG_CI_COMMENT_MARKER);
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultReadPrComments — read one PR's comment thread, the
 * narrow shape {@link countHungCiComments} needs. Called ONLY for a candidate this tick has already found
 * hung (see `sweepHungCiRecovery`'s own "pay for it only when needed" comment) — never for every open PR.
 * @param {number} prNumber
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultReadPrComments(prNumber, { exec = execFileSyncThrottled, repo = null } = {}) {
  const argv = ['pr', 'view', String(prNumber), '--json', 'comments'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
  const parsed = JSON.parse(String(out || '{}'));
  return Array.isArray(parsed?.comments) ? parsed.comments : [];
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultPostHungCiComment — post the durable marker comment
 * ({@link buildHungCiComment}) after EVERY hung-run attempt, success or failure (see `sweepHungCiRecovery`'s
 * own docblock for why a failed attempt must still be recorded — never conditioned on `ok` here or by the
 * caller).
 * @param {number} prNumber
 * @param {{exec?:Function, repo?:string|null, runId?:(number|null), headSha?:(string|null),
 *   jobName?:(string|null), kind?:string, ok?:boolean, action?:string, error?:(string|null)}} [o]
 */
export function defaultPostHungCiComment(prNumber, {
  exec = execFileSyncThrottled, repo = null, runId = null, headSha = null, jobName = null,
  kind = 'hung-cancel-rerun', ok = true, action = 'cancelled-and-rerun', error = null,
} = {}) {
  const argv = ['pr', 'comment', String(prNumber), '--body', buildHungCiComment({
    runId, headSha, jobName, kind, ok, action, error,
  })];
  if (repo) argv.push('--repo', repo);
  exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
}

/** we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultSleepSync — a bounded, SYNCHRONOUS pause, used only to
 *  give GitHub a moment to actually land a cancellation before the immediately-following rerun request (a
 *  rerun asked for before the cancel lands is rejected by GitHub's own API). Kept synchronous — like every
 *  other effect in this file — rather than turning this whole module async for one call site; injectable so
 *  tests never actually sleep. */
export function defaultSleepSync(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#describeExecError — LIVE 2026-09-25, orchestrator-flagged: the
 * first version of every `cancel*`/`rerun*` catch block here reported only `String(e.message).split('\n')[0]`
 * — for a Node `execFileSync` child-process failure that is JUST `"Command failed: gh run cancel 123 …"`, the
 * ACTUAL reason (`gh`'s own stderr — e.g. a GitHub App token missing the `actions:write` scope, or "run is
 * already completed") lives in `e.stderr` (or on the later lines of `e.message`), which that truncation threw
 * away. Confirmed live: the daemon's own log for #2636 showed exactly this useless first line while the real
 * cause sat unread in `e.stderr`. Prefers `e.stderr` (trimmed, capped) when present and non-empty; falls back
 * to the full `e.message` (not just its first line) otherwise. PURE (no IO of its own — reads only the error
 * object handed to it).
 * @param {*} e
 * @returns {string}
 */
/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#redactTokenShapes — strip a GitHub token shape out of text
 * before it can reach a PUBLIC surface (a PR comment). Adversarial-review-caught, live 2026-09-25 (PR #2693's
 * own round-1 review, security/information-exposure): `describeExecError` started forwarding raw `gh` stderr
 * (capped at 500 chars) verbatim into a public comment — reasonable per this card's own goal ("real stderr
 * surfaces on the PR"), but with no redaction safety net for the low-likelihood case that stderr ever echoes
 * more than plain API error text (a proxy layer, a future `gh` regression). Mirrors the SAME pattern
 * `we:scripts/lib/daemon-rebuild.mjs`'s own (private) `redactDetail` already uses for its alerts log — never
 * re-derived as a different shape, just re-applied here since that function isn't exported. PURE.
 * @param {string} text
 * @returns {string}
 */
export function redactTokenShapes(text) {
  return String(text ?? '').replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '$1<redacted>');
}

export function describeExecError(e) {
  const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : (Buffer.isBuffer(e?.stderr) ? e.stderr.toString('utf8').trim() : '');
  const raw = redactTokenShapes(stderr || String((e && e.message) || e));
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#cancelHungRun — cancel a hung run WITHOUT re-running it. Used
 * for the `repeat-hang` dispatch (`main-red-recovery.mjs#planHungCiRecoveries`): the SAME job hanging again on
 * a different head sha is treated as a real hang in that shard's own tests, not infra, so this pass cancels
 * (unsticking the PR — `we:scripts/merge-ai-prs.mjs#isRequiredCheckFailed` already treats a CANCELLED required
 * check as failed, handing the PR to the ordinary `ci-red` → `ci-heal` path) and deliberately stops there.
 * @param {number|string} runId
 * @param {{repo?:string|null, exec?:Function}} [o]
 * @returns {{ok:boolean, action:string, error?:string}}
 */
export function cancelHungRun(runId, { repo = null, exec = execFileSyncThrottled } = {}) {
  const repoArgs = repo ? ['--repo', repo] : [];
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' };
  try {
    exec('gh', ['run', 'cancel', String(runId), ...repoArgs], opts);
  } catch (e) {
    return { ok: false, action: 'cancel-failed', error: describeExecError(e) };
  }
  return { ok: true, action: 'cancelled-no-rerun' };
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#cancelAndRerunHungRun — the ONE real write the ordinary
 * (non-repeat-hang) hung-run dispatch performs: `gh run cancel <runId>`, a short bounded pause, then
 * `gh run rerun <runId>` (the WHOLE run — never `--failed`, which matches a `failure` conclusion, not the
 * `cancelled` one this pass's own cancel just produced, and would silently rerun nothing). Never a raw retry
 * of the still-hung attempt in place.
 * @param {number|string} runId
 * @param {{repo?:string|null, exec?:Function, sleepSync?:Function, waitMs?:number}} [o]
 * @returns {{ok:boolean, action:string, error?:string}}
 */
export function cancelAndRerunHungRun(runId, { repo = null, exec = execFileSyncThrottled, sleepSync = defaultSleepSync, waitMs = 5000 } = {}) {
  const repoArgs = repo ? ['--repo', repo] : [];
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' };
  try {
    exec('gh', ['run', 'cancel', String(runId), ...repoArgs], opts);
  } catch (e) {
    return { ok: false, action: 'cancel-failed', error: describeExecError(e) };
  }
  sleepSync(waitMs);
  try {
    exec('gh', ['run', 'rerun', String(runId), ...repoArgs], opts);
  } catch (e) {
    return { ok: false, action: 'rerun-failed', error: describeExecError(e) };
  }
  return { ok: true, action: 'cancelled-and-rerun' };
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepHungCiRecovery — THE IO SHELL for the hung-run pass,
 * mirroring {@link sweepCiRedRecovery}'s own read/plan/act shape exactly. Every reader/writer is injectable so
 * the whole sweep is exercisable with no network and no credential.
 *
 * THE MARKER IS POSTED ON EVERY ATTEMPT NOW, SUCCESS OR FAILURE — a live, orchestrator-flagged correctness
 * fix (2026-09-25). The original version only posted (and therefore only COUNTED) a successful cancel+rerun;
 * live against #2636, the GitHub App token turned out to lack `actions:write`, so `gh run cancel` failed on
 * EVERY tick, the marker was never posted, `hungAttemptsForSha` stayed 0 forever, and this pass would have
 * hammered the same doomed `gh run cancel` call every 2 minutes indefinitely — worse than the hang it exists to
 * fix. Counting every ATTEMPT (never just every success) is what makes the retry cap a real ceiling under a
 * permanently-failing write, not just under a flaky one; once the cap trips, `hung-cap-exhausted` hands off to
 * GitHub's own job `timeout-minutes` exactly as a successful-but-still-hung run would.
 * @param {{repo?:string|null, apply?:boolean, requiredCheck?:string, workflowName?:string, thresholdMs?:number,
 *   maxRetriesPerSha?:number, readOpenPrs?:Function, readComments?:Function, cancelAndRerun?:Function,
 *   cancelOnly?:Function, postComment?:Function, now?:number}} [o]
 * @returns {{dispatch:Array<object>, refusals:Array<object>, applied:Array<object>}}
 */
export function sweepHungCiRecovery({
  repo = null, apply = false, requiredCheck = DEFAULT_REQUIRED_CHECK, workflowName = DEFAULT_MAIN_WORKFLOW_NAME,
  thresholdMs = DEFAULT_HUNG_THRESHOLD_MS, maxRetriesPerSha = DEFAULT_MAX_HUNG_RETRIES_PER_SHA,
  readOpenPrs = defaultReadOpenPrs, readComments = defaultReadPrComments,
  cancelAndRerun = cancelAndRerunHungRun, cancelOnly = cancelHungRun, postComment = defaultPostHungCiComment, now = Date.now(),
} = {}) {
  const prs = readOpenPrs({ repo });
  const rawCandidates = buildHungCandidates(prs, { requiredCheck, workflowName });
  // The `gh pr view --json comments` read (to recover the durable per-sha AND per-job attempt counts) only
  // matters for a candidate this tick has ALREADY found hung — mirrors `sweepCiRedRecovery`'s own "pay for it
  // only when needed" discipline (there, gating the `gh run list --branch main` read on `candidates.length`).
  // ONE read serves both counts — never two separate `gh pr view` calls for the same PR.
  const candidates = rawCandidates.map((c) => {
    if (c.runId == null || !Number.isFinite(Date.parse(c.startedAt))) return c;
    const hungNow = (now - Date.parse(c.startedAt)) >= thresholdMs;
    if (!hungNow) return c;
    const comments = readComments(c.prNumber, { repo });
    // `hungAttemptsForJob` must answer "has this job hung on a DIFFERENT head sha before" — the repeat-hang
    // signal (main-red-recovery.mjs#planHungCiRecoveries) is about the shard surviving a rebase/refresh, not
    // about how many times THIS sha's own retries have already failed (that is `hungAttemptsForSha`'s job).
    // Excluding this candidate's OWN current sha from the job count keeps the two signals independent: a sha
    // that has failed twice in a row against ITSELF trips `hung-cap-exhausted`, never a false `repeat-hang`.
    const otherShaComments = comments.filter((cm) => !bodyHasExactLine(typeof cm === 'string' ? cm : cm?.body, `sha: ${c.headSha}`));
    return {
      ...c,
      hungAttemptsForSha: countHungCiComments(comments, c.headSha),
      hungAttemptsForJob: countHungCiCommentsByJob(otherShaComments, c.jobName),
    };
  });
  const plan = planHungCiRecoveries({
    candidates, now, thresholdMs, maxRetriesPerSha,
  });

  const applied = [];
  if (apply) {
    for (const d of plan.dispatch) {
      const result = d.runId == null
        ? { ok: false, action: 'no-run-id', error: `PR #${d.prNumber}'s hung check has no resolvable run id (detailsUrl missing/unparseable)` }
        // #4075/#3383, 2026-09-25 18:55 ET correction — `hung-cap-escalate` cancels only, exactly like
        // `repeat-hang`: both hand the PR to the existing ci-red -> ci-heal path rather than retrying.
        : ((d.kind === 'repeat-hang' || d.kind === 'hung-cap-escalate') ? cancelOnly(d.runId, { repo }) : cancelAndRerun(d.runId, { repo }));
      // Posted on EVERY attempt, success or failure — see this function's own docblock above for why.
      if (d.runId != null) {
        postComment(d.prNumber, {
          repo, runId: d.runId, headSha: d.headSha, jobName: d.jobName, kind: d.kind, ok: result.ok, action: result.action, error: result.error ?? null,
        });
      }
      // xd1sfms (#4075/#3383) — `why` carries forward from the PLAN (never re-derived here) so every applied
      // action stays traceable to the reason it fired, whether or not the write itself succeeded — "log each
      // hung-run action with its reason" (this card's own scope item 3).
      applied.push({
        prNumber: d.prNumber, headRefName: d.headRefName, runId: d.runId, jobName: d.jobName ?? null, kind: d.kind, why: d.why, ...result,
      });
    }
  }
  return { ...plan, applied };
}

/** we:scripts/conveyor/ci-red-recovery-watch.mjs#formatHungReport — one line per dispatch/refusal/applied
 *  result for the hung-run pass, mirroring {@link formatReport}'s own shape/discipline. */
export function formatHungReport({ dispatch = [], refusals = [], applied = [] } = {}) {
  const lines = [`ci-red-recovery-watch (hung) — ${dispatch.length} owed an action, ${refusals.length} refusal(s), ${applied.length} applied`];
  for (const d of dispatch) lines.push(`  → ${d.kind} PR #${d.prNumber} run ${d.runId ?? '?'} — ${d.why}`);
  for (const r of refusals) if (r.kind !== 'not-hung') lines.push(`  ✗ ${r.kind} PR #${r.prNumber} — ${r.why}`);
  for (const a of applied) lines.push(a.ok ? `  ✓ applied: ${a.action} run ${a.runId ?? '?'} (PR #${a.prNumber}) — ${a.why ?? '(no reason recorded)'}` : `  ✗ apply ${a.action} PR #${a.prNumber} run ${a.runId ?? '?'} — ${a.error} (reason it was attempted: ${a.why ?? '(none)'})`);
  return lines.join('\n');
}

// ── MISSING-CI-RUN RECOVERY (we:backlog/xi4od2p-*.md, parent #4075/#3383) ──────────────────────────────────────
// See `we:scripts/conveyor/main-red-recovery.mjs`'s own "MISSING-CI-RUN RECOVERY" section header for the full
// incident (PR chalbert/web-everything#2729) and why this is a THIRD, disjoint population from the main-red and
// hung-run passes above: a required check that never even started, never CONCLUDED and never went
// `IN_PROGRESS`/`QUEUED`. This half owns every real IO the missing-run pass needs: reading the LIVE required
// context names off branch protection, the one extra per-candidate read (`gh api commits/<sha>` for the head
// commit's own committed date — `gh pr list` never returns it), the two real triggers (`PUT
// /pulls/{n}/update-branch` or `gh workflow run`), the durable marker comment, and clearing the stale `checking`
// label this card's own scope names.

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultReadRequiredContexts — the LIVE required-check-name set
 * this pass watches, read off branch protection rather than hardcoded (`GET /repos/{repo}/branches/{branch}/
 * protection`'s own `required_status_checks.contexts`) — per this card's own scope ("read the required contexts
 * from branch protection"). Falls back to {@link DEFAULT_REQUIRED_CONTEXTS} on a read failure (e.g. a token
 * without the scope branch protection needs) — the safe direction: reasoning about a NARROWER set than the
 * truth can only under-fire this pass, never wrongly trigger CI for a context that was never actually required.
 * @param {{repo?:string|null, branch?:string, exec?:Function}} [o]
 * @returns {string[]}
 */
export function defaultReadRequiredContexts({ repo = null, branch = 'main', exec = execFileSyncThrottled } = {}) {
  if (!repo) return [...DEFAULT_REQUIRED_CONTEXTS];
  try {
    const out = exec('gh', ['api', `repos/${repo}/branches/${branch}/protection`, '--jq', '.required_status_checks.contexts'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
    });
    const parsed = JSON.parse(String(out || '[]'));
    return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_REQUIRED_CONTEXTS];
  } catch {
    return [...DEFAULT_REQUIRED_CONTEXTS];
  }
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultReadHeadCommittedAt — the one extra per-candidate read
 * this pass needs (`gh pr list` never returns a head commit's own timestamp): the head sha's own commit date,
 * read ONLY for a PR {@link buildMissingRunCandidates} already narrowed to — mirrors every other "pay for it
 * only when needed" read in this file.
 * @param {string|null} sha
 * @param {{repo?:string|null, exec?:Function}} [o]
 * @returns {string|null}
 */
export function defaultReadHeadCommittedAt(sha, { repo = null, exec = execFileSyncThrottled } = {}) {
  if (!sha || !repo) return null;
  try {
    const out = exec('gh', ['api', `repos/${repo}/commits/${sha}`, '--jq', '.commit.committer.date'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
    });
    return String(out || '').trim() || null;
  } catch {
    return null;
  }
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#triggerCiForPr — the ONE real write the missing-run pass
 * performs: prefer `PUT /pulls/{n}/update-branch` (which ALSO merges current `main` into the PR's head — closing
 * the same staleness {@link refreshOntoMain} exists for, for free) when the PR is behind `main`; otherwise ask
 * GitHub to run the CI workflow directly on the PR's own branch (`gh workflow run`, which needs — and this
 * repo's `we:.github/workflows/ci.yml` already declares — a `workflow_dispatch:` trigger). NEVER an empty-commit
 * push: this card's own scope limits that alternative to "the product's own push path", which neither exists
 * nor is needed here since both these paths are real GitHub-native ways to start a run without inventing a new
 * commit.
 * @param {{prNumber:number, headRefName?:(string|null), preferUpdateBranch?:boolean}} d
 * @param {{repo?:string|null, exec?:Function, workflowName?:string}} [o]
 * @returns {{ok:boolean, action:string, error?:string}}
 */
export function triggerCiForPr(d, { repo = null, exec = execFileSyncThrottled, workflowName = DEFAULT_MAIN_WORKFLOW_NAME } = {}) {
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' };
  const repoArgs = repo ? ['--repo', repo] : [];
  if (d?.preferUpdateBranch) {
    try {
      exec('gh', ['api', '-X', 'PUT', `repos/${repo}/pulls/${d.prNumber}/update-branch`], opts);
      return { ok: true, action: 'update-branch' };
    } catch (e) {
      return { ok: false, action: 'update-branch', error: describeExecError(e) };
    }
  }
  try {
    exec('gh', ['workflow', 'run', workflowName, '--ref', String(d?.headRefName ?? ''), ...repoArgs], opts);
    return { ok: true, action: 'workflow-dispatch' };
  } catch (e) {
    return { ok: false, action: 'workflow-dispatch', error: describeExecError(e) };
  }
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultPostMissingRunComment — post the durable marker comment
 * ({@link buildMissingRunComment}) after EVERY missing-run trigger attempt, success or failure — mirrors
 * {@link defaultPostRebaseComment}'s own discipline exactly.
 * @param {number} prNumber
 * @param {{exec?:Function, repo?:string|null, headRefName?:(string|null), headSha?:(string|null),
 *   ok?:boolean, action?:string, error?:(string|null)}} [o]
 */
export function defaultPostMissingRunComment(prNumber, {
  exec = execFileSyncThrottled, repo = null, headRefName = null, headSha = null, ok = true, action = 'update-branch', error = null,
} = {}) {
  const argv = ['pr', 'comment', String(prNumber), '--body', buildMissingRunComment({
    headRefName, headSha, ok, action, error,
  })];
  if (repo) argv.push('--repo', repo);
  exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#clearStaleCheckingLabel — this card's own "fix the `checking`
 * label so it reflects reality" scope item, narrowly scoped: ONLY for a PR THIS pass's own read already proved
 * has zero required-check rollup entries at all (never re-derives that proof, and never touches
 * `we:scripts/merge-ai-prs.mjs#lifecycleLabelFromCiTruth`'s ratified 4-state taxonomy or any other caller of
 * it). `checking`'s own label description (#2281) is "Required checks are still running — CI truth not yet
 * known", which is false while no run has ever even started; removing it here corrects THIS pass's own narrow
 * true positive, not a taxonomy change. The label is re-applied correctly by the EXISTING label reconciler on
 * its own next tick, once the trigger above gives it a real, in-flight check to read.
 * @param {number} prNumber
 * @param {{repo?:string|null, exec?:Function, currentLabels?:string[]}} [o]
 * @returns {boolean} true iff the label was present and a removal was attempted.
 */
export function clearStaleCheckingLabel(prNumber, { repo = null, exec = execFileSyncThrottled, currentLabels = [] } = {}) {
  if (!currentLabels.includes(CI_LIFECYCLE_LABELS.checking)) return false;
  const argv = ['pr', 'edit', String(prNumber), '--remove-label', CI_LIFECYCLE_LABELS.checking];
  if (repo) argv.push('--repo', repo);
  exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
  return true;
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepMissingRunRecovery — THE IO SHELL for the missing-run pass
 * (xi4od2p, #4075/#3383). Mirrors {@link sweepCiRedRecovery}/{@link sweepHungCiRecovery}'s own read/plan/act
 * shape and injectability exactly — every reader/writer is injectable so the whole sweep is exercisable with no
 * network and no credential.
 * @param {{repo?:string|null, apply?:boolean, defaultBranch?:string, readOpenPrs?:Function,
 *   readRequiredContexts?:Function, readHeadCommittedAt?:Function, readAheadBy?:Function, readComments?:Function,
 *   trigger?:Function, postComment?:Function, clearLabel?:Function, thresholdMs?:number, maxRetriesPerSha?:number,
 *   now?:number}} [o]
 * @returns {{dispatch:Array<object>, refusals:Array<object>, applied:Array<object>}}
 */
export function sweepMissingRunRecovery({
  repo = null, apply = false, defaultBranch = 'main',
  readOpenPrs = defaultReadOpenPrs, readRequiredContexts = defaultReadRequiredContexts,
  readHeadCommittedAt = defaultReadHeadCommittedAt, readAheadBy = defaultReadAheadBy,
  readComments = defaultReadPrComments, trigger = triggerCiForPr, postComment = defaultPostMissingRunComment,
  clearLabel = clearStaleCheckingLabel, thresholdMs = DEFAULT_MISSING_RUN_THRESHOLD_MS,
  maxRetriesPerSha = DEFAULT_MAX_MISSING_RUN_RETRIES_PER_SHA, now = Date.now(),
} = {}) {
  const prs = readOpenPrs({ repo, extraFields: ['labels'] });
  const requiredContexts = readRequiredContexts({ repo, branch: defaultBranch });
  const rawCandidates = buildMissingRunCandidates(prs, { requiredContexts });
  const prByNumber = new Map((Array.isArray(prs) ? prs : []).map((pr) => [Number(pr?.number), pr]));
  // Every per-candidate extra read below only runs for a PR {@link buildMissingRunCandidates} already narrowed
  // to (zero required-check rollup entries at all) — mirrors {@link sweepCiRedRecovery}/{@link sweepHungCiRecovery}'s
  // own "pay for it only when needed" discipline; never one extra `gh` call per ordinary open PR on every tick.
  const candidates = rawCandidates.map((c) => {
    const headCommittedAt = readHeadCommittedAt(c.headSha, { repo });
    const aheadBy = c.headSha ? readAheadBy(c.headSha, { repo, base: defaultBranch }) : null;
    const comments = readComments(c.prNumber, { repo });
    return {
      ...c, headCommittedAt, aheadBy, triggerAttemptsForSha: countMissingRunComments(comments, c.headSha),
    };
  });
  const plan = planMissingRunRecoveries({
    candidates, now, thresholdMs, maxRetriesPerSha,
  });

  const applied = [];
  if (apply) {
    for (const d of plan.dispatch) {
      const result = trigger(d, { repo });
      // Posted on EVERY attempt, success or failure — same discipline as every sibling durable marker in this
      // file: a permanently-failing trigger must still trip {@link DEFAULT_MAX_MISSING_RUN_RETRIES_PER_SHA}'s cap.
      postComment(d.prNumber, {
        repo, headRefName: d.headRefName, headSha: d.headSha, ok: result.ok, action: result.action, error: result.error ?? null,
      });
      const pr = prByNumber.get(d.prNumber);
      const currentLabels = (Array.isArray(pr?.labels) ? pr.labels : [])
        .map((l) => (typeof l === 'string' ? l : l?.name))
        .filter(Boolean);
      const labelCleared = clearLabel(d.prNumber, { repo, currentLabels });
      applied.push({
        prNumber: d.prNumber, headRefName: d.headRefName, why: d.why, labelCleared, ...result,
      });
    }
  }
  return { ...plan, applied };
}

/** we:scripts/conveyor/ci-red-recovery-watch.mjs#formatMissingRunReport — one line per dispatch/refusal/applied
 *  result for the missing-run pass, mirroring {@link formatReport}/{@link formatHungReport}'s own shape. */
export function formatMissingRunReport({ dispatch = [], refusals = [], applied = [] } = {}) {
  const lines = [`ci-red-recovery-watch (missing-run) — ${dispatch.length} owed a trigger, ${refusals.length} refusal(s), ${applied.length} applied`];
  for (const d of dispatch) lines.push(`  → trigger-ci PR #${d.prNumber} (${d.headRefName ?? '?'}) — ${d.why}`);
  for (const r of refusals) if (r.kind !== 'not-overdue') lines.push(`  ✗ ${r.kind} PR #${r.prNumber} — ${r.why}`);
  for (const a of applied) lines.push(a.ok ? `  ✓ applied: ${a.action} PR #${a.prNumber}${a.labelCleared ? ' (cleared stale checking label)' : ''} — ${a.why ?? '(no reason recorded)'}` : `  ✗ apply ${a.action} PR #${a.prNumber} — ${a.error} (reason it was attempted: ${a.why ?? '(none)'})`);
  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** we:scripts/conveyor/ci-red-recovery-watch.mjs#formatReport — one line per dispatch/refusal/applied result,
 *  mirroring `reconcile-pass.mjs#formatReport`'s own "a pass that acts silently has reproduced the defect one
 *  level up" discipline. */
export function formatReport({ dispatch = [], refusals = [], applied = [] } = {}) {
  const lines = [`ci-red-recovery-watch — ${dispatch.length} owed a refresh, ${refusals.length} refusal(s), ${applied.length} applied`];
  for (const d of dispatch) lines.push(`  → rebase-onto-main PR #${d.prNumber} (${d.headRefName ?? '?'}) — ${d.why}`);
  for (const r of refusals) lines.push(`  ✗ ${r.kind} PR #${r.prNumber} — ${r.why}`);
  for (const a of applied) lines.push(a.ok ? `  ✓ applied: ${a.action} ${a.headRefName ?? '?'} onto main (PR #${a.prNumber})` : `  ✗ apply ${a.action} PR #${a.prNumber} ${a.headRefName ?? '?'} — ${a.error}`);
  return lines.join('\n');
}

async function main(argv) {
  const [verbRaw, ...rest] = argv;
  const verb = verbRaw && !verbRaw.startsWith('--') ? verbRaw : 'sweep';
  const flags = parseFlags(verbRaw && !verbRaw.startsWith('--') ? rest : argv);
  if (verb !== 'sweep') {
    writeLineSync(2, 'usage: ci-red-recovery-watch.mjs sweep [--repo=<owner/name>] [--apply] [--json]');
    process.exitCode = 2;
    return;
  }
  const repoFlag = typeof flags.repo === 'string' && flags.repo ? flags.repo : null;
  if (repoFlag && repoKeyForSlug(repoFlag) === null) {
    writeLineSync(2, `✗ ci-red-recovery-watch: --repo ${repoFlag} is not a constellation repo`);
    process.exitCode = 1;
    return;
  }
  const result = sweepCiRedRecovery({ repo: repoFlag, apply: !!flags.apply });
  // xd1sfms (#4075/#3383) — the hung-run pass runs in the SAME `sweep` invocation, never a separate CLI verb:
  // both watch the same open-PR listing for the same reason (a PR wrongly stuck on `checking`), and a daemon
  // manifest entry that already schedules this script (see `we:skills-src/conveyor/daemon-manifest.mjs`'s own
  // `ci-red-recovery-watch` entries) gets the hung-run fix for free rather than needing a second entry.
  const hungResult = sweepHungCiRecovery({ repo: repoFlag, apply: !!flags.apply });
  // xi4od2p (#4075/#3383) — the missing-run pass runs in the SAME `sweep` invocation too, for the identical
  // reason the hung-run pass was folded in above rather than given a second CLI verb: both watch the same
  // open-PR listing for the same reason (a PR wrongly stuck on `checking`), and the daemon-manifest entry that
  // already schedules this script gets the missing-run fix for free rather than needing a third entry.
  const missingRunResult = sweepMissingRunRecovery({ repo: repoFlag, apply: !!flags.apply });
  if (flags.json) {
    writeAllSync(1, `${JSON.stringify({ mainRedRecovery: result, hungRecovery: hungResult, missingRunRecovery: missingRunResult })}\n`);
  } else {
    writeLineSync(2, formatReport(result));
    writeLineSync(2, formatHungReport(hungResult));
    writeLineSync(2, formatMissingRunReport(missingRunResult));
  }
  process.exitCode = 0;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => {
    writeLineSync(2, `✗ ci-red-recovery-watch error: ${String((e && e.stack) || e)}`);
    process.exit(1);
  });
}
