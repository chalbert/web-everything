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
 * PREDICTED SCOPE SOURCE + the predicted = observed DEFAULT — the central design call of #2560's collector:
 *   The observer keys breach detection on PREDICTED (planned) file-scope vs OBSERVED (live diff) scope. As of
 *   #2560's final slice there IS a live producer: a lane declares its predicted file-scope at acquire via
 *   `we:scripts/lane-pool.mjs acquire --scope=<repo:path,...>`, which persists it into the lease marker
 *   (`lease.predictedScope`). So {@link resolvePredictedScope} takes predicted from the marker-declared scope
 *   when present, else `--plan`, else defaults `predicted := observed`. The default still holds when nothing
 *   declared a scope (a plain acquire with no `--scope`). The effect of that default:
 *     • With NO plan, predicted ≡ observed ⇒ breachOf(predicted, observed) is empty ⇒ ZERO false breach. The
 *       observer then reports only the REAL cross-lane OVERLAPS between live leases' effective scopes — which
 *       need no plan to be meaningful (two lanes sitting on the same file is contention regardless of intent).
 *     • Breach detection turns ON only when a real per-lane plan IS supplied (via `--plan=<file>`). Then predicted
 *       is the plan and observed the live diff, and the observer's breach machinery lights up as designed.
 *   This is the conservative, correct default: surface the signal that is trustworthy now (overlap), and never
 *   fabricate a breach from the absence of a plan.
 *
 * DURABLE PER-LANE BREACH-ATTEMPT COUNTER (WE #2598 — the last slice of #2560): §3i-A4 Fork 2's total-attempt
 *   counter now has live persistence. It CANNOT live in the lease marker (that is deleted at release), so it is a
 *   per-lane SIDECAR at `<laneDir>/.git/.lane-breach-count`. An "attempt" = a distinct breach EPISODE, advanced on
 *   a breach TRANSITION (a NEW or CHANGED breach file-set), NOT per poll — the honestly-detectable retry proxy
 *   from observations alone (no orchestrator hook exists). Rules ({@link advanceBreachCount}): a stable ongoing
 *   breach stays ONE attempt (rising edge only); a CHANGED breach file-set is a new attempt (+1); a clean
 *   observation resets to 0; a new lease occupant (session changed) resets. The counter is ADVISORY (§3i-A4
 *   Fork 1 — never gates). Writes happen ONLY on a state transition, so steady-state polls stay READ-ONLY. The
 *   `--no-track-attempts` flag forces a pure read (no sidecar writes, `breachAttempt` omitted). The observer
 *   consumes `breachAttempt` in its `breachOutcome` to ESCALATE once the count exceeds `retryBound`.
 *   LIMITATION (proxy, not a literal total): a STATIC unchanged breach sits at attempt 1 forever, and a
 *   breach that drops to clean and re-appears on a DIFFERENT file resets — both diverge from §3i-A4's literal
 *   total-attempt counter. Faithful per-retry counting needs an orchestrator build-iteration signal (none yet);
 *   this is the honest edge-driven approximation until that hook exists.
 *
 * COMPOSES, NEVER REINVENTS: `normScope` (dedupe/normalize repo-qualified paths) and `porcelainFiles` (parse
 *   `git status --porcelain`, rename-aware) and `repoKeyFromSlug` (origin slug → repo key) and `liveScopePicture`
 *   (the observer itself) are all IMPORTED. This module adds only the pool-walk + git-read IO and the pure glue.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { normScope, breachOf } from './scope-lease.mjs';
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
 * Resolve a lane's PREDICTED scope. PRIORITY (#2560 final slice): marker-`declared` (the lane's own
 * `acquire --scope=` file-scope, persisted in its lease marker — the REAL predicted-scope producer #2596 noted
 * was missing) → `--plan` → observed. With a non-empty `declared`, predicted is that normalized declared scope
 * (breach detection is ON, keyed on what the lane itself promised). Else with a non-empty `plan`, predicted is
 * the normalized plan. Else predicted := observed unchanged (predicted ≡ observed ⇒ zero false breach — the
 * observer then reports only real cross-lane overlaps). The default still holds when nothing declared a scope.
 * @param {{observed:string[], plan?:string[]|null, declared?:string[]|null}} input
 * @returns {string[]}
 */
export function resolvePredictedScope({ observed, plan, declared } = {}) {
  if (Array.isArray(declared) && declared.length > 0) return normScope(declared);
  const obs = Array.isArray(observed) ? observed : [];
  if (Array.isArray(plan) && plan.length > 0) return normScope(plan);
  return [...obs]; // a fresh array — predicted and observed must not alias (no in-place mutation footgun)
}

