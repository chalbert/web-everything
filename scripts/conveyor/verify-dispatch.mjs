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
 * CORRECTION (#3878, epic #3383). The paragraph above states the intended safety property, but confirmed by
 * direct read (grep over `we:skills-src/conveyor/runner.mjs` turns up zero references to this file), this
 * script was NEVER actually wired into that runner's own `makeCliMechanicalPasses` list on `main` — there is
 * no `mechanicalPasses` entry for it to be "dropped" once a standalone daemon exists, contrary to what this
 * file's own header (and #3878's own card digest, copying it) implied. So "the runner is a SINGLETON" was, at
 * best, a borrowed, code-unenforced assumption about however else this file happened to be invoked — never a
 * property THIS file held. #3878 closes that gap for real: `we:skills-src/conveyor/verify-daemon.mjs` now
 * wraps {@link runVerifyDispatch} (below) as a standalone daemon that takes its OWN keyed
 * `we:skills-src/conveyor/runner-lock.mjs` lease (`<conveyor:verify-daemon-lease>`) before ticking it, so at
 * most one live copy of that daemon ever dispatches a gate run at a time — independent of whatever else may
 * invoke this file directly (a human running the CLI by hand, say), which carries the same standing,
 * unchanged risk it always has.
 *
 * A HARD WALL-CLOCK CEILING, NOT JUST A DOCUMENTED ONE (epic #3383, live incident 2026-09-14). The gate's
 * documented normal range is 150-350s; before this, nothing here bounded it — a single genuinely-stuck (or
 * merely starved, under heavy concurrent-lane contention) gate blocked EVERY lane's dispatch indefinitely,
 * because this pass is synchronous and one request is handled to completion before the next is even looked
 * at. `VERIFY_DISPATCH_TIMEOUT_MS` (default 30 minutes — several multiples of the documented ceiling, chosen
 * generously so a legitimately slow run under contention is never killed for being merely slow — the live
 * incident's own gate finished on its own at ~19-20 minutes under heavy contention, which is why the cap is
 * NOT tucked in near the 15-20 minute range) bounds that wait. On timeout the WHOLE process tree is killed,
 * not just the immediate child: `verify-lane.mjs` itself `execSync`s the gate command through a shell, so the
 * actual test runner is a grandchild that would never see a signal sent only to its parent — spawning the
 * dispatch with `detached: true` puts that whole tree in one process group up front, so the timeout handler
 * can kill the group as a unit. The tick then moves on, counting the lane as a dispatch failure. NO NEW
 * RECOVERY PATH WAS NEEDED: a killed run leaves the marker `running`/stranded, which is already the exact
 * shape `verify-lane.mjs`'s own marker-guard recovers from — the next tick just re-runs it, same as a
 * human-killed run always has.
 *
 * TWO SEPARATE CEILINGS, NOT ONE (Skeptic-review fix, 2026-09-14, same epic). The FIRST cut of the ceiling
 * above measured wall-clock time from the moment this file SPAWNS `verify-lane.mjs` — which is BEFORE that
 * child even tries to acquire its own `heavy-admission.mjs` capacity slot, not after. `heavy-admission.mjs`'s
 * admission wait lets a spawned verify legitimately spend real time just WAITING for a free admission slot
 * before its actual gate work starts — real queuing, not a hang. A single 30-minute ceiling measured from
 * spawn therefore conflates "queued a while then ran a normal 5-minute gate" (healthy) with "queued a while
 * then ran a genuinely-stuck gate" (also healthy-looking until it blows past 30) — and worse, a HEALTHY run
 * that queues and then hits the very contention this ceiling was built to survive (the live incident's own
 * ~19-20 minute gate) could total more than 30 minutes and get killed anyway, defeating the ceiling's own
 * stated purpose of distinguishing hung from merely-queued. The fix: measure GATE time only. `verify-lane.mjs`
 * now writes an UNCONDITIONAL marker line to its own stderr ({@link GATE_STARTED_MARKER}) the instant before
 * it runs the real gate command — after admission, win or fail-open, every time. This file watches the
 * child's stderr as it streams (a `spawn`, not the old blocking `execFileSync`) and runs TWO SEPARATE timers,
 * never stacked: `QUEUE_PHASE_CEILING_MS` from spawn until the marker appears — a safety net barely above
 * `heavy-admission.mjs`'s own hard give-up ceiling (xhlriy2, #3383: {@link resolveCeilingMs}, 120 minutes by
 * default — NOT the vestigial 20-minute `resolveTimeoutMs`/`DEFAULT_TIMEOUT_MS`, which no longer bounds how
 * long `acquireSlotBlocking` legitimately waits while a slot holder is alive), since that ceiling already
 * bounds a HEALTHY wait; this one only fires on a hang BEFORE admission is even reached, or a dropped marker
 * write — and `VERIFY_DISPATCH_TIMEOUT_MS` (unchanged, 30 minutes, same generous multiple of the documented
 * 150-350s range) from the marker until the gate itself finishes. Seeing the marker CANCELS the queue timer
 * and starts a fresh gate timer — it does not extend or add to the queue one. On EITHER timeout the whole
 * process-group kill above still applies unchanged.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors lease-reaper.mjs): {@link laneNeedsVerifyDispatch} is pure (no fs/git);
 * the IO shell owns the POOL_ROOT walk, marker reads, the `git rev-parse HEAD` per lane, and the actual
 * `verify-lane.mjs` spawn. {@link runVerifyDispatch} is that whole IO-shell sweep, exported and exit-free (it
 * never calls `process.exit`) — the same "export the sweep, let the CLI own exit/format" shape
 * `we:scripts/conveyor/reconcile-fix-dispatch.mjs#runReconcileFixDispatch` already established, which is what
 * lets #3878's standalone `we:skills-src/conveyor/verify-daemon.mjs` tick it directly. `main()` below is now a
 * thin CLI shell over it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readVerifyMarker } from '../lib/lane-verify.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import { resolveCeilingMs as resolveAdmissionCeilingMs } from '../readiness/heavy-admission.mjs';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { branchMatchesQueueIds, isQueueScopeEnabled, readScopedQueueIds } from './queue-scope.mjs';

