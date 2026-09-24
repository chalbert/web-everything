/**
 * @file scripts/lib/lane-pool-list-cache.mjs
 * @description #x3cepr4 — a short, shared cache for `lane-pool.mjs list --acquirable` (and its `--json`
 *   sibling), the single biggest load on 2026-09-23: each call re-scans EVERY lane in the pool (82 lanes,
 *   ~28s standalone, over 20 minutes under concurrent load — #3383's own incident numbers), and
 *   `dispatch-plan.mjs`'s CLI shelled it on every dispatch tick alongside every other real caller (the
 *   fixture-harness test, `/conveyor`'s tick, `/workflow`'s coupling, an ad-hoc capacity check), so N callers
 *   within the same few seconds each paid the full scan independently.
 *
 * TWO HALVES:
 *   1. A TTL'd RESULT FILE under the pool dir ({@link readFreshListCache} / {@link writeListCache} /
 *      {@link invalidateListCache}) — a caller within the TTL of the last scan reuses its result outright, no
 *      lock needed. Default TTL 30s ({@link DEFAULT_LIST_CACHE_TTL_MS}), env-overridable
 *      ({@link LIST_CACHE_TTL_ENV}), matching the pattern `dispatch-plan.mjs`'s own
 *      `ALREADY_DONE_AGE_GATE_ENV` sets — a policy knob, not a magic number nothing can retune. A stale OR
 *      unreadable/corrupt cache file is treated as absent — rescan, never trust a read that fails to parse
 *      cleanly.
 *   2. A SCAN LOCK ({@link listAcquirableCached}), built on the SAME atomic mkdir + TTL-lease primitive
 *      `scripts/readiness/drain-lock.mjs`'s numbering mutex uses (`scripts/readiness/file-locks.mjs`'s
 *      `reserve`/`readLockEntry`/`releaseLockDir` — reused, never forked) — so N callers racing a cold/expired
 *      cache do not each launch their own full scan: the first wins the lock and scans; the rest poll (cheap —
 *      re-reading the small cache file, never re-scanning) until either the winner's fresh result appears or
 *      the lock's own generous lease elapses, in which case a caller falls back to an UNLOCKED scan of its own
 *      rather than hang forever (mirrors `withNumberingLock`'s never-hang fallback).
 *
 * CORRECTNESS BOUNDARY (#x3cepr4's own ruling, load-bearing): this cache is for the READ-ONLY capacity QUERY
 * (`list --acquirable`) ONLY. `lane-pool.mjs acquire` NEVER goes through it — it keeps doing its own live
 * per-lane check before claiming a lane (unchanged), because handing out a lane off a stale reading (another
 * session may have leased/dirtied it since the cache was taken) is a correctness bug, not a performance one.
 * Every lane-state-changing command (`acquire`, `release`, `adopt`, `provision`, `remove`, `refresh`) calls
 * {@link invalidateListCache} so the NEXT `list --acquirable` after a mutation always re-scans rather than
 * serving a picture that is already known-wrong (as opposed to merely up-to-`TTL`-old).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { reserve, readLockEntry, releaseLockDir } from '../readiness/file-locks.mjs';
// #x3jmao3 precedent, reused rather than re-implemented (mirrors lane-pool.mjs's own import of the same fn).
import { sleepSyncMs } from '../readiness/drain-lock.mjs';

/** Default freshness window for a cached `list --acquirable` result. Short enough that a real lane-state
 *  change (a lease taken/dropped seconds ago) is visible again soon; long enough that the burst of callers
 *  #3383's incident named (several ticks/dispatches/tests within the same few seconds) share one scan. */
export const DEFAULT_LIST_CACHE_TTL_MS = 30_000;

/** Env override for {@link DEFAULT_LIST_CACHE_TTL_MS}. Unset/non-numeric/negative ⇒ the default applies. */
export const LIST_CACHE_TTL_ENV = 'WE_LANE_POOL_LIST_CACHE_TTL_MS';

