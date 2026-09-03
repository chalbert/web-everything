/**
 * @file scripts/operations/completion-store.mjs
 * @description THE THIN IO SHELL over {@link ./completion-record.mjs} (#3436) — same split as
 * `we:scripts/operations/run-store.mjs`, re-exported here so a caller has one import.
 *
 * WHERE COMPLETIONS LIVE, AND WHY. A **gitignored session-local sidecar** — `we:.operations/completions/
 * <session>.json` — same directory family as `we:.operations/runs/`, already excluded wholesale by
 * `.gitignore`. Clause 1 of
 * [#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates):
 * a dispatched agent's own outcome is transient session state, not durable repo readiness, and belongs in a
 * sidecar the card-mutation guard never polices.
 *
 * Resolved by SCRIPT LOCATION, never CWD — same reasoning as `run-store.mjs#RUNS_ROOT` (a record written from
 * one lane clone and read from the primary checkout, or vice versa, must resolve to the SAME sidecar).
 * `OPERATION_COMPLETIONS_DIR` overrides it, for tests and any out-of-tree caller.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { assertCompletionRecord, isValidSessionSlug, parseCompletionRecord, serializeCompletionRecord } from './completion-record.mjs';

export {
  COMPLETION_KINDS,
  COMPLETION_RECORD_VERSION,
  COMPLETION_STATUSES,
  applyCompletionUpdate,
  assertCompletionRecord,
  isValidSessionSlug,
  newCompletionRecord,
  parseCompletionRecord,
  serializeCompletionRecord,
  validateCompletionRecord,
} from './completion-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const COMPLETIONS_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/completions` — the sidecar directory. */
export function completionsDir(root = COMPLETIONS_ROOT) {
  return join(root, '.operations', 'completions');
}

/** The canonical completions directory every consumer resolves to; `OPERATION_COMPLETIONS_DIR` wins when set. */
export function resolveCompletionsDir() {
  const env = process.env.OPERATION_COMPLETIONS_DIR;
  return env && env.trim() ? resolve(env.trim()) : completionsDir();
}

/** The on-disk path of one session's completion record. Refuses a slug that is not filename-safe. */
export function completionPath(session, dir = resolveCompletionsDir()) {
  if (!isValidSessionSlug(session)) throw new TypeError(`operations: invalid completion session slug ${JSON.stringify(session)}`);
  return join(dir, `${session}.json`);
}

/**
 * Read a completion record. Returns `null` ONLY when the file genuinely does not exist. THROWS on a corrupt
 * record — a torn record must never be mistaken for "nothing was ever reported" (mirrors
 * `run-store.mjs#tryReadRun`).
 * @returns {object|null}
 */
export function tryReadCompletion(session, dir = resolveCompletionsDir()) {
  const path = completionPath(session, dir);
  if (!existsSync(path)) return null;
  const parsed = parseCompletionRecord(readFileSync(path, 'utf8'));
  if (!parsed.ok) {
    throw new Error(
      `operations: refusing to read completion record for ${session} — ${parsed.reason} (${path}). ` +
      'Fix or delete the file; a corrupt record is never treated as one that was never written.',
    );
  }
  return parsed.record;
}

/** {@link tryReadCompletion}, but a missing record is a refusal too. */
export function readCompletion(session, dir = resolveCompletionsDir()) {
  const record = tryReadCompletion(session, dir);
  if (!record) throw new Error(`operations: no completion record for ${JSON.stringify(session)} at ${completionPath(session, dir)}`);
  return record;
}

/**
 * Persist a completion record. ATOMIC (temp file + rename), so a reader mid-write never sees partial JSON.
 */
export function writeCompletion(record, dir = resolveCompletionsDir()) {
  assertCompletionRecord(record, 'completion record being written');
  const path = completionPath(record.session, dir);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeCompletionRecord(record));
  renameSync(tmp, path);
  return path;
}

/** Every session slug with a completion record on disk (sorted). Temp files and stray names are ignored. */
export function listCompletionSessions(dir = resolveCompletionsDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .filter(isValidSessionSlug)
    .sort();
}

/** Delete a session's completion record. A no-op when it is already gone. */
export function deleteCompletion(session, dir = resolveCompletionsDir()) {
  rmSync(completionPath(session, dir), { force: true });
}

/**
 * THE STORE HANDLE — mirrors `run-store.mjs#createFileRunStore`'s four methods, the #2626 swap point.
 * @param {string} [dir]
 */
export function createFileCompletionStore(dir = resolveCompletionsDir()) {
  return {
    read: (session) => tryReadCompletion(session, dir),
    write: (record) => { writeCompletion(record, dir); return record; },
    delete: (session) => deleteCompletion(session, dir),
    list: () => listCompletionSessions(dir),
  };
}
