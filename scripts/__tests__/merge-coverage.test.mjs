/**
 * @file scripts/__tests__/merge-coverage.test.mjs
 * @description Unit harness for the sharded-coverage fan-in (#2682).
 *
 * The `test` CI gate shards vitest across N runners; merge-coverage.mjs fans the per-shard
 * `coverage-final.json` reports back in and applies the #2082 80% bar to the COMBINED result. That
 * merge is load-bearing for soundness — if it under-counted, a shard split could manufacture a false
 * green the item exists to make impossible. So the two pure seams are regression-tested directly:
 *   - mergeCoverageFiles: two partial shard reports sum to the same hits as a single full run.
 *   - evaluateThresholds: passes at/above the bar, fails below it, on every metric.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeCoverageFiles, evaluateThresholds, findCoverageFiles } from '../merge-coverage.mjs';

// Istanbul coverage-final.json for one file with 2 statements / 2 functions / 2 branches, shaped like a
// real v8 report (locations are required by istanbul's summary computation). Shard A exercises the first
// of each metric; shard B the second — merged they cover everything.
function fileCov({ s, f, b }) {
  const loc = (line) => ({ start: { line, column: 0 }, end: { line, column: 20 } });
  return {
    '/repo/src/x.ts': {
      path: '/repo/src/x.ts',
      statementMap: { 0: loc(1), 1: loc(2) },
      fnMap: {
        0: { name: 'a', decl: loc(1), loc: loc(1), line: 1 },
        1: { name: 'b', decl: loc(2), loc: loc(2), line: 2 },
      },
      branchMap: {
        0: { loc: loc(1), type: 'if', locations: [loc(1)], line: 1 },
        1: { loc: loc(2), type: 'if', locations: [loc(2)], line: 2 },
      },
      s: { 0: s[0], 1: s[1] },
      f: { 0: f[0], 1: f[1] },
      b: { 0: [b[0]], 1: [b[1]] },
    },
  };
}

let dir;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'merge-cov-'));
  const a = join(dir, 'shard-a');
  const b = join(dir, 'shard-b');
  mkdirSync(a);
  mkdirSync(b);
  // Shard A: hits index 0 of each metric; shard B: hits index 1. Union = full coverage.
  writeFileSync(join(a, 'coverage-final.json'), JSON.stringify(fileCov({ s: [1, 0], f: [1, 0], b: [1, 0] })));
  writeFileSync(join(b, 'coverage-final.json'), JSON.stringify(fileCov({ s: [0, 1], f: [0, 1], b: [0, 1] })));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('findCoverageFiles', () => {
  it('recursively finds every coverage-final.json under a root', () => {
    expect(findCoverageFiles(dir).length).toBe(2);
  });
});

describe('mergeCoverageFiles', () => {
  it('sums per-shard hits so merged coverage equals a full run (100%)', () => {
    const summary = mergeCoverageFiles(findCoverageFiles(dir)).getCoverageSummary();
    for (const m of ['lines', 'statements', 'functions', 'branches']) {
      expect(summary[m].pct).toBe(100);
    }
  });

  it('a single shard alone is only partially covered', () => {
    const oneShard = findCoverageFiles(join(dir, 'shard-a'));
    const summary = mergeCoverageFiles(oneShard).getCoverageSummary();
    expect(summary.functions.pct).toBe(50);
  });
});

describe('evaluateThresholds', () => {
  const summary = { lines: { pct: 85, covered: 85, total: 100 }, statements: { pct: 82, covered: 82, total: 100 }, functions: { pct: 90, covered: 9, total: 10 }, branches: { pct: 79, covered: 79, total: 100 } };

  it('fails when any metric is below the bar', () => {
    const { failed, results } = evaluateThresholds(summary, 80);
    expect(failed).toBe(true); // branches 79 < 80
    expect(results.find((r) => r.metric === 'branches').ok).toBe(false);
    expect(results.find((r) => r.metric === 'lines').ok).toBe(true);
  });

  it('passes when every metric meets the bar', () => {
    const { failed } = evaluateThresholds(summary, 75);
    expect(failed).toBe(false);
  });
});
