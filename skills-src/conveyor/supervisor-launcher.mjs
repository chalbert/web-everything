#!/usr/bin/env node
/**
 * @file skills-src/conveyor/supervisor-launcher.mjs
 * @description #3874 (epic #3383) — the thin top-level launcher that gives EVERY resident conveyor daemon
 *   named in {@link ./daemon-manifest.mjs}'s closed allowlist the same restart-on-crash / back-off-on-a-
 *   crash-loop protection we:skills-src/conveyor/supervisor.mjs already built for the Dispatcher
 *   (we:skills-src/conveyor/runner.mjs) alone — without a single line of supervisor.mjs changing.
 *
 * CORRECTED PREMISE #1 (documented in full in this item's own backlog card, backlog/3874-…md's `## Progress`
 * section). The card that opened this item asks whether we:skills-src/conveyor/supervisor.mjs's CLI "takes a
 * `--pass=` style flag itself" to pick which script it supervises. Read directly (its own `main()`): it does
 * not. `main()` hardcodes `RUNNER_PATH = join(HERE, 'runner.mjs')` and forwards every OTHER flag straight to
 * that fixed target — there is no flag, env var, or other lever to redirect it. Spawning N copies of
 * `node supervisor.mjs` would therefore spawn N supervisors of the SAME runner.mjs, never one per manifest
 * entry. What supervisor.mjs's own file DOES already offer, proven generic by its OWN test suite (see
 * `makeRealSpawnChild — real node child processes, never runner.mjs itself` in
 * we:skills-src/conveyor/__tests__/supervisor.test.mjs, which spawns arbitrary `-e` scripts, never
 * runner.mjs), is its EXPORTED pure core: {@link runSupervisorLoop} (the whole restart/backoff control flow,
 * every effect injected) and `makeRealSpawnChild` (the real `child_process` wiring, parameterized by
 * `runnerPath`/`extraArgs`). This launcher imports both UNMODIFIED and drives one restart/backoff loop per
 * manifest entry — each of which spawns a REAL, independent child OS process running that entry's own
 * script — inside this one launcher process. Zero edits to supervisor.mjs.
 *
 * CORRECTED PREMISE #2. {@link DAEMON_MANIFEST} does NOT already carry 15 real entries. Read directly (its
 * own file header, and we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs's own first assertion): it
 * starts EMPTY, by design — #3871 built the mechanism only. #3873 (wiring the 8 watcher passes onto
 * we:skills-src/conveyor/pass-daemon.mjs) is still `status: open`, unbuilt, at the time this launcher was
 * written. This launcher is built to be correct against that reality: it takes whatever names are CURRENTLY
 * registered (or an explicit `--only=` subset) with zero hardcoded entry names of its own, so the exact same,
 * unchanged file picks up #3873's watchers — and any later Dispatcher/Fix-dispatch/Review/Verify entries —
 * the moment a sibling slice registers them, with no code change here. It deliberately does NOT itself
 * register any new entries into the shared allowlist: {@link resolveManifestEntry} is also what
 * we:skills-src/conveyor/pass-daemon.mjs resolves `--pass=<name>` through, so adding an entry here would
 * silently change what THAT daemon can also be pointed at — a real product decision belonging to whichever
 * slice actually wires each script, not a side effect of building this launcher (this item's own `scope`
 * only ever named we:skills-src/conveyor/supervisor.mjs).
 *
 * WHY NO SEPARATE LEASE HERE. Every resident script this launcher can target already protects itself against
 * a duplicate live instance with its OWN lease (we:skills-src/conveyor/review-daemon.mjs's
 * `REVIEW_DAEMON_LEASE_KEY`, we:skills-src/conveyor/pass-daemon.mjs's `passDaemonLeaseKey(name)`, #3877's
 * keyed runner-lock scheme). If this launcher is ever accidentally started twice, each of the SECOND
 * instance's per-entry children just loses its lease race immediately, exits fast, and the reused
 * `classifyExit`/`decideRestart` pair (imported unmodified from supervisor.mjs) correctly reads that as a
 * too-short crash and backs it off toward the ceiling — the same self-healing-but-silent behavior
 * supervisor.mjs's own header already documents (and #3398 already alerts on, for the Dispatcher case). No
 * new locking primitive is needed at this layer.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors this epic's established shape — see we:skills-src/conveyor/pass-daemon.mjs
 * and we:skills-src/conveyor/review-daemon.mjs headers):
 *   • {@link planLaunchTargets} and {@link defaultLaunchNames} are the pure core — no IO of their own,
 *     `resolveEntry`/`manifest` injected, unit-tested against fixture manifests
 *     (skills-src/conveyor/__tests__/supervisor-launcher.test.mjs) — never the real (today empty)
 *     `DAEMON_MANIFEST`. One bad name never aborts the rest (mirrors this epic's own "one bad entry never
 *     aborts the rest" discipline: reconcile-pass.mjs's per-PR isolation, review-daemon.mjs's per-repo
 *     isolation).
 *   • {@link launchEntry} and {@link launchAll} are IO-shell GLUE that itself takes injectable
 *     `runLoop`/`makeSpawnChild`/`makeLog` (defaulting to supervisor.mjs's own real, unmodified exports) —
 *     unit-tested with fakes for those three, so no real subprocess is ever spawned by the unit suite.
 *   • `main()` (gated on direct invocation, exactly like supervisor.mjs's own) is the ONLY code path that
 *     actually spawns real children — it resolves the CLI's requested names, launches one supervised loop
 *     per entry, and forwards SIGINT/SIGTERM to every live child so a stopped launcher never leaves one
 *     orphaned.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveManifestEntry, DAEMON_MANIFEST } from './daemon-manifest.mjs';
import { runSupervisorLoop, makeRealSpawnChild, makeJsonlLog } from './supervisor.mjs';
import { RUNNER_LOCK_ROOT } from './runner-lock.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where each entry's own supervisor JSONL history lands — one file per entry name, under the SAME lock root
 *  every other resident piece of this epic uses (memory rule 105), never a third state location, and never
 *  interleaved with a sibling entry's own history. */
