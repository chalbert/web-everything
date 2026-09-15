/**
 * @file scripts/lib/model-capability-ratings.mjs
 * @description EXTERNAL CAPABILITY RATINGS — an exploration-priority hint ONLY, keyed by `{provider,
 *   model}`. A benchmark can suggest which untested model is worth trying; it cannot establish trust.
 *
 * WHY THIS EXISTS. External leaderboards describe a different population of work from our dispatch
 * trials. Keeping them in a SECOND registry makes that distinction explicit: provenance and rating dates
 * travel with every entry, and `verified` must remain FALSE until a human has actually confirmed the
 * source. Validation checks the shape, never the truth of the source. Missing verification is rejected,
 * not silently upgraded; an explicitly unverified entry may be stored but MUST NOT influence exploration.
 *
 * **THIS DATA MUST NEVER INFLUENCE `selectSupervisionLevel` IN `provider-routing.mjs`.** Supervision and
 * graduation use ONLY the probation registry and real run-scorecard evidence. No rating, even a verified
 * perfect benchmark, grants permission to run unsupervised. Only the separate exploration section of
 * `we:scripts/lib/provider-routing.mjs` may consume this registry for routing.
 *
 * SHAPE — follows `we:scripts/lib/model-probation.mjs`: sibling versioned JSON, frozen normalized entries,
 * PURE-CORE / IO-SHELL split, and tolerant reads that degrade to an EMPTY registry. The shipped `entries`
 * array is deliberately EMPTY: no unconfirmed leaderboard numbers become facts by being checked in.
 * `exampleEntry` is documentation outside that array; normalization NEVER reads or validates it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The registry file this module reads and writes. */
export const CAPABILITY_REGISTRY_PATH = join(__dirname, 'model-capability-ratings.json');

/** Schema version every registry file carries. Bump ONLY on a breaking field change. */
export const CAPABILITY_REGISTRY_VERSION = 1;

/** All five categories are required; `value: null` means unknown, never a measured zero. */
export const CAPABILITY_CATEGORIES = Object.freeze([
  'contextIngestion', 'autonomousAgenticWork', 'algorithmicSpeedIdeSync', 'cliToolUse', 'overallCodingIndex',
]);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize a `{provider, model}` pair into the registry's lookup key. PURE.
 *  Provider is case-insensitive; model preserves case, exactly as in the probation registry. */
export function identityKey({ provider, model } = {}) {
  return `${String(provider ?? '').trim().toLowerCase()}::${String(model ?? '').trim()}`;
}

/**
 * Validate ONE registry entry. Never throws on malformed data — callers decide whether to drop or refuse
 * it. Dates use the registry's YYYY-MM-DD shape check; this is not a source-verification service. PURE.
 * @param {object} entry
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateCapabilityEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, errors: ['entry is not an object'] };
  if (!isNonEmptyString(entry.provider)) errors.push('`provider` is required — identity is ALWAYS provider+model');
  if (!isNonEmptyString(entry.model)) errors.push('`model` is required');
  if (typeof entry.verified !== 'boolean') errors.push('`verified` must be a boolean — false until a human confirms the source');
  if (!isNonEmptyString(entry.source)) errors.push('`source` is required — explicitly unverified provenance is acceptable, omitted provenance is not');
  for (const field of ['asOf', 'lastUpdated']) {
    if (typeof entry[field] !== 'string' || !ISO_DAY_RE.test(entry[field])) errors.push(`\`${field}\` is required and must be a YYYY-MM-DD day`);
  }
  if (!entry.categories || typeof entry.categories !== 'object' || Array.isArray(entry.categories)) {
    errors.push('`categories` is required — an object containing all five capability categories');
  } else {
    for (const category of CAPABILITY_CATEGORIES) {
      const rating = entry.categories[category];
      if (!rating || typeof rating !== 'object' || Array.isArray(rating)) {
        errors.push(`\`categories.${category}\` must be an object`);
        continue;
      }
      if (rating.value !== null && !Number.isFinite(rating.value)) errors.push(`\`categories.${category}.value\` must be null or a finite number`);
      if (!isNonEmptyString(rating.unit)) errors.push(`\`categories.${category}.unit\` must be a non-empty string`);
      if (typeof rating.note !== 'string') errors.push(`\`categories.${category}.note\` must be a string (possibly empty)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Normalize ONLY `entries` into a frozen registry. Malformed input degrades to EMPTY; bad entries and
 * duplicates are reported in `dropped`, first valid identity wins. `exampleEntry` is never inspected,
 * copied, or surfaced as data. Category objects are copied and frozen too, so caller mutation cannot
 * change a rating after validation. PURE.
 * @param {unknown} parsed
 * @returns {{version: number, entries: object[], dropped: {identity: string, errors: string[]}[]}}
 */
