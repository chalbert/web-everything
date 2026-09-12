#!/usr/bin/env node
/**
 * @file scripts/conveyor/verify-dispatch.mjs
 * @description The CONVEYOR VERIFY DISPATCH pass (#3105). Picks up a lane's `request`-stamped `.lane-verify`
 *   marker (`scripts/verify-lane.mjs request`) and runs the gate ITSELF, as the runner's own long-lived
 *   process — never inside an interactive agent's own Bash call, which is exactly what #3105 found cannot
 *   finish inside the tool's ~120s foreground window once the gate legitimately takes 150–350s.
 *
 * WHY THIS IS SAFE TO RUN BLOCKING, HERE, WHEN IT WAS NOT SAFE ON THE AGENT'S OWN TURN. The 120s ceiling is a
 * property of the interactive agent tool's own foreground command window — it does not apply to a subprocess
 * this file spawns from `skills-src/conveyor/runner.mjs`'s own already-running, singleton-locked, supervised
 * process (`runner-lock.mjs` + `supervisor.mjs`). Running the gate to completion here simply makes ONE tick
 * take longer; nothing here is bound by a per-turn window.
 *
 * NO NEW MARKER VOCABULARY. A `request`-stamped marker is byte-identical in shape to an ordinary in-flight
 * `running` one — {@link ../lib/lane-verify.mjs}'s `verifyGateDecision` already treats it correctly (refused,
 * "unfinished") with zero changes. This file only decides WHEN to act on one: a lane whose marker is `running`
 * for its OWN current HEAD sha, and re-runs `verify-lane.mjs`'s own `verify` mode UNCHANGED — the exact
 * "re-verifying is legitimate" path the marker's own start-write guard already sanctions (including the
 * recovery case where a prior runner process died mid-run, stranding the marker: the next tick's dispatch just
 * re-runs it, same as a human would).
 *
 * ONE REQUEST PER TICK, HANDLED TO COMPLETION BEFORE THE NEXT IS CONSIDERED. The runner is a SINGLETON (only
 * one live instance), so there is no risk of two dispatches racing the same lane's marker — this pass simply
 * never starts a second `verify-lane.mjs` run until the current one's terminal marker is written. Concurrent
 * lanes each still contend for host CPU exactly as a directly-run `npm run test:unit` always has (#3372
 * already shrinks the common case); this file changes WHO runs the gate, not how expensive it is.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors lease-reaper.mjs): {@link laneNeedsVerifyDispatch} is pure (no fs/git);
 * the IO shell (`main()`) owns the POOL_ROOT walk, marker reads, the `git rev-parse HEAD` per lane, and the
 * actual `verify-lane.mjs` spawn.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readVerifyMarker } from '../lib/lane-verify.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import { branchMatchesQueueIds, isQueueScopeEnabled, readScopedQueueIds } from './queue-scope.mjs';

// ── PURE CORE (no fs / git / clock) ─────────────────────────────────────────────────────────────────────────

/**
 * Should this lane's gate be run NOW? Pure. A dispatch fires on exactly one shape: the marker is `running`
 * (whether freshly `request`-stamped or stranded from a dead prior run — both recover the same way) AND its
 * `sha` matches the lane's OWN current HEAD. Anything else — no marker, a terminal `green`/`red`/`corrupt`
 * record, or a `running` record for a sha that is no longer HEAD (nobody has asked to verify the new one) —
 * is left alone; dispatch only ever reacts to an explicit ask, never re-verifies a lane on its own initiative.
 * @param {{status?:string, sha?:string, corrupt?:boolean}|null} marker
 * @param {string|null} headSha
 * @returns {boolean}
 */
export function laneNeedsVerifyDispatch(marker, headSha) {
  if (!marker || marker.corrupt || !headSha) return false;
  return marker.status === 'running' && marker.sha === headSha;
}

/**
 * Is this lane in scope for THIS checkout? Pure, and the ONE place this pass's own cross-instance leak is
 * closed (epic #3383).
 *
 * A DIFFERENT LEAK AXIS FROM THE PR PASSES, WORTH STATING PLAINLY. The three `gh pr list` watches and
 * `reconcile-pass.mjs` leak across the whole REPOSITORY. This pass never touches `gh` at all — it walks the
 * HOST-WIDE lane pool (`LANE_POOL_ROOT`, default `~/workspace/.lanes`), so a deliberately-scoped scratch
 * instance would happily run a full `verify-lane.mjs` gate for a lane belonging to a completely different
 * conveyor instance on the same machine. Same class of "an isolated instance is not actually isolated" bug,
 * reached through the filesystem rather than through GitHub.
 *
 * DEFAULT OFF, exactly like the PR passes: `enabled: false` ⇒ `true` for every lane, i.e. today's behavior to
 * the byte. Scoped ⇒ the lane's own branch must name a queued item. A lane with NO readable branch (a detached
 * HEAD, an unreadable checkout) is OUT of scope when scoping is on — the safe direction here, since the whole
 * point of a scoped instance is to touch only what it can positively identify as its own.
 * @param {string|null} branch the lane's current branch (`git -C <laneDir> rev-parse --abbrev-ref HEAD`)
 * @param {{enabled?:boolean, ids?:string[]}} [scope]
 * @returns {boolean}
 */
export function laneInQueueScope(branch, { enabled = false, ids = [] } = {}) {
  if (!enabled) return true;
  return branchMatchesQueueIds(branch, ids);
}

