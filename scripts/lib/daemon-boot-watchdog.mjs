/**
 * @file scripts/lib/daemon-boot-watchdog.mjs — #4468, part 2. `daemon-boot-smoke.mjs` closes the gap where a
 * candidate that CANNOT boot got adopted anyway; this file is the defense-in-depth backstop for whatever that
 * check still misses (a boot failure that only shows up under the real `--live`/env the plain import-boot check
 * does not exercise, a timing-dependent fault, …).
 *
 * THE GAP THIS CLOSES. Live 2026-09-29 (#2921): the daemon that owns the rollback code
 * (`daemon-live-smoke.mjs#rollbackToSha`) is exactly the process that could no longer start — nothing INSIDE a
 * process that dies at import time, before `main()` ever runs, can roll itself back. Recovery needed a human to
 * remove the overlay and run `daemon-load-overlay.mjs` by hand. A guard that can actually see "this clone has
 * crash-looped K times in a row" and revert it must therefore live OUTSIDE the daemon's own code — in whatever
 * process actually SPAWNS the daemon, watching its real exit events directly, never trusting the daemon to
 * report anything about its own death.
 *
 * THE MECHANISM (this file). {@link runSupervisedStart} is ONE supervised start attempt:
 *   1. Read this clone's own boot-attempt history ({@link readBootState}) and run {@link decideCrashLoop} (pure)
 *      against it — BEFORE spawning anything. A tripped guard reverts the clone to its last BOOT-CONFIRMED-good
 *      sha (via the injected `rollback`, e.g. `daemon-live-smoke.mjs#rollbackToSha`) and clears the history, so
 *      the very next start attempt is against known-good code, not a repeat of the same broken one.
 *   2. Spawn the real entry (`spawnFn`) and race its exit against {@link DEFAULT_SURVIVAL_MS} (`N`): exits first
 *      ⇒ a FAST EXIT, appended to history; survives past the window ⇒ BOOT CONFIRMED — this clone's current HEAD
 *      is stamped as the new "known good" sha ({@link recordBootConfirmed}), which is what a LATER crash-loop
 *      reverts to, never the merely smoke-adopted sha (the same sha a live-but-still-broken smoke can pass).
 * Bounded history ({@link DEFAULT_MAX_HISTORY}) — this is a rolling window, never an unbounded log.
 *
 * PURE CORE / IO SHELL, same convention as `daemon-live-smoke.mjs`/`daemon-self-sync.mjs`: {@link decideCrashLoop}
 * is pure (given a history array, is this a crash loop?); everything else does real IO (child spawn, fs, git)
 * through injectable params.
 *
 * DELIBERATELY NOT WIRED INTO ANY REAL LAUNCHD CONFIG BY THIS CHANGE — same "mechanism only" scoping
 * `skills-src/conveyor/daemon-manifest.mjs` used for its own launcher mechanism: proving this live means running
 * it against a THROWAWAY scratch clone (this file's own test suite; see also the `daemon-entry-boot-crash` soak
 * break), never restarting or re-supervising a real running daemon process. Pointing a real daemon's launchd
 * entry at `main()` below (in place of `node <entry>.mjs` directly) is a follow-up, tracked separately.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitRun } from './main-staleness.mjs';
import { rollbackToSha } from './daemon-live-smoke.mjs';
import { cloneKeyOf, daemonStateDir } from './daemon-last-good.mjs';

/** How long a freshly-started entry must stay alive to count as a confirmed boot (`N` seconds in the card). */
export const SURVIVAL_MS_ENV = 'WE_DAEMON_BOOT_SURVIVAL_MS';
export const DEFAULT_SURVIVAL_MS = 15_000;

/** How many CONSECUTIVE fast exits (each under the survival window) count as a crash loop (`K` in the card). */
export const CRASH_LOOP_COUNT_ENV = 'WE_DAEMON_BOOT_CRASH_LOOP_COUNT';
export const DEFAULT_CRASH_LOOP_COUNT = 3;

/** Rolling window: how many past attempts {@link appendBootAttempt} keeps — old rows fall off the front. */
export const DEFAULT_MAX_HISTORY = 20;

export function survivalMs(env = process.env) {
  const n = Number(env?.[SURVIVAL_MS_ENV]);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SURVIVAL_MS;
}

