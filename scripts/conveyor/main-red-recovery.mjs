#!/usr/bin/env node
/**
 * @file scripts/conveyor/main-red-recovery.mjs
 * @description we:backlog/x5uqim1-*.md (parent #4075, epic #3383) — LIVE INCIDENT 2026-09-25: five
 *   `ready-to-merge` + `review:accepted` PRs (chalbert/web-everything#2596/#2622/#2629/#2631/#2634, plus #2635)
 *   sat for hours because their required `test` check failed while `origin/main`'s OWN CI was red (`main` was
 *   fixed by PR #2638 at 2026-09-25T02:23:27Z). Nobody refreshed their branches once `main` recovered, and
 *   `we:scripts/conveyor/ci-heal-pr-dispatch.mjs` would have dispatched a CI-heal agent to "repair" code that
 *   was never broken — measured live: at the moment this file was written, `we:scripts/conveyor/
 *   reconcile-pass.mjs` planned a `ci-heal` dispatch for all seven currently `ci:failed` PRs, every one of the
 *   six whose `test` run's own `attempts/1` completion timestamp (`gh api .../actions/runs/<id>/attempts/1`)
 *   falls inside the same red window `main`'s own `gh run list --branch main` shows between
 *   2026-09-25T01:30:55Z and 02:31:25Z.
 *
 * CORRECTED MID-BUILD, FROM A LIVE FINDING: this file originally reasoned about rerunning the failed GitHub
 * Actions run itself and capped on the run's own `attempt` counter. A live coordinator check on the operator's
 * own manual recovery (they reran #2596/#2622/#2629/#2631/#2634 by hand as the incident's emergency step) found
 * `gh run rerun --failed` re-executes the SAME commit — `main`'s fix is never in that tree — and all five
 * concluded `failure` again for the identical reason. The real fix is to actually merge current `main` into
 * each PR's head (the operator did this too, by hand, as a second emergency step; confirmed live: PR #2596's
 * head then compared `ahead_by: 0` against `main`). This file now reasons about THAT: `aheadBy` (how many
 * commits `main`'s current tip has that a PR's head lacks) replaces the run-attempt counter throughout.
 *
 * PURE CORE ONLY — no fs, no gh, no clock, no process. Every fact (`main`'s own run history, a PR's failing
 * check's completion time, how far behind `main` its head is) is read by the two IO shells that consume this
 * module:
 *   - `we:scripts/conveyor/reconcile-pass.mjs` — annotates a `ci-red` PR with `requiredCheckCompletedAt` /
 *     `aheadByOnMain` so `we:scripts/conveyor/reconcile-core.mjs` can refuse `owed-ci-rerun` instead of
 *     planning a `ci-heal` for a PR whose failure was never its own code's fault.
 *   - `we:scripts/conveyor/ci-red-recovery-watch.mjs` — the pass-daemon-wired watcher that actually refreshes a
 *     PR's branch onto current `main`, once, via `we:scripts/lib/rebase-drop-manifest.mjs#rebaseDropManifest`
 *     (the SAME proven, no-checkout plumbing the drain itself already uses to rebuild a lane's tip onto `main`
 *     — never a raw `git merge` or the GitHub `update-branch` REST endpoint, both of which would reintroduce
 *     the `.lane-manifest.json` collision that file exists to avoid).
 * Mirrors the pure-classify / thin-IO-shell split every sibling in this directory already follows
 * (`branch-drift.mjs`, `ci-queue-watch.mjs`, `infra-blocked.mjs`) — one place decides, two places read/act.
 *
 * WHY `cancelled` IS NOT A RED CONCLUSION ON `main`'s OWN TIMELINE, unlike `we:scripts/operations/
 * pr-status.mjs#FAILING_CONCLUSIONS` (which correctly treats a superseded PR check as failing — a PR's own
 * check being cancelled means nothing else concluded FOR THAT HEAD). `main`'s own run history is dominated by
 * `cancelled` runs from ordinary drain traffic: every push to `main` (a landed PR, a release-please commit)
 * cancels whatever CI run was still in flight against the PREVIOUS `main` head — that is normal concurrent
 * landing, not evidence `main` is broken. Measured live 2026-09-25: of the ~30 `main`-branch `CI` runs sampled,
 * a third are `cancelled`, correlating exactly with bursts of same-minute drain landings, never with a genuine
 * breakage. Counting them as red would read every busy drain window as a `main` outage and misfire this whole
 * mechanism constantly. {@link MAIN_RED_CONCLUSIONS} is therefore its own, narrower list — only a run GitHub
 * actually let finish and CONCLUDE failed, never one merely superseded by the next push.
 * @see we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment
 */

