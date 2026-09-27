/**
 * @file scripts/conveyor/fix-dispatch-claim.mjs
 * @description #x0jphk5 (parent #4075, epic #3383) — THE REAL PER-(REPO, KIND, PR) CLAIM the fix-dispatch
 *   path was missing (see the CORRECTED section below, dup-heal-dispatch: the key was originally `(repo, pr,
 *   headSha)` — a real live incident proved that wrong, and this is the fixed shape). `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`'s own header used to claim this
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
 * resource key `fix-dispatch:<repo>:<kind>:<pr>`, never a real file on disk — `file-locks.mjs` never
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
 *
 * CORRECTED (dup-heal-dispatch, 2026-09-27 LIVE INCIDENT): the resource key used to be `(repo, pr, headSha)` —
 * a NEW push to the SAME pr was, deliberately, a free/independent slot (see the old version of {@link
 * fixDispatchResource}'s own docblock: "a new head sha is free to claim its own slot rather than being blocked
 * by a stale claim for a commit that's no longer current"). That reasoning is right for a commit pushed by
 * SOMEONE ELSE after the original work is done, and WRONG for the commit the SAME still-working dispatched
 * session pushes as part of doing its own job — which is exactly what a `ci-heal`/`fix` agent does (it commits
 * a repair, `git push`es, CI reruns). LIVE-CAUGHT 22:16 ET: three concurrent `ci-heal-2784` sessions and three
 * `ci-heal-2783` (replay of the real recovered claim files under `~/workspace/.operations/coordination/
 * fix-dispatch-claims/` shows 3-4 DISTINCT claims per PR, each on a DIFFERENT `headSha`, each held by a
 * DIFFERENT daemon pid across a few restarts within the same hour) — every one of those pushes rotated the
 * claim's own resource key out from under the still-live session that made the push, reopening the exact
 * listing-lag window this claim exists to close, every time.
 *
 * THE FIX: the resource key drops `headSha` — it is now `(repo, kind, pr)` (`headSha` stays recorded in
 * `meta` for diagnostics only, never part of the identity). `kind` (`'fix'` | `'ci-heal'`, mirroring
 * `we:scripts/conveyor/reconcile-core.mjs#bindAgents`'s own name-based PATH 2 population) is ALSO new — the
 * pre-incident key carried no kind at all, so a `fix` claim and a `ci-heal` claim for the same PR would have
 * silently shared one slot; today's two real dispatch call sites (`we:scripts/conveyor/
 * reconcile-fix-dispatch.mjs#dispatchFix`/`#tryResumeFix` pass `'fix'`, `we:scripts/operations/
 * ci-heal-pr-dispatch.mjs#dispatchCiHeal` passes `'ci-heal'`) now say so explicitly.
 *
 * TTL TIED TO SESSION LIVENESS, PLUS THE SPAWN-LISTING-LAG GRACE THE PLAIN TTL ALREADY GAVE. Dropping `headSha`
 * from the key makes the claim outlive an in-flight session's own commits, but a session that runs LONGER than
 * `DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES` would still see its own claim go stale and get reclaimed out from
 * under it. {@link refreshLiveFixDispatchClaims} is the fix: called once per daemon tick (see
 * `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`'s own IO shell), it reads every held claim, checks
 * — via the SAME name-based liveness `bindAgents`'s own PATH 2 already trusts ({@link isClaimSessionLive}) —
 * whether a live, non-terminal session still carries that `(repo, kind, pr)`'s own session name, and
 * heartbeat-refreshes ONLY those. A claim whose session has actually finished (or was never confirmed live —
 * covering the spawn-listing lag right after a fresh dispatch, which the un-refreshed TTL already comfortably
 * outlasts, per this file's own `DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES` comment) is left to expire on the
 * plain TTL exactly as before — dead-holder recovery is unchanged.
 */
