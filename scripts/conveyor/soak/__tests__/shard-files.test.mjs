import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shardFiles, parseShardArg, listBreakTestFiles, BASELINE_FILE } from '../shard-files.mjs';

describe('soak shard-files — deterministic baseline-alone + round-robin break split', () => {
  it('shard 1 of N>1 is the baseline alone', () => {
    const files = shardFiles({ shard: 1, total: 4 });
    expect(files).toEqual(['scripts/conveyor/soak/daemon-soak.soak.test.mjs']);
  });

  it('shards 2..N split every break file, none dropped, none duplicated', () => {
    const total = 4;
    const breakFiles = listBreakTestFiles();
    const seen = [];
    for (let shard = 2; shard <= total; shard += 1) {
      const files = shardFiles({ shard, total });
      // every non-baseline file assigned actually lives in breaks/
      for (const f of files) expect(f).toMatch(/^scripts\/conveyor\/soak\/breaks\/.*\.soak\.test\.mjs$/);
      seen.push(...files);
    }
    expect(seen.length).toBe(breakFiles.length);
    expect(new Set(seen).size).toBe(breakFiles.length); // no duplicates
  });

  it('total=1 runs everything in the single shard (baseline + every break)', () => {
    const files = shardFiles({ shard: 1, total: 1 });
    const breakFiles = listBreakTestFiles();
    expect(files.length).toBe(1 + breakFiles.length);
    expect(files[0]).toBe('scripts/conveyor/soak/daemon-soak.soak.test.mjs');
  });

  // Real append/insert fixtures (a temp `breaks/` dir via the `breaksDir` override), not two calls on one list.
  function assignments(names, total = 4) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-shard-'));
    try {
      for (const n of names) writeFileSync(join(dir, n), '');
      const out = {};
      for (let shard = 2; shard <= total; shard += 1) {
        for (const f of shardFiles({ shard, total, breaksDir: dir, repoRoot: dir })) out[f.split('/').pop()] = shard;
      }
      return out;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const BASE = ['b.soak.test.mjs', 'd.soak.test.mjs', 'f.soak.test.mjs', 'h.soak.test.mjs', 'j.soak.test.mjs', 'l.soak.test.mjs'];

  it('appending a break (sorts last) keeps every existing file in its shard', () => {
    const before = assignments(BASE);
    const after = assignments([...BASE, 'z.soak.test.mjs']);
    for (const f of BASE) expect(after[f], f).toBe(before[f]);
    expect(after['z.soak.test.mjs']).toBeDefined();
  });

  it('inserting a break mid-list keeps every file that sorts before it in its shard', () => {
    const before = assignments(BASE);
    const after = assignments([...BASE, 'g.soak.test.mjs']); // sorts between f and h
    for (const f of BASE.filter((n) => n < 'g.soak.test.mjs')) expect(after[f], f).toBe(before[f]);
    // Files sorting AFTER the insert may shift a bucket under index round-robin — allowed, not required.
  });

  it('more shards than break files leaves the extra shards empty, not erroring', () => {
    const total = 30; // way more than the 18 known breaks
    const emptyShards = [];
    for (let shard = 2; shard <= total; shard += 1) {
      if (shardFiles({ shard, total }).length === 0) emptyShards.push(shard);
    }
    expect(emptyShards.length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range or malformed shard index', () => {
    expect(() => shardFiles({ shard: 0, total: 4 })).toThrow();
    expect(() => shardFiles({ shard: 5, total: 4 })).toThrow();
    expect(() => shardFiles({ shard: 1, total: 0 })).toThrow();
  });

  it('BASELINE_FILE resolves to the 50-tick soak test', () => {
    expect(BASELINE_FILE).toMatch(/daemon-soak\.soak\.test\.mjs$/);
  });
});

describe('parseShardArg', () => {
  it('parses --shard=i/N', () => {
    expect(parseShardArg(['--shard=2/4'])).toEqual({ shard: 2, total: 4 });
  });

  it('throws a usage error when missing', () => {
    expect(() => parseShardArg([])).toThrow(/usage/);
  });

  it('throws on malformed values', () => {
    expect(() => parseShardArg(['--shard=abc'])).toThrow();
    expect(() => parseShardArg(['--shard=2'])).toThrow();
  });
});
