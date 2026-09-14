#!/usr/bin/env node
/**
 * @file scripts/readiness/driver-verbose.mjs
 * @description LIVE-TOGGLEABLE VERBOSE MODE for the headless conveyor driver (2026-09-14, #3521 decision-trace
 *   v1, follow-up). The default per-tick decision trace (`buildDecisionTrace` in `tick-core.mjs`) is
 *   deliberately terse — one line per dispatch/skip/stall. Diagnosing #3521/lane-2 needed MORE than that one
 *   line at least once; re-running the whole driver with a code change to get it would have cost another
 *   85-minute cycle. This lever lets a human or another agent flip a currently-RUNNING driver into verbose mode
 *   without restarting it — the tick loop re-reads this marker every tick (tick granularity is the natural
 *   checkpoint; no mid-tick signaling exists or is needed).
 *
 * SHAPE — mirrors `dispatch-pause.mjs`'s marker exactly (single-holder advisory state, SET/CLEAR/STATUS verbs,
 * script-location path resolution, atomic temp+rename write, FAILS OPEN on any read error). The one addition is
 * `ticksRemaining`: an optional bounded window (`--ticks=N`) so a human can say "be loud for the next 5 ticks"
 * and have it self-clear, rather than forgetting a verbose flag on forever. `ticksRemaining: null` means
 * indefinite (on until an explicit `off`). The IO shell's OWN read (`readAndAdvanceVerboseState`) is what
 * decrements it — see that function's header for why that is the right place to own the countdown.
 *
 * PURE-CORE / IO-SHELL SPLIT: {@link emptyVerboseState} / {@link parseVerboseState} / {@link setVerboseState} /
 * {@link clearVerboseState} / {@link serializeVerboseState} / {@link advanceVerboseTicks} are PURE (no fs/clock
 * beyond an injected `now`). The fs helpers + the `on` / `off` / `status` CLI own the boundary.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeAllSync } from '../lib/write-all-sync.mjs';

// ── PURE CORE (no fs / clock — every input injected) ────────────────────────────────────────────────────────

/** A fresh, NOT-verbose state — the read for "no file yet" and every fail-open path. */
export function emptyVerboseState() {
  return { verbose: false, ticksRemaining: null, reason: null, by: null, at: null };
}

/**
 * Tolerant parse of `.conveyor/driver-verbose.json` text → normalized state. NEVER throws — a missing/corrupt
 * marker FAILS OPEN to {@link emptyVerboseState} (not verbose), the same direction every other `.conveyor/`
 * marker in this repo degrades in.
 * @param {string|null|undefined} text
 */
export function parseVerboseState(text) {
  if (!text || !String(text).trim()) return emptyVerboseState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyVerboseState(); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyVerboseState();
  const tr = raw.ticksRemaining;
  return {
    verbose: raw.verbose === true,
    ticksRemaining: Number.isInteger(tr) && tr >= 0 ? tr : null,
    reason: raw.reason != null ? String(raw.reason) : null,
    by: raw.by != null ? String(raw.by) : null,
    at: raw.at != null ? String(raw.at) : null,
  };
}

/**
 * Turn verbose ON. `ticks` (a positive integer) bounds it to that many tick-reads before auto-clearing;
 * omitted/non-positive ⇒ indefinite (`ticksRemaining: null`), cleared only by an explicit `off`.
 * @param {{ticks?:(number|null), reason?:(string|null), by?:(string|null)}} [o]
 * @param {number} [now] epoch ms — injected so this stays directly unit-testable.
 */
export function setVerboseState({ ticks = null, reason = null, by = null } = {}, now = Date.now()) {
  return {
    verbose: true,
    ticksRemaining: Number.isInteger(ticks) && ticks > 0 ? ticks : null,
    reason: reason != null && String(reason).trim() ? String(reason).trim() : 'operator requested verbose driver output',
    by: by != null && String(by).trim() ? String(by).trim() : null,
    at: new Date(now).toISOString(),
  };
}

/** Turn verbose OFF — back to {@link emptyVerboseState}. Idempotent. */
export function clearVerboseState() {
  return emptyVerboseState();
}

/** Serialize a state object back to `driver-verbose.json` text. */
export function serializeVerboseState(state) {
  const s = state && typeof state === 'object' ? state : emptyVerboseState();
  return JSON.stringify(
    { verbose: s.verbose === true, ticksRemaining: s.ticksRemaining ?? null, reason: s.reason ?? null, by: s.by ?? null, at: s.at ?? null },
    null, 2,
  ) + '\n';
}

