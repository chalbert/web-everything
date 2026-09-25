/**
 * @file scripts/operations/fix-report-record.mjs
 * @description THE FIX REPORT RECORD (#xu2pp2m, downstream of #3627's `delivery-report-record.mjs`) — the
 * pure half of a schema-constrained completion contract for a MINIMAL fix agent
 * (`we:skills-src/conveyor/fix-agent-brief-v2.md`, `we:scripts/operations/fix-dispatch-wrapper.mjs`). SAME
 * two-phase `started` → `done` write discipline `we:scripts/operations/delivery-report-record.mjs` already
 * proves (which itself mirrors `we:scripts/operations/completion-record.mjs`'s #3436 discipline for
 * review/fix dispatch), scoped to what a FIX agent actually needs to say.
 *
 * WHY A SEPARATE SCHEMA, NOT A REUSE OF `delivery-report-record.mjs`. A build delivery agent answers "did you
 * finish the spec, and if not, why" (`outcome: done|blocked|needs-human-judgment`, keyed by `item`). A fix
 * agent answers a DIFFERENT question — "did you repair the reviewer's finding, and if not, why" — keyed by
 * the PR it is repairing (a fix always targets an existing, already-open PR; a delivery report never has a
 * PR at all), with an outcome vocabulary the design card (`we:backlog/3629-*.md`, ratified by the operator)
 * names explicitly: `fixed` / `blocked` / `escalated-needs-judgment` / `escalated-conflict` — narrower than
 * `delivery-report-record.mjs`'s three, because a repair's two most common failure shapes (an ambiguous
 * finding, a same-line conflict with `main`) are common and specific enough in the CURRENT, full-context
 * `we:skills-src/conveyor/fix-agent-brief.md` (its own §2/§3 exits) to deserve their own named outcome rather
 * than folding both into one generic `blocked`, mirroring that same file's own real shape rather than
 * inventing a new taxonomy. `blocked` still exists as the catch-all for a reason neither of those two names —
 * the fix-agent analogue of the delivery report's own `blocked`.
 *
 * THE FOUR OUTCOMES A MINIMAL FIX AGENT CAN REPORT:
 *   - `fixed`                     — the reviewer's finding is repaired, the lane has a commit. The WRAPPER
 *                                    (not the agent) takes it from here: run the gate, drive ONE converge
 *                                    pass (mirrors `deliverItem` step 4 — replaces the OLD, full-context
 *                                    brief's own step-5 agent-initiated adversarial self-review subagent, per
 *                                    the ratified design: self-review moves OUT of the fixer's own dispatched
 *                                    turn, the same move #3627 already made for build), re-push HEAD to the
 *                                    PR's existing `lane/*` ref, and re-arm the review
 *                                    (`we:scripts/conveyor/rearm-review.mjs`).
 *   - `blocked`                   — the agent could not proceed, for a reason that is not specifically an
 *                                    ambiguous finding or a conflict (the two narrower outcomes below) — e.g.
 *                                    the finding turned out to already be moot, or a runtime dependency is
 *                                    unavailable. The wrapper records a stand-down
 *                                    (`we:scripts/conveyor/stand-down.mjs`) and leaves the PR exactly as the
 *                                    reviewer left it.
 *   - `escalated-needs-judgment`  — the reviewer's finding needs a judgment the agent could not safely make
 *                                    (mirrors the CURRENT brief's §2 exit). `reason` MUST name the specific
 *                                    call, not hedge — same discipline `validateDeliveryReport` already
 *                                    enforces for `needs-human-judgment`.
 *   - `escalated-conflict`        — a genuine same-line conflict with `main` blocked the repair (mirrors the
 *                                    CURRENT brief's §3 exit).
 * The agent never reasons about `review:changes` vs `review:pending`, `rearm-review.mjs`/`stand-down.mjs`
 * mechanics, or gate/converge orchestration — those are the WRAPPER's job, driven off this outcome, exactly
 * as `deliver-item-wrapper.mjs` already does for `delivery-report-record.mjs`'s three.
 *
 * PURE. No fs, no clock (injectable), no process, no network — same discipline as
 * `delivery-report-record.mjs`/`completion-record.mjs`.
 */

