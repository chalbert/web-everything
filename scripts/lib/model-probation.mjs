/**
 * @file scripts/lib/model-probation.mjs
 * @description THE PROBATION-STATUS REGISTRY (epic #3383) — the ONE place a `{provider, model}` identity's
 *   trust status is declared, per ROLE (`delivery`, `advisory-review`).
 *
 * WHY THIS EXISTS. The operator's ruling (2026-09-13): a not-yet-fully-trusted provider/model should be able
 * to do real work — real `fix`-kind delivery dispatches, a real advisory (non-blocking) review seat — while
 * data is collected on it, WITHOUT that data-collection ever gating anything. Codex (`gpt-6-astra`) is the
 * first real instance, but the status is deliberately keyed by **provider + model identity**, never
 * hardcoded to Codex: a future Claude version, a newly-integrated provider (Antigravity, Grok, an
 * open-weight model), or a Codex model UPGRADE all enter/leave probation the same way, through a registry
 * edit here, never a code change at a call site. A model upgrade does NOT inherit the outgoing model's
 * accumulated trust — `gpt-6-astra`'s entry says nothing about `gpt-7-something`; an unlisted `{provider,
 * model}` pair is `unvalidated` by construction (see {@link DEFAULT_STATUS}), so a new model starts over.
 *
 * SHAPE — follows `we:scripts/lib/poc-branches.mjs`'s already-ratified small-typed-registry precedent: a
 * frozen table lifted into a sibling `.json` file (so the registry can be WRITTEN — a status change is a
 * data edit, not a source edit — as well as read), a `version` field bumped only on a breaking shape change,
 * and PURE-CORE / IO-SHELL split (only {@link readRegistry}/{@link writeRegistry} touch disk). Fork 5 of
 * `#3649` (`we:backlog/3649-*.md`) sets the sibling precedent this module ALSO follows for its own, narrower
 * purpose: "stamped ... never inferred afterwards" — a dispatch's or a scorecard's probation status is read
 * off this registry AT THE TIME, not re-derived from behaviour, and a caller that wants a stable historical
 * record should stamp the read-back value onto its own record (see `run-scorecard-store.mjs`'s
 * `probationStatus` field) rather than re-querying the live registry later.
 *
 * STATUS VOCABULARY, per role:
 *   - `'unvalidated'` — no real trials yet for this role. FAIL-CLOSED DEFAULT for any `{provider, model,
 *     role}` triple this registry does not name — an unlisted pair is never silently treated as trusted.
 *   - `'probation'` — doing REAL work for this role (eligible for real dispatch / seating), specifically to
 *     accumulate real performance data (see `#3649`'s run-quality recorder) — but structurally barred from
 *     ever gating anything (see {@link NEVER_BLOCKING_ROLES} and the role docs below).
 *   - `'trusted'` — graduated out of probation on a later, separate ruling (never automatic — `#3651` names
 *     the trigger: one complete `rubricVersion` population).
 *
 * ROLES:
 *   - `'delivery'` — real `build`/`fix`/`ci-heal` dispatch work. A `probation` provider CAN be dispatched for
 *     real work in this role; nothing about delivery is "blocking" in the review sense, so this role has no
 *     veto-power question to begin with.
 *   - `'advisory-review'` — a non-blocking, opt-in-by-default-on-probation reviewer seat (`review-pr.mjs`'s
 *     `judgeAdvisory` step). THIS role is where "never blocks a merge, never gets veto power" is load-bearing:
 *     a `probation` (or even `trusted`) status here NEVER promotes the seat's lens out of `ADVISORY_LENSES`
 *     into `MANDATORY_LENSES` — that split is a STRUCTURAL property of `we:scripts/operations/review-pr.mjs`
 *     (`decideLensFloor`/`seatedLenses`), not a status this registry could override even if it wanted to. This
 *     module never grants veto power to any role; it only ever loosens whether a NON-gating seat runs by
 *     default. See `NEVER_BLOCKING_ROLES` below for the assertion that keeps this true even under a coding
 *     mistake at a call site.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The registry file this module reads and writes. */
export const PROBATION_REGISTRY_PATH = join(__dirname, 'model-probation.json');

/** Schema version every registry file carries. Bump ONLY on a breaking field change. */
export const PROBATION_REGISTRY_VERSION = 1;

/** The full status vocabulary, ordered least → most trusted. */
export const PROBATION_STATUSES = Object.freeze(['unvalidated', 'probation', 'trusted']);

/** The roles this registry tracks per `{provider, model}` identity. */
export const PROBATION_ROLES = Object.freeze(['delivery', 'advisory-review']);

