/**
 * @file scripts/operations/run-record.mjs
 * @description THE RUN RECORD — the pure half of the run store (#3032, under epic #3029).
 *
 * WHAT A RUN RECORD IS. `{ id, op, input, cursor, findings, verdict, effects }` — the machine's working
 * state for ONE execution of one declared operation — plus `pending` (what the run is waiting on) and `v`
 * (the schema version). It is what lets a run **cross surfaces**: the state lives on the record, not in the
 * caller, so a run started on the command line can be finished in the console, or in a process that never
 * saw the first half (see `__tests__/run-crosses-processes.test.mjs`).
 *
 * THE RUN RECORD IS **NOT** THE VERDICT LEDGER. The ledger (#3007, still **open** — not built here) is
 * append-only JSONL keyed by PR + diff content-hash, single-writer via the drain lease, and is the durable
 * **merge authority**. The run record is none of those: it has a cursor, it is session-local, and it dies
 * when the run is done. They sit on opposite sides of
 * [#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
 * — clause 1 (transient intent → session-local sidecar) versus clause 2 (durable readiness → committed
 * upstream). The relationship is **producer → store**: a run's ledger-shaped effect WRITES to the ledger
 * through a sink that neither this file nor {@link ./effect-executor.mjs} owns.
 *
 * WHY THIS IS A SEPARATE FILE FROM {@link ./run-store.mjs}. It is the same pure-core / io-shell discipline
 * `we:scripts/conveyor/queue-store.mjs` (#2613) uses, just split across two files instead of two halves of
 * one. The split is deliberate: it makes the engine's purity **mechanically provable** — `engine.mjs`,
 * `registry.mjs`, `step-kinds.mjs` and this file import NOTHING from `node:`, and a test asserts exactly
 * that over the whole graph. Keeping the fs shell in the same module would have put `node:fs` in the
 * engine's import graph and reduced "the engine touches no disk" to a claim in a comment.
 *
 * PURE. No fs, no clock, no process, no randomness, no network.
 */

/** Schema version stamped on every record. A reader refuses a version it does not know. */
export const RUN_RECORD_VERSION = 1;

/** The lifecycle of one declared effect inside a run record. See {@link ./effect-executor.mjs}. */
export const EFFECT_STATUSES = Object.freeze(['declared', 'pending', 'applied', 'failed']);

/** Ids are used as filenames, so the character set is closed — no separators, no traversal, no surprises. */
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** @param {*} v @returns {boolean} */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Is `id` usable as a run id (and therefore as a filename)? */
export function isValidRunId(id) {
  return typeof id === 'string' && RUN_ID_RE.test(id) && id !== '.' && id !== '..';
}

/**
 * A fresh run record. The id is INJECTED (the io shell's `newRunId` mints one) and the input is expected to
 * have been validated against the declaration already — `startRun` in {@link ./engine.mjs} does both.
 *
 * @param {object} spec
 * @param {string} spec.id
 * @param {string} spec.op - the declared operation's name.
 * @param {object} [spec.input]
 * @returns {object} a new run record.
 */
export function newRunRecord({ id, op, input = {} } = {}) {
  if (!isValidRunId(id)) throw new TypeError(`operations: invalid run id ${JSON.stringify(id)}`);
  if (typeof op !== 'string' || !op.trim()) throw new TypeError('operations: a run record needs an operation name');
  if (!isPlainObject(input)) throw new TypeError('operations: a run record `input` must be an object');
  return {
    v: RUN_RECORD_VERSION,
    id,
    op: op.trim(),
    input: { ...input },
    cursor: 0,
    findings: {},
    verdict: null,
    effects: [],
    telemetry: [],
    pending: null,
  };
}

/**
 * THE METERED FIELDS of one juror spawn, and NOTHING ELSE. See {@link normalizeJudgeTelemetry}.
 * `usage` is handled separately (it is an object of counters, not a scalar).
 */
const TELEMETRY_NUMBERS = Object.freeze(['costUsd', 'durationMs', 'wallMs', 'numTurns', 'loadedContextTokens']);
const TELEMETRY_STRINGS = Object.freeze(['sessionId', 'stopReason', 'lens', 'model', 'effort']);

