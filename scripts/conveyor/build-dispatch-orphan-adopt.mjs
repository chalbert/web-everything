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
import { resolveLanePath, laneHasCommitAhead, run } from '../operations/minimal-context-provider.mjs';
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
 * The newest `build` dispatch effect for `num`, across every run-store record `runs` holds — ANY status, not
 * only `in-flight`. "Newest by `startedAt`" mirrors `build-dispatch-daemon.mjs#doneWhy`'s own "newest attempt
 * per item wins" rule.
 *
 * WHY NOT `in-flight`-ONLY (the first cut of this module, live incident 2026-09-29): #4131's own run-store row
 * was `applied`, settled by the wrapper's own exit path as `{outcome: 'pr-opened', pr: null}` — the wrapper
 * genuinely reached its last step and BELIEVED it opened a PR, but the PR number came back empty (a separate,
 * real bug in `openPr()`/`extractSubmitResult`, not fixed here). `build-dispatch-daemon.mjs#doneWhy`
 * deliberately never retires a claim on a `pr-opened` settle alone — "an open PR can still be closed/superseded
 * before it merges; the PR-observed path already owns that" — so when no PR actually exists under that number,
 * NOTHING ever retires the claim: not `doneWhy` (defers to a PR that isn't there), and not the OLD version of
 * this module either (it only ever looked at `in-flight` rows, and this one had already settled). Returning
 * every status here, and letting {@link classifyClaimLiveness} read `result.outcome`/`result.pr` for a settled
 * row, is what closes that gap.
 * @param {Array<{id: string, record: {effects?: Array<object>}}>} runs
 * @param {string|number} num
 * @returns {{runId: string, entry: object}|null}
 */
export function findLatestBuildRow(runs, num) {
  const n = normNum(num);
  let best = null;
  for (const run of runs) {
    for (const e of run?.record?.effects || []) {
      if (e?.type !== DISPATCH_EFFECT || e?.payload?.launchKind !== 'build') continue;
      if (normNum(e?.payload?.num) !== n) continue;
      const startedAt = typeof e.startedAt === 'string' ? e.startedAt : '';
      if (!best || startedAt > best.startedAt) best = { runId: run.id, entry: e, startedAt };
    }
  }
  return best ? { runId: best.runId, entry: best.entry } : null;
}

/** Back-compat alias — the pre-2026-09-29 name, kept for any external caller that still imports it. */
export const findLatestInFlightBuildRow = findLatestBuildRow;

/**
 * Is this claim's own dispatch confirmed DEAD — by the kernel wherever a pid handle exists to ask, or by
 * inference where none does? PURE over injected `isPidAlive`.
 *
 * FOUR SHAPES, in priority order:
 *   1. A LIVE resume marker (a prior adoption already under way) — its own pid is the one liveness question
 *      that matters now; the original row's dead pid is expected and no longer news.
 *   2. A row whose status is a SETTLED terminal (`applied`/`failed`) with a NON-`pr-opened` outcome — this is
 *      `doneWhy`'s own job (a PR/queue/settle signal it already reads); reported `'settled-elsewhere'` so the
 *      caller leaves it alone rather than fighting over the same claim.
 *   3. A row settled `applied` with `outcome === 'pr-opened'` but NO confirmed real PR (`result.pr` falsy) —
 *      the exact #4131 shape (see {@link findLatestBuildRow}'s own docblock): treated as DEAD, since nothing
 *      is actually delivered and nothing else will ever revisit it.
 *   4. Anything else with a `pid:` handle (an `in-flight` row, most commonly) — the kernel decides.
 *   5. No handle to check AT ALL — a row stuck `declared`/`pending` (killed before ever going `in-flight`), or
 *      no row found for this claim whatsoever. Neither can be OBSERVED, so liveness falls back to the CLAIM's
 *      own recorded owner pid (`ownerPid` — the dispatching daemon's pid at claim time): if IT is also
 *      confirmed dead, nobody is watching this claim at all → DEAD. If it is still alive, the claim may simply
 *      have been taken a moment ago with its own bookkeeping not yet written → `'no-record'` (too early to
 *      judge; the caller leaves it for a later tick).
 *
 * @param {{row: {runId:string, entry:object}|null, resumeMarker: {pid?:number, meta?:{pid?:number}}|null,
 *   ownerPid: number|null, isPidAlive: Function}} o
 * @returns {{status: 'alive'|'dead'|'no-record'|'settled-elsewhere', row: {runId:string, entry:object}|null}}
 */
export function classifyClaimLiveness({ row, resumeMarker, ownerPid = null, isPidAlive = defaultIsPidAlive }) {
  if (resumeMarker) {
    const pid = Number(resumeMarker.pid ?? resumeMarker.meta?.pid);
    if (Number.isInteger(pid) && pid > 0) {
      return { status: isPidAlive(pid) ? 'alive' : 'dead', row };
    }
  }
  const entry = row?.entry;
  if (entry && (entry.status === 'applied' || entry.status === 'failed')) {
    const outcome = entry.result?.outcome ?? null;
    if (outcome !== 'pr-opened') return { status: 'settled-elsewhere', row };
    if (entry.result?.pr) return { status: 'settled-elsewhere', row }; // a REAL pr — doneWhy's own PR-observed path owns it.
    return { status: 'dead', row }; // pr-opened, but no confirmed pr — nothing was actually delivered.
  }
  const pid = row ? detachedHandlePid(entry?.handle) : null;
  if (pid != null) return { status: isPidAlive(pid) ? 'alive' : 'dead', row };
  // No pid to probe at all (a handle-less declared/pending row, or no row found for this claim whatsoever) —
  // fall back to the CLAIM's own owner pid, the one other liveness signal available.
  if (Number.isInteger(ownerPid) && ownerPid > 0) {
    return { status: isPidAlive(ownerPid) ? 'no-record' : 'dead', row };
  }
  return { status: 'no-record', row };
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
  return findLatestBuildRow(listAllRuns(store), num);
}

/** The `session` currently leasing lane `lane`, or `null` — reads the SAME `lane-pool.mjs status --json`
 *  every other lane-aware caller in this codebase shells (`resolveLanePath`'s own sibling read). Never throws:
 *  an unreadable status is `null` (no evidence of a current lease), the fail-closed direction for
 *  {@link checkResumable}'s own safety check below. */
export function defaultCurrentLaneSession(lane, { run: runFn = run } = {}) {
  try {
    const out = runFn('node', ['scripts/lane-pool.mjs', 'status', '--json']);
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed.lanes) ? parsed.lanes : [];
    const found = rows.find((r) => Number(r.lane) === Number(lane));
    return found?.lease?.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Is `{lane, sessionSlug}`'s prior attempt resumable? THREE conditions, all required:
 *
 *   1. The lane is STILL, CURRENTLY leased under this exact session. A lane number is a SHARED, reused
 *      resource (`lane-pool.mjs`'s own pool) — once a lease moves on (released, or handed to a completely
 *      different dispatch), whatever git state sits in that lane belongs to WHOEVER holds it now, never to
 *      the attempt this claim remembers. Live incident 2026-09-29: #4131's own lane (8) was recycled twice
 *      (once for a later item's build, once for unrelated investigation work) in the hours between its
 *      wrapper settling and this module's own fix landing — trusting "lane 8 has a commit ahead of main"
 *      without this check would have resumed from a COMPLETELY UNRELATED occupant's in-progress work. Checked
 *      FIRST, before any git read, so a moved-on lease never even reaches one.
 *   2. A `done` delivery report exists for `sessionSlug`.
 *   3. The lane still holds a commit ahead of its delivery base.
 *
 * See this file's own header for why (2) and (3) are both required — either alone is not enough evidence a
 * prior attempt actually finished with something real to continue from.
 * @returns {{resumable: boolean, reason: string, lanePath?: string}}
 */
export function checkResumable({
  lane, sessionSlug, base = 'main', resolveLane = resolveLanePath,
  readReport = tryReadDeliveryReport, resolveReportsDir = resolveDeliveryReportsDir,
  isLaneCommitAhead = laneHasCommitAhead, currentLaneSession = defaultCurrentLaneSession,
} = {}) {
  if (!lane || !sessionSlug) return { resumable: false, reason: 'no-lane-or-session' };
  let leaseSession;
  try { leaseSession = currentLaneSession(lane); } catch { leaseSession = null; }
  if (leaseSession !== sessionSlug) return { resumable: false, reason: 'lane-lease-moved-on' };
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
  // #4131 (live 2026-09-29) — a claim's TTL (`DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES`, 240 min) is a DEAD-
  // HOLDER FLOOR, not evidence the underlying problem resolved itself: the daemon crash-looped for hours on an
  // unrelated boot bug, and by the time it recovered, #4131's claim had already aged out of the ORDINARY
  // `listBuildDispatchClaims()` read — invisible to this pass, and to the tick-core admission that would
  // otherwise have kept excluding it, so it was offered for a completely fresh (wasteful) rebuild instead of
  // being adopted. `ignoreExpiry: true` reads every claim still ON DISK regardless of TTL — this pass is a
  // POSITIVE liveness decision (kernel pid probes, settled-outcome reads), never a "assume it's fine" guess,
  // so an expired-but-still-real claim deserves the SAME adoption chance a fresh one gets.
  listClaims = () => listBuildDispatchClaims({ ignoreExpiry: true }),
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
    const ownerPid = Number.isInteger(claim.pid) ? claim.pid : null;
    const liveness = classifyClaimLiveness({ row, resumeMarker, ownerPid, isPidAlive });
    if (liveness.status !== 'dead') { results.push({ num, action: 'leave', reason: liveness.status }); continue; }
    // `row` may be null here (no run-store trace was ever found — #4382's own shape: killed before it ever
    // reached `in-flight`) — there is nothing to resume FROM in that case (no lane, no sessionSlug), so
    // resumability resolves to `no-lane-or-session` and this always falls straight to RELEASE. `settleRow`
    // guards its own `runId`/`key` presence, so it is a clean no-op when `row` is null.
    const payload = row?.entry?.payload || {};
    const resumability = resolveResumability({ lane: payload.lane, sessionSlug: payload.sessionSlug });
    const decision = decideOrphanAction({ resumable: resumability.resumable });
    if (decision.action === 'resume') {
      const pid = spawnResume({ num, lane: payload.lane, scope: payload.scope, sessionSlug: payload.sessionSlug });
      markResume({ num, pid });
      results.push({ num, action: 'resume', reason: decision.reason, pid });
    } else {
      releaseClaim({ num });
      try { releaseResumeMarker({ num }); } catch { /* best-effort — see build-dispatch-claim.mjs's own posture */ }
      if (row) settleRow({ runId: row.runId, key: row.entry?.key });
      results.push({ num, action: 'release', reason: `${decision.reason} (${resumability.reason})` });
    }
  }
  return results;
}
