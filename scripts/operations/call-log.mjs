/**
 * @file scripts/operations/call-log.mjs
 * @description THE CALL LOG — the lightweight, access-log-shaped call-visibility signal for every operation
 * call, regardless of step kind (#3451, fork 2 of #3427).
 *
 * WHAT ONE LINE IS, AND IS NOT. `{ operation, timestamp, callerKind, outcome }` — enough to say an operation
 * was CALLED, by what transport, and whether it succeeded, at a glance. It is deliberately NOT a run record:
 * it carries no cursor, no findings, no verdict, nothing a caller could resume from. A `compute`-only call
 * (`gate-health`, `suggest-next`, `verify`, `pr-status`) never gets a run record at all — {@link
 * ./run-store.mjs}'s header explains why: "a record per page-load is landfill" — so without this file every
 * one of those calls left zero trace of having happened. This is the access-log half of the access-log /
 * application-data split #3427's ruling draws; the run store stays reserved for resumable multi-step runs.
 *
 * WHY A SEPARATE FILE FROM {@link ./run-record.mjs}. Same pure-core / io-shell discipline, split across the
 * same two files (this one, and {@link ./call-log-store.mjs}) — but a DIFFERENT schema on purpose. A run
 * record is keyed by `run + step` and is read back to resume a suspended run; no line in this log is ever
 * read back for that. Folding the two into one schema would let a reader mistake one for the other.
 *
 * PURE. No fs, no clock, no process, no randomness, no network.
 */

/** The transport a call arrived through. */
export const CALLER_KINDS = Object.freeze(['cli', 'http']);

/** Whether a call ended ok or not — a coarse split; {@link digestFromOutcome}'s `digest` carries the detail. */
export const OUTCOME_STATUSES = Object.freeze(['ok', 'error']);

/**
 * The bound on `outcome.digest` (#3451's Done-when #1(b)) — a compact summary, not the operation's full
 * result. `--json`'s `outcomePayload` can carry a whole verdict/findings tree; a call-log line never does.
 */
export const MAX_DIGEST_LENGTH = 200;

/** `stopped` values a `driveRun`/`runReadOnly` outcome may settle at that count as a SUCCESSFUL call — the
 *  same set {@link ./cli-adapter.mjs#renderOutcome} exits `0` on and {@link ./http-adapter.mjs} answers 2xx
 *  on: a suspend is the run doing exactly what it was asked, not a failure. */
const OK_STOPS = new Set(['complete', 'confirm', 'effect-in-flight']);

/** @param {*} v @returns {boolean} */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Truncate `text` to at most `max` characters, marking the cut with a trailing `…` so a reader can tell a
 *  summary was shortened from one that just happens to be short. */