/** Several multiples of the gate's documented 150-350s normal range — generous on purpose (see file header):
 *  a slow-but-healthy GATE run under contention must never be mistaken for a stuck one. Applies ONLY to the
 *  post-{@link GATE_STARTED_MARKER} phase — see {@link spawnGateBounded}. Overridable so tests don't need to
 *  wait 30 real minutes to prove the mechanism. */
const DEFAULT_VERIFY_DISPATCH_TIMEOUT_MS = 30 * 60 * 1000;
const VERIFY_DISPATCH_TIMEOUT_MS =
  Number(process.env.VERIFY_DISPATCH_TIMEOUT_MS) > 0
    ? Number(process.env.VERIFY_DISPATCH_TIMEOUT_MS)
    : DEFAULT_VERIFY_DISPATCH_TIMEOUT_MS;

/** The literal marker `verify-lane.mjs` writes to its OWN stderr the instant before it runs the real gate
 *  command (see that file's call site) — the ONE signal this file needs to tell "still queuing" from "gate
 *  work has actually started," without inventing a second, parallel marker vocabulary. */
export const GATE_STARTED_MARKER = 'gate execution starting';

/** The PRE-marker (queuing) ceiling — a safety net, not the primary defense against a stuck queue wait. The
 *  real ceiling on legitimate queuing is `heavy-admission.mjs`'s own hard give-up ceiling (xhlriy2, #3383:
 *  `DEFAULT_ADMISSION_CEILING_MS` / `WE_HEAVY_ADMISSION_CEILING_MS`, 120 minutes by default) — NOT the
 *  vestigial `DEFAULT_TIMEOUT_MS` / `WE_HEAVY_ADMISSION_TIMEOUT_MS` (20 minutes), which no longer decides when
 *  `acquireSlotBlocking` gives up: a waiter now keeps polling for as long as a slot holder is provably alive,
 *  so a HEALTHY queuing wait can legitimately run all the way to the 120-minute ceiling before
 *  `acquireSlotBlocking` FAILS OPEN and `verify-lane.mjs` proceeds unslotted, logging one of its two admission
 *  lines and then — unconditionally, win or fail-open — {@link GATE_STARTED_MARKER}. So a HEALTHY run's
 *  pre-marker phase can never legitimately exceed that same ~120-minute figure. `QUEUE_PHASE_BUFFER_MS` on top
 *  of it covers overhead OUTSIDE the admission wait itself (the lane's own `git` calls, marker read/write,
 *  gate resolution) plus scheduling slack — this ceiling exists to catch a hang BEFORE `verify-lane.mjs` ever
 *  reaches admission (or a bug that silently drops the marker write), not to re-bound the admission wait a
 *  second time. Derived from the SAME env `verify-lane.mjs`'s own admission wait resolves from
 *  (`resolveAdmissionCeilingMs`), so tuning `WE_HEAVY_ADMISSION_CEILING_MS` keeps this safety net correctly
 *  proportioned automatically. Overridable independently via `VERIFY_DISPATCH_QUEUE_CEILING_MS`, so a test can
 *  shrink either phase without touching the other. */
