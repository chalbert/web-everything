/**
 * @file scripts/operations/__tests__/cache-hit-report.test.mjs
 * @description TESTS for cache hit rate and reads-per-write reporting from run records (#3521).
 */

import { describe, it, expect } from 'vitest';

import {
  extractUsageCounters,
  deriveCacheHitMetrics,
  extractInvocationRole,
  aggregateRoleCacheMetrics,
} from '../run-record.mjs';

import {
  formatPercentage,
  formatRatio,
  renderCacheHitReport,
  runCacheHitCli,
} from '../cache-hit-report.mjs';

import { createMemoryRunStore } from '../run-store.mjs';

/**
 * HAND-CONSTRUCTED FIXTURE WITH KNOWN SPLITS (#3521 Done-when #1)
 *
 * Known numbers:
 * 1. Role `correctness`:
 *    Run 1: read: 600, write: 300, input: 100  -> loaded: 1000, hitRate: 0.60 (60.0%), readsPerWrite: 2.00
 *    Run 2: read: 1200, write: 100, input: 100 -> loaded: 1400, hitRate: 0.8571..., readsPerWrite: 12.00
 *    Sum:   read: 1800, write: 400, input: 200 -> loaded: 2400
 *    Expected aggregate:
 *      hitRate = 1800 / 2400 = 0.75 (75.0%)
 *      readsPerWrite = 1800 / 400 = 4.50
 *
 * 2. Role `security` (Zero hit rate across repeated invocations):
 *    Run 1:
 *      Invocation 1: read: 0, write: 500, input: 500 -> loaded: 1000, hitRate: 0.00, readsPerWrite: 0.00
 *      Invocation 2: read: 0, write: 500, input: 500 -> loaded: 1000, hitRate: 0.00, readsPerWrite: 0.00
 *    Sum:   read: 0, write: 1000, input: 1000 -> loaded: 2000
 *    Expected aggregate:
 *      hitRate = 0 / 2000 = 0.00 (0.0%)
 *      readsPerWrite = 0 / 1000 = 0.00
 *      zeroHitAlert = true (2 repeated invocations with 0 cache hits)
 *
 * 3. Role `synthesize` (Zero-hit episode in Run 1, high hit rate in Run 2):
 *    Run 1 (repeated zero-hit invocations):
 *      Invocation 1: read: 0, write: 500, input: 500 -> loaded: 1000, hitRate: 0.00
 *      Invocation 2: read: 0, write: 500, input: 500 -> loaded: 1000, hitRate: 0.00
 *    Run 2 (warm cache):
 *      Invocation 3: read: 8000, write: 0, input: 0   -> loaded: 8000, hitRate: 1.00
 *    Sum:   read: 8000, write: 1000, input: 1000 -> loaded: 10000
 *    Expected aggregate:
 *      hitRate = 8000 / 10000 = 0.80 (80.0%)
 *      readsPerWrite = 8000 / 1000 = 8.00
 *      zeroHitAlert = true: Run 1's 2 repeated zero-hit invocations MUST BE SURFACED,
 *                           NOT silently averaged away into the 80.0% aggregate!
 */
export const KNOWN_SPLIT_RUNS = [
  {
    v: 1,
    id: 'run-known-1',
    op: 'review-pr',
    input: {},
    cursor: 2,
    findings: {},
    verdict: null,
    effects: [],
    pending: null,
    telemetry: [
      {
        step: 'judge',
        lens: 'correctness',
        usage: {
          cache_read_input_tokens: 600,
          cache_creation_input_tokens: 300,
          input_tokens: 100,
          output_tokens: 50,
        },
      },
      {
        step: 'judgeSecurity',
        lens: 'security',
        usage: {
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 500,
          input_tokens: 500,
          output_tokens: 20,
        },
      },
      {
        step: 'judgeSecurityRetry',
        lens: 'security',
        usage: {
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 500,
          input_tokens: 500,
          output_tokens: 20,
        },
      },
      {
        step: 'synthesize',
        usage: {
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 500,
          input_tokens: 500,
          output_tokens: 10,
        },
      },
      {
        step: 'synthesize',
        usage: {
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 500,
          input_tokens: 500,
          output_tokens: 10,
        },
      },
    ],
  },
  {
    v: 1,
    id: 'run-known-2',
    op: 'review-pr',
    input: {},
    cursor: 2,
    findings: {},
    verdict: null,
    effects: [],
    pending: null,
    telemetry: [
      {
        step: 'judge',
        lens: 'correctness',
        usage: {
          cache_read_input_tokens: 1200,
          cache_creation_input_tokens: 100,
          input_tokens: 100,
          output_tokens: 40,
        },
      },
      {
        step: 'synthesize',
        usage: {
          cache_read_input_tokens: 8000,
          cache_creation_input_tokens: 0,
          input_tokens: 0,
          output_tokens: 100,
        },
      },
    ],
  },
];