import { hostname } from 'node:os';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { resolveCoordinationRoot } from '../operations/coordination-root.mjs';
import {
  reserve, readLockEntry, releaseLockDir, parseLockEntry, heartbeat,
} from '../readiness/file-locks.mjs';
import { mintSessionSlug } from './session-slug.mjs';
import { defaultListAgents } from '../operations/dispatch-lane-io.mjs';

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

/** The resource key this claim locks on: `(repo, kind, PR)` — NOT `headSha` (dropped by the dup-heal-dispatch
 *  fix, see this file's own header for the live incident that proved keying on `headSha` wrong: it let a
 *  still-live session's OWN push rotate its claim out from under itself). `kind` (`'fix'`/`'ci-heal'`) keeps a
 *  fix claim and a ci-heal claim for the same PR from sharing one slot — the two are independent dispatch
 *  kinds with independent session names (`we:scripts/conveyor/reconcile-core.mjs#bindAgents`'s own PATH 2).
 *  `headSha`, when given, is carried in {@link acquireFixDispatchClaim}'s `meta` only — never part of the
 *  identity — purely for diagnostics (which commit was in flight when this claim was taken).
 * @param {{repo:string, pr:number, kind?:string}} o
 */
export function fixDispatchResource({ repo, pr, kind = 'fix' }) {
  if (!repo || typeof repo !== 'string') throw new TypeError('fixDispatchResource requires a repo string');
  if (!Number.isInteger(pr) || pr <= 0) throw new TypeError('fixDispatchResource requires an integer pr');
  if (!kind || typeof kind !== 'string') throw new TypeError('fixDispatchResource requires a kind string');
  return `fix-dispatch:${repo}:${kind}:${pr}`;
}

/**
 * Take the claim for one `(repo, kind, pr)`. Atomic (`O_EXCL` mkdir, via {@link reserve}) across separate
 * processes with no daemon of its own; a stale (TTL-expired) claim is reclaimed automatically — see this
 * file's own header for why that TTL, not PID liveness, is the ONLY reclaim floor here (and for
 * {@link refreshLiveFixDispatchClaims}, which is what keeps a genuinely still-working session's claim from
 * ever reaching that TTL in the first place).
 * @param {{repo:string, pr:number, kind?:string, headSha?:string|null, owner?:string, sessionId?:string|null,
 *   pid?:number, host?:string, nowMs?:number, nowIso?:string, leaseMinutes?:number, lockRoot?:string}} o
 * @returns {{ok:boolean, reason:string, heldBy:string|null, resource:string, lockRoot:string}}
 */
export function acquireFixDispatchClaim({
  repo, pr, kind = 'fix', headSha = null, owner = fixDispatchClaimOwner(), sessionId = null,
  pid = process.pid, host = hostname(), nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(),
  leaseMinutes = DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES, lockRoot = fixDispatchClaimRoot(),
} = {}) {
  if (!owner) throw new TypeError('acquireFixDispatchClaim requires an owner');
  const resource = fixDispatchResource({ repo, pr, kind });
  // `headSha` rides in `meta` only (diagnostics — which commit was in flight) — never part of the resource
  // identity above (see this file's own header for the live incident that made keying on it wrong).
  const meta = {
    host, sessionId, repo, pr, kind, headSha: headSha ?? null,
  };
  // `pidLiveness` is ALWAYS 'unknown' — see this file's own header for why a fast PID-dead reclaim would be
  // actively wrong here (the acquiring dispatcher's own exit is expected completion, not a crash).
  const result = reserve(lockRoot, resource, owner, nowMs, nowIso, pid, 'unknown', leaseMinutes, meta);
  return { ...result, resource, lockRoot };
}

/**
 * Release a claim this `owner` holds. A no-op (never throws, never touches a lock it does not own) when the
 * claim is already gone or owned by someone else — the caller learns why via `reason`, but nothing is torn
 * down out from under a legitimate different holder (e.g. one that reclaimed it after our own TTL lapsed).
 * @param {{repo:string, pr:number, kind?:string, owner:string, lockRoot?:string}} o
 * @returns {{released:boolean, reason?:string, heldBy?:string|null}}
 */
