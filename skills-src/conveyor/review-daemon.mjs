#!/usr/bin/env node
/**
 * @file skills-src/conveyor/review-daemon.mjs
 * @description #3876 (epic #3383) — the standalone Review daemon: reconcile-pass.mjs (discovery) +
 *   review-dispatch.mjs (dispatch) + review-round-tag.mjs / review-status-tag.mjs (cosmetic labels),
 *   grouped into ONE daemon per #3860's split analysis — one sequential pass over the same PR, not four
 *   things worth separating.
 *
 * WHAT THIS REPLACES. we:skills-src/conveyor/runner.mjs's own `makeCliMechanicalPasses` ran this exact
 * sequence (reconcile-pass → review-dispatch per review-kind entry → review-round-tag → review-status-tag)
 * as ONE STEP of its own per-tick pass list, with a shared `--prs-file` fetched once and passed to both
 * reconcile-fix-dispatch AND reconcile-pass in the same tick. This daemon does NOT replicate that sharing —
 * it does its own `gh pr list` each tick, an accepted, honest tradeoff of running independently (the same
 * tradeoff #3870's Fix-dispatch daemon already made).
 *
 * CROSS-REPO (#xvyuwtg, 2026-09-22). This daemon was originally built WE-only, matching #3870's own scoping
 * at the time — deliberate, not an oversight, per this file's own original header. That turned out wrong in
 * practice: plateau-app PR #167 sat `review:pending` with nothing watching it, because this daemon's tick
 * never asked any repo but WE. Every downstream step was ALREADY fully repo-generic (`reconcile-pass.mjs`
 * accepts `--repo` end to end; `review-dispatch.mjs` dispatches any constellation repo's review correctly —
 * proven live by hand for plateau-app#167 — as long as the DISPATCHING process itself, not the target repo's
 * own checkout, is a clean, fresh, non-lane WE checkout; this daemon's own dedicated clone already is one).
 * The only real gap was discovery, so {@link runReviewTickAllRepos} now ticks {@link REVIEW_DAEMON_REPOS} —
 * today the three constellation repos, kept as data so a future per-user configurable repo list (plateau as
 * a product letting an operator choose which repos to integrate) is a source swap, not a redesign.
 *
 * DOUBLE-DISPATCH, STATED HONESTLY. Unlike we:scripts/conveyor/reconcile-fix-dispatch.mjs (which fences
 * through we:scripts/operations/action-store.mjs's durable ledger), `review-dispatch.mjs`'s `dispatchReview`
 * carries NO durable per-PR claim of its own (confirmed by direct read — no action-store import). Its ONLY
 * double-dispatch protection is UPSTREAM, in `reconcile-pass.mjs`/`reconcile-core.mjs`'s own liveness read:
 * a PR with a live `review-<pr>` session bound to it simply does not reappear in the NEXT tick's plan. This
 * daemon inherits that exact protection level — the same one the legacy runner already relied on — not a
 * weaker one, but also not a stronger one. A `claude agents --json` listing lag right after a fresh spawn
 * remains a real (pre-existing, not newly introduced) race window.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrored from #3870's own daemon and runner.mjs's header):
 *   • {@link runDaemonLoop} is IDENTICAL in shape to #3870's own loop (tickOnce/sleep/heartbeat/onTick/
 *     onTickError/intervalMs/maxTicks) — duplicated here rather than imported because #3870 has not yet
 *     landed on `main` at the time this was written; a follow-up can dedup the two into one shared file
 *     once both exist there.
 *   • {@link runReviewTick} is the pure-ish per-tick sequence (every effect — reconcile, dispatch, the two
 *     taggers — is injectable, so the whole sequence is unit-tested with fakes, no real `gh`/`claude`).
 *   • The IO SHELL (`main()`) wires the real functions and the real keyed runner-lock lease (#3877).
 *
 * THE SESSION REAPER LIVES HERE TOO (epic #3383, daemon split). `we:scripts/conveyor/session-reaper.mjs`'s
 * `runSessionReaperPass` used to run only inside `we:skills-src/conveyor/runner.mjs`'s own per-tick
 * `makeCliMechanicalPasses` — a dispatcher that this repo's daemons have since REPLACED and that is not
 * itself running. Left uncalled, every `review-*`/`review-pa-*`/`fix-*`/`fix-pa-*` session this daemon (and
 * `reconcile-fix-dispatch-daemon.mjs`) ever dispatches accumulates forever once it finishes — a real, observed
 * cost: ~40 finished sessions and ~200 lingering `claude` child processes (~24 GB) in one overnight run before
 * this wiring existed. THIS daemon claims it, not `reconcile-fix-dispatch-daemon.mjs`, for three reasons:
 *   1. `session-reaper.mjs` reads the WHOLE `claude agents --json --all` listing and reaps ANY matching
 *      session regardless of which daemon spawned it — placement is about who's the natural OWNER of session
 *      lifecycle, not about scoping which sessions get swept (both daemons' own dispatches are covered either
 *      way).
 *   2. `reconcile-fix-dispatch-daemon.mjs`'s whole job is narrowly single-purpose and safe-by-construction to
 *      run twice at once (its own header: every dispatch decision fences through `action-store.mjs`'s durable
 *      ledger) — folding in an unrelated OS-process-cleanup concern would blur that narrow contract for no
 *      benefit, where this daemon already owns a broader "review session lifecycle" concern (dispatch AND the
 *      two cosmetic tags that describe a session's own progress).
 *   3. This daemon is ALREADY cross-repo (`REVIEW_DAEMON_REPOS`, #xvyuwtg) and already ticks on the same
 *      120s cadence `runner.mjs`'s own mechanical pass used for `session-reaper.mjs` — no new interval, no new
 *      lease, no new cross-repo plumbing to add.
 * `neverReapWorking: true` and `allowedCwd: REPO_ROOT` (imported from `session-reaper.mjs` itself, resolved
 * by THAT file's own script location — i.e., whichever checkout is actually running, the SAME one every
 * `review-*`/`fix-*` session it dispatches inherits as its own `cwd`, per `review-dispatch.mjs`'s `root`) are
 * BOTH opted into deliberately, stricter than `session-reaper.mjs`'s own historical CLI default — this is the
 * first caller to run that pass against LIVE, unattended production sessions on a recurring schedule rather
 * than a one-off/dry-run invocation, so it takes every available safety axis rather than the original
 * ground-truth-only default. See {@link defaultReapSessions} and `session-reaper.mjs`'s own doc for exactly
 * what each guard does. A session-reap failure is swallowed exactly like every other best-effort mechanical
 * pass in this repo (`runner.mjs`'s `makeCliMechanicalPasses`) — it never fails the review tick itself.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { runReconcilePass } from '../../scripts/conveyor/reconcile-pass.mjs';
import { dispatchReview } from '../../scripts/operations/review-dispatch.mjs';
import { tagReviewRound } from '../../scripts/conveyor/review-round-tag.mjs';
import { tagReviewStatus } from '../../scripts/conveyor/review-status-tag.mjs';
import { selectStatusCandidates } from '../../scripts/conveyor/reconcile-core.mjs';
import { runSessionReaperPass, REPO_ROOT as SESSION_REAPER_REPO_ROOT, DEFAULT_IDLE_REAP_THRESHOLD_MS } from '../../scripts/conveyor/session-reaper.mjs';
import { CONSTELLATION_REPOS } from '../../scripts/lib/constellation-repos.mjs';
import { forEachRepo } from '../../scripts/lib/for-each-repo.mjs';
import { withGithubAppAuth } from '../../scripts/lib/github-app-auth-env.mjs';
import { withSelfSync } from '../../scripts/lib/daemon-self-sync.mjs';
import {
  RUNNER_LOCK_ROOT, makeOwner,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned,
} from './runner-lock.mjs';

/** This daemon's own lease key — distinct from the Dispatcher's default sentinel, #3870's Fix-dispatch key,
 *  and any future daemon's own key (#3877). */