/**
 * A stable, order-INDEPENDENT signature of a breach file-set (WE #2598). Two observations of the SAME breach
 * files in a different order produce the SAME signature, so a mere reorder is NOT read as a changed episode. An
 * empty / na breach signs to `''` (the "clean" sentinel {@link advanceBreachCount} treats as no breach).
 * @param {string[]} breach  a breach file array (repo-qualified).
 * @returns {string} the sorted, newline-joined normalized set (`''` when empty).
 */
export function breachSig(breach) {
  return [...normScope(breach)].sort().join('\n');
}

/**
 * Advance the durable per-lane breach-attempt counter by ONE observation (WE #2598, §3i-A4 Fork 2). PURE — the
 * IO shell reads `prev` from the sidecar, calls this, and writes `next` back only when it changed.
 *
 * SEMANTICS — an "attempt" = a distinct breach EPISODE, advanced on a breach TRANSITION (the rising edge of a new
 * or CHANGED breach set), NOT per poll:
 *   • A stable ongoing breach (same file-set) stays ONE attempt — `attempts`/`sig` unchanged.
 *   • A NEW or CHANGED breach set (signature differs from prev) is a new attempt → `attempts + 1`.
 *   • A CLEAN observation (empty breach) resets → `attempts: 0`, `sig: ''`.
 *   • A NEW lease occupant (session changed vs prev.session, both non-null) resets prev to fresh first — the
 *     previous holder's episode does not carry into a different session.
 * ADVISORY (§3i-A4 Fork 1) — this count never gates; the observer consumes it to escalate past `retryBound`.
 *
 * @param {{attempts?:number, sig?:string, session?:string|null}|null|undefined} prev  the prior sidecar state.
 * @param {string[]} breach  this observation's breach file-set (repo-qualified).
 * @param {string|null} [session]  the current lease occupant's session (drives the new-occupant reset).
 * @returns {{attempts:number, sig:string, session:(string|null)}} the next sidecar state.
 */
export function advanceBreachCount(prev, breach, session = null) {
  // Normalize prev → a well-formed state (attempts a non-negative integer, sig a string, session a value|null).
  let base =
    prev && typeof prev === 'object'
      ? {
          attempts: Number.isInteger(prev.attempts) && prev.attempts >= 0 ? prev.attempts : 0,
          sig: typeof prev.sig === 'string' ? prev.sig : '',
          session: prev.session ?? null,
        }
      : { attempts: 0, sig: '', session: null };

  // New-occupant reset: a different session than the one the prior state was recorded under starts fresh.
  if (session != null && base.session != null && session !== base.session) {
    base = { attempts: 0, sig: '', session: null };
  }

  const carrySession = session ?? base.session ?? null;
  const sig = breachSig(breach);

  if (sig === '') {
    // Clean observation → reset the episode.
    return { attempts: 0, sig: '', session: carrySession };
  }
  if (sig !== base.sig) {
    // New or changed breach set → a new episode (rising edge).
    return { attempts: base.attempts + 1, sig, session: carrySession };
  }
  // Same breach persists → hold the attempt (no rising edge).
  return { attempts: base.attempts, sig: base.sig, session: carrySession };
}

/**
 * Assemble the observer's `leases` array from a `lane-pool status --json` object, over INJECTED collector fns.
 * PURE orchestration — no git/fs of its own; the shell supplies the reads.
 *
 * @param {{
 *   poolStatus: {lanes?: Array<object>},
 *   observedForLane: (lane:object) => string[],   // already-repo-qualified observed scope for a lane
 *   planForLane?: ((lane:object) => string[]|null) | null,  // optional per-lane predicted plan
 *   breachAttemptForLane?: ((lease:object) => number) | null,  // optional per-lease breach-attempt counter
 * }} input
 *   The IO shell repo-qualifies each lane's paths inside `observedForLane`, so the pure shape needs no separate
 *   repo key — observed scope arrives already qualified, exactly as the observer expects.
 * @returns {Array<{lane, session, predictedScope:string[], observedScope:string[], breachAttempt?:number}>}
 *   The observer's lease-input shape. `breachAttempt` is stamped ONLY when `breachAttemptForLane` is supplied AND
 *   returns an integer ≥ 1 (WE #2598); when the param is absent it is OMITTED and the observer defaults it to 1
 *   ("first observation ⇒ retry-in-place") — exact back-compat with the pre-#2598 collector.
 *
 * PREDICTED SCOPE SOURCE (#2560 final slice): each lease's `predictedScope` now flows from the lane's OWN lease
 * marker (`lane.lease.predictedScope`, declared at acquire via `we:scripts/lane-pool.mjs acquire --scope=`) when
 * present — the real predicted-scope producer the collector previously lacked. It takes priority over `--plan`,
 * which takes priority over observed (see {@link resolvePredictedScope}).
 *
 * BREACH-ATTEMPT COUNTER (WE #2598): `breachAttemptForLane(lease)` is the INJECTED counter — the IO shell's fn
 * reads/advances/writes the per-lane sidecar and returns the current attempt count for the just-built lease. Kept
 * OUT of the pure core (it does fs) — this pure fn only stamps the integer it returns onto `lease.breachAttempt`.
 */
