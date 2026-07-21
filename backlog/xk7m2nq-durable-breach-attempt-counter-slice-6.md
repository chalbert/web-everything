---
bornAs: xk7m2nq
kind: story
size: 2
parent: "2560"
status: open
dateOpened: "2026-07-20"
tags: [plateau-loop, console, scope-lease, conflict-policy, lanes, readiness]
---

# Durable per-lane breach-attempt counter (slice 6)

The last slice of the scope-lease engine (epic #2560). Today the collector omits `breachAttempt` and the
observer defaults it to 1, so `breachOutcome` always reads "first observation ⇒ retry-in-place" and the
§3i-A4 Fork 2 escalation ladder can never advance past attempt 1. This slice adds a durable per-lane counter so
repeated breaches on the same lane escalate as designed.

## Why it's its own slice
The counter must SURVIVE across observations, but the lease marker is DELETED at `release`
(`we:scripts/lane-pool.mjs` `cmdRelease` → `rmSync`), so it can't live in the marker. It needs a small sidecar
(e.g. `.git/.lane-breach-count`) plus a writer that bumps it when the collector observes a breach — a distinct
concern from slice 5's read-only acquire wiring.

## Scope (proposed)
- A sidecar breach-count file per lane (outside the lease marker, survives release-of-marker but cleared on lane
  teardown/`remove`).
- A bump path: when the collector (or a thin `lane-pool` subcommand) observes a lane whose observed scope
  breaches its declared `predictedScope`, increment the lane's count; a clean observation resets it.
- The collector reads the count into each lease's `breachAttempt`, so `breachOutcome` escalates
  (retry-in-place → ask → force per the resolved policy's `retryBound`).

## Acceptance
The collector reports a real `breachAttempt` per lane sourced from the durable counter; a lane that breaches
repeatedly escalates through `breachOutcome`; a clean observation resets the count; the full
`we:scripts/readiness/` + lane-pool suites stay green. On delivery, epic #2560's scope is complete — resolve it.

## Depends on
- Slice 5 (acquire declares predicted scope) — provides the declared predicted scope a breach is measured against.
