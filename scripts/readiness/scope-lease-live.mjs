/**
 * @file scripts/readiness/scope-lease-live.mjs
 * @description LIVE scope picture (WE epic #2560, slice 3 — a PURE, READ-ONLY OBSERVER). Given the CURRENT set
 *   of lane leases and a program's scope policy, it reports the live conflict state the scope-lease board's
 *   lease-zone (#2589) renders: per-lease breach + its policy outcome, and the pairwise scope overlaps between
 *   live leases, each classified by the overlap-at-launch policy. It also answers the launch affordance's
 *   "can this new work start now?" query ({@link candidateLaunch}).
 *
 * READ-ONLY / PURE (the hard constraint of this slice):
 *   • No fs, no child_process, no `Date` — every input (the lease set, their observed diffs, the attempt count)
 *     is passed IN; the CLI (`lane-pool.mjs`) owns the git/fs collection and hands this module plain objects.
 *   • It OBSERVES; it never touches the live lease acquire/release path. Everything it reports is the SAME
 *     advisory scheduling signal slice 1 defined (§3i-A4 Fork 1: the whole-clone lease is the real lock;
 *     predicted file-scope is advisory) — this observer NEVER gates a write.
 *
 * HOW THIS COMPOSES (compose, don't reinvent — fidelity to the existing engine beats a fresh model):
 *   • Breach per lease  → {@link ./scope-lease.mjs breachOf} (predicted-vs-observed set difference, coverage-aware).
 *   • Breach outcome    → {@link ./scope-lease.mjs breachOutcome} under the resolved `breachMidBuild` + `retryBound`.
 *   • Overlap + classify → {@link ./scope-lease.mjs overlapAtLaunch}, which itself composes
 *     {@link ./scope-lease.mjs scopesOverlap} to DETECT the intersection and then applies the `overlapAtLaunch`
 *     policy. So overlap DETECTION and CLASSIFICATION are the SAME engine call — this observer never re-derives
 *     either (see the pairwise-overlaps note in {@link liveScopePicture}).
 *   • Policy            → {@link ./scope-policy-config.mjs resolveScopePolicy}: the `policy` input is resolved
 *     here, so a caller may pass a fully-resolved policy, a partial config, or `null` (⇒ the ratified defaults).
 *     Resolving a already-resolved policy is idempotent, so accepting either shape is strictly more robust.
 *   • No breach/overlap/policy LOGIC is re-implemented — this module is pure orchestration over slices 1 & 2.
 *
 * THE LEASE-INPUT SHAPE (the minimal contract this observer reads — a live snapshot of one lane's lease):
 *   {
 *     lane,            // string|number — the lane id (from `lane-pool.mjs` — the lease's clone).
 *     session,         // string|null   — who holds it (the lease `session`; informational, echoed through).
 *     predictedScope,  // string[]      — module/glob-level repo-qualified plan scope (the prepare-agent's plan).
 *     observedScope,   // string[]      — file-level repo-qualified live diff (`git diff --name-only`, CLI-supplied).
 *     breachAttempt?,  // number        — OPTIONAL total breach-attempt count so far (§3i-A4 Fork 2's counter);
 *                      //                 defaults to 1 (first observation ⇒ retry-in-place). Pass the real count
 *                      //                 through when the CLI tracks it, so the outcome reflects escalation.
 *   }
 *   This is a projection of the on-disk `.lane-lease` marker (`../lib/lane-lease.mjs` `leaseBody`: session,
 *   purpose, acquiredAt, path) plus the lane's live diff — the observer takes it as INPUT and stays pure (it
 *   never reads the pool itself). `predictedScope`/`observedScope` are repo-qualified ("<repo>:<path>") exactly
 *   as `lane-partition.mjs` `filesOf` and slice 1 require.
 *
 * THE EFFECTIVE (LIVE) SCOPE — a design call this slice makes (flagged for review):
 *   §3i's launch rule keys on PREDICTED scope, but a LIVE picture must also see a lane's real footprint: two
 *   leases can be declared-disjoint yet have OBSERVED files that overlap — the exact contention the drain later
 *   hits. So overlap detection here runs on the EFFECTIVE scope = predicted ∪ observed (everything the lane is
 *   actually sitting on), not predicted alone. This is a superset of the launch-time reading, so it never MISSES
 *   a declared overlap and additionally surfaces breach-driven contention. See {@link effectiveScope}.
 */

import { breachOf, breachOutcome, overlapAtLaunch, normScope } from './scope-lease.mjs';
import { resolveScopePolicy } from './scope-policy-config.mjs';

/**
 * A lease's EFFECTIVE live scope = predicted ∪ observed, deduped/normalized (repo-qualified). The full footprint
 * the lane is currently holding: its declared plan scope plus every file it has actually touched. Overlap
 * detection runs on this (see the file header's design note), so a breach that spills onto another lane's files
 * is visible as live contention, not just a declared-scope intersection.
 */
export function effectiveScope(lease) {
  if (!lease || typeof lease !== 'object') return [];
  return normScope([...normScope(lease.predictedScope), ...normScope(lease.observedScope)]);
}