export const REVIEW_DAEMON_LEASE_KEY = '<conveyor:review-daemon-lease>';

/** Matches runner.mjs's own tick cadence — this sequence ran at that rate as one of its mechanical passes. */
export const DEFAULT_INTERVAL_MS = 120_000;

const WE_SLUG = CONSTELLATION_REPOS.we.slug;

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/** Identical shape to we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs's own `runDaemonLoop` — see
 *  that file's header for why it is duplicated here rather than imported (not yet landed on `main`). */
export async function runDaemonLoop({
  tickOnce, sleep, heartbeat = () => true, onTick = () => {}, onTickError = () => {},
  intervalMs = DEFAULT_INTERVAL_MS, maxTicks = Infinity,
}) {
  if (typeof tickOnce !== 'function') throw new TypeError('runDaemonLoop requires a tickOnce effect');
  let tick = 0;
  for (;;) {
    try {
      const result = await tickOnce();
      onTick(result, tick);
    } catch (error) {
      onTickError(error, tick);
    }
    const alive = await heartbeat();
    if (!alive) return { ticks: tick + 1, stoppedReason: 'lease-lost' };
    if (tick + 1 >= maxTicks) return { ticks: tick + 1, stoppedReason: 'max-ticks' };
    await sleep(intervalMs);
    tick += 1;
  }
}

