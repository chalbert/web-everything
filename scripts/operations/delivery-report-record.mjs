/**
 * @file scripts/operations/delivery-report-record.mjs
 * @description PROTOTYPE (#3627 design) — THE DELIVERY REPORT RECORD, the pure half of a schema-constrained
 * completion contract for a MINIMAL delivery agent (see `we:skills-src/conveyor/delivery-agent-brief-v2.md`
 * and `we:backlog/3627-*.md`'s design amendment). Mirrors the pure/io split
 * `we:scripts/operations/completion-record.mjs` / `completion-store.mjs` already establish for review/fix
 * dispatches (#3436) — same two-phase `started` → `done` write discipline, same reasons — but scoped to what
 * a BUILD delivery agent actually needs to say, not to review/fix's `verdict`/`label` shape.
 *
 * NOT WIRED IN. Nothing in `we:scripts/operations/dispatch-lane.mjs` reads or writes this yet — this file
 * exists to be read, tested, and judged as a design, per the operator's "prototype, don't deploy tonight"
 * instruction on #3627.
 *
 * WHY A SEPARATE SCHEMA, NOT A THIRD `COMPLETION_KINDS` ENTRY. review/fix's record answers "what did the
 * review conclude" (`verdict`/`label`/`runId`) — questions with no meaning for a build. A build delivery
 * agent instead answers "did you finish the spec, and if not, why, and what would a human need to know" —
 * `outcome`/`reason`/`filesTouched`/`learning`. Widening `completion-record.mjs` to carry both shapes would
 * make every field optional-depending-on-kind, the exact "shared shape hides which fields real" trap the
 * pure/io split otherwise avoids. A parallel, equally-small record type keeps each schema fully-required for
 * its own kind.
 *
 * THE THREE OUTCOMES A MINIMAL DELIVERY AGENT CAN REPORT — DELIBERATELY ONLY THREE:
 *   - `done`        — the spec is built, the lane has a commit, `filesTouched` is non-empty. The WRAPPER (not
 *                      the agent) takes it from here: run the gate, drive `/converge`, open the PR, apply the
 *                      label the deterministic rubric picks.
 *   - `blocked`      — the agent could not proceed, for a reason a script cannot resolve on its own: this
 *                      collapses today's brief's step-3 PRE-build "not-ready" stop (re-blocked / stale /
 *                      scope-wrong / incoherent) and any RUNTIME blocker hit mid-build into one outcome. The
 *                      wrapper tells the two apart from `filesTouched`/git state, not from a second enum the
 *                      agent has to pick correctly — see the design amendment's "the agent doesn't have to
 *                      know the taxonomy" argument.
 *   - `needs-human-judgment` — the agent finished (or nearly finished) the work but hit a specific taste /
 *                      product / policy call no reviewer process can resolve for it. `reason` MUST name the
 *                      call, not hedge ("genuine uncertainty" alone is refused by {@link validateDeliveryReport}
 *                      exactly as the current brief's Escalations #4 already argues in prose — this just makes
 *                      the prose a checked field).
 * The agent never reasons about `review:human` vs `review:pending`, exit codes, or park modes — those are the
 * WRAPPER's job, driven off this outcome plus the deterministic rubric already in
 * `we:scripts/lib/review-escalation.mjs` / `we:scripts/lib/gate-config.mjs` (statute/policy-core path
 * detection). See the wrapper sketch, `we:scripts/operations/deliver-item-wrapper.mjs`.
 *
 * PURE. No fs, no clock (injectable), no process, no network — same discipline as `completion-record.mjs`.
 */

/** Schema version stamped on every record. A reader refuses a version it does not know. */
export const DELIVERY_REPORT_VERSION = 1;

/** The two states a record moves through, same two-phase write as `completion-record.mjs` (#3436). */
export const DELIVERY_REPORT_STATUSES = Object.freeze(['started', 'done']);

/** The ONLY three outcomes a minimal delivery agent may report — see the file header for what each means. */
export const DELIVERY_OUTCOMES = Object.freeze(['done', 'blocked', 'needs-human-judgment']);

/** The `learning` sub-shape mirrors `we:scripts/conveyor/learnings-drop.mjs`'s own four required fields —
 *  reusing its `kind` enum rather than inventing a second one — but the agent hands this to the WRAPPER; it
 *  never shells `learnings-drop.mjs` or reasons about its scrub/allow-list mechanics itself. */
export const LEARNING_KINDS = Object.freeze(['friction', 'missing-convention', 'doc-gap', 'skill-gap', 'improvement']);

