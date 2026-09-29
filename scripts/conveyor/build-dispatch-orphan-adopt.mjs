#!/usr/bin/env node
/**
 * @file scripts/conveyor/build-dispatch-orphan-adopt.mjs
 * @description build-orphan-adopt (#4131/#4382 fix) — ADOPTS a build-dispatch claim whose owning detached
 * delivery wrapper died before it could settle its own run-store effect or release/hold its claim.
 *
 * THE GAP THIS CLOSES. A `build` dispatch's actual work — the agent turn, the gate, the converge round, the
 * PR open — runs in `deliver-item-run.mjs`, spawned DETACHED (`setsid` + `.unref()`,
 * `scripts/operations/detached-dispatch.mjs#defaultSpawnDetached`) precisely so it survives the dispatching
 * daemon restarting (`skills-src/conveyor/build-dispatch-daemon.mjs`'s own self-rebuilding clone —
 * `scripts/lib/daemon-rebuild.mjs`, which `git reset --hard`s that clone's tree every time an imported file
 * moves, gated by a lock the daemon's SYNCHRONOUS tick holds only for the few milliseconds it takes to spawn
 * that detached child, never for the up-to-an-hour the child itself then runs). The build-dispatch CLAIM
 * (`build-dispatch-claim.mjs`) is a SEPARATE lock, owned by the DAEMON's own pid (never the wrapper's — "PID
 * liveness is never used" for it, by explicit design: a daemon restart is expected, and the build it started
 * is still running).
 *
 * That design is correct as long as the detached wrapper itself stays alive. When it does not — a hard kill
 * (an operator's `pkill` that reaches a `setsid`'d descendant by matching its own argv/cwd, a machine
 * restart, a crash outside its own `try`/`catch`) — NOTHING today ever notices. `wake.mjs`'s liveness-only
 * observer answers only `unresolved` for a dead `pid:` handle (it never reads the wrapper's own known
 * outcome); only the wrapper's OWN exit path (`deliver-item-settle.mjs`, called from inside
 * `deliver-item-wrapper.mjs#deliverItem`'s own `finally`/`catch`) ever settles the run-store effect or
 * releases/holds the claim. `build-dispatch-daemon.mjs#doneWhy` retires a claim on exactly three signals — a
 * PR delivering the item, the item leaving the tick core's cleared queue, or a run-store row SETTLED to a
 * non-PR outcome — and a wrapper that died before any of those three became true leaves the claim
 * PERMANENTLY "in flight", occupying a builder slot until its 240-minute TTL lapses, with the agent's own
 * finished work (a real commit, already in the lane) simply abandoned. Confirmed live for #4131 (claim owner
 * `Mac:74142` — the DAEMON's own pid from its 06:41 ET boot line — long dead by the time the claim was read;
 * the agent's own transcript says it finished and reported done; no PR, no hold, no settled run-store row)
 * and #4382 (claim owner `Mac:98761`, the daemon the operator killed at 09:54 ET for a cap change).
 *
 * THE FIX CHOSEN (of the two the card offered): DAEMON-SIDE ADOPTION, not hardening the detached spawn
 * against every possible kill vector. Every tick, for each live build claim whose recorded dispatch's `pid:`
 * handle the KERNEL confirms is dead (`detached-dispatch.mjs#defaultIsPidAlive` — never a listing, never a
 * guess):
 *   - RESUME — the prior attempt's own delivery report says `done` AND the lane still holds a commit ahead of
 *     its delivery base (`scripts/operations/minimal-context-provider.mjs#laneHasCommitAhead`): spawn ONE
 *     fresh, detached `deliver-item-run.mjs --resume` process, reusing the SAME lane and session slug, which
 *     `deliver-item-wrapper.mjs#runAgentToCompletion`'s own `resume` branch reads straight through to
 *     gate → converge → PR — never a rebuild, never a second agent turn. A {@link markBuildDispatchResume}
 *     marker (same lease primitive as the claim/hold, `build-dispatch-claim.mjs`) records the resume
 *     attempt's own pid so a LATER tick does not spawn a second, racing resume while the first is genuinely
 *     still running.
 *   - RELEASE — nothing resumable (no report, no lane, no surviving commit): release the claim outright, with
 *     NO hold, so the very next tick can offer the item for a completely fresh dispatch — a hold is for a
 *     known, recurring failure reason; "the prior attempt's own evidence is gone" is not one.
 *   - LEAVE — the handle's pid is confirmed alive, OR there is no in-flight run-store row for this claim at
 *     all yet (too early to judge here — the ordinary claim/hold machinery already covers both cases).
 *
 * OUT OF SCOPE, STATED RATHER THAN GUESSED AT (mirrors this codebase's own convention, e.g.
 * `build-dispatch-claim.mjs#releaseBuildDispatchClaim`'s own docblock): re-attaching to a delivery agent
 * whose WRAPPER died but whose own CLI process (the `claude`/`codex` child `provider.spawn` started) is
 * somehow still running. Nothing today durably records the inner agent's own pid or CLI session id separately
 * from the wrapper's `pid:` handle, so this module cannot tell that case apart from "the agent never finished"
 * — it classifies as RELEASE. The residual risk (a still-running orphaned agent later committing into a lane
 * a fresh dispatch has since reclaimed) is bounded by the EXISTING `guard-lane.mjs` foreign-session Edit/Write
 * refusal, not solved here.
 *
 * PURE CORE / IO SHELL, the same split as `build-dispatch-daemon.mjs`.
 */