export function releaseFixDispatchClaim({
  repo, pr, kind = 'fix', owner, lockRoot = fixDispatchClaimRoot(),
} = {}) {
  if (!owner) throw new TypeError('releaseFixDispatchClaim requires an owner');
  const resource = fixDispatchResource({ repo, pr, kind });
  const current = readLockEntry(lockRoot, resource);
  if (!current) return { released: false, reason: 'absent' };
  if (current.owner !== owner) return { released: false, reason: 'not-owner', heldBy: current.owner };
  releaseLockDir(lockRoot, resource);
  return { released: true };
}

/**
 * Read-only introspection of one `(repo, kind, pr)` claim's current entry, or `null` if free — the primitive
 * a dry-run/status read (never a mutation) uses to report "claimed by X" without acquiring or releasing
 * anything itself.
 * @param {{repo:string, pr:number, kind?:string, lockRoot?:string}} o
 */
export function readFixDispatchClaim({
  repo, pr, kind = 'fix', lockRoot = fixDispatchClaimRoot(),
} = {}) {
  const resource = fixDispatchResource({ repo, pr, kind });
  return readLockEntry(lockRoot, resource);
}

/** we:scripts/conveyor/fix-dispatch-claim.mjs#fixDispatchSessionName — the SAME session name a real dispatch
 *  for `(repo, kind, pr)` mints (`we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix`'s own
 *  `sessionSlugFor(planned.pr, 'fix', null, '', repo)`, `we:scripts/operations/ci-heal-pr-dispatch.mjs
 *  #dispatchCiHeal`'s own `sessionSlugFor(planned.itemNum, 'ci-heal', planned.pr, '', repo)`) and the SAME
 *  name `we:scripts/conveyor/reconcile-core.mjs#bindAgents`'s own PATH 2 matches against `claude agents
 *  --json --all` — reused here (via the shared, lower-level {@link mintSessionSlug}, never re-derived) so
 *  {@link isClaimSessionLive} asks `bindAgents`'s exact question. Pure.
 * @param {{repo:string, pr:number, kind?:string}} o
 * @returns {string}
 */
export function fixDispatchSessionName({ repo, pr, kind = 'fix' }) {
  return mintSessionSlug({ kind, id: pr, repo });
}

/** we:scripts/conveyor/fix-dispatch-claim.mjs#isClaimSessionLive — is there a LIVE, non-terminal session
 *  still carrying `(repo, kind, pr)`'s own dispatched name, in a `claude agents --json --all`-shaped listing?
 *  `'done'`/`'stopped'`/`'failed'` are terminal — mirrors `we:scripts/conveyor/health-smells/
 *  red-pr-unattended.mjs`'s own exact liveness convention (`state !== 'done' && state !== 'stopped' && state
 *  !== 'failed'`), reused rather than re-derived so "live" means the same thing everywhere this repo asks it.
 *  Pure — the caller supplies `agentsAll` (a real caller reads it fresh; a test hands in a fixture).
 * @param {{repo:string, pr:number, kind?:string, agentsAll:Array<object>}} o
 * @returns {boolean}
 */
export function isClaimSessionLive({ repo, pr, kind = 'fix', agentsAll }) {
  const name = fixDispatchSessionName({ repo, pr, kind });
  return (Array.isArray(agentsAll) ? agentsAll : []).some((a) => (
    a && String(a.name ?? '') === name
    && a.state !== 'done' && a.state !== 'stopped' && a.state !== 'failed'
  ));
}