/** Fail-closed default for any identity/role this registry does not name. */
export const DEFAULT_STATUS = 'unvalidated';

/**
 * Roles that structurally can NEVER gate a merge or acquire veto power, regardless of status. This is not a
 * config a status could flip — it exists so a caller asking "can this role ever block" gets a single,
 * grep-able `true`/`false` answer sourced from ONE place, backed by `review-pr.mjs`'s own mandatory/advisory
 * lens split (the actual structural enforcement lives there — `ADVISORY_LENSES` vs `MANDATORY_LENSES` — this
 * is a restatement for callers who only have this module in scope, not a second, independent enforcement
 * point that could drift from it).
 */
export const NEVER_BLOCKING_ROLES = Object.freeze(['advisory-review']);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize a `{provider, model}` pair into the registry's lookup key. PURE. */
export function identityKey({ provider, model } = {}) {
  return `${String(provider ?? '').trim().toLowerCase()}::${String(model ?? '').trim()}`;
}

/**
 * Validate ONE registry entry. Never throws — a malformed registry must degrade to "nothing declared"
 * (fail-closed, per {@link normalizeRegistry}), not crash a caller mid-dispatch decision.
 * @param {object} entry
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateProbationEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, errors: ['entry is not an object'] };
  if (!isNonEmptyString(entry.provider)) errors.push('`provider` is required (e.g. "codex", "anthropic")');
  if (!isNonEmptyString(entry.model)) errors.push('`model` is required (e.g. "gpt-6-astra") — identity is ALWAYS provider+model, never provider alone');
  if (!isNonEmptyString(entry.since) || !ISO_DAY_RE.test(String(entry.since).trim())) errors.push('`since` is required and must be a YYYY-MM-DD day');
  if (!isNonEmptyString(entry.owner)) errors.push('`owner` is required — the item/epic that put this identity on probation');
  if (!entry.roles || typeof entry.roles !== 'object' || Array.isArray(entry.roles)) {
    errors.push('`roles` is required — an object mapping each declared role to a status');
  } else {
    for (const [role, status] of Object.entries(entry.roles)) {
      if (!PROBATION_ROLES.includes(role)) errors.push(`\`roles\` names unknown role ${JSON.stringify(role)} — one of ${PROBATION_ROLES.join('|')}`);
      if (!PROBATION_STATUSES.includes(status)) errors.push(`\`roles.${role}\` must be one of ${PROBATION_STATUSES.join('|')}, got ${JSON.stringify(status)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Normalize a parsed registry file into a frozen, canonical `{version, entries}`. Tolerant of a missing or
 * malformed file (⇒ an EMPTY registry, not a throw) — an unreadable registry means "nothing is declared",
 * which fails CLOSED everywhere downstream (every identity reads back {@link DEFAULT_STATUS}). Bad entries
 * are dropped and reported in `dropped` rather than taking the whole registry offline. PURE.
 * @param {unknown} parsed
 * @returns {{version: number, entries: object[], dropped: {identity: string, errors: string[]}[]}}
 */
export function normalizeRegistry(parsed) {
  const raw = (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) ? parsed.entries : [];
  const entries = [];
  const dropped = [];
  const seen = new Set();
  for (const e of raw) {
    const verdict = validateProbationEntry(e);
    const key = identityKey(e ?? {});
    if (!verdict.ok) { dropped.push({ identity: key, errors: verdict.errors }); continue; }
    if (seen.has(key)) { dropped.push({ identity: key, errors: [`duplicate identity ${JSON.stringify(key)} — first entry wins`] }); continue; }
    seen.add(key);
    entries.push(Object.freeze({ ...e, roles: Object.freeze({ ...e.roles }) }));
  }
  return Object.freeze({ version: PROBATION_REGISTRY_VERSION, entries: Object.freeze(entries), dropped: Object.freeze(dropped) });
}

/**
 * PURE lookup: what registry entry (if any) declares `{provider, model}`? Returns `null` for an unknown pair.
 * @param {{version:number, entries:object[]}} registry
 * @param {{provider:string, model:string}} identity
 * @returns {object|null}
 */
export function findEntry(registry, identity) {
  const key = identityKey(identity);
  return (registry?.entries ?? []).find((e) => identityKey(e) === key) ?? null;
}

