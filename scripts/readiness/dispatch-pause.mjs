#!/usr/bin/env node
/**
 * @file scripts/readiness/dispatch-pause.mjs
 * @description MANUAL/EMERGENCY DISPATCH-PAUSE LEVER (#3609, epic #3383) — a deliberate operator kill-switch,
 *   DISTINCT from the automatic `MAX_CONCURRENT_LANES` admission ceiling (#3612/#xupukxa, both filed the same
 *   night from the 2026-09-07 42-lane/load-34.95 incident). That cap is a STANDING ceiling the dispatcher always
 *   respects; this is a manual override an operator (or a future automatic overload detector) flips to stop ALL
 *   new dispatch immediately — builds, prepare-scope, prepare-decision, fix, and ci-heal spawns alike — while
 *   letting already-running lanes finish normally, then resumes once cleared.
 *
 * WHY THIS EXISTS. The incident's own operator hand-rolled a pause using a plain JSON file under
 * `~/.claude/conveyor-runner-locks/<hash>/SESSION-RESUME-HOLD.json` that did NOT actually gate anything mechanically
 * — it only worked because the operator remembered to honor it themselves. This module is the REAL mechanical
 * lever: `we:scripts/readiness/dispatch-plan.mjs#dispatchPlan` and `we:scripts/conveyor/tick-core.mjs#planTick`
 * BOTH check it before computing any launch/spawn list, holding every otherwise-launchable item with the reason
 * `dispatch-paused` while it is set, and NEVER touching an already-running lane (this module has no lane/lease
 * knowledge at all — it is a pure upstream gate, read before any dispatch decision is made).
 *
 * SHAPE — mirrors `we:scripts/readiness/red-main-remediation.mjs`'s dispatch-freeze marker (a single-holder
 * advisory state file with SET / CLEAR / read-STATUS verbs) and `we:scripts/conveyor/infra-blocked.mjs`'s
 * persistence conventions (script-location path resolution — never CWD — an env-var override, and an ATOMIC
 * temp+rename write so a mid-write reader never observes partial JSON). Simpler than infra-blocked's own
 * array-of-entries + exponential-backoff retry state: this is ONE global advisory flag, not a per-item store —
 * `{ paused, reason, by, at }`.
 *
 * WHERE THE STORE LIVES — `.conveyor/dispatch-pause.json`, a SESSION-LOCAL, gitignored sidecar alongside
 * `.conveyor/queue.json` / `.conveyor/infra-blocked.json` / `.conveyor/red-main-freeze.json`. Read OFFLINE by
 * both `dispatch-plan.mjs`'s and `tick-core.mjs`'s IO shells. FAILS OPEN on any read error — a missing or
 * corrupt marker reads as NOT paused, never the reverse: a state file must never itself wedge dispatch closed
 * forever with no way to recover short of hand-editing it.
 *
 * PURE-CORE / IO-SHELL SPLIT: {@link emptyPauseState} / {@link parsePauseState} / {@link setPause} /
 * {@link clearPause} / {@link serializePauseState} are PURE — no fs / clock (`now` is injected) — so they are
 * unit-tested directly against plain strings/objects. The fs helpers (`resolvePauseStorePath` /
 * `readPauseState` / `writePauseState` / `isDispatchPaused`) and the `set` / `clear` / `status` CLI own the
 * fs/clock boundary.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeAllSync } from '../lib/write-all-sync.mjs';

// ── PURE CORE (no fs / clock — every input injected) ────────────────────────────────────────────────────────

/** A fresh, NOT-paused state — the read for "no file yet" and every fail-open path. */
export function emptyPauseState() {
  return { paused: false, reason: null, by: null, at: null };
}

/**
 * Tolerant parse of `.conveyor/dispatch-pause.json` text → normalized `{ paused, reason, by, at }`. NEVER
 * throws: empty/whitespace text, unparseable JSON, or a non-object all degrade to {@link emptyPauseState} —
 * a corrupt marker FAILS OPEN (read as not-paused) rather than silently wedging dispatch closed forever.
 * @param {string|null|undefined} text
 * @returns {{paused:boolean, reason:(string|null), by:(string|null), at:(string|null)}}
 */
export function parsePauseState(text) {
  if (!text || !String(text).trim()) return emptyPauseState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyPauseState(); }
  // Array.isArray guard is load-bearing, not defensive noise: `typeof [] === 'object'` passes the check above,
  // and an array's own indices/prototype (e.g. `Array.prototype.at`) would otherwise shadow the fields read
  // below — a `[1,2,3]` marker must fail open exactly like any other malformed shape, never read a stray method.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyPauseState();
  return {
    paused: raw.paused === true,
    reason: raw.reason != null ? String(raw.reason) : null,
    by: raw.by != null ? String(raw.by) : null,
    at: raw.at != null ? String(raw.at) : null,
  };
}

