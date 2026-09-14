#!/usr/bin/env node
/**
 * @file scripts/readiness/heavy-admission.mjs
 * @description THE HEAVY-COMMAND ADMISSION QUEUE (#3461, ratified by #3456) — a capacity semaphore, distinct
 *   from lane leasing, that caps how many of a closed named set of heavy commands (`check:standards`,
 *   `verify-lane`/`test:unit`, the Playwright visual-capture pass) may run CONCURRENTLY across dispatched
 *   lanes on one host. v1 is an EQUAL-COST NAMED SET — every heavy command consumes exactly one slot, none is
 *   weighted differently.
 *
 * THE CAP APPLIES AT INVOCATION TIME, NEVER AT LANE-ACQUIRE TIME (#3456's own ruling). A lane may always be
 * acquired freely — `lane-pool.mjs acquire`'s `ensureDeps` `npm ci` is therefore a DELIBERATE, NAMED EXCEPTION
 * to this queue (see the comment at its call site) rather than gated here: gating it would violate "a lane may
 * always be acquired freely." The heavy command itself queues on this semaphore right before it actually runs
 * — see `verify-lane.mjs`'s `execSync(GATE, …)` call site for the wired example.
 *
 * A GENERAL-PURPOSE `run` CLI MODE (#3383 finding) — the ONLY caller wired into this semaphore before this mode
 * existed was `verify-lane.mjs` itself. Every OTHER path that runs one of the same named heavy commands directly
 * — `skills-src/batch-backlog-items/parallel-execute.workflow.js`'s per-lane `npm run check:standards` + `npm
 * test -- run` gate (step 4, deliberately NOT routed through `verify-lane.mjs` — see that file's own #3321
 * comment for why), `AGENTS.md`'s own Definition-of-Done line ("Run affected tests … for broad changes, `npm
 * test`"), and `docs/agent/testing.md`'s worked examples — runs the SAME heavy commands with ZERO admission-queue
 * coordination, so N parallel `/workflow` lanes (or an ad-hoc interactive/subagent run) can each launch a full
 * `test:unit`/`check:standards` pass at once regardless of the cap. `#3105`'s `guard-bash.mjs` PreToolUse deny
 * only reaches a MECHANICALLY-DISPATCHED agent (one with `WE_DISPATCH_KIND` set); a `/workflow`/`/batch` parallel
 * lane, or the operator's own interactive session, carries no such env var and is unaffected by that guard, so
 * it is never forced through `verify-lane.mjs` either. `run` (see {@link runUnderAdmission} and the CLI section
 * below) gives any such caller a one-line way to opt IN to the SAME semaphore `verify-lane.mjs` uses — never a
 * second/parallel limiter — by wrapping its command: `node scripts/readiness/heavy-admission.mjs run --
 * <command…>` acquires a slot (fail-open on timeout, exactly like `verify-lane.mjs`), runs `<command…>`
 * synchronously in the foreground with inherited stdio, and releases the slot in a `finally` — the identical
 * acquire → execSync → release sequencing `verify-lane.mjs` already has, just exported for any OTHER call site
 * to reuse rather than re-deriving it. Wiring `parallel-execute.workflow.js`'s own step 4 (and the other
 * documented direct-invocation sites) through this wrapper is a follow-up this investigation recommends but does
 * not itself make — see the finding's own PR/commit message for the full list.
 *
 * MECHANISM — generalized from the two existing single-holder advisory locks named in #3456's own "what this
 * decision does NOT settle" section:
 *   • `file-locks.mjs` (#1936) — ONE atomic `mkdir`/`O_EXCL` lock dir per reserved PATH, with a heartbeat-TTL
 *     lease as the correctness floor and a same-machine PID-liveness fast path layered on top.
 *   • `infra-blocked.mjs` — a single-holder advisory state file for one degraded external dependency.
 * Neither is a COUNTING semaphore. This module gets there the cheapest possible way: it does NOT reimplement
 * mkdir/O_EXCL/heartbeat/reclaim — it calls `file-locks.mjs`'s existing atomic primitives `cap` times, once
 * per numbered SLOT (`slot-0` … `slot-<cap-1>`), each a completely ordinary file-lock path. Requesting a slot
 * is "try to win slot-0, else slot-1, … else slot-(cap-1)"; the semaphore's value emerges from `cap` independent
 * single-holder locks rather than being modeled directly. This reuses the EXACT SAME heartbeat-lease / PID
 * fast-path reclaim floor a crashed heavy-command holder needs — a second implementation of that policy would
 * be the thing #2607 forbids.
 *
 * NO HEARTBEAT DURING THE HOLD — a DELIBERATE consequence of who holds a slot. `file-locks.mjs`'s OTHER
 * consumers (`file-locks-cli.mjs`, `drain-lock.mjs`) refresh their lease periodically because they hold a path
 * across many small, interruptible steps. A heavy command holds its slot across ONE synchronous, event-loop
 * -BLOCKING call (`execSync(GATE, …)` in `verify-lane.mjs`) — no timer can fire mid-hold to heartbeat it. Two
 * consequences, both handled explicitly rather than left as a silent gap:
 *   1. `ADMISSION_LEASE_MINUTES` is deliberately LONG (default 60, comfortably past any realistic gate run) —
 *      not `file-locks.mjs`'s general-purpose `DEFAULT_LEASE_MINUTES` (15), which a real `test:unit &&
 *      check:standards` run can plausibly exceed. A too-short lease here would let a SECOND waiter reclaim a
 *      slot out from under a holder that is still legitimately running — silently breaking the cap invariant
 *      this whole module exists to enforce.
 *   2. Since the lease alone is now too coarse to reclaim a genuinely CRASHED holder promptly, the PID
 *      fast-path is WIRED HERE (mirroring `file-locks-cli.mjs`'s `probePidLiveness`) — `tryAcquireSlot` probes
 *      the current holder's `pid` via `kill(pid, 0)` and reclaims immediately on a provably-dead ('ESRCH')
 *      same-machine owner, without waiting out the long TTL. The TTL and the PID fast-path are therefore
 *      DECOUPLED on purpose: the TTL protects a slow-but-alive holder, the PID probe recovers a dead one fast.
 *
 * THE LOCK ROOT IS HOST-SHARED, NOT PER-LANE. A heavy command runs inside ONE lane's own clone, but the cap is
 * a HOST-WIDE resource across every lane of every pool (`web-everything`, `frontierui`, `plateau-app`) — so the
 * root lives at `<workspace>/.lanes/.admission/heavy`, a sibling of every `<pool>/lane-N` clone, derived via the
 * SAME `defaultPoolRoot` a lane's own `verify-lane.mjs` already uses to find its sibling leases.
 *
 * THE CAP IS A FIXED NUMBER, conservative by design (Bazel-style near-full-utilization is explicitly rejected
 * by #3456) — `DEFAULT_ADMISSION_CAP`, overridable per machine via `WE_HEAVY_ADMISSION_CAP`. A NAMED RESIDUAL
 * RISK (#3456, stated plainly per its own Done-when): a fixed cap alone REDUCES but does not FULLY ELIMINATE
 * #3383's finding-4 contention failure mode — a burst of requests can still all queue behind a saturated cap
 * for a while. v1 does not claim to solve that; it only bounds concurrency and makes the wait OBSERVABLE (the
 * `waiting` intent markers this module writes, which `tick-core.mjs` surfaces as `waiting-for-capacity` notes).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reserve, releaseLockDir, readLockEntry } from './file-locks.mjs';
import { defaultPoolRoot } from '../lib/lane-pool-paths.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

/** Conservative default — below measured host capacity, not near-full-utilization (#3456 explicit ruling).
 *  Overridable per machine via `WE_HEAVY_ADMISSION_CAP`. */
