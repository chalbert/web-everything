/**
 * reconcile-pass.mjs — the thin IO shell around `we:scripts/conveyor/reconcile-core.mjs` (#3296): read the four
 * facts the pure pass needs, run it, and REPORT every dispatch and every refusal.
 *
 * A ONE-SHOT PASS, NOT A RESIDENT PROCESS. It reads, decides, prints and exits — the shape
 * `we:scripts/converge-daemon-pass.mjs` already argues for ("a `StartInterval` job is the whole daemon, and it
 * costs one plist"). Folding this into the conveyor tick was REFUSED on the evidence: that tick's bookkeeping
 * (`launchedNums`, `fixGuards`, `watched`) is piped in over STDIN and is session-ephemeral by construction, so a
 * reconciler living inside it would forget every PR the moment the session that launched them exited — which is
 * the exact defect being fixed, reintroduced one level down.
 *
 * WHAT THIS FILE ADDS, AND ALL IT ADDS: the impure facts the core cannot read.
 *   1. The open PRs — `gh pr list --state open --json number,headRefName,headRefOid,labels,statusCheckRollup,
 *      mergeStateStatus,comments`.
 *   2. The live sessions — `claude agents --json`, via `defaultListAgents`
 *      (`we:scripts/operations/dispatch-lane-io.mjs`), REUSED rather than rebuilt so the two callers can never
 *      ask the tool different questions.
 *   3. `laneHeadOid` per session — `git -C <cwd> rev-parse HEAD`. The listing carries no `pr`, `item`, `num`,
 *      `branch` or `ref` field on any entry (measured over all 17 live sessions), so the PR↔session binding must
 *      be derived, and this is the only derivation available today. It is a PROXY and it has been observed to be
 *      wrong (#3283), which is why the core carries the `cwd` and `sha` out to every liveness refusal.
 *   4. `pidAlive` per session — `process.kill(pid, 0)`. A `pid` is on only 13 of 17 entries; where it is absent
 *      this stays UNDEFINED and the core refuses as `liveness-unknown`. It must never be defaulted to `false`:
 *      absence of a field is not evidence of death.
 *   5. we:backlog/x5uqim1-*.md (#4075/#3383) — `main`'s own red-CI windows (`gh run list --branch main`) plus,
 *      per PR whose required check is currently failing, that check's own completion time and how far behind
 *      `main`'s current tip its head is (`gh api .../compare`'s own `ahead_by`, {@link enrichPrsWithMainRedFacts}).
 *      Read ONLY when at least one PR is failing, so a quiet pass pays nothing for it. Lets the core tell a
 *      required check that failed only because `main` itself was red apart from the PR's own defect
 *      (`reconcile-core.mjs#isPrCiFailureOwedRerun`), so it is never handed to a `ci-heal`.
 *
 * WHY THE ARGV IS PINNED BY A TEST AND NOT MERELY EXERCISED. The failure mode of a wrong discovery query is
 * SILENCE, not an error: an empty listing is indistinguishable from "no PR needs anything", so a query that
 * matches nothing looks exactly like a perfectly reconciled fleet. Every other case in
 * `reconcile-core.test.mjs` passes on injected fixtures and would stay green while this pass reconciled nothing
 * in production. `--state open` is the load-bearing flag here, and it is deliberately NOT the `--state all` that
 * `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs` pins for a different reader: that reader
 * resolves on MERGED PRs, this one reconciles OPEN ones, and copying the flag across would hide every PR this
 * pass exists to see. `headRefOid` is load-bearing for the same reason — without it the liveness binding has
 * nothing to compare a lane `HEAD` against, and every PR would read as unowned.
 *
 * IT DISPATCHES NOTHING ITSELF. The pass decides that a fix or a review is OWED and reports it; spawning the
 * independent reviewer is #3279's operation and running the review loop is #3072. Emitting a plan a caller acts
 * on keeps this pass a READ, which is what makes it safe to run on an interval.
 *
 * SINGLETON-LEASED THE WAY `we:scripts/review-runner.mjs` LEASES — the lease belongs to whatever schedules this
 * (the plist / the conveyor), not to the read itself, and is NOT taken here: two concurrent reads of a PR list
 * cannot corrupt anything, and a lease taken inside a one-shot read is a lease nothing releases when the process
 * is killed.
 */