/**
 * One tick: discover PRs owed a review (`reconcile`), dispatch an independent review for each
 * (`dispatch`), then apply the two purely-informative labels (`tagRound`/`tagStatus`) — the exact sequence
 * runner.mjs's own mechanical pass ran (see the file header for what's deliberately NOT replicated). Every
 * per-PR step is isolated in its own try/catch, mirroring `makeCliMechanicalPasses`'s own "one bad entry
 * never aborts the rest" discipline — a failed dispatch or a failed tag never stops the tick.
 * @returns {{reviewsOwed:number, dispatched:Array<{prNumber:number, agentId:string|null}>, failed:Array<{prNumber:number, error:string}>, refusals:number}}
 */
export function runReviewTick({
  reconcile = runReconcilePass,
  dispatch = dispatchReview,
  tagRound = tagReviewRound,
  tagStatus = tagReviewStatus,
  statusCandidates = selectStatusCandidates,
  repo = WE_SLUG,
} = {}) {
  // `repo` used to reach dispatch/tagRound/tagStatus but never `reconcile` itself (live-caught 2026-09-22,
  // #xvyuwtg): `reconcile({})` always discovered WE's own PRs regardless of the `repo` this tick was called
  // for, which is exactly why plugging in a non-WE repo here silently kept reconciling WE. `reconcile-pass.mjs`'s
  // own `runReconcilePass` already accepts `{repo}` end to end — this was the one call site that dropped it.
  const plan = reconcile({ repo });
  const reviews = (plan.dispatch ?? []).filter((d) => d && d.kind === 'review');
  // Live-caught 2026-09-22, #xli631k: a PR that moved to being owed a FIX (not a review) used to never
  // reach `statusCandidates` at all, so its `review-status:reviewing` label sat stale once its review
  // session finished (PR #2472, ~2 hours stale). `selectStatusCandidates` now takes fix-owed entries as a
  // real third source, included below the same unconditional way `reviews` already is.
  const fixes = (plan.dispatch ?? []).filter((d) => d && d.kind === 'fix');
  const dispatched = [];
  const failed = [];
  for (const d of reviews) {
    try {
      const result = dispatch({ pr: d.prNumber, repo });
      dispatched.push({ prNumber: d.prNumber, agentId: result.agentId ?? null });
    } catch (e) {
      failed.push({ prNumber: d.prNumber, error: String((e && e.message) || e).split('\n')[0] });
      continue; // no round tag on a failed dispatch — the round did not actually advance
    }
    try { tagRound({ pr: d.prNumber, repo, round: (d.attempts ?? 0) + 1 }); }
    catch { /* cosmetic — a failed tag never fails the tick, see review-round-tag.mjs's own header */ }
  }
  for (const c of statusCandidates(reviews, plan.refusals ?? [], fixes)) {
    try { tagStatus({ pr: c.prNumber, repo }); }
    catch { /* cosmetic — see review-status-tag.mjs's own header */ }
  }
  return { reviewsOwed: reviews.length, dispatched, failed, refusals: (plan.refusals ?? []).length };
}