export const DEFAULT_ADMISSION_CAP = 2;

/** How often a blocking waiter re-polls for a free slot. */
export const DEFAULT_POLL_MS = 2000;

/** How long a blocking waiter polls before giving up and proceeding unslotted (fail OPEN — a queuing timeout
 *  must never strand a lane's whole delivery arc; see `acquireSlotBlocking`). Overridable via
 *  `WE_HEAVY_ADMISSION_TIMEOUT_MS` (read through {@link resolveTimeoutMs}, mirroring {@link resolveCap}). */
export const DEFAULT_TIMEOUT_MS = 20 * 60_000;

/** The lease a HELD SLOT gets — deliberately longer than `file-locks.mjs`'s general-purpose
 *  `DEFAULT_LEASE_MINUTES` (15). A slot is held across one synchronous, event-loop-blocking `execSync` with no
 *  chance to heartbeat mid-hold (see the module header), so the lease itself must outlast any realistic gate
 *  run rather than relying on a refresh that cannot happen. A genuinely dead holder is still reclaimed promptly
 *  via the PID-liveness fast path in {@link tryAcquireSlot}, not by waiting out this TTL. */
export const ADMISSION_LEASE_MINUTES = 60;

const SUBDIR = join('.admission', 'heavy');
const WAITING_SUBDIR = 'waiting';