describe('extractUsageCounters', () => {
  it('reads standard CLI counter names', () => {
    const u = extractUsageCounters({
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 200,
      input_tokens: 100,
    });
    expect(u).toEqual({
      cacheRead: 500,
      cacheCreation: 200,
      input: 100,
      loaded: 800,
    });
  });

  it('reads short-form counter names when standard ones are absent', () => {
    const u = extractUsageCounters({
      cache_read: 300,
      cache_creation: 150,
      input: 50,
    });
    expect(u).toEqual({
      cacheRead: 300,
      cacheCreation: 150,
      input: 50,
      loaded: 500,
    });
  });

  it('degrades missing or non-numeric entries to 0 without throwing', () => {
    expect(extractUsageCounters({})).toEqual({ cacheRead: 0, cacheCreation: 0, input: 0, loaded: 0 });
    expect(extractUsageCounters(null)).toEqual({ cacheRead: 0, cacheCreation: 0, input: 0, loaded: 0 });
    expect(extractUsageCounters({ cache_read_input_tokens: 'NaN', input_tokens: -10 })).toEqual({
      cacheRead: 0,
      cacheCreation: 0,
      input: 0,
      loaded: 0,
    });
  });
});

describe('deriveCacheHitMetrics', () => {
  it('computes hit rate and reads-per-write accurately', () => {
    const m = deriveCacheHitMetrics({
      cache_read_input_tokens: 750,
      cache_creation_input_tokens: 150,
      input_tokens: 100,
    });
    expect(m.loaded).toBe(1000);
    expect(m.hitRate).toBe(0.75);
    expect(m.readsPerWrite).toBe(5.0);
  });

  it('returns null ratios when denominators are zero', () => {
    const m1 = deriveCacheHitMetrics({});
    expect(m1.hitRate).toBeNull();
    expect(m1.readsPerWrite).toBeNull();

    const m2 = deriveCacheHitMetrics({ cache_read_input_tokens: 100, cache_creation_input_tokens: 0 });
    expect(m2.readsPerWrite).toBeNull();
    expect(m2.hitRate).toBe(1.0);
  });
});

describe('extractInvocationRole', () => {
  it('follows precedence: role -> lens -> step -> op -> unknown', () => {
    expect(extractInvocationRole({ role: 'custom', lens: 'l', step: 's' })).toBe('custom');
    expect(extractInvocationRole({ lens: 'correctness', step: 'judge' })).toBe('correctness');
    expect(extractInvocationRole({ step: 'synthesize' })).toBe('synthesize');
    expect(extractInvocationRole({}, { op: 'review-pr' })).toBe('review-pr');
    expect(extractInvocationRole({})).toBe('unknown');
  });
});