/**
 * PURE: the declared status of `{provider, model}` for `role`. Fail-closed to {@link DEFAULT_STATUS} when the
 * identity is unlisted, the role is unlisted on that identity's entry, or `role` itself is not a known role —
 * an unknown role is refused loudly (a typo must not silently read as "unvalidated" for the WRONG reason),
 * everything else degrades quietly.
 * @param {{version:number, entries:object[]}} registry
 * @param {{provider:string, model:string, role:string}} o
 * @returns {'unvalidated'|'probation'|'trusted'}
 */
export function statusFor(registry, { provider, model, role } = {}) {
  if (!PROBATION_ROLES.includes(role)) {
    throw new TypeError(`model-probation: \`role\` must be one of ${PROBATION_ROLES.join('|')}, got ${JSON.stringify(role)}`);
  }
  const entry = findEntry(registry, { provider, model });
  const status = entry?.roles?.[role];
  return PROBATION_STATUSES.includes(status) ? status : DEFAULT_STATUS;
}

/** PURE convenience: is `{provider, model}` on probation (exactly, not `trusted`) for `role`?
 *  @test-only-export-ok: public API mirroring `liveStatusFor`'s convenience shape (`codexAdvisoryFromEnv`
 *  uses `liveStatusFor` directly today); kept for a future `delivery`-role call site (e.g. `fix-run.mjs`'s
 *  own provider selection) that is owed follow-on wiring, not built this session. */
export function isOnProbation(registry, o) {
  return statusFor(registry, o) === 'probation';
}

/** PURE convenience: is `{provider, model}` eligible for REAL work in `role` — `probation` or `trusted`?
 *  @test-only-export-ok: same rationale as `isOnProbation` above — public API for a future delivery-side
 *  eligibility check, not yet wired to a permanent caller. */
export function isDispatchEligible(registry, o) {
  const status = statusFor(registry, o);
  return status === 'probation' || status === 'trusted';
}

/**
 * PURE, and the one assertion this module makes about ITSELF: no role this registry tracks may ever gate a
 * merge, whatever its status. Throws if ever called with a role outside {@link NEVER_BLOCKING_ROLES} that a
 * caller believed was blocking-safe — a defensive check for a future role addition, not a live code path
 * today (both current roles are already correctly classified).
 * @param {string} role
 * @returns {true}
 * @test-only-export-ok: a defensive self-check with no permanent caller by design (see the docblock above) —
 *   exists to be exercised by a FUTURE role's own guard, not by anything this build wires today.
 */
export function assertRoleNeverBlocks(role) {
  if (!NEVER_BLOCKING_ROLES.includes(role)) {
    throw new Error(`model-probation: ${JSON.stringify(role)} is not declared in NEVER_BLOCKING_ROLES — do not assume it is non-gating without checking review-pr.mjs's own mandatory/advisory split first`);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// IO SHELL — the only functions that touch disk.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Read the live registry off disk. NEVER THROWS — an unreadable/malformed file degrades to the empty
 * registry (see {@link normalizeRegistry}), which fails every {@link statusFor} lookup closed to
 * {@link DEFAULT_STATUS}.
 * @param {{path?: string, read?: (p: string) => string}} [io]
 * @returns {{version: number, entries: object[], dropped: object[]}}
 */
export function readRegistry({ path = PROBATION_REGISTRY_PATH, read = (p) => readFileSync(p, 'utf8') } = {}) {
  try {
    return normalizeRegistry(JSON.parse(read(path)));
  } catch {
    return normalizeRegistry(null);
  }
}

/**
 * Write the registry back to disk, pretty-printed. The IO half of a status change (e.g. graduating an
 * identity out of probation) — callers doing that are expected to read, mutate the plain entries array, and
 * write back; this function does not validate (that is `validateProbationEntry`'s job, run by
 * {@link normalizeRegistry} on the NEXT read), so a caller SHOULD validate before writing.
 * @param {{version: number, entries: object[]}} registry
 * @param {{path?: string, write?: (p: string, s: string) => void}} [io]
 */
export function writeRegistry(registry, { path = PROBATION_REGISTRY_PATH, write = (p, s) => writeFileSync(p, s) } = {}) {
  write(path, `${JSON.stringify({ version: registry.version ?? PROBATION_REGISTRY_VERSION, entries: registry.entries ?? [] }, null, 2)}\n`);
}

/**
 * Convenience one-shot: read the live registry off disk and answer `statusFor` in one call, for a caller that
 * does not want to hold the registry object itself (the common case — a call site deciding one default).
 * @param {{provider:string, model:string, role:string}} o
 * @param {{path?: string, read?: (p:string)=>string}} [io]
 * @returns {'unvalidated'|'probation'|'trusted'}
 */
export function liveStatusFor(o, io) {
  return statusFor(readRegistry(io), o);
}