/**
 * NORMALIZE one juror spawn's telemetry into a run-record row. PURE.
 *
 * WHY A WHITELIST AND NOT A SPREAD. The row is supplied by the ADAPTER (the engine declares the juror call and
 * never makes it — see {@link ./engine.mjs}), so its contents come from outside the pure core, and the record
 * is JSON-serialized to disk AND printed verbatim by `--json`. A spread would let a caller put the juror's
 * whole argv (which carries the mandate) or an unbounded transcript into a record that is written on every
 * `advance`. This takes the five numbers, the five names and the counter block that answer "what did that
 * juror cost", and drops everything else silently — a caller adding a field gets no error and no leak.
 *
 * `usage` is copied ONE level deep and only its numeric entries, for the same reason.
 *
 * @param {{step?: string, stepIndex?: number, telemetry?: object}} o
 * @returns {object} a frozen row: `{ step, stepIndex, …scalars, usage }`.
 */
export function normalizeJudgeTelemetry({ step = '', stepIndex = null, telemetry = {} } = {}) {
  const src = isPlainObject(telemetry) ? telemetry : {};
  const row = { step: String(step), stepIndex: Number.isInteger(stepIndex) ? stepIndex : null };
  for (const k of TELEMETRY_NUMBERS) {
    if (typeof src[k] === 'number' && Number.isFinite(src[k])) row[k] = src[k];
  }
  for (const k of TELEMETRY_STRINGS) {
    if (typeof src[k] === 'string' && src[k]) row[k] = src[k];
  }
  const usage = {};
  if (isPlainObject(src.usage)) {
    for (const [k, v] of Object.entries(src.usage)) {
      if (typeof v === 'number' && Number.isFinite(v)) usage[k] = v;
    }
  }
  row.usage = Object.freeze(usage);
  return Object.freeze(row);
}

/**
 * WHAT THIS RUN SPENT, summed over every juror it spawned. PURE.
 *
 * The answer to "what did that juror cost?" after a live run — unanswerable after #3035's FIRST live run
 * (PR #1146), because the adapter discarded everything `judgeSpawn` returned except the answer.
 *
 * @param {object} run
 * @returns {{jurors: number, costUsd: number, wallMs: number, durationMs: number}}
 */
export function totalJudgeSpend(run) {
  const rows = Array.isArray(run?.telemetry) ? run.telemetry : [];
  const sum = (k) => rows.reduce((n, r) => n + (typeof r?.[k] === 'number' ? r[k] : 0), 0);
  return { jurors: rows.length, costUsd: sum('costUsd'), wallMs: sum('wallMs'), durationMs: sum('durationMs') };
}