/** Resolve the admission cap from env, clamped to a sane minimum of 1 (a cap of 0 would wedge every caller
 *  forever, which is a config bug, not a valid "admit nothing" policy). */
export function resolveCap(env = process.env) {
  const n = Number(env.WE_HEAVY_ADMISSION_CAP);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_ADMISSION_CAP;
}

/** Resolve the wait-then-give-up timeout from env, mirroring {@link resolveCap}. Clamped to a sane minimum of
 *  1000ms — a 0/negative timeout would give up before ever attempting a first acquire. */
export function resolveTimeoutMs(env = process.env) {
  const n = Number(env.WE_HEAVY_ADMISSION_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : DEFAULT_TIMEOUT_MS;
}

/** The host-shared lock root for a checkout (lane or primary) — a sibling of every lane clone, never inside
 *  any one of them, so every lane on the host contends over the SAME slots. */
export function admissionLockRoot(checkoutRoot = process.cwd(), env = process.env) {
  return join(defaultPoolRoot(checkoutRoot, env), SUBDIR);
}

/** The synthetic per-slot "path" `file-locks.mjs` locks — slot identity is just its index. */
export function slotPath(i) {
  return `slot-${i}`;
}

// ── slot acquisition (thin orchestration over file-locks.mjs's existing primitives) ────────────────────

/**
 * Same-machine PID-liveness verdict (mirrors `file-locks-cli.mjs#probePidLiveness` — the layered, NEVER
 * primary, fast path: `kill(pid, 0)` throws ESRCH when no such process exists → provably 'dead'; succeeds →
 * 'alive' (the kernel reuses PIDs, so this does NOT prove it's the same owner — never accelerates a reclaim);
 * a null/own/foreign-host pid is 'unknown' (TTL-only). Wired here, not left unwired, because #3461's long
 * `ADMISSION_LEASE_MINUTES` makes the TTL floor alone too slow to recover a genuinely crashed holder.
 * @param {number|null} pid  the CURRENT holder's pid (from its lock entry), or null if unknown
 * @param {number} selfPid   the caller's own pid — never probes/accelerates against itself
 * @returns {'dead'|'alive'|'unknown'}
 */
export function probeSlotHolderLiveness(pid, selfPid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === selfPid) return 'unknown';
  try { process.kill(pid, 0); return 'alive'; }
  catch (e) { return e && e.code === 'ESRCH' ? 'dead' : 'unknown'; }
}

