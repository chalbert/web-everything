#!/usr/bin/env node
/**
 * @file scripts/conveyor/ci-red-recovery-watch.mjs
 * @description we:backlog/x5uqim1-*.md (parent #4075, epic #3383) — THE ACTUAL RE-RUN. `we:scripts/conveyor/
 *   reconcile-core.mjs`'s new `owed-ci-rerun` refusal (see its own docblock, and `we:scripts/conveyor/
 *   main-red-recovery.mjs`'s file header for the full 2026-09-25 incident) correctly stops `ci-heal` from
 *   misdiagnosing a red-`main`-caused failure as a code defect — but a refusal is not a repair. Something has
 *   to actually run `gh run rerun <id> --failed` once `main` recovers. This is that something.
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
 *     spend a session — for work that needs JUDGMENT. `gh run rerun <id> --failed` needs none: it is exactly
 *     the "script-decidable → hook, deterministic" case `we:docs/agent/platform-decisions.md
 *     #deterministic-core-thin-judgment` and this repo's own Hookable-vs-Judgment doctrine (MEMORY #51) both
 *     name. Routing it through an agent brief would spend a lane and a session on a mechanical CLI call, and
 *     — worse — would be the SAME kind of category error `ci-heal` misfiring on a red-`main` PR already is:
 *     handing judgment-shaped machinery a job that has none.
 *   - IS a per-repo `pass-daemon.mjs` watcher (`we:skills-src/conveyor/daemon-manifest.mjs`), the SAME shape as
 *     its siblings in this directory (`ci-queue-watch.mjs`, `parked-pr-conflict-watch.mjs`,
 *     `parked-pr-progress-watch.mjs`) — a periodic, read-mostly CI-state check with one narrow, IDEMPOTENT
 *     side effect (`we:scripts/conveyor/main-red-recovery.mjs#planCiRedReruns`'s own cap: one rerun per
 *     (PR, run), enforced by reading GitHub's OWN `attempt` counter back, no parallel store). It must survive a
 *     conveyor restart on its own, for the exact reason `reconcile-pass.mjs`'s own header gives for being a
 *     resident daemon rather than folded into the tick: the tick's bookkeeping (`launchedNums`) is
 *     session-ephemeral and dies with the session that launched it.
 *
 * PURE-CORE / IO-SHELL SPLIT, mirroring `ci-queue-watch.mjs`: the pure planner
 * ({@link module:./main-red-recovery.mjs.planCiRedReruns}) is imported, not re-derived; this file owns every
 * `gh` call and the CLI.
 *
 * `--apply` GATES THE REAL WRITE (`gh run rerun`), mirroring `we:scripts/conveyor/orphan-claim-release.mjs`'s
 * own convention: bare `sweep` is a DRY RUN (plans and reports, touches nothing on GitHub), `sweep --apply`
 * actually reruns. The daemon manifest entry always passes `--apply`; an operator running this by hand gets a
 * safe-by-default dry run.
 */
import { resolve } from 'node:path';
import { repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { execFileSyncThrottled } from '../lib/gh-throttle.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { latestRequiredCheck, isRequiredCheckFailed } from '../merge-ai-prs.mjs';
import {
  computeMainRedWindows, runIdFromDetailsUrl, planCiRedReruns,
  DEFAULT_MAIN_WORKFLOW_NAME, DEFAULT_REQUIRED_CHECK,
} from './main-red-recovery.mjs';
import { defaultReadMainRuns, defaultReadRunAttempt } from './reconcile-pass.mjs';

/** How many open PRs one sweep reads — mirrors `we:scripts/conveyor/reconcile-pass.mjs#PR_LIST_LIMIT`. */
export const PR_LIST_LIMIT = 200;

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#defaultReadOpenPrs — the narrow PR read this pass needs:
 * `number`, `headRefName` (evidence only) and `statusCheckRollup` (what `latestRequiredCheck` reads). `exec` is
 * injectable so the argv is assertable with no `gh` on PATH.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultReadOpenPrs({ exec = execFileSyncThrottled, repo = null } = {}) {
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT), '--json', 'number,headRefName,statusCheckRollup'];
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
 * {@link planCiRedReruns} wants: one row per PR whose required check is currently failing, with its failing
 * run's id/attempt/completion time resolved. `readRunAttempt` is called ONLY for a PR whose rollup resolves a
 * run id at all — a PR whose check failed with no `detailsUrl` (unreachable off a real CheckRun, defensive)
 * naturally reports `no-run-id` from the planner rather than throwing here.
 * @param {Array<object>} prs
 * @param {{requiredCheck?:string, readRunAttempt?:Function, repo?:string|null}} [o]
 * @returns {Array<{prNumber:number, headRefName:(string|null), runId:(number|null), attempt:(number|null), failureCompletedAt:(string|null)}>}
 */