/** The repos this daemon watches each tick. Today: the three constellation repos (WE-only was the ratified
 *  scope at build time — see the file header — but plateau-app PR #167 sat `review:pending` with nothing
 *  watching it, live-caught 2026-09-22, #xvyuwtg). Kept as a plain exported list, not inlined into the loop
 *  below, so a future per-user configurable repo list (plateau as a product letting an operator choose which
 *  repos to integrate) is a source swap here, not a redesign of {@link runReviewTickAllRepos}. */
export const REVIEW_DAEMON_REPOS = Object.values(CONSTELLATION_REPOS).map((r) => r.slug);

/**
 * Run {@link runReviewTick} once per watched repo, isolating one repo's failure from the rest — a plateau-app
 * `gh` outage (or a rate limit, or a repo with zero open PRs) must never stop WE's own reviews from being
 * dispatched, the same "one bad entry never aborts the rest" discipline `runReviewTick` already applies
 * per-PR, one level up. Every downstream step this daemon already calls (`reconcile-pass.mjs`,
 * `review-dispatch.mjs`, both tag scripts) was already fully repo-generic before this — the daemon's own tick
 * was the only WE-hardcoded link (see `runReviewTick`'s own `repo` fix above, filed the same day this was).
 * @param {{repos?:string[], tick?:Function}} [o] - `tick` is injectable (defaults to `runReviewTick`); every
 *   other option is forwarded to it for EVERY repo except `repo` itself, which this loop supplies per-iteration.
 * @returns {{repos:Array<{repo:string, result?:object, error?:string}>, reviewsOwed:number,
 *   dispatched:Array<object>, failed:Array<object>, refusals:number}}
 */
export function runReviewTickAllRepos({ repos = REVIEW_DAEMON_REPOS, tick = runReviewTick, ...tickOpts } = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo }));
  const dispatched = [];
  const failed = [];
  let reviewsOwed = 0;
  let refusals = 0;
  for (const entry of perRepo) {
    if (entry.error) {
      failed.push({ prNumber: null, repo: entry.repo, error: entry.error });
      continue;
    }
    const { repo, result } = entry;
    reviewsOwed += result.reviewsOwed;
    refusals += result.refusals;
    for (const d of result.dispatched) dispatched.push({ ...d, repo });
    for (const f of result.failed) failed.push({ ...f, repo });
  }
  return { repos: perRepo, reviewsOwed, dispatched, failed, refusals };
}

// ── IO SHELL (runs only as a CLI — owns the real lease + the real reconcile/dispatch/tag calls) ─────────────

// Live-caught bug (this daemon's own first launchd-managed run, and the sibling #3870/pass-daemon.mjs
// daemons built on this exact pattern): `.unref()`-ing this timer told Node it was fine to exit before it
// fired. Between ticks, nothing else keeps the event loop alive (a spawned agent's own stdio is `ignore`d —
// no other ref'd handle exists), so the daemon exited right after its FIRST tick instead of waiting out
// `intervalMs` and looping. A REF'd timer (Node's default — no `.unref()`) is exactly what a resident
// daemon needs: the sleep IS the reason it stays alive between ticks.
export function realSleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }

/**
 * THE DEFAULT SESSION-REAP EFFECT for one tick — see the file header ("THE SESSION REAPER LIVES HERE TOO")
 * for why this daemon owns it and why every option below is deliberately stricter than
 * `session-reaper.mjs`'s own CLI default:
 *   - `allowedCwd: SESSION_REAPER_REPO_ROOT` — scopes reaping to sessions spawned from THIS checkout (the
 *     naming-pattern-plus-cwd safety rule); resolved by `session-reaper.mjs`'s OWN script location, so it is
 *     always this daemon's real dedicated-clone root, never a hardcoded path.
 *   - `neverReapWorking: true` — a session the listing itself reports as still actively `working` is never
 *     touched, full stop, even if a secondary signal (a merged PR, a completion record) suggests otherwise.
 *   - `idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS` — the generous last-resort backstop for a `blocked`
 *     session neither the completion-record nor the backlog/PR axis can confirm either way.
 * Every other option (the listing read, the ground-truth resolver, the completion-record resolver, the real
 * `claude stop`) is `session-reaper.mjs`'s own default. Injectable so a test can swap it for a fake.
 */