/** Schema version stamped on every record. A reader refuses a version it does not know. */
export const FIX_REPORT_VERSION = 1;

/** The two states a record moves through, same two-phase write as `delivery-report-record.mjs`/`completion-record.mjs`. */
export const FIX_REPORT_STATUSES = Object.freeze(['started', 'done']);

/** The ONLY four outcomes a minimal fix agent may report — see the file header for what each means. */
export const FIX_OUTCOMES = Object.freeze(['fixed', 'blocked', 'escalated-needs-judgment', 'escalated-conflict']);

/** The `learning` sub-shape mirrors `delivery-report-record.mjs`'s own — reusing its `kind` enum rather than
 *  inventing a second one. The agent hands this to the WRAPPER; it never shells `learnings-drop.mjs` itself. */
export const LEARNING_KINDS = Object.freeze(['friction', 'missing-convention', 'doc-gap', 'skill-gap', 'improvement']);

/** Session slugs are used as filenames, so the character set is closed — no separators, no traversal. */
const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** @param {*} v @returns {boolean} */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Is `session` usable as a fix-report session slug (and therefore as a filename)? */
export function isValidFixSessionSlug(session) {
  return typeof session === 'string' && SESSION_RE.test(session);
}

/** A short optional string field, or `null`. */
function isOptionalString(v) {
  return v === null || v === undefined || typeof v === 'string';
}

/** A `filesTouched` value: `null`, or an array of non-empty strings (repo-relative paths). */
function isOptionalStringArray(v) {
  if (v === null || v === undefined) return true;
  return Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '');
}

/** Validate the optional `learning` sub-object. `null` is always valid — a fix agent with no generalizable
 *  friction reports nothing, mirroring `validateLearning` in `delivery-report-record.mjs`. */
export function validateLearning(learning) {
  if (learning === null || learning === undefined) return { ok: true, errors: [] };
  const errors = [];
  if (!isPlainObject(learning)) return { ok: false, errors: ['`learning` must be an object or null'] };
  if (!LEARNING_KINDS.includes(learning.kind)) errors.push(`\`learning.kind\` must be one of ${LEARNING_KINDS.join('/')}`);
  for (const key of ['summary', 'area', 'suggestion']) {
    if (typeof learning[key] !== 'string' || learning[key].trim() === '') errors.push(`\`learning.${key}\` is required and must be a non-empty string`);
  }
  if (typeof learning.summary === 'string' && learning.summary.length > 240) errors.push('`learning.summary` must be at most 240 chars');
  return { ok: errors.length === 0, errors };
}

/**
 * A fresh, `status: 'started'` fix report. Minted as the agent's very first action — same
 * crash-survives-as-"started" reasoning `completion-record.mjs`/`delivery-report-record.mjs` document.
 *
 * @param {object} spec
 * @param {string} spec.session - the fix session slug (the wrapper mints this — `fix-<pr>`, matching
 *   `we:scripts/operations/completion-cli.mjs#sessionSlugForCompletion({kind:'fix'})`'s own grammar — never
 *   re-derived here).
 * @param {string|number} spec.pr - the PR number this fix repairs. REQUIRED — unlike a delivery report
 *   (keyed by `item`, no PR exists yet), a fix always targets an existing, already-open PR.
 * @param {string|number} [spec.item] - the backlog item number the PR delivers, when known. Optional: the
 *   wrapper always has this (it comes off the PR the same way `we:skills-src/conveyor/fix-agent-brief.md`'s
 *   own `{{ITEM_NUM}}` placeholder does), but nothing in this record's own validation depends on it.
 * @param {() => string} [spec.now] - injectable clock, ISO-8601 string.
 * @returns {object} a new fix report record.
 */
export function newFixReport({ session, pr, item = null, now = () => new Date().toISOString() } = {}) {
  if (!isValidFixSessionSlug(session)) throw new TypeError(`operations: invalid fix-report session slug ${JSON.stringify(session)}`);
  if (pr === undefined || pr === null || String(pr).trim() === '') throw new TypeError('operations: newFixReport requires `pr`');
  const ts = now();
  return {
    v: FIX_REPORT_VERSION,
    session,
    pr: String(pr),
    item: item === null || item === undefined ? null : String(item),
    status: 'started',
    outcome: null,
    reason: null,
    filesTouched: null,
    learning: null,
    startedAt: ts,
    updatedAt: ts,
  };
}