/**
 * Try each of `cap` slots in order; return the first one `owner` wins (free, already-own, or a stale/dead
 * holder reclaimed) via `file-locks.mjs#reserve`. Non-blocking — one attempt across all slots. Probes the
 * CURRENT holder's PID liveness itself (via {@link probeSlotHolderLiveness}) for any slot not already won by
 * OUR OWN process, so a provably-dead same-machine holder is reclaimed immediately regardless of
 * `leaseMinutes` — a caller-supplied `pidLiveness` is no longer accepted, so this fast path can never be
 * silently skipped by an omitted argument the way `verify-lane.mjs`'s call site originally did.
 *
 * SLOT REENTRANCY IS KEYED BY REAL PROCESS IDENTITY (pid), NOT BY THE OWNER STRING ALONE (#3383 fix). `owner`
 * here is a LANE PATH — shared by every process that verifies that lane — never a per-process token (unlike
 * `review-runner.mjs`'s `hostname:pid:kind` or `drain-lock.mjs`'s equivalent). Before this fix, `reserve`'s
 * "already mine" fast path matched on `owner` alone, so a SECOND, genuinely different process verifying the
 * SAME lane (e.g. a conveyor auto-verify and a manual re-verify racing the same lane back-to-back — the
 * exact live incident this fixes) was waved through as "already mine" with just a heartbeat refresh, never
 * consuming a real second slot — `status` under-counted real concurrent load by exactly this overlap. Passing
 * `requireOwnProcess: true` to `reserve` (below) makes the fast path additionally require the held entry's
 * pid to match OUR pid; a same-owner-string, different-pid holder now falls through to the ordinary
 * pid-liveness/lease-TTL logic — occupied (try the next slot) if that other process is alive, reclaimable if
 * it is provably dead or its lease has gone stale. The one case this must NOT break — the SAME process
 * re-acquiring its own already-held slot (a heartbeat refresh from itself) — still fast-paths, because its
 * own pid trivially matches the entry it already wrote.
 * @returns {{ ok:boolean, slot:number|null, cap:number, heldBy:Array<{slot:number,owner:string}> }}
 */
export function tryAcquireSlot({ lockRoot, cap, owner, nowMs, nowIso, pid = null, leaseMinutes = ADMISSION_LEASE_MINUTES, meta = null }) {
  const heldBy = [];
  const selfPid = Number.isInteger(pid) ? pid : process.pid;
  for (let i = 0; i < cap; i++) {
    const current = readLockEntry(lockRoot, slotPath(i));
    // Probe liveness whenever a DIFFERENT real process holds the slot — including a same-owner-string
    // holder (the #3383 case); `probeSlotHolderLiveness` itself no-ops to 'unknown' when `current.pid ===
    // selfPid` (our own slot), so it is always safe to call unconditionally here.
    const pidLiveness = current ? probeSlotHolderLiveness(current.pid, selfPid) : 'unknown';
    const r = reserve(lockRoot, slotPath(i), owner, nowMs, nowIso, pid, pidLiveness, leaseMinutes, meta, /* requireOwnProcess */ true);
    if (r.ok) return { ok: true, slot: i, cap, heldBy };
    heldBy.push({ slot: i, owner: r.heldBy });
  }
  return { ok: false, slot: null, cap, heldBy };
}

/**
 * Release whichever slot `owner` holds (idempotent — a no-op if it holds none). Scans rather than remembers
 * the slot index, so a caller that lost track of which slot it won (e.g. a fresh CLI invocation) can still
 * release cleanly.
 *
 * PID-DISAMBIGUATED BY DEFAULT (#3383 fix companion). Since two genuinely different real processes can now
 * legitimately hold two DIFFERENT slots under the SAME owner string (the lane path), a release must not just
 * match `owner` — it must release THIS caller's own slot, not a sibling process's. `pid` therefore defaults
 * to `process.pid`: an in-process caller releasing its own held slot (`runUnderAdmission`'s/`verify-lane.mjs`'s
 * `finally`) always resolves to itself, no code change needed at those call sites. Pass `pid: null` to opt
 * INTO the old, looser owner-only match — the deliberate escape hatch for the CLI's manual `release` mode,
 * where an operator's fresh invocation is by definition a different process than whichever one is stuck.
 * @param {number|null} [pid]  defaults to `process.pid`; pass `null` for an owner-only manual release.
 */
