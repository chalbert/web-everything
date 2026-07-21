---
bornAs: xk7m2np
kind: story
size: 3
parent: "2560"
status: resolved
dateOpened: "2026-07-20"
dateResolved: "2026-07-20"
tags: [plateau-loop, console, scope-lease, conflict-policy, lanes, readiness]
---

# Acquire declares predicted scope + advisory overlap check (slice 5)

Slice 5 of the scope-lease engine (epic #2560): wire a lane's PREDICTED file-scope into the live acquire path,
so the observer/collector (#2594/#2596) finally has a **real predicted-scope producer** — the gap #2596 flagged.
A lane declares its scope at acquire; that scope is persisted in the lease marker and drives an ADVISORY
overlap check. §3i-A4 Fork 1 holds throughout: the whole-clone lease is the REAL lock; predicted file-scope is
advisory — nothing here gates, blocks, reorders, or delays an acquire.

## Scope (delivered)
- `we:scripts/lane-pool.mjs acquire --scope=<repo:path,...>` — declares this lane's advisory predicted file-scope.
  - Persisted into the `.lane-lease` marker (`predictedScope`, omitted when empty ⇒ back-compat with scope-less
    acquires). This is the live predicted-scope source the collector reads.
  - After the atomic `O_EXCL` claim (never before — the claim is untouched), a STRICTLY NON-BLOCKING overlap
    check runs `candidateLaunch` against sibling lanes' declared scopes and WARNS to stderr on overlap. It is
    wrapped so a scope-check failure can never throw into the acquire; stdout stays the clean `LANE=` path.
- `we:scripts/lib/lane-lease.mjs` `leaseBody` gains an optional `predictedScope` field (included only when a
  non-empty array; the module stays zero-import — the caller normalizes).
- `we:scripts/readiness/scope-lease-collect.mjs` — `resolvePredictedScope` now prefers marker-declared scope:
  **declared (acquire `--scope`) → `--plan` → observed**; `collectSnapshot` reads `lane.lease.predictedScope`.
  The predicted=observed default still holds when nothing declared a scope.

## Acceptance
`acquire --scope=` persists the scope into the marker and keeps stdout the clean lane path; an overlapping
second acquire warns to stderr yet still succeeds (advisory, never gates); the collector takes predicted scope
from the marker when present; unit + spawned-CLI tests prove it (69 across the three suites); no existing
behavior of a scope-less acquire changes.

## Not in scope (remaining #2560)
- The durable per-lane **breach-attempt counter** (§3i-A4 Fork 2) — tracked as its own slice 6 of this epic.
- The board lease-zone (#2589, a #2555 child) that renders this live picture.
