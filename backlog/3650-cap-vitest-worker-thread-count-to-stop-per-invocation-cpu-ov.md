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

**Resolved as a duplicate pair, not as done.** This item and its twin `we:backlog/x1jcikc-cap-vitest-worker-thread-count-to-stop-per-invocation-cpu-ov.md` share `bornAs: x1jcikc` — the identical
proposal was JIT-numbered independently on two branches (`origin/main`, and `lane/mechanical-dispatcher`)
before they diverged, surfaced as an unresolved twin by the `#3383` merge (2026-09-13); `check:standards`'s
`duplicateBornAs` rule (#2? — "two numbered cards claiming the same birth") only reads as a harmless
audit-trail smudge once EVERY twin sharing the hash is resolved, so both the twin and this card are closed here
rather than picking one to leave open. NO WORK WAS DONE on either copy — `graduatedTo: none` records that
honestly. The underlying idea (cap vitest worker/thread count, `we:scripts/readiness/heavy-admission.mjs`
#3461's neighbour concern) is still real and un-built; re-file it fresh if it is still wanted, rather than
reopening either of these twins.

_Numbering note (2026-09-13 merge): the twin originally landed on `lane/mechanical-dispatcher` as `#3635`;_
_that number was reclaimed by the distinct, unrelated "Codex model routing" decision (`origin/main`'s own_
_`#3635`, `bornAs: x8wbivt`) once the two branches merged, so this card's twin was hand-renumbered to `#3657`_
_to free it — itself a hand-picked NNN that tripped the hash-then-JIT gate (#2288/#2548). Corrected here by_
_converting the twin back to its hash-keyed form (`x1jcikc`), letting JIT-numbering assign a real NNN only_
_if/when it actually lands._

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