/** Session slugs are used as filenames, so the character set is closed — no separators, no traversal. */
const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** @param {*} v @returns {boolean} */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Is `session` usable as a delivery-report session slug (and therefore as a filename)? */
export function isValidDeliverySessionSlug(session) {
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

/** Validate the optional `learning` sub-object. `null` is always valid — a delivery agent with no
 *  generalizable friction reports nothing, exactly as step 9 of today's brief already allows ("skip this step
 *  only if you genuinely hit no generalizable friction"). */
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
 * A fresh, `status: 'started'` delivery report. Minted as the agent's very first action — same
 * crash-survives-as-"started" reasoning `completion-record.mjs` documents for review/fix (#3436 done-when #3):
 * a delivery agent that crashes mid-build must leave "started, not yet concluded" on disk, not nothing.
 *
 * @param {object} spec
 * @param {string} spec.session - the delivery session slug (the wrapper mints this, injected here — never
 *   re-derived, mirroring `newCompletionRecord`'s own "injected, never derived" choice for a THIRD kind).
 * @param {string|number} spec.item - the backlog item number/hash this delivery is building.
 * @param {() => string} [spec.now] - injectable clock, ISO-8601 string.
 * @returns {object} a new delivery report record.
 */
export function newDeliveryReport({ session, item, now = () => new Date().toISOString() } = {}) {
  if (!isValidDeliverySessionSlug(session)) throw new TypeError(`operations: invalid delivery-report session slug ${JSON.stringify(session)}`);
  if (item === undefined || item === null || String(item).trim() === '') throw new TypeError('operations: newDeliveryReport requires `item`');
  const ts = now();
  return {
    v: DELIVERY_REPORT_VERSION,
    session,
    item: String(item),
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
 * PURE merge of a `patch` onto an existing record — bumps `updatedAt`, never touches `session`/`item`/
 * `startedAt`/`v`. Mirrors `completion-record.mjs#applyCompletionUpdate`.
 * @param {object} record
 * @param {{status?:string, outcome?:string|null, reason?:string|null, filesTouched?:string[]|null, learning?:object|null}} patch
 * @param {() => string} [now]
 * @returns {object}
 */
export function applyDeliveryUpdate(record, patch = {}, now = () => new Date().toISOString()) {
  const next = { ...record, updatedAt: now() };
  for (const key of ['status', 'outcome', 'reason', 'filesTouched', 'learning']) {
    if (Object.hasOwn(patch, key)) next[key] = patch[key];
  }
  return next;
}

/**
 * Validate a delivery report's SHAPE, reporting every problem found (mirrors
 * `completion-record.mjs#validateCompletionRecord`). Enforces the load-bearing rule the design amendment
 * calls out explicitly: a `done`-status report with `outcome` other than `'done'` MUST carry a non-empty
 * `reason` — "genuine uncertainty" with nothing named is refused, not silently accepted as a hedge (the same
 * discipline the CURRENT prose brief's Escalations #4 already states, made into a checked field here).
 * @param {*} record
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateDeliveryReport(record) {
  const errors = [];
  if (!isPlainObject(record)) return { ok: false, errors: ['delivery report must be an object'] };
  if (record.v !== DELIVERY_REPORT_VERSION) errors.push(`unsupported delivery report version ${JSON.stringify(record.v)}`);
  if (!isValidDeliverySessionSlug(record.session)) errors.push('missing or invalid `session`');
  if (typeof record.item !== 'string' || record.item.trim() === '') errors.push('missing or invalid `item`');
  if (!DELIVERY_REPORT_STATUSES.includes(record.status)) errors.push(`\`status\` must be one of ${DELIVERY_REPORT_STATUSES.join('/')}`);
  if (record.outcome !== null && !DELIVERY_OUTCOMES.includes(record.outcome)) errors.push(`\`outcome\` must be null or one of ${DELIVERY_OUTCOMES.join('/')}`);
  if (!isOptionalString(record.reason)) errors.push('`reason` must be a string or null');
  if (record.status === 'done' && record.outcome !== 'done' && (typeof record.reason !== 'string' || record.reason.trim() === '')) {
    errors.push('a `done`-status report with outcome `blocked` or `needs-human-judgment` requires a non-empty `reason` naming the specific blocker/call — a hedge with no reason is refused');
  }
  if (!isOptionalStringArray(record.filesTouched)) errors.push('`filesTouched` must be an array of non-empty strings, or null');
  const learningCheck = validateLearning(record.learning);
  if (!learningCheck.ok) errors.push(...learningCheck.errors);
  if (typeof record.startedAt !== 'string' || Number.isNaN(Date.parse(record.startedAt))) errors.push('missing or unparseable `startedAt`');
  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) errors.push('missing or unparseable `updatedAt`');
  return { ok: errors.length === 0, errors };
}

/** Throws (carrying every error) unless `record` validates. @param {*} record @param {string} [label] */
export function assertDeliveryReport(record, label = 'delivery report') {
  const { ok, errors } = validateDeliveryReport(record);
  if (!ok) throw new Error(`operations: ${label} is invalid — ${errors.join('; ')}`);
}

/** `JSON.stringify` with a trailing newline — the on-disk form. */
export function serializeDeliveryReport(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * Parse on-disk text into a delivery report. Never throws — a corrupt/empty/wrong-shape file is reported as
 * `{ok:false, corrupt:true, reason}`, same refuse-don't-silently-drop discipline as
 * `completion-record.mjs#parseCompletionRecord`.
 * @param {string} text
 * @returns {{ok:true, record:object}|{ok:false, corrupt:true, reason:string}}
 */
export function parseDeliveryReport(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, corrupt: true, reason: 'delivery report is empty' };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, corrupt: true, reason: `delivery report is not parseable JSON — ${String(e?.message || e)}` };
  }
  const { ok, errors } = validateDeliveryReport(parsed);
  if (!ok) return { ok: false, corrupt: true, reason: errors.join('; ') };
  return { ok: true, record: parsed };
}