export function collectSnapshot({ poolStatus, observedForLane, planForLane = null, breachAttemptForLane = null } = {}) {
  const lanes = Array.isArray(poolStatus?.lanes) ? poolStatus.lanes : [];
  // Keep only LIVE-held lanes — `leased === true` marks an active work stream (a stale marker reads as free).
  const held = lanes.filter((l) => l && typeof l === 'object' && l.leased === true);
  return held.map((lane) => {
    const observed = normScope(observedForLane(lane));
    const plan = typeof planForLane === 'function' ? planForLane(lane) : null;
    const lease = {
      lane: lane.lane,
      session: lane.lease?.session ?? null,
      // #2560 — marker-declared scope (from `acquire --scope=`) wins over --plan wins over observed.
      predictedScope: resolvePredictedScope({ observed, plan, declared: lane.lease?.predictedScope }),
      observedScope: observed,
    };
    // WE #2598 — stamp the durable breach-attempt count when the injected counter yields a valid one (≥ 1).
    if (typeof breachAttemptForLane === 'function') {
      const a = breachAttemptForLane(lease);
      if (Number.isInteger(a) && a >= 1) lease.breachAttempt = a;
    }
    return lease;
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

// ── WE #2598 — the durable per-lane breach-attempt sidecar (IO: read/write `<laneDir>/.git/.lane-breach-count`) ─

/** The per-lane sidecar path — under `.git/` so it never shows in the lane's diff / porcelain (never observed). */
const breachCountPath = (laneDir) => join(laneDir, '.git', '.lane-breach-count');

/** Read a lane's breach-count sidecar → its state, or the fresh default on any error (missing/corrupt/unreadable). */
function readBreachCount(laneDir) {
  try {
    const obj = JSON.parse(readFileSync(breachCountPath(laneDir), 'utf8'));
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch {
    /* missing or corrupt sidecar → fresh default below */
  }
  return { attempts: 0, sig: '', session: null };
}

/** Write a lane's breach-count sidecar (2-space JSON). GUARDED — a write failure logs and is swallowed, never
 *  throws: the advisory counter must never break a read-only collection run (§3i-A4 Fork 1). */
function writeBreachCount(laneDir, state) {
  try {
    writeFileSync(breachCountPath(laneDir), JSON.stringify(state, null, 2) + '\n');
  } catch (e) {
    log(`  ⚠ lane sidecar write failed (${breachCountPath(laneDir)}): ${String(e.message || e).split('\n')[0]}`);
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

  // WE #2598 — the durable per-lane breach-attempt counter. lane id → lane clone dir (for the sidecar path).
  const pathByLane = new Map(
    (Array.isArray(poolStatus?.lanes) ? poolStatus.lanes : [])
      .filter((l) => l && typeof l === 'object')
      .map((l) => [l.lane, l.path]),
  );
  // Injected counter: reads the sidecar, advances it on a breach TRANSITION, writes back ONLY when it changed
  // (steady-state polls stay read-only), and returns the current attempt count for the built lease.
  const breachAttemptForLane = (lease) => {
    const laneDir = pathByLane.get(lease.lane);
    if (!laneDir) return 0;
    // Both scopes are already normalized in the lease; breachOf yields this observation's breach file-set.
    const breach = breachOf(lease.predictedScope, lease.observedScope);
    const prev = readBreachCount(laneDir);
    const next = advanceBreachCount(prev, breach, lease.session);
    if (JSON.stringify(next) !== JSON.stringify(prev)) writeBreachCount(laneDir, next);
    return next.attempts;
  };
  // `--no-track-attempts` forces a PURE read: no sidecar writes, no breachAttempt stamped.
  const trackAttempts = !flags['no-track-attempts'];

  const leases = collectSnapshot({
    poolStatus,
    observedForLane,
    planForLane,
    breachAttemptForLane: trackAttempts ? breachAttemptForLane : null,
  });
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
