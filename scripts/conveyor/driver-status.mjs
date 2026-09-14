#!/usr/bin/env node
/**
 * @file scripts/conveyor/driver-status.mjs
 * @description "Is the driver stuck?" — a STATUS COMMAND over the headless runner's own durable, self-diagnosed
 *   state (2026-09-14, #3521/lane-2 incident). Root-causing that incident took a human manually re-deriving,
 *   by hand, how long #3521 had been held and why, because nothing outside the runner's own log surfaced it.
 *   The runner (`skills-src/conveyor/runner.mjs`) now writes two durable sidecars every tick:
 *     • `.conveyor/driver-status.json` — overwritten each tick: `{ tick, at, statusLine, stalled, dispatch }`.
 *       `stalled` is the tick core's OWN self-diagnosis (`advanceHeldStall` in `tick-core.mjs`): items held on
 *       the exact same reason for `stallTicks` (default 3) consecutive ticks running.
 *     • `.conveyor/decision-trace/<YYYY-MM-DD>.jsonl` — one line per dispatch/skip/stall decision, appended
 *       every tick (`buildDecisionTrace` in `tick-core.mjs`).
 *   This script just READS them — it recomputes nothing, invents no second notion of "stuck". Safe to run any
 *   time, from any process, whether or not a runner is currently live (a missing/stale file reads as "no
 *   runner has ticked here" rather than throwing).
 *
 * PURE-CORE / IO-SHELL SPLIT: {@link formatStatus} is pure (no fs/clock — `now` injected) so it is directly
 *   unit-testable; the `main()` CLI owns the fs reads and the real clock.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { localToday } from '../lib/local-date.mjs';

// ── PURE CORE (no fs / clock — every input is injected) ────────────────────────────────────────────────────

/**
 * Render a driver-status snapshot (+ optional recent trace lines) into the CLI's human-readable report.
 * @param {object|null} status  the parsed `driver-status.json`, or null if absent/unreadable.
 * @param {Array<object>} traceLines  the most recent decision-trace entries to show (already sliced by the caller).
 * @param {number} now  epoch ms, injected so this stays clock-free.
 * @returns {string}
 */
export function formatStatus(status, traceLines = [], now = Date.now()) {
  if (!status) {
    return 'no driver-status.json found — either no runner has ticked in this checkout yet, or it never got past its first tick.';
  }
  const ageMs = Number.isFinite(Date.parse(status.at)) ? now - Date.parse(status.at) : null;
  const ageS = ageMs != null ? Math.round(ageMs / 1000) : null;
  const lines = [];
  lines.push(`tick ${status.tick ?? '?'} · last update ${ageS != null ? `${ageS}s ago` : '(unknown age)'}`);
  lines.push(status.statusLine || '(no status line)');
  const stalled = Array.isArray(status.stalled) ? status.stalled : [];
  if (stalled.length === 0) {
    lines.push('no self-diagnosed stall — every held item cleared or changed reason within the stall window.');
  } else {
    lines.push(`🛑 ${stalled.length} self-diagnosed stall${stalled.length === 1 ? '' : 's'}:`);
    for (const s of stalled) lines.push(`  #${s.num} stuck ${s.ticks} ticks on: ${s.reason}`);
  }
  if (traceLines.length) {
    lines.push(`recent decision trace (${traceLines.length}):`);
    for (const t of traceLines) lines.push(`  [tick ${t.tick ?? '?'}] ${t.text || JSON.stringify(t)}`);
  }
  return lines.join('\n');
}

// ── IO SHELL (runs only as a CLI) ──────────────────────────────────────────────────────────────────────────

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

function readStatus(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** The last `n` lines of TODAY's decision-trace JSONL (best-effort; an absent/corrupt file yields []). */
function readRecentTrace(traceDir, n) {
  if (!n || n <= 0) return [];
  // #2747 — the trace file's day is the OPERATOR's calendar day (`localToday()`), not the runtime's UTC day:
  // a UTC-behind operator's evening ticks must land in today's file, not tomorrow's.
  const day = localToday();
  const path = join(traceDir, `${day}.jsonl`);
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-n).map((l) => {
      try { return JSON.parse(l); } catch { return { text: l }; }
    });
  } catch {
    return [];
  }
}

function main(argv) {
  const flags = parseFlags(argv);
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(HERE, '..', '..');
  const STATUS_PATH = join(REPO_ROOT, '.conveyor', 'driver-status.json');
  const TRACE_DIR = join(REPO_ROOT, '.conveyor', 'decision-trace');

  const status = readStatus(STATUS_PATH);
  const traceN = flags.trace === true ? 10 : Number.parseInt(flags.trace, 10) || 0;
  const traceLines = readRecentTrace(TRACE_DIR, traceN);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ status, trace: traceLines }, null, 2) + '\n');
    return;
  }
  log(formatStatus(status, traceLines));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
