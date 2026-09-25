/**
 * @file scripts/conveyor/fix-dispatch-claim.mjs
 * @description #x0jphk5 (parent #4075, epic #3383) — THE REAL PER-(REPO, PR, HEAD-SHA) CLAIM the fix-dispatch
 *   path was missing. `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`'s own header used to claim this
 *   was already covered by `we:scripts/operations/action-store.mjs`'s durable atomic ledger — FALSE on `main`
 *   (see that file's corrected header): `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s own dispatch
 *   decision never imported `action-store.mjs` at all, and its ONLY double-dispatch guard was a session-NAME
 *   match against a `claude agents --json --all` listing measured (`we:scripts/operations/dispatch-lane-io.mjs`)
 *   to lag 26+ seconds behind the real spawn. Two dispatchers reading that stale listing within the lag window
 *   (the new daemon plus `we:skills-src/conveyor/runner.mjs`'s own mechanical pass, deliberately run side by
 *   side for a bake period; or a restarted daemon racing a still-live prior instance) could both decide
 *   "nothing live" and both dispatch the same `fix-<pr>` / `ci-heal-<pr>`.
 *
 * THE PRIMITIVE IS REUSED, NOT REINVENTED. This is exactly `we:scripts/readiness/file-locks.mjs`'s own
 * O_EXCL-mkdir / heartbeat-TTL-lease / dead-holder-reclaim design (#1936) — that file's own header already
 * argues the correctness case (atomic across separate invocations with no daemon; TTL as the reclaim floor).
 * This module is a THIN naming/keying layer over it: the "path" `file-locks.mjs` locks is, here, a synthetic
 * resource key `fix-dispatch:<repo>:<pr>:<headSha>`, never a real file on disk — `file-locks.mjs` never
 * assumes its `path` argument is openable, only that it is a stable string to key a lock dir off.
 *
 * ROOT: THE SHARED COORDINATION SIDECAR, NOT A CHECKOUT-LOCAL DIR. `file-locks.mjs`'s own default root
 * (`.claude/locks` under a checkout) is deliberately checkout-local — it exists to serialize EDITS to files in
 * ONE central checkout. This claim instead has to be seen by every dispatcher regardless of which checkout it
 * runs from (the daemon's own clone, a lane, a CI runner), so it is pinned under
 * `we:scripts/operations/coordination-root.mjs`'s own `resolveCoordinationRoot()` — the SAME operator-owned,
 * `WE_COORDINATION_ROOT`-overridable sidecar `action-store.mjs` itself uses ("all checkouts coordinate through
 * one operator-owned sidecar, never checkout-local state" — that file's own header).
 *
 * WHY PID-LIVENESS FAST-RECLAIM IS DELIBERATELY NEVER USED HERE (the one place this module intentionally
 * departs from a typical `file-locks.mjs` caller). `reclaimDecision`'s PID fast path exists for a lock held BY
 * the process that would still be doing the work if it were alive — here it is the opposite: the DISPATCHER
 * process that wins this claim exits normally, on purpose, moments after a successful spawn
 * (`reconcile-fix-dispatch.mjs` and `ci-heal-pr-dispatch.mjs` are both documented ONE-SHOT passes). Its pid
 * going away is completion, not a crash — treating that as evidence the claim is reclaimable would defeat the
 * whole point of holding the claim past the synchronous spawn call (the 26+s LISTING LAG is exactly the gap
 * this module exists to close). So `pidLiveness` is always passed as `'unknown'` here: only the TTL governs an
 * unreleased claim's reclaim, and only an explicit {@link releaseFixDispatchClaim} call (a refused/failed
 * attempt that spawned nothing, or — see the note below — a completion/reap signal) frees one early.
 *
 * RELEASE-ON-REAP IS NOT WIRED YET. `we:scripts/conveyor/session-reaper.mjs` is the natural caller once a
 * dispatched fix/ci-heal/resume session is confirmed gone, but that file is owned by another worker on this
 * epic and is out of this item's scope (#x0jphk5). {@link releaseFixDispatchClaim} is exported precisely so
 * that hook can be added there later with no change needed here — until it is, the TTL alone is what recovers
 * an abandoned claim.
 */
import { hostname } from 'node:os';
import { join } from 'node:path';
import { resolveCoordinationRoot } from '../operations/coordination-root.mjs';
import { reserve, readLockEntry, releaseLockDir } from '../readiness/file-locks.mjs';

/** How long an unreleased claim survives before a DIFFERENT owner may reclaim it (dead-holder floor). Chosen
 *  well above the measured 26+s `claude agents --json --all` listing lag ({@link ../operations/dispatch-lane-io.mjs})
 *  this claim exists to bridge, with a wide margin so a real dispatch's own retry/confirm loop never outlives
 *  it, while still short enough that an abandoned claim (the release-on-reap hook not yet wired, above) self-
 *  heals without anyone touching a lock file by hand. */
export const DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES = 10;

