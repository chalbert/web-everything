/**
 * @file scripts/conveyor/build-dispatch-claim.mjs
 * @description #3984 slice 1 — the build-dispatch daemon's DURABLE per-item claim. The build twin of
 *   we:scripts/conveyor/fix-dispatch-claim.mjs (merged in PR #2789): the same atomic O_EXCL-mkdir +
 *   TTL-lease primitive (we:scripts/readiness/file-locks.mjs#reserve), under the same operator-owned
 *   coordination root, keyed `build-dispatch:<repo>:<num>`.
 *
 * WHY A DURABLE CLAIM. The tick core's build guard lives in the daemon's memory (`nextState.buildGuards`), so a
 * restart forgets every build it launched. After a restart the new process (different pid ⇒ different owner)
 * finds the old claim still held and cannot re-dispatch that item until the claim is retired or its TTL
 * lapses. The claim also carries the item's SCOPE in `meta`, so the hot-file rule ("no two in-flight builds on
 * the same file") still sees the old build's files after the restart.
 *
 * RETIREMENT. A claim is released when its build no longer needs holding: an open PR delivers the item, the
 * item left the cleared queue, or the dispatch itself failed. Otherwise the TTL
 * ({@link DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES}) is the dead-holder floor. PID liveness is never used —
 * the daemon restarting is expected, and the build it started is still running.
 *
 * #4349 — THE HOLD, a SEPARATE lease from the claim above, same primitive. A no-op dispatch (`not-ready`,
 * `gate-red`, `gate-blocked`, `blocked-mid-build`, `blocked-on-infra`, or a caught `wrapper-threw`) settles its
 * run and releases its claim promptly once the wrapper actually says so (see
 * `we:scripts/operations/deliver-item-settle.mjs`) — which, alone, would let the VERY NEXT daemon tick (~2
 * minutes) re-dispatch the identical item into the identical failure, tighter than the ACCIDENTAL ~90-120
 * minute delay the un-settled claim used to cause. The hold is what actually stops that loop: placed by the
 * wrapper on ANY non-PR terminal outcome, keyed the same way a claim is (`build-dispatch-holds/<repo>:<num>`, a
 * distinct root + `kind:'hold'` so it never collides with a real claim), and read by the daemon's own tick to
 * exclude a held item from its dispatch candidates until the hold's own TTL lapses. Self-clearing by design
 * (the lease already knows how to expire) — `releaseBuildDispatchHold` is an exported-but-uncalled primitive
 * for a future operator escape hatch (clear a confirmed-fixed hold sooner), not wired to any CLI today.
 */

import { hostname } from 'node:os';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { resolveCoordinationRoot } from '../operations/coordination-root.mjs';
import {
  reserve, readLockEntry, releaseLockDir, parseLockEntry, isLeaseExpired,
} from '../readiness/file-locks.mjs';
import { normNum } from './queue-store.mjs';

/** A build takes up to a few hours; the TTL only matters when retirement never fires (a lost build). */
export const DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES = 240;

export function buildDispatchClaimRoot(root = resolveCoordinationRoot()) {
  return join(root, 'build-dispatch-claims');
}

export function buildDispatchClaimOwner({ host = hostname(), pid = process.pid } = {}) {
  return `${host}:${pid}`;
}

export function buildDispatchResource({ repo = 'we', num }) {
  const key = normNum(num);
  if (!key) throw new TypeError('buildDispatchResource requires an item num');
  return `build-dispatch:${repo}:${key}`;
}

/** Take the claim for one item. `{ok:false, reason:'held', heldBy}` when another owner still holds it. */
export function acquireBuildDispatchClaim({
  repo = 'we', num, scope = [], owner = buildDispatchClaimOwner(), pid = process.pid,
  nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(),
  leaseMinutes = DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES, lockRoot = buildDispatchClaimRoot(),
} = {}) {
  const resource = buildDispatchResource({ repo, num });
  const meta = { repo, num: normNum(num), kind: 'build', scope: Array.isArray(scope) ? scope.map(String) : [], claimedAt: nowIso };
  const result = reserve(lockRoot, resource, owner, nowMs, nowIso, pid, 'unknown', leaseMinutes, meta);
  return { ...result, resource, lockRoot };
}

