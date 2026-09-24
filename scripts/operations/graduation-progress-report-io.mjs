/**
 * @file we:scripts/operations/graduation-progress-report-io.mjs
 * @description Scorecard, promotions, probation and clock readers for graduation progress (#3690,
 * #xtw2rap). All graduation arithmetic stays in the declaration; this file only classifies each source as
 * `ok` | `absent` | `invalid` before handing it across the io boundary.
 *
 * `we:scripts/lib/dispatch-supervision-promotions.json` (rule 6, #3784) does not exist on `main` yet;
 * `we:scripts/lib/model-probation.json` (#3893) was ported and does. A missing file reads `absent`; a file that
 * exists but fails to parse, or whose shape does not validate, reads `invalid`. Both fail CLOSED: neither
 * source ever promotes a triple or names a probation role when it is anything but `ok` (rule 6's own stated
 * default — "with no such act, a triple stays at full" — generalised to probation for the same reason: a
 * broken read must never silently grant trust).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readStore } from '../conveyor/run-scorecard-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** `we:scripts/lib/dispatch-supervision-promotions.json` — one row per ratified `{provider, model, taskType}`
 *  promotion, per #3784's Fork 2 design: `{provider, model, taskType, ratifiedBy, ratifiedOn, anchor}`. */
export const PROMOTIONS_PATH = join(__dirname, '..', 'lib', 'dispatch-supervision-promotions.json');

/** `we:scripts/lib/model-probation.json` — the per-`{provider, model}` role registry (#3893), ported from
 *  `origin/lane/mechanical-dispatcher`'s `model-probation.mjs`: `{provider, model, roles, since}` entries. */
export const PROBATION_PATH = join(__dirname, '..', 'lib', 'model-probation.json');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/** Validate one promotion row. Never throws — an invalid row invalidates the whole source (fail closed). */
function isValidPromotionEntry(entry) {
  return !!entry && typeof entry === 'object' && !Array.isArray(entry)
    && isNonEmptyString(entry.provider) && isNonEmptyString(entry.model) && isNonEmptyString(entry.taskType)
    && isNonEmptyString(entry.ratifiedBy) && isNonEmptyString(entry.ratifiedOn) && isNonEmptyString(entry.anchor);
}

/** Validate one probation row. Never throws — an invalid row invalidates the whole source (fail closed). */
function isValidProbationEntry(entry) {
  return !!entry && typeof entry === 'object' && !Array.isArray(entry)
    && isNonEmptyString(entry.provider) && isNonEmptyString(entry.model) && isNonEmptyString(entry.since)
    && !!entry.roles && typeof entry.roles === 'object' && !Array.isArray(entry.roles);
}

/**
 * Shared shape for both small checked-in registries: `{version, entries: [...]}`. Missing file → `absent`;
 * unparseable JSON, a non-array `entries`, or any entry that fails `isValidEntry` → `invalid`. Both promote
 * nothing further up the stack — the declaration only ever consults `entries` when `source` is `ok`.
 */
function readJsonRegistry({ path, exists, read, isValidEntry }) {
  if (!exists(path)) return { source: 'absent', entries: [] };
  let parsed;
  try {
    parsed = JSON.parse(read(path));
  } catch {
    return { source: 'invalid', entries: [] };
  }
  const entries = parsed?.entries;
  if (!Array.isArray(entries) || !entries.every(isValidEntry)) return { source: 'invalid', entries: [] };
  return { source: 'ok', entries };
}

/** Store IO options and clock are injectable so tests never need the real store. */
export function createScorecardReader({ now = () => new Date().toISOString(), ...storeIo } = {}) {
  return () => {
    const { records } = readStore(storeIo);
    return { records, asOfIso: now() };
  };
}

/** IO is injectable so tests never need the real (not-yet-existing-on-main) promotions file. */
export function createPromotionsReader({ path = PROMOTIONS_PATH, exists = existsSync, read = (p) => readFileSync(p, 'utf8') } = {}) {
  return () => readJsonRegistry({ path, exists, read, isValidEntry: isValidPromotionEntry });
}

/** IO is injectable so tests never need the real (not-yet-existing-on-main) probation file. */
export function createProbationReader({ path = PROBATION_PATH, exists = existsSync, read = (p) => readFileSync(p, 'utf8') } = {}) {
  return () => readJsonRegistry({ path, exists, read, isValidEntry: isValidProbationEntry });
}