import { normNum } from './queue-store.mjs';
import { DISPATCH_EFFECT } from '../operations/dispatch-lane.mjs';
// Through the REGISTRY, never `dispatch-providers/build.mjs` directly: `detached-dispatch.mjs` imports the
// registry, which imports `build.mjs` — entering that cycle at `build.mjs` (or at `detached-dispatch.mjs` first)
// leaves the registry reading `DELIVER_ITEM_RUN_SCRIPT` in its TDZ at load. The registry is the cycle's own
// entry point; the run script is read from it at CALL time.
import { dispatchProviderEntry } from '../operations/dispatch-provider-registry.mjs';
import { createFileRunStore } from '../operations/run-store.mjs';
import { resolveInFlight } from '../operations/effect-executor.mjs';
import { resolveLanePath, laneHasCommitAhead } from '../operations/minimal-context-provider.mjs';
import { tryReadDeliveryReport, resolveDeliveryReportsDir } from '../operations/delivery-report-store.mjs';
import {
  REPO_ROOT, defaultIsPidAlive, defaultSpawnDetached, deliveryDispatchLogPath, detachedHandlePid,
} from '../operations/detached-dispatch.mjs';
import {
  listBuildDispatchClaims, releaseBuildDispatchClaim,
  markBuildDispatchResume, readBuildDispatchResume, releaseBuildDispatchResume,
} from './build-dispatch-claim.mjs';

// ── PURE CORE ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The newest IN-FLIGHT `build` dispatch effect for `num`, across every run-store record `runs` holds.
 * "Newest by `startedAt`" mirrors `build-dispatch-daemon.mjs#doneWhy`'s own "newest attempt per item wins"
 * rule — the ONLY thing this module reads a run-store row for is the ORIGINAL dispatch's `lane`/`sessionSlug`
 * (unchanged across however many resume attempts follow it) and its own dispatch handle's liveness. A
 * SETTLED row (`applied`/`failed`) is deliberately excluded — a claim behind a settled row is already handled
 * by the ordinary `doneWhy` retirement path; this module only ever acts where that path does not reach.
 * PURE.
 * @param {Array<{id: string, record: {effects?: Array<object>}}>} runs
 * @param {string|number} num
 * @returns {{runId: string, entry: object}|null}
 */
export function findLatestInFlightBuildRow(runs, num) {
  const n = normNum(num);
  let best = null;
  for (const run of runs) {
    for (const e of run?.record?.effects || []) {
      if (e?.type !== DISPATCH_EFFECT || e?.payload?.launchKind !== 'build') continue;
      if (normNum(e?.payload?.num) !== n) continue;
      if (e?.status !== 'in-flight') continue;
      const startedAt = typeof e.startedAt === 'string' ? e.startedAt : '';
      if (!best || startedAt > best.startedAt) best = { runId: run.id, entry: e, startedAt };
    }
  }
  return best ? { runId: best.runId, entry: best.entry } : null;
}

