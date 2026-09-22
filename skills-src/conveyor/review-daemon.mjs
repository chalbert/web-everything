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
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { runReconcilePass } from '../../scripts/conveyor/reconcile-pass.mjs';
import { dispatchReview } from '../../scripts/operations/review-dispatch.mjs';
import { tagReviewRound } from '../../scripts/conveyor/review-round-tag.mjs';
import { tagReviewStatus } from '../../scripts/conveyor/review-status-tag.mjs';
import { selectStatusCandidates } from '../../scripts/conveyor/reconcile-core.mjs';
import { CONSTELLATION_REPOS } from '../../scripts/lib/constellation-repos.mjs';
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
  for (const c of statusCandidates(reviews, plan.refusals ?? [])) {
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
  const perRepo = [];
  const dispatched = [];
  const failed = [];
  let reviewsOwed = 0;
  let refusals = 0;
  for (const repo of repos) {
    try {
      const result = tick({ ...tickOpts, repo });
      perRepo.push({ repo, result });
      reviewsOwed += result.reviewsOwed;
      refusals += result.refusals;
      for (const d of result.dispatched) dispatched.push({ ...d, repo });
      for (const f of result.failed) failed.push({ ...f, repo });
    } catch (e) {
      const error = String((e && e.message) || e).split('\n')[0];
      perRepo.push({ repo, error });
      failed.push({ prNumber: null, repo, error });
    }
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

export function buildCliDaemonEffects({ owner, intervalMs = DEFAULT_INTERVAL_MS, log = console } = {}) {
  return {
    intervalMs,
    tickOnce: () => runReviewTickAllRepos(),
    sleep: realSleep,
    heartbeat: () => heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY }),
    onTick: (result) => {
      log.error(`review-daemon: tick (${result.repos.map((r) => r.repo).join(', ')}) — ${result.reviewsOwed} owed, dispatched ${result.dispatched.length}, failed ${result.failed.length}`);
      for (const f of result.failed) log.error(`review-daemon: ${f.repo}#${f.prNumber ?? '?'} failed (non-fatal): ${f.error}`);
      for (const r of result.repos) if (r.error) log.error(`review-daemon: ${r.repo} reconcile failed (non-fatal, other repos unaffected): ${r.error}`);
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
  const { stoppedReason } = await runDaemonLoop(buildCliDaemonEffects({ owner }));
  if (!stopping) {
    console.error(`review-daemon: loop stopped (${stoppedReason}) — releasing the lease and exiting.`);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY });
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main().catch((e) => { console.error(`review-daemon: fatal: ${String((e && e.message) || e)}`); process.exit(1); });
}
