/**
 * @file scripts/operations/fix-report-store.mjs
 * @description THE THIN IO SHELL over {@link ./fix-report-record.mjs} (#xu2pp2m). Same split, same sidecar
 * family, and same "resolved by SCRIPT LOCATION, never CWD" reasoning as
 * `we:scripts/operations/delivery-report-store.mjs`/`we:scripts/operations/completion-store.mjs` — a report
 * written from a lane clone and read from the wrapper's own process (a different cwd entirely) must resolve
 * to the SAME sidecar.
 *
 * WHERE REPORTS LIVE. `we:.operations/fix-reports/<session>.json` — a sibling of
 * `we:.operations/delivery-reports/`/`we:.operations/completions/`, same gitignored family, same clause-1
 * reasoning
 * ([#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)):
 * a dispatched agent's own outcome is transient session state, not durable repo readiness.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  assertFixReport,
  isValidFixSessionSlug,
  parseFixReport,
  serializeFixReport,
} from './fix-report-record.mjs';

export {
  FIX_OUTCOMES,
  FIX_REPORT_VERSION,
  FIX_REPORT_STATUSES,
  LEARNING_KINDS,
  applyFixUpdate,
  assertFixReport,
  isValidFixSessionSlug,
  newFixReport,
  parseFixReport,
  serializeFixReport,
  validateFixReport,
  validateLearning,
} from './fix-report-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIX_REPORTS_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/fix-reports` — the sidecar directory. */
export function fixReportsDir(root = FIX_REPORTS_ROOT) {
  return join(root, '.operations', 'fix-reports');
}

/** The canonical directory every consumer resolves to; `OPERATION_FIX_REPORTS_DIR` wins when set — the SAME
 *  env-override-first pattern `we:scripts/operations/delivery-report-store.mjs#resolveDeliveryReportsDir`
 *  uses (#3627 bug 9): the wrapper resolves this ONCE, in its own process, and hands it down to the spawned
 *  agent's env so both processes agree on the same absolute directory despite the agent running out of a
 *  SEPARATE lane clone (its own, different `import.meta.url`-relative default would otherwise resolve to the
 *  wrong checkout entirely). */
export function resolveFixReportsDir() {
  const env = process.env.OPERATION_FIX_REPORTS_DIR;
  return env && env.trim() ? resolve(env.trim()) : fixReportsDir();
}

/** The on-disk path of one session's fix report. Refuses a slug that is not filename-safe. */
export function fixReportPath(session, dir = resolveFixReportsDir()) {
  if (!isValidFixSessionSlug(session)) throw new TypeError(`operations: invalid fix-report session slug ${JSON.stringify(session)}`);
  return join(dir, `${session}.json`);
}

/**
 * Read a fix report. Returns `null` ONLY when the file genuinely does not exist. THROWS on a corrupt record —
 * mirrors `delivery-report-store.mjs#tryReadDeliveryReport`'s refuse-don't-silently-drop discipline: the
 * wrapper must never mistake a torn report for "the agent never reported anything".
 * @returns {object|null}
 */
export function tryReadFixReport(session, dir = resolveFixReportsDir()) {
  const path = fixReportPath(session, dir);
  if (!existsSync(path)) return null;
  const parsed = parseFixReport(readFileSync(path, 'utf8'));
  if (!parsed.ok) {
    throw new Error(
      `operations: refusing to read fix report for ${session} — ${parsed.reason} (${path}). ` +
      'Fix or delete the file; a corrupt report is never treated as one that was never written.',
    );
  }
  return parsed.record;
}

/** {@link tryReadFixReport}, but a missing record is a refusal too. */
export function readFixReport(session, dir = resolveFixReportsDir()) {
  const record = tryReadFixReport(session, dir);
  if (!record) throw new Error(`operations: no fix report for ${JSON.stringify(session)} at ${fixReportPath(session, dir)}`);
  return record;
}

/** Persist a fix report. ATOMIC (temp file + rename), so a reader mid-write never sees partial JSON. */
export function writeFixReport(record, dir = resolveFixReportsDir()) {
  assertFixReport(record, 'fix report being written');
  const path = fixReportPath(record.session, dir);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeFixReport(record));
  renameSync(tmp, path);
  return path;
}

/** Every session slug with a fix report on disk (sorted). Temp files and stray names are ignored. */
export function listFixReportSessions(dir = resolveFixReportsDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .filter(isValidFixSessionSlug)
    .sort();
}

/** Delete a session's fix report. A no-op when it is already gone. */
export function deleteFixReport(session, dir = resolveFixReportsDir()) {
  rmSync(fixReportPath(session, dir), { force: true });
}

/** THE STORE HANDLE — mirrors `delivery-report-store.mjs#createFileDeliveryReportStore`'s four methods. */
export function createFileFixReportStore(dir = resolveFixReportsDir()) {
  return {
    read: (session) => tryReadFixReport(session, dir),
    write: (record) => { writeFixReport(record, dir); return record; },
    delete: (session) => deleteFixReport(session, dir),
    list: () => listFixReportSessions(dir),
  };
}