/** Resolve the effective TTL: `env`'s override if present and a valid non-negative number, else the default.
 *  Pure (clock-free) aside from the injected `env`, so it's directly unit-testable. */
export function resolveListCacheTtlMs(env = process.env) {
  const n = Number(env?.[LIST_CACHE_TTL_ENV]);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIST_CACHE_TTL_MS;
}

const CACHE_SUBDIR = '.lane-pool-list-cache';
const CACHE_FILENAME = 'acquirable.json';
/** The scan lock's own lock-dir root, kept SEPARATE from the result-file dir so a corrupt/partial result
 *  write can never be mistaken for (or collide with) a held lock, and vice versa. */
const LOCK_SUBDIR = '.lane-pool-list-cache-lock';
/** file-locks keys a lock dir by a hash of this string — a fixed sentinel is fine since ONE pool dir only
 *  ever runs ONE `list --acquirable` scan lock (mirrors `drain-lock.mjs`'s fixed `NUMBERING_LOCK_PATH`). */
export const SCAN_LOCK_PATH = '<lane-pool:list-acquirable-scan>';
/** Generous — a real scan can run ~28s standalone and MINUTES under concurrent host load (#3383's own
 *  incident numbers); this must comfortably outlast a genuinely slow-but-live scan so it is never falsely
 *  reclaimed out from under it, while still self-healing within one session if the scanning process crashed. */
export const SCAN_LOCK_LEASE_MINUTES = 15;

function cacheDir(poolDir) { return join(poolDir, CACHE_SUBDIR); }
function cacheFile(poolDir) { return join(cacheDir(poolDir), CACHE_FILENAME); }

/** The scan lock's lock-dir root for a pool — exported so tests can simulate a concurrent holder directly
 *  against `file-locks.mjs`'s primitives without reaching into this module's private constants. */
export function scanLockRootFor(poolDir) { return join(poolDir, LOCK_SUBDIR); }

/** The cache file's absolute path — exported for tests that need to write a corrupt/partial file directly. */
export function listCacheFilePathFor(poolDir) { return cacheFile(poolDir); }

/** Read the raw cache entry (`{ ts, paths }`) or `null` if absent/corrupt/malshaped. Never throws. */
export function readListCacheRaw(poolDir) {
  const file = cacheFile(poolDir);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!raw || typeof raw.ts !== 'number' || !Array.isArray(raw.paths)) return null;
    return raw;
  } catch {
    return null; // corrupt/half-written — read the same as absent, never throw into a caller's list/scan path
  }
}

/** Is a raw cache entry fresh at `nowMs` under `ttlMs`? Pure. */
export function isListCacheFresh(entry, nowMs, ttlMs) {
  return !!entry && (nowMs - entry.ts) <= ttlMs;
}

/** The cached `paths` array iff fresh at `nowMs`/`ttlMs`, else `null` (caller must rescan). */
export function readFreshListCache(poolDir, nowMs, ttlMs) {
  const entry = readListCacheRaw(poolDir);
  return isListCacheFresh(entry, nowMs, ttlMs) ? entry.paths : null;
}

/** Publish a fresh scan result. Best-effort directory creation, matching every other marker writer in
 *  lane-pool.mjs — a write failure here just means the next reader treats the cache as absent. */
export function writeListCache(poolDir, paths, nowMs = Date.now()) {
  mkdirSync(cacheDir(poolDir), { recursive: true });
  writeFileSync(cacheFile(poolDir), JSON.stringify({ ts: nowMs, paths }, null, 2) + '\n', 'utf8');
}

/**
 * Drop the cache — called by every lane-state-changing command (#x3cepr4: acquire, release, adopt, provision,
 * remove, refresh) so the NEXT `list --acquirable` never serves a picture already known stale. Idempotent;
 * best-effort (a failed unlink just means the TTL is the only freshness floor for one extra cycle).
 */
export function invalidateListCache(poolDir) {
  try { rmSync(cacheFile(poolDir), { force: true }); } catch { /* best-effort */ }
}