/**
 * Advance a verbose state by ONE tick-read (the countdown half of a bounded `--ticks=N` window). PURE — the
 * caller (the tick-core IO shell) reads the marker, calls this, and writes the result back ONLY if it changed.
 *   • `ticksRemaining: null` (indefinite) or `verbose: false` (already off) → UNCHANGED, verbose stays as-is.
 *   • `ticksRemaining > 1` → decrement by one, stays verbose.
 *   • `ticksRemaining <= 1` → THIS read is the last verbose one; the state returned auto-clears to
 *     {@link emptyVerboseState} for every read AFTER this one, but `usedThisTick: true` tells the caller THIS
 *     tick still ran verbose (the window is inclusive of its last tick, not off-by-one short).
 * @param {object} state  the current parsed state.
 * @returns {{next:object, usedThisTick:boolean}}
 */
export function advanceVerboseTicks(state) {
  const s = state && typeof state === 'object' ? state : emptyVerboseState();
  if (!s.verbose) return { next: s, usedThisTick: false };
  if (s.ticksRemaining == null) return { next: s, usedThisTick: true }; // indefinite — no countdown
  if (s.ticksRemaining <= 1) return { next: emptyVerboseState(), usedThisTick: true }; // last verbose tick
  return { next: { ...s, ticksRemaining: s.ticksRemaining - 1 }, usedThisTick: true };
}

// ── THIN FS/IO SHELL (the boundary — used by tick-core.mjs) ─────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
export const VERBOSE_ROOT = resolve(HERE, '..', '..');

export function verboseStorePath(root = VERBOSE_ROOT) {
  return join(root, '.conveyor', 'driver-verbose.json');
}

/** `WE_DRIVER_VERBOSE_FILE` override wins, else script-location (mirrors `dispatch-pause.mjs`). */
export function resolveVerboseStorePath() {
  const env = process.env.WE_DRIVER_VERBOSE_FILE;
  return env && env.trim() ? env.trim() : verboseStorePath();
}

/** Read + parse the marker → the normalized state. FAILS OPEN on any error (see {@link parseVerboseState}). */
export function readVerboseState(path = resolveVerboseStorePath()) {
  try {
    if (!existsSync(path)) return emptyVerboseState();
    return parseVerboseState(readFileSync(path, 'utf8'));
  } catch {
    return emptyVerboseState();
  }
}

/** Write the marker, ATOMICALLY (temp + rename). */
export function writeVerboseState(state, path = resolveVerboseStorePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeVerboseState(state));
  renameSync(tmp, path);
}

/**
 * The ONE call tick-core.mjs's IO shell makes each tick: read the marker, advance its countdown, persist the
 * advanced state back (only a REAL change triggers a write — a steady "off" or "indefinite" read stays a pure
 * read, no needless write every tick), and report whether THIS tick should run verbose. Owning the countdown
 * HERE (not in the CLI) is deliberate: a bounded `--ticks=N` window counts down in REAL ticks of whichever
 * process is actually reading it (the one resident driver), not in some separate clock that could drift from
 * how many ticks actually ran.
 * @param {string} [path]
 * @returns {boolean} verbose for THIS tick.
 */
export function readAndAdvanceVerboseState(path = resolveVerboseStorePath()) {
  const state = readVerboseState(path);
  const { next, usedThisTick } = advanceVerboseTicks(state);
  if (JSON.stringify(next) !== JSON.stringify(state)) {
    try { writeVerboseState(next, path); } catch { /* best-effort — a failed countdown write never blocks the tick */ }
  }
  return usedThisTick;
}

// ── CLI (runs only when invoked directly) ───────────────────────────────────────────────────────────────────

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
  const path = resolveVerboseStorePath();

  if (cmd === 'on') {
    const ticks = flags.ticks != null ? Number.parseInt(flags.ticks, 10) : null;
    const state = setVerboseState({ ticks, reason: flags.reason, by: flags.by || process.env.USER || null });
    writeVerboseState(state, path);
    process.stderr.write(`🔊 driver verbose ON${state.ticksRemaining != null ? ` for ${state.ticksRemaining} tick(s)` : ' (indefinite)'}${state.by ? ` (by ${state.by})` : ''}\n`);
    writeAllSync(1, JSON.stringify(state, null, 2) + '\n');
    return;
  }
  if (cmd === 'off') {
    writeVerboseState(clearVerboseState(), path);
    process.stderr.write('🔈 driver verbose OFF\n');
    writeAllSync(1, JSON.stringify({ verbose: false }, null, 2) + '\n');
    return;
  }
  if (cmd === 'status') {
    writeAllSync(1, JSON.stringify(readVerboseState(path), null, 2) + '\n');
    return;
  }
  process.stderr.write('usage: driver-verbose.mjs <on|off|status> [--ticks=<N>] [--reason=<text>] [--by=<who>]\n');
  process.exit(2);
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) runCli(process.argv.slice(2));
