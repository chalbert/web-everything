#!/usr/bin/env node
/**
 * @file scripts/conveyor/lane-pool-health-watch.mjs
 * @description THE STANDING PERIODIC HALF of `we:backlog/3568-*.md`. Every tick: read the live lane-pool
 *   status, and for every UNLEASED lane whose ENTIRE `git status --porcelain` output matches only the shared
 *   `we:scripts/lib/lane-litter.mjs#LANE_RELEASE_LITTER_ALLOWLIST`, reap it (the identical cleanup
 *   `we:scripts/lane-pool.mjs#cmdRelease` runs at release time — the SAME imported function, never a second
 *   implementation). Also reports current pool health (acquirable / dirty / leased counts) as its own
 *   `--dry-run` output.
 *
 * WHY A PERIODIC PASS IS NEEDED BESIDE THE RELEASE-TIME FIX. A release-time-only fix does nothing for litter
 * that predates the fix, or that accumulates through any path other than a normal `release` (an aborted
 * session, a killed agent, a manual abandonment leaving a leased lane's marker stranded and later TTL-reaped
 * by a path that never runs the litter cleanup). This pass reclaims that litter on the next tick instead of
 * leaving it inert until someone happens to re-release that exact lane.
 *
 * THIS PASS IS ACTION (auto-reap), NOT DETECT-ONLY — unlike `we:scripts/conveyor/duplicate-pr-watch.mjs`'s
 * alert-only stance. "Does this lane's ENTIRE dirty state match only the named allowlist" is a deterministic,
 * allowlist-scoped classification with no content judgment involved (the same reasoning
 * `we:backlog/3562-*.md` point 4 already uses to justify its own pass being action rather than alert-only) — a
 * LEASED lane, or any lane carrying so much as ONE non-allowlisted dirty path, is never touched.
 *
 * PURE CORE / IO SHELL SPLIT (mirrors `we:scripts/conveyor/duplicate-pr-watch.mjs`):
 *   • {@link planLaneReap} is PURE — no fs/git/gh/clock/process (built on top of
 *     `we:scripts/lib/lane-litter.mjs#planLitterCleanup`, itself pure).
 *   • The IO shell ({@link defaultListLaneStatus}, {@link defaultReadPorcelain}, {@link watchLanePoolHealth},
 *     {@link runLanePoolHealthWatch}, the CLI) owns every subprocess/git call.
 *
 * CONFIG KNOB. `WE_LANE_POOL_HEALTH_WATCH_DISABLED` (presence-checked, any value) — mirrors
 * `we:scripts/conveyor/queue.mjs`'s `CONVEYOR_NO_KIND_CHECK` convention — makes {@link runLanePoolHealthWatch}
 * a true no-op: no status read, no reap, no report. Checked first, inside the entrypoint itself, so
 * `we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses` needs no change to disable this pass.
 *
 * THE CADENCE. Wired into `we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses`, beside the
 * `we:scripts/conveyor/duplicate-pr-watch.mjs` / `we:scripts/conveyor/parked-pr-conflict-watch.mjs` lines — the
 * same "piggyback on a pass the headless runner already ticks" shape, so pool litter is reclaimed every tick
 * with no new cron/daemon.
 */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { planLitterCleanup, cleanLaneLitter, LANE_RELEASE_LITTER_ALLOWLIST } from '../lib/lane-litter.mjs';
// #3568 — the pure decision core only, reused rather than re-derived (the SAME `isLeaseStale`
// `we:scripts/lane-pool.mjs` itself calls). See `defaultIsLeasedNow` below.
import { LEASE_FILENAME, isLeaseStale } from '../lib/lane-lease.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The repo root, resolved from this file's own location — same derivation as
 *  `we:scripts/conveyor/duplicate-pr-watch.mjs#REPO_ROOT`. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** The env var that makes {@link runLanePoolHealthWatch} a true no-op — presence-checked, any value. */
export const DISABLE_ENV_VAR = 'WE_LANE_POOL_HEALTH_WATCH_DISABLED';