/** Release a claim — ANY owner may retire it once the build it guards is observably done (PR open, item gone).
 *
 * KNOWN GAP, deliberately not closed here — this deletes by `{repo, num}` alone, with no check that the
 * CALLER's own attempt is the one that acquired the live claim on disk. A stale wrapper that outlived its own
 * `expectedBy` (see `deliver-item-run.mjs`'s own header) can therefore release a NEWER attempt's live claim,
 * letting the daemon dispatch a duplicate build. Closing it needs a per-attempt token minted at ACQUIRE time
 * and threaded through four files (`build-dispatch-daemon.mjs`'s tick → the `dispatch-lane` CLI boundary → the
 * detached wrapper's `launch` payload → back to this call) — none of which exists today. Left as a stated gap:
 * the failure mode is a duplicated build, not data loss, and needs an overlapping-attempt race to trigger at
 * all — `runBuildDispatchTick`'s own claimedAt/settled-row comparison (`build-dispatch-daemon.mjs#doneWhy`)
 * narrows the window further but does not close it either, for the same reason. */
export function releaseBuildDispatchClaim({ repo = 'we', num, lockRoot = buildDispatchClaimRoot() } = {}) {
  const resource = buildDispatchResource({ repo, num });
  if (!readLockEntry(lockRoot, resource)) return { released: false, reason: 'absent' };
  releaseLockDir(lockRoot, resource);
  return { released: true };
}

/** Every LIVE (unexpired) build claim, with its meta. Expired or meta-less entries are skipped. */
export function listBuildDispatchClaims({
  lockRoot = buildDispatchClaimRoot(), nowMs = Date.now(), leaseMinutes = DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES,
} = {}) {
  let dirNames;
  try { dirNames = readdirSync(lockRoot); } catch { return []; }
  const out = [];
  for (const dirName of dirNames) {
    let raw = '';
    try { raw = readFileSync(join(lockRoot, dirName, 'lock.json'), 'utf8'); } catch { continue; }
    const entry = parseLockEntry(raw);
    if (!entry?.meta?.num || entry.meta.kind !== 'build') continue;
    if (isLeaseExpired(entry, nowMs, leaseMinutes)) continue;
    out.push(entry);
  }
  return out;
}

// ================================================================================================
// #4349 — THE HOLD. Same lock primitive as the claim above, a separate root and `kind` so the two never
// collide (`listBuildDispatchClaims`'s own `meta.kind !== 'build'` filter already skips a hold entry; the
// converse guard is `listBuildDispatchHolds`'s own `kind !== 'hold'` check below). See this file's own header
// for why a hold exists at all.
// ================================================================================================

/** Long enough that a genuinely-fixed `not-ready` reason (a `blockedBy` re-resolved, a re-prepared spec) does
 *  not have to wait through a full workday, short enough that a hold is a real, human-noticeable pause rather
 *  than a rounding error — the same order of magnitude as {@link DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES},
 *  and, like every other lease in this file, self-expiring rather than requiring an explicit clear. */
export const DEFAULT_BUILD_DISPATCH_HOLD_MINUTES = 240;

export function buildDispatchHoldRoot(root = resolveCoordinationRoot()) {
  return join(root, 'build-dispatch-holds');
}

/** Place (or refresh) a hold for one item. Unlike the claim, a hold has no "held by someone else" refusal —
 *  it is a cooldown on RE-DISPATCH, not a mutex on concurrent work, so the wrapper that just finished a
 *  `not-ready` run always succeeds in placing its own hold. */
export function placeBuildDispatchHold({
  repo = 'we', num, reason = null, owner = buildDispatchClaimOwner(), pid = process.pid,
  nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(),
  holdMinutes = DEFAULT_BUILD_DISPATCH_HOLD_MINUTES, lockRoot = buildDispatchHoldRoot(),
} = {}) {
  const resource = buildDispatchResource({ repo, num });
  const meta = { repo, num: normNum(num), kind: 'hold', reason: reason == null ? null : String(reason), heldAt: nowIso };
  // A hold that already exists for this item (a second `not-ready` before the first one lapsed) is simply
  // refreshed to the new reason/TTL — `releaseLockDir` first makes `reserve` unconditional, matching a
  // cooldown's "restart the clock" semantics rather than a mutex's "refuse a second holder".
  try { releaseLockDir(lockRoot, resource); } catch { /* absent — nothing to clear */ }
  const result = reserve(lockRoot, resource, owner, nowMs, nowIso, pid, 'unknown', holdMinutes, meta);
  return { ...result, resource, lockRoot };
}

/** Release a hold early — for a future operator escape hatch once the underlying reason (`not-ready`,
 *  `gate-red`, …) is confirmed actually fixed; NOT wired to any CLI today, so this is exported but uncalled.
 *  The hold otherwise clears itself once its TTL lapses (see {@link DEFAULT_BUILD_DISPATCH_HOLD_MINUTES}). */
export function releaseBuildDispatchHold({ repo = 'we', num, lockRoot = buildDispatchHoldRoot() } = {}) {
  const resource = buildDispatchResource({ repo, num });
  if (!readLockEntry(lockRoot, resource)) return { released: false, reason: 'absent' };
  releaseLockDir(lockRoot, resource);
  return { released: true };
}

