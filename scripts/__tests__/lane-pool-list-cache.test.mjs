/**
 * @file scripts/__tests__/lane-pool-list-cache.test.mjs
 * @description Unit proof of the #x3cepr4 shared `list --acquirable` cache (`scripts/lib/lane-pool-list-cache.mjs`):
 *   a TTL'd result file so a caller within the freshness window reuses a prior scan outright, plus a scan lock
 *   so parallel callers racing a cold cache share ONE scan rather than each re-scanning the whole pool. Drives
 *   the module directly against a real temp pool dir (never the machine pool root), with injected clock/sleep
 *   for the concurrency case (mirrors `scripts/readiness/__tests__/drain-lock.test.mjs`'s own pattern).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserve, releaseLockDir } from '../readiness/file-locks.mjs';
import {
  DEFAULT_LIST_CACHE_TTL_MS, LIST_CACHE_TTL_ENV, resolveListCacheTtlMs,
  readListCacheRaw, readFreshListCache, writeListCache, invalidateListCache,
  listAcquirableCached, scanLockRootFor, listCacheFilePathFor, SCAN_LOCK_PATH, SCAN_LOCK_LEASE_MINUTES,
} from '../lib/lane-pool-list-cache.mjs';

const T0 = Date.parse('2026-09-23T12:00:00.000Z');

let poolDir;
beforeEach(() => { poolDir = mkdtempSync(join(tmpdir(), 'lane-pool-list-cache-')); });
afterEach(() => { try { rmSync(poolDir, { recursive: true, force: true }); } catch { /* best-effort */ } });

describe('resolveListCacheTtlMs — TTL setting (default 30s, env override)', () => {
  it('defaults to 30s with no env var', () => {
    expect(resolveListCacheTtlMs({})).toBe(DEFAULT_LIST_CACHE_TTL_MS);
    expect(DEFAULT_LIST_CACHE_TTL_MS).toBe(30_000);
  });
  it('honors a valid numeric env override', () => {
    expect(resolveListCacheTtlMs({ [LIST_CACHE_TTL_ENV]: '5000' })).toBe(5000);
    expect(resolveListCacheTtlMs({ [LIST_CACHE_TTL_ENV]: '0' })).toBe(0);
  });
  it('falls back to the default on an invalid/negative env value', () => {
    expect(resolveListCacheTtlMs({ [LIST_CACHE_TTL_ENV]: 'not-a-number' })).toBe(DEFAULT_LIST_CACHE_TTL_MS);
    expect(resolveListCacheTtlMs({ [LIST_CACHE_TTL_ENV]: '-5' })).toBe(DEFAULT_LIST_CACHE_TTL_MS);
  });
});

describe('listAcquirableCached — TTL hit', () => {
  it('reuses a fresh cache with NO scan call', () => {
    writeListCache(poolDir, ['/pool/lane-1'], T0);
    let calls = 0;
    const result = listAcquirableCached(poolDir, () => { calls++; return ['/pool/lane-SHOULD-NOT-APPEAR']; }, {
      nowMs: T0 + 5_000, ttlMs: 30_000,
    });
    expect(calls).toBe(0);
    expect(result).toMatchObject({ paths: ['/pool/lane-1'], scanned: false });
  });
});

describe('listAcquirableCached — expiry', () => {
  it('a cache older than the TTL is rescanned, and the fresh result replaces it', () => {
    writeListCache(poolDir, ['/pool/lane-OLD'], T0);
    // `now` is pinned to the SAME instant as `nowMs` — the lock-path's own internal freshness rechecks call
    // `now()` (real Date.now() by default, since a genuine wait polls a real advancing clock); pinning it here
    // keeps this test's assertions decoupled from wall-clock time rather than relying on the two happening to
    // agree because the sandbox's real clock is near `T0`.
    const result = listAcquirableCached(poolDir, () => ['/pool/lane-NEW'], {
      nowMs: T0 + 40_000, ttlMs: 30_000, now: () => T0 + 40_000,
    });
    expect(result).toMatchObject({ paths: ['/pool/lane-NEW'], scanned: true });
    // The rescan published a fresh entry — a later reader within ITS ttl sees the new result.
    expect(readFreshListCache(poolDir, T0 + 40_000, 30_000)).toEqual(['/pool/lane-NEW']);
  });

  it('an unreadable/corrupt cache file reads as absent — rescans rather than throwing', () => {
    mkdirSync(join(poolDir, '.lane-pool-list-cache'), { recursive: true });
    writeFileSync(listCacheFilePathFor(poolDir), 'not valid json {{{', 'utf8');
    expect(readListCacheRaw(poolDir)).toBeNull();
    const result = listAcquirableCached(poolDir, () => ['/pool/lane-FRESH'], { nowMs: T0, ttlMs: 30_000, now: () => T0 });
    expect(result).toMatchObject({ paths: ['/pool/lane-FRESH'], scanned: true });
  });
});

