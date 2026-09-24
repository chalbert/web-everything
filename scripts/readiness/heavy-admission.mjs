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
 *
 * A GENERAL-PURPOSE `run` CLI MODE — `node scripts/readiness/heavy-admission.mjs run [--container] -- <cmd…>`
 * wraps `acquire → run <cmd> → release` in one call ({@link runUnderAdmission}), so any caller can opt into
 * this SAME semaphore without hand-rolling the acquire/execute/release sequence itself.
 *
 * THE CAP WAS, UNTIL NOW, PURELY COOPERATIVE — a counting semaphore with NO resource boundary behind it: it
 * throttles how many heavy commands run at once, never how many CPU cores or how much memory any one of them
 * gets, so a single admitted command already misbehaving (the #3594 busy-spin incident that opened
 * `we:backlog/3621-real-os-level-resource-isolation-per-dispatched-lane-is-appl.md`) is fully unconstrained
 * once it starts. `run`'s `--container` flag (or `WE_HEAVY_ADMISSION_CONTAINER=1`) is the #3621 sequencing
 * note's heavy-command-pool container POC (tracked as a progress note on `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md`,
 * not a separate formal item — see that item's own log for why): it swaps the command's execution from a bare
 * host `execSync` to `we:scripts/lib/container-exec.mjs#execContainerized`, running it inside a real Apple
 * `container` instance with an enforced `--cpus`/`--memory` ceiling instead. OPT-IN ONLY — every existing
 * caller, and `run` without the flag, is byte-identical to before this flag existed. See `container-exec.mjs`'s
 * own header for exactly what is proven to work this way — `check:standards` (mount-straight-in) and, as of
 * the `test:unit` slice, ALSO `test:unit` via the separate `--container-node-modules` opt-in below (Playwright
 * remains unproven).
 *
 * `--container-node-modules` (or `WE_HEAVY_ADMISSION_CONTAINER_NODE_MODULES=1`) is the `test:unit` slice's own
 * opt-in, layered ON TOP of `--container` (meaningless without it) — it additionally shadows the container's
 * `node_modules` with the LINUX-built tree `container-exec/build-test-unit-deps.mjs` seeds into a named volume
 * (`container-exec.mjs#DEFAULT_NODE_MODULES_VOLUME`), because `test:unit`'s own closure (vitest→esbuild/rollup)
 * carries native `darwin-arm64` bindings the plain `check:standards`-shaped mount cannot resolve. See
 * `container-exec.mjs`'s module header ("test:unit slice") for the full mechanism and measured evidence.
 *
 * EVERY HEAVY COMMAND GOES THROUGH THIS POOL (xaipsbs, 2026-09-21). Until then only `verify-lane.mjs` was
 * admitted; `npm run test:unit` / `check:standards` typed directly, and the scripts that shell them, ran
 * outside it. Now `package.json`'s `test:unit`, `test:coverage`, `check:standards` and the vitest step of
 * `verify` are `heavy-admission.mjs run -- <cmd>`, and the scripts that spawn vitest or check-standards
 * themselves route through {@link admittedArgv} / {@link admittedShellCommand}. Three rules keep the wrapper
 * safe to put everywhere:
 *   • it is a PASS-THROUGH under `CI=true`, `WE_HEAVY_ADMISSION=off`, or when the lane-pool root does not
 *     exist ({@link admissionBypassReason});
 *   • it is RE-ENTRANT: whatever it runs gets `WE_HEAVY_ADMISSION_HELD=1`, and a nested wrapper that sees it
 *     never asks for a second slot ({@link ADMISSION_HELD_ENV}); `verify-lane.mjs` sets it around its gate;
 *   • each `run` is its own owner (`<repo>#<pid>`), so two commands from one checkout take two slots.
 * Stale `waiting` markers (owner gone, older than {@link WAITING_TTL_MINUTES}) are reaped by the next
 * admission attempt; `reap` previews them and `reap --apply` removes them.
 *
 * A WAITER NEVER RUNS UNSLOTTED WHILE A HOLDER IS ALIVE (xhlriy2, #3383). Observed 2026-09-23: with test runs
 * taking 25-40 minutes under load and several lanes waiting, `DEFAULT_TIMEOUT_MS`'s old 20-minute elapsed-time
 * give-up let waiters fail open and run TOGETHER — the cap stopped holding exactly when it mattered most.
 * {@link acquireSlotBlocking} no longer gives up purely on elapsed time: it keeps polling — logging a periodic
 * "still waiting" line every {@link STILL_WAITING_LOG_MS} — for as long as {@link tryAcquireSlot} keeps losing,
 * which (via the PID-liveness + lease-TTL reclaim above) can only happen while every held slot's holder is
 * still alive with an unexpired lease; the moment every holder is provably dead or lease-expired, the very next
 * `tryAcquireSlot` attempt reclaims a real slot rather than the caller running unslotted. The one remaining
 * escape from an indefinite wait is {@link DEFAULT_ADMISSION_CEILING_MS} (default 120 minutes, comfortably past
 * any realistic gate run, overridable via `WE_HEAVY_ADMISSION_CEILING_MS`) — a hard ceiling so a genuinely
 * wedged holder cannot strand a lane forever; crossing it still fails OPEN (runs unslotted) but with a LOUD
 * warning naming the ceiling. `DEFAULT_TIMEOUT_MS`/`resolveTimeoutMs` are UNCHANGED and still read by
 * `verify-lane.mjs`/the CLI's legacy `--timeout-ms` fallback, but no longer decide when `acquireSlotBlocking`
 * gives up — see their own doc comments. `WE_HEAVY_ADMISSION=off` ({@link isAdmissionOff}) — the SAME switch
 * {@link admissionBypassReason} already reads for the `run` wrapper — is now ALSO checked directly at the top
 * of {@link acquireSlotBlocking} itself, before it ever touches the lock root, so any direct caller of the
 * blocking primitive (not just `run`) gets the escape hatch too.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { hostname } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LEASE_FILENAME, isLeaseStale } from '../lib/lane-lease.mjs';