// ── PURE CORE (no fs / git / gh / clock / process — every input is injected) ───────────────────────────────

/**
 * THE WHOLE DECISION: given the pool's lane rows (each carrying its raw `porcelain` — `null` for a leased lane
 * or a failed status read), classify each unleased lane as `reap` / `already-clean` / `leave-dirty` /
 * `read-error`. Pure — reuses `planLitterCleanup` verbatim rather than re-deriving the allowlist match.
 *
 * DELIBERATELY STRICTER than `cmdRelease`: reaps a lane only when its ENTIRE porcelain is litter (never a
 * partial reap alongside real dirt), unlike `cmdRelease`'s unconditional per-file strip on a lane its own
 * occupant just released. This pass scans lanes with no live owner to ask, so a lane mixing litter with real
 * abandoned work is left untouched for a human/agent to inspect — matching this backlog item's Done-when spec.
 * @param {Array<{lane:number, path:string, exists?:boolean, leased?:boolean, porcelain?:string|null}>} lanes
 * @param {string[]} [allowlist]
 * @returns {Array<{lane:number, path:string,
 *   action:'skip-leased'|'reap'|'already-clean'|'leave-dirty'|'read-error', toRemove?:string[],
 *   leaveDirty?:string[]}>}
 */
export function planLaneReap(lanes, allowlist = LANE_RELEASE_LITTER_ALLOWLIST) {
  const results = [];
  for (const l of Array.isArray(lanes) ? lanes : []) {
    if (!l || l.exists === false) continue; // a lane index with no clone on disk — nothing to reap
    if (l.leased) { results.push({ lane: l.lane, path: l.path, action: 'skip-leased' }); continue; }
    // A `git status --porcelain` read that itself FAILED (e.g. the lane dir vanished mid-tick) must never
    // silently read as "clean" — that would report an unverified lane as safely acquirable. `null` is the
    // read-failure sentinel `defaultReadPorcelain` returns; an EMPTY STRING (genuinely clean) still falls
    // through to the ordinary already-clean branch below.
    if (l.porcelain === null) { results.push({ lane: l.lane, path: l.path, action: 'read-error' }); continue; }
    const { toRemove, leaveDirty } = planLitterCleanup(l.porcelain, allowlist);
    if (toRemove.length > 0 && leaveDirty.length === 0) {
      results.push({ lane: l.lane, path: l.path, action: 'reap', toRemove });
    } else if (toRemove.length === 0 && leaveDirty.length === 0) {
      results.push({ lane: l.lane, path: l.path, action: 'already-clean' });
    } else {
      // leaveDirty is non-empty — real (or unknown) dirty state present, whether or not litter is ALSO
      // present alongside it. Never partially reaped — see this function's own docblock for why that is a
      // deliberate divergence from `cmdRelease`, not a bug.
      results.push({ lane: l.lane, path: l.path, action: 'leave-dirty', leaveDirty });
    }
  }
  return results;
}

/**
 * Current pool health counts from the plan + the raw lane rows — acquirable / dirty(unleased) / leased —
 * the plain status line this pass reports every tick (not the historical rolling-window artifact
 * `we:backlog/3569-*.md` covers — see that card's own cross-reference to this one). Pure.
 *
 * `reaped` is the list of lanes a `reap` action ACTUALLY succeeded for (empty on a `--dry-run`, or when a
 * lane's reap call threw). A lane whose plan action is `'reap'` counts as acquirable ONLY when it is in this
 * list — never on the pre-execution plan action alone, which would optimistically report a lane "acquirable"
 * even when its reap call failed and left the litter (and hence the dirty tree) exactly where it was, or when
 * a `--dry-run` never touched it at all.
 * @param {Array<{lane:number, exists?:boolean, leased?:boolean}>} lanes
 * @param {Array<{lane:number, action:string}>} plan
 * @param {number[]} [reaped]
 * @returns {{total:number, leased:number, acquirable:number, dirtyUnleased:number}}
 */
