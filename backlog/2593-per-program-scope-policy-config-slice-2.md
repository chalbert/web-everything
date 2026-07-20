---
bornAs: xkv3hoe
kind: story
size: 3
parent: "2560"
status: resolved
dateOpened: "2026-07-20"
dateResolved: "2026-07-20"
tags: [plateau-loop, console, scope-lease, conflict-policy, readiness]
---

# Per-program scope-policy config (slice 2)

Slice 2 of the scope-lease engine (epic #2560): the per-program binding of the two conflict knobs §3i leaves
configurable — WHICH overlap-at-launch and breach-mid-build policy a given program runs. Additive, pure, no
change to the live lease path.

## Scope (delivered)
- New module `we:scripts/readiness/scope-policy-config.mjs`:
  - `DEFAULT_SCOPE_POLICY` — the ratified §3i / §3i-A4 default (overlap = `wait`, breach = `pause`,
    `retryBound` = slice-1's `RETRY_BOUND`), frozen.
  - `validateScopePolicy(config)` → `{ ok, errors }` (non-throwing; mirrors the repo's per-program config
    validator in `we:scripts/lib/build-queue.mjs`): missing fields are legal (fill from default); only
    present-but-illegal values, non-object input, or unknown keys error.
  - `resolveScopePolicy(programConfig)` → a complete validated policy, filling gaps from the default and
    **throwing** on an illegal field (mirrors slice-1's `overlapAtLaunch`/`breachOutcome` reject path).
  - `describeScopePolicy(policy)` → one-line summary for board tooltips / logs.
- Composes with slice 1: the policy enums (`OVERLAP_POLICIES` · `BREACH_POLICIES` · `RETRY_BOUND`) are
  **imported** from `we:scripts/readiness/scope-lease.mjs`, never re-listed, so the slices can't drift; the
  resolved object is exactly the shape `overlapAtLaunch` / `breachOutcome` consume.

## Acceptance
The module resolves + validates a program's scope policy against slice-1's enums with the ratified defaults;
unit tests prove it (29 cases); the full `we:scripts/readiness/` suite stays green; no existing file modified.

## Not in scope (remaining #2560 children)
- Reading a program's config off disk and wiring the resolved policy into the live
  `we:scripts/lane-pool.mjs` acquire/release path.
- The ⚙ policy control + board surfacing of the chosen policy.
