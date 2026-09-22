#!/usr/bin/env node
/**
 * @file skills-src/conveyor/pass-daemon.mjs
 * @description #3871 (epic #3383) — the GENERIC single-pass daemon: runs ONE mechanical pass script
 *   (resolved ONLY through {@link ./daemon-manifest.mjs}'s closed allowlist — see that file's header) on its
 *   own interval, forever, standalone. Where #3870's `reconcile-fix-dispatch-daemon.mjs` is a bespoke daemon
 *   for one in-process function, this file is the generic form any FUTURE pass can plug into by adding one
 *   manifest entry — no new daemon file, no new loop to write.
 *
 * WHY A SUBPROCESS, NOT AN IN-PROCESS CALL (unlike #3870). Every mechanical pass in this epic is already a
 * standalone CLI (`node scripts/conveyor/<pass>.mjs <args>`) — that is what `runner.mjs`'s own
 * `makeCliMechanicalPasses` already shells today. Spawning it as a real child process (never `require`-ing
 * or dynamic-`import`-ing its module) means: (a) a pass that crashes or hangs cannot take this daemon down
 * with it — its own event loop keeps running the heartbeat regardless; (b) THE INDEPENDENT HEARTBEAT this
 * item's own card calls for falls out for free — `main()` below starts a real `setInterval` heartbeat BESIDE
 * the `await` on the child process's exit, so a long-running pass (`we:scripts/conveyor/infra-blocked.mjs`'s
 * own header: its `resumeOpen` call "can legitimately block for minutes on pr-land's own green-wait") never
 * silently stalls this daemon's own liveness signal the way it would if the heartbeat only fired BETWEEN
 * ticks (today's single-runner behavior, and #3870's own simpler loop — safe there only because that pass
 * never blocks nearly this long).
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrored from runner.mjs and #3870's own daemon):
 *   • {@link runPassDaemonLoop} has no `child_process`, no real timer, no real lease — every effect (spawning
 *     the pass, sleeping between runs) is injected, unit-tested with fakes.
 *   • The IO SHELL (`main()`) resolves the manifest entry, spawns the real child, starts the REAL independent
 *     heartbeat `setInterval` (never inside the loop's own await chain), and owns the real keyed lease
 *     (#3877) — its own distinct key, one per `--pass=<name>`, so two different passes running under this
 *     daemon never contend with each other or with the Dispatcher's own lease.
 */

import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveManifestEntry } from './daemon-manifest.mjs';
import {
  RUNNER_LOCK_ROOT, makeOwner,
  acquireRunnerLease, heartbeatRunnerLease, releaseRunnerLeaseIfOwned,
} from './runner-lock.mjs';

/** How often the INDEPENDENT heartbeat timer fires, regardless of whether a pass is mid-run. Deliberately
 *  much shorter than any pass's own `intervalMs` — it exists precisely to keep beating DURING a long single
 *  run, not just between them. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** This daemon's own lease key, one per pass name — distinct from the Dispatcher's default sentinel, from
 *  #3870's Fix-dispatch daemon key, and from every OTHER pass's own key, so N pass-daemon instances never
 *  contend with each other. */
export function passDaemonLeaseKey(passName) { return `<conveyor:pass-daemon:${passName}-lease>`; }

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/**
 * The daemon's run/sleep control flow — deliberately does NOT own the heartbeat (that runs on its own real
 * timer in the IO shell, see the file header for why); this loop only isolates a failing run and paces the
 * `intervalMs` between them.
 * @param {{
 *   runPass: () => Promise<{code:number|null}>,
 *   sleep: (ms:number) => Promise<void>,
 *   isAlive?: () => boolean,
 *   onRun?: (result:object, run:number) => void,
 *   onRunError?: (error:Error, run:number) => void,
 *   intervalMs: number,
 *   maxRuns?: number,
 * }} o
 * @returns {Promise<{runs:number, stoppedReason:string}>}
 */
export async function runPassDaemonLoop({
  runPass, sleep, isAlive = () => true, onRun = () => {}, onRunError = () => {},
  intervalMs, maxRuns = Infinity,
}) {
  if (typeof runPass !== 'function') throw new TypeError('runPassDaemonLoop requires a runPass effect');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new TypeError('runPassDaemonLoop requires a positive intervalMs');
  let run = 0;
  for (;;) {
    try {
      const result = await runPass();
      onRun(result, run);
    } catch (error) {
      onRunError(error, run);
    }
    if (!isAlive()) return { runs: run + 1, stoppedReason: 'lease-lost' };
    if (run + 1 >= maxRuns) return { runs: run + 1, stoppedReason: 'max-runs' };
    await sleep(intervalMs);
    run += 1;
  }
}