/**
 * we:scripts/conveyor/main-red-recovery.mjs#MAIN_RED_CONCLUSIONS — which of `main`'s own `CI` run conclusions
 * count as "main was red", for the reason given in the file header. Deliberately narrower than `we:scripts/
 * operations/pr-status.mjs#FAILING_CONCLUSIONS` (excludes `cancelled`, `action_required`, `stale`, all of
 * which fire on `main` for reasons that are not "the code on `main` is broken").
 */
export const MAIN_RED_CONCLUSIONS = Object.freeze(['failure', 'startup_failure', 'timed_out']);

/** The `main`-branch workflow whose runs this module reads, by default — the workflow that produces the
 *  required `test` check (`we:scripts/merge-ai-prs.mjs`'s own `requiredCheck = 'test'` default, reused, never
 *  re-derived). Overridable for a constellation repo whose CI workflow is named differently. */
export const DEFAULT_MAIN_WORKFLOW_NAME = 'CI';

/** The required status check this module reasons about, by default — SAME default `we:scripts/merge-ai-prs.mjs`
 *  already uses everywhere else in this repo (`requiredCheck = 'test'`), reused rather than re-declared. */
export const DEFAULT_REQUIRED_CHECK = 'test';

/**
 * we:scripts/conveyor/main-red-recovery.mjs#computeMainRedWindows — reduce `main`'s own chronological run
 * history for one workflow to the set of time windows during which `main` was red. PURE.
 *
 * A window opens at the COMPLETION of a run that concluded red ({@link MAIN_RED_CONCLUSIONS}) — not its start:
 * before a run concludes, `main`'s state is whatever the PREVIOUS concluded run left it as, never "red because
 * something is currently building". A window closes ONLY at the completion of a run that concludes `success` —
 * a genuine, positive proof `main` is healthy again. A `cancelled` run (see the file header — the ordinary
 * "superseded by the next push" case) or a `skipped`/`neutral` one proves NOTHING about whether `main` would
 * actually pass, so it neither opens nor closes a window; it is silently skipped, and a still-open red window
 * stays open right through it (measured live: 2026-09-25's own incident has a `cancelled` run sandwiched
 * between two `failure` runs at 01:37:41Z/01:45:27Z — treating `cancelled` as "green" there would have closed
 * the window eight minutes into a red stretch that in fact ran another 53 minutes). A red run with no later
 * `success` yet produces an OPEN window (`end: null`) — `main` is red RIGHT NOW.
 *
 * Only `status: 'completed'` runs are consulted; an in-flight run tells us nothing about what `main`
 * ultimately concluded and is silently skipped, exactly like `we:scripts/operations/pr-status.mjs#reduceCheckState`
 * treats a still-running check as distinct from a concluded one.
 * @param {Array<{status?:string, conclusion?:string, updatedAt?:string, workflowName?:string}>} mainRuns - as
 *   `gh run list --branch <base> --json databaseId,conclusion,status,createdAt,updatedAt,workflowName` returns
 *   them, ALREADY narrowed to one workflow by the caller (this function does not filter on `workflowName`,
 *   since a caller may have narrowed a different way, e.g. by re-fetching with `--workflow=`).
 * @returns {Array<{start:string, end:(string|null)}>} chronological, non-overlapping red windows.
 */
export function computeMainRedWindows(mainRuns) {
  const terminal = (Array.isArray(mainRuns) ? mainRuns : [])
    .filter((r) => r && String(r.status).toLowerCase() === 'completed' && r.updatedAt)
    .slice()
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));

  const windows = [];
  let redSince = null;
  for (const run of terminal) {
    const concl = String(run.conclusion || '').toLowerCase();
    const isRed = MAIN_RED_CONCLUSIONS.includes(concl);
    const isGreen = concl === 'success'; // the ONLY conclusion that closes a window — see the docblock above.
    if (isRed && redSince == null) {
      redSince = run.updatedAt;
    } else if (isGreen && redSince != null) {
      windows.push({ start: redSince, end: run.updatedAt });
      redSince = null;
    }
    // else: ambiguous (`cancelled`/`skipped`/`neutral`) or red-while-already-red — no state change.
  }
  if (redSince != null) windows.push({ start: redSince, end: null });
  return windows;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#isWithinRedWindow — was epoch `ts` inside any of `windows`? PURE.
 * An open-ended window (`end: null`) covers everything from its `start` onward.
 * @param {number} ts - epoch ms.
 * @param {Array<{start:string, end:(string|null)}>} windows
 * @returns {boolean}
 */