export function buildCandidates(prs, { requiredCheck = DEFAULT_REQUIRED_CHECK, readRunAttempt = defaultReadRunAttempt, repo = null } = {}) {
  const out = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    if (!isRequiredCheckFailed(pr, requiredCheck)) continue;
    const prNumber = Number(pr?.number);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const check = latestRequiredCheck(pr, requiredCheck);
    const runId = runIdFromDetailsUrl(check?.detailsUrl);
    const attempt = runId != null ? readRunAttempt(runId, { repo }) : null;
    out.push({
      prNumber, headRefName: pr?.headRefName ?? null, runId, attempt,
      failureCompletedAt: check?.completedAt ?? null,
    });
  }
  return out;
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#rerunFailedJobs — `gh run rerun <id> --failed`, the ONE write
 * this pass ever performs. Reruns only the FAILED jobs of an existing run (never a fresh run, never the whole
 * matrix) — GitHub keeps the same `databaseId` and bumps its own `attempt` counter, which is exactly the
 * durable state {@link planCiRedReruns}'s cap reads back on the next sweep.
 * @param {number} runId
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {{ok:boolean, error?:string}}
 */
export function rerunFailedJobs(runId, { exec = execFileSyncThrottled, repo = null } = {}) {
  try {
    const argv = ['run', 'rerun', String(runId), '--failed'];
    if (repo) argv.push('--repo', repo);
    exec('gh', argv, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).split('\n')[0] };
  }
}

/**
 * we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery — THE IO SHELL. Read, plan, and — only with
 * `apply: true` — act. Every reader is injectable so the whole sweep is exercisable with no network and no
 * credential.
 * @param {{repo?:string|null, apply?:boolean, requiredCheck?:string, defaultBranch?:string,
 *   readOpenPrs?:Function, readMainRuns?:Function, readRunAttempt?:Function, rerun?:Function}} [o]
 * @returns {{dispatch:Array<object>, refusals:Array<object>, applied:Array<object>, mainRedWindows:Array<object>}}
 */
export function sweepCiRedRecovery({
  repo = null, apply = false, requiredCheck = DEFAULT_REQUIRED_CHECK, defaultBranch = 'main',
  readOpenPrs = defaultReadOpenPrs, readMainRuns = defaultReadMainRuns, readRunAttempt = defaultReadRunAttempt,
  rerun = rerunFailedJobs,
} = {}) {
  const prs = readOpenPrs({ repo });
  const candidates = buildCandidates(prs, { requiredCheck, readRunAttempt, repo });
  // The `gh run list --branch main` read only matters when there is at least one candidate to judge against it
  // — mirrors `reconcile-pass.mjs#enrichPrsWithMainRedFacts`'s own "pay for it only when needed" discipline.
  const mainRedWindows = candidates.length
    ? computeMainRedWindows(readMainRuns({ repo, branch: defaultBranch, workflowName: DEFAULT_MAIN_WORKFLOW_NAME }))
    : [];
  const plan = planCiRedReruns({ candidates, mainRedWindows });

  const applied = [];
  if (apply) {
    for (const d of plan.dispatch) {
      const result = rerun(d.runId, { repo });
      applied.push({ prNumber: d.prNumber, runId: d.runId, ...result });
    }
  }
  return { ...plan, applied, mainRedWindows };
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
  const lines = [`ci-red-recovery-watch — ${dispatch.length} owed rerun, ${refusals.length} refusal(s), ${applied.length} applied`];
  for (const d of dispatch) lines.push(`  → ci-rerun PR #${d.prNumber} run ${d.runId} — ${d.why}`);
  for (const r of refusals) lines.push(`  ✗ ${r.kind} PR #${r.prNumber} — ${r.why}`);
  for (const a of applied) lines.push(a.ok ? `  ✓ applied: gh run rerun ${a.runId} --failed (PR #${a.prNumber})` : `  ✗ apply failed PR #${a.prNumber} run ${a.runId} — ${a.error}`);
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
  if (flags.json) writeAllSync(1, `${JSON.stringify(result)}\n`);
  else writeLineSync(2, formatReport(result));
  process.exitCode = 0;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => {
    writeLineSync(2, `✗ ci-red-recovery-watch error: ${String((e && e.stack) || e)}`);
    process.exit(1);
  });
}
