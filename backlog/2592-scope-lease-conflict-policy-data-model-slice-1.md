---
bornAs: xkuvk3a
kind: story
size: 5
parent: "2560"
status: resolved
dateOpened: "2026-07-20"
dateResolved: "2026-07-20"
tags: [plateau-loop, console, scope-lease, conflict-policy, readiness]
---

# Scope-lease + conflict-policy data model (slice 1)

The first slice of the scope-lease engine (epic #2560): the PURE data model + policy layer, unit-proven,
ready for a later slice to wire into the live lease path. No surgery on the live `we:scripts/lane-pool.mjs`
acquire/release — this is the logic + its proof, additive alongside the existing readiness machinery.

## Scope (delivered)
- New module `we:scripts/readiness/scope-lease.mjs`: predicted scope (module/glob-level, planning) vs
  observed scope (the lane's file-level changed set) → **breach** = observed files covered by no predicted
  entry (§3i). Glob-level coverage (a `foo/**`-style predicted entry covers a file beneath it), since exact-
  path intersection under-matches at module granularity.
- `overlapAtLaunch(candidateScope, activeLeases, policy)` — policy ∈ {wait, ask, force}; force sets
  `resolveAtDrain`.
- `breachOutcome(breach, policy, {attempt, retryBound})` — policy ∈ {pause, park, resolve-at-drain};
  encodes §3i-A4 (WE #2574): whole-clone lease is the enforcement unit (this data is **advisory**, never a
  lock); retry-in-place while `attempt <= retryBound` then escalate on a **total attempt counter** (not
  same-scope-twice); `holdSource` per pause/park.
- Composes with `we:scripts/readiness/lane-partition.mjs` (reuses `disjoint`) and mirrors
  `we:scripts/readiness/overlap-chain.mjs`'s contract at the module-glob boundary.

## Acceptance
The module exports the scope/breach model + the two policy resolvers; unit tests prove the §3i / §3i-A4
behaviour (38 cases); the full `we:scripts/readiness/` suite stays green; no existing file is modified.

## Not in scope (remaining #2560 children)
- Wiring the model into the live `we:scripts/lane-pool.mjs` acquire/release path.
- Per-program policy config + the ⚙ policy control.
- The board surfacing of the breach / overlap / force states (consumed by the #2555 board).
