#!/usr/bin/env node
/**
 * @file skills-src/conveyor/review-daemon.mjs
 * @description #3876 (epic #3383) — the standalone Review daemon: reconcile-pass.mjs (discovery) +
 *   review-dispatch.mjs (dispatch) + review-round-tag.mjs / review-status-tag.mjs (cosmetic labels),
 *   grouped into ONE daemon per #3860's split analysis — one sequential pass over the same PR, not four
 *   things worth separating. WE-only, matching #3870's own Fix-dispatch daemon scoping.
 *
 * WHAT THIS REPLACES. we:skills-src/conveyor/runner.mjs's own `makeCliMechanicalPasses` ran this exact
 * sequence (reconcile-pass → review-dispatch per review-kind entry → review-round-tag → review-status-tag)
 * as ONE STEP of its own per-tick pass list, with a shared `--prs-file` fetched once and passed to both
 * reconcile-fix-dispatch AND reconcile-pass in the same tick. This daemon does NOT replicate that sharing —
 * it does its own `gh pr list` each tick, an accepted, honest tradeoff of running independently (the same
 * tradeoff #3870's Fix-dispatch daemon already made). Cross-repo iteration (frontierui, plateau-app) is
 * ALSO out of scope here — the legacy runner's multi-repo loop is not replicated; this daemon is WE-only,
 * matching #3870.
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
  const plan = reconcile({});
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

// ── IO SHELL (runs only as a CLI — owns the real lease + the real reconcile/dispatch/tag calls) ─────────────

function realSleep(ms) { return new Promise((resolve) => { const t = setTimeout(resolve, ms); t.unref?.(); }); }

export function buildCliDaemonEffects({ owner, intervalMs = DEFAULT_INTERVAL_MS, log = console } = {}) {
  return {
    intervalMs,
    tickOnce: () => runReviewTick(),
    sleep: realSleep,
    heartbeat: () => heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key: REVIEW_DAEMON_LEASE_KEY }),
    onTick: (result) => {
      log.error(`review-daemon: tick — ${result.reviewsOwed} owed, dispatched ${result.dispatched.length}, failed ${result.failed.length}`);
      for (const f of result.failed) log.error(`review-daemon: PR #${f.prNumber} dispatch failed (non-fatal): ${f.error}`);
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