describe('aggregateRoleCacheMetrics — KNOWN SPLIT ARITHMETIC ASSERTION (#3521 Done-when #1)', () => {
  it('computes exact arithmetic on hand-constructed fixture with known numbers', () => {
    const results = aggregateRoleCacheMetrics(KNOWN_SPLIT_RUNS);
    expect(results).toHaveLength(3);

    const [correctness, security, synthesize] = results;

    // 1. correctness: 1800 read / 2400 loaded = 0.75; 1800 read / 400 write = 4.5
    expect(correctness.role).toBe('correctness');
    expect(correctness.invocations).toBe(2);
    expect(correctness.cacheReadTokens).toBe(1800);
    expect(correctness.cacheCreationTokens).toBe(400);
    expect(correctness.inputTokens).toBe(200);
    expect(correctness.loadedContextTokens).toBe(2400);
    expect(correctness.hitRate).toBe(0.75);
    expect(correctness.readsPerWrite).toBe(4.5);
    expect(correctness.zeroHitAlert).toBe(false);

    // 2. security: 0 read / 2000 loaded = 0; reads-per-write = 0
    expect(security.role).toBe('security');
    expect(security.invocations).toBe(2);
    expect(security.cacheReadTokens).toBe(0);
    expect(security.cacheCreationTokens).toBe(1000);
    expect(security.inputTokens).toBe(1000);
    expect(security.loadedContextTokens).toBe(2000);
    expect(security.hitRate).toBe(0.0);
    expect(security.readsPerWrite).toBe(0.0);
    expect(security.zeroHitAlert).toBe(true);

    // 3. synthesize: 8000 read / 10000 loaded = 0.8; 8000 read / 1000 write = 8.0
    expect(synthesize.role).toBe('synthesize');
    expect(synthesize.invocations).toBe(3);
    expect(synthesize.cacheReadTokens).toBe(8000);
    expect(synthesize.cacheCreationTokens).toBe(1000);
    expect(synthesize.inputTokens).toBe(1000);
    expect(synthesize.loadedContextTokens).toBe(10000);
    expect(synthesize.hitRate).toBe(0.8);
    expect(synthesize.readsPerWrite).toBe(8.0);
    // CRUCIAL: synthesize has an overall 80% hit rate, BUT Run 1 had 2 repeated invocations with 0% hit rate!
    // Done-when #2 requirement: it MUST NOT be silently averaged away!
    expect(synthesize.zeroHitAlert).toBe(true);
    expect(synthesize.zeroHitRuns).toEqual([{ runId: 'run-known-1', invocations: 2 }]);
  });

  it('aggregates per role across a single run record', () => {
    const results = aggregateRoleCacheMetrics(KNOWN_SPLIT_RUNS[0]);
    expect(results.map((r) => r.role)).toEqual(['correctness', 'security', 'synthesize']);

    const correctness = results.find((r) => r.role === 'correctness');
    expect(correctness.hitRate).toBe(0.6); // 600 / 1000
    expect(correctness.readsPerWrite).toBe(2.0); // 600 / 300
    expect(correctness.zeroHitAlert).toBe(false); // only 1 invocation in run 1
  });

  it('does NOT trigger zeroHitAlert on a single cold invocation', () => {
    const singleColdRun = {
      id: 'cold-1',
      telemetry: [
        {
          role: 'reviewer',
          usage: { cache_read: 0, cache_creation: 1000, input: 0 },
        },
      ],
    };
    const results = aggregateRoleCacheMetrics(singleColdRun);
    expect(results[0].invocations).toBe(1);
    expect(results[0].hitRate).toBe(0.0);
    // A single cold invocation is expected and not an alert
    expect(results[0].zeroHitAlert).toBe(false);
  });

  it('TRIGGERS zeroHitAlert when repeated invocations across runs all have zero hits', () => {
    const runA = {
      id: 'r-1',
      telemetry: [{ role: 'agent', usage: { cache_read: 0, cache_creation: 500, input: 100 } }],
    };
    const runB = {
      id: 'r-2',
      telemetry: [{ role: 'agent', usage: { cache_read: 0, cache_creation: 500, input: 100 } }],
    };
    const results = aggregateRoleCacheMetrics([runA, runB]);
    expect(results[0].invocations).toBe(2);
    expect(results[0].hitRate).toBe(0.0);
    expect(results[0].zeroHitAlert).toBe(true);
  });
});