export function defaultReapSessions() {
  return runSessionReaperPass({
    allowedCwd: SESSION_REAPER_REPO_ROOT,
    neverReapWorking: true,
    idleThresholdMs: DEFAULT_IDLE_REAP_THRESHOLD_MS,
  });
}

export function buildCliDaemonEffects({
  owner, intervalMs = DEFAULT_INTERVAL_MS, log = console,
  reapSessions = defaultReapSessions, runReview = runReviewTickAllRepos,
} = {}) {
  return {
    intervalMs,
    tickOnce: async () => {
      const result = await runReview();
      // Best-effort, mirrors `runner.mjs`'s own `makeCliMechanicalPasses` discipline: a session-reap failure
      // is logged and swallowed, never lets a lingering `claude` process take down this tick's real job
      // (dispatching/tagging reviews).
      let sessionReap = null;
      try {
        sessionReap = reapSessions();
      } catch (e) {
        log.error(`review-daemon: session-reap failed (non-fatal): ${String((e && e.message) || e).split('\n')[0]}`);
      }
      return { ...result, sessionReap };
    },
    sleep: realSleep,
    heartbeat: () => heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY }),
    onTick: (result) => {
      log.error(`review-daemon: tick (${result.repos.map((r) => r.repo).join(', ')}) — ${result.reviewsOwed} owed, dispatched ${result.dispatched.length}, failed ${result.failed.length}`);
      for (const f of result.failed) log.error(`review-daemon: ${f.repo}#${f.prNumber ?? '?'} failed (non-fatal): ${f.error}`);
      for (const r of result.repos) if (r.error) log.error(`review-daemon: ${r.repo} reconcile failed (non-fatal, other repos unaffected): ${r.error}`);
      if (result.sessionReap && !result.sessionReap.unreadable) {
        const sr = result.sessionReap;
        log.error(`review-daemon: session-reap — ${sr.scanned} scanned, ${sr.stopped} stopped${sr.alreadyGone ? `, ${sr.alreadyGone} already gone` : ''}${sr.failures ? `, ${sr.failures} failed` : ''}${sr.anomalies ? `, ${sr.anomalies} anomalies` : ''}, ${sr.kept} kept`);
      }
    },
    onTickError: (error) => {
      log.error(`review-daemon: tick failed (non-fatal): ${String((error && error.message) || error).split('\n')[0]}`);
    },
  };
}

async function main() {
  const owner = makeOwner('review-daemon');
  const acquired = acquireRunnerLease(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY });
  if (!acquired.ok) {
    console.error(`review-daemon: a live instance already holds the lease (${acquired.heldBy}) — exiting.`);
    return;
  }
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.error(`review-daemon: ${signal} — releasing the lease and exiting.`);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  console.error(`review-daemon: started on ${hostname()}:${process.pid}, tick every ${DEFAULT_INTERVAL_MS}ms.`);
  // xv6fciw — keep this daemon's dedicated clone on origin/main, and restart onto new code BETWEEN ticks
  // (launchd KeepAlive brings it back), instead of refusing every dispatch until someone re-syncs by hand.
  const selfRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const restartOntoNewCode = () => {
    stopping = true;
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY });
    process.exit(0);
  };
  const { stoppedReason } = await runDaemonLoop(
    withSelfSync(withGithubAppAuth(buildCliDaemonEffects({ owner })), { root: selfRoot, onRestart: restartOntoNewCode }),
  );
  if (!stopping) {
    console.error(`review-daemon: loop stopped (${stoppedReason}) — releasing the lease and exiting.`);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY });
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main().catch((e) => { console.error(`review-daemon: fatal: ${String((e && e.message) || e)}`); process.exit(1); });
}