// ── IO SHELL (runs only as a CLI — owns the real child process + the real independent heartbeat) ────────────

// Live-caught bug (#3870/#3876, both built on this same pattern): `.unref()`-ing this timer told Node it
// was fine to exit before it fired. Between pass runs, nothing else keeps the event loop alive (a completed
// child's stdio no longer holds a reference), so the daemon would exit right after its first run instead of
// waiting out `intervalMs` and looping. A REF'd timer (Node's default — no `.unref()`) is exactly what a
// resident daemon needs here: the sleep IS the reason it stays alive between runs. (The heartbeat
// `setInterval` below is correctly left `.unref()`'d — it is not meant to be a standalone keep-alive; this
// timer already guarantees survival once fixed.)
export function realSleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }

/** Spawn one real run of the manifest-resolved script to completion, async (never blocking the event loop
 *  the independent heartbeat relies on — mirrors why `runner.mjs`'s own `runQuietHeartbeating` uses `spawn`,
 *  never `execFileSync`, for anything that can outlast a beat). */
export function spawnPassOnce({ script, args = [] }, { root = REPO_ROOT, log = console } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, script), ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', (code, signal) => {
      if (code !== 0) log.error(`pass-daemon: ${script} exited ${signal ? `on ${signal}` : `with code ${code}`}`);
      resolve({ code, signal });
    });
    child.on('error', (e) => { log.error(`pass-daemon: failed to spawn ${script}: ${String((e && e.message) || e)}`); resolve({ code: null, signal: null, spawnError: String((e && e.message) || e) }); });
  });
}

async function main(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    flags[eq === -1 ? a.slice(2) : a.slice(2, eq)] = eq === -1 ? true : a.slice(eq + 1);
  }
  const passName = typeof flags.pass === 'string' ? flags.pass : null;
  if (!passName) { console.error('pass-daemon: --pass=<name> is required (see skills-src/conveyor/daemon-manifest.mjs for known entries).'); process.exit(1); }

  let entry;
  try { entry = resolveManifestEntry(passName); }
  catch (e) { console.error(String((e && e.message) || e)); process.exit(1); return; }

  const intervalMs = flags.interval ? Number(flags.interval) : entry.intervalMs;
  const heartbeatIntervalMs = flags['heartbeat-interval'] ? Number(flags['heartbeat-interval']) : DEFAULT_HEARTBEAT_INTERVAL_MS;
  const key = passDaemonLeaseKey(passName);
  const owner = makeOwner(`pass-daemon:${passName}`);

  const acquired = acquireRunnerLease(RUNNER_LOCK_ROOT, owner, { key });
  if (!acquired.ok) { console.error(`pass-daemon: a live "${passName}" instance already holds the lease (${acquired.heldBy}) — exiting.`); return; }

  let alive = true;
  const heartbeatTimer = setInterval(() => {
    // THE INDEPENDENT HEARTBEAT — fires on its own real timer regardless of whether a pass run is in flight.
    if (!heartbeatRunnerLease(RUNNER_LOCK_ROOT, owner, { key })) {
      alive = false;
      console.error(`pass-daemon: lease lost for "${passName}" — will stop after the current run.`);
    }
  }, heartbeatIntervalMs);
  heartbeatTimer.unref?.();

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.error(`pass-daemon: ${signal} — releasing "${passName}"'s lease and exiting.`);
    clearInterval(heartbeatTimer);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.error(`pass-daemon: started "${passName}" (${entry.script}) on interval ${intervalMs}ms, heartbeat every ${heartbeatIntervalMs}ms.`);
  const { stoppedReason } = await runPassDaemonLoop({
    runPass: () => spawnPassOnce(entry),
    sleep: realSleep,
    isAlive: () => alive,
    intervalMs,
    onRunError: (e) => console.error(`pass-daemon: "${passName}" run failed (non-fatal): ${String((e && e.message) || e).split('\n')[0]}`),
  });
  if (!stopping) {
    console.error(`pass-daemon: "${passName}" loop stopped (${stoppedReason}) — releasing the lease and exiting.`);
    clearInterval(heartbeatTimer);
    releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key });
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => { console.error(`pass-daemon: fatal: ${String((e && e.message) || e)}`); process.exit(1); });
}