/**
 * PURE merge of a `patch` onto an existing record — bumps `updatedAt`, never touches `session`/`pr`/`item`/
 * `startedAt`/`v`. Mirrors `delivery-report-record.mjs#applyDeliveryUpdate`.
 * @param {object} record
 * @param {{status?:string, outcome?:string|null, reason?:string|null, filesTouched?:string[]|null, learning?:object|null}} patch
 * @param {() => string} [now]
 * @returns {object}
 */
export function applyFixUpdate(record, patch = {}, now = () => new Date().toISOString()) {
  const next = { ...record, updatedAt: now() };
  for (const key of ['status', 'outcome', 'reason', 'filesTouched', 'learning']) {
    if (Object.hasOwn(patch, key)) next[key] = patch[key];
  }
  return next;
}

/**
 * Validate a fix report's SHAPE, reporting every problem found (mirrors
 * `delivery-report-record.mjs#validateDeliveryReport`). Enforces the same load-bearing rule: a `done`-status
 * report with `outcome` other than `'fixed'` MUST carry a non-empty `reason` — a hedge with no reason is
 * refused, not silently accepted.
 * @param {*} record
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateFixReport(record) {
  const errors = [];
  if (!isPlainObject(record)) return { ok: false, errors: ['fix report must be an object'] };
  if (record.v !== FIX_REPORT_VERSION) errors.push(`unsupported fix report version ${JSON.stringify(record.v)}`);
  if (!isValidFixSessionSlug(record.session)) errors.push('missing or invalid `session`');
  if (typeof record.pr !== 'string' || record.pr.trim() === '') errors.push('missing or invalid `pr`');
  if (!isOptionalString(record.item)) errors.push('`item` must be a string or null');
  if (!FIX_REPORT_STATUSES.includes(record.status)) errors.push(`\`status\` must be one of ${FIX_REPORT_STATUSES.join('/')}`);
  if (record.outcome !== null && !FIX_OUTCOMES.includes(record.outcome)) errors.push(`\`outcome\` must be null or one of ${FIX_OUTCOMES.join('/')}`);
  if (!isOptionalString(record.reason)) errors.push('`reason` must be a string or null');
  if (record.status === 'done' && record.outcome !== 'fixed' && (typeof record.reason !== 'string' || record.reason.trim() === '')) {
    errors.push('a `done`-status report with outcome other than `fixed` requires a non-empty `reason` naming the specific blocker/call — a hedge with no reason is refused');
  }
  if (!isOptionalStringArray(record.filesTouched)) errors.push('`filesTouched` must be an array of non-empty strings, or null');
  const learningCheck = validateLearning(record.learning);
  if (!learningCheck.ok) errors.push(...learningCheck.errors);
  if (typeof record.startedAt !== 'string' || Number.isNaN(Date.parse(record.startedAt))) errors.push('missing or unparseable `startedAt`');
  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) errors.push('missing or unparseable `updatedAt`');
  return { ok: errors.length === 0, errors };
}

/** Throws (carrying every error) unless `record` validates. @param {*} record @param {string} [label] */
export function assertFixReport(record, label = 'fix report') {
  const { ok, errors } = validateFixReport(record);
  if (!ok) throw new Error(`operations: ${label} is invalid — ${errors.join('; ')}`);
}

/** `JSON.stringify` with a trailing newline — the on-disk form. */
export function serializeFixReport(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * Parse on-disk text into a fix report. Never throws — a corrupt/empty/wrong-shape file is reported as
 * `{ok:false, corrupt:true, reason}`, same refuse-don't-silently-drop discipline as
 * `delivery-report-record.mjs#parseDeliveryReport`.
 * @param {string} text
 * @returns {{ok:true, record:object}|{ok:false, corrupt:true, reason:string}}
 */
export function parseFixReport(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, corrupt: true, reason: 'fix report is empty' };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, corrupt: true, reason: `fix report is not parseable JSON — ${String(e?.message || e)}` };
  }
  const { ok, errors } = validateFixReport(parsed);
  if (!ok) return { ok: false, corrupt: true, reason: errors.join('; ') };
  return { ok: true, record: parsed };
}