export function isWithinRedWindow(ts, windows) {
  if (!Number.isFinite(ts)) return false;
  return (Array.isArray(windows) ? windows : []).some((w) => {
    const start = Date.parse(w?.start);
    if (!Number.isFinite(start) || ts < start) return false;
    if (w?.end == null) return true;
    const end = Date.parse(w.end);
    return !Number.isFinite(end) || ts <= end;
  });
}

/** we:scripts/conveyor/main-red-recovery.mjs#isMainCurrentlyRed — is the LAST window in `windows` still open
 *  (`end: null`)? PURE. Gates a real rerun: rerunning a PR's CI while `main` is STILL red proves nothing. */
export function isMainCurrentlyRed(windows) {
  return (Array.isArray(windows) ? windows : []).some((w) => w?.end == null);
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#classifyCiFailureAttribution — is a PR's own required-check
 * failure explained by `main` having been red at the moment it concluded? PURE.
 * @param {{failureCompletedAt?:(string|null), mainRedWindows?:Array<object>}} o
 * @returns {'main-red'|'own-failure'|'unknown'} `'unknown'` when `failureCompletedAt` cannot be read at all —
 *   NEVER defaulted to either real answer, so a missing/malformed timestamp cannot silently suppress a real
 *   `ci-heal` (see {@link isPrCiFailureOwedRerun}, which treats `'unknown'` the same as `'own-failure'`).
 */
export function classifyCiFailureAttribution({ failureCompletedAt, mainRedWindows } = {}) {
  const ts = Date.parse(failureCompletedAt);
  if (!Number.isFinite(ts)) return 'unknown';
  return isWithinRedWindow(ts, mainRedWindows) ? 'main-red' : 'own-failure';
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#isPrCiFailureOwedRerun — THE gate `reconcile-core.mjs` consults to
 * decide `owed-ci-rerun` (never a `ci-heal`) for a `ci-red` PR. PURE.
 *
 * BOTH must hold:
 *   1. The failure is attributable to `main` having been red (see {@link classifyCiFailureAttribution}) — an
 *      `'unknown'` attribution (no readable timestamp) is treated as NOT owed a rerun, the same safe direction
 *      `reconcile-core.mjs`'s own liveness refusals take everywhere else: absence of evidence never manufactures
 *      a NEW kind of refusal, it falls through to the pass's existing, already-safe `ci-heal` path.
 *   2. This PR has not ALREADY been refreshed against the current `main` (`aheadBy > 0` — how many commits
 *      `main`'s current tip has that this PR's head lacks, from `GET /repos/.../compare/<head>...<base>`'s own
 *      `ahead_by`). `aheadBy === 0` means `main`'s fix is already in this PR's own history and it is STILL red —
 *      that answers "no, it is not just `main`" and the PR must fall through to the ordinary `ci-heal` cap.
 *      CORRECTED 2026-09-25, mid-build, from a live coordinator finding: this item ORIGINALLY reran the failed
 *      GitHub Actions run in place (`gh run rerun <id> --failed`) and capped on the run's own `attempt` counter.
 *      Live-measured that this DOES NOT WORK: `gh run rerun --failed` re-executes the SAME commit the run
 *      already built — main's fix is never in that tree — so PR #2596/#2622/#2629/#2631/#2634, manually rerun
 *      by the operator as the emergency step, all concluded `failure` a second time for the identical reason.
 *      The operator's own correction, applied by hand as the emergency and confirmed live (`ahead_by: 0` on
 *      #2596 against current `main` after their manual refresh): actually MERGE current `main` into the PR's
 *      head first. That is what {@link module:./ci-red-recovery-watch.mjs} now does, via the existing, PROVEN
 *      `we:scripts/lib/rebase-drop-manifest.mjs#rebaseDropManifest` plumbing the drain itself already uses to
 *      rebuild a lane's tip onto `main` (no checkout, single-branch-safe, and it already knows how to drop the
 *      transient `.lane-manifest.json` collision rather than colliding on it) — never a hand-rolled `git merge`
 *      or the raw GitHub `update-branch` REST endpoint, which would re-introduce exactly the manifest collision
 *      that file exists to prevent.
 *   `aheadBy` UNKNOWN (the IO shell's `compare` read failed) is treated as "not yet refreshed" — the safe
 *   direction here is the OPPOSITE of point 1's: misdiagnosing a real main-red artifact as a code defect and
 *   dispatching a fixer to "repair" nonexistent code (the exact harm this whole item exists to prevent) is worse
 *   than deferring one more tick until `aheadBy` is known.
 * @param {{requiredCheckCompletedAt?:(string|null), aheadBy?:(number|null), mainRedWindows?:Array<object>}} o
 * @returns {boolean}
 */
export function isPrCiFailureOwedRerun({ requiredCheckCompletedAt, aheadBy, mainRedWindows } = {}) {
  const attribution = classifyCiFailureAttribution({ failureCompletedAt: requiredCheckCompletedAt, mainRedWindows });
  if (attribution !== 'main-red') return false;
  const behind = Number.isFinite(aheadBy) ? aheadBy : null;
  return behind == null || behind > 0;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#planMainRedRebases — THE PASS `ci-red-recovery-watch.mjs` runs:
 * given every candidate PR whose required check is currently failing, and `main`'s own red windows, decide
 * which ones to refresh against current `main` right now. PURE, total — every candidate yields a dispatch or a
 * named refusal, mirroring `reconcile-core.mjs#planReconcile`'s own "every PR produces a row" discipline.
 *
 * ORDER OF THE CHECKS:
 *   1. Attribution — not `main-red` → `own-failure` (or `unknown-attribution`), never this pass's job; `ci-heal`
 *      owns it.
 *   2. `main` still red (an OPEN window is the very last one in `mainRedWindows`) → `main-still-red`: refreshing
 *      against a still-broken `main` would just fail again for the same reason — wait for `main` to recover.
 *   3. `aheadBy` unresolved → `unknown-ahead-by` (can't tell whether a refresh is even needed; the safe
 *      direction is to wait for a tick where the `compare` read succeeds, never guess).
 *   4. `aheadBy === 0` already → `already-current`, THE CAP: `main`'s current tip is already an ancestor of this
 *      PR's head (read back off GitHub's own `compare` endpoint — no parallel store, the same "the count IS
 *      state, read off the thing itself" discipline `we:scripts/conveyor/ci-heal-mark.mjs`'s comment-count cap
 *      already uses for a different durable floor). This is what makes the pass idempotent against the
 *      operator's own manual refresh from this exact incident, and against `rebaseDropManifest`'s OWN
 *      `action:'current'` short-circuit once this pass has already refreshed a PR once.
 *   5. Otherwise → `rebase-onto-main` dispatch.
 * @param {object} o
 * @param {Array<{prNumber:number, headRefName?:(string|null), aheadBy?:(number|null), failureCompletedAt?:(string|null)}>} [o.candidates]
 * @param {Array<{start:string, end:(string|null)}>} [o.mainRedWindows]
 * @returns {{dispatch:Array<object>, refusals:Array<object>}}
 */
export function planMainRedRebases({ candidates = [], mainRedWindows = [] } = {}) {
  const dispatch = [];
  const refusals = [];
  const mainStillRed = isMainCurrentlyRed(mainRedWindows);

  for (const c of Array.isArray(candidates) ? candidates : []) {
    const prNumber = Number(c?.prNumber);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const base = {
      prNumber,
      headRefName: c?.headRefName ?? null,
      aheadBy: Number.isFinite(c?.aheadBy) ? c.aheadBy : null,
      failureCompletedAt: c?.failureCompletedAt ?? null,
    };
    const attribution = classifyCiFailureAttribution({ failureCompletedAt: base.failureCompletedAt, mainRedWindows });

    if (attribution !== 'main-red') {
      refusals.push({
        ...base, kind: attribution === 'unknown' ? 'unknown-attribution' : 'own-failure',
        why: attribution === 'unknown'
          ? `PR #${prNumber}'s failing run has no readable completion timestamp — cannot attribute it to a red \`main\` window`
          : `PR #${prNumber}'s required check failed at ${base.failureCompletedAt}, outside every red-\`main\` window — this is the PR's own failure, owed a ci-heal, not a rebase`,
      });
      continue;
    }
    if (mainStillRed) {
      refusals.push({
        ...base, kind: 'main-still-red',
        why: `main's own CI is still red right now — refreshing PR #${prNumber} against it would not prove anything; wait for main to recover`,
      });
      continue;
    }
    if (base.aheadBy == null) {
      refusals.push({ ...base, kind: 'unknown-ahead-by', why: `could not resolve how far behind main PR #${prNumber}'s head is — refusing to guess` });
      continue;
    }
    if (base.aheadBy === 0) {
      refusals.push({
        ...base, kind: 'already-current',
        why: `PR #${prNumber}'s head already contains main's current tip (ahead_by: 0) — still red is now owed a ci-heal, not another refresh`,
      });
      continue;
    }
    dispatch.push({
      ...base, kind: 'rebase-onto-main',
      why: `PR #${prNumber}'s required check failed at ${base.failureCompletedAt}, inside a window where main's own CI was red; main has recovered and this head is ${base.aheadBy} commit(s) behind it — refreshing onto main`,
    });
  }

  return { dispatch, refusals };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// HUNG-CI-RUN RECOVERY — we:backlog/xd1sfms-*.md (parent #4075, epic #3383). LIVE INCIDENT 2026-09-25: PR #2636
// (run 36161558017) had its `test-shard (1)` job sit `IN_PROGRESS` for 3h+ while its 3 sibling shards completed
// in ~90-260s. `we:.github/workflows/ci.yml` set no `timeout-minutes` on any job, so GitHub's own 360-min
// per-job default applied — a single hung runner blocked the PR for up to 6 hours. Worse: the fix-dispatch
// daemon's own tick logged `nothing-owed` for #2636 the whole time, because every existing classifier in this
// file ({@link classifyCiFailureAttribution}, {@link isPrCiFailureOwedRerun}) — and `we:scripts/conveyor/
// reconcile-core.mjs`'s `ci-red` → `ci-heal` path downstream of them — reasons ONLY about a required check that
// has already CONCLUDED failed. A check stuck `IN_PROGRESS`/`QUEUED` has no conclusion at all yet, so none of
// that machinery ever looks at it; a genuinely hung run was invisible to every automated recovery this repo had.
//
// WHY THE REQUIRED CHECK ITSELF NEVER SHOWS UP HUNG (the reason {@link buildHungCandidates} watches the whole
// CI *workflow run*, not just the named required check). Confirmed live on #2636's own `statusCheckRollup`:
// the required `test` job `needs: test-shard` and does not even START until every shard job finishes (or is
// cancelled) — so while shard 1 sat hung, `test` had NO check-run entry at all, not even `QUEUED`. Watching
// only the named required check would therefore never see anything to classify; this pass instead looks at
// EVERY check whose `workflowName` matches the CI workflow and asks "has this PR's run, as a whole, failed to
// conclude for far longer than any real run ever takes?" — exactly the invariant a hung PR actually violates.
//
// THE FIX THIS FILE PROVIDES IS DELIBERATELY THE SAME SHAPE AS `isPrCiFailureOwedRerun` ABOVE: a pure
// classify/plan pair, no fs/gh/clock/process, consumed by an IO shell
// ({@link module:./ci-red-recovery-watch.mjs}) that does the one real write this pass ever performs — cancel
// the stuck run and ask GitHub to re-run it (`gh run cancel` then `gh run rerun`, never a raw retry of the same
// still-hung attempt, and never per-shard — a single workflow run id covers every job in it, confirmed live:
// `test-shard (1..4)`, `test`, and `smoke` on #2636 all shared ONE `detailsUrl` run id, 36161558017).
//
// THE ATTEMPT CAP IS DURABLE AND PER HEAD SHA, deliberately narrower than `we:scripts/conveyor/ci-heal-
// mark.mjs`'s own PER-PR cap: a hung run is bad luck tied to ONE specific commit's CI attempt, not evidence
// about the PR's code, so a NEW push (a new head sha) must start this cap fresh rather than inheriting a
// count run up against a completely different tree. Counted the same restart-survives way every other durable
// cap in this repo already is — off the PR's own comment thread, via a marker this file's IO-shell sibling
// posts on every completed cancel+rerun ({@link module:./ci-red-recovery-watch.mjs#HUNG_CI_COMMENT_MARKER}) —
// never a parallel in-memory store a conveyor restart would wipe.
//
// ESCALATION PAST THE CAP NEEDS NO NEW CODE PATH. Once a head sha has been cancelled+rerun
// {@link DEFAULT_MAX_HUNG_RETRIES_PER_SHA} times, this pass refuses (`hung-cap-exhausted`) and stops touching
// it — deliberately. The NEW `timeout-minutes` on every `we:.github/workflows/ci.yml` job (this same card,
// xd1sfms) means a run this pass has given up on will now be force-failed by GitHub itself within, at most,
// the slowest job's own timeout (20min for `test`) rather than hanging for the 360-min default — at which
// point the required check genuinely CONCLUDES failed, and the EXISTING `ci-red` → `ci-heal` path
// (`we:scripts/conveyor/reconcile-core.mjs`) picks it up exactly as it already does for any other red PR. The
// two halves of this card compose: bounded job timeouts are what make "escalate to ci-heal" true without this
// file inventing a second escalation mechanism of its own.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** we:scripts/conveyor/main-red-recovery.mjs#DEFAULT_HUNG_THRESHOLD_MS — a required-check RUN (see
 *  {@link buildHungCandidates}'s own docblock for why this watches the whole run, not the named check alone)
 *  that has sat with at least one job `IN_PROGRESS`/`QUEUED` for at least this long counts HUNG. 45 minutes is
 *  comfortably above every real duration measured live on 2026-09-25 across 15 successful `we:.github/
 *  workflows/ci.yml` runs (`test-shard` p95 249s, `test` p95 380s, `smoke` p95 146s — all under 6.5 minutes),
 *  while still catching a genuinely stuck run (#2636 sat 3h+) long before GitHub's own 360-min per-job
 *  default would ever act. Configurable — the IO shell's CLI takes `--threshold-ms=`. */
export const DEFAULT_HUNG_THRESHOLD_MS = 45 * 60 * 1000;

/** we:scripts/conveyor/main-red-recovery.mjs#DEFAULT_MAX_HUNG_RETRIES_PER_SHA — how many times ONE PR head sha
 *  may be cancelled + re-run before this pass gives up and lets the ordinary `ci-heal` path take over (see the
 *  section header above for why giving up needs no new escalation code). Mirrors the SHAPE of `we:scripts/
 *  conveyor/ci-heal-mark.mjs`'s own durable per-PR cap — small, because a run that hangs twice in a row on the
 *  identical tree is no longer "bad luck", it is a real signal this pass should stop absorbing. */
export const DEFAULT_MAX_HUNG_RETRIES_PER_SHA = 2;

/**
 * we:scripts/conveyor/main-red-recovery.mjs#runIdFromDetailsUrl — pull the numeric GitHub Actions RUN id out of
 * a check-run's own `detailsUrl` (`gh pr list/view --json statusCheckRollup` never surfaces a bare `runId`
 * field directly — only this URL, shaped `.../actions/runs/<runId>/job/<jobId>`). PURE string parsing, no IO.
 * @param {string|null|undefined} detailsUrl
 * @returns {number|null}
 */
export function runIdFromDetailsUrl(detailsUrl) {
  const m = typeof detailsUrl === 'string' ? detailsUrl.match(/\/actions\/runs\/(\d+)/) : null;
  return m ? Number(m[1]) : null;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#isRunHung — has a still-open CI run been going since further back
 * than `thresholdMs`? PURE.
 * @param {{startedAt?:(string|null), now?:number, thresholdMs?:number}} o
 * @returns {boolean}
 */
export function isRunHung({ startedAt, now = Date.now(), thresholdMs = DEFAULT_HUNG_THRESHOLD_MS } = {}) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return false;
  return (now - started) >= thresholdMs;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#buildHungCandidates — narrow a `gh pr list --json
 * statusCheckRollup` listing to one row per PR whose CI workflow run has NOT yet concluded — the population
 * {@link isRunHung}/{@link planHungCiRecoveries} reason about. PURE.
 *
 * Deliberately does NOT filter on the single named `requiredCheck` (see the section header's own "why the
 * required check itself never shows up hung") — it reads every check whose `workflowName` matches, and treats
 * the PR as still-open whenever the required check either has no entry yet or has not completed, AND at least
 * one of the run's own checks is itself not yet `COMPLETED`. `startedAt` on the returned row is the EARLIEST
 * `startedAt` among the run's still-open checks — the run's own age, not any one job's.
 * `jobName` on the returned row is the name of the check WHOSE `startedAt` is that earliest timestamp — the
 * actual hung job (e.g. `"test-shard (1)"`), never the PR-level required check name. LIVE 2026-09-25: #2636
 * hung on `test-shard (1)` TWICE, on two DIFFERENT head shas (36161558017, then 36187480460 after a refresh) —
 * a repeat hang on the SAME job name across different shas is the signal {@link planHungCiRecoveries} uses to
 * tell "bad luck, this infra attempt hung" from "this shard's own tests are the problem" (see that function's
 * own docblock).
 * @param {Array<object>} prs - as `gh pr list --json number,headRefName,headRefOid,statusCheckRollup` returns.
 * @param {{requiredCheck?:string, workflowName?:string}} [o]
 * @returns {Array<{prNumber:number, headRefName:(string|null), headSha:(string|null), runId:(number|null),
 *   startedAt:(string|null), jobName:(string|null)}>}
 */
export function buildHungCandidates(prs, { requiredCheck = DEFAULT_REQUIRED_CHECK, workflowName = DEFAULT_MAIN_WORKFLOW_NAME } = {}) {
  const out = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    const prNumber = Number(pr?.number);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const rollup = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
    const ciChecks = rollup.filter((c) => c?.workflowName === workflowName);
    if (!ciChecks.length) continue; // this PR's head has no CI run at all yet — nothing to watch.
    const requiredEntry = ciChecks.find((c) => c?.name === requiredCheck);
    // the required check already concluded (success OR failure) — settled, owned by the ci-red/ci-green paths
    // above/elsewhere, never this pass.
    if (requiredEntry && String(requiredEntry.status).toUpperCase() === 'COMPLETED') continue;

    let runId = null;
    let earliestStart = null;
    let jobName = null;
    let stillOpen = false;
    for (const c of ciChecks) {
      if (runId == null) runId = runIdFromDetailsUrl(c?.detailsUrl);
      if (String(c?.status).toUpperCase() === 'COMPLETED') continue;
      stillOpen = true;
      const started = Date.parse(c?.startedAt);
      if (Number.isFinite(started) && (earliestStart == null || started < earliestStart)) {
        earliestStart = started;
        jobName = c?.name ?? null;
      }
    }
    if (!stillOpen) continue; // every check the rollup knows about already finished; required just hasn't been created yet (e.g. queued behind `needs`) with nothing itself running — nothing to cancel.

    out.push({
      prNumber,
      headRefName: pr?.headRefName ?? null,
      headSha: pr?.headRefOid ?? null,
      runId,
      startedAt: earliestStart != null ? new Date(earliestStart).toISOString() : null,
      jobName,
    });
  }
  return out;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#planHungCiRecoveries — THE PASS `ci-red-recovery-watch.mjs` runs
 * to decide which open, not-yet-concluded CI runs are owed a cancel+rerun right now. PURE, total — every
 * candidate yields exactly one dispatch or refusal, mirroring {@link planMainRedRebases}'s own discipline.
 *
 * ORDER OF THE CHECKS:
 *   1. Not actually hung yet ({@link isRunHung} false) → `not-hung` (the ordinary, expected case for almost
 *      every open PR on almost every tick).
 *   2. REPEAT HANG ON THE SAME JOB, across a DIFFERENT head sha (`hungAttemptsForJob >= 1`) → `repeat-hang`
 *      dispatch: cancel the run but do NOT rerun it. LIVE 2026-09-25, orchestrator-flagged: #2636's
 *      `test-shard (1)` hung on run 36161558017, then hung AGAIN on run 36187480460 after the PR's head was
 *      refreshed onto a new sha — the SAME job name hanging twice across two different trees is evidence the
 *      hang lives in that shard's own tests (a real bug or infinite loop the PR introduced), not one-off infra
 *      flakiness a blind retry would fix. Checked BEFORE the per-sha cap below (and takes priority over it)
 *      because it is a STRONGER, faster signal than "this exact sha has been retried N times" — a fresh sha
 *      that immediately re-hangs on the identical job doesn't need to burn its own retry budget to prove the
 *      point. Cancelling (never rerunning) is what lets the EXISTING `ci-red` → `ci-heal` path
 *      (`we:scripts/conveyor/reconcile-core.mjs`) take over: `we:scripts/merge-ai-prs.mjs#isRequiredCheckFailed`
 *      already treats a CANCELLED required check as failed, so ci-heal is dispatched with a real diagnosis
 *      target instead of this pass endlessly re-running a shard that will only hang again.
 *   3. Hung, no repeat-hang signal, but this exact head sha already used up its ATTEMPT cap (counted on every
 *      attempt, succeeded or not — see `ci-red-recovery-watch.mjs#sweepHungCiRecovery`'s own docblock for why
 *      a FAILED cancel must still count) → `hung-cap-exhausted` (bounded job `timeout-minutes`, landed in the
 *      same card, does the rest — see the section header above).
 *   4. Otherwise → `hung-cancel-rerun` dispatch.
 * @param {object} o
 * @param {Array<{prNumber:number, headRefName?:(string|null), headSha?:(string|null), runId?:(number|null),
 *   startedAt?:(string|null), jobName?:(string|null), hungAttemptsForSha?:number,
 *   hungAttemptsForJob?:number}>} [o.candidates] - `hungAttemptsForSha` is the CALLER's durable count (see
 *   `ci-red-recovery-watch.mjs#countHungCiComments`) for THIS candidate's `headSha`; `hungAttemptsForJob` is
 *   the durable count for THIS candidate's `jobName`, ACROSS every sha this PR has ever had (see
 *   `ci-red-recovery-watch.mjs#countHungCiCommentsByJob`). Both omitted/non-finite default to 0 — a candidate
 *   the caller never bothered counting is one this pass has not yet tried, the same safe default
 *   {@link planMainRedRebases} uses for an unresolved `aheadBy` in the OPPOSITE direction it needs here — 0 is
 *   the correct floor, not the correct ceiling, for a brand-new candidate.
 * @param {number} [o.now]
 * @param {number} [o.thresholdMs]
 * @param {number} [o.maxRetriesPerSha]
 * @returns {{dispatch:Array<object>, refusals:Array<object>}}
 */
export function planHungCiRecoveries({
  candidates = [], now = Date.now(), thresholdMs = DEFAULT_HUNG_THRESHOLD_MS, maxRetriesPerSha = DEFAULT_MAX_HUNG_RETRIES_PER_SHA,
} = {}) {
  const dispatch = [];
  const refusals = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const prNumber = Number(c?.prNumber);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const base = {
      prNumber, headRefName: c?.headRefName ?? null, headSha: c?.headSha ?? null, runId: c?.runId ?? null, jobName: c?.jobName ?? null,
    };
    const minutes = Math.round(thresholdMs / 60000);
    if (!isRunHung({ startedAt: c?.startedAt, now, thresholdMs })) {
      refusals.push({ ...base, kind: 'not-hung', why: `PR #${prNumber}'s CI run (${base.runId ?? '?'}) has not been open past the ${minutes}min hung threshold` });
      continue;
    }
    const jobAttempts = Number.isFinite(c?.hungAttemptsForJob) ? c.hungAttemptsForJob : 0;
    if (base.jobName && jobAttempts >= 1) {
      dispatch.push({
        ...base,
        kind: 'repeat-hang',
        why: `PR #${prNumber}'s job "${base.jobName}" has hung ${jobAttempts} time(s) before on a DIFFERENT head sha (run ${base.runId ?? '?'} is hung again now) — this looks like a real hang in this shard's own tests, not infra; cancelling only (never re-running) so the existing ci-red -> ci-heal path diagnoses it`,
      });
      continue;
    }
    const attempts = Number.isFinite(c?.hungAttemptsForSha) ? c.hungAttemptsForSha : 0;
    if (attempts >= maxRetriesPerSha) {
      refusals.push({
        ...base, kind: 'hung-cap-exhausted',
        why: `PR #${prNumber}'s head sha ${base.headSha ?? '?'} already had ${attempts} hung-recovery attempt(s) (cap ${maxRetriesPerSha}) — leaving it for GitHub's own job timeout-minutes to conclude it, at which point the ordinary ci-heal path takes over`,
      });
      continue;
    }
    dispatch.push({
      ...base, attempts,
      kind: 'hung-cancel-rerun',
      why: `PR #${prNumber}'s CI run ${base.runId ?? '?'} has been open since ${c?.startedAt}, past the ${minutes}min hung threshold — cancelling and re-running (attempt ${attempts + 1}/${maxRetriesPerSha})`,
    });
  }
  return { dispatch, refusals };
}
