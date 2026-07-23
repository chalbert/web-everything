---
bornAs: xvabt1e
kind: story
size: 2
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/readiness/
  - we:scripts/__tests__/
---

# decideDrainLeaseGate is repo-scope-blind — a scoped drain holder falsely no-ops differently-scoped sweeps

The #2449 whole-process lease gate in we:scripts/merge-ai-prs.mjs takes no repo-scope input: any non---only sweep no-ops exit 0 on a live lease claiming "the holder's next pass covers this work", but the holder may be a differently-scoped drain (--this-repo / --repos=...) that never sweeps the no-op'd run's repos — those PRs silently stay queued until the holder exits. Fix shape: record the holder's repo scope in the lease (owner metadata) and have decideDrainLeaseGate compare scopes — disjoint scope either proceeds safely or no-ops with an HONEST message; at minimum stop claiming coverage that is false. Surfaced by the PR #444 human review (findings applied to #441's landed code).

## Progress

- The drain lease now records the holder's repo scope. we:scripts/readiness/file-locks.mjs gained an optional, opaque `meta` passthrough (`makeLockEntry`/`reserve`/`heartbeat`/`parseLockEntry`) — absent meta leaves entries byte-identical to before. we:scripts/readiness/drain-lock.mjs writes `{ scope }` on `acquireDrainLease`, preserves it across `heartbeatDrainLease` (re-supplied or carried forward), surfaces it on `drainLeaseStatus`, and adds a `normalizeScope` helper (de-dupe + sort).
- `decideDrainLeaseGate` now compares the run's repo scope to the holder's: holder-scope-unknown or run-scope-unknown → conservative no-op (unchanged, safe); run ⊆ holder → honest no-op; otherwise (partial OR full disjoint) → no-op that reports the UNCOVERED repos honestly instead of the old false coverage claim. It deliberately does NOT auto-run concurrently on a disjoint scope: a lease-less bypass would drop mutual exclusion between two same-scope launches under a narrow holder (a same-repo drain race), so honesty is the safe floor; the operator forces an immediate scoped run with `--no-drain-lease` if the uncovered repos can't wait.
- we:scripts/merge-ai-prs.mjs threads the run's `leaseScope` into the gate, acquire, and heartbeat, and prints an honest uncovered-scope message (plus `uncovered` in JSON) instead of the old false "its next pass covers this work".
- Unit coverage added across the three loci (gate scope cases, lease scope persistence + heartbeat preservation, file-locks meta round-trip). Out of scope, left as-is: we:scripts/lane-drain.mjs still acquires an unscoped lease → the gate treats it conservatively as covers-all (safe, no false-negative land).
