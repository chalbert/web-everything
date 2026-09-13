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

> **DUPLICATE OF #3635 — resolved as such, not because the work happened twice.** Both cards carry
> `bornAs: x1jcikc` and byte-identical bodies. #3635 is the surviving keeper.
>
> This branch (WE PR #2156, `lane/3635-pin-codex-model-every-call-site`) forked before `#3635` existed under
> that number on `lane/mechanical-dispatcher`; this branch's own history independently re-numbered the same
> `x1jcikc` hash to `#3650` via its own JIT-numbering pass. The two branches' backlog corpora only collided
> once this PR merged `origin/lane/mechanical-dispatcher` in (`#3383`/`#xw0odtv`), surfacing the duplicate
> `bornAs` `check:standards` now catches. The underlying work is genuinely done — landed as `ab7ac270c`
> ("Cap vitest worker/thread count to stop per-invocation CPU oversubscription"), `we:vitest.shared.ts
> #maxTestWorkers` applied in all four scoped files — so both cards resolve together rather than one being
> deleted, per the backlog's own audit-trail rule.

we:vitest.config.ts / we:vitest.shared.ts had no pool/maxThreads/maxForks config, so a single vitest invocation defaults (via tinypool) to one worker per available CPU core (12 on a real host). we:scripts/readiness/heavy-admission.mjs (#3461) caps concurrent HEAVY COMMANDS at 2 host-wide, but never bounded worker threads WITHIN one invocation — two admitted vitest runs could grab up to 24 threads across 12 cores, and the admission semaphore itself fails open on a 20-minute timeout (documented, observed live), so a 3rd concurrent run is real too. Fix: add an explicit maxThreads/maxForks cap (4) via we:vitest.shared.ts, applied in we:vitest.config.ts, we:vitest.integration.config.ts, we:vitest.maas-conformance.config.ts. Build-ready infra tuning, filed lightweight for tracking.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