export function releaseOwnedSlot({ lockRoot, cap, owner, pid = process.pid }) {
  const selfPid = Number.isInteger(pid) ? pid : null;
  let ownerOnlyFallback = null;
  for (let i = 0; i < cap; i++) {
    const entry = readLockEntry(lockRoot, slotPath(i));
    if (!entry || entry.owner !== owner) continue;
    if (selfPid !== null && Number.isInteger(entry.pid) && entry.pid === selfPid) {
      releaseLockDir(lockRoot, slotPath(i));
      return { released: true, slot: i };
    }
    // An owner-matching slot we did not just confirm is ours by pid: keep it as a FALLBACK candidate only
    // when nothing about it actually contradicts us — either we have no pid of our own to check (the
    // deliberate `pid: null` manual/operator opt-in) or the entry itself never recorded a pid to compare
    // against (an untagged/legacy acquisition, or `tryAcquireSlot` called directly with no `pid`, as several
    // pre-#3383 tests still do). A slot that DOES carry a different real pid is provably a different real
    // process's slot and must never be picked here — that would just reintroduce this same bug in reverse.
    const safeFallback = selfPid === null || !Number.isInteger(entry.pid);
    if (safeFallback && ownerOnlyFallback === null) ownerOnlyFallback = i;
  }
  if (ownerOnlyFallback !== null) {
    releaseLockDir(lockRoot, slotPath(ownerOnlyFallback));
    return { released: true, slot: ownerOnlyFallback };
  }
  return { released: false, slot: null };
}

/** Read-only snapshot of every slot's holder, for `status` / observability. Includes `pid` (#3383 fix
 *  companion) so two slots legitimately held under the SAME owner string (two different real processes
 *  verifying the same lane) are distinguishable in `status` output, not just internally in the reentrancy
 *  decision. */
export function heldSlots({ lockRoot, cap }) {
  const held = [];
  for (let i = 0; i < cap; i++) {
    const entry = readLockEntry(lockRoot, slotPath(i));
    if (entry) held.push({ slot: i, owner: entry.owner, pid: entry.pid, heartbeatAt: entry.heartbeatAt, meta: entry.meta || null });
  }
  return held;
}

// ── waiting-intent markers — the OBSERVABLE queue (#3461 Done-when #2) ─────────────────────────────────
// A blocked caller writes ONE small marker before it starts polling and removes it the moment it wins a slot
// (or gives up). `tick-core.mjs` reads these (via `status`) and surfaces a `waiting-for-capacity` note per
// entry — never folded into #3451's after-the-fact call-visibility telemetry (a live pollable queue is a
// different signal from an access log), and it clears itself for free: nothing persists a "was waiting" fact
// past the marker's removal, so a freed slot silently un-surfaces the note on the very next tick.

function waitingDir(lockRoot) {
  return join(lockRoot, WAITING_SUBDIR);
}

function waitingFile(lockRoot, owner) {
  // Reuse file-locks.mjs's own stable id derivation so an owner string with path-unsafe characters (a lane's
  // absolute clone path) still yields a flat, filesystem-safe filename.
  return join(waitingDir(lockRoot), `${lockIdSafe(owner)}.json`);
}

// Local, tiny — pulling in `lockIdFor` from file-locks.mjs would work too, but that hashes to a 16-char id
// that erases which owner a marker belongs to when a human lists the directory by hand; this keeps the lane
// number legible (the owner strings this module receives are short: a lane path's basename or an explicit
// `--owner=`) while still stripping path separators.
function lockIdSafe(owner) {
  return String(owner).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'unknown';
}

