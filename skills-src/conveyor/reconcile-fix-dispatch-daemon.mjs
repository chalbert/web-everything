#!/usr/bin/env node
/**
 * @file skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs
 * @description #3870 (epic #3383) — the FIRST daemon pulled out of the single conveyor runner.mjs: a
 *   long-lived process that runs {@link ../../scripts/conveyor/reconcile-fix-dispatch.mjs}'s
 *   `runReconcileFixDispatch` on its own interval, standalone, instead of as one of runner.mjs's own
 *   sequential mechanical passes.
 *
 * WHY THIS PASS, FIRST. Confirmed by direct read (see #3860's split analysis,
 * reports/2026-09-22-backlog-split-analysis.md): `runReconcileFixDispatch` already fences its own
 * resume-or-dispatch decision per PR through `we:scripts/operations/action-store.mjs`'s durable, atomic
 * (`fs.openSync(path,'wx')`) per-resource claim ledger — independent of the tick mutex, independent of any
 * runner-lock lease. That means running TWO copies of this daemon at once is SAFE by construction (the
 * ledger refuses the second claim); a keyed runner-lock lease below is taken anyway, but purely as an
 * efficiency measure (never launch a second copy that would just watch every claim get refused), not a
 * correctness requirement — unlike the Verify daemon (#3878), which genuinely needs its own lease before it
 * is safe to run standalone at all.
 *
 * ROLLING CUTOVER (per #3860's plan): this daemon runs ALONGSIDE runner.mjs's own
 * `reconcile-fix-dispatch.mjs` mechanical pass for a bake period — both are safe to run concurrently for the
 * same reason a second copy of just this daemon would be. Dropping the pass from runner.mjs's own
 * `makeCliMechanicalPasses` list is a separate, later step once this daemon has baked; this item does not
 * do it.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrored from runner.mjs's own header): {@link runDaemonLoop} has no
 * `setTimeout`/`setInterval`, no real lease, no real dispatch — every effect (stepping one tick, sleeping,
 * heartbeating, logging) is injected, so the whole loop/backoff/stop-condition decision is unit-tested with
 * fakes. The IO shell (`main()`, gated on the direct-invocation check) wires the real
 * `runReconcileFixDispatch`, a real interval sleep, and the real keyed runner-lock lease.
 */

import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUNNER_LOCK_ROOT, makeOwner,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned,
} from './runner-lock.mjs';
import { runReconcileFixDispatch } from '../../scripts/conveyor/reconcile-fix-dispatch.mjs';
import { CONSTELLATION_REPOS } from '../../scripts/lib/constellation-repos.mjs';
import { forEachRepo } from '../../scripts/lib/for-each-repo.mjs';
import { withGithubAppAuth } from '../../scripts/lib/github-app-auth-env.mjs';
import { withSelfSync } from '../../scripts/lib/daemon-self-sync.mjs';
import { isStaleMainRefusalMessage } from '../../scripts/lib/main-staleness.mjs';

/** This daemon's own lease key — distinct from the Dispatcher's default sentinel and from the Verify
 *  daemon's own key (#3878), so none of the three ever contend on the same lock dir (#3877). */
export const RECONCILE_FIX_DISPATCH_LEASE_KEY = '<conveyor:reconcile-fix-dispatch-daemon-lease>';

/** Matches runner.mjs's own tick cadence (DEFAULT_TICK_INTERVAL_MS) — this pass ran at that rate as one of
 *  runner.mjs's mechanical passes; standing alone, there is no reason to run it faster or slower. */
export const DEFAULT_INTERVAL_MS = 120_000;

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/**
 * The daemon's whole control flow. Ticks `tickOnce` forever (or until `maxTicks`/`shouldStop`), isolating a
 * single tick's failure (logged via `onTickError`, never fatal — the same "one bad tick never kills the
 * loop" discipline runner.mjs's own `makeCliMechanicalPasses` wrapper already applies to every pass it
 * shells) so a transient `gh`/lane-pool hiccup degrades to "try again next tick", not a dead daemon. Stops
 * immediately (before sleeping) if a tick's own heartbeat reports the lease was lost — continuing to dispatch
 * without the lease would be pure waste (the ledger still refuses a stolen claim, but nothing is gained by
 * trying).
 * @param {{
 *   tickOnce: () => Promise<object>|object,
 *   sleep: (ms:number) => Promise<void>,
 *   heartbeat?: () => Promise<boolean>|boolean,
 *   onTick?: (result:object, tick:number) => void,
 *   onTickError?: (error:Error, tick:number) => void,
 *   intervalMs?: number,
 *   maxTicks?: number,
 * }} o
 * @returns {Promise<{ticks:number, stoppedReason:string}>}
 */
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

/** The repos this daemon watches each tick — mirrors we:skills-src/conveyor/review-daemon.mjs's own
 *  `REVIEW_DAEMON_REPOS`. Multi-repo slice 2 (#x1rr9rh, the ratified `#conveyor-multi-repo-model` rule, see
 *  we:reports/2026-09-23-conveyor-multi-repo-gap-map.md): before this, `tickOnce` called
 *  `runReconcileFixDispatch({})` with no repo, so a PR owed a fix in frontierui/plateau-app was never even
 *  recorded as unsupported — the daemon only ever looked at WE. Fix/CI-heal dispatch itself stays WE-only
 *  today ({@link ../../scripts/lib/repo-profile.mjs}'s `capabilities.fix`/`ciHeal` — turning them on for the
 *  couple repos is a later slice), but every repo is now actually TICKED, so the existing `unsupported-repo`
 *  refusal + ledger write run and are recorded for them instead of being skipped silently. */
export const FIX_DISPATCH_DAEMON_REPOS = Object.values(CONSTELLATION_REPOS).map((r) => r.slug);

