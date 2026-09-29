/** Unit proof of the per-item already-done cooldown (#xp12dod): pure state and fail-open IO. */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALREADY_DONE_NOT_DONE_COOLDOWN_MS, ALREADY_DONE_DONE_COOLDOWN_MS,
  emptyCacheState, parseCacheState, serializeCacheState, isCacheEntryFresh,
  getCachedVerdict, recordVerdicts, readAlreadyDoneCacheState, writeAlreadyDoneCacheState,
} from '../already-done-cache.mjs';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const entry = (done, age = 0) => ({ checkedAt: new Date(NOW - age).toISOString(), done, pr: null });
const tmpDirs = [];
function tmpStore() {
  const dir = mkdtempSync(join(tmpdir(), 'already-done-cache-test-'));
  tmpDirs.push(dir);
  return join(dir, 'cache.json');
}
afterEach(() => { for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('already-done-cache — freshness and lookup (pure)', () => {
  it.each([
    [false, ALREADY_DONE_NOT_DONE_COOLDOWN_MS],
    [true, ALREADY_DONE_DONE_COOLDOWN_MS],
  ])('expires done:%s at its own cooldown boundary', (done, cooldown) => {
    expect(isCacheEntryFresh(entry(done), NOW)).toBe(true);
    expect(isCacheEntryFresh(entry(done, cooldown - 1), NOW)).toBe(true);
    expect(isCacheEntryFresh(entry(done, cooldown), NOW)).toBe(false);
    expect(isCacheEntryFresh(entry(done, cooldown + 1), NOW)).toBe(false);
  });
  it('retains done verdicts longer than not-done verdicts', () => {
    expect(isCacheEntryFresh(entry(true, ALREADY_DONE_NOT_DONE_COOLDOWN_MS), NOW)).toBe(true);
  });
  it.each([null, undefined, {}, { checkedAt: 'garbage' }, entry(false, -1)])('rejects missing, invalid, or future dates: %j', (value) => {
    expect(isCacheEntryFresh(value, NOW)).toBe(false);
  });
  it('accepts injected cooldown windows, including zero', () => {
    expect(isCacheEntryFresh(entry(false, 9), NOW, { notDoneCooldownMs: 10 })).toBe(true);
    expect(isCacheEntryFresh(entry(true, 10), NOW, { doneCooldownMs: 10 })).toBe(false);
    expect(isCacheEntryFresh(entry(false), NOW, { notDoneCooldownMs: 0 })).toBe(false);
  });
  it('returns the cached verdict and PR, or null for absent and expired ids', () => {
    const pr = { number: 123, url: 'https://example.test/pr/123' };
    const state = { items: { '1': { ...entry(true), pr }, '2': entry(false, ALREADY_DONE_NOT_DONE_COOLDOWN_MS), '3': entry(false) } };
    expect(getCachedVerdict(state, 1, NOW)).toEqual({ done: true, pr });
    expect(getCachedVerdict(state, '3', NOW)).toEqual({ done: false, pr: null });
    expect(getCachedVerdict(state, 'missing', NOW)).toBeNull();
    expect(getCachedVerdict(state, '2', NOW)).toBeNull();
    expect(getCachedVerdict(state, '1', NOW, { doneCooldownMs: 0 })).toBeNull();
  });
});

describe('already-done-cache — recording and parsing (pure)', () => {
  it.each(['map', 'object'])('records only checked:true verdicts from a %s without mutating input', (kind) => {
    const state = { items: { existing: entry(true, 100), retry: entry(false, 100) } };
    const snapshot = structuredClone(state);
    const verdicts = {
      success: { checked: true, done: true, pr: { number: 321 } },
      notDone: { checked: true, done: false },
      failure: { checked: false, done: false },
      retry: { checked: false, done: false },
      unchecked: { done: true },
    };
    const result = recordVerdicts(state, kind === 'map' ? new Map(Object.entries(verdicts)) : verdicts, NOW);
    expect(result).toEqual({ items: { ...snapshot.items,
      success: { ...entry(true), pr: { number: 321 } }, notDone: entry(false),
    } });
    expect(result.items).not.toHaveProperty('failure');
    expect(result.items).not.toHaveProperty('unchecked');
    expect(result).not.toBe(state);
    expect(result.items).not.toBe(state.items);
    expect(state).toEqual(snapshot);
    expect(recordVerdicts(result, { success: { checked: true, done: false } }, NOW + 1).items.success)
      .toEqual({ checkedAt: new Date(NOW + 1).toISOString(), done: false, pr: null });
  });
  it.each([undefined, null, '', '   ', '{garbage', 'null', '42', '"text"', '[]', '{}', '{"items":null}', '{"items":[]}', '{"items":1}'])('fails open for %j', (text) => {
    expect(parseCacheState(text)).toEqual(emptyCacheState());
  });
  it('round-trips a well-formed store and drops individually malformed entries', () => {
    const good = { ...entry(true), pr: { number: 321 } };
    const state = { items: { good } };
    expect(serializeCacheState(state)).toBe(JSON.stringify(state, null, 2) + '\n');
    expect(parseCacheState(serializeCacheState(state))).toEqual(state);
    expect(serializeCacheState({})).toBe(serializeCacheState(emptyCacheState()));
    expect(parseCacheState(JSON.stringify({ items: {
      good, missing: { done: true }, badDate: { checkedAt: 'bad', done: false },
      badDone: { ...entry(true), done: 'true' }, array: [], nil: null, scalar: 42,
    } }))).toEqual(state);
  });
});

describe('already-done-cache — IO shell', () => {
  it('reads a missing or corrupt store as empty without throwing', () => {
    const path = tmpStore();
    expect(readAlreadyDoneCacheState(path)).toEqual(emptyCacheState());
    writeFileSync(path, '{garbage');
    expect(() => readAlreadyDoneCacheState(path)).not.toThrow();
    expect(readAlreadyDoneCacheState(path)).toEqual(emptyCacheState());
    expect(readAlreadyDoneCacheState(tmpDirs[0])).toEqual(emptyCacheState());
  });
  it('atomically round-trips a non-trivial state, creating parent directories', () => {
    const path = join(tmpStore(), 'nested', 'cache.json');
    const state = { items: { '1': { ...entry(true), pr: { number: 123 } }, '2': entry(false, 100) } };
    writeAlreadyDoneCacheState(state, path);
    expect(readAlreadyDoneCacheState(path)).toEqual(state);
    writeAlreadyDoneCacheState(emptyCacheState(), path);
    expect(readAlreadyDoneCacheState(path)).toEqual(emptyCacheState());
    expect(readdirSync(join(tmpDirs[0], 'cache.json', 'nested'))).toEqual(['cache.json']);
  });
});
