/**
 * @file scripts/readiness/already-done-cache.mjs
 * @description Per-item cooldown for dispatch-plan's age-gated already-done checks (#xp12dod).
 *   Cache successful checks across ticks so stale items do not spend a GitHub search every two minutes.
 *   Not-done verdicts expire after 30 minutes to discover newly landed work promptly; done verdicts last
 *   24 hours because merged PRs stay merged. Failed checks are never cached. The IO shell resolves the
 *   store by script location, reads fail-open, and writes atomically, like dispatch-pause.mjs.
 *   Cooldown overrides are supplied by dispatch-plan's IO shell; the core has no fs or clock reads.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// ── PURE CORE (no fs / clock — every input injected) ────────────────────────────

/** IO-shell override: WE_DISPATCH_PLAN_ALREADY_DONE_NOT_DONE_COOLDOWN_MS. */
export const ALREADY_DONE_NOT_DONE_COOLDOWN_MS = 30 * 60 * 1000;
/** IO-shell override: WE_DISPATCH_PLAN_ALREADY_DONE_DONE_COOLDOWN_MS. */
export const ALREADY_DONE_DONE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function emptyCacheState() {
  return { items: {} };
}

const isPlainObject = (value) => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Invalid stores fail open; malformed entries cannot suppress a real check. */
export function parseCacheState(text) {
  try {
    if (!text || !text.trim()) return emptyCacheState();
    const state = JSON.parse(text);
    if (!isPlainObject(state) || !isPlainObject(state.items)) return emptyCacheState();
    return { items: Object.fromEntries(Object.entries(state.items).filter(([, entry]) =>
      isPlainObject(entry) && !Number.isNaN(Date.parse(entry.checkedAt)) && typeof entry.done === 'boolean')) };
  } catch {
    return emptyCacheState();
  }
}

export function serializeCacheState(state) {
  return JSON.stringify({ items: state?.items || {} }, null, 2) + '\n';
}

export function isCacheEntryFresh(entry, nowMs, {
  notDoneCooldownMs = ALREADY_DONE_NOT_DONE_COOLDOWN_MS,
  doneCooldownMs = ALREADY_DONE_DONE_COOLDOWN_MS,
} = {}) {
  if (!entry || Number.isNaN(Date.parse(entry.checkedAt))) return false;
  const age = nowMs - Date.parse(entry.checkedAt);
  const cooldown = entry.done === true ? doneCooldownMs : notDoneCooldownMs;
  return age >= 0 && age < cooldown;
}

export function getCachedVerdict(state, id, nowMs, opts) {
  const entry = state.items[String(id)];
  return isCacheEntryFresh(entry, nowMs, opts) ? { done: entry.done, pr: entry.pr ?? null } : null;
}

/** Only real checked verdicts advance the timestamp; preserve all other ids without mutating input. */
export function recordVerdicts(state, verdictsById, nowMs) {
  const items = { ...state.items };
  const verdicts = verdictsById instanceof Map ? verdictsById : Object.entries(verdictsById);
  for (const [id, v] of verdicts) {
    if (v.checked !== true) continue;
    Object.defineProperty(items, String(id), {
      value: { checkedAt: new Date(nowMs).toISOString(), done: v.done, pr: v.pr ?? null },
      enumerable: true, writable: true, configurable: true,
    });
  }
  return { items };
}

// ── THIN FS/IO SHELL ──────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_ROOT = resolve(HERE, '..', '..');

export function cacheStorePath(root = CACHE_ROOT) {
  return join(root, '.conveyor', 'already-done-cache.json');
}

export function resolveAlreadyDoneCacheStorePath() {
  const env = process.env.WE_DISPATCH_PLAN_ALREADY_DONE_CACHE_FILE;
  return env && env.trim() ? env.trim() : cacheStorePath();
}

export function readAlreadyDoneCacheState(path = resolveAlreadyDoneCacheStorePath()) {
  try {
    if (!existsSync(path)) return emptyCacheState();
    return parseCacheState(readFileSync(path, 'utf8'));
  } catch {
    return emptyCacheState();
  }
}

export function writeAlreadyDoneCacheState(state, path = resolveAlreadyDoneCacheStorePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeCacheState(state));
  renameSync(tmp, path);
}
