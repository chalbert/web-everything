#!/usr/bin/env node
/**
 * @file scripts/conveyor/session-reaper.mjs
 * @description THE CONVEYOR SESSION REAPER (WE #3435, epic #3383). Walks `claude agents --json` and calls
 *   `claude stop <id>` on every BACKGROUND session that is done producing more work — nothing did this before:
 *   `lease-reaper.mjs` (#2667) reclaims LANE leases, a wholly separate resource from a `claude agents` session
 *   registration. Left undone, every review/fix/build dispatch this epic's own mechanism runs adds one more
 *   entry that stays listed until a human runs `claude stop <id>` by hand — 12 finished `review-*` sessions
 *   plus 4 stale `conveyor-*` ones in one live-fire night alone.
 *
 * THE CLI, NOW A THIN SHELL OVER THREE MODULES (split, no logic change — one file mixed four jobs that change for
 * different reasons):
 *   • `session-reap-plan.mjs`     — the PURE planner: which rows to reap / keep / flag (`classifySessionReap`,
 *     `sessionTarget`, `sessionReapPlan`, `attentionRows`…). No fs / exec / clock. Its header holds the pid-liveness,
 *     ground-truth, terminal-state, `kind` guard and verdict axes.
 *   • `session-reap-evidence.mjs` — the ground-truth resolver (backlog-card reads, bounded `gh pr view`, the repo-less
 *     PR-name resolution). Its header holds COST DISCIPLINE.
 *   • `session-reap-stop.mjs`     — the stop mechanics (`stopSessionWithRetry`, the #77683 `clear-stuck-session` repair).
 *     Its header holds the "stop success is a hint" and "#77683 repair" reasoning.
 * This file keeps `parseFlags` / `main` (the ONE `claude agents --json --all` read, the `ps aux` pid probe, the stop loop,
 * the report) and RE-EXPORTS every name it always exported, so every import site is unchanged.
 *
 * WHY `id`, NOT `sessionId` — the near-universal `claude stop` FAILURE `we:backlog/3435-*.md`'s "Found live"
 * finding 3 recorded (all five sessions, including `conveyor-3421b`, came back "No job matching" on `claude
 * stop <sessionId>`) was read at the time as a CLI/registry-staleness limitation, the same family as the
 * success-side note just above. It is not that. It is a wrong-FIELD bug: this loop passed `session.sessionId`
 * (the full listing-internal UUID `claude stop`/`claude rm` do not match on) where it should have passed
 * `session.id` (the short form the CLI actually accepts). Verified live 2026-09-03: a fresh `claude agents
 * --json --all` (208 rows) shows `id` present on all 204 `kind: 'background'` rows and absent on exactly the 4
 * `kind: 'interactive'` ones (a human's own terminal/Remote-Control session — never a row this reaper's `kind
 * !== 'background'` guard, above, would let reach the stop call in the first place). So within this reaper's
 * own domain `id` is always present — never the "absent from half the listing" shape `dispatch-lane-io.mjs
 * #listedSessionIds`'s own docblock measured (correctly, for the FULL mixed listing that function reads; that
 * finding stands, it just does not extend to `kind: 'background'` rows, the only ones this file ever acts on).
 * Direct proof the swap fixes the failure, same session: `claude stop <full sessionId>` on a real `done`
 * session (`conveyor-2972`) exited 1 with "No job matching"; `claude stop <short id>` on the SAME session
 * immediately after exited 0, "stopped". THIS DOES NOT MAKE `claude stop` UNIVERSALLY RELIABLE — a genuinely-
 * already-exited background session can still legitimately answer "No job matching" even given the correct
 * `id` (that is {@link stopSession}'s own documented `alreadyGone` case, expected and benign); today's failure
 * was near-100% and traced to the wrong field, not to occasional legitimate staleness. `main()`'s stop loop
 * below therefore reads `session.id` (never `session.sessionId`) for the actual handle, and treats a missing
 * `id` on a reap candidate as a logged anomaly rather than a silent skip — it should never happen given the
 * `kind !== 'background'` guard above, but "should never happen" is not the same as "cannot happen".
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { defaultListAgents, normalizeHandle } from '../operations/dispatch-lane-io.mjs';
// #3383 — REUSE, never reimplement, the real PID-liveness probe `driver-watchdog.mjs` built and `lease-reaper.mjs`
// already reuses for the IDENTICAL gap (a `claude agents --json` row LISTED, non-terminal, with NO backing OS
// process at all): a row's own `pid` when present, else a `ps aux` scan for its full `sessionId`. See
// `classifySessionReap`'s own `pid-dead` axis in `session-reap-plan.mjs`.
import { resolvePidAlive, scanPsOutput, defaultIsPidAlive } from './driver-watchdog.mjs';
// #3383 item 11 — the verdict axis's evidence resolver and the follow-up ledger reader: REUSED, none re-derived (the
// resolver lives apart from this file so land-advance-io can share it without an import cycle).
import { makeEvidenceResolver, prSignalFromGh } from './session-verdicts-io.mjs';
import { readFollowUps } from '../operations/land-advance-io.mjs';

import { sessionReapPlan, attentionRows, REDISPATCH_ACTIONS } from './session-reap-plan.mjs';
import { makeGroundTruthResolver } from './session-reap-evidence.mjs';
import { stopSessionWithRetry, attemptClearStuckSession, STOP_RETRY_ATTEMPTS } from './session-reap-stop.mjs';

// Re-export every name this file exported before the split, so `skills-src/conveyor/runner.mjs`, `wip-agents.test`,
// `session-verdicts.test` and every other import site work unchanged.
export {
  TERMINAL_REAP_STATES,
  ALREADY_STOPPED_STATES,
  classifySessionReap,
  sessionTarget,
  classifySessionReapWithGroundTruth,
  classifySessionReapWithVerdict,
  sessionReapPlan,
  attentionRows,
  REDISPATCH_ACTIONS,
  hasHandler,
} from './session-reap-plan.mjs';
export {
  MAX_GH_PR_VIEW_CALLS_PER_TICK,
  groundTruthForItem,
  groundTruthForPr,
  makeGroundTruthResolver,
} from './session-reap-evidence.mjs';
export {
  STOP_RETRY_ATTEMPTS,
  STOP_RETRY_BACKOFF_MS,
  stopSessionWithRetry,
  clearStuckSessionAutoConfirm,
  attemptClearStuckSession,
} from './session-reap-stop.mjs';

const log = (m) => process.stderr.write(m + '\n');

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

async function main(argv) {
  const flags = parseFlags(argv);
  const dryRun = !!flags['dry-run'];
  // `--no-verdicts` is the rollback for the VERDICT AXIS alone (see `session-reap-plan.mjs`'s header): back to the ground-truth and
  // state/pid axes exactly as they were before #3383 item 11.
  const useVerdicts = !flags['no-verdicts'];
  // The follow-up ledger names the repo a repo-less `review-<PR>` session was dispatched for (see
  // {@link makeGroundTruthResolver}); best-effort, an unreadable ledger is an empty one — never a reap.
  let followUps = [];
  if (!flags['no-ground-truth'] || useVerdicts) {
    try { followUps = readFollowUps(); } catch { /* unreadable ledger = no redispatch history and no repo hint */ }
  }
  // `--no-ground-truth` is an escape hatch back to the original state-only axis, for a rollback or an
  // A/B live comparison — the default is ON, matching the operator's own instruction that this axis should
  // actually run, not merely exist.
  const groundTruthFor = flags['no-ground-truth'] ? null : makeGroundTruthResolver({ exec: execFileSync, followUps });
  // `--no-clear-stuck` is the SAME kind of rollback/A-B escape hatch, one axis over: the default is ON — a
  // `claude stop` failure attempts the `clear-stuck-session` repair (see `session-reap-stop.mjs`'s header, "THE #77683 REPAIR")
  // unless this flag disables it, in which case a failed stop is reported exactly as it always was.
  const clearStuck = !flags['no-clear-stuck'];

  let sessions;
  try {
    // `all: true` IS LOAD-BEARING (#3435 review finding): every OTHER caller of `defaultListAgents` (the
    // dispatch observer, the dispatch guard's liveness check) deliberately omits `--all`, because for THEIR
    // job a completed session must read as gone. This reaper's job is the opposite — it exists to find and
    // `claude stop` exactly the `done`/`failed` sessions the plain listing excludes — so passing no `all` here
    // made `sessionReapPlan` compute `reap: []` on every real invocation; `claude stop` was never called, and
    // the clutter #3435 was filed to fix never actually got touched. See `defaultListAgents`'s own docblock
    // (`we:scripts/operations/dispatch-lane-io.mjs`) for why the OTHER callers must not also flip this.
    sessions = defaultListAgents({ exec: execFileSync, all: true });
  } catch (e) {
    // Best-effort like every other mechanical pass (Done-when #3): an unreadable listing means there is
    // nothing safe to act on this tick, not a hard failure — the next tick tries again.
    log(`  ⚠ \`claude agents --json\` unreadable — session-reaper skipping this tick: ${String(e?.message || e).split('\n')[0]}`);
    process.exit(0);
  }
  if (!Array.isArray(sessions)) sessions = [];

  // #3383 — resolve REAL pid liveness for every BACKGROUND row, feeding `classifySessionReap`'s new `pid-dead`
  // axis (see its own doc). ONE `ps aux` scan for the whole batch (never one subprocess per row), only when
  // something background was actually listed — mirrors `driver-watchdog.mjs`'s and `lease-reaper.mjs`'s own
  // discipline for the identical probe, reused here verbatim via `scanPsOutput`/`resolvePidAlive`.
  const hasBackground = sessions.some((s) => s && typeof s === 'object' && s.kind === 'background');
  const psOutput = hasBackground ? scanPsOutput({ exec: execFileSync }) : null;
  sessions = sessions.map((s) => (
    s && typeof s === 'object' && s.kind === 'background'
      ? { ...s, pidAlive: resolvePidAlive(s, { psOutput, isPidAlive: defaultIsPidAlive }) }
      : s
  ));

  // #3383 item 11 — the verdict axis's evidence: result files / completion records / (review, fix) PR signals /
  // transcript mtimes / the follow-up ledger. Best-effort: an unreadable ledger is an empty one, never a failure.
  let evidenceFor = null;
  if (useVerdicts) {
    evidenceFor = makeEvidenceResolver({ followUps, prSignalFor: flags['no-ground-truth'] ? null : (pr, slug) => prSignalFromGh(pr, slug) });
  }
  const { reap, keep } = sessionReapPlan(sessions, { groundTruthFor, evidenceFor, now: Date.now() });
  // Live rows the verdict axis found stuck but does NOT stop here (stalled / waiting-permission): reported so
  // land-advance can redispatch or escalate them. This reaper only stops sessions whose work is done.
  const attention = attentionRows(keep);
  for (const a of attention) log(`  attention ${a.id ?? '?'} (${a.verdict} → ${a.action}${a.handler === 'none' ? ' — no handler' : ''}; ${a.name ?? 'unnamed'}): ${a.why}`);
  const noHandler = attention.filter((a) => a.handler === 'none').length;
  if (noHandler) log(`  ${noHandler} attention row(s) have no handler: nothing executes ${[...REDISPATCH_ACTIONS].join(' / ')} yet — they stay listed until an operator acts`);

  let stopped = 0;
  let alreadyGone = 0;
  let cleared = 0;
  let failures = 0;
  let anomalies = 0;
  const done = [];
  for (const { session, reason } of reap) {
    // `id` (the SHORT form), never `sessionId` (the full UUID `claude stop` does not match on) — see the file
    // header's "WHY `id`, NOT `sessionId`" section. Every row here already passed `classifySessionReap`'s
    // `kind !== 'background'` guard, and every `kind: 'background'` row measured (live and in the checked-in
    // fixture) carries a real `id` — so a missing one here is a genuine anomaly, not an expected shape, and is
    // logged + counted rather than silently skipped (a `continue` with no trace would hide exactly the case
    // this guard exists to catch).
    const handle = normalizeHandle(session.id);
    if (!handle) {
      log(`  ⚠ ${session.sessionId ?? session.name ?? 'unknown'}: reap candidate is missing \`id\` — should never happen for a \`kind: background\` row, skipping and flagging as an anomaly`);
      anomalies++;
      continue;
    }
    if (dryRun) {
      log(`  would stop ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      continue;
    }
    try {
      // Retried — see {@link stopSessionWithRetry}'s own doc for why: a `claude stop` failure found live
      // 2026-09-04 was a transient CLI-internal hiccup, not a hard bug, and usually clears within a beat.
      const res = stopSessionWithRetry({ handle, exec: execFileSync });
      if (res.alreadyGone) alreadyGone++;
      else stopped++;
      log(`  ${res.alreadyGone ? 'already gone' : 'stopped'} ${handle} (${reason}; ${session.name ?? 'unnamed'})`);
      done.push({ id: handle, sessionId: normalizeHandle(session.sessionId) || null, name: session.name ?? null, reason, alreadyGone: res.alreadyGone });
    } catch (e) {
      // ONE session's stop failing never blocks the rest of the pass (Done-when #3) — the same
      // "couldn't confirm, background service may be restarting" flakiness lease-reaper.mjs already treats
      // as per-candidate, not pass-fatal. Reaches here only after `STOP_RETRY_ATTEMPTS` all failed, so this IS
      // a real (not merely transient) failure — worth saying so, since the retry count is otherwise invisible.
      const stopErr = String(e?.message || e).split('\n')[0];
      // THE #77683 REPAIR (see `session-reap-stop.mjs`'s header) — a `claude stop` failure this deep (every retry exhausted) is
      // exactly the shape `clear-stuck-session` exists for. Attempted ONLY here, never pre-emptively: this
      // reaper's own `classifySessionReap`/ground-truth axes already decided this candidate should go, and
      // `stopSessionWithRetry` already tried the ordinary path first — `clear-stuck-session`'s OWN `assessStuck`
      // is what actually decides whether anything moves, never this catch block.
      let repair = null;
      if (clearStuck) {
        try {
          repair = await attemptClearStuckSession({ handle });
        } catch (repairErr) {
          repair = { cleared: false, reason: `clear-stuck-session itself threw: ${String(repairErr?.message || repairErr).split('\n')[0]}` };
        }
      }
      if (repair?.cleared) {
        cleared++;
        log(`  cleared ${handle} via clear-stuck-session (run ${repair.runId}; ${reason}; ${session.name ?? 'unnamed'}) — \`claude stop\` had failed: ${stopErr}`);
        done.push({ id: handle, sessionId: normalizeHandle(session.sessionId) || null, name: session.name ?? null, reason, alreadyGone: false, clearedViaClearStuckSession: true, clearStuckRunId: repair.runId });
        continue;
      }
      log(
        `  ⚠ ${handle}: stop failed after ${STOP_RETRY_ATTEMPTS} attempts (${stopErr})`
        + `${clearStuck ? ` — clear-stuck-session did not confirm it stuck (${repair?.reason ?? 'unknown'})` : ''} — left for the next tick`,
      );
      failures++;
    }
  }

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: sessions.length,
          stopped: dryRun ? 0 : stopped,
          alreadyGone: dryRun ? 0 : alreadyGone,
          cleared: dryRun ? 0 : cleared,
          failures: dryRun ? 0 : failures,
          anomalies,
          wouldStop: dryRun
            ? reap.map((r) => ({ id: normalizeHandle(r.session.id) || null, sessionId: normalizeHandle(r.session.sessionId) || null, name: r.session.name ?? null, reason: r.reason }))
            : undefined,
          collected: dryRun ? undefined : done,
          kept: keep.length,
          attention,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    log(
      `session-reaper: ${sessions.length} session(s) listed · ` +
        `${dryRun ? `${reap.length} would stop` : `${stopped} stopped${alreadyGone ? `, ${alreadyGone} already gone` : ''}${cleared ? `, ${cleared} cleared via clear-stuck-session` : ''}${failures ? `, ${failures} failed` : ''}${anomalies ? `, ${anomalies} anomal${anomalies === 1 ? 'y' : 'ies'}` : ''}`} · ${keep.length} kept`,
    );
  }
  // Non-zero exit when a stop we ATTEMPTED actually failed, OR a reap candidate turned out to be missing its
  // `id` (the anomaly case — see the loop above) — mirrors lease-reaper.mjs's own convention, so a cron/loop
  // wrapper can tell a clean sweep from a partial one. `runQuiet` (the runner's own caller) swallows this
  // either way — it is surfaced for anyone invoking the CLI directly. A session `clear-stuck-session` actually
  // CLEARED does not count against this — it is a successful outcome, not a failure the next tick needs to see.
  process.exit(failures > 0 || anomalies > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => {
    // A crash in the async repair path (a bug, not a per-candidate failure `main()` already catches) must not
    // vanish as an unhandled rejection — surfaced the same way the top-level listing-read failure is, and still
    // best-effort: the NEXT tick gets a clean attempt.
    log(`  ⚠ session-reaper crashed: ${String(e?.message || e).split('\n')[0]}`);
    process.exit(1);
  });
}
