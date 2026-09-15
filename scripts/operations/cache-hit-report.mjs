#!/usr/bin/env node
/**
 * @file scripts/operations/cache-hit-report.mjs
 * @description THE READ-SIDE CACHE HIT REPORT (#3521, citing #3028 and token optimisation research).
 *
 * Derives and prints per-role prompt cache hit rate and reads-per-write ratio from stored run records:
 *   hit rate = cache_read / (cache_read + cache_creation + input)
 *   reads-per-write = cache_read / cache_creation
 *
 * ZERO HIT RATE SURFACING (#3521 Done-when #2):
 * A hit rate of zero across repeated invocations indicates caching is broken or inactive (e.g. prefix
 * instability or disabled cache). This tool surfaces zero hit rates across repeated same-role invocations
 * with a prominent warning rather than silently averaging them away into an apparently non-zero aggregate.
 *
 * PURE CORE / IO SHELL:
 * {@link renderCacheHitReport} and {@link runCacheHitCli} are pure or take injected stores; the CLI block
 * at the bottom is the only process/io binding.
 *
 * Usage:
 *   node scripts/operations/cache-hit-report.mjs                     # across all stored run records
 *   node scripts/operations/cache-hit-report.mjs --run=<run-id>      # for a specific run record
 *   node scripts/operations/cache-hit-report.mjs <run-id>            # positional run-id alias
 *   node scripts/operations/cache-hit-report.mjs --json              # machine-readable JSON output
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileRunStore } from './run-store.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import {
  aggregateRoleCacheMetrics,
  deriveCacheHitMetrics,
  extractInvocationRole,
  extractUsageCounters,
} from './run-record.mjs';

export {
  aggregateRoleCacheMetrics,
  deriveCacheHitMetrics,
  extractInvocationRole,
  extractUsageCounters,
};

/**
 * Format a ratio as percentage text (e.g. 0.75 -> "75.0%"). PURE.
 *
 * @param {number|null} rate
 * @returns {string}
 */
export function formatPercentage(rate) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format a reads-per-write ratio (e.g. 4.5 -> "4.50"). PURE.
 *
 * @param {number|null} ratio
 * @returns {string}
 */
export function formatRatio(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 'n/a';
  return ratio.toFixed(2);
}

/**
 * RENDER CACHE HIT REPORT lines from aggregated role metrics (#3521). PURE.
 *
 * @param {Array<object>} rows - output of {@link aggregateRoleCacheMetrics}.
 * @returns {string[]}
 */
export function renderCacheHitReport(rows) {
  if (!rows || !rows.length) {
    return ['cache-hit-report: no telemetry with usage found in run record(s).'];
  }

  const grandTokens = rows.reduce((n, r) => n + r.loadedContextTokens, 0);
  const grandRead = rows.reduce((n, r) => n + r.cacheReadTokens, 0);
  const grandWrite = rows.reduce((n, r) => n + r.cacheCreationTokens, 0);
  const grandInvocations = rows.reduce((n, r) => n + r.invocations, 0);
  const grandHitRate = grandTokens > 0 ? grandRead / grandTokens : null;
  const grandRpw = grandWrite > 0 ? grandRead / grandWrite : null;

  const lines = [
    `cache-hit-report: ${formatPercentage(grandHitRate)} overall hit rate (${grandRead}/${grandTokens} ctx tokens, reads/write: ${formatRatio(grandRpw)}) across ${grandInvocations} invocation(s) in ${rows.length} role(s):`,
  ];

  for (const r of rows) {
    lines.push(
      `  ${r.role}: ${formatPercentage(r.hitRate)} hit rate (${r.cacheReadTokens}/${r.loadedContextTokens} tokens) · reads/write: ${formatRatio(r.readsPerWrite)} · ${r.invocations} invocation(s)`,
    );
    if (r.zeroHitAlert) {
      if (r.zeroHitRuns && r.zeroHitRuns.length > 0) {
        for (const zr of r.zeroHitRuns) {
          lines.push(
            `    ⚠️ ALERT: zero hit rate across ${zr.invocations} repeated invocation(s) in run ${zr.runId} (prompt caching inactive or prefix broken)`,
          );
        }
      } else {
        lines.push(
          `    ⚠️ ALERT: zero hit rate across ${r.invocations} repeated invocation(s) (prompt caching inactive or prefix broken)`,
        );
      }
    }
  }

  return lines;
}

/**
 * Parse CLI flags from argv array. PURE.
 *
 * @param {string[]} argv
 * @returns {Record<string, string|boolean> & {_: string[]}}
 */
function parseFlags(argv) {
  const flags = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

/**
 * CLI driver with injected store for pure testing.
 *
 * @param {string[]} [argv]
 * @param {{store?: object}} [io]
 * @returns {{code: number, output: string, rows?: object[]}}
 */
export function runCacheHitCli(argv = process.argv.slice(2), { store = createFileRunStore() } = {}) {
  const flags = parseFlags(argv);

  if (flags.help || flags.h) {
    return {
      code: 0,
      output: [
        'usage: cache-hit-report.mjs [--run=<id>] [--json]',
        '',
        'Surface prompt cache hit rate and reads-per-write ratio per role from stored run records (#3521).',
      ].join('\n'),
    };
  }

  const runId = flags.run || flags._[0] || null;
  let runs;
  if (runId) {
    const single = store.read(runId);
    if (!single) {
      return {
        code: 1,
        output: `cache-hit-report: run ${JSON.stringify(runId)} not found.`,
      };
    }
    runs = [single];
  } else {
    runs = store.list().map((id) => store.read(id)).filter(Boolean);
  }

  const rows = aggregateRoleCacheMetrics(runs);

  if (flags.json) {
    return {
      code: 0,
      output: JSON.stringify({ roles: rows }, null, 2),
      rows,
    };
  }

  return {
    code: 0,
    output: renderCacheHitReport(rows).join('\n'),
    rows,
  };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const { code, output } = runCacheHitCli();
  writeAllSync(1, `${output}\n`);
  process.exit(code);
}