/**
 * Is this claim's own dispatch confirmed DEAD by the kernel? PURE over injected `isPidAlive`.
 *
 * A live RESUME marker (a prior adoption already under way) takes precedence over the original dispatch's own
 * row: once a resume has been spawned, its own pid is the one liveness question that matters — the original
 * row's dead pid is expected and no longer news. `row` (the original dispatch, for `lane`/`sessionSlug`) is
 * always returned alongside the verdict when available, since a later resumability check needs it regardless
 * of which pid answered the liveness question.
 *
 * @param {{row: {runId:string, entry:object}|null, resumeMarker: {meta:{pid:number}}|null, isPidAlive: Function}} o
 * @returns {{status: 'alive'|'dead'|'no-record', row: {runId:string, entry:object}|null}}
 */
export function classifyClaimLiveness({ row, resumeMarker, isPidAlive = defaultIsPidAlive }) {
  if (resumeMarker) {
    const pid = Number(resumeMarker.pid ?? resumeMarker.meta?.pid);
    if (Number.isInteger(pid) && pid > 0) {
      return { status: isPidAlive(pid) ? 'alive' : 'dead', row };
    }
  }
  const pid = row ? detachedHandlePid(row.entry?.handle) : null;
  if (pid == null) return { status: 'no-record', row };
  return { status: isPidAlive(pid) ? 'alive' : 'dead', row };
}

/** Decide what to do with a DEAD claim, given whether its lane/report proved resumable. PURE. Never called for
 *  a `liveness.status !== 'dead'` claim — the caller leaves those alone before this is reached. */
export function decideOrphanAction({ resumable }) {
  return resumable
    ? { action: 'resume', reason: 'dead wrapper — resumable done report + lane commit found' }
    : { action: 'release', reason: 'dead wrapper — nothing resumable (no report, no lane, or no surviving commit)' };
}

// ── IO SHELL ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Every `dispatch-lane-*` run-store record readable right now, `{id, record}`. Unreadable/missing runs are
 *  skipped, never thrown — the same defensive posture `build-dispatch-daemon.mjs`'s own `cliListRunStoreInFlight`/
 *  `cliListSettledBuilds` already use. */
function listAllRuns(store) {
  let ids = [];
  try { ids = store.list().filter((id) => id.startsWith('dispatch-lane')); } catch { return []; }
  const out = [];
  for (const id of ids) {
    try { out.push({ id, record: store.read(id) }); } catch { /* skip unreadable */ }
  }
  return out;
}

/** Default `findRow(num)` — reads the real on-disk run store. */
function defaultFindRow(num, store = createFileRunStore()) {
  return findLatestInFlightBuildRow(listAllRuns(store), num);
}

/**
 * Is `{lane, sessionSlug}`'s prior attempt resumable? Both halves are required — see this file's own header
 * for why either alone is not enough evidence.
 * @returns {{resumable: boolean, reason: string, lanePath?: string}}
 */
export function checkResumable({
  lane, sessionSlug, base = 'main', resolveLane = resolveLanePath,
  readReport = tryReadDeliveryReport, resolveReportsDir = resolveDeliveryReportsDir,
  isLaneCommitAhead = laneHasCommitAhead,
} = {}) {
  if (!lane || !sessionSlug) return { resumable: false, reason: 'no-lane-or-session' };
  let lanePath;
  try { lanePath = resolveLane(lane); } catch { lanePath = null; }
  if (!lanePath) return { resumable: false, reason: 'lane-path-unresolved' };
  const report = readReport(sessionSlug, resolveReportsDir(lanePath));
  if (!report || report.status !== 'done') return { resumable: false, reason: 'no-done-report', lanePath };
  if (!isLaneCommitAhead({ lane: lanePath, base })) return { resumable: false, reason: 'no-commit-ahead', lanePath };
  return { resumable: true, lanePath };
}

/** Best-effort: mark a stale, dead-wrapper run-store row settled (`failed`, outcome `orphan-released`) so it
 *  is never read as "still in flight" again. Never touched on the RESUME path — a resume's own liveness is
 *  tracked by the resume marker, not by rewriting the original attempt's history. */
