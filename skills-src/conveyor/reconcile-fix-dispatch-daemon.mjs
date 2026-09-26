#!/usr/bin/env node
/**
 * @file skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs
 * @description #3870 (epic #3383) — the FIRST daemon pulled out of the single conveyor runner.mjs: a
 *   long-lived process that runs {@link ../../scripts/conveyor/reconcile-fix-dispatch.mjs}'s
 *   `runReconcileFixDispatch` on its own interval, standalone, instead of as one of runner.mjs's own
 *   sequential mechanical passes.
 *
 * WHY THIS PASS, FIRST — AND A CORRECTION (#x0jphk5, 2026-09-25). This paragraph previously claimed, by
 * direct read (see #3860's split analysis, reports/2026-09-22-backlog-split-analysis.md), that
 * `runReconcileFixDispatch` already fenced its own resume-or-dispatch decision per PR through
 * `we:scripts/operations/action-store.mjs`'s durable, atomic per-resource claim ledger. THAT WAS FALSE ON
 * `main`: no `scripts/conveyor/action-store.mjs` exists at all, `action-store.mjs` (at
 * `we:scripts/operations/action-store.mjs`) was never imported by the fix-dispatch path, and
 * `reconcile-fix-dispatch.mjs`'s own header said the opposite in plain words ("NAME-BASED LIVENESS, NOT A
 * SEPARATE LEDGER"). The only real guard was a session-name match against a `claude agents --json --all`
 * listing measured (`we:scripts/operations/dispatch-lane-io.mjs`) to lag the CLI's real state by 26+ SECONDS —
 * so running TWO copies of this daemon (or this daemon alongside `runner.mjs`'s own mechanical pass, see
 * ROLLING CUTOVER below) was NOT safe by construction; a second dispatcher reading that stale listing within
 * the lag window could double-dispatch the same `fix-<pr>`.
 *
 * FIXED, NOT JUST DOCUMENTED: `reconcile-fix-dispatch.mjs`'s `dispatchFix`, `tryResumeFix`, and
 * `we:scripts/operations/ci-heal-pr-dispatch.mjs`'s `dispatchCiHeal` now each take a REAL atomic
 * `(repo, pr, headRefOid)` claim — `we:scripts/conveyor/fix-dispatch-claim.mjs`, an `O_EXCL` file under the
 * shared coordination sidecar with a TTL-bounded dead-holder reclaim, reusing
 * `we:scripts/readiness/file-locks.mjs`'s existing lock primitives — before ever spawning or resuming. With
 * that in place, running TWO copies of this daemon at once (or this daemon alongside the mechanical pass) IS
 * now safe: the second dispatcher inside the listing-lag window is refused (`held`) rather than merely
 * unaware. The keyed runner-lock lease below is still taken, purely as an efficiency measure (never launch a
 * second copy that would just watch every claim get refused), not a correctness requirement — unlike the
 * Verify daemon (#3878), which genuinely needs its own lease before it is safe to run standalone at all.
 *
 * ROLLING CUTOVER (per #3860's plan): this daemon runs ALONGSIDE runner.mjs's own
 * `reconcile-fix-dispatch.mjs` mechanical pass for a bake period — safe to run concurrently now for the real
 * reason above (the claim), not the ledger this header used to (wrongly) describe. Dropping the pass from
 * runner.mjs's own `makeCliMechanicalPasses` list is a separate, later step once this daemon has baked; this
 * item does not do it.
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
import { runReconcileCiHealDispatch } from '../../scripts/operations/ci-heal-pr-dispatch.mjs';
import { resolveLiveQueueBaseline } from '../../scripts/readiness/heavy-admission.mjs'; // card xkyw1x4
import { createQueueBudget } from '../../scripts/readiness/heavy-queue-projection.mjs'; // card xkyw1x4
import { runReconcilePass, defaultReadPrs } from '../../scripts/conveyor/reconcile-pass.mjs'; // #4191
import { planNoteComment, postNoteComment } from '../../scripts/conveyor/reconcile-note-comment.mjs'; // #4191
import { planClaudeAuthDispatchGate } from '../../scripts/conveyor/claude-auth-health.mjs'; // card x5kagse

/** The checkout this daemon runs from — its heavy-admission root is the host-wide `<workspace>/.lanes` one. */
const DAEMON_REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
import { sweepHungCiRecovery, sweepCiRedRecovery } from '../../scripts/conveyor/ci-red-recovery-watch.mjs';
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
 *   refusals:Array<object>, reconcileRefusals:Array<object>}} `reconcileRefusals` here (unlike the
 *   SAME-NAMED, differently-shaped field on a single {@link runReconcileFixDispatch} result, which is a bare
 *   count) is the per-repo-tagged ARRAY of `we:scripts/conveyor/reconcile-core.mjs#planReconcile`'s own
 *   outright refusals — a PR reconcile never even offered as a `fix`/`ci-heal` dispatch entry (#x0mn6x0, epic
 *   #4075/#3383; see `runReconcileFixDispatch`'s own `reconcileRefusalDetails` docblock for the full why).
 */
export function runReconcileFixDispatchAllRepos({ repos = FIX_DISPATCH_DAEMON_REPOS, tick = runReconcileFixDispatch, ...tickOpts } = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo }));
  const dispatched = [];
  const refusals = [];
  const reconcileRefusals = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    for (const d of (result.dispatched ?? [])) dispatched.push({ ...d, repo });
    for (const r of (result.refusals ?? [])) refusals.push({ ...r, repo });
    for (const r of (result.reconcileRefusalDetails ?? [])) reconcileRefusals.push({ ...r, repo });
  }
  return {
    repos: perRepo, dispatched, refusals, reconcileRefusals,
  };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runReconcileCiHealDispatchAllRepos — #xngv3vn (epic
 * #3383/#4075): CI-HEAL HAD NO CALLER IN ANY RUNNING DAEMON. `we:scripts/operations/ci-heal-pr-dispatch.mjs
 * #runReconcileCiHealDispatch` already existed (#2666, repo-tagged in #3967 multi-repo slice 7) and already
 * reads the SAME `reconcile-core.mjs` plan this daemon's `fix` half reads (`runReconcilePass`), with its OWN
 * repo-capability gate and the SAME durable retry cap (`reconcile-core.mjs#planReconcile`'s own `ciHealCap`) —
 * but an adversarial review found nothing in the tree ever called it: a red PR opened by hand, by a sibling
 * process, or orphaned by a runner restart never got healed. This is that caller, per repo, with every existing
 * cap left exactly as `runReconcileCiHealDispatch` already enforces it (never re-derived here).
 *
 * Mirrors {@link runReconcileFixDispatchAllRepos}'s own per-repo fan-out and per-repo failure isolation, with
 * ONE necessary difference: {@link runReconcileCiHealDispatch} is `async` ({@link dispatchCiHeal} awaits its
 * dispatch sink), and the shared {@link forEachRepo} helper does not await a per-repo promise — reusing it here
 * unchanged would race every repo's dispatch concurrently and silently swallow a rejected promise as a
 * "successful" `{repo, result: <pending Promise>}` entry. So this loop awaits each repo SEQUENTIALLY instead,
 * giving the identical "one repo's failure never blocks the rest" isolation `forEachRepo` gives synchronously.
 * @param {{repos?:string[], tick?:Function}} [o] - `tick` is injectable (defaults to the real
 *   `runReconcileCiHealDispatch`); every other option is forwarded to it for EVERY repo except `repo` itself.
 * @returns {Promise<{repos:Array<{repo:string, result?:object, error?:string}>, dispatched:Array<object>,
 *   refusals:Array<object>, reconcileRefusals:Array<object>}>} `reconcileRefusals` — see
 *   {@link runReconcileFixDispatchAllRepos}'s own identical field for the shape and the why (#x0mn6x0, epic
 *   #4075/#3383).
 */
export async function runReconcileCiHealDispatchAllRepos({ repos = FIX_DISPATCH_DAEMON_REPOS, tick = runReconcileCiHealDispatch, ...tickOpts } = {}) {
  const perRepo = [];
  for (const repo of repos) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential by design (see this fn's own docblock): one
      // repo's ci-heal tick must finish (or fail) before the next repo's is attempted, so a rejection is
      // captured per repo instead of racing every repo's dispatch concurrently.
      const result = await tick({ ...tickOpts, repo });
      perRepo.push({ repo, result });
    } catch (e) {
      perRepo.push({ repo, error: String((e && e.message) || e).split('\n')[0] });
    }
  }
  const dispatched = [];
  const refusals = [];
  const reconcileRefusals = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    for (const d of (result.dispatched ?? [])) dispatched.push({ ...d, repo });
    for (const r of (result.refusals ?? [])) refusals.push({ ...r, repo });
    for (const r of (result.reconcileRefusalDetails ?? [])) reconcileRefusals.push({ ...r, repo });
  }
  return {
    repos: perRepo, dispatched, refusals, reconcileRefusals,
  };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#defaultReadNotesForRepo — #4191 (epic #4075/#3383):
 * "reconcile-core.mjs#planReconcile emits `notes` (`ci-heal-exhausted`, `awaiting-permission`) that nothing
 * downstream reads" — NEITHER `runReconcileFixDispatch` (`we:scripts/conveyor/reconcile-fix-dispatch.mjs`) NOR
 * `runReconcileCiHealDispatch` (`we:scripts/operations/ci-heal-pr-dispatch.mjs`) forwards its own
 * `reconciled.notes` out of their return shape (both already forward `reconciled.refusals` as
 * `reconcileRefusalDetails` — see either one's own docblock — `notes` was simply never added alongside it). This
 * card's own file scope deliberately does NOT touch either of those two files (both are actively owned by other
 * in-flight cards this same epic runs concurrently — see the delivery plan's file-ownership table), so rather
 * than thread a new field through either one's return shape, this is a THIRD, independent, per-repo call to
 * {@link runReconcilePass} — the SAME pure `planReconcile` plan both of those files already read, unchanged, no
 * new export. The only addition here is capturing the raw PR list `readPrs` already fetches, keyed by PR
 * number, so the comment-episode dedup below (`we:scripts/conveyor/reconcile-note-comment.mjs#planNoteComment`)
 * can read each note's own PR's `comments` without a FOURTH gh round-trip.
 * @param {{repo:string, reconcile?:Function, readPrs?:Function}} o
 * @returns {{notes:Array<object>, prsByNumber:Map<number,object>}}
 */
export function defaultReadNotesForRepo({ repo, reconcile = runReconcilePass, readPrs = defaultReadPrs } = {}) {
  let capturedPrs = [];
  const result = reconcile({
    repo,
    readPrs: (o) => { capturedPrs = readPrs(o); return capturedPrs; },
  });
  return {
    notes: Array.isArray(result?.notes) ? result.notes : [],
    prsByNumber: new Map((Array.isArray(capturedPrs) ? capturedPrs : []).map((pr) => [pr.number, pr])),
  };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#defaultNoteCommentDryRun — #4191: this repo's own
 * "land the write path OFF, prove it live, then turn it on" convention (see the delivery plan's "Routing
 * decisions" — supervision enforcement lands OFF until real miss data), applied to a brand-new PR-write action.
 * Dry-run (compute + log the comment that WOULD post, never call `gh`) unless `WE_CONVEYOR_POST_NOTE_COMMENTS=1`
 * is set in the daemon's own environment — an explicit operator opt-in, never this card's own default. This
 * card's own Done-when already accepts a QUEUED comment payload as sufficient (we:backlog/4191-*.md, item 1's
 * own parenthetical), so nothing this card is scored on is lost by defaulting to dry-run.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function defaultNoteCommentDryRun(env = process.env) {
  return env?.WE_CONVEYOR_POST_NOTE_COMMENTS !== '1';
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runReconcileNotesAllRepos — fan out
 * {@link defaultReadNotesForRepo} over every watched repo (mirrors {@link runReconcileFixDispatchAllRepos}'s own
 * per-repo isolation via {@link forEachRepo}), then plan — and, unless `dryRun`, actually post — exactly ONE
 * durable PR comment per note episode ({@link planNoteComment}, `we:scripts/conveyor/reconcile-note-comment.mjs`)
 * that a trusted principal has not already posted. `dryRun` defaults to {@link defaultNoteCommentDryRun}'s own
 * env-gated answer; a test (or the live proof) passes `dryRun: true` explicitly regardless of environment, per
 * this card's own PROOF section ("don't post real PR comments in tests or the proof").
 * @param {{repos?:string[], tick?:Function, postComment?:Function, dryRun?:boolean}} [o]
 * @returns {{repos:Array<object>, notes:Array<object>, refusals:Array<object>, comments:Array<object>}}
 *   `comments` — one row per note this tick saw, `{repo, prNumber, kind, key, body?, alreadyPosted, posted,
 *   dryRun, error?}` (`body` is present only when a comment was newly planned — omitted once `alreadyPosted`,
 *   nothing new to show).
 */
export function runReconcileNotesAllRepos({
  repos = FIX_DISPATCH_DAEMON_REPOS, tick = defaultReadNotesForRepo, postComment = postNoteComment,
  dryRun = defaultNoteCommentDryRun(), ...tickOpts
} = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo }));
  const notes = [];
  const refusals = [];
  const comments = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    const prsByNumber = result?.prsByNumber ?? new Map();
    for (const n of (result?.notes ?? [])) {
      const tagged = { ...n, repo };
      notes.push(tagged);
      const pr = prsByNumber.get(n.prNumber);
      const plan = planNoteComment(tagged, pr?.comments);
      if (plan.alreadyPosted) {
        comments.push({
          repo, prNumber: n.prNumber, kind: n.kind, key: plan.key, alreadyPosted: true, posted: false, dryRun,
        });
        continue;
      }
      if (dryRun) {
        comments.push({
          repo, prNumber: n.prNumber, kind: n.kind, key: plan.key, body: plan.body, alreadyPosted: false, posted: false, dryRun: true,
        });
        continue;
      }
      const outcome = postComment({ repo, pr: n.prNumber, body: plan.body });
      comments.push({
        repo,
        prNumber: n.prNumber,
        kind: n.kind,
        key: plan.key,
        body: plan.body,
        alreadyPosted: false,
        posted: !!outcome.ok,
        dryRun: false,
        ...(outcome.ok ? {} : { error: outcome.error }),
      });
    }
  }
  return { repos: perRepo, notes, refusals, comments };
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

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runHungCiRecoveryAllRepos — xd1sfms (epic
 * #4075/#3383): `we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepHungCiRecovery` (the hung-CI-run
 * cancel+rerun pass — see that file's own header, and `we:scripts/conveyor/main-red-recovery.mjs`'s "HUNG-CI-
 * RUN RECOVERY" section, for the #2636 incident this exists to fix) IS already registered per-repo in
 * `we:skills-src/conveyor/daemon-manifest.mjs` (`ci-red-recovery-watch-<repo>`, wired onto `pass-daemon.mjs`)
 * — but, LIVE-CONFIRMED 2026-09-25, NO launchd job installs `pass-daemon.mjs` for that entry (only an
 * `.example` plist exists under `we:skills-src/conveyor/launchd/`), so nothing has ever actually invoked it.
 * Rather than touch launchd (out of scope for this card, and a separate operational action, not a code
 * change), this pass rides the ONE daemon already confirmed live and ticking on every watched repo —
 * `reconcile-fix-dispatch-daemon.mjs` itself, the exact daemon whose own tick logged `nothing-owed` for #2636
 * throughout its 3h+ hang. Mirrors {@link runReconcileFixDispatchAllRepos}'s own per-repo fan-out and
 * per-repo failure isolation (via {@link forEachRepo}) — one repo's sweep failure never blocks the rest.
 * `apply: true` always (a daemon's whole point is to actually act once a candidate clears the pass's own
 * idempotent cap — the durable per-sha comment-count floor `sweepHungCiRecovery` already enforces makes this
 * safe to run unconditionally on the default cadence, the same "efficiency no-op, not a safety refusal" trade
 * every sibling pass-daemon entry in `daemon-manifest.mjs` already documents for itself).
 * @param {{repos?:string[], tick?:Function}} [o] - `tick` is injectable (defaults to the real
 *   `sweepHungCiRecovery`); every other option is forwarded to it for EVERY repo except `repo` itself.
 * @returns {{repos:Array<{repo:string, result?:object, error?:string}>, dispatched:Array<object>,
 *   refusals:Array<object>}} `dispatched`/`refusals` here are the pass's own `applied`/`dispatch`+`refusals`
 *   rows, repo-tagged the same way {@link runReconcileFixDispatchAllRepos} tags its own.
 */
export function runHungCiRecoveryAllRepos({ repos = FIX_DISPATCH_DAEMON_REPOS, tick = sweepHungCiRecovery, ...tickOpts } = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo, apply: true }));
  const dispatched = [];
  const refusals = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    // a hung candidate this tick actually acted on (cancel+rerun OR cancel-only attempted, whether or not it
    // succeeded) — `applied` rows carry their own `ok`, so a failed attempt still shows up (never silently
    // dropped). Prefers the row's OWN `kind` (the plan's real classification — `hung-cancel-rerun` or
    // `repeat-hang`, xd1sfms follow-up) over the old ok/action heuristic, which a fixture supplying no `kind`
    // (an older test double) still falls back to.
    for (const a of (result.applied ?? [])) dispatched.push({ ...a, repo, kind: a.kind ?? (a.ok ? 'hung-cancel-rerun' : `hung-${a.action}`) });
    for (const r of (result.refusals ?? [])) if (r.kind !== 'not-hung') refusals.push({ ...r, repo });
  }
  return { repos: perRepo, dispatched, refusals };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runMainRedRebaseAllRepos — x5uqim1 follow-up (epic
 * #4075/#3383), 2026-09-25 18:52 ET LIVE INCIDENT: PR #2685 logged `reconcile-refused owed-ci-rerun` on EVERY
 * tick of THIS daemon ("owed a mechanical rebase onto main … once main has recovered") while nothing in any
 * running process ever performed that rebase. `we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery`
 * already implements the real write (via `we:scripts/lib/rebase-drop-manifest.mjs#rebaseDropManifest`, the SAME
 * proven, no-checkout plumbing the drain itself uses) and is already registered per-repo in
 * `we:skills-src/conveyor/daemon-manifest.mjs` (`ci-red-recovery-watch-<repo>`) — but, live-confirmed exactly
 * like {@link runHungCiRecoveryAllRepos}'s own docblock found for the hung-CI half of this same file, NO
 * launchd job installs `pass-daemon.mjs` for that entry (only an `.example` plist exists under
 * `we:skills-src/conveyor/launchd/`). Rather than touch launchd (out of scope for this card — an operational
 * action, not a code change), this rides the SAME already-live daemon the hung-CI half already rides. Mirrors
 * {@link runHungCiRecoveryAllRepos}'s own per-repo fan-out, failure isolation, and `apply: true` always
 * (`sweepCiRedRecovery`'s own idempotent `already-current` short-circuit, plus the new
 * `we:scripts/conveyor/main-red-recovery.mjs#DEFAULT_MAX_REBASE_RETRIES_PER_SHA` cap, make this safe to run
 * unconditionally on the default cadence — the same "efficiency no-op, not a safety refusal" trade every
 * sibling pass-daemon entry in `daemon-manifest.mjs` already documents for itself).
 * @param {{repos?:string[], tick?:Function}} [o] - `tick` is injectable (defaults to the real
 *   `sweepCiRedRecovery`); every other option is forwarded to it for EVERY repo except `repo` itself.
 * @returns {{repos:Array<{repo:string, result?:object, error?:string}>, dispatched:Array<object>,
 *   refusals:Array<object>}} `dispatched`/`refusals` here are the pass's own `applied`/`dispatch`+`refusals`
 *   rows, repo-tagged the same way {@link runHungCiRecoveryAllRepos} tags its own.
 */
export function runMainRedRebaseAllRepos({ repos = FIX_DISPATCH_DAEMON_REPOS, tick = sweepCiRedRecovery, ...tickOpts } = {}) {
  const perRepo = forEachRepo(repos, (repo) => tick({ ...tickOpts, repo, apply: true }));
  const dispatched = [];
  const refusals = [];
  for (const entry of perRepo) {
    if (entry.error) {
      refusals.push({ repo: entry.repo, prNumber: null, kind: 'tick-failed', why: entry.error });
      continue;
    }
    const { repo, result } = entry;
    for (const a of (result.applied ?? [])) dispatched.push({ ...a, repo, kind: 'rebase-onto-main' });
    for (const r of (result.refusals ?? [])) refusals.push({ ...r, repo });
  }
  return { repos: perRepo, dispatched, refusals };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runTickAllRepos — #xngv3vn (epic #3383/#4075): the
 * daemon's WHOLE per-tick unit of work, composing BOTH halves this daemon now owns — the pre-existing `fix`
 * dispatch ({@link runReconcileFixDispatchAllRepos}) and the previously-uncalled `ci-heal` dispatch
 * ({@link runReconcileCiHealDispatchAllRepos}, per this daemon's own docblock above: nothing in the tree ever
 * invoked it) — into ONE merged result. `onTick`'s log line and `hasStaleMainRefusal`'s scan (wired against
 * `withSelfSync`, below) both read `result.refusals`, so merging here — rather than bolting ci-heal on as a
 * SEPARATE, unobserved side effect — is what makes a ci-heal-side stale-main refusal trigger the SAME
 * self-resync `fix` already gets, and what makes ci-heal's own dispatch/refusal counts show up in the ordinary
 * tick log at all. Each half keeps its OWN per-repo isolation internally; a `fix`-side failure for one repo
 * never skips that SAME repo's `ci-heal` attempt, and vice versa — two independent per-repo ticks, merged only
 * for reporting.
 * @param {{repos?:string[], fixTick?:Function, ciHealTick?:Function, notesTick?:Function, notesDryRun?:boolean,
 *   authGateOverride?:Function}} [o]
 *   - every tick defaults to the real dispatch function; injecting one is for tests only. `notesDryRun`
 *   forwards to {@link runReconcileNotesAllRepos}'s own `dryRun` (omit to use ITS OWN default). `authGateOverride`
 *   (card x5kagse) is a test-only injection point for {@link planClaudeAuthDispatchGate}'s own real IO decision —
 *   see the block below for when the real one runs instead.
 * @returns {Promise<{repos:Array<object>, dispatched:Array<object>, refusals:Array<object>,
 *   reconcileRefusals:Array<object>, ciHeal:object, hungCi:object, notes:Array<object>,
 *   noteComments:Array<object>, authPaused:boolean, authPauseReason:(string|null)}>} `reconcileRefusals`
 *   (#x0mn6x0, epic #4075/#3383) merges both halves' own reconcile-layer refusal arrays — see
 *   {@link runReconcileFixDispatchAllRepos}'s own field for the shape/why. `onTick` (below) logs these
 *   SEPARATELY from `refusals`: they are a different population (a PR reconcile refused outright, never even
 *   offered to `fix`/`ci-heal`), not a duplicate count of the same thing. `hungCi` (xd1sfms, epic #4075/#3383)
 *   is the THIRD half this daemon now owns — see {@link runHungCiRecoveryAllRepos}'s own docblock for why this
 *   daemon, specifically, is where it lives (it is the one daemon confirmed live and ticking; the pass's own
 *   `daemon-manifest.mjs` entry has no launchd job installed). `notes`/`noteComments` (#4191, epic #4075/#3383)
 *   are the FIFTH half — see {@link runReconcileNotesAllRepos}'s own docblock. `authPaused`/`authPauseReason`
 *   (card x5kagse, epic #4075/#3383) — while the operator's Claude login is broken
 *   (`we:scripts/conveyor/claude-auth-health.mjs`), `fix` and `ci-heal` — the two halves that actually dispatch
 *   a fresh Claude session — are SKIPPED OUTRIGHT this tick, never merely attempted-and-failed: nothing is
 *   dispatched, so no fix/ci-heal attempt and no round-cap comment marker is ever spent on a login that cannot
 *   work. `hungCi`/`mainRedRebase`/`notes` (mechanical git/gh passes, no Claude session involved) keep running
 *   unpaused — the login break does not touch them.
 */
export async function runTickAllRepos({
  repos = FIX_DISPATCH_DAEMON_REPOS, fixTick, ciHealTick, hungCiTick, mainRedRebaseTick, notesTick, notesDryRun,
  authGateOverride,
} = {}) {
  // card x5kagse (epic #4075/#3383) — computed ONCE per tick, shared by both dispatching halves below. Real IO
  // (`planClaudeAuthDispatchGate`'s own `claude agents --json --all` read + health read + cheap probe) runs
  // ONLY for a genuine production tick — mirrors `queueAdmission`'s own "only read when a real tick runs" rule
  // just below: a test that injects EITHER `fixTick` or `ciHealTick` never wants this file to shell out for a
  // gate decision it did not ask about, unless it explicitly injects `authGateOverride` to test the gate itself.
  const authGate = authGateOverride ? authGateOverride()
    : ((fixTick || ciHealTick) ? { paused: false, reason: null } : planClaudeAuthDispatchGate());
  const pausedDispatchResult = () => ({
    repos: repos.map((repo) => ({ repo, result: { dispatched: [], refusals: [] } })),
    dispatched: [], refusals: [], reconcileRefusals: [],
  });
  // Card xkyw1x4 — the live heavy-test queue gate: ONE baseline read and ONE budget per daemon pass, shared by
  // every repo's fix and CI-heal dispatch, so each dispatch in the pass sees the demand of the ones before it.
  // Only read when a real tick runs (an injected test tick never needs it) AND dispatch is not paused (card
  // x5kagse — no reason to read live queue capacity for a pass that is about to dispatch nothing at all).
  const queueAdmission = (authGate.paused || (fixTick && ciHealTick)) ? null : createQueueBudget(resolveLiveQueueBaseline({ checkoutRoot: DAEMON_REPO_ROOT }));
  const fix = authGate.paused ? pausedDispatchResult()
    : runReconcileFixDispatchAllRepos({ repos, ...(fixTick ? { tick: fixTick } : { queueAdmission }) });
  const ciHeal = authGate.paused ? pausedDispatchResult()
    : await runReconcileCiHealDispatchAllRepos({ repos, ...(ciHealTick ? { tick: ciHealTick } : { queueAdmission }) });
  const hungCi = runHungCiRecoveryAllRepos({ repos, ...(hungCiTick ? { tick: hungCiTick } : {}) });
  // x5uqim1 follow-up (#4075/#3383) — the FOURTH half this daemon now owns: see
  // {@link runMainRedRebaseAllRepos}'s own docblock for why this daemon, specifically, is where it lives (same
  // reason `hungCi` already does — the pass's own `daemon-manifest.mjs` entry has no launchd job installed).
  const mainRedRebase = runMainRedRebaseAllRepos({ repos, ...(mainRedRebaseTick ? { tick: mainRedRebaseTick } : {}) });
  // #4191 (epic #4075/#3383) — the FIFTH half this daemon now owns: surface `planReconcile`'s own `notes`
  // (`ci-heal-exhausted`/`awaiting-permission`) that neither `fix` nor `ci-heal` above ever forwards — see
  // {@link runReconcileNotesAllRepos}'s own docblock for why this is a separate, independent read rather than a
  // field threaded through either of those two.
  const notes = runReconcileNotesAllRepos({
    repos, ...(notesTick ? { tick: notesTick } : {}), ...(notesDryRun == null ? {} : { dryRun: notesDryRun }),
  });
  return {
    repos: fix.repos, // same repo list every half ticked — the shape onTick's log already reads from
    dispatched: [...fix.dispatched, ...ciHeal.dispatched, ...hungCi.dispatched, ...mainRedRebase.dispatched],
    refusals: [...fix.refusals, ...ciHeal.refusals, ...hungCi.refusals, ...mainRedRebase.refusals, ...notes.refusals],
    reconcileRefusals: [...(fix.reconcileRefusals ?? []), ...(ciHeal.reconcileRefusals ?? [])],
    ciHeal, // the ci-heal half's own detail, kept available rather than discarded once merged above
    hungCi, // the hung-ci-recovery half's own detail, same reason
    mainRedRebase, // the main-red-rebase half's own detail, same reason
    authPaused: authGate.paused, // card x5kagse — fix/ci-heal dispatch skipped outright this tick
    authPauseReason: authGate.reason,
    notes: notes.notes, // #4191 — every surfaced note this tick saw, repo-tagged
    noteComments: notes.comments, // #4191 — one row per note: posted / would-post (dryRun) / already-posted
  };
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#formatRefusalLine — #x0mn6x0 (epic #4075/#3383,
 * "daemons must log every refusal and skip with its reason"): ONE printable line per refusal object, whatever
 * layer produced it. `prNumber`/`pr` is read tolerantly — the fix-side refusals (`reconcile-fix-dispatch.mjs`)
 * key on `pr`, the ci-heal-side and reconcile-core ones key on `prNumber` (the SAME inconsistency the existing
 * CLI printer already papers over — `we:scripts/operations/ci-heal-pr-dispatch.mjs`'s own IS_CLI block reads
 * `r.prNumber ?? r.pr`) — never re-derived, matched here. `label` distinguishes the two populations a tick can
 * now report: an ordinary dispatch-layer refusal (`no-lane`/`held`/`dispatch-failed`/`unsupported-repo`/
 * `no-scope`, for a PR the plan DID offer to `fix`/`ci-heal`) from a reconcile-layer one (`owed-ci-rerun`/
 * `no-findings`/`live-process`/`cap-exhausted`/`stood-down`/`owed-elsewhere`/`nothing-owed`/..., for a PR
 * `reconcile-core.mjs#planReconcile` refused OUTRIGHT and never even offered) — the exact distinction PRs
 * #2635/#2636/#2653 made invisible on 2026-09-25 (see this file's own imports' docblocks for the incident).
 * @param {string} label - `'refused'` or `'reconcile-refused'`.
 * @param {{repo?:string, kind?:string, prNumber?:(number|null), pr?:(number|null), why?:string}} r
 * @returns {string}
 */
export function formatRefusalLine(label, r) {
  const prNum = r?.prNumber ?? r?.pr ?? null;
  const prLabel = prNum == null ? '(no PR)' : `PR #${prNum}`;
  return `reconcile-fix-dispatch-daemon: ${label} ${r?.kind ?? 'unknown'} ${r?.repo ?? '?'} ${prLabel} — ${r?.why ?? '(no reason given)'}`;
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#formatHungActionLine — xd1sfms (#4075/#3383): ONE
 * printable line per hung-run cancel+rerun ACTION this tick attempted (never just a count) — this card's own
 * "log each hung-run action with its reason" scope item. Mirrors {@link formatRefusalLine}'s own shape.
 * @param {{repo?:string, prNumber?:(number|null), runId?:(number|string|null), ok?:boolean, action?:string,
 *   why?:string, error?:string}} a
 * @returns {string}
 */
export function formatHungActionLine(a) {
  const prLabel = a?.prNumber == null ? '(no PR)' : `PR #${a.prNumber}`;
  const outcome = a?.ok ? `applied ${a.action}` : `FAILED ${a.action}${a?.error ? ` (${a.error})` : ''}`;
  return `reconcile-fix-dispatch-daemon: hung-ci-recovery ${a?.repo ?? '?'} ${prLabel} run ${a?.runId ?? '?'} — ${outcome} — ${a?.why ?? '(no reason recorded)'}`;
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#formatMainRedRebaseActionLine — x5uqim1 follow-up
 * (#4075/#3383): ONE printable line per mechanical-rebase action this tick attempted. Mirrors
 * {@link formatHungActionLine}'s own shape.
 * @param {{repo?:string, prNumber?:(number|null), headRefName?:(string|null), ok?:boolean, action?:string, error?:string}} a
 * @returns {string}
 */
export function formatMainRedRebaseActionLine(a) {
  const prLabel = a?.prNumber == null ? '(no PR)' : `PR #${a.prNumber}`;
  const outcome = a?.ok ? `applied ${a.action}` : `FAILED ${a.action}${a?.error ? ` (${a.error})` : ''}`;
  return `reconcile-fix-dispatch-daemon: main-red-rebase ${a?.repo ?? '?'} ${prLabel} (${a?.headRefName ?? '?'}) — ${outcome}`;
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#formatNoteLine — #4191 (epic #4075/#3383): ONE
 * printable line per `planReconcile` note this tick saw (`ci-heal-exhausted`/`awaiting-permission`), with its
 * own reason — mirrors {@link formatRefusalLine}'s own "never just a count" discipline, applied to the
 * population this whole card exists to stop dropping.
 * @param {{repo?:string, kind?:string, prNumber?:(number|null), text?:string}} n
 * @returns {string}
 */
export function formatNoteLine(n) {
  const prLabel = n?.prNumber == null ? '(no PR)' : `PR #${n.prNumber}`;
  return `reconcile-fix-dispatch-daemon: note ${n?.kind ?? 'unknown'} ${n?.repo ?? '?'} ${prLabel} — ${n?.text ?? '(no detail recorded)'}`;
}

/**
 * we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#formatNoteCommentLine — #4191: ONE printable line per
 * note-comment decision this tick made (`we:scripts/conveyor/reconcile-note-comment.mjs#runReconcileNotesAllRepos`
 * — already-posted / dry-run would-post / posted / failed). The dry-run case prints the FULL comment body (not
 * just its key) — this is this card's own "don't post real PR comments in tests or the proof; show the comment
 * text it WOULD post" requirement, satisfied at the log line itself rather than a separate code path.
 * @param {{repo?:string, prNumber?:(number|null), kind?:string, key?:string, body?:string, alreadyPosted?:boolean,
 *   posted?:boolean, dryRun?:boolean, error?:string}} c
 * @returns {string}
 */
export function formatNoteCommentLine(c) {
  const prLabel = c?.prNumber == null ? '(no PR)' : `PR #${c.prNumber}`;
  const head = `reconcile-fix-dispatch-daemon: note-comment ${c?.kind ?? 'unknown'} ${c?.repo ?? '?'} ${prLabel} (${c?.key ?? '?'})`;
  if (c?.alreadyPosted) return `${head} — already posted, skipping`;
  if (c?.dryRun) return `${head} — DRY-RUN, would post:\n${c?.body ?? '(no body)'}`;
  if (c?.posted) return `${head} — posted`;
  return `${head} — FAILED to post${c?.error ? ` (${c.error})` : ''}`;
}

/** Build the real effects for {@link runDaemonLoop}: a real tick of {@link runTickAllRepos} (`fix` +
 *  `ci-heal`, #xngv3vn), a real interval sleep, and a real keyed lease heartbeat. Kept as its own factory
 *  (mirroring `buildCliTickEffects` in runner.mjs) so `main()` stays a thin wire-up. */
export function buildCliDaemonEffects({ owner, intervalMs = DEFAULT_INTERVAL_MS, log = console } = {}) {
  return {
    intervalMs,
    tickOnce: () => runTickAllRepos(),
    sleep: realSleep,
    heartbeat: () => heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key: RECONCILE_FIX_DISPATCH_LEASE_KEY }),
    onTick: (result) => {
      const {
        repos = [], dispatched = [], refusals = [], reconcileRefusals = [], hungCi, mainRedRebase, notes = [], noteComments = [],
        authPaused = false, authPauseReason = null,
      } = result || {};
      log.error(`reconcile-fix-dispatch-daemon: tick (${repos.map((r) => r.repo).join(', ')}) — dispatched ${dispatched.length}, refused ${refusals.length}`);
      // card x5kagse (epic #4075/#3383) — logged EVERY tick fix/ci-heal dispatch stays paused, exact wording
      // required by the card and matched by the soak scenario/live-proof read; never merely implied by an
      // empty `dispatched` count.
      if (authPaused) log.error(`reconcile-fix-dispatch-daemon: ${authPauseReason ?? 'paused: Claude login expired — run /login'}`);
      for (const r of repos) if (r.error) log.error(`reconcile-fix-dispatch-daemon: ${r.repo} tick failed (non-fatal, other repos unaffected): ${r.error}`);
      // #x0mn6x0 — ONE LINE PER REFUSAL, never just the count above. `refusals` = a PR the plan offered to
      // `fix`/`ci-heal` but the dispatch itself refused (no-lane, held, dispatch-failed, unsupported-repo,
      // no-scope). A `tick-failed` entry is already printed via the per-repo loop above — skip it here so it
      // is never printed twice.
      for (const r of refusals) if (r?.kind !== 'tick-failed') log.error(formatRefusalLine('refused', r));
      // `reconcileRefusals` = a PR `reconcile-core.mjs#planReconcile` refused OUTRIGHT, never even offered to
      // `fix`/`ci-heal` (owed-ci-rerun, no-findings, live-process, cap-exhausted, stood-down, owed-elsewhere,
      // nothing-owed, ...) — previously invisible everywhere (collapsed to a bare count and dropped before it
      // ever reached this daemon's own tick result at all).
      for (const r of reconcileRefusals) log.error(formatRefusalLine('reconcile-refused', r));
      // xd1sfms (#4075/#3383) — ONE LINE PER HUNG-RUN ACTION, whether it succeeded or not (this card's own
      // "log each hung-run action with its reason" scope item). `hungCi.dispatched` here are the pass's own
      // `applied` rows (an action this tick actually attempted), never the bare refusal population already
      // covered by the `refusals` loop above.
      for (const a of (hungCi?.dispatched ?? [])) log.error(formatHungActionLine(a));
      // x5uqim1 follow-up (#4075/#3383) — ONE LINE PER MECHANICAL-REBASE ACTION, same discipline as the
      // hung-run loop just above.
      for (const a of (mainRedRebase?.dispatched ?? [])) log.error(formatMainRedRebaseActionLine(a));
      // #4191 (epic #4075/#3383) — ONE LINE PER SURFACED NOTE (`ci-heal-exhausted`/`awaiting-permission`),
      // never just a count — the exact population this card exists to stop silently dropping, plus ONE LINE
      // PER note-comment decision (already-posted / dry-run would-post, with the full body / posted / failed).
      for (const n of notes) log.error(formatNoteLine(n));
      for (const c of noteComments) log.error(formatNoteCommentLine(c));
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