describe('invalidateListCache', () => {
  it('drops a fresh cache, forcing the next read to rescan even well within the TTL', () => {
    writeListCache(poolDir, ['/pool/lane-1'], T0);
    expect(readFreshListCache(poolDir, T0 + 1_000, 30_000)).toEqual(['/pool/lane-1']); // fresh, pre-invalidate
    invalidateListCache(poolDir);
    let calls = 0;
    const result = listAcquirableCached(poolDir, () => { calls++; return ['/pool/lane-2']; }, {
      nowMs: T0 + 1_000, ttlMs: 30_000, now: () => T0 + 1_000,
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ paths: ['/pool/lane-2'], scanned: true });
  });

  it('is idempotent when no cache exists yet', () => {
    expect(() => invalidateListCache(poolDir)).not.toThrow();
  });
});

describe('listAcquirableCached — concurrent callers share one scan', () => {
  it('a waiter blocked on an in-flight scan reuses the winner\'s published result instead of scanning itself', () => {
    // Simulate caller "A" already mid-scan: it holds the scan lock this module's own lock root/path key.
    const lockRoot = scanLockRootFor(poolDir);
    const acqA = reserve(lockRoot, SCAN_LOCK_PATH, 'A', T0, new Date(T0).toISOString(), 111, 'unknown', SCAN_LOCK_LEASE_MINUTES);
    expect(acqA.ok).toBe(true);

    let scanCountB = 0;
    let published = false;
    let clock = T0;
    const now = () => clock;
    // Each "poll tick" B takes, simulate A finishing its scan on the FIRST tick: A publishes the cache and
    // releases its lock — exactly what a real concurrent process would do right after its own scan returns.
    const sleep = () => {
      clock += 100;
      if (!published) {
        writeListCache(poolDir, ['/pool/lane-FROM-A'], now());
        releaseLockDir(lockRoot, SCAN_LOCK_PATH);
        published = true;
      }
    };

    const result = listAcquirableCached(poolDir, () => { scanCountB++; return ['/pool/lane-FROM-B']; }, {
      nowMs: T0, ttlMs: 30_000, owner: 'B', waitMs: 5_000, pollMs: 100, now, sleep,
    });

    expect(scanCountB).toBe(0); // B NEVER ran its own scan — it reused A's published result
    expect(result).toMatchObject({ paths: ['/pool/lane-FROM-A'], scanned: false });
  });

  it('falls back to an unlocked scan of its own if the holder never frees the lock within the wait budget', () => {
    const lockRoot = scanLockRootFor(poolDir);
    reserve(lockRoot, SCAN_LOCK_PATH, 'A', T0, new Date(T0).toISOString(), 111, 'unknown', SCAN_LOCK_LEASE_MINUTES);
    // A never releases and never publishes — B must not hang forever.
    let clock = T0;
    const now = () => clock;
    const sleep = (ms) => { clock += ms; };

    const result = listAcquirableCached(poolDir, () => ['/pool/lane-FROM-B'], {
      nowMs: T0, ttlMs: 30_000, owner: 'B', waitMs: 1_000, pollMs: 200, now, sleep,
    });

    expect(result).toMatchObject({ paths: ['/pool/lane-FROM-B'], scanned: true, contended: true });
  });
});