export const DEFAULT_LOG_ROOT = join(RUNNER_LOCK_ROOT, 'supervisor-launcher');

// ── PURE CORE (no IO — every effect is injected; unit-tested directly) ─────────────────────────────────────

/**
 * Resolve a requested list of manifest names into concrete launch targets, isolating one unresolvable name
 * from the rest rather than aborting the whole launch over one typo or one not-yet-registered entry. Pure —
 * `resolveEntry` is injected (defaults to the real {@link resolveManifestEntry}) so this is unit-tested
 * against a fixture manifest, never the real (today empty) `DAEMON_MANIFEST`.
 * @param {string[]} names
 * @param {{ manifest?: Record<string, object>, resolveEntry?: (name:string, manifest:object) => object }} [o]
 * @returns {{
 *   targets: Array<{ name:string, script:string, args:string[] }>,
 *   failures: Array<{ name:string, error:string }>,
 * }}
 */
export function planLaunchTargets(names, { manifest = DAEMON_MANIFEST, resolveEntry = resolveManifestEntry } = {}) {
  const list = Array.isArray(names) ? names : [];
  const targets = [];
  const failures = [];
  for (const name of list) {
    try {
      const entry = resolveEntry(name, manifest);
      targets.push({ name, script: entry.script, args: Array.isArray(entry.args) ? entry.args : [] });
    } catch (e) {
      failures.push({ name, error: String((e && e.message) || e) });
    }
  }
  return { targets, failures };
}

/**
 * The names to launch when the CLI is given none of its own: every name CURRENTLY registered in the manifest,
 * sorted for a deterministic launch order. Today (see this file's own header): none — #3873 and any later
 * daemon-launcher slice are what populate the real manifest; this same, unchanged function then picks up
 * whatever they register with zero code change here. Pure.
 * @param {Record<string, object>} [manifest]
 * @returns {string[]}
 */
export function defaultLaunchNames(manifest = DAEMON_MANIFEST) {
  return Object.keys(manifest).sort();
}

// ── IO SHELL (owns the real child processes — every effect defaults to supervisor.mjs's own real, UNMODIFIED
//    exports, but is injectable so the unit suite never spawns a real subprocess) ───────────────────────────

/** Resolve one manifest entry's repo-relative `script` against a repo root — pure string-join, no IO, kept
 *  here (not in the pure-core section above) because its only caller is the real-spawn IO glue below. */
export function resolveScriptPath(script, { root = REPO_ROOT } = {}) {
  return join(root, script);
}

/** Where one entry's own supervisor history JSONL lands. Pure string-join. */
export function entryLogPath(name, { logRoot = DEFAULT_LOG_ROOT } = {}) {
  return join(logRoot, `${name}.jsonl`);
}

