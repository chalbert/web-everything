---
bornAs: xrp2ta9
kind: epic
parent: "2555"
status: resolved
tags: [plateau-loop, console, scope-lease, conflict-policy, lanes, epic]
dateOpened: "2026-07-18"
dateResolved: "2026-07-21"
---

# Scope-lease + conflict-policy engine

The core novel mechanism of the lane board (design doc §3i): unrelated work runs in parallel lanes; a running
lane holds a **file-scope lease** that keeps conflicting work out of other lanes; conflicts are resolved by
**configurable policy**, not ad-hoc. Serves G3 (parallelism without collision). Builds ON the existing lane-lease
infrastructure (`we:scripts/lane-lease.mjs`, #2413/#2426 `isForeignLease`/`isLaneAcquirable`) — extend it with
scope, do not reinvent leasing.

## Slices
- **Predicted vs observed scope** — predicted scope (module-level, from the prepared spec) plans the launch;
  observed scope (the lane's changed-file set, file-level) enforces at runtime; a breach = their difference.
- **Lease lifecycle** — acquire at launch, relinquish at merge; the lease ties a lane to its file set.
- **Overlap-at-launch policy** (configurable per program) — `wait` · `ask` · `force + resolve-at-drain`.
- **Breach-mid-build policy** (configurable) — `pause-until-lease-frees` · `park` · `continue + resolve-at-drain`.
- **Per-program policy config** + the surfacing (the ⚙ policy control; the breach/force cards the board renders).

## Acceptance
A launch acquires a scope lease; overlapping work is held per the overlap policy; a mid-build write outside the
lease is detected and handled per the breach policy; policies are program-configurable; built on
`we:scripts/lane-lease.mjs`, not a parallel leasing system. The board ([#2555]) renders the breach/overlap/force
states.

## Delivered (all slices resolved 2026-07-21)
- Data model + breach detection (slice 1, #2592) and per-program policy config (slice 2, #2593) —
  `we:scripts/readiness/scope-lease.mjs` (`breachOf` · `breachOutcome` · `overlapAtLaunch`) +
  `we:scripts/readiness/scope-policy-config.mjs` (`resolveScopePolicy`).
- Pure live observer (slice 3, #2594) — `we:scripts/readiness/scope-lease-live.mjs` (`liveScopePicture` ·
  `candidateLaunch`).
- Live snapshot collector (slice 4, #2596) — `we:scripts/readiness/scope-lease-collect.mjs` (IO boundary:
  pool-walk + git diff → the observer's lease shape).
- Acquire declares predicted scope + advisory overlap check (slice 5, #2597) — `we:scripts/lane-pool.mjs`
  `acquire --scope=` persists the advisory predicted scope into the lease marker; the collector consumes it.
- Durable breach-attempt counter (slice 6, #2598) — per-lane sidecar advancing on breach transitions; the
  observer escalates past `retryBound`.
- The board surfacing (⚙ policy control + breach/overlap cells) shipped under [#2555] (the live lease-zone).
Whole-clone lease stays the real lock; the scope layer is advisory throughout (§3i-A4 Fork 1).