import { repoKeyForSlug, CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';
// #2748 false-red follow-up (soak-replay-gate, PR #2775) — the repo's REQUIRED status-check names, live +
// cached (`we:scripts/lib/required-status-checks.mjs`), so `planReconcile`'s `ci-red` branch means a REQUIRED
// check failed rather than "any check outside a hand-maintained exclusion list" — see that module's own header
// for the full incident this closes. Anchored at the TOP of the import block (rather than beside the other
// `reconcile-core.mjs`-adjacent imports below) so it never collides with an overlay editing that region.
import { getRequiredStatusChecks } from '../lib/required-status-checks.mjs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { execFileSyncThrottled } from '../lib/gh-throttle.mjs';
import { readSharedOpenPrs } from '../lib/pr-snapshot.mjs';
import { readPrsFromFile } from './open-pr-fetch.mjs';
import { defaultListAgents } from '../operations/dispatch-lane-io.mjs';
import { listAgentsWithReviewJobs } from '../operations/review-job-store.mjs';
import { countRearmComments } from './rearm-review.mjs';
import { planReconcile, DISPATCH_KINDS, REFUSAL_KINDS, markSelfReportedDone, markHungSessions, markAuthExpiredSessions, markIdleFinishedSessions, markBgIsolationStalls } from './reconcile-core.mjs';
import { tryReadCompletion } from '../operations/completion-store.mjs';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
// we:backlog/x5uqim1-*.md (#4075/#3383) — the two extra facts `reconcile-core.mjs#isPrCiFailureOwedRerun` needs
// per `ci-red` PR, plus `main`'s own red windows. `latestRequiredCheck`/`isRequiredCheckFailed` are REUSED from
// `we:scripts/merge-ai-prs.mjs` (never re-derived) — the same collapsed-rollup reader every other required-check
// consumer in this repo already shares.
import { latestRequiredCheck, isRequiredCheckFailed } from '../merge-ai-prs.mjs';
import { computeMainRedWindows, DEFAULT_MAIN_WORKFLOW_NAME, DEFAULT_REQUIRED_CHECK, DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS, failingRequiredCheckForAttribution, isAnyRequiredCheckFailed } from './main-red-recovery.mjs';
import { readHungInfo, resolveHungThresholdMs, readClaudeAuthExpiredInfo, readIdleFinishedInfo, resolveIdleFinishedThresholdMs } from './hung-session.mjs';
import { readBgIsolationStallInfo } from './bg-isolation-stall.mjs';

/**
 * we:scripts/conveyor/reconcile-pass.mjs#PR_LIST_JSON_FIELDS — the `--json` fields this pass reads about each
 * open PR. Named once so the test can assert the literal query and a dropped field reddens rather than going
 * quiet. Every one is load-bearing:
 *   `number`            — THE KEY. This pass is keyed by PR number, never item number (all four open head refs
 *                         measured today return `null` from `laneRefItemNum`).
 *   `headRefName`       — human evidence on every row, so a reader can find the branch.
 *   `headRefOid`        — the liveness binding compares it against a lane's `HEAD`. Without it nothing binds.
 *   `labels`            — what `classifyPr` reads for the phase.
 *   `statusCheckRollup` — what `classifyPr` and `reduceCheckState` read for CI truth.
 *   `mergeStateStatus`  — what `classifyPr` reads to spot a conflicted / behind branch.
 *   `comments`          — the durable thread: the findings count, the re-arm count, and the stand-down marker
 *                         all come off it. Dropping it silently zeroes all three.
 *   `body`              — `#xu2krte` Fork 1: `we:scripts/conveyor/reconcile-fix-dispatch.mjs` reads the PR's own
 *                         `authored-by-actor` stamp off it to find a conflict-caused bounce's original builder
 *                         session, for the opt-in resume-preference dispatch. Unused by every other decision.
 *   `baseRefName`       — #3383: what `reconcile-core.mjs`'s STACKED-BASE CONFLICT branch compares against
 *                         `defaultBranch` to tell a PR stacked on another lane/PR (the drain will never land it,
 *                         whatever its labels say) apart from an ordinary conflict against `main`. Dropping it
 *                         silently sends every `conflicted` PR back through the pre-#3383 `owed-elsewhere` path.
 */
export const PR_LIST_JSON_FIELDS = 'number,headRefName,headRefOid,baseRefName,labels,statusCheckRollup,mergeStateStatus,comments,body';

/** How many open PRs one pass reads. The board's own `OPEN_LIMIT` is 30; a reconciler that silently stopped at
 *  the default page would leave the overflow unowned, which is this item's defect wearing a smaller hat. */
export const PR_LIST_LIMIT = 200;

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadPrs — the OPEN-PR discovery query. `exec` is injectable so
 * the argv is assertable with no `gh` on PATH and no credential.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultReadPrs({ exec = execFileSyncThrottled, repo = null } = {}) {
  // #gh-graphql-budget — read the host-shared open-PR snapshot (one right-sized list per repo per TTL for the
  // whole fleet) instead of a private `gh pr list`; null = not applicable (tests, cwd repo) → the direct read below.
  if (exec === execFileSyncThrottled) { const shared = readSharedOpenPrs({ repo, fields: PR_LIST_JSON_FIELDS }); if (shared) return shared; }
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT), '--json', PR_LIST_JSON_FIELDS];
  if (repo) argv.push('--repo', repo);
  // #x5n4zn3 — was bare (no timeout).
  const out = exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadAgents — the live-session listing. A THIN DELEGATION to
 * `defaultListAgents` (`we:scripts/operations/dispatch-lane-io.mjs`), not a second builder of the same argv: one
 * caller asking `claude agents --json` a different way than another is precisely the drift that makes two halves
 * of one chain disagree about what is alive.
 * ALSO runs {@link markHungSessions} (epic #3383 continuation) after the self-reported-done pre-pass, so a
 * session neither `state: 'done'` nor self-reported but whose OWN transcript file has gone stale (per
 * `we:scripts/conveyor/hung-session.mjs`) also stops reading as `live-process` in {@link
 * planReconcile}/`assessLiveness` — the mechanical backstop for exactly the case a crashed review agent's
 * unreported infra failure leaves behind (`review-agent-brief.md`'s "report done on exit" is prose, and prose
 * is not guaranteed to run).
 * THEN runs {@link markAuthExpiredSessions} (live incident, night of 2026-09-25/26 ET) after that, so a
 * session whose OWN transcript shows the Claude CLI's own auth-failure (see that function's own doc for the
 * full incident) ALSO stops reading as `live-process` — this one catches the failure the INSTANT it shows in
 * the transcript, rather than waiting out the generic hung-transcript threshold.
 * FINALLY (both epic #3383/#4075) runs {@link markIdleFinishedSessions} (live incident PR #2724, 2026-09-26)
 * — a backstop for EVERY kind, not only the ones with a completion-record schema: a session whose last
 * assistant turn has genuinely ENDED (no pending tool call) and has sat idle past a short threshold is
 * treated as finished, in case a brief forgets to report its own completion the way `fix-agent-ci-brief.md`
 * did — AND {@link markBgIsolationStalls} (#x9fbg1x, live incident `fix-2748`/`fix-2770`, 2026-09-26), which
 * gives a session `assessLiveness` already reports `awaiting-permission` a MORE SPECIFIC reason when its own
 * transcript shows Claude Code's own background-session worktree-isolation guard refusal — see
 * `we:scripts/conveyor/bg-isolation-stall.mjs`'s own header. Cheap: it reads a transcript only for a session
 * already classified `awaiting-permission`, never for the common live/finished case.
 * @param {{exec?:Function, env?:object, completionFor?:Function, hungInfoFor?:Function, authExpiredInfoFor?:Function, idleFinishedInfoFor?:Function, bgIsolationStallInfoFor?:Function, now?:number, hungThresholdMs?:number, idleFinishedThresholdMs?:number, listJobs?:Function}} [o]
 *   `listJobs` (x26lw6u) defaults to the live review-job rows; a test injects `() => []` or fakes.
 * @returns {Array<object>}
 */
export function defaultReadAgents({
  exec = execFileSync, env = process.env, completionFor = tryReadCompletion,
  hungInfoFor = readHungInfo, now = Date.now(), hungThresholdMs = resolveHungThresholdMs(env),
  authExpiredInfoFor = readClaudeAuthExpiredInfo,
  idleFinishedInfoFor = readIdleFinishedInfo, idleFinishedThresholdMs = resolveIdleFinishedThresholdMs(env),
  bgIsolationStallInfoFor = readBgIsolationStallInfo,
  listJobs = undefined,
} = {}) {
  // x26lw6u — a review now runs as a JOB (`we:scripts/operations/review-job.mjs`), not a `claude --bg` session,
  // so it has no listing row of its own. Its live job record is merged in as a row of the same shape (name
  // `review-<pr>`, `state: 'working'`, `pid`) — `bindAgents` then binds it by name and `assessLiveness` reads its
  // pid, so a PR with a review job in flight is refused `live-process` exactly as a live review session was.
  const listed = listAgentsWithReviewJobs({ listAgents: () => defaultListAgents({ exec, env }), listJobs });
  // xpb0zyq — a session that already wrote its own completion record is finished, whatever the listing says.
  const selfReported = markSelfReportedDone(Array.isArray(listed) ? listed : [], completionFor, now);
  // #3383 continuation — a session whose OWN transcript has gone stale is finished too, self-report or not.
  const hungMarked = markHungSessions(selfReported, hungInfoFor, now, hungThresholdMs);
  // Live incident fix, night of 2026-09-25/26 ET — a session whose OWN transcript shows the Claude CLI's own
  // auth failure is finished too, whatever the listing's `state`/pid say.
  const authMarked = markAuthExpiredSessions(hungMarked, authExpiredInfoFor);
  // #4075/xg7m2wq, live incident PR #2724, 2026-09-26 — the general backstop for EVERY kind: a session whose
  // last assistant turn has fully ended (no pending tool call) and has sat idle past a short threshold is
  // finished too, in case its own brief forgot to report completion the way `fix-agent-ci-brief.md` did.
  const idleMarked = markIdleFinishedSessions(authMarked, idleFinishedInfoFor, now, idleFinishedThresholdMs);
  // #x9fbg1x — LAST: only ever adds a clearer reason to a row already `awaiting-permission`, so running it
  // after every other pre-pass (which can only ever REMOVE a session from `live-process` contention, never add
  // `awaiting-permission`) is safe regardless of ordering.
  return markBgIsolationStalls(idleMarked, bgIsolationStallInfoFor);
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#resolveLaneHead — `git -C <cwd> rev-parse HEAD`, or `null`.
 *
 * FAILS TO `null`, NEVER TO A GUESS. A cwd that is not a git checkout, was deleted under a live session, or is
 * simply unreadable produces `null`, and `bindAgents` then binds NOTHING for that session. That direction is the
 * safe one only because of what sits behind it: an unbound session cannot suppress a dispatch, and a PR that is
 * genuinely being worked will still be caught by any OTHER session bound to it. The unsafe direction would be
 * defaulting to a sha, which would bind arbitrary sessions to arbitrary PRs.
 * @param {string} cwd
 * @param {Function} [exec]
 * @returns {string|null}
 */
export function resolveLaneHead(cwd, exec = execFileSync) {
  if (!cwd) return null;
  try {
    const out = exec('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000,
    });
    const sha = String(out || '').trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#probePid — `process.kill(pid, 0)`, three-valued.
 *
 * `true` = the process exists. `false` = it provably does not (`ESRCH`). `null` = THE QUESTION COULD NOT BE
 * ASKED — no `pid` on the entry (4 of 17 today), a non-integer, or `EPERM` (the process exists but belongs to
 * another user, which is emphatically not death). `null` reaches the core as UNKNOWN and refuses. Defaulting any
 * of these to `false` would report a live agent as idle and hand its lane to a second one.
 * @param {*} pid
 * @param {Function} [kill]
 * @returns {boolean|null}
 */
export function probePid(pid, kill = (p, s) => process.kill(p, s)) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    kill(pid, 0);
    return true;
  } catch (e) {
    if (e && e.code === 'ESRCH') return false;
    if (e && e.code === 'EPERM') return true; // it exists; it just is not ours to signal.
    return null;
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#enrichAgents — attach the two facts the listing cannot carry
 * (`laneHeadOid`, `pidAlive`) to each session entry, leaving every field the tool DID return untouched.
 *
 * `pidAlive` is OMITTED, not set to `null`, when the probe could not answer — an absent key and an explicit
 * `null` mean the same thing to the core (`!== false` ⇒ unknown), and omitting keeps the enriched record a
 * faithful superset of what `claude agents --json` actually returned.
 * @param {Array<object>} agents
 * @param {{readLaneHead?:Function, probe?:Function}} [io]
 * @returns {Array<object>}
 */
export function enrichAgents(agents, { readLaneHead = resolveLaneHead, probe = probePid } = {}) {
  const headCache = new Map();
  return (Array.isArray(agents) ? agents : []).map((a) => {
    const cwd = String(a?.cwd ?? '');
    if (cwd && !headCache.has(cwd)) headCache.set(cwd, readLaneHead(cwd));
    const alive = probe(Number.isInteger(a?.pid) ? a.pid : null);
    return {
      ...a,
      laneHeadOid: cwd ? headCache.get(cwd) : null,
      ...(alive === null ? {} : { pidAlive: alive }),
    };
  });
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#durableCountsFrom — the restart-surviving attempt count per PR, read
 * back off each PR's own comment thread with `countRearmComments`. The count IS PR state; no parallel store
 * exists and none is created (#2612).
 * @param {Array<object>} prs
 * @returns {object} `{ [prNumber]: n }`
 */
export function durableCountsFrom(prs) {
  const out = {};
  for (const pr of Array.isArray(prs) ? prs : []) {
    const n = Number(pr?.number);
    if (Number.isInteger(n) && n > 0) out[n] = countRearmComments(pr?.comments);
  }
  return out;
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadMainRuns — `main`'s own recent run history for one
 * workflow, the ONE read `we:scripts/conveyor/main-red-recovery.mjs#computeMainRedWindows` needs. `exec` is
 * injectable so the argv is assertable with no `gh` on PATH.
 * @param {{exec?:Function, repo?:string|null, branch?:string, workflowName?:string, limit?:number}} [o]
 * @returns {Array<object>}
 */
export function defaultReadMainRuns({
  exec = execFileSyncThrottled, repo = null, branch = 'main', workflowName = DEFAULT_MAIN_WORKFLOW_NAME, limit = 100,
} = {}) {
  const argv = ['run', 'list', '--branch', branch, '--limit', String(limit), '--json', 'databaseId,conclusion,status,createdAt,updatedAt,workflowName'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
    timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
  });
  const parsed = JSON.parse(String(out || '[]'));
  return (Array.isArray(parsed) ? parsed : []).filter((r) => r?.workflowName === workflowName);
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadAheadBy — how many commits `base`'s current tip has that
 * `headSha` lacks (`GET /repos/.../compare/<headSha>...<base>`'s own `ahead_by`) — `0` once `headSha` already
 * contains `base`'s tip. CORRECTED mid-build from an earlier `gh run view --json attempt` design: live-measured
 * that rerunning a GitHub Actions run does NOT re-test against a refreshed `main` (same commit, same result),
 * so "has this PR been given a fresh look against current main" must be answered from the git graph itself, not
 * from a run's own retry counter — see `we:scripts/conveyor/main-red-recovery.mjs`'s file header for the full
 * story. `{owner}/{repo}` resolves from `repo` when given, else from this checkout's own git remote (mirrors
 * `we:scripts/conveyor/reconcile-fix-dispatch.mjs#fetchCardScopeAtRef`'s identical placeholder). Best-effort:
 * ANY failure (no `gh`, an unresolvable sha, a network hiccup) degrades to `null` — never thrown — so one bad
 * read cannot break the whole pass; `isPrCiFailureOwedRerun` already treats an unknown `aheadBy` as "not yet
 * refreshed" (the safe direction — see its own docblock).
 * @param {string} headSha
 * @param {{exec?:Function, repo?:string|null, base?:string}} [o]
 * @returns {number|null}
 */
export function defaultReadAheadBy(headSha, { exec = execFileSyncThrottled, repo = null, base = 'main' } = {}) {
  try {
    const endpoint = `repos/${repo || '{owner}/{repo}'}/compare/${headSha}...${base}`;
    const out = exec('gh', ['api', '--method', 'GET', endpoint, '--jq', '.ahead_by'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
    });
    const n = Number(String(out || '').trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#enrichPrsWithMainRedFacts — we:backlog/x5uqim1-*.md (#4075/#3383):
 * attach `requiredCheckCompletedAt` / `aheadByOnMain` to every PR whose required check is currently FAILING, and
 * return `main`'s own red windows alongside — the two facts `reconcile-core.mjs#isPrCiFailureOwedRerun` needs,
 * so a `ci-heal` is never dispatched for a failure that was never this PR's own.
 *
 * PAYS THE EXTRA `gh run list --branch main` READ ONLY WHEN AT LEAST ONE PR NEEDS IT — a pass with nothing
 * currently `ci:failed` (the common case) costs nothing beyond the `latestRequiredCheck` scan it already had
 * every field for. `requiredCheckCompletedAt` comes off the ALREADY-FETCHED `statusCheckRollup` (no extra call);
 * only `aheadByOnMain` needs a fresh `gh api .../compare` read per failing PR, keyed off `headRefOid`
 * (already fetched by `defaultReadPrs`'s own `PR_LIST_JSON_FIELDS`).
 * @param {Array<object>} prs
 * soak-main-red (2026-09-26): judged across EVERY required check (`requiredChecks`, default
 * `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` = test/smoke/daemon-soak), not `test` alone — a PR red only on
 * `daemon-soak` while `main`'s own soak was red is owed a rebase, never a ci-heal. `requiredCheck` (singular,
 * legacy) still narrows to exactly that one check when a caller passes it.
 * @param {Array<object>} prs
 * @param {{readMainRuns?:Function, readAheadBy?:Function, requiredCheck?:string, requiredChecks?:string[], defaultBranch?:string, repo?:string|null}} [o]
 * @returns {{prs:Array<object>, mainRedWindows:Array<object>}}
 */
export function enrichPrsWithMainRedFacts(prs, {
  readMainRuns = defaultReadMainRuns, readAheadBy = defaultReadAheadBy,
  requiredCheck = null, requiredChecks = DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS, defaultBranch = 'main', repo = null,
} = {}) {
  const checks = requiredCheck ? [requiredCheck] : requiredChecks;
  const list = Array.isArray(prs) ? prs : [];
  const failing = list.filter((pr) => isAnyRequiredCheckFailed(pr, checks));
  if (!failing.length) return { prs: list, mainRedWindows: [] };

  const mainRedWindows = computeMainRedWindows(readMainRuns({ repo, branch: defaultBranch }));
  const failingSet = new Set(failing);
  const enriched = list.map((pr) => {
    if (!failingSet.has(pr)) return pr;
    const check = failingRequiredCheckForAttribution(pr, { requiredChecks: checks, mainRedWindows });
    const aheadBy = pr?.headRefOid ? readAheadBy(pr.headRefOid, { repo, base: defaultBranch }) : null;
    return { ...pr, requiredCheckCompletedAt: check?.completedAt ?? null, requiredCheckName: check?.name ?? null, aheadByOnMain: aheadBy };
  });
  return { prs: enriched, mainRedWindows };
}

// live incident, chalbert/web-everything PR #2752 (#4034/#2748) — see `we:scripts/lib/already-landed-content.mjs`'s
// own header for the incident and why per-file BLOB IDENTITY against `main`'s own history is the signal, not a
// plain merge-tree/current-content diff.
import { CONFLICT_LABEL } from './conflict-label.mjs';
import {
  computeAlreadyLandedVerdict, attributeCarrierPr, parseRawDiffZ, addedContentIntact,
} from '../lib/already-landed-content.mjs';

/** How many of `main`'s own commits touching one file this pass will scan for a blob match, most-recent-first,
 *  before giving up on that file (mirrors `we:scripts/backlog-stranded-sweep.mjs#AUTO_SWEEP_LOG_LIMIT`'s own
 *  "bounded, not silently widened" doctrine). NEVER GUESS past the window: a file whose match sits further back
 *  simply reads as `matchedCommit: null` for this pass — the safe direction (falls through to the ordinary
 *  dispatch paths, exactly as if this whole detector did not exist). */
export const ALREADY_LANDED_LOG_WINDOW = 300;

/** Bare label-name membership test, matching `gh --json labels`'s tolerant `{name}`-or-bare-string shape
 *  (mirrors `we:scripts/conveyor/duplicate-pr-watch.mjs#hasLabelNamed`, not imported from that file so this
 *  module never pulls in its unrelated duplicate-PR detection machinery for one boolean check). */
function hasLabel(labels, name) {
  return (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter(Boolean)
    .includes(name);
}

/** A full or abbreviated hex commit id — the only shape the git calls below ever put in a revision position. */
const SHA_RE = /^[0-9a-f]{7,64}$/;
/** The branch name shape `origin/<defaultBranch>` is built from — never dash-leading, never a range/revspec. */
const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;
const isSha = (s) => typeof s === 'string' && SHA_RE.test(s);
const mainRefFor = (defaultBranch) =>
  (typeof defaultBranch === 'string' && BRANCH_RE.test(defaultBranch) && !defaultBranch.startsWith('-')
    ? `origin/${defaultBranch}` : null);
/** `git --literal-pathspecs`: a changed path is matched as the literal file it names, never as a glob. */
const GIT_LITERAL = ['--literal-pathspecs'];

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultFetchRef — best-effort fetch of the PR's own head, so a commit
 * this checkout may never have seen is present locally before it is read. Never throws — a fetch failure just
 * means the reads below fail closed (never landed).
 *
 * KEYED ON THE PR NUMBER, NEVER ON `headRefName` (PR #2769 security review). A PR's branch name is fully
 * author-controlled, and git accepts a dash-leading one (`--upload-pack=<cmd>`), which the earlier bare
 * `git fetch origin <headRefName>` would parse as an OPTION — measured to run an arbitrary command against a
 * local-path remote. The ref fetched here is built from a validated positive integer (`refs/pull/<n>/head`),
 * behind `--end-of-options`, into an EXPLICIT destination — the same shape
 * `we:scripts/fetch-parked.mjs#resolveNetDiff` adopted when #2373 banned the bare opportunistic form.
 * @param {number} prNumber
 * @param {{exec?:Function, remote?:string}} [o]
 */
export function defaultFetchRef(prNumber, { exec = execFileSync, remote = 'origin' } = {}) {
  const n = Number(prNumber);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== String(prNumber)) return;
  try {
    // A private namespace, not `refs/remotes/…`: never collides with a real upstream branch, and stays out of
    // every remote-tracking-ref scan the lane tooling runs.
    exec('git', ['fetch', '--quiet', '--end-of-options', remote, `+refs/pull/${n}/head:refs/already-landed/pr/${n}`], {
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    });
  } catch { /* best-effort — the reads below degrade to null, never to a guess */ }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadMergeBase — the PR head's merge-base with `mainRef`, or
 * `null`. This is the lower bound of the `<base>..main` search window (see
 * `we:scripts/lib/already-landed-content.mjs`'s own header for why a pre-base match is never delivery).
 * @param {string} headSha
 * @param {string} mainRef
 * @param {{exec?:Function}} [o]
 * @returns {string|null}
 */
export function defaultReadMergeBase(headSha, mainRef, { exec = execFileSync } = {}) {
  if (!isSha(headSha) || !mainRef) return null;
  try {
    const out = String(exec('git', ['merge-base', '--end-of-options', headSha, mainRef], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000,
    }) || '').trim();
    return isSha(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadChanges — what the PR changes relative to its merge-base,
 * with status, destination mode and blob per path (`git diff --raw -z --no-renames`, parsed by
 * `we:scripts/lib/already-landed-content.mjs#parseRawDiffZ`). Replaces an earlier `gh pr view --json files`
 * path list, which could not see a rename's source, a mode change, or a deletion (PR #2769 review).
 * @param {string} base
 * @param {string} headSha
 * @param {{exec?:Function}} [o]
 * @returns {Array<{status:string, path:string, dstMode:string, dstBlob:string}>}
 */
export function defaultReadChanges(base, headSha, { exec = execFileSync } = {}) {
  if (!isSha(base) || !isSha(headSha)) return [];
  try {
    const out = exec('git', ['diff', '--raw', '-z', '--no-renames', '--no-abbrev', '--end-of-options', base, headSha], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000, maxBuffer: 16 * 1024 * 1024,
    });
    return parseRawDiffZ(out);
  } catch {
    return [];
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadEntryAt — the `{mode, blob}` a path holds at a commit
 * (`git ls-tree`), or `null` when the path does not exist there. Mode travels with the blob so a mode-only
 * change is never matched by the unchanged blob alone.
 *
 * THROWS when the read itself fails (a bad revision, a timeout, a locked repo) — it never returns `null` for
 * that, because `null` means "absent" and a deletion counts as landed on absence (PR #2769 review, round 2: a
 * failed tip read once passed for "gone from main"). {@link defaultFindMatchingMainCommit} catches and fails
 * closed.
 * @param {string} ref
 * @param {string} file
 * @param {{exec?:Function}} [o]
 * @returns {{mode:string, blob:string}|null}
 */
export function defaultReadEntryAt(ref, file, { exec = execFileSync } = {}) {
  if (!ref || !file) throw new Error('defaultReadEntryAt: ref and file are required');
  const out = String(exec('git', [...GIT_LITERAL, 'ls-tree', '-z', '--full-tree', '--end-of-options', ref, '--', file], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000,
  }) || '');
  for (const rec of out.split('\0')) {
    const m = /^(\d{6}) \w+ ([0-9a-f]{7,64})\t(.*)$/s.exec(rec);
    if (m && m[3] === file) return { mode: m[1], blob: m[2] };
  }
  return null;
}

const BLOB_READ = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000, maxBuffer: 16 * 1024 * 1024 };

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultTipCarriesChange — does `main`'s tip blob still carry the PR's
 * change to one file, when the tip is NOT the PR's exact blob (`main` edited the file after carrying it)?
 *   - edited file (`baseBlob` set): a real three-way merge — `git merge-file -p --object-id <tip> <base> <pr>` —
 *     must be conflict-free AND produce the tip byte-for-byte. That is "merging the PR into `main` changes
 *     nothing": every change the PR made is already there, whatever `main` did around it. It replaced a
 *     hunk-position check that repeated lines (`}`, blank lines) could fool into calling a revert "preserved"
 *     (PR #2769 review, round 2 self-review).
 *   - added file (`baseBlob` null): `we:scripts/lib/already-landed-content.mjs#addedContentIntact` — git's empty
 *     blob is not guaranteed to exist in the object store, and an add/add merge conflicts on any difference.
 * A conflict, a binary file, or any git failure (`merge-file --object-id` needs git ≥ 2.44) THROWS or returns
 * false; the caller fails closed.
 * @param {string} tipBlob
 * @param {string|null} baseBlob
 * @param {string} prBlob
 * @param {{exec?:Function}} [o]
 * @returns {boolean}
 */
export function defaultTipCarriesChange(tipBlob, baseBlob, prBlob, { exec = execFileSync } = {}) {
  if (!isSha(tipBlob) || !isSha(prBlob) || (baseBlob !== null && !isSha(baseBlob))) return false;
  const readBlob = (b) => String(exec('git', ['cat-file', 'blob', '--end-of-options', b], BLOB_READ) ?? '');
  const tipText = readBlob(tipBlob);
  if (baseBlob === null) return addedContentIntact(tipText, readBlob(prBlob));
  // Exits non-zero on a conflict (or a binary file), which execFileSync throws on.
  const merged = String(exec('git', ['merge-file', '-p', '--object-id', '--end-of-options', tipBlob, baseBlob, prBlob], BLOB_READ) ?? '');
  return merged === tipText;
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultFindMatchingMainCommit — the commit on `<base>..mainRef` that
 * delivered this one change to `main`, or `null`. Per status:
 *   - `A`/`M`: the first commit (most-recent-first, capped at {@link ALREADY_LANDED_LOG_WINDOW}) whose entry for
 *     the path has the SAME blob AND mode the PR's head has. Robust to a rebase (blob identity ignores graph
 *     shape) and to later refinement on `main` (the match can sit anywhere in the window, not just at the tip).
 *     `main`'s tip must still CARRY the change: same mode, and either the PR's exact blob or a later edit that
 *     left the PR's change intact ({@link defaultTipCarriesChange}).
 *     A carry that `main` later reverted, or whose PR lines `main` moved on, is not delivery. The log is not
 *     `--first-parent`, so a side-branch commit merged into `main` can be the match (git's default history
 *     simplification already drops side branches whose net change to the path is zero).
 *   - `D`: the path must be absent from `mainRef`'s tip — a SUCCESSFUL read that finds nothing, never a failed
 *     one — and the deleting commit must sit in the window.
 *   - anything else (`T`ype change, unmerged, unknown): unsupported → `null`, never a guess.
 * Any failed git read makes the whole answer `null`. Bounded below by the PR's own merge-base: see
 * `we:scripts/lib/already-landed-content.mjs`'s header for why a match that predates it (a deliberate
 * restoration) is never delivery.
 * @param {{status:string, path:string, dstMode:string, dstBlob:string}} change
 * @param {{base:string, mainRef:string, exec?:Function, windowLimit?:number, readEntryAt?:Function,
 *   tipCarriesChange?:Function}} o
 * @returns {string|null}
 */
export function defaultFindMatchingMainCommit(change, {
  base, mainRef, exec = execFileSync, windowLimit = ALREADY_LANDED_LOG_WINDOW, readEntryAt = defaultReadEntryAt,
  tipCarriesChange = defaultTipCarriesChange,
} = {}) {
  const path = change?.path;
  if (!path || !isSha(base) || !mainRef) return null;
  const logWindow = (extra) => {
    const out = exec('git', [...GIT_LITERAL, 'log', '--format=%H', `-n${windowLimit}`, ...extra, `${base}..${mainRef}`, '--', path], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000, maxBuffer: 16 * 1024 * 1024,
    });
    return String(out || '').split('\n').filter(Boolean);
  };
  try {
    if (change.status === 'D') {
      if (readEntryAt(mainRef, path, { exec }) !== null) return null; // still alive on main — not delivered
      return logWindow(['--diff-filter=D'])[0] || null;
    }
    if (change.status !== 'A' && change.status !== 'M') return null;
    if (!change.dstBlob || !change.dstMode) return null;
    // A match inside the window is not enough if `main` later UNDID it — wholly (a revert, deleting an added
    // file) or in part (an edit to a line the PR wrote): main's tip must still carry the PR's change.
    const tip = readEntryAt(mainRef, path, { exec });
    if (!tip || tip.mode !== change.dstMode) return null;
    if (tip.blob !== change.dstBlob) {
      const atBase = change.status === 'M' ? readEntryAt(base, path, { exec }) : null;
      if (change.status === 'M' && !atBase) return null;
      if (!tipCarriesChange(tip.blob, atBase ? atBase.blob : null, change.dstBlob, { exec })) return null;
    }
    for (const c of logWindow([])) {
      const e = readEntryAt(c, path, { exec });
      if (e && e.blob === change.dstBlob && e.mode === change.dstMode) return c;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#defaultReadPullsForCommit — the PR number(s) GitHub associates with one
 * commit (`GET /repos/{o}/{r}/commits/{sha}/pulls`) — the attribution primitive
 * `we:scripts/lib/already-landed-content.mjs#attributeCarrierPr` needs, one call per DISTINCT matched commit.
 * @param {string} sha
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {number[]}
 */
export function defaultReadPullsForCommit(sha, { exec = execFileSyncThrottled, repo = null } = {}) {
  try {
    const endpoint = `repos/${repo || '{owner}/{repo}'}/commits/${sha}/pulls`;
    const out = exec('gh', ['api', endpoint, '--jq', '.[].number'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL',
    });
    return String(out || '').split('\n').filter(Boolean).map(Number).filter(Number.isInteger);
  } catch {
    return [];
  }
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#enrichPrsWithAlreadyLandedFacts — live incident, chalbert/web-everything
 * PR #2752 (#4034/#2748): attach `alreadyLandedInMain: {carrierPr}` to any open PR whose own content is already,
 * file-by-file, present on `main` — see `we:scripts/lib/already-landed-content.mjs`'s own header for the full
 * incident and why this needs blob identity rather than a plain diff.
 *
 * PAYS THE EXTRA READS ONLY FOR A PR CARRYING `merge-status:conflicting` — the population
 * `we:scripts/conveyor/parked-pr-conflict-watch.mjs` already narrows this to (a real merge conflict on a
 * review-parked PR), and the ONLY phase `reconcile-core.mjs`'s own `isConflictBounce` would otherwise dispatch a
 * mechanical conflict-fix for. A pass with no such PR (the common case) costs nothing beyond the label scan
 * `defaultReadPrs` already fetched every field for.
 * @param {Array<object>} prs
 * @param {{fetchRef?:Function, readMergeBase?:Function, readChanges?:Function, findMatchingCommit?:Function,
 *   readPulls?:Function, repo?:string|null, defaultBranch?:string}} [o]
 * @returns {Array<object>}
 */
export function enrichPrsWithAlreadyLandedFacts(prs, {
  fetchRef = defaultFetchRef, readMergeBase = defaultReadMergeBase, readChanges = defaultReadChanges,
  findMatchingCommit = defaultFindMatchingMainCommit, readPulls = defaultReadPullsForCommit,
  repo = null, defaultBranch = 'main',
} = {}) {
  const list = Array.isArray(prs) ? prs : [];
  const mainRef = mainRefFor(defaultBranch);
  return list.map((pr) => {
    if (!hasLabel(pr?.labels, CONFLICT_LABEL)) return pr;
    const prNumber = Number(pr?.number);
    const headSha = pr?.headRefOid;
    if (!Number.isInteger(prNumber) || prNumber <= 0 || !isSha(headSha) || !mainRef) return pr;

    fetchRef(prNumber, {});
    const base = readMergeBase(headSha, mainRef, {});
    if (!base) return pr; // no common history to bound the search by — never guess
    const changes = readChanges(base, headSha, {});
    if (!changes.length) return pr; // could not even read the diff — never guess containment from nothing

    const fileMatches = changes.map((change) => ({
      file: change.path, matchedCommit: findMatchingCommit(change, { base, mainRef }),
    }));

    const verdict = computeAlreadyLandedVerdict(fileMatches);
    if (!verdict.landed) return pr;

    const uniqueCommits = [...new Set(fileMatches.map((m) => m.matchedCommit).filter(Boolean))];
    const pullsByCommit = {};
    for (const c of uniqueCommits) pullsByCommit[c] = readPulls(c, { repo });
    const carrierPr = attributeCarrierPr(fileMatches, pullsByCommit);

    return { ...pr, alreadyLandedInMain: { carrierPr } };
  });
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#formatReport — the human half of the output, and it is not decoration.
 *
 * A PASS THAT REFUSES FOUR PRs AND PRINTS ONE LINE HAS REPRODUCED THE ORIGINAL DEFECT ONE LEVEL UP. So every
 * refusal is printed with its kind, its PR and the fact it turned on — and for the liveness refusals, the `cwd`
 * and `sha` the binding was derived from, since that derivation is itself a proxy that has already been observed
 * to bind the wrong session to the wrong PR. Grouping runs in `REFUSAL_KINDS` order (worst first) so a
 * permission-blocked session never sorts below a queued PR.
 * @param {{dispatch:Array<object>, refusals:Array<object>, notes:Array<object>}} plan
 * @returns {string}
 */
export function formatReport({ dispatch = [], refusals = [], notes = [] } = {}) {
  const lines = [];
  lines.push(`reconcile — ${dispatch.length} dispatch, ${refusals.length} refusal(s), ${notes.length} surfaced`);

  for (const kind of DISPATCH_KINDS) {
    for (const d of dispatch.filter((x) => x.kind === kind)) {
      lines.push(`  → ${kind.padEnd(6)} PR #${d.prNumber} (${d.headRefName ?? '?'}) — ${d.why}`);
    }
  }
  for (const kind of REFUSAL_KINDS) {
    for (const r of refusals.filter((x) => x.kind === kind)) {
      // The BIND EVIDENCE rides on the line itself for the liveness kinds. A refusal a reader cannot audit is
      // the thing this pass was built to remove.
      const bind = r.cwd || r.sha
        ? ` [bound via cwd=${r.cwd || '?'} sha=${(r.sha || '?').slice(0, 12)}${r.pid == null ? ' pid=absent' : ` pid=${r.pid}`}]`
        : '';
      lines.push(`  ✗ ${kind} PR #${r.prNumber} — ${r.why}${bind}`);
    }
  }
  for (const n of notes) lines.push(`  ! ${n.text}`);
  return lines.join('\n');
}

/**
 * we:scripts/conveyor/reconcile-pass.mjs#runReconcilePass — read, decide, return. Every reader is injectable, so
 * the whole shell is exercisable with no network and no credential.
 * @param {{readPrs?:Function, readAgents?:Function, enrich?:Function, enrichMainRed?:Function,
 *   enrichAlreadyLanded?:Function, now?:number, repo?:string|null, defaultBranch?:string}} [o]
 * @returns {{dispatch:Array<object>, refusals:Array<object>, notes:Array<object>, prs:number, agents:number}}
 */
export function runReconcilePass({
  readPrs = defaultReadPrs, readAgents = defaultReadAgents, enrich = enrichAgents,
  enrichMainRed = enrichPrsWithMainRedFacts, enrichAlreadyLanded = enrichPrsWithAlreadyLandedFacts,
  now = Date.now(), repo = null, defaultBranch = 'main',
  // #2748 false-red follow-up — injectable so a test can supply a fixture with no network, matching every
  // other reader in this file. Defaults to the live, cached branch-protection read.
  readRequiredChecks = getRequiredStatusChecks,
} = {}) {
  const repoKey = repo == null ? 'we' : repoKeyForSlug(repo);
  if (repoKey === null) throw new Error(`reconcile-pass: --repo ${repo} is not a constellation repo`);
  // #x81m8xx — `repo` may be either vocabulary (the gh SLUG or the internal KEY, e.g. `--repo=we`); `gh` only
  // understands the slug, so once `repoKey` is resolved every downstream IO call gets the NORMALISED
  // `owner/name` slug, never the raw input. `repo == null` stays `null` (gh infers the repo from cwd, same as
  // before) — only a caller-supplied value is normalised.
  const resolvedRepo = repo == null ? null : CONSTELLATION_REPOS[repoKey].slug;
  const rawPrs = readPrs({ repo: resolvedRepo });
  // we:backlog/x5uqim1-*.md — attach `requiredCheckCompletedAt`/`aheadByOnMain` to any currently-failing
  // PR and read `main`'s own red windows, so `planReconcile` can tell a `ci-red` PR caused by a red `main` apart
  // from the PR's own defect. Costs nothing beyond what `readPrs` already fetched when nothing is `ci:failed`.
  const { prs: redPrs, mainRedWindows } = enrichMainRed(rawPrs, { repo: resolvedRepo, defaultBranch });
  // live incident, PR #2752 (#4034/#2748) — attach `alreadyLandedInMain` to any PR carrying
  // `merge-status:conflicting` whose own content is already, file-by-file, present on `main`. Costs nothing
  // beyond the label scan `readPrs` already fetched every field for when no PR carries that label.
  const prs = enrichAlreadyLanded(redPrs, { repo: resolvedRepo, defaultBranch });
  const agents = enrich(readAgents({}));
  // A repo this constellation does not know the gh slug for (`resolvedRepo` stays `null`, `gh` infers from cwd)
  // still gets a required set: `getRequiredStatusChecks` degrades to its own cache/fallback chain rather than
  // ever throwing, so this call is safe unconditionally (see that module's own header).
  const { checks: requiredChecks } = readRequiredChecks({ repo: resolvedRepo, branch: defaultBranch });
  const plan = planReconcile({ repo: repoKey, prs, agents, durableCounts: durableCountsFrom(prs), now, defaultBranch, mainRedWindows, requiredChecks });
  return { ...plan, prs: prs.length, agents: agents.length };
}

// ── IO SHELL (runs only as a CLI — the exports above stay side-effect-free on import) ──────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  const flags = {};
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  let result;
  try {
    result = runReconcilePass({
      repo: typeof flags.repo === 'string' ? flags.repo : null,
      ...(typeof flags['prs-file'] === 'string' ? { readPrs: () => readPrsFromFile(flags['prs-file']) } : {}),
      ...(typeof flags['agents-file'] === 'string' ? { readAgents: () => readPrsFromFile(flags['agents-file']) } : {}),
    });
  } catch (e) {
    process.stderr.write(`✗ reconcile pass could not read state: ${String((e && e.message) || e).split('\n')[0]}\n`);
    process.exit(1);
  }
  if (flags.json) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stdout.write(formatReport(result) + '\n');
}