export function summarizeHealth(lanes, plan, reaped = []) {
  const existing = (Array.isArray(lanes) ? lanes : []).filter((l) => l && l.exists !== false);
  const leased = existing.filter((l) => l.leased).length;
  const reapedSet = new Set(reaped);
  const acquirableLanes = new Set(
    plan
      .filter((p) => p.action === 'already-clean' || (p.action === 'reap' && reapedSet.has(p.lane)))
      .map((p) => p.lane),
  );
  const acquirable = existing.filter((l) => !l.leased && acquirableLanes.has(l.lane)).length;
  const dirtyUnleased = existing.filter((l) => !l.leased && !acquirableLanes.has(l.lane)).length;
  return { total: existing.length, leased, acquirable, dirtyUnleased };
}

// ── IO SHELL (subprocess/git only past this point — the CLI, gated on the main-module check) ────────────────

/**
 * The live pool-status query — shells `node lane-pool.mjs status --json`, the SAME data
 * `we:scripts/lane-pool.mjs#printStatus --json` reports (never a re-derived reader). `exec` is injectable so
 * the argv is assertable with no real subprocess.
 * @param {{exec?:Function, repo?:string|null, root?:string}} [o]
 * @returns {{repo?:string, root?:string, lanes:Array<object>}}
 */
