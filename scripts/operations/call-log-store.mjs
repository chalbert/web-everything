/**
 * @file scripts/operations/call-log-store.mjs
 * @description THE THIN IO SHELL over {@link ./call-log.mjs} (#3451, fork 2 of #3427).
 *
 * The pure core — what a call-log line IS, how it validates, parses and serializes — lives next door in
 * `call-log.mjs` and is re-exported here so a caller has one import. This file adds only the boundary: where
 * the log lives on disk, and how a line is appended, read and listed.
 *
 * WHERE CALLS LIVE, AND WHY. A gitignored, DAY-ROTATED, append-only sidecar — `we:.operations/calls/<day>.jsonl`
 * — sibling to, and structurally distinct from, `we:.operations/runs/` ({@link ./run-store.mjs}). Same
 * `.gitignore` coverage (the whole `.operations/` directory), same script-location root resolution, same
 * `OPERATION_*_DIR`-style env override so tests and out-of-tree callers can redirect it — mirroring
 * `run-store.mjs`'s `resolveRunsDir`/`OPERATION_RUNS_DIR` exactly, per this item's own spec.
 *
 * NOTHING HERE IS RESUMABLE. Unlike the run store, a reader here is TOLERANT of a corrupt line (see
 * {@link readCallLog}) — this is an access log an operator might grep, not state a replay depends on.
 *
 * THE STORE HANDLE, AND WHY IT IS INJECTED. {@link createFileCallLogStore}/{@link createMemoryCallLogStore}
 * mirror `run-store.mjs`'s `createFileRunStore`/`createMemoryRunStore` shape (an `.append` method here in
 * place of `read`/`write`/`delete`/`list`, since a call log is write-mostly). The derived callers
 * ({@link ./cli-adapter.mjs}, {@link ./http-adapter.mjs}) take a `callLog` handle as an OPTIONAL injected
 * parameter — exactly like `store` — rather than importing this file directly: neither adapter module
 * imports `node:fs` anywhere else, and importing a file-backed store there would make every existing test
 * that drives `runOperationCli`/`handleOperationRequest` (there are dozens, none of which pass `callLog`
 * today) start touching real disk as an unannounced side effect. `run.mjs` wires
 * `callLog: createFileCallLogStore()` for real CLI use; a caller that omits `callLog` gets today's behaviour
 * unchanged — the adapters treat it as optional (`callLog?.append(...)`).
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { buildOutcome, newCallLogLine, parseCallLogLine, serializeCallLogLine } from './call-log.mjs';

export {
  CALLER_KINDS,
  MAX_DIGEST_LENGTH,
  OUTCOME_STATUSES,
  assertCallLogLine,
  buildOutcome,
  digestFromOutcome,
  newCallLogLine,
  outcomeStatus,
  parseCallLogLine,
  serializeCallLogLine,
  truncateDigest,
  validateCallLogLine,
} from './call-log.mjs';

// Resolved by SCRIPT LOCATION, never CWD — same reason `run-store.mjs#RUNS_ROOT` is (#2613 review, nit 4): a
// line appended from one worktree and read from another must resolve to the SAME sidecar.
const HERE = dirname(fileURLToPath(import.meta.url));
export const CALLS_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/calls` — the sidecar directory. */
export function callsDir(root = CALLS_ROOT) {
  return join(root, '.operations', 'calls');
}

