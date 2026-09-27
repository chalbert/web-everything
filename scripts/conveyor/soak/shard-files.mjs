/**
 * @file shard-files.mjs — #4200-ish CI speed-up (card x0zg44l's own harness). Deterministic file-level sharding
 * for `npm run test:soak`, mirroring the unit suite's `vitest --shard=i/N` split (`.github/workflows/ci.yml`'s
 * `test-shard`) but hand-rolled rather than vitest's built-in `--shard`: the 50-tick baseline
 * (`daemon-soak.soak.test.mjs`) dwarfs any single break scenario, so a blind file-count/hash split would land it
 * next to a handful of breaks in one shard while the rest sit near-empty — exactly what vitest's own `--shard`
 * would do (it distributes by file, blind to cost). Here the baseline ALWAYS gets its own shard (shard 1), and
 * every `breaks/*.soak.test.mjs` file round-robins across the remaining shards — so wall time is bounded by
 * "baseline alone" vs "breaks-per-shard count", not by the two colliding.
 *
 * Break files are discovered from disk (`breaks/*.soak.test.mjs`), never from `breaks/index.mjs`'s registry —
 * adding a new break (one file) therefore lands in a shard automatically, no shard-list edit, which is the
 * "stays flat as scenarios grow" half of this split's whole point. Round-robin by sorted index
 * (`(index in sorted list) % bucketCount`) keeps shards balanced to within one file. Stability is partial, and the
 * tests pin exactly this: a break that sorts LAST leaves every existing file in its shard; a break inserted
 * mid-list leaves the files sorting before it in place and shifts the ones after it by one bucket. That shift
 * is harmless (every file still runs somewhere) — balance, not assignment stability, is the property that matters.
 */

import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..', '..');
export const BASELINE_FILE = join(HERE, 'daemon-soak.soak.test.mjs');
export const BREAKS_DIR = join(HERE, 'breaks');

/** Every `breaks/*.soak.test.mjs` scenario file, sorted for a deterministic, stable round-robin. */
export function listBreakTestFiles(breaksDir = BREAKS_DIR) {
  return readdirSync(breaksDir)
    .filter((f) => f.endsWith('.soak.test.mjs'))
    .sort()
    .map((f) => join(breaksDir, f));
}

function toRepoRelative(absPath, repoRoot) {
  return relative(repoRoot, absPath).split(sep).join('/');
}

/**
 * The vitest-CLI-ready file list (repo-root-relative, posix separators) for one shard.
 *
 * `shard` is 1-based. `total === 1` runs everything (baseline + all breaks) — the single-shard fallback used by
 * `npm run test:soak` (no sharding) and by a local "does the split still work" smoke check.
 * `shard === 1` (when `total > 1`) is ALWAYS the baseline alone. Shards `2..total` split the break files by
 * `(sortedIndex % (total - 1)) === (shard - 2)`.
 */
export function shardFiles({ shard, total, breaksDir = BREAKS_DIR, baselineFile = BASELINE_FILE, repoRoot = REPO_ROOT } = {}) {
  if (!Number.isInteger(total) || total < 1) throw new Error(`soak shard-files: --shard total must be a positive integer, got "${total}"`);
  if (!Number.isInteger(shard) || shard < 1 || shard > total) throw new Error(`soak shard-files: --shard index must be 1..${total}, got "${shard}"`);

  const breakFiles = listBreakTestFiles(breaksDir);
  let files;
  if (total === 1) {
    files = [baselineFile, ...breakFiles];
  } else if (shard === 1) {
    files = [baselineFile];
  } else {
    const bucketCount = total - 1;
    const bucketIndex = shard - 2;
    files = breakFiles.filter((_, i) => i % bucketCount === bucketIndex);
  }
  return files.map((f) => toRepoRelative(f, repoRoot));
}

/** Parses `--shard=i/N` out of an argv array. Throws with a usage line if missing or malformed. */
export function parseShardArg(argv, usage = 'usage: --shard=<i>/<N>') {
  const hit = argv.find((a) => a.startsWith('--shard='));
  if (!hit) throw new Error(usage);
  const m = /^--shard=(\d+)\/(\d+)$/.exec(hit);
  if (!m) throw new Error(`${usage} (got "${hit}")`);
  return { shard: Number(m[1]), total: Number(m[2]) };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  try {
    const { shard, total } = parseShardArg(process.argv.slice(2), 'usage: shard-files.mjs --shard=<i>/<N>');
    const files = shardFiles({ shard, total });
    process.stdout.write(files.length ? `${files.join('\n')}\n` : '');
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 2;
  }
}