export function crashLoopCount(env = process.env) {
  const n = Number(env?.[CRASH_LOOP_COUNT_ENV]);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_CRASH_LOOP_COUNT;
}

/**
 * PURE: is the tail of `history` a crash loop — the last `countThreshold` attempts each exited in under
 * `thresholdMs`, AND all against the SAME candidate `head`? Fewer attempts than `countThreshold` on record is
 * never a loop (nothing to judge yet). A SINGLE attempt that survived resets the loop entirely (only the
 * CONSECUTIVE tail counts, not a lifetime tally — the same "one healthy start clears it" shape
 * `main-staleness.mjs`'s own guards use elsewhere).
 *
 * HEAD-TIED (#4468 review finding): two fast exits on a broken head B, immediately followed by a brand-new
 * overlay head C that also happens to exit once, must never sum to "3 consecutive failures" and trip a revert
 * against C on the strength of B's failures — C has only failed ONCE. The tail is a loop only when every
 * attempt in it shares the SAME `head` as the most recent one; a missing/unknown head on the most recent
 * attempt refuses to judge at all (never trips blind on an attempt this function cannot attribute to a
 * candidate).
 * @param {{history:Array<{startedAt:number, exitedAt:number, head?:string|null}>, thresholdMs:number,
 *   countThreshold:number}} o
 * @returns {boolean}
 */
export function decideCrashLoop({ history, thresholdMs, countThreshold }) {
  if (!Array.isArray(history) || history.length < countThreshold) return false;
  const tail = history.slice(-countThreshold);
  const head = tail[tail.length - 1]?.head;
  if (head == null) return false;
  return tail.every((a) => a?.head === head
    && Number.isFinite(a?.startedAt) && Number.isFinite(a?.exitedAt) && (a.exitedAt - a.startedAt) < thresholdMs);
}

export function bootStatePath(root, env = process.env) {
  return join(daemonStateDir(env), `${cloneKeyOf(root)}.boot-supervisor.json`);
}

/** `{ attempts: [...], bootConfirmed: {head, at}|null }` — `null`/defaults on any read failure (never throws). */
export function readBootState(root, env = process.env) {
  try {
    const parsed = JSON.parse(readFileSync(bootStatePath(root, env), 'utf8'));
    return { attempts: Array.isArray(parsed?.attempts) ? parsed.attempts : [], bootConfirmed: parsed?.bootConfirmed ?? null };
  } catch {
    return { attempts: [], bootConfirmed: null };
  }
}