export function truncateDigest(text, max = MAX_DIGEST_LENGTH) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * DERIVE a compact digest from a call's outcome. PURE, and deliberately not a fork of the record: the exact
 * summarization rule is implementation detail (#3451's spec says so explicitly), only the bound is a contract.
 *
 * Reads the same fields {@link ./cli-adapter.mjs#outcomePayload} exposes over `--json` — `stopped`, `error`,
 * `pending`, `verdict` — without requiring the caller to build a whole payload just to log a call.
 *
 * @param {{stopped?: string, error?: (Error|string|null), pending?: (object|null), verdict?: *}} [source]
 * @returns {string}
 */
export function digestFromOutcome({ stopped = null, error = null, pending = null, verdict = null } = {}) {
  const parts = [];
  if (stopped) parts.push(`stopped=${stopped}`);
  const errorText = error == null ? null : String(error.message ?? error);
  if (errorText) {
    parts.push(`error=${errorText}`);
  } else if (pending?.step) {
    parts.push(`pending=${pending.step}`);
  } else if (verdict !== undefined && verdict !== null) {
    parts.push(`verdict=${truncateDigest(JSON.stringify(verdict), 120)}`);
  }
  if (!parts.length) parts.push('ok');
  return truncateDigest(parts.join(' '));
}

/**
 * `outcome.status` for a call — `error` whenever an error rode the outcome, `ok` for a `stopped` this repo
 * already treats as a successful stop (see {@link OK_STOPS}), `error` for anything else (a `stuck` drive, a
 * `step-refused` stop, an argv/route refusal reported as `stopped: 'error'` by a caller with no run to name).
 *
 * @param {{stopped?: string, error?: (Error|string|null)}} [source]
 * @returns {'ok'|'error'}
 */
export function outcomeStatus({ stopped = null, error = null } = {}) {
  if (error) return 'error';
  return OK_STOPS.has(stopped) ? 'ok' : 'error';
}

/**
 * BUILD a call line's `outcome` field from a call's settle info. PURE.
 *
 * @param {{stopped?: string, error?: (Error|string|null), pending?: (object|null), verdict?: *}} [source]
 * @returns {{status: 'ok'|'error', digest: string}}
 */
export function buildOutcome(source = {}) {
  return { status: outcomeStatus(source), digest: digestFromOutcome(source) };
}

/**
 * Structural validation of a call-log line. Used by every reader, so a malformed line is never parsed as one.
 *
 * @param {*} line
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateCallLogLine(line) {
  if (!isPlainObject(line)) return { ok: false, errors: ['a call-log line must be an object'] };
  const errors = [];
  if (typeof line.operation !== 'string' || !line.operation.trim()) errors.push('missing `operation` name');
  if (typeof line.timestamp !== 'string' || Number.isNaN(Date.parse(line.timestamp))) {
    errors.push(`\`timestamp\` must be a parseable ISO 8601 string — got ${JSON.stringify(line.timestamp)}`);
  }
  if (!CALLER_KINDS.includes(line.callerKind)) {
    errors.push(`\`callerKind\` must be one of ${CALLER_KINDS.join('|')} — got ${JSON.stringify(line.callerKind)}`);
  }
  if (!isPlainObject(line.outcome)) {
    errors.push('`outcome` must be an object');
  } else {
    if (!OUTCOME_STATUSES.includes(line.outcome.status)) {
      errors.push(`\`outcome.status\` must be one of ${OUTCOME_STATUSES.join('|')} — got ${JSON.stringify(line.outcome.status)}`);
    }
    if (typeof line.outcome.digest !== 'string') {
      errors.push('`outcome.digest` must be a string');
    } else if (line.outcome.digest.length > MAX_DIGEST_LENGTH) {
      errors.push(`\`outcome.digest\` exceeds ${MAX_DIGEST_LENGTH} chars`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** {@link validateCallLogLine} as an assertion. Throws carrying EVERY error, not just the first. */
export function assertCallLogLine(line, context = 'call-log line') {
  const { ok, errors } = validateCallLogLine(line);
  if (!ok) throw new Error(`operations: ${context} is invalid — ${errors.join('; ')}`);
  return line;
}

/**
 * A fresh, validated call-log line. Frozen, like {@link ./run-record.mjs#newRunRecord}'s record — a line is
 * a fact about a call that already happened; nothing mutates it after construction.
 *
 * @param {object} spec
 * @param {string} spec.operation - the declared operation's name.
 * @param {string} spec.timestamp - ISO 8601.
 * @param {'cli'|'http'} spec.callerKind
 * @param {{status: 'ok'|'error', digest: string}} spec.outcome
 * @returns {object} a new, frozen call-log line.
 */
export function newCallLogLine({ operation, timestamp, callerKind, outcome } = {}) {
  const line = {
    operation: typeof operation === 'string' ? operation.trim() : operation,
    timestamp,
    callerKind,
    outcome: isPlainObject(outcome) ? { status: outcome.status, digest: outcome.digest } : outcome,
  };
  assertCallLogLine(line, 'a new call-log line');
  return Object.freeze({ ...line, outcome: Object.freeze({ ...line.outcome }) });
}

/** Serialize a call-log line to its on-disk text — one JSON object per line (JSONL), no pretty-print. */
export function serializeCallLogLine(line) {
  return `${JSON.stringify(line)}\n`;
}

/**
 * Parse call-log line text. NEVER throws.
 *
 * TOLERANT, UNLIKE {@link ./run-record.mjs#parseRunRecord} — deliberately. A run record read as "absent"
 * would restart work whose effects may already be half-applied, so that parser refuses a corrupt record. A
 * call-log line is an access-log fact with nothing to resume; a torn line is dropped by the reader, not
 * escalated (see {@link ./call-log-store.mjs#readCallLog}), so parsing here reports corruption but never
 * throws for the reader to catch.
 *
 * @param {string|null|undefined} text
 * @returns {{ok: true, line: object} | {ok: false, corrupt: true, reason: string}}
 */
export function parseCallLogLine(text) {
  if (text == null || !String(text).trim()) {
    return { ok: false, corrupt: true, reason: 'the call-log line is empty' };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, corrupt: true, reason: `the call-log line is not parseable JSON (${e.message})` };
  }
  const { ok, errors } = validateCallLogLine(parsed);
  if (!ok) return { ok: false, corrupt: true, reason: errors.join('; ') };
  return { ok: true, line: parsed };
}
