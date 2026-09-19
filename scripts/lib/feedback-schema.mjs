/**
 * Feedback capture v1 (#2774), separate from machine-local delivery learnings.
 * Wire record (all required, no other fields):
 *   schemaVersion: 1
 *   category: 'friction' | 'documentation' | 'improvement'
 *   summary: nonblank single-line generalized observation, max 240 UTF-16 units
 *   suggestion: nonblank single-line generalized recommendation, max 400 UTF-16 units
 * Caps apply BEFORE trimming. Only outer whitespace is normalized. No evidence,
 * attachments, code, diffs, paths, tenant names/IDs, user IDs, URLs or ambient context
 * fields. Tenant association MUST come from authenticated transport context, never
 * from this user-authored record. Review/routing consumers read schemaVersion first.
 * This is a capture contract, not an authentication or downstream routing mechanism.
 *
 * validateFeedbackEntry checks shape only; prepareFeedbackPayload is the mandatory
 * SEND gate. It checks every prose field with the shared, broad scrubReasons (code,
 * paths, secrets, PII), not the narrower repository-publish detector. Deny on any
 * hit, never redact. Pattern detection cannot prove arbitrary prose is anonymous:
 * short/obfuscated or split secrets and unrecognized code/paths can evade detection.
 * Do not automatically capture source material or claim complete DLP protection.
 *
 * PLATEAU-APP DESIGN ONLY (not implemented/tested here): render an opt-in feedback
 * form with category select and summary/suggestion inputs with the above limits.
 * Ask for generalized lessons, never populate from code, diffs, logs or page state.
 * Nothing is sent on edit, open or preview. An optional "Show exactly what would be
 * sent" action calls sendFeedbackEntry(entry, { preview: true }); render its payload
 * as textContent in a labelled preformatted region (JSON escapes are intentional).
 * Send is a separate explicit user action calling the same function with a transport
 * callback. Any edit invalidates the displayed preview; revalidate on every send.
 * The callback transmits the supplied string verbatim as application/json, without
 * appending metadata or reserializing. Bind authentication separately; repeat this
 * gate at the receiving trust boundary. Show denial reasons without echoing values.
 * No client component or receiving endpoint is delivered by this foundation slice.
 */
import { scrubReasons } from './secret-scrub.mjs';

export const FEEDBACK_CATEGORIES = Object.freeze(['friction', 'documentation', 'improvement']);
export const FEEDBACK_FIELD_CAPS = Object.freeze({ summary: 240, suggestion: 400 });
const ALLOWED_FIELDS = ['schemaVersion', 'category', ...Object.keys(FEEDBACK_FIELD_CAPS)];

/** Pure JSON-data validator → { ok, errors, clean }; denial never exposes raw values. */
export function validateFeedbackEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(entry))) {
    return { ok: false, errors: ['entry must be a plain JSON object'], clean: null };
  }
  if (Reflect.ownKeys(entry).some(key => !ALLOWED_FIELDS.includes(key))) {
    errors.push('disallowed field: only schemaVersion, category, summary, suggestion are permitted');
  }
  // Read own data properties only: accessors/prototypes are not JSON input.
  const values = {};
  for (const field of ALLOWED_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(entry, field);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      errors.push(`${field} must be an own JSON data field`);
    } else values[field] = descriptor.value;
  }
  if (values.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!FEEDBACK_CATEGORIES.includes(values.category)) {
    errors.push(`category must be one of ${FEEDBACK_CATEGORIES.join('|')}`);
  }
  for (const [field, cap] of Object.entries(FEEDBACK_FIELD_CAPS)) {
    const value = values[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${field} must be a non-empty string`);
      continue;
    }
    if (value.length > cap) errors.push(`${field} exceeds ${cap} characters`);
    // A prose-only shape prevents multiline pastes and diff lines even without code.
    if (/[\u0000-\u001f\u007f\u2028\u2029]/u.test(value) || /^[+@-]/u.test(value.trim())) {
      errors.push(`${field} must be single-line prose without control characters or diff prefixes`);
    }
  }
  if (errors.length) return { ok: false, errors, clean: null };
  return { ok: true, errors: [], clean: {
    schemaVersion: 1, category: values.category,
    summary: values.summary.trim(), suggestion: values.suggestion.trim(),
  } };
}

/** Pure SEND preparation. payload is the exact JSON string, or null on ANY denial. */
export function prepareFeedbackPayload(entry) {
  const result = validateFeedbackEntry(entry);
  if (!result.ok) return { ...result, payload: null };
  const errors = [];
  for (const field of Object.keys(FEEDBACK_FIELD_CAPS)) {
    for (const reason of scrubReasons(result.clean[field])) {
      errors.push(`${field} failed scrub: ${reason}`);
    }
  }
  if (errors.length) return { ok: false, errors, clean: null, payload: null };
  return { ...result, payload: JSON.stringify(result.clean) };
}

/**
 * Thin IO seam. preview defaults to false and never calls send. Normal mode awaits
 * send(payload: string) exactly once, after the same preparation. No retries or
 * timestamps; transport errors propagate (never report a failed send as success).
 * Default success reveals no payload; only explicit preview exposes its bytes.
 */
export async function sendFeedbackEntry(entry, { preview = false, send } = {}) {
  if (typeof preview !== 'boolean') throw new TypeError('preview must be a boolean');
  const result = prepareFeedbackPayload(entry);
  if (!result.ok) return { ok: false, errors: result.errors, sent: false, payload: null };
  if (preview) return { ok: true, errors: [], sent: false, payload: result.payload };
  if (typeof send !== 'function') throw new TypeError('send must be a transport callback');
  await send(result.payload);
  return { ok: true, errors: [], sent: true };
}