/** The pinned, cross-checkout root every dispatcher's claim lives under — see this file's own header for why
 *  it is NOT `file-locks.mjs`'s own checkout-local default. `WE_COORDINATION_ROOT`-overridable via
 *  `resolveCoordinationRoot`, exactly like every other cross-process conveyor coordination path. */
export function fixDispatchClaimRoot(root = resolveCoordinationRoot()) {
  return join(root, 'fix-dispatch-claims');
}

/** This PROCESS's own claim identity — `hostname:pid`, mirroring `file-locks.mjs`'s own documented convention
 *  ("owner already uniquely names one process for its whole lifetime… embeds the pid"). Two different real
 *  dispatcher processes — even on the same host — never collide on this string, so a genuine second dispatcher
 *  is never mistaken for a reentrant "already mine" re-acquire. */
export function fixDispatchClaimOwner({ host = hostname(), pid = process.pid } = {}) {
  return `${host}:${pid}`;
}

/** The resource key this claim locks on: `(repo, PR, head sha)`, so a NEW push to the same PR (a new head sha)
 *  is free to claim its own slot rather than being blocked by a stale claim for a commit that's no longer
 *  current. A missing/unknown head sha (an item-less or not-yet-resolved entry) still gets a real, if slightly
 *  coarser, `(repo, PR)` claim — degrading to less precision is safer than skipping the claim outright.
 * @param {{repo:string, pr:number, headSha?:string|null}} o
 */
export function fixDispatchResource({ repo, pr, headSha }) {
  if (!repo || typeof repo !== 'string') throw new TypeError('fixDispatchResource requires a repo string');
  if (!Number.isInteger(pr) || pr <= 0) throw new TypeError('fixDispatchResource requires an integer pr');
  const sha = typeof headSha === 'string' && headSha ? headSha : 'unknown';
  return `fix-dispatch:${repo}:${pr}:${sha}`;
}

/**
 * Take the claim for one `(repo, pr, headSha)`. Atomic (`O_EXCL` mkdir, via {@link reserve}) across separate
 * processes with no daemon of its own; a stale (TTL-expired) claim is reclaimed automatically — see this
 * file's own header for why that TTL, not PID liveness, is the ONLY reclaim floor here.
 * @param {{repo:string, pr:number, headSha?:string|null, owner?:string, sessionId?:string|null, pid?:number,
 *   host?:string, nowMs?:number, nowIso?:string, leaseMinutes?:number, lockRoot?:string}} o
 * @returns {{ok:boolean, reason:string, heldBy:string|null, resource:string, lockRoot:string}}
 */
export function acquireFixDispatchClaim({
  repo, pr, headSha = null, owner = fixDispatchClaimOwner(), sessionId = null,
  pid = process.pid, host = hostname(), nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(),
  leaseMinutes = DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES, lockRoot = fixDispatchClaimRoot(),
} = {}) {
  if (!owner) throw new TypeError('acquireFixDispatchClaim requires an owner');
  const resource = fixDispatchResource({ repo, pr, headSha });
  const meta = { host, sessionId, repo, pr, headSha: headSha ?? null };
  // `pidLiveness` is ALWAYS 'unknown' — see this file's own header for why a fast PID-dead reclaim would be
  // actively wrong here (the acquiring dispatcher's own exit is expected completion, not a crash).
  const result = reserve(lockRoot, resource, owner, nowMs, nowIso, pid, 'unknown', leaseMinutes, meta);
  return { ...result, resource, lockRoot };
}

/**
 * Release a claim this `owner` holds. A no-op (never throws, never touches a lock it does not own) when the
 * claim is already gone or owned by someone else — the caller learns why via `reason`, but nothing is torn
 * down out from under a legitimate different holder (e.g. one that reclaimed it after our own TTL lapsed).
 * @param {{repo:string, pr:number, headSha?:string|null, owner:string, lockRoot?:string}} o
 * @returns {{released:boolean, reason?:string, heldBy?:string|null}}
 */
export function releaseFixDispatchClaim({ repo, pr, headSha = null, owner, lockRoot = fixDispatchClaimRoot() }) {
  if (!owner) throw new TypeError('releaseFixDispatchClaim requires an owner');
  const resource = fixDispatchResource({ repo, pr, headSha });
  const current = readLockEntry(lockRoot, resource);
  if (!current) return { released: false, reason: 'absent' };
  if (current.owner !== owner) return { released: false, reason: 'not-owner', heldBy: current.owner };
  releaseLockDir(lockRoot, resource);
  return { released: true };
}

/**
 * Read-only introspection of one `(repo, pr, headSha)` claim's current entry, or `null` if free — the primitive
 * a dry-run/status read (never a mutation) uses to report "claimed by X" without acquiring or releasing
 * anything itself.
 * @param {{repo:string, pr:number, headSha?:string|null, lockRoot?:string}} o
 */
export function readFixDispatchClaim({ repo, pr, headSha = null, lockRoot = fixDispatchClaimRoot() }) {
  const resource = fixDispatchResource({ repo, pr, headSha });
  return readLockEntry(lockRoot, resource);
}
