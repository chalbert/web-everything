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

/** Release a claim — ANY owner may retire it once the build it guards is observably done (PR open, item gone). */
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