/**
 * Drive ONE manifest entry's own restart/backoff supervisor loop to completion (which, absent a stop signal,
 * is "forever" — mirrors supervisor.mjs's own `main()` shape one level up, one entry at a time). Every real
 * effect (`makeSpawnChild`, `makeLog`, `runLoop`) defaults to supervisor.mjs's own real, UNMODIFIED exports;
 * all three are injectable so the unit suite proves this function wires its target's `runnerPath`/`extraArgs`
 * and per-entry log path correctly WITHOUT ever spawning a real subprocess.
 * @param {{ name:string, script:string, args:string[] }} target
 * @param {{
 *   root?: string, logRoot?: string,
 *   onChild?: (name:string, child: import('node:child_process').ChildProcess|null) => void,
 *   shouldStop?: () => boolean,
 *   sleep?: (ms:number) => Promise<void>,
 *   makeSpawnChild?: typeof makeRealSpawnChild,
 *   makeLog?: typeof makeJsonlLog,
 *   runLoop?: typeof runSupervisorLoop,
 * }} [o]
 * @returns {Promise<{ restarts:number, stoppedReason:string }>}
 */
export async function launchEntry({ name, script, args }, {
  root = REPO_ROOT, logRoot = DEFAULT_LOG_ROOT,
  onChild = () => {}, shouldStop = () => false, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  makeSpawnChild = makeRealSpawnChild, makeLog = makeJsonlLog, runLoop = runSupervisorLoop,
} = {}) {
  const runnerPath = resolveScriptPath(script, { root });
  const spawnChild = makeSpawnChild({ runnerPath, extraArgs: args, onChild: (child) => onChild(name, child) });
  const baseLog = makeLog(entryLogPath(name, { logRoot }));
  const log = (entry) => baseLog({ name, ...entry });
  return runLoop({ spawnChild, log, sleep, shouldStop });
}

/**
 * Resolve the requested names (or every currently-registered one) and launch one supervised loop per
 * resolvable target, concurrently. A name that fails to resolve is reported via `onFailure` and simply never
 * launched — it does not abort the others (see {@link planLaunchTargets}'s own header). Returns immediately
 * with the failures and the in-flight promises (one per launched entry); the caller awaits those promises to
 * know when every entry has actually stopped (normally: never, until `shouldStop()` starts returning true).
 * @param {string[]} [names]
 * @param {object} [o] — forwarded to {@link planLaunchTargets} (`manifest`, `resolveEntry`) and
 *   {@link launchEntry} (everything else), plus `onFailure((failure) => void)`.
 * @returns {{
 *   failures: Array<{ name:string, error:string }>,
 *   launched: Array<{ name:string, script:string, args:string[] }>,
 *   running: Promise<{ restarts:number, stoppedReason:string }>[],
 * }}
 */
export function launchAll(names, {
  manifest = DAEMON_MANIFEST, resolveEntry = resolveManifestEntry, onFailure = () => {}, ...entryOpts
} = {}) {
  const requested = Array.isArray(names) && names.length > 0 ? names : defaultLaunchNames(manifest);
  const { targets, failures } = planLaunchTargets(requested, { manifest, resolveEntry });
  for (const failure of failures) onFailure(failure);
  const running = targets.map((target) => launchEntry(target, entryOpts));
  return { failures, launched: targets, running };
}

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
  const only = typeof flags.only === 'string' ? flags.only.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const root = typeof flags.root === 'string' ? flags.root : REPO_ROOT;
  const logRoot = typeof flags['log-root'] === 'string' ? flags['log-root'] : DEFAULT_LOG_ROOT;

  const requested = only.length > 0 ? only : defaultLaunchNames(DAEMON_MANIFEST);
  if (requested.length === 0) {
    process.stderr.write('[conveyor-supervisor-launcher] no manifest entries registered (and none named via --only=) — nothing to launch.\n');
    return;
  }

  const liveChildren = new Map();
  let stopRequested = false;
  const shutdown = (signal) => {
    if (stopRequested) return;
    stopRequested = true;
    process.stderr.write(`[conveyor-supervisor-launcher] ${signal} — stopping ${liveChildren.size} live child(ren).\n`);
    for (const child of liveChildren.values()) {
      try { child.kill('SIGTERM'); } catch { /* already gone */ }
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already exited cleanly */ } }, 5_000).unref();
    }
  };
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(sig));

  const { failures, launched, running } = launchAll(requested, {
    manifest: DAEMON_MANIFEST, root, logRoot,
    onChild: (name, child) => { if (child) liveChildren.set(name, child); else liveChildren.delete(name); },
    shouldStop: () => stopRequested,
    onFailure: (f) => process.stderr.write(`[conveyor-supervisor-launcher] "${f.name}" not launched: ${f.error}\n`),
  });
  for (const target of launched) {
    process.stderr.write(`[conveyor-supervisor-launcher] launched "${target.name}" (${target.script}${target.args.length ? ' ' + target.args.join(' ') : ''}).\n`);
  }
  if (failures.length > 0 && launched.length === 0) {
    process.exitCode = 1;
    return;
  }
  await Promise.all(running);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ supervisor-launcher error: ${String((e && e.stack) || e)}\n`); process.exit(1); });
}