function tryAcquireScanLock(lockRoot, owner, nowMs) {
  return reserve(lockRoot, SCAN_LOCK_PATH, owner, nowMs, new Date(nowMs).toISOString(), process.pid, 'unknown', SCAN_LOCK_LEASE_MINUTES);
}
function releaseScanLockIfOwned(lockRoot, owner) {
  const cur = readLockEntry(lockRoot, SCAN_LOCK_PATH);
  if (cur && cur.owner === owner) releaseLockDir(lockRoot, SCAN_LOCK_PATH);
}

/**
 * The cached `list --acquirable` read (#x3cepr4). Returns the array of acquirable lane paths — from a fresh
 * cache when one exists, else from ONE shared `scan()` that every concurrent caller within the wait budget
 * reuses rather than duplicating.
 *
 * NEVER used by `acquire`'s own lane-selection — see this file's header. `lane-pool.mjs list --acquirable`
 * and `dispatch-plan.mjs` (when it has no `--free-lanes-json` override) are the intended callers.
 *
 * @param {string} poolDir - `repo.poolDir` (the cache lives alongside the pool, never inside a lane).
 * @param {() => string[]} scan - the real (expensive) scan; called at most once per cache miss per winner.
 * @param {object} [opts]
 * @param {number} [opts.nowMs]
 * @param {number} [opts.ttlMs]
 * @param {string} [opts.owner] - the lock owner id (defaults to a host+pid identity, distinct per real process).
 * @param {number} [opts.waitMs] - how long to wait for an in-flight scan before falling back to an unlocked
 *   scan of its own (defaults to the lock's own lease, mirroring `withNumberingLock`'s never-hang fallback).
 * @param {number} [opts.pollMs]
 * @param {() => number} [opts.now] - injectable clock (tests).
 * @param {(ms:number) => void} [opts.sleep] - injectable sleep (tests).
 * @returns {{ paths: string[], scanned: boolean, contended?: boolean }}
 */
export function listAcquirableCached(poolDir, scan, {
  nowMs = Date.now(),
  ttlMs = resolveListCacheTtlMs(),
  owner = `${hostname()}:${process.pid}`,
  waitMs = SCAN_LOCK_LEASE_MINUTES * 60_000,
  pollMs = 200,
  now = Date.now,
  sleep = sleepSyncMs,
} = {}) {
  const fresh = readFreshListCache(poolDir, nowMs, ttlMs);
  if (fresh) return { paths: fresh, scanned: false };

  const lockRoot = scanLockRootFor(poolDir);
  const deadline = now() + waitMs;
  let acq = tryAcquireScanLock(lockRoot, owner, now());
  while (!acq.ok && now() < deadline) {
    // Someone else is scanning — before waiting more, see if they already finished and published: that lets
    // a waiter return the moment a fresh result appears, without waiting out the whole lock lease.
    const maybeFresh = readFreshListCache(poolDir, now(), ttlMs);
    if (maybeFresh) return { paths: maybeFresh, scanned: false };
    sleep(pollMs);
    acq = tryAcquireScanLock(lockRoot, owner, now());
  }
  if (!acq.ok) {
    // Pathological: the lock never freed within the (generous) budget. Never hang the caller forever —
    // mirrors `withNumberingLock`'s degrade-to-unlocked fallback. Correctness is unaffected (this is a
    // read-only capacity picker, not `acquire`); only the sharing benefit is lost for this one caller.
    return { paths: scan(), scanned: true, contended: true };
  }
  try {
    // Re-check freshness now that we hold the lock: the previous holder may have finished and published
    // between our last poll and winning the lock.
    const freshNow = readFreshListCache(poolDir, now(), ttlMs);
    if (freshNow) return { paths: freshNow, scanned: false };
    const paths = scan();
    writeListCache(poolDir, paths, now());
    return { paths, scanned: true };
  } finally {
    releaseScanLockIfOwned(lockRoot, owner);
  }
}