/**
 * The live per-lease breach + its policy outcome. Pure projection of {@link breachOf} + {@link breachOutcome}.
 * @param {{lane, session, predictedScope, observedScope, breachAttempt?}} lease
 * @param {{breachMidBuild:string, retryBound:number}} policy  a RESOLVED scope policy.
 * @returns {{lane, session, predicted:string[], observed:string[], breach:string[], clean:boolean,
 *   outcome:object}}  `outcome` is the full {@link breachOutcome} result (action / rung / escalated /
 *   holdSource / routes …) — directly renderable by the board's you-card.
 */
function leaseState(lease, policy) {
  const predicted = normScope(lease.predictedScope);
  const observed = normScope(lease.observedScope);
  const breach = breachOf(predicted, observed);
  const attempt = Number.isInteger(lease.breachAttempt) && lease.breachAttempt >= 1 ? lease.breachAttempt : 1;
  const outcome = breachOutcome(breach, policy.breachMidBuild, { attempt, retryBound: policy.retryBound });
  return {
    lane: lease.lane ?? null,
    session: lease.session ?? null,
    predicted,
    observed,
    breach,
    clean: breach.length === 0,
    outcome,
  };
}

/**
 * The LIVE scope picture across the current lease set (the read-only observer the board's lease-zone consumes).
 *
 * @param {{leases:Array<{lane, session, predictedScope, observedScope, breachAttempt?}>,
 *   policy?:object}} input  `leases` = the CURRENT lane leases (see the file header's lease-input shape);
 *   `policy` = a resolved scope policy OR a partial config OR null — resolved here via `resolveScopePolicy`.
 * @returns {{policy:object, leases:Array<object>, overlaps:Array<object>, breachedLanes:Array,
 *   clean:boolean}}
 *   • `policy`   — the RESOLVED policy actually applied (echoed so the board can label the picture).
 *   • `leases`   — one {@link leaseState} per input lease: its breach + `breachOutcome`.
 *   • `overlaps` — every UNORDERED pair of leases whose effective scopes intersect, classified by the
 *     overlap-at-launch policy: `{ a, b, scopeA, scopeB, outcome }` where `outcome ∈ {wait,ask,force}`
 *     (never 'launch' — a listed pair overlaps by construction). `a`/`b` are lane ids; `scopeA`/`scopeB`
 *     the effective scopes. Detection + classification both come from {@link overlapAtLaunch}.
 *   • `breachedLanes` — the lane ids whose observed scope breached predicted (a quick board index).
 *   • `clean`    — no breach on any lease AND no overlapping pair (the whole board is green).
 */
export function liveScopePicture({ leases, policy } = {}) {
  const resolved = resolveScopePolicy(policy);
  const list = Array.isArray(leases) ? leases.filter((l) => l && typeof l === 'object') : [];

  const leaseStates = list.map((l) => leaseState(l, resolved));

  // Pairwise overlaps. Detection AND classification are the SAME engine call: overlapAtLaunch(candidate,
  // [other], policy) runs scopesOverlap internally to detect the intersection, then applies the overlap policy.
  // outcome === 'launch' ⇒ the pair is disjoint (drop it); otherwise it is an overlapping pair, already tagged
  // wait/ask/force. Unordered: only j > i, so each pair is reported once (overlap is symmetric).
  const overlaps = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const scopeA = effectiveScope(a);
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const scopeB = effectiveScope(b);
      const res = overlapAtLaunch(scopeA, [{ id: b.lane ?? null, scope: scopeB }], resolved.overlapAtLaunch);
      if (res.outcome === 'launch') continue; // disjoint effective scopes — no live contention
      overlaps.push({ a: a.lane ?? null, b: b.lane ?? null, scopeA, scopeB, outcome: res.outcome });
    }
  }

  const breachedLanes = leaseStates.filter((s) => !s.clean).map((s) => s.lane);
  return {
    policy: resolved,
    leases: leaseStates,
    overlaps,
    breachedLanes,
    clean: breachedLanes.length === 0 && overlaps.length === 0,
  };
}

/**
 * The launch affordance's "can this NEW work start now?" query (§3i launch rule). Given a candidate's predicted
 * scope + the CURRENT leases, return the overlap-at-launch outcome. Pure composition of {@link overlapAtLaunch}
 * over the current leases' EFFECTIVE scopes (so a candidate is blocked by a lane's real footprint, not only its
 * declaration).
 *
 * @param {{candidateScope:string[], leases:Array<object>, policy?:object}} input
 *   `candidateScope` = the new work's predicted (module/glob) scope; `leases` = the current lease set;
 *   `policy` = resolved policy / partial config / null (resolved here).
 * @returns the full {@link overlapAtLaunch} result:
 *   `{ outcome, policy, overlaps, waitOn, resolveAtDrain }` — `outcome ∈ {launch,wait,ask,force}`
 *   (`launch` ⇒ disjoint from every live lease, start now). `waitOn` = the lane ids to wait on; `overlaps`
 *   name each contended lane + its scope. Directly drives the board's launch button state.
 */
export function candidateLaunch({ candidateScope, leases, policy } = {}) {
  const resolved = resolveScopePolicy(policy);
  const active = (Array.isArray(leases) ? leases.filter((l) => l && typeof l === 'object') : [])
    .map((l) => ({ id: l.lane ?? null, scope: effectiveScope(l) }));
  return overlapAtLaunch(normScope(candidateScope), active, resolved.overlapAtLaunch);
}
