/**
 * @file scripts/operations/run-store.mjs
 * @description THE THIN IO SHELL over {@link ./run-record.mjs} (#3032, under epic #3029).
 *
 * The pure core — what a run record IS, how it validates, parses and serializes — lives next door in
 * `run-record.mjs` and is re-exported here so a caller has one import. This file adds only the boundary:
 * where the record lives on disk, and how it is read, written, listed and deleted.
 *
 * WHERE RUNS LIVE, AND WHY. A **gitignored session-local sidecar** — `we:.operations/runs/<id>.json`. That
 * is clause 1 of
 * [#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
 * (#2615/#2617): a half-finished run is transient operator/session intent, not durable repo readiness, so it
 * belongs in a sidecar the card-mutation guard does not police — never committed frontmatter. It is
 * emphatically **not** the verdict ledger (#3007); see the `run-record.mjs` header for that distinction and
 * {@link ./effect-executor.mjs} for the seam the ledger lands behind.
 *
 * PURE-CORE / IO-SHELL, the `we:scripts/conveyor/queue-store.mjs` discipline (#2613): the core injects
 * everything, the shell owns fs, and **the shell is the only thing #2626 replaces**. When that decision's
 * product trigger fires, a shared DO/D1 store implements {@link createFileRunStore}'s four methods and
 * nothing above the seam changes.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { assertRunRecord, isValidRunId, parseRunRecord, serializeRunRecord } from './run-record.mjs';

export {
  EFFECT_STATUSES,
  RUN_RECORD_VERSION,
  assertRunRecord,
  effectKey,
  isValidRunId,
  newRunRecord,
  parseRunRecord,
  serializeRunRecord,
  validateRunRecord,
} from './run-record.mjs';

// Resolved by SCRIPT LOCATION, never CWD — the same reason `queue-store.mjs` does it (#2613 review, nit 4):
// a run written from one worktree and read from another must resolve to the SAME sidecar, or a resume
// silently sees no run at all. `OPERATION_RUNS_DIR` overrides it (tests, and any out-of-tree caller).
const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/runs` — the sidecar directory. */
export function runsDir(root = RUNS_ROOT) {
  return join(root, '.operations', 'runs');
}

/** The canonical runs directory every consumer resolves to; `OPERATION_RUNS_DIR` wins when set. */
export function resolveRunsDir() {
  const env = process.env.OPERATION_RUNS_DIR;
  return env && env.trim() ? resolve(env.trim()) : runsDir();
}

/** The on-disk path of one run. Refuses an id that is not filename-safe. */
export function runPath(id, dir = resolveRunsDir()) {
  if (!isValidRunId(id)) throw new TypeError(`operations: invalid run id ${JSON.stringify(id)}`);
  return join(dir, `${id}.json`);
}

/** Mint a fresh run id. Lives in the SHELL because it reads randomness; the pure core never does. */
export function newRunId(prefix = 'run') {
  return `${prefix}-${randomUUID()}`;
}

/**
 * Read a run. Returns `null` ONLY when the file genuinely does not exist. THROWS on a corrupt record —
 * refusing is the point: a torn record must never be mistaken for a run that never began, which would
 * restart work whose effects may already be half-applied.
 * @returns {object|null}
 */
export function tryReadRun(id, dir = resolveRunsDir()) {
  const path = runPath(id, dir);
  if (!existsSync(path)) return null;
  const parsed = parseRunRecord(readFileSync(path, 'utf8'));
  if (!parsed.ok) {
    throw new Error(
      `operations: refusing to read run ${id} — ${parsed.reason} (${path}). ` +
      'Fix or delete the file; a corrupt record is never treated as a run that does not exist.',
    );
  }
  return parsed.record;
}

/** {@link tryReadRun}, but a missing run is a refusal too. Use this when the caller is about to act. */
export function readRun(id, dir = resolveRunsDir()) {
  const record = tryReadRun(id, dir);
  if (!record) throw new Error(`operations: no run record for ${JSON.stringify(id)} at ${runPath(id, dir)}`);
  return record;
}

/**
 * Persist a run. ATOMIC (temp file + rename), so a reader mid-write never sees partial JSON — which, given
 * the refusal policy above, would wedge the run rather than silently degrade.
 */
export function writeRun(record, dir = resolveRunsDir()) {
  assertRunRecord(record, 'run record being written');
  const path = runPath(record.id, dir);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeRunRecord(record));
  renameSync(tmp, path);
  return path;
}

/** Every run id currently on disk (sorted). Temp files and stray names are ignored. */
export function listRunIds(dir = resolveRunsDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .filter(isValidRunId)
    .sort();
}

/** Delete a run's record. A no-op when it is already gone. */
export function deleteRun(id, dir = resolveRunsDir()) {
  rmSync(runPath(id, dir), { force: true });
}

/**
 * THE STORE HANDLE the effect executor and every adapter take, so nothing above this line imports `fs`.
 * THIS is the #2626 swap point: a shared DO/D1-backed store implements the same four methods and no caller
 * changes.
 *
 * @param {string} [dir]
 * @returns {{read(id: string): (object|null), write(record: object): object, delete(id: string): void, list(): string[]}}
 */
export function createFileRunStore(dir = resolveRunsDir()) {
  return {
    read: (id) => tryReadRun(id, dir),
    write: (record) => { writeRun(record, dir); return record; },
    delete: (id) => deleteRun(id, dir),
    list: () => listRunIds(dir),
  };
}

/**
 * An in-memory store with the same four methods — for tests, and for a caller that wants a run to live and
 * die inside one process. It SERIALIZES on write and re-parses on read, so it catches the same shape bugs
 * the file store would instead of quietly sharing a mutable object.
 */
export function createMemoryRunStore() {
  const map = new Map();
  return {
    read: (id) => {
      const text = map.get(id);
      if (text === undefined) return null;
      const parsed = parseRunRecord(text);
      if (!parsed.ok) throw new Error(`operations: refusing to read run ${id} — ${parsed.reason}`);
      return parsed.record;
    },
    write: (record) => { assertRunRecord(record); map.set(record.id, serializeRunRecord(record)); return record; },
    delete: (id) => { map.delete(id); },
    list: () => [...map.keys()].sort(),
  };
}