const QUEUE_PHASE_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_QUEUE_PHASE_CEILING_MS = resolveAdmissionCeilingMs(process.env) + QUEUE_PHASE_BUFFER_MS;
const QUEUE_PHASE_CEILING_MS =
  Number(process.env.VERIFY_DISPATCH_QUEUE_CEILING_MS) > 0
    ? Number(process.env.VERIFY_DISPATCH_QUEUE_CEILING_MS)
    : DEFAULT_QUEUE_PHASE_CEILING_MS;

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
    // #x5n4zn3 — was bare (no timeout). This file's own main `verify-lane.mjs` spawn already has its own
    // dedicated two-phase queue/gate timeout (see file header) — deliberately untouched here — but this SEPARATE
    // small git helper (pool-scan / marker reads) had none at all.
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' }).trim();
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

/**
 * Run `node <args…>` (the `verify-lane.mjs` spawn), bounded by TWO SEPARATE wall-clock ceilings instead of
 * one blanket one (the fix this exports — see the file header's "TWO SEPARATE CEILINGS" section):
 * `queueCeilingMs` covers everything BEFORE the child logs {@link GATE_STARTED_MARKER} to its own stderr;
 * `gateCeilingMs` covers everything AFTER. Whichever ceiling is ACTIVE is whichever phase the child is really
 * in — seeing the marker CANCELS the queue-phase timer and starts a FRESH gate-phase one; it never stacks or
 * extends them. `detached: true` mirrors the old `execFileSync` behavior exactly: the whole spawned tree gets
 * its own process group so a timeout kill reaches `verify-lane.mjs` → its own `execSync`'d shell → the real
 * test runner as a unit, never orphaning the grandchild (the same failure mode the original ceiling PR fixed).
 * @param {string[]} args        argv for `node` (the target script path first, mirrors `execFileSync`'s usage)
 * @param {{queueCeilingMs:number, gateCeilingMs:number}} ceilings
 * @returns {Promise<{pid:number}>} resolves on a clean (possibly non-zero, non-timeout) exit
 * @throws {Error & {status:number|null, signal:string|null, pid:number, timedOutPhase?:'queue'|'gate'}}
 *   shaped like `execFileSync`'s own timeout/non-zero errors, plus `timedOutPhase` so the caller can log which
 *   ceiling actually fired.
 */
export function spawnGateBounded(args, { queueCeilingMs, gateCeilingMs }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stderrTail = '';
    let markerSeen = false;
    let timedOutPhase = null;

    const onTimeout = (phase) => () => {
      timedOutPhase = phase;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already gone — fine, that's the goal.
      }
    };
    let timer = setTimeout(onTimeout('queue'), queueCeilingMs);

    child.stderr.on('data', (chunk) => {
      if (markerSeen) return;
      // Bounded tail — this only ever needs to catch ONE short literal line near the start of the stream;
      // keeping the last ~4KB is generous headroom without letting a chatty gate grow this buffer forever.
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4096);
      if (stderrTail.includes(GATE_STARTED_MARKER)) {
        markerSeen = true;
        clearTimeout(timer);
        timer = setTimeout(onTimeout('gate'), gateCeilingMs);
      }
    });
    // Drain stdout so a full pipe buffer can never back-pressure/stall the child — this file never reads it
    // (mirrors the old `execFileSync` call site, which discarded it too).
    child.stdout.on('data', () => {});

    child.on('error', (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOutPhase) {
        const e = new Error(`verify-lane exceeded the ${timedOutPhase}-phase ceiling`);
        e.status = null;
        e.signal = signal || 'SIGKILL';
        e.pid = child.pid;
        e.timedOutPhase = timedOutPhase;
        rejectPromise(e);
      } else if (code !== 0) {
        const e = new Error(`verify-lane exited with code ${code}`);
        e.status = code;
        e.signal = signal;
        e.pid = child.pid;
        rejectPromise(e);
      } else {
        resolvePromise({ pid: child.pid });
      }
    });
  });
}