export function normalizeRegistry(parsed) {
  const raw = (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) ? parsed.entries : [];
  const entries = [];
  const dropped = [];
  const seen = new Set();
  for (const e of raw) {
    const verdict = validateCapabilityEntry(e);
    // Bad JSON field types must still be reportable (an object can shadow its own toString).
    const key = identityKey({ provider: typeof e?.provider === 'string' ? e.provider : '', model: typeof e?.model === 'string' ? e.model : '' });
    if (!verdict.ok) { dropped.push({ identity: key, errors: verdict.errors }); continue; }
    if (seen.has(key)) { dropped.push({ identity: key, errors: [`duplicate identity ${JSON.stringify(key)} — first entry wins`] }); continue; }
    seen.add(key);
    const categories = Object.fromEntries(CAPABILITY_CATEGORIES.map((category) => [category, Object.freeze({ ...e.categories[category] })]));
    entries.push(Object.freeze({ ...e, categories: Object.freeze(categories) }));
  }
  return Object.freeze({ version: CAPABILITY_REGISTRY_VERSION, entries: Object.freeze(entries), dropped: Object.freeze(dropped) });
}

/**
 * PURE lookup: return the full entry for an identity, or `null` when no entry declares it.
 * @param {{version:number, entries:object[]}} registry
 * @param {{provider:string, model:string}} identity
 * @returns {object|null}
 */
export function findEntry(registry, identity) {
  const key = identityKey(identity);
  return (registry?.entries ?? []).find((e) => identityKey(e) === key) ?? null;
}

/**
 * PURE: return ratings WITH provenance and verification intact, never a bare number that looks trusted.
 * This lookup does not grant permission to use the result; consumers must check verification separately.
 * @param {{version:number, entries:object[]}} registry
 * @param {{provider:string, model:string}} identity
 * @returns {object|null}
 */
export function ratingsFor(registry, identity) {
  return findEntry(registry, identity);
}

/**
 * PURE permission check on a validated entry. ONLY explicit `true` enables exploration; missing or false
 * verification contributes nothing. Shape validation belongs to normalization, not to this predicate.
 * @param {object|null} entry a validated entry from {@link ratingsFor}
 * @returns {boolean}
 * @test-only-export-ok: verification boundary for exploration routing; no live dispatch caller yet.
 */
export function isUsableForExploration(entry) {
  return entry != null && entry.verified === true;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// IO SHELL — the only functions that touch disk.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Read the live registry. NEVER THROWS — unreadable/malformed input means no exploration hints.
 * @param {{path?: string, read?: (p: string) => string}} [io]
 * @returns {{version: number, entries: object[], dropped: object[]}}
 */
export function readRegistry({ path = CAPABILITY_REGISTRY_PATH, read = (p) => readFileSync(p, 'utf8') } = {}) {
  try {
    return normalizeRegistry(JSON.parse(read(path)));
  } catch {
    return normalizeRegistry(null);
  }
}

/**
 * Write version/entries, pretty-printed, following the probation registry's IO contract. Callers SHOULD
 * validate before writing; the next read normalizes. Diagnostic `dropped` and documentation `exampleEntry`
 * are not data and are not serialized by this writer.
 * @param {{version: number, entries: object[]}} registry
 * @param {{path?: string, write?: (p: string, s: string) => void}} [io]
 * @test-only-export-ok: future operator import/edit API; no live dispatch wiring in this slice.
 */
export function writeRegistry(registry, { path = CAPABILITY_REGISTRY_PATH, write = (p, s) => writeFileSync(p, s) } = {}) {
  write(path, `${JSON.stringify({ version: registry.version ?? CAPABILITY_REGISTRY_VERSION, entries: registry.entries ?? [] }, null, 2)}\n`);
}

/**
 * Convenience one-shot: read the registry and return the full entry, still subject to verification.
 * @param {{provider:string, model:string}} identity
 * @param {{path?: string, read?: (p:string)=>string}} [io]
 * @returns {object|null}
 * @test-only-export-ok: public convenience API for future exploration consumers, deliberately unwired.
 */
export function liveRatingsFor(identity, io) {
  return ratingsFor(readRegistry(io), identity);
}
