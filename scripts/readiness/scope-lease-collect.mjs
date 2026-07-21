#!/usr/bin/env node
/**
 * @file scripts/readiness/scope-lease-collect.mjs
 * @description LIVE scope-lease snapshot COLLECTOR (WE epic #2560 — the IO BOUNDARY for the pure observer).
 *   The pure, read-only observer {@link ./scope-lease-live.mjs liveScopePicture} takes a plain array of lease
 *   objects and reports the live conflict picture (per-lease breach + policy outcome, pairwise overlaps). It owns
 *   NO fs/git/clock — everything is passed IN. THIS module is the missing other half: it walks the live lane
 *   pool, reads each HELD lease and its git diff, and assembles exactly that `leases` array, then composes the
 *   observer. It NEVER re-implements breach / overlap / policy — it collects, then hands off.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from the observer):
 *   • The PURE core ({@link qualifyPaths}, {@link parseObservedFiles}, {@link resolvePredictedScope},
 *     {@link collectSnapshot}) has NO fs, git, `Date`, or `child_process` — every dependency is INJECTED. It is
 *     unit-tested directly by feeding it raw strings / fake pool objects / fake collector fns.
 *   • The IO SHELL (the `main()` CLI, gated on `import.meta.url === pathToFileURL(process.argv[1]).href`) owns
 *     the git/child_process reads: it runs `lane-pool status --json`, and per lane runs `git remote get-url`,
 *     `git merge-base`, `git diff --name-only`, `git status --porcelain`. It provides those as the injected
 *     functions the pure core orchestrates over.
 *
 * THE predicted = observed DEFAULT — the central design call of #2560's collector (documented deliberately):
 *   The observer keys breach detection on PREDICTED (planned) file-scope vs OBSERVED (live diff) scope. But the
 *   live orchestrator emits NO predicted file-scope today — there is no live producer of a lane's planned file
 *   set. So {@link resolvePredictedScope} defaults `predicted := observed` when no plan is supplied. The effect:
 *     • With NO plan, predicted ≡ observed ⇒ breachOf(predicted, observed) is empty ⇒ ZERO false breach. The
 *       observer then reports only the REAL cross-lane OVERLAPS between live leases' effective scopes — which
 *       need no plan to be meaningful (two lanes sitting on the same file is contention regardless of intent).
 *     • Breach detection turns ON only when a real per-lane plan IS supplied (via `--plan=<file>`). Then predicted
 *       is the plan and observed the live diff, and the observer's breach machinery lights up as designed.
 *   This is the conservative, correct default: surface the signal that is trustworthy now (overlap), and never
 *   fabricate a breach from the absence of a plan.
 *
 * NO PERSISTED ATTEMPT COUNTER: the collector omits `breachAttempt` on every lease. §3i-A4's total-attempt
 *   counter has no live persistence today, and the observer defaults a missing `breachAttempt` to 1 (first
 *   observation ⇒ retry-in-place). So an omitted count reads as "first attempt", the correct live default.
 *
 * COMPOSES, NEVER REINVENTS: `normScope` (dedupe/normalize repo-qualified paths) and `porcelainFiles` (parse
 *   `git status --porcelain`, rename-aware) and `repoKeyFromSlug` (origin slug → repo key) and `liveScopePicture`
 *   (the observer itself) are all IMPORTED. This module adds only the pool-walk + git-read IO and the pure glue.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { normScope } from './scope-lease.mjs';
import { porcelainFiles } from './claimScope.mjs';
import { repoKeyFromSlug } from './lane-manifest.mjs';
import { liveScopePicture } from './scope-lease-live.mjs';

// ── PURE CORE (no fs / git / Date / child_process — every dependency is injected) ────────────────────────────

/**
 * Repo-qualify a list of repo-relative file paths → "<repoKey>:<path>". Skips empty/falsy entries. When
 * `repoKey` is null/empty the path passes through UNQUALIFIED (the observer's path convention tolerates an
 * unqualified path; a bare path never collides across repos it was never tagged with).
 * @param {string|null|undefined} repoKey
 * @param {string[]} files
 * @returns {string[]}
 */
export function qualifyPaths(repoKey, files) {
  const list = Array.isArray(files) ? files : [];
  const key = repoKey ? String(repoKey) : null;
  return list
    .map((f) => (f == null ? '' : String(f).trim()))
    .filter(Boolean)
    .map((f) => (key ? `${key}:${f}` : f));
}