/** The canonical calls directory every consumer resolves to; `OPERATION_CALLS_DIR` wins when set. */
export function resolveCallsDir() {
  const env = process.env.OPERATION_CALLS_DIR;
  return env && env.trim() ? resolve(env.trim()) : callsDir();
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The day key a timestamp rotates into, e.g. `2026-09-03`. */
export function dayKey(timestamp) {
  const key = String(timestamp ?? '').slice(0, 10);
  if (!DAY_RE.test(key)) throw new TypeError(`operations: cannot derive a call-log day key from ${JSON.stringify(timestamp)}`);
  return key;
}

/** The on-disk path of one day's call log. Refuses a day key that is not filename-safe. */
export function callLogPath(day, dir = resolveCallsDir()) {
  if (!DAY_RE.test(day)) throw new TypeError(`operations: invalid call-log day ${JSON.stringify(day)}`);
  return join(dir, `${day}.jsonl`);
}

/**
 * Append one already-built call-log line to its day's file. The line is re-validated at the door (#3451) —
 * a malformed line is refused, never appended.
 */
export function appendCallLogLine(line, dir = resolveCallsDir()) {
  const valid = newCallLogLine(line);
  mkdirSync(dir, { recursive: true });
  appendFileSync(callLogPath(dayKey(valid.timestamp), dir), serializeCallLogLine(valid));
  return valid;
}

/**
 * Read one day's call-log lines. TOLERANT: a corrupt line is skipped and counted rather than refusing the
 * whole read — contrast {@link ./run-store.mjs#tryReadRun}, which fails closed because a run record's
 * effects may be half-applied. Nothing here is ever resumed, so there is nothing a stale read could corrupt.
 *
 * @returns {{lines: object[], corrupt: number}}
 */
export function readCallLog(day, dir = resolveCallsDir()) {
  const path = callLogPath(day, dir);
  if (!existsSync(path)) return { lines: [], corrupt: 0 };
  const rows = readFileSync(path, 'utf8').split('\n').filter((row) => row.trim());
  const lines = [];
  let corrupt = 0;
  for (const row of rows) {
    const parsed = parseCallLogLine(row);
    if (parsed.ok) lines.push(parsed.line);
    else corrupt += 1;
  }
  return { lines, corrupt };
}

/** Every day currently on disk with a call log, sorted. */
export function listCallLogDays(dir = resolveCallsDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => f.slice(0, -'.jsonl'.length))
    .filter((day) => DAY_RE.test(day))
    .sort();
}

/**
 * BUILD, from `{operation, callerKind, source, timestamp}`, one call-log line, and hand it to `write`.
 * Shared by both store factories below so they cannot drift on how a line is assembled.
 */
function buildLine({ operation, callerKind, source = {}, timestamp = new Date().toISOString() }) {
  return newCallLogLine({ operation, timestamp, callerKind, outcome: buildOutcome(source) });
}

/**
 * THE FILE-BACKED STORE HANDLE — what `run.mjs` wires for real CLI use. `.append` builds and persists one
 * line; `.read`/`.days` are read helpers for an operator or a future consumer, not required by either
 * adapter.
 *
 * @param {string} [dir]
 * @returns {{append(call: object): object, read(day: string): object[], days(): string[]}}
 */
export function createFileCallLogStore(dir = resolveCallsDir()) {
  return {
    append: (call) => appendCallLogLine(buildLine(call), dir),
    read: (day) => readCallLog(day, dir).lines,
    days: () => listCallLogDays(dir),
  };
}

/**
 * AN IN-MEMORY STORE with the same shape — for tests, mirroring {@link ./run-store.mjs#createMemoryRunStore}.
 * SERIALIZES then re-parses on append, so it catches the same shape bugs the file store would.
 *
 * @returns {{append(call: object): object, read(day: string): object[], days(): string[]}}
 */
export function createMemoryCallLogStore() {
  const byDay = new Map();
  return {
    append: (call) => {
      const line = buildLine(call);
      const parsed = parseCallLogLine(serializeCallLogLine(line));
      if (!parsed.ok) throw new Error(`operations: refusing to append a call-log line — ${parsed.reason}`);
      const day = dayKey(line.timestamp);
      const rows = byDay.get(day) ?? [];
      rows.push(parsed.line);
      byDay.set(day, rows);
      return parsed.line;
    },
    read: (day) => [...(byDay.get(day) ?? [])],
    days: () => [...byDay.keys()].sort(),
  };
}