/**
 * Run one full sweep: scan every pool/lane for a lane whose marker needs a verify dispatch (per
 * {@link laneNeedsVerifyDispatch}), spawn a bounded gate run for each, and return a plain summary. Never calls
 * `process.exit` — this is the one thing #3878's standalone Verify daemon
 * (`we:skills-src/conveyor/verify-daemon.mjs`) ticks directly, and `main()` below is now a thin CLI shell over
 * it (exit code + `--json`/plain formatting only).
 * @param {{dryRun?:boolean}} [o]
 * @returns {Promise<{dryRun:boolean, dispatched:Array<object>, failures:Array<object>, skippedOutOfScope:Array<object>}>}
 */
export async function runVerifyDispatch({ dryRun = false } = {}) {
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
        await spawnGateBounded(args, { queueCeilingMs: QUEUE_PHASE_CEILING_MS, gateCeilingMs: VERIFY_DISPATCH_TIMEOUT_MS });
        dispatched.push({ pool, lane, sha: headSha });
      } catch (e) {
        // A red gate is a NORMAL, expected exit (verify-lane exits 2 on red) — it already recorded the red
        // marker correctly; this is not a dispatch failure. Only a THROW verify-lane itself did not turn into
        // a marker write (a spawn error, an unexpected non-{0,2} exit) counts as one, and is logged, never
        // fatal to the rest of this pass — one bad lane must not block dispatching the others.
        const status = Number.isFinite(e && e.status) ? e.status : null;
        // Trust `e.timedOutPhase` directly — it is `spawnGateBounded`'s OWN authoritative record of whether
        // ONE OF OUR TWO TIMERS actually fired, set only inside its own `onTimeout` handler. A prior version
        // of this check re-derived "timed out" from the exit shape alone (`status === null && signal present`)
        // — but that shape is NOT unique to our own kill: an external actor (an operator's `kill -9`, an OS
        // OOM-kill, a host restart) killing the spawned `verify-lane.mjs` process produces the exact same
        // `status:null, signal:<sig>` pair, and the re-derived check would then misattribute that external
        // kill as "exceeded the queue/gate ceiling" — misleading during exactly the incident investigation
        // this ceiling exists to support (found in review, epic #3383). Functionally harmless either way (the
        // lane lands in `failures` and gets retried next tick regardless), but the LABEL must be accurate.
        const timedOut = !!(e && e.timedOutPhase);
        if (timedOut) {
          const phase = e.timedOutPhase || 'gate';
          const ceilingMs = phase === 'queue' ? QUEUE_PHASE_CEILING_MS : VERIFY_DISPATCH_TIMEOUT_MS;
          log(`  ⚠ ${pool}/lane-${lane}: verify-lane exceeded the ${ceilingMs}ms ${phase}-phase ceiling — killed (tree included). Marker is left running/stranded; the next tick re-runs it, same as any other killed-mid-run recovery.`);
          failures.push({ pool, lane, sha: headSha, timedOut: true, timedOutPhase: phase });
        } else if (status === 2) {
          dispatched.push({ pool, lane, sha: headSha, red: true });
        } else {
          log(`  ⚠ ${pool}/lane-${lane}: verify-lane dispatch failed (non-fatal): ${String(e?.message || e).split('\n')[0]}`);
          failures.push({ pool, lane, sha: headSha });
        }
      }
    }
  }

  return { dryRun, dispatched, failures, skippedOutOfScope };
}

async function main(argv) {
  const flags = parseFlags(argv);
  const result = await runVerifyDispatch({ dryRun: !!flags['dry-run'] });

  if (flags.json) {
    writeAllSync(1, JSON.stringify(result, null, 2) + '\n');
  } else if (result.dispatched.length === 0 && result.failures.length === 0) {
    log('verify-dispatch: nothing pending.');
  }
  process.exit(result.failures.length > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`✗ verify-dispatch error: ${String((e && e.stack) || e)}\n`);
    process.exit(1);
  });
}