/** Mark `owner` as waiting for a slot. Best-effort — a write failure never blocks the caller's retry loop. */
export function markWaiting({ lockRoot, owner, lane = null, num = null, nowIso }) {
  try {
    mkdirSync(waitingDir(lockRoot), { recursive: true });
    writeFileSync(waitingFile(lockRoot, owner), JSON.stringify({ owner: String(owner), lane, num, requestedAt: nowIso }, null, 2) + '\n', 'utf8');
  } catch { /* best-effort — the wait itself must never fail on a marker write */ }
}

/** Clear `owner`'s waiting marker (idempotent — a no-op if absent). */
export function clearWaiting({ lockRoot, owner }) {
  try { unlinkSync(waitingFile(lockRoot, owner)); } catch { /* already gone, or never written */ }
}

/** List every live waiting marker. Tolerant of a corrupt entry (skipped, never thrown). */
export function listWaiting(lockRoot) {
  let names;
  try { names = readdirSync(waitingDir(lockRoot)); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = readFileSync(join(waitingDir(lockRoot), name), 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.owner) out.push(parsed);
    } catch { /* corrupt marker — skip, never surface as a phantom waiter */ }
  }
  return out;
}

// ── the blocking wait primitive a heavy-command call site uses ─────────────────────────────────────────

/**
 * Poll for a free slot until one is won or `timeoutMs` elapses. FAILS OPEN on timeout — `{ ok:false,
 * timedOut:true }` — never throws and never blocks forever: a queuing timeout must not strand an otherwise
 * healthy lane's whole delivery arc behind a stuck semaphore. The caller (e.g. `verify-lane.mjs`) proceeds
 * unslotted and logs the fact; this is the same "reduces but does not eliminate contention" residual risk
 * the module header names.
 * @param {object} opts
 * @param {string} opts.lockRoot
 * @param {number} opts.cap
 * @param {string} opts.owner
 * @param {string|null} [opts.lane]
 * @param {number} [opts.pollMs]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.leaseMinutes]
 * @param {() => number} [opts.now]         defaults to Date.now
 * @param {(ms:number) => Promise<void>} [opts.sleep]  defaults to a real timer
 * @returns {Promise<{ ok:boolean, slot:number|null, timedOut:boolean, waitedMs:number }>}
 */