/**
 * Structural validation of a run record. Used by every reader and by `advance`, so a malformed record can
 * never be stepped.
 *
 * @param {*} record
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateRunRecord(record) {
  const errors = [];
  if (!isPlainObject(record)) return { ok: false, errors: ['run record must be an object'] };
  if (record.v !== RUN_RECORD_VERSION) {
    errors.push(`unsupported run record version ${JSON.stringify(record.v)} (this build reads v${RUN_RECORD_VERSION})`);
  }
  if (!isValidRunId(record.id)) errors.push(`invalid run id ${JSON.stringify(record.id)}`);
  if (typeof record.op !== 'string' || !record.op.trim()) errors.push('missing operation name');
  if (!isPlainObject(record.input)) errors.push('`input` must be an object');
  if (!Number.isInteger(record.cursor) || record.cursor < 0) errors.push('`cursor` must be a non-negative integer');
  if (!isPlainObject(record.findings)) errors.push('`findings` must be an object');
  if (!Array.isArray(record.effects)) {
    errors.push('`effects` must be an array');
  } else {
    record.effects.forEach((e, i) => {
      if (!isPlainObject(e)) { errors.push(`effects[${i}] must be an object`); return; }
      if (typeof e.key !== 'string' || !e.key) errors.push(`effects[${i}] has no key`);
      if (typeof e.type !== 'string' || !e.type) errors.push(`effects[${i}] has no type`);
      if (!Number.isInteger(e.stepIndex) || e.stepIndex < 0) errors.push(`effects[${i}] has an invalid stepIndex`);
      if (!Number.isInteger(e.index) || e.index < 0) errors.push(`effects[${i}] has an invalid index`);
      if (!EFFECT_STATUSES.includes(e.status)) {
        errors.push(`effects[${i}] has status ${JSON.stringify(e.status)}; expected one of ${EFFECT_STATUSES.join('|')}`);
      }
    });
    const keys = new Set();
    for (const e of record.effects) {
      if (isPlainObject(e) && typeof e.key === 'string') {
        if (keys.has(e.key)) errors.push(`duplicate effect key ${JSON.stringify(e.key)} — the idempotency key must be unique within a run`);
        keys.add(e.key);
      }
    }
  }
  // TOLERATED WHEN ABSENT, and deliberately not a version bump: `telemetry` was added after v1 shipped, and a
  // record written by the previous build simply has no key. Refusing those would wedge a run mid-flight (the
  // records are session-local, but a `--resume` across the upgrade is exactly the case the store exists for)
  // for a field nothing decides on. Present-but-wrong-shape IS refused — that is a live caller's bug.
  if (record.telemetry !== undefined) {
    if (!Array.isArray(record.telemetry)) errors.push('`telemetry` must be an array when present');
    else record.telemetry.forEach((t, i) => { if (!isPlainObject(t)) errors.push(`telemetry[${i}] must be an object`); });
  }
  if (record.pending !== null && !isPlainObject(record.pending)) {
    errors.push('`pending` must be null or an object');
  } else if (isPlainObject(record.pending)) {
    if (typeof record.pending.kind !== 'string') errors.push('`pending.kind` must be a string');
    if (typeof record.pending.step !== 'string') errors.push('`pending.step` must be the step name');
    if (!Number.isInteger(record.pending.stepIndex)) errors.push('`pending.stepIndex` must be an integer');
  }
  return { ok: errors.length === 0, errors };
}

/** {@link validateRunRecord} as an assertion. Throws carrying EVERY error, not just the first. */
export function assertRunRecord(record, context = 'run record') {
  const { ok, errors } = validateRunRecord(record);
  if (!ok) throw new Error(`operations: ${context} is invalid — ${errors.join('; ')}`);
  return record;
}

/**
 * Parse run-record text. NEVER throws, and NEVER degrades a corrupt record to "absent".
 *
 * FAIL-CLOSED, AND THE ONE PLACE THIS STORE DIVERGES FROM `queue-store.mjs`. `parseQueue` is tolerant by
 * design — a corrupt clear-for-build queue degrades to `[]` so a dispatch tick is never wedged, and the
 * worst cost is a missed dispatch. A corrupt RUN record is the opposite hazard: read as absent, it would
 * restart a run whose effects may already be half-applied. So a corrupt record is reported as corrupt and
 * every reader REFUSES — the `we:scripts/lib/lane-verify.mjs` precedent (#2833: a marker that exists but
 * does not parse is refused, never read as absent and failed open) applied to run state.
 *
 * @param {string|null|undefined} text
 * @returns {{ok: true, record: object} | {ok: false, corrupt: true, reason: string}}
 */
export function parseRunRecord(text) {
  if (text == null || !String(text).trim()) {
    return { ok: false, corrupt: true, reason: 'the run record is empty' };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, corrupt: true, reason: `the run record is not parseable JSON (${e.message})` };
  }
  const { ok, errors } = validateRunRecord(parsed);
  if (!ok) return { ok: false, corrupt: true, reason: errors.join('; ') };
  return { ok: true, record: parsed };
}

/**
 * THE IDEMPOTENCY KEY of one declared effect.
 *
 * The statute and #3032's card both say "keyed by run + step", and the key below is that key **plus the
 * effect's ordinal within its step** — because a single `effect` step declares a LIST. #2964's defect is
 * exactly a two-effect step (post the verdict comment, then swap the label) whose first half landed and
 * whose second did not; a step-granular key cannot tell those two apart on replay, and would either
 * re-post the comment or skip the label. The ordinal is what makes the replay of a PARTIAL failure exact.
 *
 * @param {string} runId
 * @param {number} stepIndex - the effect step's position in the declaration.
 * @param {number} index - the effect's position in that step's declared list.
 * @returns {string}
 */
export function effectKey(runId, stepIndex, index) {
  return `${runId}#${stepIndex}#${index}`;
}

/** Serialize a run record to its on-disk text (pretty JSON, newline-terminated). */
export function serializeRunRecord(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
}