describe('renderCacheHitReport — SURFACING ZERO HIT RATES (#3521 Done-when #2)', () => {
  it('surfaces zero hit rate across repeated invocations clearly with an alert', () => {
    const metrics = aggregateRoleCacheMetrics(KNOWN_SPLIT_RUNS);
    const lines = renderCacheHitReport(metrics);

    // Header summarizes the total
    expect(lines[0]).toMatch(/cache-hit-report: 68\.1% overall hit rate \(9800\/14400 ctx tokens, reads\/write: 4\.08\) across 7 invocation\(s\) in 3 role\(s\):/);

    // correctness: healthy 75.0%
    const correctnessLine = lines.find((l) => l.includes('correctness:'));
    expect(correctnessLine).toContain('75.0% hit rate');
    expect(correctnessLine).toContain('reads/write: 4.50');

    // security: zero hit rate highlighted
    const securityLine = lines.find((l) => l.includes('security:'));
    expect(securityLine).toContain('0.0% hit rate');
    const securityAlert = lines.find((l) => l.includes('ALERT') && l.includes('security'));
    // Alert is on the line right after security
    const secIdx = lines.findIndex((l) => l.includes('security:'));
    expect(lines[secIdx + 1]).toMatch(/⚠️ ALERT: zero hit rate across 2 repeated invocation\(s\)/);

    // synthesize: overall 80.0%, but Run 1 zero-hit episode is explicitly surfaced!
    const synthIdx = lines.findIndex((l) => l.includes('synthesize:'));
    expect(lines[synthIdx]).toContain('80.0% hit rate');
    expect(lines[synthIdx + 1]).toMatch(/⚠️ ALERT: zero hit rate across 2 repeated invocation\(s\) in run run-known-1/);
  });

  it('renders a plain message when no usage records are present', () => {
    expect(renderCacheHitReport([])).toEqual(['cache-hit-report: no telemetry with usage found in run record(s).']);
  });
});

describe('runCacheHitCli', () => {
  function makeStore(runs = []) {
    const store = createMemoryRunStore();
    for (const r of runs) store.write(r);
    return store;
  }

  it('reports over all stored run records by default', () => {
    const store = makeStore(KNOWN_SPLIT_RUNS);
    const { code, output, rows } = runCacheHitCli([], { store });
    expect(code).toBe(0);
    expect(rows).toHaveLength(3);
    expect(output).toContain('correctness: 75.0% hit rate');
    expect(output).toContain('security: 0.0% hit rate');
    expect(output).toContain('synthesize: 80.0% hit rate');
  });

  it('filters to a single run when --run=<id> is given', () => {
    const store = makeStore(KNOWN_SPLIT_RUNS);
    const { code, output, rows } = runCacheHitCli(['--run=run-known-1'], { store });
    expect(code).toBe(0);
    expect(rows).toHaveLength(3);
    expect(output).toContain('correctness: 60.0% hit rate');
  });

  it('filters to a single run when positional id is given', () => {
    const store = makeStore(KNOWN_SPLIT_RUNS);
    const { code, output, rows } = runCacheHitCli(['run-known-2'], { store });
    expect(code).toBe(0);
    expect(rows).toHaveLength(2); // correctness and synthesize
    expect(output).toContain('correctness: 85.7% hit rate');
  });

  it('fails cleanly with exit code 1 when run id is not found', () => {
    const store = makeStore(KNOWN_SPLIT_RUNS);
    const { code, output } = runCacheHitCli(['--run=non-existent'], { store });
    expect(code).toBe(1);
    expect(output).toContain('run "non-existent" not found');
  });

  it('supports --json flag for machine-readable output', () => {
    const store = makeStore(KNOWN_SPLIT_RUNS);
    const { code, output } = runCacheHitCli(['--json'], { store });
    expect(code).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('roles');
    expect(parsed.roles).toHaveLength(3);
    expect(parsed.roles[0].role).toBe('correctness');
    expect(parsed.roles[0].hitRate).toBe(0.75);
  });

  it('supports --help flag', () => {
    const { code, output } = runCacheHitCli(['--help'], { store: makeStore() });
    expect(code).toBe(0);
    expect(output).toContain('usage: cache-hit-report.mjs');
  });
});

describe('formatPercentage and formatRatio', () => {
  it('formats null as n/a', () => {
    expect(formatPercentage(null)).toBe('n/a');
    expect(formatRatio(null)).toBe('n/a');
  });

  it('formats finite numbers to designated precision', () => {
    expect(formatPercentage(0.7523)).toBe('75.2%');
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatRatio(4.5)).toBe('4.50');
    expect(formatRatio(0)).toBe('0.00');
  });
});