export async function acquireSlotBlocking({
  lockRoot, cap, owner, lane = null, num = null,
  pollMs = DEFAULT_POLL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, leaseMinutes = ADMISSION_LEASE_MINUTES,
  pid = process.pid, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const startedAt = now();
  const first = tryAcquireSlot({ lockRoot, cap, owner, nowMs: startedAt, nowIso: new Date(startedAt).toISOString(), pid, leaseMinutes });
  if (first.ok) return { ok: true, slot: first.slot, timedOut: false, waitedMs: 0 };

  markWaiting({ lockRoot, owner, lane, num, nowIso: new Date(startedAt).toISOString() });
  try {
    for (;;) {
      const nowMs = now();
      if (nowMs - startedAt >= timeoutMs) return { ok: false, slot: null, timedOut: true, waitedMs: nowMs - startedAt };
      await sleep(pollMs);
      const attempt = now();
      const r = tryAcquireSlot({ lockRoot, cap, owner, nowMs: attempt, nowIso: new Date(attempt).toISOString(), pid, leaseMinutes });
      if (r.ok) return { ok: true, slot: r.slot, timedOut: false, waitedMs: attempt - startedAt };
    }
  } finally {
    clearWaiting({ lockRoot, owner });
  }
}

// ── run-under-admission — the general-purpose wrapper (#3383 finding) ──────────────────────────────────

/**
 * Run `command` synchronously in the FOREGROUND, admitted through the SAME capacity semaphore
 * `verify-lane.mjs`'s own gate execution already uses (#3461) — never a parallel/second limiter. Mirrors
 * `verify-lane.mjs`'s own call site exactly: {@link acquireSlotBlocking} (fail-open on a queuing timeout) →
 * a synchronous, inherited-stdio execution → {@link releaseOwnedSlot} in a `finally` (only when a slot was
 * actually won). Exported so the CLI's `run` mode and any other IN-PROCESS caller (a future operation, a
 * workflow script) share ONE tested acquire/execute/release sequencing rather than each re-deriving it —
 * the same reuse discipline this module's own header applies to `file-locks.mjs`'s primitives.
 *
 * FAILS OPEN, LIKE `verify-lane.mjs`: a timed-out admission still runs `command` unslotted (with a stderr
 * warning) rather than refusing to run it at all — a queuing timeout must never strand an otherwise-healthy
 * caller behind a stuck semaphore, exactly the residual-risk tradeoff `acquireSlotBlocking`'s own doc names.
 *
 * @param {object} opts
 * @param {string} opts.lockRoot
 * @param {number} opts.cap
 * @param {string} opts.owner
 * @param {string|null} [opts.lane]
 * @param {string|null} [opts.num]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.leaseMinutes]
 * @param {string} opts.command            the shell command to run (passed to `exec`, so `&&`/`;` work)
 * @param {string} [opts.cwd]              defaults to process.cwd()
 * @param {(cmd:string, opts:object)=>void} [opts.exec]  defaults to `execSync` — injectable for tests
 * @param {(msg:string)=>void} [opts.log]  defaults to `process.stderr.write` — injectable for tests
 * @param {() => number} [opts.now]
 * @param {(ms:number) => Promise<void>} [opts.sleep]
 * @returns {Promise<{ exitCode:number, admission:object }>}
 */
export async function runUnderAdmission({
  lockRoot, cap, owner, lane = null, num = null, timeoutMs = DEFAULT_TIMEOUT_MS, leaseMinutes = ADMISSION_LEASE_MINUTES,
  command, cwd = process.cwd(), exec = (cmd, o) => execSync(cmd, o), log = (m) => process.stderr.write(m),
  now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  mkdirSync(lockRoot, { recursive: true });
  const admission = await acquireSlotBlocking({ lockRoot, cap, owner, lane, num, timeoutMs, leaseMinutes, now, sleep });
  if (admission.timedOut) {
    log(`⚠ heavy-command admission: timed out after ${admission.waitedMs}ms waiting for capacity (cap=${cap}) — proceeding unslotted.\n`);
  } else if (admission.waitedMs > 0) {
    log(`heavy-command admission: acquired slot-${admission.slot} after waiting ${admission.waitedMs}ms (cap=${cap}).\n`);
  }
  let exitCode = 0;
  try {
    exec(command, { cwd, stdio: 'inherit' });
  } catch (e) {
    exitCode = Number.isFinite(e && e.status) ? e.status : 1;
  } finally {
    if (admission.ok) releaseOwnedSlot({ lockRoot, cap, owner });
  }
  return { exitCode, admission };
}

// ── status — what `tick-core.mjs` reads for the `waiting-for-capacity` note ────────────────────────────

export function admissionStatus({ lockRoot, cap }) {
  const held = heldSlots({ lockRoot, cap });
  const waiting = listWaiting(lockRoot);
  return { cap, heldCount: held.length, freeCount: Math.max(0, cap - held.length), held, waiting };
}

// ── CLI (IO shell) ──────────────────────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true; else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  return { flags, positionals };
}

/** Re-quote a single already-split argv word for a shell command line — a no-op for a plain word, single-quoted
 *  (embedded `'` escaped the POSIX way) for anything containing whitespace or shell-meaningful characters. Lets
 *  `run`'s command tail (argv words `execSync`'s underlying `/bin/sh -c` must re-parse) round-trip an argument
 *  that itself contains a space, rather than silently gluing it to its neighbour. */
export function shellQuoteWord(w) {
  return /^[A-Za-z0-9_\-.\/:=@%,]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`;
}

async function main(argv) {
  // `run`'s command tail lives after a literal `--` and must never be parsed as this CLI's OWN flags (a
  // `--coverage` meant for vitest would otherwise be read as a flag of THIS script). Split there first; only
  // the pre-`--` slice feeds `parseFlags`. Every other mode has no `--` in its argv, so this is a no-op for them.
  const dashDashIdx = argv.indexOf('--');
  const preArgv = dashDashIdx === -1 ? argv : argv.slice(0, dashDashIdx);
  const { flags, positionals } = parseFlags(preArgv);
  const repo = typeof flags.repo === 'string' ? flags.repo : process.cwd();
  const cap = flags.cap != null ? Number(flags.cap) : resolveCap(process.env);
  const lockRoot = admissionLockRoot(repo, process.env);
  const owner = typeof flags.owner === 'string' ? flags.owner : repo;
  const lane = typeof flags.lane === 'string' ? flags.lane : null;
  const num = typeof flags.num === 'string' ? flags.num : null;
  const asJson = !!flags.json;
  const emit = (obj) => writeAllSync(1, JSON.stringify(obj) + '\n');
  const mode = positionals[0] || 'status';

  if (mode === 'run') {
    if (dashDashIdx === -1 || dashDashIdx === argv.length - 1) {
      process.stderr.write(`usage: heavy-admission.mjs run [--repo=] [--cap=] [--owner=] [--lane=] [--num=] [--timeout-ms=] -- <command…>\n`);
      process.exit(3);
    }
    const command = argv.slice(dashDashIdx + 1).map(shellQuoteWord).join(' ');
    const timeoutMs = flags['timeout-ms'] != null ? Number(flags['timeout-ms']) : resolveTimeoutMs(process.env);
    const { exitCode } = await runUnderAdmission({ lockRoot, cap, owner, lane, num, timeoutMs, command, cwd: repo });
    process.exit(exitCode);
  }

  if (mode === 'status') {
    if (!existsSync(lockRoot)) { emit({ cap, heldCount: 0, freeCount: cap, held: [], waiting: [] }); return; }
    emit(admissionStatus({ lockRoot, cap }));
    return;
  }
  if (mode === 'release') {
    // Manual/operator release: this CLI invocation is by definition a DIFFERENT process than whichever one
    // actually holds the slot, so `pid: null` deliberately opts into the owner-only match (#3383 companion).
    const r = releaseOwnedSlot({ lockRoot, cap, owner, pid: null });
    if (asJson) emit(r); else process.stderr.write(r.released ? `released slot-${r.slot} for ${owner}\n` : `${owner} held no slot\n`);
    return;
  }
  if (mode === 'acquire') {
    mkdirSync(lockRoot, { recursive: true });
    const timeoutMs = flags['timeout-ms'] != null ? Number(flags['timeout-ms']) : resolveTimeoutMs(process.env);
    const r = await acquireSlotBlocking({ lockRoot, cap, owner, lane, num, timeoutMs });
    if (asJson) emit(r);
    else process.stderr.write(r.ok ? `acquired slot-${r.slot} (waited ${r.waitedMs}ms)\n` : `timed out after ${r.waitedMs}ms waiting for capacity (cap=${cap}) — proceeding unslotted\n`);
    process.exit(0); // fail-open: a queuing timeout is not a usage error, the caller proceeds regardless
  }
  process.stderr.write(`usage: heavy-admission.mjs <status|acquire|release|run> [--repo=] [--cap=] [--owner=] [--lane=] [--num=] [--json] [--timeout-ms=] [-- <command…>]\n`);
  process.exit(3);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ heavy-admission error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}