function settleOrphanRow({ runId, key }, store = createFileRunStore()) {
  if (!runId || !key) return;
  try {
    const run = store.read(runId);
    if (!run) return;
    const entry = (run.effects || []).find((e) => e.key === key);
    if (!entry || entry.status !== 'in-flight') return;
    const next = resolveInFlight(run, key, {
      status: 'failed',
      result: { outcome: 'orphan-released' },
      error: 'build-dispatch-orphan-adopt: wrapper pid confirmed dead by the kernel, nothing resumable',
    });
    store.write(next);
  } catch { /* best-effort — never mask the release this settles alongside */ }
}

/** Spawn ONE fresh, detached resume process for `num` — the SAME shape
 *  `dispatch-providers/build.mjs#deliverItemDetachedProvider` uses for a fresh dispatch, plus `--resume` and
 *  minus a fresh attempt tag (a resume is not a new attempt at building; it continues the one that already
 *  finished). Returns the spawned pid. */
export function spawnResumeDelivery({ num, lane, scope, sessionSlug }, { spawnDetached = defaultSpawnDetached, logPathFor = deliveryDispatchLogPath } = {}) {
  const argv = [
    String(dispatchProviderEntry('build').runScript),
    `--num=${num}`, `--lane=${lane}`, `--session=${sessionSlug}`, `--scope=${String(scope ?? '')}`, '--resume',
  ];
  const child = spawnDetached(argv, { cwd: REPO_ROOT, logPath: logPathFor(sessionSlug) });
  const pid = Number(child?.pid);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`build-dispatch-orphan-adopt: resume spawn for #${num} reported no pid — whether it is running cannot be told from here`);
  }
  return pid;
}

/**
 * ONE PASS over every live `build` claim: adopt every one whose recorded dispatch is confirmed dead, leave
 * every other one untouched. Every effect is injected — see the parameter defaults for what each does; a live
 * daemon tick calls this with no arguments at all.
 *
 * @returns {Promise<Array<{num: string, action: 'leave'|'resume'|'release', reason: string, pid?: number}>>}
 */
export async function adoptOrphanedBuildClaims({
  listClaims = () => listBuildDispatchClaims(),
  isPidAlive = defaultIsPidAlive,
  findRow = (num) => defaultFindRow(num),
  readResumeMarker = (num) => readBuildDispatchResume({ num }),
  resolveResumability = (o) => checkResumable(o),
  releaseClaim = ({ num }) => releaseBuildDispatchClaim({ num }),
  releaseResumeMarker = ({ num }) => releaseBuildDispatchResume({ num }),
  settleRow = (o) => settleOrphanRow(o),
  spawnResume = (o) => spawnResumeDelivery(o),
  markResume = ({ num, pid }) => markBuildDispatchResume({ num, pid }),
} = {}) {
  const results = [];
  for (const claim of listClaims()) {
    if (claim.meta?.kind !== 'build') continue;
    const num = normNum(claim.meta?.num);
    const row = findRow(num);
    const resumeMarker = readResumeMarker(num);
    const liveness = classifyClaimLiveness({ row, resumeMarker, isPidAlive });
    if (liveness.status !== 'dead') { results.push({ num, action: 'leave', reason: liveness.status }); continue; }
    if (!row) { results.push({ num, action: 'leave', reason: 'no-record' }); continue; }
    const payload = row.entry?.payload || {};
    const resumability = resolveResumability({ lane: payload.lane, sessionSlug: payload.sessionSlug });
    const decision = decideOrphanAction({ resumable: resumability.resumable });
    if (decision.action === 'resume') {
      const pid = spawnResume({ num, lane: payload.lane, scope: payload.scope, sessionSlug: payload.sessionSlug });
      markResume({ num, pid });
      results.push({ num, action: 'resume', reason: decision.reason, pid });
    } else {
      releaseClaim({ num });
      try { releaseResumeMarker({ num }); } catch { /* best-effort — see build-dispatch-claim.mjs's own posture */ }
      settleRow({ runId: row.runId, key: row.entry?.key });
      results.push({ num, action: 'release', reason: `${decision.reason} (${resumability.reason})` });
    }
  }
  return results;
}
