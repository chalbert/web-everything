---
bornAs: x1jcikc
kind: task
status: resolved
scope: ["we:vitest.config.ts", "we:vitest.shared.ts", "we:vitest.integration.config.ts", "we:vitest.maas-conformance.config.ts"]
dateOpened: "2026-09-07"
dateResolved: "2026-09-13"
graduatedTo: none
tags: []
---

# Cap vitest worker/thread count to stop per-invocation CPU oversubscription

we:vitest.config.ts / we:vitest.shared.ts had no pool/maxThreads/maxForks config, so a single vitest invocation defaults (via tinypool) to one worker per available CPU core (12 on a real host). we:scripts/readiness/heavy-admission.mjs (#3461) caps concurrent HEAVY COMMANDS at 2 host-wide, but never bounded worker threads WITHIN one invocation — two admitted vitest runs could grab up to 24 threads across 12 cores, and the admission semaphore itself fails open on a 20-minute timeout (documented, observed live), so a 3rd concurrent run is real too. Fix: add an explicit maxThreads/maxForks cap (4) via we:vitest.shared.ts, applied in we:vitest.config.ts, we:vitest.integration.config.ts, we:vitest.maas-conformance.config.ts. Build-ready infra tuning, filed lightweight for tracking.

**Resolved as a duplicate pair, not as done.** This item and `#3650` share the same `bornAs: x1jcikc` — the
identical proposal was JIT-numbered independently on two branches (this lane, and `origin/main`) before they
diverged, and the `lane/mechanical-dispatcher` ↔ `origin/main` merge (epic #3383, 2026-09-13) surfaced both
copies as an unresolved twin (byte-identical bodies, confirmed by diff). No work was ever claimed against
either copy, so both are closed here (see `#3650`'s own resolution note) rather than picking one survivor —
`graduatedTo: none` records that honestly. Re-file the underlying idea fresh if it is still wanted.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
