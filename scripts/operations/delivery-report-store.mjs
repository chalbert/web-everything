/**
 * @file scripts/operations/delivery-report-store.mjs
 * @description PROTOTYPE (#3627 design) — THE THIN IO SHELL over {@link ./delivery-report-record.mjs}. Same
 * split, same sidecar family, and same "resolved by SCRIPT LOCATION, never CWD" reasoning as
 * `we:scripts/operations/completion-store.mjs` — a report written from a lane clone and read from the
 * wrapper's own process (a different cwd entirely) must resolve to the SAME sidecar.
 *
 * NOT WIRED IN — see `delivery-report-record.mjs`'s header.
 *
 * WHERE REPORTS LIVE. `we:.operations/delivery-reports/<session>.json` — a sibling of
 * `we:.operations/completions/`, same gitignored family, same clause-1 reasoning
 * ([#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)):
 * a dispatched agent's own outcome is transient session state, not durable repo readiness.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  assertDeliveryReport,
  isValidDeliverySessionSlug,
  parseDeliveryReport,
  serializeDeliveryReport,
} from './delivery-report-record.mjs';

export {
  DELIVERY_OUTCOMES,
  DELIVERY_REPORT_VERSION,
  DELIVERY_REPORT_STATUSES,
  LEARNING_KINDS,
  applyDeliveryUpdate,
  assertDeliveryReport,
  isValidDeliverySessionSlug,
  newDeliveryReport,
  parseDeliveryReport,
  serializeDeliveryReport,
  validateDeliveryReport,
  validateLearning,
} from './delivery-report-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DELIVERY_REPORTS_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/delivery-reports` — the sidecar directory. */
export function deliveryReportsDir(root = DELIVERY_REPORTS_ROOT) {
  return join(root, '.operations', 'delivery-reports');
}

/** The canonical directory every consumer resolves to; `OPERATION_DELIVERY_REPORTS_DIR` wins when set. */
export function resolveDeliveryReportsDir() {
  const env = process.env.OPERATION_DELIVERY_REPORTS_DIR;
  return env && env.trim() ? resolve(env.trim()) : deliveryReportsDir();
}

/** The on-disk path of one session's delivery report. Refuses a slug that is not filename-safe. */
export function deliveryReportPath(session, dir = resolveDeliveryReportsDir()) {
  if (!isValidDeliverySessionSlug(session)) throw new TypeError(`operations: invalid delivery-report session slug ${JSON.stringify(session)}`);
  return join(dir, `${session}.json`);
}

/**
 * Read a delivery report. Returns `null` ONLY when the file genuinely does not exist. THROWS on a corrupt
 * record — mirrors `completion-store.mjs#tryReadCompletion`'s refuse-don't-silently-drop discipline: the
 * wrapper must never mistake a torn report for "the agent never reported anything".
 * @returns {object|null}
 */
export function tryReadDeliveryReport(session, dir = resolveDeliveryReportsDir()) {
  const path = deliveryReportPath(session, dir);
  if (!existsSync(path)) return null;
  const parsed = parseDeliveryReport(readFileSync(path, 'utf8'));
  if (!parsed.ok) {
    throw new Error(
      `operations: refusing to read delivery report for ${session} — ${parsed.reason} (${path}). ` +
      'Fix or delete the file; a corrupt report is never treated as one that was never written.',
    );
  }
  return parsed.record;
}

/** {@link tryReadDeliveryReport}, but a missing record is a refusal too. */
export function readDeliveryReport(session, dir = resolveDeliveryReportsDir()) {
  const record = tryReadDeliveryReport(session, dir);
  if (!record) throw new Error(`operations: no delivery report for ${JSON.stringify(session)} at ${deliveryReportPath(session, dir)}`);
  return record;
}

/** Persist a delivery report. ATOMIC (temp file + rename), so a reader mid-write never sees partial JSON. */
export function writeDeliveryReport(record, dir = resolveDeliveryReportsDir()) {
  assertDeliveryReport(record, 'delivery report being written');
  const path = deliveryReportPath(record.session, dir);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeDeliveryReport(record));
  renameSync(tmp, path);
  return path;
}

/** Every session slug with a delivery report on disk (sorted). Temp files and stray names are ignored. */
export function listDeliveryReportSessions(dir = resolveDeliveryReportsDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .filter(isValidDeliverySessionSlug)
    .sort();
}

/** Delete a session's delivery report. A no-op when it is already gone. */
export function deleteDeliveryReport(session, dir = resolveDeliveryReportsDir()) {
  rmSync(deliveryReportPath(session, dir), { force: true });
}

/** THE STORE HANDLE — mirrors `completion-store.mjs#createFileCompletionStore`'s four methods. */
export function createFileDeliveryReportStore(dir = resolveDeliveryReportsDir()) {
  return {
    read: (session) => tryReadDeliveryReport(session, dir),
    write: (record) => { writeDeliveryReport(record, dir); return record; },
    delete: (session) => deleteDeliveryReport(session, dir),
    list: () => listDeliveryReportSessions(dir),
  };
}
