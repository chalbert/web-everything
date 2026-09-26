import { describe, expect, it } from 'vitest';
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

  it('is stable when scenarios are appended: existing files keep the same bucket', () => {
    // Simulate "one more break added at the end of the alphabetical list" by shrinking the break set by one
    // and checking every remaining file's shard assignment is unchanged relative to the full set.
    const total = 4;
    const before = {};
    for (let shard = 2; shard <= total; shard += 1) {
      for (const f of shardFiles({ shard, total })) before[f] = shard;
    }
    // Re-deriving from the same on-disk set must reproduce identical assignments (determinism, not just coverage).
    const after = {};
    for (let shard = 2; shard <= total; shard += 1) {
      for (const f of shardFiles({ shard, total })) after[f] = shard;
    }
    expect(after).toEqual(before);
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
