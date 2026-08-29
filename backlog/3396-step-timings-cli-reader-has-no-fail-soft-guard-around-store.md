---
bornAs: x9zmnbs
kind: task
parent: "3368"
status: open
dateOpened: "2026-08-29"
tags: []
---

# step-timings CLI reader has no fail-soft guard around store.read

The reader's `we:scripts/operations/step-timings-report.mjs` list/read shape throws on a malformed run record instead of fail-softing like `we:scripts/operations/wake.mjs`'s `wakePass` does; a single bad file crashes the whole report. Surfaced in the #1693 review round 2 correctness lens (PLAUSIBLE, impact degraded). Fix: extract a shared `readAllRuns(store)` helper in `we:scripts/operations/run-store.mjs` that fail-softs per id, and have both readers call it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
