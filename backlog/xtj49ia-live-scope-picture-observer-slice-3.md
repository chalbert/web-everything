---
kind: story
size: 3
parent: "2560"
status: resolved
dateOpened: "2026-07-21"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, scope-lease, conflict-policy, readiness]
---

# Live scope-picture observer (slice 3)

Slice 3 of the scope-lease engine (epic #2560): a PURE, READ-ONLY observer that turns the current lane leases
into the live conflict picture the board's lease-zone (#2589) renders — per-lease breach + its policy outcome,
and the pairwise scope overlaps between live leases, each classified by the overlap policy. It OBSERVES; it
never touches the live acquire/release path (§3i-A4 Fork 1: the whole-clone lease is the real lock; this is
advisory).

## Scope (delivered)
- New module `we:scripts/readiness/scope-lease-live.mjs`:
  - `liveScopePicture({ leases, policy })` → `{ policy, leases[], overlaps[], breachedLanes[], clean }` — per
    lease: breach + full `breachOutcome`; per overlapping pair: `{a,b,scopeA,scopeB,outcome ∈ wait|ask|force}`.
  - `candidateLaunch({ candidateScope, leases, policy })` → the `overlapAtLaunch` result (launch|wait|ask|force)
    — the board's "can this start now?" query.
  - `effectiveScope(lease)` = predicted ∪ observed (a documented design call: a live picture must see a lane's
    real footprint, not only its declaration, so breach-driven contention is visible).
- Pure (no fs / child_process / Date — the lease snapshot + observed diff are passed in). Composes slices 1 & 2
  (`breachOf` · `breachOutcome` · `overlapAtLaunch` · `resolveScopePolicy`) — no breach/overlap/policy logic
  re-implemented.

## Acceptance
The observer reports the live breach + overlap picture and the candidate-launch outcome from a lease snapshot,
composing slices 1/2; unit tests prove it (30 cases); the full `we:scripts/readiness/` suite stays green; no
existing file modified.

## Not in scope (remaining #2560 children)
- The CLI that collects the live lease snapshot (git diff + lease markers) and calls this.
- Wiring into the live `we:scripts/lane-pool.mjs` acquire/release path.
- The board lease-zone rendering (#2589) that consumes this.
