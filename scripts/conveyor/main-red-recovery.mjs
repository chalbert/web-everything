#!/usr/bin/env node
/**
 * @file scripts/conveyor/main-red-recovery.mjs
 * @description we:backlog/x5uqim1-*.md (parent #4075, epic #3383) — LIVE INCIDENT 2026-09-25: five
 *   `ready-to-merge` + `review:accepted` PRs (chalbert/web-everything#2596/#2622/#2629/#2631/#2634, plus #2635)
 *   sat for hours because their required `test` check failed while `origin/main`'s OWN CI was red (`main` was
 *   fixed by PR #2638 at 2026-09-25T02:23:27Z). Nobody re-ran their stale CI once `main` recovered, and
 *   `we:scripts/conveyor/ci-heal-pr-dispatch.mjs` would have dispatched a CI-heal agent to "repair" code that
 *   was never broken — measured live: at the moment this file was written, `we:scripts/conveyor/
 *   reconcile-pass.mjs` planned a `ci-heal` dispatch for all seven currently `ci:failed` PRs, five of which
 *   (#2596/#2622/#2629/#2631/#2634) had ALREADY been manually rerun once by the operator (GitHub's own
 *   `attempt: 2` on each of their `test` runs, confirmed via `gh run view`) and one (#2635) had not been rerun
 *   at all — every one of the six PRs whose `test` run's own `attempts/1` completion timestamp
 *   (`gh api .../actions/runs/<id>/attempts/1`) falls inside the same red window `main`'s own `gh run list
 *   --branch main` shows between 2026-09-25T01:30:55Z and 02:31:25Z.
 *
 * PURE CORE ONLY — no fs, no gh, no clock, no process. Every fact (`main`'s own run history, a PR's failing
 * run id/attempt/completion time) is read by the two IO shells that consume this module:
 *   - `we:scripts/conveyor/reconcile-pass.mjs` — annotates a `ci-red` PR with `requiredCheckCompletedAt` /
 *     `requiredCheckAttempt` so `we:scripts/conveyor/reconcile-core.mjs` can refuse `owed-ci-rerun` instead of
 *     planning a `ci-heal` for a PR whose failure was never its own code's fault.
 *   - `we:scripts/conveyor/ci-red-recovery-watch.mjs` — the pass-daemon-wired watcher that actually runs
 *     `gh run rerun <id> --failed` once, per (PR, run), once `main` itself is confirmed to have recovered.
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
 *   2. This run has not ALREADY been given its one rerun (`attempt < 2`, or unknown — see below). A run GitHub
 *      itself has already rerun once (`attempt >= 2`) and is STILL red has been given the benefit of the doubt
 *      and answered "no, it is not just `main`" — CONFIRMED LIVE 2026-09-25: PR #2596/#2622/#2629/#2631/#2634
 *      were all manually rerun once (`attempt: 2` on each `test` run) and all STILL concluded `failure` — so a
 *      PR in this state must fall through to the ordinary `ci-heal` cap, never stay parked behind
 *      `owed-ci-rerun` forever.
 *   `requiredCheckAttempt` UNKNOWN (the IO shell's `gh run view` read failed, or was never attempted) is
 *   treated as "not yet rerun" — the safe direction here is the OPPOSITE of point 1's: misdiagnosing a real
 *   main-red artifact as a code defect and dispatching a fixer to "repair" nonexistent code (the exact harm
 *   this whole item exists to prevent) is worse than deferring one more tick until the attempt count is known.
 * @param {{requiredCheckCompletedAt?:(string|null), requiredCheckAttempt?:(number|null), mainRedWindows?:Array<object>}} o
 * @returns {boolean}
 */