/**
 * Parse a lane's raw git outputs into its repo-qualified, deduped OBSERVED scope (the file-level live diff the
 * observer reads). Unions the committed range and the uncommitted working tree, so a lane's footprint includes
 * both what it has committed and what it is mid-edit on.
 * @param {{diffOut?:string, porcelainOut?:string, repoKey?:string|null}} input
 *   `diffOut` = raw `git diff --name-only <base>...HEAD` stdout (committed range);
 *   `porcelainOut` = raw `git status --porcelain` stdout (uncommitted; parsed rename-aware via `porcelainFiles`).
 * @returns {string[]} repo-qualified, deduped/normalized observed paths.
 */
export function parseObservedFiles({ diffOut = '', porcelainOut = '', repoKey = null } = {}) {
  const committed = String(diffOut || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  // porcelainFiles returns a Set (rename `old -> new` → keeps `new`); spread to the union.
  const uncommitted = [...porcelainFiles(porcelainOut)];
  const qualified = qualifyPaths(repoKey, [...committed, ...uncommitted]);
  return normScope(qualified);
}

/**
 * Resolve a lane's PREDICTED scope. THE #2560 DEFAULT (see the file header): with a non-empty `plan`, predicted
 * is the normalized plan (breach detection is ON); with no plan, predicted := observed unchanged (predicted ≡
 * observed ⇒ zero false breach — the observer then reports only real cross-lane overlaps).
 * @param {{observed:string[], plan?:string[]|null}} input
 * @returns {string[]}
 */
export function resolvePredictedScope({ observed, plan } = {}) {
  const obs = Array.isArray(observed) ? observed : [];
  if (Array.isArray(plan) && plan.length > 0) return normScope(plan);
  return [...obs]; // a fresh array — predicted and observed must not alias (no in-place mutation footgun)
}

/**
 * Assemble the observer's `leases` array from a `lane-pool status --json` object, over INJECTED collector fns.
 * PURE orchestration — no git/fs of its own; the shell supplies the reads.
 *
 * @param {{
 *   poolStatus: {lanes?: Array<object>},
 *   observedForLane: (lane:object) => string[],   // already-repo-qualified observed scope for a lane
 *   planForLane?: ((lane:object) => string[]|null) | null,  // optional per-lane predicted plan
 * }} input
 *   The IO shell repo-qualifies each lane's paths inside `observedForLane`, so the pure shape needs no separate
 *   repo key — observed scope arrives already qualified, exactly as the observer expects.
 * @returns {Array<{lane, session, predictedScope:string[], observedScope:string[]}>}
 *   The observer's lease-input shape. `breachAttempt` is intentionally OMITTED (no persisted counter — the
 *   observer defaults it to 1, "first observation ⇒ retry-in-place").
 */
export function collectSnapshot({ poolStatus, observedForLane, planForLane = null } = {}) {
  const lanes = Array.isArray(poolStatus?.lanes) ? poolStatus.lanes : [];
  // Keep only LIVE-held lanes — `leased === true` marks an active work stream (a stale marker reads as free).
  const held = lanes.filter((l) => l && typeof l === 'object' && l.leased === true);
  return held.map((lane) => {
    const observed = normScope(observedForLane(lane));
    const plan = typeof planForLane === 'function' ? planForLane(lane) : null;
    return {
      lane: lane.lane,
      session: lane.lease?.session ?? null,
      predictedScope: resolvePredictedScope({ observed, plan }),
      observedScope: observed,
    };
  });
}

// ── IO SHELL (runs only as a CLI — owns all git / child_process / fs) ────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_POOL_CLI = join(HERE, '..', 'lane-pool.mjs');

// stdout = machine payload ONLY; ALL logs / human text → stderr (lane-pool discipline).
const log = (m) => process.stderr.write(m + '\n');
function fail(m) {
  process.stderr.write(`✗ ${m}\n`);
  process.exit(1);
}

/** Hand-rolled `--k=v` flag parsing (lane-pool style). */
function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Run a git command in `cwd`, returning trimmed stdout, or null on any failure (never throws). */
function tryGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** Parse `--policy=<file-or-inline-json>` → an object, or null. A parse failure fails loud. */
function parsePolicyFlag(value) {
  if (value == null || value === true || value === '') return null;
  const raw = String(value);
  let text = raw;
  try {
    // Prefer a file path; fall back to treating the value as inline JSON.
    text = readFileSync(raw, 'utf8');
  } catch {
    text = raw;
  }
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    fail(`--policy is neither a readable JSON file nor inline JSON: ${String(e.message || e).split('\n')[0]}`);
  }
}