/**
 * Set (or re-set — idempotent) the pause. Pure — `now` injected so this stays directly unit-testable.
 * @param {{reason?:(string|null), by?:(string|null)}} [o]
 * @param {number} [now] epoch ms
 * @returns {{paused:true, reason:string, by:(string|null), at:string}}
 */
export function setPause({ reason = null, by = null } = {}, now = Date.now()) {
  return {
    paused: true,
    reason: reason != null && String(reason).trim() ? String(reason).trim() : 'operator emergency pause',
    by: by != null && String(by).trim() ? String(by).trim() : null,
    at: new Date(now).toISOString(),
  };
}

/** Clear the pause — back to {@link emptyPauseState}. Idempotent (clearing an already-clear state is a no-op). */
export function clearPause() {
  return emptyPauseState();
}

/** Serialize a state object back to `dispatch-pause.json` text (a bare JSON object, newline-terminated). */
export function serializePauseState(state) {
  const s = state && typeof state === 'object' ? state : emptyPauseState();
  return JSON.stringify({ paused: s.paused === true, reason: s.reason ?? null, by: s.by ?? null, at: s.at ?? null }, null, 2) + '\n';
}

// ── THIN FS/IO SHELL (the boundary — used by dispatch-plan.mjs and tick-core.mjs) ──────────────────────────────

// Resolve the repo root by SCRIPT LOCATION (this file is scripts/readiness/dispatch-pause.mjs → root is two up),
// NOT by CWD — so every consumer (regardless of its own cwd) resolves the SAME store (mirrors queue-store.mjs /
// infra-blocked.mjs).
const HERE = dirname(fileURLToPath(import.meta.url));
export const PAUSE_ROOT = resolve(HERE, '..', '..');

/** The session sidecar path: `<root>/.conveyor/dispatch-pause.json`. */
export function pauseStorePath(root = PAUSE_ROOT) {
  return join(root, '.conveyor', 'dispatch-pause.json');
}

/** The canonical sidecar path every consumer resolves to — `WE_DISPATCH_PAUSE_FILE` override wins, else
 *  script-location (tests + an out-of-tree checkout point at their own copy). */
export function resolvePauseStorePath() {
  const env = process.env.WE_DISPATCH_PAUSE_FILE;
  return env && env.trim() ? env.trim() : pauseStorePath();
}

/** Read + parse the marker → the normalized state. FAILS OPEN: a missing OR corrupt file reads as
 *  {@link emptyPauseState} (not paused) — never throws. */
export function readPauseState(path = resolvePauseStorePath()) {
  try {
    if (!existsSync(path)) return emptyPauseState();
    return parsePauseState(readFileSync(path, 'utf8'));
  } catch {
    return emptyPauseState();
  }
}

/** Is dispatch currently paused? The single predicate `dispatch-plan.mjs` / `tick-core.mjs` consult. Fails OPEN
 *  (see {@link readPauseState}) — an unreadable marker is never mistaken for an active pause. */
export function isDispatchPaused(path = resolvePauseStorePath()) {
  return readPauseState(path).paused === true;
}

/** Write the marker, ATOMICALLY (temp + rename), so a mid-write reader never sees partial JSON. */
export function writePauseState(state, path = resolvePauseStorePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializePauseState(state));
  renameSync(tmp, path);
}

// ── CLI (runs only when invoked directly) ─────────────────────────────────────────────────────────────────────

/** Hand-rolled `--k=v` / `--flag` parsing (+ positional subcommand). */
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

function runCli(argv) {
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));
  const path = resolvePauseStorePath();

  if (cmd === 'set' || cmd === 'pause') {
    const state = setPause({ reason: flags.reason, by: flags.by || process.env.USER || null });
    writePauseState(state, path);
    process.stderr.write(`⏸ dispatch PAUSED — ${state.reason}${state.by ? ` (by ${state.by})` : ''}\n`);
    writeAllSync(1, JSON.stringify(state, null, 2) + '\n');
    return;
  }
  if (cmd === 'clear' || cmd === 'unpause' || cmd === 'resume') {
    writePauseState(clearPause(), path);
    process.stderr.write('▶ dispatch RESUMED — pause cleared\n');
    writeAllSync(1, JSON.stringify({ paused: false }, null, 2) + '\n');
    return;
  }
  if (cmd === 'status') {
    const state = readPauseState(path);
    writeAllSync(1, JSON.stringify(state, null, 2) + '\n');
    return;
  }
  process.stderr.write('usage: dispatch-pause.mjs <set|clear|status> [--reason=<text>] [--by=<who>]\n');
  process.exit(2);
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) runCli(process.argv.slice(2));