/**
 * we:scripts/conveyor/fix-dispatch-claim.mjs#listFixDispatchClaims — every currently-held claim under
 * `lockRoot`, parsed via `file-locks.mjs`'s own tolerant {@link parseLockEntry} (a half-written/corrupt entry
 * is skipped, never thrown over). Raw directory scan, not keyed by resource — {@link refreshLiveFixDispatchClaims}
 * needs to iterate EVERY claim, and the resource string a claim was filed under is not recoverable from its
 * hashed lock-dir name (`we:scripts/readiness/file-locks.mjs#lockIdFor`), so this reads each entry's own
 * `meta` (`{repo, pr, kind, headSha}`, written by {@link acquireFixDispatchClaim}) instead of re-deriving the
 * resource string. An entry with no usable `meta` (written before this shape existed, or corrupt) is skipped —
 * {@link refreshLiveFixDispatchClaims} simply never refreshes it, and it recovers on its own plain TTL exactly
 * as before this fix.
 * @param {string} [lockRoot]
 * @returns {Array<{owner:string, path:string, pid:number|null, heartbeatAt:string, meta:{repo:string, pr:number, kind:string, headSha:string|null}}>}
 */
export function listFixDispatchClaims(lockRoot = fixDispatchClaimRoot()) {
  let dirNames;
  try { dirNames = readdirSync(lockRoot); } catch { return []; }
  const out = [];
  for (const dirName of dirNames) {
    let raw = '';
    try { raw = readFileSync(join(lockRoot, dirName, 'lock.json'), 'utf8'); } catch { /* skip: no entry file */ }
    const entry = parseLockEntry(raw);
    if (!entry || !entry.meta || !entry.meta.repo || !entry.meta.pr || !entry.meta.kind) continue;
    out.push(entry);
  }
  return out;
}

/**
 * we:scripts/conveyor/fix-dispatch-claim.mjs#refreshLiveFixDispatchClaims — THE FIX for a claim outliving a
 * genuinely still-working session past its own TTL (see this file's own header). Called once per daemon tick
 * (the IO shell, `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`), BEFORE that tick's own
 * `fix`/`ci-heal` dispatch attempts: reads every held claim ({@link listFixDispatchClaims}), and for each one
 * whose `(repo, kind, pr)` still names a LIVE, non-terminal session ({@link isClaimSessionLive}, ONE shared
 * `agentsAll` read for the whole sweep — never one `claude agents --json --all` call per claim),
 * heartbeat-refreshes it (`file-locks.mjs#heartbeat`) so its TTL never lapses while the session is real. A
 * claim whose session is NOT confirmed live (already finished, or — the spawn-listing-lag case this file's own
 * `DEFAULT_FIX_DISPATCH_CLAIM_TTL_MINUTES` comment already covers — not yet visible in the listing) is left
 * untouched: the plain TTL still recovers it exactly as before this fix, dead-holder recovery unchanged.
 * @param {{lockRoot?:string, listAgentsAll?:Function, nowIso?:()=>string}} [o]
 * @returns {{checked:number, refreshed:Array<{repo:string, pr:number, kind:string, headSha:string|null, owner:string}>}}
 */
export function refreshLiveFixDispatchClaims({
  lockRoot = fixDispatchClaimRoot(),
  listAgentsAll = () => defaultListAgents({ all: true }),
  nowIso = () => new Date().toISOString(),
} = {}) {
  const claims = listFixDispatchClaims(lockRoot);
  if (!claims.length) return { checked: 0, refreshed: [] };
  const agentsAll = listAgentsAll();
  const refreshed = [];
  for (const entry of claims) {
    const { repo, pr, kind, headSha = null } = entry.meta;
    if (!isClaimSessionLive({ repo, pr, kind, agentsAll })) continue;
    const resource = fixDispatchResource({ repo, pr, kind });
    heartbeat(lockRoot, resource, entry.owner, nowIso(), entry.pid ?? null, entry.meta);
    refreshed.push({
      repo, pr, kind, headSha, owner: entry.owner,
    });
  }
  return { checked: claims.length, refreshed };
}