import { reserve, releaseLockDir, readLockEntry } from './file-locks.mjs';
import { defaultPoolRoot } from '../lib/lane-pool-paths.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import { execContainerized, containerCliAvailable, containerImageAvailable, resolveContainerImage, resolveNodeModulesVolume, nodeModulesVolumeAvailable } from '../lib/container-exec.mjs'; // #3621 sequencing note (tracked on #3383) — the heavy-command-pool container POC; see that module's own header for proven scope (check:standards + test:unit)

/** Conservative default — below measured host capacity, not near-full-utilization (#3456 explicit ruling).
 *  Overridable per machine via `WE_HEAVY_ADMISSION_CAP`. */
export const DEFAULT_ADMISSION_CAP = 2;

/** How often a blocking waiter re-polls for a free slot. */
export const DEFAULT_POLL_MS = 2000;

/** HISTORICAL — no longer the point at which a blocking waiter gives up (xhlriy2, #3383: that was the exact
 *  bug — a waiter fails open and runs UNSLOTTED after this elapses even while a slot holder is still alive,
 *  which under real load let waiters time out and run together, breaking the cap). Still read via
 *  {@link resolveTimeoutMs} (the CLI's legacy `--timeout-ms` fallback), but {@link acquireSlotBlocking} itself
 *  now gives up only at {@link DEFAULT_ADMISSION_CEILING_MS}. Overridable via `WE_HEAVY_ADMISSION_TIMEOUT_MS`
 *  (mirroring {@link resolveCap}). */
export const DEFAULT_TIMEOUT_MS = 20 * 60_000;

/** THE HARD CEILING (xhlriy2, #3383) — far above a normal run, so a wedged holder cannot strand a lane forever.
 *  A waiter now keeps polling (logging a periodic "still waiting" line, see {@link STILL_WAITING_LOG_MS}) for as
 *  long as a slot holder is provably alive with an unexpired lease; it gives up and proceeds unslotted only once
 *  this ceiling elapses, with a loud warning. Overridable via `WE_HEAVY_ADMISSION_CEILING_MS`
 *  ({@link resolveCeilingMs}). */
export const DEFAULT_ADMISSION_CEILING_MS = 120 * 60_000;

/** How often, while blocked, {@link acquireSlotBlocking} logs a "still waiting" line (xhlriy2) — observability
 *  for an operator/tick watching a long queue, distinct from the much-longer give-up ceiling above. */
export const STILL_WAITING_LOG_MS = 5 * 60_000;

/** The lease a HELD SLOT gets — deliberately longer than `file-locks.mjs`'s general-purpose
 *  `DEFAULT_LEASE_MINUTES` (15). A slot is held across one synchronous, event-loop-blocking `execSync` with no
 *  chance to heartbeat mid-hold (see the module header), so the lease itself must outlast any realistic gate
 *  run rather than relying on a refresh that cannot happen. A genuinely dead holder is still reclaimed promptly
 *  via the PID-liveness fast path in {@link tryAcquireSlot}, not by waiting out this TTL. */
export const ADMISSION_LEASE_MINUTES = 60;

/** How old a `waiting` marker must be before the reap may remove it (xaipsbs). A live waiter clears its own
 *  marker in `acquireSlotBlocking`'s `finally`, and the default wait gives up after 20 minutes, so a marker
 *  past 30 minutes whose owner is also provably gone is debris from a killed process, never a real waiter.
 *  Age alone is never enough: the owner must be gone too (see {@link classifyWaiter}). */
export const WAITING_TTL_MINUTES = 30;

/** RE-ENTRANCY (xaipsbs). Set to `1` in the environment of every command this module runs while it holds a
 *  slot (the `run` wrapper, and `verify-lane.mjs` around its gate). A nested wrapper that sees it is a plain
 *  pass-through: `verify-lane` → `npm run test:unit` → `heavy-admission.mjs run -- vitest run` must not ask
 *  for a SECOND slot for the same work, and with cap 1 it would wait on itself until the timeout. It is also
 *  set when the outer run proceeded unslotted after a timeout, so the inner run does not queue a second time. */
export const ADMISSION_HELD_ENV = 'WE_HEAVY_ADMISSION_HELD';

/** The off switch: `WE_HEAVY_ADMISSION=off` (or `0`/`false`) makes the wrapper a pass-through. */
export const ADMISSION_SWITCH_ENV = 'WE_HEAVY_ADMISSION';

