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

import { execFileSync } from 'node:child_process';
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
  listBuildDispatchClaims, releaseBuildDispatchClaim, placeBuildDispatchHold,
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

/** How many resumes one dispatch row gets before the pass stops respawning and releases with a hold instead
 *  (PR #2921 review). A resume that keeps dying without settling anything is a recurring failure, not bad luck —
 *  exactly what a hold is for. */
export const MAX_RESUME_ATTEMPTS = 3;

/** How long a PENDING resume marker (written just before the spawn, no pid yet) reads as "a resume is being
 *  started". Far longer than a spawn takes. Past it, a pending marker is UNCONFIRMED — the daemon may have died
 *  after spawning but before recording the pid, so a resume may be running that nothing can probe. It is left
 *  alone until the marker's own TTL lapses, never respawned: a second resume racing a live one on the same lane
 *  is worse than a claim held a little longer. (A spawn that THREW is known not to be running and is recorded
 *  as `spawnFailed`, which reads dead at once.) */
export const RESUME_SPAWN_GRACE_MS = 5 * 60_000;

/** Does this resume marker belong to THIS dispatch row? A marker carries the `runId`/`rowKey` it resumed; one
 *  bound to any other row (an older attempt of the same item) — or bound to nothing at all — never answers the
 *  liveness question for `row`. PURE. */
export function resumeMarkerBindsRow(marker, row) {
  const meta = marker?.meta || {};
  if (!marker || !row || !meta.runId || !meta.rowKey) return false;
  return meta.runId === row.runId && meta.rowKey === row.entry?.key;
}

/**
 * Is this claim's own dispatch confirmed DEAD by the kernel? PURE over injected `isPidAlive`.
 *
 * A resume marker BOUND to this row (a prior adoption already under way — see {@link resumeMarkerBindsRow})
 * takes precedence over the row's own handle: once a resume has been spawned, its own pid is the one liveness
 * question that matters — the original row's dead pid is expected and no longer news. A marker bound to a
 * DIFFERENT row is stale and ignored (`marker: null` in the result tells the caller to clear it). A bound marker
 * with no pid yet is PENDING: `alive` inside {@link RESUME_SPAWN_GRACE_MS}, `unconfirmed` after it (left alone,
 * never respawned — see that constant); one recorded `spawnFailed` is `dead`.
 *
 * @param {{row: {runId:string, entry:object}|null, resumeMarker: {meta:object}|null, isPidAlive: Function, nowMs?: number}} o
 * @returns {{status: 'alive'|'dead'|'unconfirmed'|'no-record', row: {runId:string, entry:object}|null, marker: object|null}}
 */
export function classifyClaimLiveness({ row, resumeMarker, isPidAlive = defaultIsPidAlive, nowMs = Date.now() }) {
  if (!row) return { status: 'no-record', row, marker: null };
  if (resumeMarkerBindsRow(resumeMarker, row)) {
    const marker = resumeMarker;
    const pid = Number(marker.meta?.pid);
    if (Number.isInteger(pid) && pid > 0) return { status: isPidAlive(pid) ? 'alive' : 'dead', row, marker };
    if (marker.meta?.spawnFailed) return { status: 'dead', row, marker };
    const at = Date.parse(marker.meta?.resumedAt || '');
    const pending = Number.isFinite(at) && nowMs - at < RESUME_SPAWN_GRACE_MS;
    return { status: pending ? 'alive' : 'unconfirmed', row, marker };
  }
  const pid = detachedHandlePid(row.entry?.handle);
  if (pid == null) return { status: 'no-record', row, marker: null };
  return { status: isPidAlive(pid) ? 'alive' : 'dead', row, marker: null };
}

/** Decide what to do with a DEAD claim. PURE. Never called for a `liveness.status !== 'dead'` claim — the
 *  caller leaves those alone before this is reached.
 *  - not resumable → `release` (no hold — the evidence is simply gone);
 *  - resumable but `attempts` already spent → `exhausted` (release + HOLD — the resume itself keeps dying);
 *  - resumable while `allowResume` is false (kill switch / landing freeze) → `leave` for a later tick;
 *  - otherwise → `resume`. */