/**
 * Run {@link runReconcileFixDispatch} once per watched repo via the shared {@link forEachRepo} helper,
 * isolating one repo's failure from the rest — the same discipline
 * we:skills-src/conveyor/review-daemon.mjs's own `runReviewTickAllRepos` already applies, extracted into
 * `forEachRepo` so both daemons share one loop.
 * @param {{repos?:string[], tick?:Function}} [o] - `tick` is injectable (defaults to the real
 *   `runReconcileFixDispatch`); every other option is forwarded to it for EVERY repo except `repo` itself,
 *   which this loop supplies per-iteration.
 * @returns {{repos:Array<{repo:string, result?:object, error?:string}>, dispatched:Array<object>,
 *   refusals:Array<object>}}
 */
export function runReconcileFixDispatchAllRepos({ repos = FIX_DISPATCH_DAEMON_REPOS, tick = runReconcileFixDispatch, ...tickOpts } = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo }));
  const dispatched = [];
  const refusals = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    for (const d of (result.dispatched ?? [])) dispatched.push({ ...d, repo });
    for (const r of (result.refusals ?? [])) refusals.push({ ...r, repo });
  }
  return { repos: perRepo, dispatched, refusals };
}

/**
 * #3383 bug 1 — did this tick's own result show it hit `assertMainNotStale`'s refusal for at least one repo?
 * (see `runReconcileFixDispatchAllRepos`: a whole-repo tick failure — including the stale-main refusal thrown
 * near the top of `runReconcileFixDispatch` — lands in `refusals` as `{repo, prNumber:null, kind:'tick-failed',
 * why:<message>}`.) Wired into `withSelfSync`'s `hasStaleRefusal` option so the daemon re-syncs immediately
 * instead of wasting the full interval on a race it will otherwise keep losing. Pure — takes the tick result,
 * no IO of its own.
 * @param {{refusals?:Array<{kind?:string, why?:string}>}} tickResult
 * @returns {boolean}
 */
export function hasStaleMainRefusal(tickResult) {
  return (tickResult?.refusals ?? []).some((r) => r && r.kind === 'tick-failed' && isStaleMainRefusalMessage(r.why));
}

// ── IO SHELL (runs only as a CLI — owns the real lease + the real dispatch pass) ─────────────────────────────

// #3870 LIVE-CAUGHT BUG: `.unref()`-ing this timer told Node it was fine to exit before it fired — with
// nothing else keeping the event loop alive between ticks (the spawned agent's own stdio is `ignore`d, no
// other ref'd handle exists), the daemon exited right after its FIRST tick instead of waiting and looping.
// A REF'd timer (Node's default — no `.unref()`) is exactly what a resident daemon needs: the sleep IS the
// reason this process stays alive between ticks, not incidental background bookkeeping safe to drop on exit.
export function realSleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }

/** Build the real effects for {@link runDaemonLoop}: a real tick of `runReconcileFixDispatch`, a real
 *  interval sleep, and a real keyed lease heartbeat. Kept as its own factory (mirroring
 *  `buildCliTickEffects` in runner.mjs) so `main()` stays a thin wire-up. */
export function buildCliDaemonEffects({ owner, intervalMs = DEFAULT_INTERVAL_MS, log = console } = {}) {
  return {
    intervalMs,
    tickOnce: () => runReconcileFixDispatchAllRepos(),
    sleep: realSleep,
    heartbeat: () => heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY }),
    onTick: (result) => {
      const { repos = [], dispatched = [], refusals = [] } = result || {};
      log.error(`reconcile-fix-dispatch-daemon: tick (${repos.map((r) => r.repo).join(', ')}) — dispatched ${dispatched.length}, refused ${refusals.length}`);
      for (const r of repos) if (r.error) log.error(`reconcile-fix-dispatch-daemon: ${r.repo} tick failed (non-fatal, other repos unaffected): ${r.error}`);
    },
    onTickError: (error) => {
      log.error(`reconcile-fix-dispatch-daemon: tick failed (non-fatal): ${String((error && error.message) || error).split('\n')[0]}`);
    },
  };
}

async function main() {
  const owner = makeOwner('reconcile-fix-dispatch-daemon');
  const acquired = acquireRunnerLease(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY });
  if (!acquired.ok) {
    // Efficiency no-op, not a safety refusal (see file header) — a live copy is already doing this work.
    console.error(`reconcile-fix-dispatch-daemon: a live instance already holds the lease (${acquired.heldBy}) — exiting.`);
    return;
  }
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.error(`reconcile-fix-dispatch-daemon: ${signal} — releasing the lease and exiting.`);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  console.error(`reconcile-fix-dispatch-daemon: started on ${hostname()}:${process.pid}, tick every ${DEFAULT_INTERVAL_MS}ms.`);
  // xv6fciw — keep this daemon's dedicated clone on origin/main, and restart onto new code BETWEEN ticks
  // (launchd KeepAlive brings it back), instead of refusing every dispatch until someone re-syncs by hand.
  const selfRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const restartOntoNewCode = () => {
    stopping = true;
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY });
    process.exit(0);
  };
  const { stoppedReason } = await runDaemonLoop(
    withSelfSync(withGithubAppAuth(buildCliDaemonEffects({ owner })), {
      root: selfRoot, onRestart: restartOntoNewCode, hasStaleRefusal: hasStaleMainRefusal,
    }),
  );
  if (!stopping) {
    console.error(`reconcile-fix-dispatch-daemon: loop stopped (${stoppedReason}) — releasing the lease and exiting.`);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY });
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main().catch((e) => { console.error(`reconcile-fix-dispatch-daemon: fatal: ${String((e && e.message) || e)}`); process.exit(1); });
}