/** Every LIVE (unexpired) hold, with its reason. Expired or meta-less entries are skipped — same shape as
 *  {@link listBuildDispatchClaims}, so a caller can treat both the same way. */
export function listBuildDispatchHolds({
  lockRoot = buildDispatchHoldRoot(), nowMs = Date.now(), holdMinutes = DEFAULT_BUILD_DISPATCH_HOLD_MINUTES,
} = {}) {
  let dirNames;
  try { dirNames = readdirSync(lockRoot); } catch { return []; }
  const out = [];
  for (const dirName of dirNames) {
    let raw = '';
    try { raw = readFileSync(join(lockRoot, dirName, 'lock.json'), 'utf8'); } catch { continue; }
    const entry = parseLockEntry(raw);
    if (!entry?.meta?.num || entry.meta.kind !== 'hold') continue;
    if (isLeaseExpired(entry, nowMs, holdMinutes)) continue;
    out.push(entry);
  }
  return out;
}

// ================================================================================================
// build-orphan-adopt (#4131/#4382 fix) — THE RESUME MARKER. A third lease, same primitive, same posture as
// the hold above: a claim whose recorded dispatch died (its `pid:` handle no longer answers — see
// scripts/conveyor/build-dispatch-orphan-adopt.mjs) may be ADOPTED by spawning one fresh, detached
// `deliver-item-run.mjs --resume` process that skips the agent turn and goes straight to gate/converge/PR.
// This marker exists so a LATER tick can tell "a resume for this item is already under way, owned by pid P"
// from "nothing has ever tried" — without it, every tick that still finds the ORIGINAL claim's dead-pid
// dispatch row would spawn ANOTHER resume attempt, racing two wrappers over the same lane. Keyed the same way
// a claim is (`build-dispatch:<repo>:<num>`), under its own root + `kind:'resume'` so it never collides with
// either the claim or the hold.
// ================================================================================================

/** A resume attempt is the SAME order of magnitude as a fresh build (gate + converge + PR, never the agent
 *  turn) — long enough that a resume genuinely still running is never mistaken for an abandoned one, short
 *  enough that a marker whose owner really did die does not block a re-adoption for hours. */
export const DEFAULT_BUILD_DISPATCH_RESUME_TTL_MINUTES = 120;

export function buildDispatchResumeRoot(root = resolveCoordinationRoot()) {
  return join(root, 'build-dispatch-resumes');
}

/** Record a fresh resume attempt for one item, owned by the resume process's own pid — the kernel-probeable
 *  handle {@link listBuildDispatchResumes} (and a later tick's own orphan-adopt read) checks liveness against,
 *  exactly the way a claim's `pid:` dispatch handle already is. Unconditional, like `placeBuildDispatchHold` —
 *  a resume marker that already exists for this item (an earlier resume that itself died) is simply refreshed. */
export function markBuildDispatchResume({
  repo = 'we', num, pid, owner = buildDispatchClaimOwner({ pid }),
  nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(),
  ttlMinutes = DEFAULT_BUILD_DISPATCH_RESUME_TTL_MINUTES, lockRoot = buildDispatchResumeRoot(),
} = {}) {
  const resource = buildDispatchResource({ repo, num });
  const meta = { repo, num: normNum(num), kind: 'resume', pid, resumedAt: nowIso };
  try { releaseLockDir(lockRoot, resource); } catch { /* absent — nothing to clear */ }
  const result = reserve(lockRoot, resource, owner, nowMs, nowIso, pid, 'unknown', ttlMinutes, meta);
  return { ...result, resource, lockRoot };
}

/** The live resume marker for one item, or `null` — used to decide whether a dead-pid claim already has a
 *  resume attempt under way before starting a second one. */
export function readBuildDispatchResume({
  repo = 'we', num, lockRoot = buildDispatchResumeRoot(), nowMs = Date.now(),
  ttlMinutes = DEFAULT_BUILD_DISPATCH_RESUME_TTL_MINUTES,
} = {}) {
  const resource = buildDispatchResource({ repo, num });
  const entry = readLockEntry(lockRoot, resource);
  if (!entry || isLeaseExpired(entry, nowMs, ttlMinutes)) return null;
  return entry;
}

/** Release a resume marker — the orphan-adopt pass clears it once the resumed attempt itself settles (a PR
 *  opens, or it fails and the ordinary claim retirement/hold path takes over), so a later dead pid does not
 *  read as "still resuming" forever. */
export function releaseBuildDispatchResume({ repo = 'we', num, lockRoot = buildDispatchResumeRoot() } = {}) {
  const resource = buildDispatchResource({ repo, num });
  if (!readLockEntry(lockRoot, resource)) return { released: false, reason: 'absent' };
  releaseLockDir(lockRoot, resource);
  return { released: true };
}
