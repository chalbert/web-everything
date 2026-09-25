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
import { latestRequiredCheck, isRequiredCheckFailed } from '../merge-ai-prs.mjs';
import { computeMainRedWindows, planMainRedRebases, DEFAULT_MAIN_WORKFLOW_NAME, DEFAULT_REQUIRED_CHECK } from './main-red-recovery.mjs';
import { defaultReadMainRuns, defaultReadAheadBy } from './reconcile-pass.mjs';
import { rebaseDropManifest } from '../lib/rebase-drop-manifest.mjs';
import { REPO_ROOT } from '../operations/dispatch-lane-io.mjs';

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
export function defaultReadOpenPrs({ exec = execFileSyncThrottled, repo = null } = {}) {
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT), '--json', 'number,headRefName,headRefOid,statusCheckRollup'];
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
      prNumber, headRefName: pr?.headRefName ?? null, aheadBy,
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
  refresh = refreshOntoMain,
} = {}) {
  const prs = readOpenPrs({ repo });
  const candidates = buildCandidates(prs, { requiredCheck, readAheadBy, repo, defaultBranch });
  // The `gh run list --branch main` read only matters when there is at least one candidate to judge against it
  // — mirrors `reconcile-pass.mjs#enrichPrsWithMainRedFacts`'s own "pay for it only when needed" discipline.
  const mainRedWindows = candidates.length
    ? computeMainRedWindows(readMainRuns({ repo, branch: defaultBranch, workflowName: DEFAULT_MAIN_WORKFLOW_NAME }))
    : [];
  const plan = planMainRedRebases({ candidates, mainRedWindows });

  const applied = [];
  if (apply) {
    for (const d of plan.dispatch) {
      const result = refresh(d.headRefName, { base: `origin/${defaultBranch}` });
      applied.push({ prNumber: d.prNumber, headRefName: d.headRefName, ...result });
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
