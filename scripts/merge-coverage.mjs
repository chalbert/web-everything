// Merge sharded vitest v8 coverage into one report and enforce the 80% bar (#2682).
//
// WHY THIS EXISTS: ci.yml's `test` gate shards the 2000+ vitest suite across N runners
// (`vitest run --shard=i/N`) to cut wall-clock. Each shard runs with `--coverage` but its per-shard
// thresholds disabled (it only exercises ~1/N of the tests, so no single shard can meet the 80% bar);
// each emits an Istanbul-format `coverage/coverage-final.json`. This script fans those partial reports
// back in — summing per-file hit counts — and applies the #2082 80% bar to the COMBINED coverage, so
// the shard split changes only WHERE tests run, never WHETHER coverage still gates. Because vitest 1.6.x
// predates the blob-reporter / `--merge-reports` merge path (vitest 2.0), the merge is done here with
// `istanbul-lib-coverage` (already a transitive dep of `@vitest/coverage-v8`, in package-lock.json).
//
// SOUNDNESS: merged sharded coverage == full-run coverage for the same include/exclude config. `--shard`
// partitions by test FILE, so every source file's hits land in exactly one shard's report (or 0 in all,
// same as a full run); `.merge()` sums them. The `--expect=N` guard fails loud if fewer than N shard
// reports arrive, so a silently-dropped shard can never under-count coverage into a false green.
//
// Usage: node scripts/merge-coverage.mjs <dir-or-file ...> [--threshold=80] [--expect=N]
//   <dir-or-file>  one or more paths searched recursively for `coverage-final.json` files.
//   --threshold=N  minimum percent required on every metric (default 80).
//   --expect=N     require EXACTLY N coverage-final.json files (guards a dropped shard). Optional.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';

const METRICS = ['lines', 'statements', 'functions', 'branches'];

/** Recursively collect every `coverage-final.json` path under a file or directory root. */
export function findCoverageFiles(root) {
  const out = [];
  if (!existsSync(root)) return out; // a missing input path yields the clean "no files found" exit, not an ENOENT throw
  const walk = (p) => {
    const s = statSync(p);
    if (s.isDirectory()) for (const e of readdirSync(p).sort()) walk(join(p, e));
    else if (p.endsWith('coverage-final.json')) out.push(p);
  };
  walk(root);
  return out;
}

/** Merge a list of coverage-final.json paths into one istanbul CoverageMap (summing per-file hits). */
export function mergeCoverageFiles(files) {
  const map = libCoverage.createCoverageMap({});
  for (const f of files) map.merge(JSON.parse(readFileSync(f, 'utf8')));
  return map;
}

/** Evaluate a coverage summary against a percent threshold. Returns { results, failed }. */
export function evaluateThresholds(summary, threshold) {
  const results = METRICS.map((m) => ({
    metric: m,
    pct: summary[m].pct,
    covered: summary[m].covered,
    total: summary[m].total,
    ok: summary[m].pct >= threshold,
  }));
  return { results, failed: results.some((r) => !r.ok) };
}

function main(argv) {
  const opts = { inputs: [], threshold: 80, expect: null };
  for (const a of argv) {
    if (a.startsWith('--threshold=')) opts.threshold = Number(a.slice('--threshold='.length));
    else if (a.startsWith('--expect=')) opts.expect = Number(a.slice('--expect='.length));
    else opts.inputs.push(a);
  }
  if (opts.inputs.length === 0) {
    console.error('usage: node scripts/merge-coverage.mjs <dir-or-file ...> [--threshold=80] [--expect=N]');
    process.exit(2);
  }

  const files = opts.inputs.flatMap(findCoverageFiles);
  if (files.length === 0) {
    console.error(`merge-coverage: no coverage-final.json found under: ${opts.inputs.join(', ')}`);
    process.exit(1);
  }
  if (opts.expect != null && files.length !== opts.expect) {
    console.error(
      `merge-coverage: expected ${opts.expect} shard coverage file(s) but found ${files.length} — ` +
        `a shard was dropped or double-counted; refusing to gate on partial coverage.`,
    );
    process.exit(1);
  }
  console.error(`merge-coverage: merging ${files.length} shard coverage file(s)`);

  const summary = mergeCoverageFiles(files).getCoverageSummary();
  const { results, failed } = evaluateThresholds(summary, opts.threshold);
  console.log('Combined coverage (all shards):');
  for (const r of results) {
    console.log(
      `  ${r.metric.padEnd(11)} ${String(r.pct).padStart(6)}%  (${r.covered}/${r.total})  ` +
        `${r.ok ? 'OK' : `FAIL < ${opts.threshold}%`}`,
    );
  }
  if (failed) {
    console.error(`\nmerge-coverage: combined coverage below the ${opts.threshold}% bar (#2082) — failing.`);
    process.exit(1);
  }
  console.log(`\nmerge-coverage: all metrics >= ${opts.threshold}% (#2082 bar met).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