/** Absolute path of this CLI, for callers that route a synchronous child command through `run`. */
export const HEAVY_ADMISSION_CLI = fileURLToPath(import.meta.url);

const SUBDIR = join('.admission', 'heavy');
const WAITING_SUBDIR = 'waiting';
const REAP_LOG = 'reaped.jsonl';

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

/** Resolve the hard give-up ceiling from env (xhlriy2), mirroring {@link resolveTimeoutMs}. Clamped to a sane
 *  minimum of 1000ms. */
export function resolveCeilingMs(env = process.env) {
  const n = Number(env.WE_HEAVY_ADMISSION_CEILING_MS);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : DEFAULT_ADMISSION_CEILING_MS;
}

/** True when the explicit escape hatch is set (xhlriy2) — `WE_HEAVY_ADMISSION=off` (or `0`/`false`/`no`,
 *  case-insensitive). The SAME check {@link admissionBypassReason} already applies for the `run` wrapper's
 *  'off' bypass reason — factored out here so {@link acquireSlotBlocking} can apply it directly too, and so
 *  there is exactly one regex for this switch rather than two that could drift apart. */
export function isAdmissionOff(env = process.env) {
  return /^(?:off|0|false|no)$/i.test(String(env[ADMISSION_SWITCH_ENV] || ''));
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
 * CURRENT holder's PID liveness itself (via {@link probeSlotHolderLiveness}) for a slot it does not already
 * own, so a provably-dead same-machine holder is reclaimed immediately regardless of `leaseMinutes` — a
 * caller-supplied `pidLiveness` is no longer accepted, so this fast path can never be silently skipped by an
 * omitted argument the way `verify-lane.mjs`'s call site originally did.
 * @returns {{ ok:boolean, slot:number|null, cap:number, heldBy:Array<{slot:number,owner:string}> }}
 */
export function tryAcquireSlot({ lockRoot, cap, owner, nowMs, nowIso, pid = null, leaseMinutes = ADMISSION_LEASE_MINUTES, meta = null }) {
  const heldBy = [];
  const selfPid = Number.isInteger(pid) ? pid : process.pid;
  for (let i = 0; i < cap; i++) {
    const current = readLockEntry(lockRoot, slotPath(i));
    const pidLiveness = current && current.owner !== owner ? probeSlotHolderLiveness(current.pid, selfPid) : 'unknown';
    const r = reserve(lockRoot, slotPath(i), owner, nowMs, nowIso, selfPid, pidLiveness, leaseMinutes, meta);
    if (r.ok) return { ok: true, slot: i, cap, heldBy };
    heldBy.push({ slot: i, owner: r.heldBy });
  }
  return { ok: false, slot: null, cap, heldBy };
}

/** Release whichever slot `owner` holds (idempotent — a no-op if it holds none). Scans rather than remembers
 *  the slot index, so a caller that lost track of which slot it won (e.g. a fresh CLI invocation) can still
 *  release cleanly. */
export function releaseOwnedSlot({ lockRoot, cap, owner }) {
  for (let i = 0; i < cap; i++) {
    const entry = readLockEntry(lockRoot, slotPath(i));
    if (entry && entry.owner === owner) { releaseLockDir(lockRoot, slotPath(i)); return { released: true, slot: i }; }
  }
  return { released: false, slot: null };
}

/** Read-only snapshot of every slot's holder, for `status` / observability. */
export function heldSlots({ lockRoot, cap }) {
  const held = [];
  for (let i = 0; i < cap; i++) {
    const entry = readLockEntry(lockRoot, slotPath(i));
    if (entry) held.push({ slot: i, owner: entry.owner, heartbeatAt: entry.heartbeatAt, meta: entry.meta || null });
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
export function markWaiting({ lockRoot, owner, lane = null, num = null, nowIso, pid = null, repo = null }) {
  try {
    mkdirSync(waitingDir(lockRoot), { recursive: true });
    // `pid` + `host` + `repo` (xaipsbs) are what the stale-waiter reap reads to prove the owner is gone.
    // Markers written before they existed carry none of them; the reap falls back to the lane lease for those.
    const body = { owner: String(owner), lane, num, requestedAt: nowIso, pid: Number.isInteger(pid) ? pid : null, host: hostname(), repo };
    writeFileSync(waitingFile(lockRoot, owner), JSON.stringify(body, null, 2) + '\n', 'utf8');
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

// ── stale-waiter reap (xaipsbs) ─────────────────────────────────────────────────────────────────────────
// A waiter killed hard (SIGKILL, a closed terminal, a crashed host) never reaches the `finally` that clears
// its marker, so the marker sits in `waiting/` forever and `tick-core.mjs` keeps reporting a phantom
// `waiting-for-capacity` note. Four such markers (2026-09-04 and 2026-09-14) were found in the live pool on
// 2026-09-21. The next admission attempt removes them; `status` counts them; `reap` previews and `--apply`s.

/** Every marker file with its parsed body. Corrupt files are returned with `marker: null`. */
function listWaitingFiles(lockRoot) {
  let names;
  try { names = readdirSync(waitingDir(lockRoot)); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const file = join(waitingDir(lockRoot), name);
    let marker = null;
    try { marker = JSON.parse(readFileSync(file, 'utf8')); } catch { /* corrupt — reported as such */ }
    out.push({ file, marker });
  }
  return out;
}

/** The checkout a marker belongs to: its `repo` field, else its owner with any `#<pid>` suffix removed. */
export function waiterRepo(marker) {
  if (marker && typeof marker.repo === 'string' && marker.repo) return marker.repo;
  return String((marker && marker.owner) || '').replace(/#\d+$/, '');
}

/** Read a lane clone's lease marker, or null when there is none (or it is unreadable). */
export function readLaneLease(repo) {
  try { return JSON.parse(readFileSync(join(repo, '.git', LEASE_FILENAME), 'utf8')); } catch { return null; }
}

/**
 * Should this waiting marker be reaped? Pure over its seams. Reap needs BOTH: older than `ttlMs`, AND the
 * owner provably gone. "Gone" is read from the best evidence the marker has, in this order:
 *   1. a `pid` recorded on THIS host: dead → gone; alive → kept (it may be a long custom wait).
 *   2. the owner is a lane clone (`…/lane-N`): no live lease → gone; a live lease acquired AFTER the marker
 *      was written → gone (the lane has been handed to someone else since, so this waiter is not its holder);
 *      a live lease older than the marker → kept.
 *   3. no pid and not a lane (an old primary-checkout marker) → kept: nothing proves the owner is gone.
 * @returns {{ reap:boolean, reason:string }}
 */
export function classifyWaiter(marker, { nowMs, ttlMs = WAITING_TTL_MINUTES * 60_000, host = hostname(), pidLiveness = (pid) => probeSlotHolderLiveness(pid, process.pid), readLease = readLaneLease } = {}) {
  if (!marker || typeof marker !== 'object') return { reap: true, reason: 'corrupt' };
  const at = Date.parse(marker.requestedAt);
  const ageMs = Number.isNaN(at) ? Infinity : nowMs - at;
  if (ageMs < ttlMs) return { reap: false, reason: 'fresh' };
  if (Number.isInteger(marker.pid) && (!marker.host || marker.host === host)) {
    const live = pidLiveness(marker.pid);
    if (live === 'dead') return { reap: true, reason: 'pid-dead' };
    if (live === 'alive') return { reap: false, reason: 'pid-alive' };
  }
  const repo = waiterRepo(marker);
  if (/^lane-\d+$/.test(basename(repo))) {
    const lease = readLease(repo);
    if (!lease || isLeaseStale(lease, nowMs)) return { reap: true, reason: 'no-lease' };
    const leasedAt = Date.parse(lease.acquiredAt);
    if (!Number.isNaN(at) && !Number.isNaN(leasedAt) && leasedAt > at) return { reap: true, reason: 'lease-newer' };
    return { reap: false, reason: 'lease-live' };
  }
  return { reap: false, reason: 'owner-unknown' };
}

/**
 * Find (and with `apply`, remove) every stale waiting marker. Each removal is appended to `reaped.jsonl`
 * beside the slots so `status` can report how many were reaped. Never throws.
 * @returns {{ reaped:Array<object>, kept:Array<object> }}
 */
export function reapStaleWaiters({ lockRoot, nowMs = Date.now(), ttlMs = WAITING_TTL_MINUTES * 60_000, apply = false, ...seams }) {
  const reaped = [];
  const kept = [];
  for (const { file, marker } of listWaitingFiles(lockRoot)) {
    const verdict = classifyWaiter(marker, { nowMs, ttlMs, ...seams });
    const row = { owner: marker && marker.owner, lane: marker && marker.lane, requestedAt: marker && marker.requestedAt, reason: verdict.reason };
    if (!verdict.reap) { kept.push(row); continue; }
    if (apply) {
      try { unlinkSync(file); } catch { continue; /* raced with its own clear, or unwritable — not reaped */ }
      try { appendFileSync(join(lockRoot, REAP_LOG), JSON.stringify({ ...row, reapedAt: new Date(nowMs).toISOString() }) + '\n', 'utf8'); } catch { /* best-effort */ }
    }
    reaped.push(row);
  }
  return { reaped, kept };
}

/** How many markers the reap has removed so far, and the most recent one. */
export function reapHistory(lockRoot) {
  let lines = [];
  try { lines = readFileSync(join(lockRoot, REAP_LOG), 'utf8').split('\n').filter(Boolean); } catch { /* none yet */ }
  let last = null;
  try { last = lines.length ? JSON.parse(lines[lines.length - 1]) : null; } catch { /* corrupt tail */ }
  return { count: lines.length, last };
}

// ── the blocking wait primitive a heavy-command call site uses ─────────────────────────────────────────

/**
 * Poll for a free slot until one is won or the hard `ceilingMs` elapses (xhlriy2, #3383). A waiter never runs
 * unslotted merely because time has passed while a slot holder is alive: each failed {@link tryAcquireSlot}
 * attempt already reclaims a slot the instant every holder is provably dead or lease-expired (via the PID
 * fast-path + lease-TTL floor above), so as long as this loop keeps losing, at least one holder is still alive
 * with an unexpired lease. While blocked it logs a periodic "still waiting" line every {@link
 * STILL_WAITING_LOG_MS} — plain observability, not a give-up signal. Only `ceilingMs` (default {@link
 * DEFAULT_ADMISSION_CEILING_MS}) FAILS OPEN — `{ ok:false, timedOut:true, ceilingHit:true }`, with a loud
 * warning — never throwing and never blocking truly forever: a wedged holder must not strand a lane's whole
 * delivery arc. `WE_HEAVY_ADMISSION=off` ({@link isAdmissionOff}) is the explicit escape hatch — checked FIRST,
 * before this function ever touches the lock root, so it is a pure pass-through (`{ ok:false, disabled:true }`).
 * @param {object} opts
 * @param {string} opts.lockRoot
 * @param {number} opts.cap
 * @param {string} opts.owner
 * @param {string|null} [opts.lane]
 * @param {number} [opts.pollMs]
 * @param {number} [opts.ceilingMs]        hard give-up ceiling; defaults to {@link DEFAULT_ADMISSION_CEILING_MS}
 * @param {number} [opts.stillWaitingLogMs]  periodic log cadence; defaults to {@link STILL_WAITING_LOG_MS}
 * @param {number} [opts.leaseMinutes]
 * @param {(msg:string)=>void} [opts.log]  defaults to `process.stderr.write` — injectable for tests
 * @param {object} [opts.env]              defaults to `process.env` — injectable for tests
 * @param {() => number} [opts.now]         defaults to Date.now
 * @param {(ms:number) => Promise<void>} [opts.sleep]  defaults to a real timer
 * @returns {Promise<{ ok:boolean, slot:number|null, timedOut:boolean, waitedMs:number, disabled?:boolean, ceilingHit?:boolean }>}
 */
export async function acquireSlotBlocking({
  lockRoot, cap, owner, lane = null, num = null, repo = null,
  pollMs = DEFAULT_POLL_MS, ceilingMs = DEFAULT_ADMISSION_CEILING_MS, leaseMinutes = ADMISSION_LEASE_MINUTES,
  stillWaitingLogMs = STILL_WAITING_LOG_MS,
  pid = process.pid, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = (m) => process.stderr.write(m), env = process.env,
}) {
  if (isAdmissionOff(env)) return { ok: false, slot: null, timedOut: false, disabled: true, waitedMs: 0 };

  const startedAt = now();
  // xaipsbs — every admission attempt first clears stale waiters, so debris never outlives the next caller.
  reapStaleWaiters({ lockRoot, nowMs: startedAt, apply: true });
  const first = tryAcquireSlot({ lockRoot, cap, owner, nowMs: startedAt, nowIso: new Date(startedAt).toISOString(), pid, leaseMinutes });
  if (first.ok) return { ok: true, slot: first.slot, timedOut: false, waitedMs: 0 };

  markWaiting({ lockRoot, owner, lane, num, pid, repo, nowIso: new Date(startedAt).toISOString() });
  let lastLoggedAt = startedAt;
  try {
    for (;;) {
      const nowMs = now();
      if (nowMs - startedAt >= ceilingMs) {
        log(`⚠⚠ heavy-command admission: HARD CEILING of ${Math.round(ceilingMs / 60_000)}m exceeded waiting for capacity (cap=${cap}) — a slot holder may be wedged; proceeding unslotted. Escape hatch: WE_HEAVY_ADMISSION=off.\n`);
        return { ok: false, slot: null, timedOut: true, ceilingHit: true, waitedMs: nowMs - startedAt };
      }
      await sleep(pollMs);
      const attempt = now();
      const r = tryAcquireSlot({ lockRoot, cap, owner, nowMs: attempt, nowIso: new Date(attempt).toISOString(), pid, leaseMinutes });
      if (r.ok) return { ok: true, slot: r.slot, timedOut: false, waitedMs: attempt - startedAt };
      if (attempt - lastLoggedAt >= stillWaitingLogMs) {
        log(`heavy-command admission: still waiting for a free slot (cap=${cap}) after ${Math.round((attempt - startedAt) / 60_000)}m — every held slot's holder still appears alive; will proceed unslotted at the ${Math.round(ceilingMs / 60_000)}m ceiling.\n`);
        lastLoggedAt = attempt;
      }
    }
  } finally {
    clearWaiting({ lockRoot, owner });
  }
}

// ── status — what `tick-core.mjs` reads for the `waiting-for-capacity` note ────────────────────────────

export function admissionStatus({ lockRoot, cap, nowMs = Date.now(), ...reapSeams }) {
  const held = heldSlots({ lockRoot, cap });
  const waiting = listWaiting(lockRoot);
  // xaipsbs — `reaped` is what the reap has removed so far; `staleWaiting` is what it WOULD remove right now.
  const staleWaiting = reapStaleWaiters({ lockRoot, nowMs, apply: false, ...reapSeams }).reaped.length;
  return { cap, heldCount: held.length, freeCount: Math.max(0, cap - held.length), held, waiting, staleWaiting, reaped: reapHistory(lockRoot) };
}

/**
 * Why the wrapper should NOT queue this command, or null to queue it (xaipsbs). Pure over `env` + `poolExists`.
 *   • `held` — an outer wrapper (or `verify-lane.mjs`) already holds a slot for this work;
 *   • `ci`   — `CI=true`/`1`: a CI runner is its own machine and has no host pool;
 *   • `off`  — `WE_HEAVY_ADMISSION=off|0|false`, the explicit switch;
 *   • `no-pool` — the lane-pool root does not exist (a fresh clone, a VM with no pool), so there is nothing
 *     to share and nothing to create.
 */
export function admissionBypassReason({ env = process.env, poolExists = true } = {}) {
  if (env[ADMISSION_HELD_ENV] === '1') return 'held';
  if (/^(?:true|1)$/i.test(String(env.CI || ''))) return 'ci';
  if (isAdmissionOff(env)) return 'off'; // xhlriy2 — same switch/regex acquireSlotBlocking now checks directly
  if (!poolExists) return 'no-pool';
  return null;
}

/** The pool root a lock root lives under (`<pool>/.admission/heavy` → `<pool>`). */
export function poolRootOf(lockRoot) {
  return dirname(dirname(lockRoot));
}

// ── run-under-admission — general-purpose wrapper, WITH the #3621 container hook built in ─────────────────
//
// This is the minimal general-purpose "acquire a slot → run a command → release" wrapper this module did not
// yet have on `main` as of this POC (a fuller version exists on the separate, still-unmerged
// `lane/mechanical-dispatcher` integration branch — #3383's own finding — landing here independently rather
// than waiting on that branch, since main needed a real entry point for THIS item's container work today; the
// two will need reconciling, likely a straightforward union, whenever that branch merges).
//
// The `exec` seam is exactly what makes the #3621 heavy-command-pool container POC possible: by default it
// runs `command` on the HOST (`execSync`, unchanged behaviour), but a caller can inject
// `scripts/lib/container-exec.mjs#execContainerized` instead — same acquire/execute/release sequencing, the
// command now runs inside a real, CPU/memory-capped Apple `container` instance. See that module's own header
// for exactly what is (and is not yet) proven to work this way.

/**
 * Run `command` synchronously in the FOREGROUND, admitted through the SAME capacity semaphore this module's
 * `acquire`/`release` CLI modes already use. FAILS OPEN on a queuing timeout (mirrors `acquireSlotBlocking`
 * itself): `command` still runs, unslotted, with a stderr warning, rather than being refused — a queuing
 * timeout must never strand an otherwise-healthy caller.
 * @param {object} opts
 * @param {string} opts.lockRoot
 * @param {number} opts.cap
 * @param {string} opts.owner
 * @param {string|null} [opts.lane]
 * @param {string|null} [opts.num]
 * @param {number} [opts.ceilingMs]        hard give-up ceiling passed to {@link acquireSlotBlocking} (xhlriy2)
 * @param {number} [opts.leaseMinutes]
 * @param {string} opts.command            the shell command to run (already shell-quoted by the CLI)
 * @param {string} [opts.cwd]              defaults to process.cwd()
 * @param {(cmd:string, opts:object)=>void} [opts.exec]  defaults to `execSync` — injectable; #3621's
 *   container POC passes `container-exec.mjs#execContainerized` here instead
 * @param {(msg:string)=>void} [opts.log]  defaults to `process.stderr.write` — injectable for tests
 * @param {object} [opts.env]              defaults to `process.env` — injectable for tests
 * @param {() => number} [opts.now]
 * @param {(ms:number) => Promise<void>} [opts.sleep]
 * @returns {Promise<{ exitCode:number, admission:object }>}
 */
export async function runUnderAdmission({
  lockRoot, cap, owner, lane = null, num = null, repo = null, ceilingMs = DEFAULT_ADMISSION_CEILING_MS, leaseMinutes = ADMISSION_LEASE_MINUTES,
  command, cwd = process.cwd(), exec = (cmd, o) => execSync(cmd, o), log = (m) => process.stderr.write(m),
  now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  bypass = null, env = process.env,
}) {
  // The child always runs with the re-entrancy flag, so anything it runs that is itself wrapped passes through.
  const childEnv = { ...env, [ADMISSION_HELD_ENV]: '1' };
  if (bypass) {
    let exitCode = 0;
    try { exec(command, { cwd, stdio: 'inherit', env: bypass === 'held' ? env : childEnv }); }
    catch (e) { exitCode = Number.isFinite(e && e.status) ? e.status : 1; }
    return { exitCode, admission: { ok: false, slot: null, timedOut: false, waitedMs: 0, bypassed: bypass } };
  }
  mkdirSync(lockRoot, { recursive: true });
  // xhlriy2: `log`/`env` threaded through so acquireSlotBlocking's still-waiting/ceiling warnings and its own
  // `WE_HEAVY_ADMISSION=off` check apply to the `run` wrapper's wait too, not just this function's own messages.
  const admission = await acquireSlotBlocking({ lockRoot, cap, owner, lane, num, repo, ceilingMs, leaseMinutes, now, sleep, log, env });
  if (admission.timedOut) {
    log(`⚠ heavy-command admission: timed out after ${admission.waitedMs}ms waiting for capacity (cap=${cap}) — proceeding unslotted.\n`);
  } else if (admission.waitedMs > 0) {
    log(`heavy-command admission: acquired slot-${admission.slot} after waiting ${admission.waitedMs}ms (cap=${cap}).\n`);
  }
  let exitCode = 0;
  try {
    exec(command, { cwd, stdio: 'inherit', env: childEnv });
  } catch (e) {
    exitCode = Number.isFinite(e && e.status) ? e.status : 1;
  } finally {
    if (admission.ok) releaseOwnedSlot({ lockRoot, cap, owner });
  }
  return { exitCode, admission };
}

/**
 * The argv that runs `file args…` through the `run` wrapper, for SYNCHRONOUS callers (`execFileSync` /
 * `spawnSync`) that cannot await {@link runUnderAdmission} (xaipsbs). The wrapper is a child process whose
 * stdio, exit code and output are the wrapped command's own, so a caller that captures output or reads
 * `e.status` keeps working unchanged. Pass it as `execFileSync(r.file, r.args, opts)`.
 * @returns {{ file:string, args:string[] }}
 */
export function admittedArgv(file, args = []) {
  return { file: process.execPath, args: [HEAVY_ADMISSION_CLI, 'run', '--', file, ...args] };
}

/** The shell command line that runs a shell command string through the `run` wrapper (as `sh -c <cmd>`, so
 *  `&&`/`||` in it keep their meaning and the whole chain holds ONE slot). For `execSync(string)` callers. */
export function admittedShellCommand(command) {
  return [process.execPath, HEAVY_ADMISSION_CLI, 'run', '--', 'sh', '-c', command].map(shellQuoteWord).join(' ');
}

/** Re-quote a single already-split argv word for a shell command line — a no-op for a plain word,
 *  single-quoted (embedded `'` escaped the POSIX way) otherwise, so `run`'s command tail round-trips through
 *  `execSync`'s underlying `/bin/sh -c` re-parse without gluing words containing spaces to their neighbour. */
export function shellQuoteWord(w) {
  return /^[A-Za-z0-9_\-.\/:=@%,]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`;
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

async function main(argv) {
  // `run`'s command tail lives after a literal `--` and must never be parsed as this CLI's OWN flags (a
  // `--coverage` meant for the wrapped command would otherwise be read as a flag of THIS script).
  const dashDashIdx = argv.indexOf('--');
  const preArgv = dashDashIdx === -1 ? argv : argv.slice(0, dashDashIdx);
  const { flags, positionals } = parseFlags(preArgv);
  // Resolve before lock-root derivation so relative --repo uses the same shared pool and execution cwd.
  const repo = resolve(typeof flags.repo === 'string' ? flags.repo : process.cwd());
  const cap = flags.cap != null ? Number(flags.cap) : resolveCap(process.env);
  const lockRoot = admissionLockRoot(repo, process.env);
  // `run` gets a PER-PROCESS owner (xaipsbs): two wrapped commands typed in the same checkout must be two
  // owners, or the second would "re-acquire" the first one's slot (own-slot refresh) and break the cap —
  // and the first to finish would release the slot the other is still using.
  const owner = typeof flags.owner === 'string' ? flags.owner : (positionals[0] === 'run' ? `${repo}#${process.pid}` : repo);
  const lane = typeof flags.lane === 'string' ? flags.lane : null;
  const num = typeof flags.num === 'string' ? flags.num : null;
  const asJson = !!flags.json;
  const emit = (obj) => writeAllSync(1, JSON.stringify(obj) + '\n');
  const mode = positionals[0] || 'status';

  if (mode === 'status') {
    if (!existsSync(lockRoot)) { emit({ cap, heldCount: 0, freeCount: cap, held: [], waiting: [], staleWaiting: 0, reaped: { count: 0, last: null } }); return; }
    emit(admissionStatus({ lockRoot, cap }));
    return;
  }
  if (mode === 'reap') {
    // Preview by default; `--apply` removes. `--ttl-minutes=` overrides WAITING_TTL_MINUTES.
    const ttlMin = flags['ttl-minutes'] != null ? Number(flags['ttl-minutes']) : WAITING_TTL_MINUTES;
    const r = reapStaleWaiters({ lockRoot, ttlMs: ttlMin * 60_000, apply: !!flags.apply });
    if (asJson) { emit({ applied: !!flags.apply, ...r }); return; }
    const verb = flags.apply ? 'reaped' : 'would reap';
    for (const w of r.reaped) process.stdout.write(`${verb}: ${w.owner} (waiting since ${w.requestedAt}; ${w.reason})\n`);
    for (const w of r.kept) process.stdout.write(`kept:  ${w.owner} (${w.reason})\n`);
    process.stdout.write(`${r.reaped.length} ${verb}, ${r.kept.length} kept${flags.apply ? '' : ' — pass --apply to remove'}\n`);
    return;
  }
  if (mode === 'release') {
    const r = releaseOwnedSlot({ lockRoot, cap, owner });
    if (asJson) emit(r); else process.stderr.write(r.released ? `released slot-${r.slot} for ${owner}\n` : `${owner} held no slot\n`);
    return;
  }
  if (mode === 'acquire') {
    mkdirSync(lockRoot, { recursive: true });
    // xhlriy2: the hard give-up ceiling. `--ceiling-ms`/`WE_HEAVY_ADMISSION_CEILING_MS` is the current knob;
    // the old `--timeout-ms` still works too (legacy fallback), it just now feeds the same ceiling rather than
    // the vestigial 20-minute give-up.
    const ceilingMs = flags['ceiling-ms'] != null ? Number(flags['ceiling-ms'])
      : flags['timeout-ms'] != null ? Number(flags['timeout-ms'])
      : resolveCeilingMs(process.env);
    const r = await acquireSlotBlocking({ lockRoot, cap, owner, lane, num, ceilingMs });
    if (asJson) emit(r);
    else process.stderr.write(r.ok ? `acquired slot-${r.slot} (waited ${r.waitedMs}ms)\n` : `timed out after ${r.waitedMs}ms waiting for capacity (cap=${cap}) — proceeding unslotted\n`);
    process.exit(0); // fail-open: a queuing timeout is not a usage error, the caller proceeds regardless
  }
  if (mode === 'run') {
    if (dashDashIdx === -1 || dashDashIdx === argv.length - 1) {
      process.stderr.write(`usage: heavy-admission.mjs run [--repo=] [--cap=] [--owner=] [--lane=] [--num=] [--ceiling-ms=] [--container] [--container-node-modules] -- <command…>\n`);
      process.exit(3);
    }
    const command = argv.slice(dashDashIdx + 1).map(shellQuoteWord).join(' ');
    // xhlriy2: the hard give-up ceiling (default 120 minutes); `--timeout-ms` is kept as a legacy fallback.
    const ceilingMs = flags['ceiling-ms'] != null ? Number(flags['ceiling-ms'])
      : flags['timeout-ms'] != null ? Number(flags['timeout-ms'])
      : resolveCeilingMs(process.env);
    // #3621 sequencing note (tracked on #3383) — the heavy-command-pool container POC. Opt-in ONLY: a caller
    // must explicitly ask for real OS-level isolation via `--container` or `WE_HEAVY_ADMISSION_CONTAINER=1`;
    // every existing caller (and the bare default here) still runs on the host, byte-identical to before this
    // flag existed. See scripts/lib/container-exec.mjs's own header for exactly what is proven to work this
    // way (check:standards, and — with `--container-node-modules` below — test:unit).
    const useContainer = !!flags.container || process.env.WE_HEAVY_ADMISSION_CONTAINER === '1';
    // The `test:unit` slice's own opt-in — layered ON TOP of `--container` (meaningless without it, checked
    // below). See this file's own header and container-exec.mjs's "test:unit slice" section for why a plain
    // `--container` mount alone is not enough for test:unit (native darwin bindings in vitest's own closure).
    const useNodeModulesVolume = !!flags['container-node-modules'] || process.env.WE_HEAVY_ADMISSION_CONTAINER_NODE_MODULES === '1';
    if (useContainer) {
      // Fail with a clear, actionable message rather than a raw ENOENT/"image not found" surfaced from deep
      // inside execFileSync — a caller that opted into real isolation should get a real reason it isn't
      // available, not a cryptic subprocess error.
      if (!containerCliAvailable()) {
        process.stderr.write(`✗ --container requested but the \`container\` CLI is not available on this host (Apple-Silicon-only tool — #3621's own permanent-portability finding). Install it or omit --container.\n`);
        process.exit(1);
      }
      const image = resolveContainerImage(process.env);
      if (!containerImageAvailable(image)) {
        process.stderr.write(`✗ --container requested but image "${image}" is not built. Build it: container build -f scripts/lib/container-exec/Containerfile -t ${image} .\n`);
        process.exit(1);
      }
      if (useNodeModulesVolume) {
        const volume = resolveNodeModulesVolume(process.env);
        if (!nodeModulesVolumeAvailable(volume)) {
          process.stderr.write(`✗ --container-node-modules requested but volume "${volume}" does not exist yet. Build/seed it: node scripts/lib/container-exec/build-test-unit-deps.mjs\n`);
          process.exit(1);
        }
      }
    } else if (useNodeModulesVolume) {
      process.stderr.write(`✗ --container-node-modules requires --container (it shadows a mount --container itself creates).\n`);
      process.exit(1);
    }
    const bypass = admissionBypassReason({ env: process.env, poolExists: existsSync(poolRootOf(lockRoot)) });
    const runOpts = { lockRoot, cap, owner, lane: lane ?? (/lane-(\d+)/.exec(repo) || [])[1] ?? null, num, repo, ceilingMs, command, cwd: repo, bypass };
    if (useContainer) runOpts.exec = (cmd, o) => execContainerized(cmd, { ...o, nodeModulesVolume: useNodeModulesVolume });
    const { exitCode } = await runUnderAdmission(runOpts);
    process.exit(exitCode);
  }
  process.stderr.write(`usage: heavy-admission.mjs <status|acquire|release|run|reap> [--apply] [--ttl-minutes=] [--repo=] [--cap=] [--owner=] [--lane=] [--num=] [--json] [--ceiling-ms=] [-- <command…>]\n`);
  process.exit(3);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ heavy-admission error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}