export function isPrCiFailureOwedRerun({ requiredCheckCompletedAt, requiredCheckAttempt, mainRedWindows } = {}) {
  const attribution = classifyCiFailureAttribution({ failureCompletedAt: requiredCheckCompletedAt, mainRedWindows });
  if (attribution !== 'main-red') return false;
  const attempt = Number.isFinite(requiredCheckAttempt) ? requiredCheckAttempt : null;
  return attempt == null || attempt < 2;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#runIdFromDetailsUrl — pull the GitHub Actions run id out of a
 * `statusCheckRollup` CheckRun's own `detailsUrl` (`https://github.com/<owner>/<repo>/actions/runs/<id>/job/<jobId>`)
 * — the ONE field `gh pr list/view --json statusCheckRollup` already returns for free, so no second `gh run
 * list` call is needed to find which run produced a given check. PURE (string parse only).
 * @param {string|null|undefined} detailsUrl
 * @returns {number|null}
 */
export function runIdFromDetailsUrl(detailsUrl) {
  const m = /\/actions\/runs\/(\d+)/.exec(String(detailsUrl || ''));
  return m ? Number(m[1]) : null;
}

/**
 * we:scripts/conveyor/main-red-recovery.mjs#planCiRedReruns — THE PASS `ci-red-recovery-watch.mjs` runs: given
 * every candidate PR whose required check is currently failing, and `main`'s own red windows, decide which
 * ones to `gh run rerun <id> --failed` right now. PURE, total — every candidate yields a dispatch or a named
 * refusal, mirroring `reconcile-core.mjs#planReconcile`'s own "every PR produces a row" discipline.
 *
 * ORDER OF THE CHECKS:
 *   1. Attribution — not `main-red` → `own-failure` (or `unknown`), never this pass's job; `ci-heal` owns it.
 *   2. `main` still red (an OPEN window is the very last one in `mainRedWindows`) → `main-still-red`: rerunning
 *      now would just fail again for the same reason, and would ALSO burn this candidate's one-rerun budget
 *      for nothing — wait for `main` to actually recover before spending it.
 *   3. No resolvable run id → `no-run-id` (can't `gh run rerun` a run this pass never found).
 *   4. `attempt >= 2` already → `already-rerun`, the CAP: once per (PR, run), enforced by reading GitHub's OWN
 *      `attempt` counter back off the run — no parallel store, the same "the count IS state, read off the
 *      thing itself" discipline `we:scripts/conveyor/ci-heal-mark.mjs`'s comment-count cap already uses for a
 *      different durable floor. This is what makes the pass idempotent against the operator's own manual
 *      `gh run rerun` from this exact incident: their rerun already bumped `attempt` to 2, so a later sweep
 *      reports it `already-rerun` rather than rerunning a THIRD time.
 *   5. Otherwise → `ci-rerun` dispatch.
 * @param {object} o
 * @param {Array<{prNumber:number, headRefName?:(string|null), runId?:(number|null), attempt?:(number|null), failureCompletedAt?:(string|null)}>} [o.candidates]
 * @param {Array<{start:string, end:(string|null)}>} [o.mainRedWindows]
 * @returns {{dispatch:Array<object>, refusals:Array<object>}}
 */
export function planCiRedReruns({ candidates = [], mainRedWindows = [] } = {}) {
  const dispatch = [];
  const refusals = [];
  const mainStillRed = isMainCurrentlyRed(mainRedWindows);

  for (const c of Array.isArray(candidates) ? candidates : []) {
    const prNumber = Number(c?.prNumber);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue;
    const base = {
      prNumber,
      headRefName: c?.headRefName ?? null,
      runId: Number.isFinite(c?.runId) ? c.runId : null,
      attempt: Number.isFinite(c?.attempt) ? c.attempt : null,
      failureCompletedAt: c?.failureCompletedAt ?? null,
    };
    const attribution = classifyCiFailureAttribution({ failureCompletedAt: base.failureCompletedAt, mainRedWindows });

    if (attribution !== 'main-red') {
      refusals.push({
        ...base, kind: attribution === 'unknown' ? 'unknown-attribution' : 'own-failure',
        why: attribution === 'unknown'
          ? `PR #${prNumber}'s failing run has no readable completion timestamp — cannot attribute it to a red \`main\` window`
          : `PR #${prNumber}'s required check failed at ${base.failureCompletedAt}, outside every red-\`main\` window — this is the PR's own failure, owed a ci-heal, not a rerun`,
      });
      continue;
    }
    if (mainStillRed) {
      refusals.push({
        ...base, kind: 'main-still-red',
        why: `main's own CI is still red right now — rerunning PR #${prNumber} would not prove anything and would spend its one rerun for nothing; wait for main to recover`,
      });
      continue;
    }
    if (base.runId == null) {
      refusals.push({ ...base, kind: 'no-run-id', why: `PR #${prNumber}'s failing run has no resolvable GitHub Actions run id to rerun` });
      continue;
    }
    if (base.attempt != null && base.attempt >= 2) {
      refusals.push({
        ...base, kind: 'already-rerun',
        why: `run ${base.runId} for PR #${prNumber} is already at attempt ${base.attempt} — capped at one automatic rerun per (PR, run); still red is now owed a ci-heal, not a second rerun`,
      });
      continue;
    }
    dispatch.push({
      ...base, kind: 'ci-rerun',
      why: `PR #${prNumber}'s required check failed at ${base.failureCompletedAt}, inside a window where main's own CI was red; main has since recovered — rerunning run ${base.runId}`,
    });
  }

  return { dispatch, refusals };
}