function writeBootState(root, state, env = process.env) {
  try {
    mkdirSync(daemonStateDir(env), { recursive: true });
    writeFileSync(bootStatePath(root, env), JSON.stringify(state, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Append one attempt, trimmed to {@link DEFAULT_MAX_HISTORY}. Best-effort — a write failure never blocks the
 *  caller (worst case: the next decision is made on a shorter/stale history, never a correctness break). */
export function appendBootAttempt(root, attempt, { env = process.env, maxHistory = DEFAULT_MAX_HISTORY } = {}) {
  const state = readBootState(root, env);
  const attempts = [...state.attempts, attempt].slice(-maxHistory);
  return writeBootState(root, { ...state, attempts }, env);
}

/** Record a confirmed-good boot for `head`; also clears attempt history (a confirmed boot means the CURRENT
 *  streak of failures, if any were already recorded for an earlier head, is moot). */
export function recordBootConfirmed(root, { head, at = new Date().toISOString() }, env = process.env) {
  return writeBootState(root, { attempts: [], bootConfirmed: { head, at } }, env);
}

/** Clear attempt history after a revert — the next attempt starts a fresh streak against known-good code. */
export function clearBootAttempts(root, env = process.env) {
  const state = readBootState(root, env);
  return writeBootState(root, { ...state, attempts: [] }, env);
}

function currentHead(root, run) {
  const r = run(['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() || null : null;
}

/** Default `spawnFn` — a real detached child. Resolves once with `{exitedAt, code}` on exit, and separately
 *  hands the live `child` back to the caller so it can be raced against the survival timer. */
function defaultSpawn(entry, args, { cwd, env }) {
  const child = spawn('node', [entry, ...args], { cwd, env, detached: true, stdio: 'ignore' });
  const exited = new Promise((res) => {
    child.once('exit', (code) => res({ exitedAt: Date.now(), code: code ?? null }));
  });
  return { child, exited };
}

/**
 * ONE supervised start attempt — see the file header for the full sequence.
 * @param {{root:string, entry:string, args?:string[], env?:NodeJS.ProcessEnv, now?:()=>number,
 *   thresholdMs?:number, countThreshold?:number, spawnFn?:typeof defaultSpawn, run?:typeof gitRun,
 *   rollback?:typeof rollbackToSha, log?:Console}} o
 * @returns {Promise<{started:boolean, reverted?:object, survived?:boolean, head?:string|null,
 *   attempt?:object, child?:object}>}
 */
export async function runSupervisedStart({
  root, entry, args = [], env = process.env, now = Date.now, thresholdMs = survivalMs(env),
  countThreshold = crashLoopCount(env), spawnFn = defaultSpawn, run = gitRun, rollback = rollbackToSha, log = console,
}) {
  const state = readBootState(root, env);
  if (decideCrashLoop({ history: state.attempts, thresholdMs, countThreshold })) {
    const target = state.bootConfirmed?.head ?? null;
    // `rollbackToSha` itself already refuses a `null` target (`{ok:false, reason:'no-sha'}`) — reached when
    // this clone has crash-looped before ANY start of it ever survived the window, so there is no
    // boot-confirmed sha to revert to yet. Fails closed: never resets to an unknown/guessed target.
    const result = rollback({ root, sha: target, run });
    log.error?.(
      `daemon-boot-watchdog: ${countThreshold} consecutive fast exits (< ${thresholdMs}ms) on ${root} — `
      + `${result.ok ? `reverted to last boot-confirmed ${target}`
        : target == null ? 'NO BOOT-CONFIRMED SHA ON RECORD — cannot revert; needs a hand fix (this clone has never survived a start)'
          : `REVERT FAILED (${result.reason}) — needs a hand \`git reset --hard ${target}\``}, before the next start (#4468).`,
    );
    if (result.ok) clearBootAttempts(root, env);
    return { started: false, reverted: { target, ...result } };
  }

  const startedAt = now();
  const head = currentHead(root, run);
  const { child, exited } = spawnFn(entry, args, { cwd: root, env });
  // #4468 review — track the timer handle and ALWAYS clear it once the race settles (whichever side won), and
  // `.unref()` it immediately: an un-cleared/ref'd timer would otherwise hold this process's event loop alive
  // for up to the full survival window after a fast exit already resolved the race the other way.
  let timer;
  const survivalTimer = new Promise((res) => {
    timer = setTimeout(() => res({ survived: true }), thresholdMs);
    timer.unref?.();
  });
  const outcome = await Promise.race([exited.then((e) => ({ survived: false, ...e })), survivalTimer]);
  clearTimeout(timer);

  if (outcome.survived) {
    if (head) recordBootConfirmed(root, { head }, env);
    return { started: true, survived: true, head, child };
  }
  const attempt = { startedAt, exitedAt: outcome.exitedAt, code: outcome.code, head };
  appendBootAttempt(root, attempt, { env });
  log.error?.(`daemon-boot-watchdog: ${entry} exited ${outcome.code} after ${outcome.exitedAt - startedAt}ms (< ${thresholdMs}ms survival window) on ${root}.`);
  return { started: true, survived: false, head, attempt };
}

// ── CLI — a throwaway/scratch-clone wrapper, never wired to a real launchd entry by this change (see header). ──

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

async function main(argv) {
  const flags = parseFlags(argv);
  if (!flags.entry || !flags.clone) {
    // One supervised start attempt per invocation — there is no loop here (see the file header: "mechanism
    // only", never wired to a real launchd entry by this change). A `[--once]`-style flag would imply a loop
    // this CLI does not have; the wiring follow-up is what decides how a real caller repeats this.
    process.stderr.write('usage: daemon-boot-watchdog.mjs --entry=<relpath> --clone=<root>\n');
    process.exit(2);
    return;
  }
  const result = await runSupervisedStart({ root: resolve(flags.clone), entry: flags.entry, args: [] });
  process.stdout.write(`${JSON.stringify(result, (k, v) => (k === 'child' ? undefined : v))}\n`);
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`daemon-boot-watchdog: fatal: ${String(e?.stack || e)}\n`); process.exit(1); });
}