// ── IO SHELL (runs only as a CLI) ───────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY_LANE_CLI = join(HERE, '..', 'verify-lane.mjs');
const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const POOL_ROOT = expandHome(process.env.LANE_POOL_ROOT) || join(homedir(), 'workspace', '.lanes');

const log = (m) => process.stderr.write(m + '\n');

/** Lane indices under a pool dir (`lane-N` children), sorted — mirrors lane-pool's own `laneIndicesIn`. */
function laneIndicesIn(poolDir) {
  if (!existsSync(poolDir)) return [];
  return readdirSync(poolDir)
    .filter((d) => /^lane-\d+$/.test(d))
    .map((d) => Number(d.slice(5)))
    .sort((a, b) => a - b);
}

/** Pool names under POOL_ROOT that hold lanes — mirrors lease-reaper.mjs's `poolsToScan` (no `--pool` filter
 *  here: unlike the reaper, a delivery agent may request verification from any pool this runner drives). */
function poolsToScan() {
  if (!existsSync(POOL_ROOT)) return [];
  return readdirSync(POOL_ROOT)
    .filter((name) => laneIndicesIn(join(POOL_ROOT, name)).length > 0)
    .sort();
}

function tryGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** Read a lane's `.lane-verify` marker via the real (possibly worktree-relocated) git dir — mirrors
 *  `verify-lane.mjs`'s own resolution, never a hardcoded `join(dir, '.git', …)` (that throws in a worktree). */
function markerFor(laneDir) {
  const gitDir = tryGit(['rev-parse', '--absolute-git-dir'], laneDir) || join(laneDir, '.git');
  return readVerifyMarker(gitDir);
}

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

function main(argv) {
  const flags = parseFlags(argv);
  const dryRun = !!flags['dry-run'];
  const dispatched = [];
  const failures = [];
  // epic #3383 — read ONCE per run, never per lane. Both reads are cheap, but the marker/queue pair must be a
  // single consistent snapshot for the whole sweep rather than re-read mid-walk.
  const scopeEnabled = isQueueScopeEnabled();
  const scopeIds = scopeEnabled ? readScopedQueueIds() : [];
  const skippedOutOfScope = [];
  if (scopeEnabled) {
    log(`⊂ queue-scoped: verify-dispatch will run the gate only for lanes on ${scopeIds.length ? scopeIds.join(', ') : '(nothing — the queue is empty)'}`);
  }

  for (const pool of poolsToScan()) {
    const poolDir = join(POOL_ROOT, pool);
    for (const lane of laneIndicesIn(poolDir)) {
      const dir = join(poolDir, `lane-${lane}`);
      const headSha = tryGit(['rev-parse', 'HEAD'], dir);
      const marker = markerFor(dir);
      if (!laneNeedsVerifyDispatch(marker, headSha)) continue;
      // Read the branch ONLY for a lane that already wants a gate run — the common "nothing pending" lane
      // never pays for the extra `git` call, and an unscoped run never pays for it at all.
      if (scopeEnabled) {
        const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
        if (!laneInQueueScope(branch, { enabled: true, ids: scopeIds })) {
          log(`  ⊂ skipping ${pool}/lane-${lane} (${branch || 'no branch'}) — not in this checkout's queue scope`);
          skippedOutOfScope.push({ pool, lane, branch });
          continue;
        }
      }

      if (dryRun) {
        log(`  would dispatch verify for ${pool}/lane-${lane} @ ${String(headSha).slice(0, 8)} (suites: ${marker.suites || 'default'})`);
        dispatched.push({ pool, lane, sha: headSha });
        continue;
      }

      log(`  dispatching verify for ${pool}/lane-${lane} @ ${String(headSha).slice(0, 8)} (suites: ${marker.suites || 'default'})…`);
      try {
        const args = [VERIFY_LANE_CLI, `--repo=${dir}`, '--json'];
        if (marker.suites) args.push(`--gate=${marker.suites}`);
        execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        dispatched.push({ pool, lane, sha: headSha });
      } catch (e) {
        // A red gate is a NORMAL, expected exit (verify-lane exits 2 on red) — it already recorded the red
        // marker correctly; this is not a dispatch failure. Only a THROW verify-lane itself did not turn into
        // a marker write (a spawn error, an unexpected non-{0,2} exit) counts as one, and is logged, never
        // fatal to the rest of this pass — one bad lane must not block dispatching the others.
        const status = Number.isFinite(e && e.status) ? e.status : null;
        if (status === 2) {
          dispatched.push({ pool, lane, sha: headSha, red: true });
        } else {
          log(`  ⚠ ${pool}/lane-${lane}: verify-lane dispatch failed (non-fatal): ${String(e?.message || e).split('\n')[0]}`);
          failures.push({ pool, lane, sha: headSha });
        }
      }
    }
  }

  if (flags.json) {
    // `skippedOutOfScope` is ADDITIVE — the two keys every existing consumer reads are unchanged, and an
    // unscoped run reports it as `[]`, so the JSON contract is a superset of what it always was.
    writeAllSync(1, JSON.stringify({ dryRun, dispatched, failures, skippedOutOfScope }, null, 2) + '\n');
  } else if (dispatched.length === 0 && failures.length === 0) {
    log('verify-dispatch: nothing pending.');
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