export function defaultListLaneStatus({ exec = execFileSync, repo = null, root = REPO_ROOT } = {}) {
  const argv = [join(root, 'scripts', 'lane-pool.mjs'), 'status', '--json'];
  if (repo) argv.push(`--repo=${repo}`);
  const out = exec('node', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(String(out || '{}'));
  return { repo: parsed.repo, root: parsed.root, lanes: Array.isArray(parsed.lanes) ? parsed.lanes : [] };
}

/**
 * Raw `git status --porcelain` for one lane's tree. `exec` is injectable. Never throws — a read failure
 * (e.g. the lane dir vanished mid-tick) reads as `null`, which {@link planLaneReap} reports explicitly as
 * `action: 'read-error'` (never silently treated as clean, and never silently reaped).
 * @param {string} dir
 * @param {Function} [exec]
 * @returns {string|null}
 */
export function defaultReadPorcelain(dir, exec = execFileSync) {
  try {
    return exec('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

/**
 * TOCTOU guard (#3568) — is this lane leased RIGHT NOW, read directly off its marker rather than the
 * `listStatus` snapshot the sweep started from? `we:scripts/lib/lane-litter.mjs#cleanLaneLitter` takes this AS
 * its own `isLeasedNow` option and calls it as the LAST gate right before the mutation (see that file for why
 * it belongs there, not earlier). Reuses `isLeaseStale` — the same rule `we:scripts/lane-pool.mjs` applies —
 * rather than re-deriving it; only the trivial marker read/parse is duplicated (`lane-lease.mjs` is documented
 * PURE/no-fs, and `lane-pool.mjs` is unsafe to import — it runs its CLI at module load). Fails OPEN to "not
 * leased" on a missing/corrupt marker, matching `lane-pool.mjs#readLease`'s own fail-open.
 * @param {string} dir
 * @returns {boolean}
 */
export function defaultIsLeasedNow(dir) {
  try {
    const file = join(dir, '.git', LEASE_FILENAME);
    if (!existsSync(file)) return false;
    const lease = JSON.parse(readFileSync(file, 'utf8'));
    return !!(lease && typeof lease === 'object' && !Array.isArray(lease) && !isLeaseStale(lease, Date.now()));
  } catch {
    return false;
  }
}

/**
 * THE IO SHELL. Reads live pool status, reads each unleased lane's porcelain, plans the reap
 * ({@link planLaneReap}), and — unless `dryRun` — reaps every `action:'reap'` lane via the SAME
 * `we:scripts/lib/lane-litter.mjs#cleanLaneLitter` `cmdRelease` calls at release time, passing
 * {@link defaultIsLeasedNow} straight into that call so its own fresh read and lease re-check gate the
 * mutation from inside its own function body, with no separate pre-check here that could reopen the race
 * window (see `cleanLaneLitter`'s own docblock). Never throws on a per-lane reap failure — one bad lane must
 * not stop the sweep from reaping the rest.
 * @param {{repo?:string|null, root?:string, listStatus?:Function, readPorcelain?:Function, reap?:Function,
 *   isLeasedNow?:Function, dryRun?:boolean}} [o]
 * @returns {{health:{total:number,leased:number,acquirable:number,dirtyUnleased:number}, plan:Array<object>,
 *   reaped:number[], dryRun:boolean}}
 */
export function watchLanePoolHealth({
  repo = null, root = REPO_ROOT, listStatus = defaultListLaneStatus, readPorcelain = defaultReadPorcelain,
  reap = cleanLaneLitter, isLeasedNow = defaultIsLeasedNow, dryRun = false,
} = {}) {
  const status = listStatus({ repo, root });
  const lanes = status.lanes.map((l) => (
    l && l.exists !== false && !l.leased ? { ...l, porcelain: readPorcelain(l.path) } : l
  ));
  const plan = planLaneReap(lanes);
  const reaped = [];
  if (!dryRun) {
    for (const p of plan) {
      if (p.action !== 'reap') continue;
      try {
        const outcome = reap(p.path, { isLeasedNow });
        // `outcome.complete` — never a length comparison against this tick's OWN (possibly stale) `p.toRemove`
        // snapshot, which would misjudge a lane whose real litter set changed size between the snapshot and
        // this call. `cleanLaneLitter` judges completeness against its own fresh read; trust that instead.
        if (outcome && outcome.complete) reaped.push(p.lane);
      } catch { /* best-effort — one bad reap never stops the rest of the sweep */ }
    }
  }
  return { health: summarizeHealth(lanes, plan, reaped), plan, reaped, dryRun };
}

/**
 * THE ENTRYPOINT. Checks {@link DISABLE_ENV_VAR} FIRST — set to any value, this returns `{disabled:true}`
 * having read NOTHING (no `listStatus` call, no reap, no report), so the config knob degrades to a true no-op
 * tick with no change needed to `makeCliMechanicalPasses` itself.
 * @param {{env?:object} & Parameters<typeof watchLanePoolHealth>[0]} [o]
 * @returns {{disabled:true}|ReturnType<typeof watchLanePoolHealth>}
 */
export function runLanePoolHealthWatch({ env = process.env, ...opts } = {}) {
  // PRESENCE-checked, not truthiness-checked: `WE_LANE_POOL_HEALTH_WATCH_DISABLED=` (set to an empty string)
  // must still disable — a bare truthiness check (`if (env[DISABLE_ENV_VAR])`) treats `''` as unset and would
  // silently run anyway, contradicting the "any value" contract documented on `DISABLE_ENV_VAR` above.
  if (env[DISABLE_ENV_VAR] !== undefined) return { disabled: true };
  return watchLanePoolHealth(opts);
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || undefined;
  const repo = flag('repo') || null;
  const dryRun = argv.includes('--dry-run');
  try {
    const result = runLanePoolHealthWatch({ repo, dryRun });
    if (result.disabled) {
      process.stderr.write(`  lane-pool-health-watch: disabled (${DISABLE_ENV_VAR} set)\n`);
    } else {
      const { health, plan, reaped } = result;
      process.stderr.write(
        `  pool health: ${health.acquirable} acquirable · ${health.dirtyUnleased} dirty(unleased) · ` +
          `${health.leased} leased · ${health.total} total\n`,
      );
      for (const p of plan) {
        if (p.action === 'reap') {
          const verb = dryRun ? 'would reap' : reaped.includes(p.lane) ? 'reaped' : 'FAILED to reap';
          process.stderr.write(`  lane-${p.lane}: ${verb} litter-only dirty state (${p.toRemove.join(', ')})\n`);
        } else if (p.action === 'leave-dirty') {
          process.stderr.write(`  lane-${p.lane}: left dirty — non-allowlisted state present\n`);
        }
      }
    }
    process.stdout.write(`${JSON.stringify({ checked: true, ...result })}\n`);
  } catch (e) {
    process.stderr.write(`error: ${String(e?.message ?? e)}\n`);
    process.exitCode = 1;
  }
}
