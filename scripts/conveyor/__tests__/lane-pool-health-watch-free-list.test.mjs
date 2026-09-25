/**
 * @file lane-pool-health-watch-free-list.test.mjs
 * @description Proof of #4122 — `lane-pool-health-watch.mjs` publishes the free-lane list
 *   `we:scripts/lane-pool.mjs acquire` reads as a fast pre-filter, from this SAME tick's already-computed real
 *   `list --acquirable` eligibility read (never the plan-only estimate — see `freeLaneRows`'s own docblock for
 *   why those two can diverge). Covers: `freeLaneRows` (pure) and `watchLanePoolHealth`'s wiring over an
 *   injected `writeFreeLaneList` (no real file, no real subprocess).
 */
import { describe, it, expect } from 'vitest';
import { freeLaneRows, defaultWriteFreeLaneList, watchLanePoolHealth } from '../lane-pool-health-watch.mjs';

describe('freeLaneRows — pure', () => {
  const lanes = [
    { lane: 1, path: '/pool/lane-1', head: 'aaa', branch: 'main', exists: true, leased: false },
    { lane: 2, path: '/pool/lane-2', head: 'bbb', branch: 'main', exists: true, leased: true }, // leased — never a candidate
    { lane: 3, path: '/pool/lane-3', head: 'ccc', branch: 'main', exists: true, leased: false }, // real but NOT in acquirableLaneNumbers (dirty/ahead)
    { lane: 4, exists: false }, // no clone on disk
  ];

  it('null acquirableLaneNumbers (real read unavailable this tick) yields an EMPTY list — never the plan-only guess', () => {
    expect(freeLaneRows(lanes, null)).toEqual([]);
  });

  it('includes only unleased, existing lanes the REAL eligibility read named', () => {
    const rows = freeLaneRows(lanes, new Set([1, 2, 3]));
    // lane 2 dropped (leased) even though it's in the acquirable set — leased always wins
    expect(rows).toEqual([{ lane: 1, path: '/pool/lane-1', head: 'aaa', branch: 'main' }, { lane: 3, path: '/pool/lane-3', head: 'ccc', branch: 'main' }]);
  });

  it('a lane the real read did NOT name is excluded even if unleased and existing', () => {
    const rows = freeLaneRows(lanes, new Set([1]));
    expect(rows.map((r) => r.lane)).toEqual([1]);
  });

  it('missing head/branch degrade to null, never undefined (keeps the on-disk shape stable)', () => {
    const rows = freeLaneRows([{ lane: 5, path: '/pool/lane-5', exists: true, leased: false }], new Set([5]));
    expect(rows).toEqual([{ lane: 5, path: '/pool/lane-5', head: null, branch: null }]);
  });
});

describe('watchLanePoolHealth — free-lane-list publish wiring (#4122)', () => {
  const baseDeps = () => ({
    listStatus: () => ({
      repo: 'web-everything', root: '/pool/web-everything',
      lanes: [
        { lane: 1, path: '/pool/web-everything/lane-1', head: 'aaa', branch: 'main', exists: true, leased: false, clean: true },
        { lane: 2, path: '/pool/web-everything/lane-2', head: 'bbb', branch: 'main', exists: true, leased: true, clean: true },
      ],
    }),
    readPorcelain: () => '',
    reap: () => ({ complete: true }),
    trimPool: () => null,
    listWhois: () => null,
    reclaimEnabled: false,
  });

  it('publishes when the real eligibility read succeeds — passes the repo/pool/rows through untouched', () => {
    let received = null;
    const result = watchLanePoolHealth({
      ...baseDeps(),
      listAcquirable: () => new Set([1]),
      writeFreeLaneList: (args) => { received = args; return { path: '/pool/web-everything/.free-lanes.json', count: args.rows.length }; },
    });
    expect(received).toEqual({ repoName: 'web-everything', poolDir: '/pool/web-everything', rows: [{ lane: 1, path: '/pool/web-everything/lane-1', head: 'aaa', branch: 'main' }] });
    expect(result.freeLaneList).toEqual({ path: '/pool/web-everything/.free-lanes.json', count: 1 });
  });

  it('does NOT publish when the real eligibility read is unavailable this tick (null) — never the plan-only guess', () => {
    let called = false;
    const result = watchLanePoolHealth({
      ...baseDeps(),
      listAcquirable: () => null,
      writeFreeLaneList: () => { called = true; return { path: 'x', count: 0 }; },
    });
    expect(called).toBe(false);
    expect(result.freeLaneList).toBeNull();
  });

  it('STILL publishes on --dry-run — the list is a bookkeeping sidecar, not a pool-lane mutation', () => {
    let called = false;
    const result = watchLanePoolHealth({
      ...baseDeps(),
      dryRun: true,
      listAcquirable: () => new Set([1]),
      writeFreeLaneList: () => { called = true; return { path: 'x', count: 1 }; },
    });
    expect(called).toBe(true);
    expect(result.freeLaneList).toEqual({ path: 'x', count: 1 });
  });

  it('a write failure degrades to null, never throws (best-effort, like every other write in this file)', () => {
    const result = watchLanePoolHealth({
      ...baseDeps(),
      listAcquirable: () => new Set([1]),
      writeFreeLaneList: () => null, // defaultWriteFreeLaneList's own contract on failure
    });
    expect(result.freeLaneList).toBeNull();
  });
});

describe('defaultWriteFreeLaneList — IO shell over injected build/resolvePath/write (no real file)', () => {
  it('builds, resolves the path, writes, and reports the count', () => {
    const calls = [];
    const result = defaultWriteFreeLaneList({
      repoName: 'web-everything', poolDir: '/pool/web-everything', rows: [{ lane: 1, path: '/p/lane-1' }], writtenAt: 1000,
      build: (o) => { calls.push(['build', o]); return { v: 1, writtenAt: 1000, repo: o.repoName, poolDir: o.poolDir, lanes: o.lanes }; },
      resolvePath: (o) => { calls.push(['resolvePath', o]); return '/pool/web-everything/.free-lanes.json'; },
      write: (path, list) => { calls.push(['write', path, list]); },
    });
    expect(result).toEqual({ path: '/pool/web-everything/.free-lanes.json', count: 1 });
    expect(calls[0][0]).toBe('build');
    expect(calls[1][0]).toBe('resolvePath');
    expect(calls[2]).toEqual(['write', '/pool/web-everything/.free-lanes.json', { v: 1, writtenAt: 1000, repo: 'web-everything', poolDir: '/pool/web-everything', lanes: [{ lane: 1, path: '/p/lane-1' }] }]);
  });

  it('a throwing write degrades to null (best-effort, never crashes the whole health-watch pass)', () => {
    const result = defaultWriteFreeLaneList({
      repoName: 'web-everything', poolDir: '/pool/web-everything', rows: [],
      write: () => { throw new Error('disk full'); },
    });
    expect(result).toBeNull();
  });
});