/** Parse `--plan=<file>` → a `{ "<laneId>": ["<repo>:<path>", …] }` map, or null. A read/parse failure fails loud. */
function parsePlanFlag(value) {
  if (value == null || value === true || value === '') return null;
  let text;
  try {
    text = readFileSync(String(value), 'utf8');
  } catch (e) {
    fail(`--plan=${value} is not readable: ${String(e.message || e).split('\n')[0]}`);
  }
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail('--plan must be a JSON object mapping laneId → string[]');
    return obj;
  } catch (e) {
    fail(`--plan=${value} is not valid JSON: ${String(e.message || e).split('\n')[0]}`);
  }
}

/** Run `lane-pool.mjs status --json` (passing through the repo/name selector) and parse the payload. */
function readPoolStatus(flags) {
  const args = [LANE_POOL_CLI, 'status', '--json'];
  if (typeof flags.repo === 'string') args.push(`--repo=${flags.repo}`);
  if (typeof flags.name === 'string') args.push(`--name=${flags.name}`);
  let out;
  try {
    out = execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    fail(`lane-pool status failed: ${String(e.message || e).split('\n')[0]}`);
  }
  try {
    return JSON.parse(out);
  } catch (e) {
    fail(`could not parse lane-pool status JSON: ${String(e.message || e).split('\n')[0]}`);
  }
}

/** The IO shell: collect the live snapshot, compose the observer, emit the picture. */
function main(argv) {
  const flags = parseFlags(argv);
  const policy = parsePolicyFlag(flags.policy);
  const planMap = parsePlanFlag(flags.plan);

  const poolStatus = readPoolStatus(flags);

  // Injected real collector fns (own all git IO; every git call is guarded — a lane whose git fails
  // contributes [] observed and is logged, never crashing the whole run).
  const repoKeyCache = new Map();
  const repoKeyForLane = (lane) => {
    const path = lane?.path;
    if (!path) return null;
    if (repoKeyCache.has(path)) return repoKeyCache.get(path);
    const slug = tryGit(['remote', 'get-url', 'origin'], path);
    const key = slug ? repoKeyFromSlug(slug) : null;
    repoKeyCache.set(path, key);
    return key;
  };

  const observedForLane = (lane) => {
    const path = lane?.path;
    if (!path) return [];
    try {
      const repoKey = repoKeyForLane(lane);
      // Diff base: merge-base(origin/main, HEAD); fall back to origin/main if merge-base fails.
      const base = tryGit(['merge-base', 'origin/main', 'HEAD'], path) || 'origin/main';
      const diffOut = tryGit(['diff', '--name-only', '--end-of-options', `${base}...HEAD`], path) || '';
      const porcelainOut = tryGit(['status', '--porcelain'], path) || '';
      return parseObservedFiles({ diffOut, porcelainOut, repoKey });
    } catch (e) {
      log(`  ⚠ lane-${lane?.lane ?? '?'}: git read failed (${String(e.message || e).split('\n')[0]}) — treating observed scope as empty`);
      return [];
    }
  };

  const planForLane = planMap
    ? (lane) => {
        const p = planMap[String(lane?.lane)];
        return Array.isArray(p) ? p : null;
      }
    : null;

  const leases = collectSnapshot({ poolStatus, observedForLane, planForLane, repoKeyForLane });
  const picture = liveScopePicture({ leases, policy });

  if (flags.json) {
    process.stdout.write(JSON.stringify(picture, null, 2) + '\n');
  } else {
    const overlaps = picture.overlaps.length;
    log(
      `live scope: ${picture.leases.length} live lease(s) · ` +
        `breachedLanes ${picture.breachedLanes.length ? picture.breachedLanes.join(', ') : 'none'} · ` +
        `overlaps ${overlaps} · clean ${picture.clean ? 'y' : 'n'}`,
    );
  }
  process.exit(0);
}

// Main-module detection — run the IO shell only when invoked directly, never on import (keeps the pure core
// importable by the test with zero side effects).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