export function decideOrphanAction({ resumable, attempts = 0, maxAttempts = MAX_RESUME_ATTEMPTS, allowResume = true, frozenReason = '' }) {
  if (!resumable) return { action: 'release', reason: 'dead wrapper — nothing resumable (no report, no lane, or no surviving commit)' };
  if (attempts >= maxAttempts) return { action: 'exhausted', reason: `dead wrapper — ${attempts} resume attempt(s) already died; releasing with a hold` };
  if (!allowResume) return { action: 'leave', reason: `resumable, but resume frozen${frozenReason ? ` (${frozenReason})` : ''}` };
  return { action: 'resume', reason: 'dead wrapper — resumable done report + lane commit found' };
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

/** Every file the lane's commits add or modify against `base` (merge-base diff), or `null` when git cannot tell.
 *  Deletions are left out (`--diff-filter=d`) — an agent rarely lists a file it removed — and paths are never
 *  quoted (`core.quotePath=false`), so they compare as plain text. */
export function defaultListLaneChangedFiles({ lane, base = 'origin/main' }) {
  try {
    const out = execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=d', `${base}...HEAD`], {
      cwd: lane, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/** A `filesTouched` entry as a plain repo-relative path: drops a leading `./` and a `we:`-style locus prefix. */
function plainPath(p) {
  return String(p).trim().replace(/^[a-z][a-z0-9-]*:/i, '').replace(/^\.\//, '');
}

/** Paths the WRAPPER itself commits into the lane, never the agent: the item's own backlog card (`claimItem`
 *  sets `status: active` on it inside the lane, and the build commit picks that edit up). */
function isWrapperOwnedPath(path, num) {
  return num != null && new RegExp(`^backlog/${String(normNum(num)).replace(/[^a-z0-9]/gi, '')}-[^/]*\\.md$`, 'i').test(path);
}

/** Does `scope` name any repo other than `we`? Such a build works in ITS OWN repo's lane, not `payload.lane`. */
function scopeLeavesWe(scope) {
  const entries = Array.isArray(scope) ? scope : String(scope ?? '').split(',');
  return entries.some((s) => {
    const m = /^([a-z][a-z0-9-]*):/i.exec(String(s).trim());
    return m && m[1].toLowerCase() !== 'we';
  });
}

/**
 * Is `{lane, sessionSlug}`'s prior attempt resumable? Every check is required — see this file's own header
 * for why a report or a commit alone is not enough evidence.
 *
 * PR #2921 review — the lane's commits must also be bound to THIS item and THIS attempt, or a lane reused by
 * another item (or a human) could be resumed under the wrong item's identity:
 *   - the report's own `item` is `num`;
 *   - the report was last written at or after this dispatch row started (`rowStartedAt`) — not an older
 *     attempt's leftover;
 *   - every file the lane's commits change is one the report lists in `filesTouched` (the item's own backlog
 *     card excepted — the wrapper, not the agent, edits it). A foreign commit adds a file the report never
 *     named. When the report under-lists its own files this answers "not resumable" — the safe side: the claim
 *     is released and the item rebuilt fresh.
 * `base` is `origin/main`, never the local `main`: a pool lane's working branch IS its local `main`.
 * A build whose scope names a non-`we` repo is never resumable here: its work lives in that repo's own lane,
 * which the row does not record (stated rather than guessed at — released, rebuilt fresh).
 * @returns {{resumable: boolean, reason: string, lanePath?: string}}
 */
export function checkResumable({
  lane, sessionSlug, num = null, rowStartedAt = null, scope = null, base = 'origin/main', resolveLane = resolveLanePath,
  readReport = tryReadDeliveryReport, resolveReportsDir = resolveDeliveryReportsDir,
  isLaneCommitAhead = laneHasCommitAhead, listLaneChangedFiles = defaultListLaneChangedFiles,
} = {}) {
  if (!lane || !sessionSlug) return { resumable: false, reason: 'no-lane-or-session' };
  if (scopeLeavesWe(scope)) return { resumable: false, reason: 'non-we-locus' };
  let lanePath;
  try { lanePath = resolveLane(lane); } catch { lanePath = null; }
  if (!lanePath) return { resumable: false, reason: 'lane-path-unresolved' };
  const report = readReport(sessionSlug, resolveReportsDir(lanePath));
  if (!report || report.status !== 'done') return { resumable: false, reason: 'no-done-report', lanePath };
  if (num != null && normNum(report.item) !== normNum(num)) return { resumable: false, reason: 'report-item-mismatch', lanePath };
  if (typeof rowStartedAt === 'string' && rowStartedAt !== ''
    && !(typeof report.updatedAt === 'string' && report.updatedAt >= rowStartedAt)) {
    return { resumable: false, reason: 'report-predates-dispatch', lanePath };
  }
  if (!isLaneCommitAhead({ lane: lanePath, base })) return { resumable: false, reason: 'no-commit-ahead', lanePath };
  const changed = listLaneChangedFiles({ lane: lanePath, base });
  if (!Array.isArray(changed)) return { resumable: false, reason: 'lane-diff-unreadable', lanePath };
  const claimed = new Set((report.filesTouched || []).map(plainPath));
  if (claimed.size === 0) return { resumable: false, reason: 'report-lists-no-files', lanePath };
  const foreign = changed.map(plainPath).filter((f) => !claimed.has(f) && !isWrapperOwnedPath(f, num));
  if (foreign.length > 0) return { resumable: false, reason: 'lane-commits-not-this-item', lanePath };
  return { resumable: true, lanePath };
}

/** Best-effort: mark a stale, dead-wrapper run-store row settled (`failed`, with `outcome`) so it is never read
 *  as "still in flight" again. Never touched on the RESUME path — the resumed wrapper settles the row itself
 *  (it is handed `--run-id`/`--effect-key`). */
function settleOrphanRow({ runId, key, outcome = 'orphan-released' }, store = createFileRunStore()) {
  if (!runId || !key) return;
  try {
    const run = store.read(runId);
    if (!run) return;
    const entry = (run.effects || []).find((e) => e.key === key);
    if (!entry || entry.status !== 'in-flight') return;
    const next = resolveInFlight(run, key, {
      status: 'failed',
      result: { outcome },
      error: `build-dispatch-orphan-adopt: wrapper pid confirmed dead by the kernel (${outcome})`,
    });
    store.write(next);
  } catch { /* best-effort — never mask the release this settles alongside */ }
}

/** Spawn ONE fresh, detached resume process for `num` — the SAME shape
 *  `dispatch-providers/build.mjs#deliverItemDetachedProvider` uses for a fresh dispatch, plus `--resume` and
 *  minus a fresh attempt tag (a resume is not a new attempt at building; it continues the one that already
 *  finished). `runId`/`effectKey` name the ORIGINAL dispatch row, so the resumed wrapper settles that row on
 *  exit instead of leaving it in-flight forever (PR #2921 review). Returns the spawned pid. */
export function spawnResumeDelivery({ num, lane, scope, sessionSlug, runId = null, effectKey = null }, { spawnDetached = defaultSpawnDetached, logPathFor = deliveryDispatchLogPath } = {}) {
  const argv = [
    String(dispatchProviderEntry('build').runScript),
    `--num=${num}`, `--lane=${lane}`, `--session=${sessionSlug}`, `--scope=${String(scope ?? '')}`, '--resume',
    ...(runId && effectKey ? [`--run-id=${runId}`, `--effect-key=${effectKey}`] : []),
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
 * PR #2921 review hardening:
 *   - `allowResume: false` (the daemon passes it while its kill switch or a landing freeze is on) never spawns
 *     a resume — a resumable claim is left for a later tick. Releasing a dead, non-resumable claim is
 *     bookkeeping, not new work, so it still happens.
 *   - the run store is read ONCE per pass (`listRuns`), never once per claim.
 *   - one claim that throws is reported as `action: 'error'` and never stops the claims after it.
 *   - the resume marker is written PENDING before the spawn and completed with the pid after it, bound to the
 *     row it resumes, counting attempts — see {@link markBuildDispatchResume} and {@link decideOrphanAction}.
 *
 * @returns {Promise<Array<{num: string, action: 'leave'|'resume'|'release'|'exhausted'|'error', reason: string, pid?: number}>>}
 */
export async function adoptOrphanedBuildClaims({
  allowResume = true,
  frozenReason = '',
  maxAttempts = MAX_RESUME_ATTEMPTS,
  now = () => Date.now(),
  listClaims = () => listBuildDispatchClaims(),
  isPidAlive = defaultIsPidAlive,
  listRuns = () => listAllRuns(createFileRunStore()),
  findRow = (num, runs) => findLatestInFlightBuildRow(runs(), num),
  readResumeMarker = (num) => readBuildDispatchResume({ num }),
  resolveResumability = (o) => checkResumable(o),
  releaseClaim = ({ num }) => releaseBuildDispatchClaim({ num }),
  releaseResumeMarker = ({ num }) => releaseBuildDispatchResume({ num }),
  settleRow = (o) => settleOrphanRow(o),
  placeHold = ({ num, reason }) => placeBuildDispatchHold({ num, reason }),
  spawnResume = (o) => spawnResumeDelivery(o),
  markResume = (o) => markBuildDispatchResume(o),
} = {}) {
  let runsCache = null;
  const runs = () => (runsCache ??= listRuns());
  const clearMarker = (num) => { try { releaseResumeMarker({ num }); } catch { /* best-effort — see build-dispatch-claim.mjs's own posture */ } };
  const results = [];
  for (const claim of listClaims()) {
    if (claim.meta?.kind !== 'build') continue;
    const num = normNum(claim.meta?.num);
    try {
      const row = findRow(num, runs);
      const resumeMarker = readResumeMarker(num);
      const liveness = classifyClaimLiveness({ row, resumeMarker, isPidAlive, nowMs: now() });
      // A marker bound to some OLDER row is stale — it must never answer for this one again.
      if (resumeMarker && !liveness.marker) clearMarker(num);
      if (liveness.status !== 'dead') { results.push({ num, action: 'leave', reason: liveness.status }); continue; }
      const payload = row.entry?.payload || {};
      const attempts = Number(liveness.marker?.meta?.attempts) || 0;
      const resumability = resolveResumability({
        num, lane: payload.lane, sessionSlug: payload.sessionSlug, scope: payload.scope ?? null,
        rowStartedAt: row.entry?.startedAt ?? null,
      });
      const decision = decideOrphanAction({ resumable: resumability.resumable, attempts, maxAttempts, allowResume, frozenReason });
      if (decision.action === 'leave') {
        results.push({ num, action: 'leave', reason: decision.reason });
      } else if (decision.action === 'resume') {
        const binding = { runId: row.runId, rowKey: row.entry?.key, attempts: attempts + 1 };
        markResume({ num, pid: null, ...binding });
        let pid;
        try {
          pid = spawnResume({
            num, lane: payload.lane, scope: payload.scope, sessionSlug: payload.sessionSlug,
            runId: row.runId, effectKey: row.entry?.key,
          });
        } catch (e) {
          // Known NOT running — record it so the next pass counts this attempt dead at once, not after a TTL.
          try { markResume({ num, pid: null, ...binding, spawnFailed: true }); } catch { /* the pending marker still bounds it */ }
          throw e;
        }
        markResume({ num, pid, ...binding });
        results.push({ num, action: 'resume', reason: decision.reason, pid });
      } else {
        const exhausted = decision.action === 'exhausted';
        // Hold BEFORE release (the wrapper's own `settleTerminal` order): a crash between the two must never
        // leave the item unheld and free to re-dispatch into the same failure.
        if (exhausted) placeHold({ num, reason: `orphan-adopt: ${attempts} resume attempt(s) died without settling` });
        releaseClaim({ num });
        clearMarker(num);
        settleRow({ runId: row.runId, key: row.entry?.key, outcome: exhausted ? 'orphan-resume-exhausted' : 'orphan-released' });
        results.push({ num, action: decision.action, reason: exhausted ? decision.reason : `${decision.reason} (${resumability.reason})` });
      }
    } catch (e) {
      results.push({ num, action: 'error', reason: String(e?.message || e).split('\n')[0] });
    }
  }
  return results;
}
