---
kind: story
size: 2
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# dispatch-plan: restore the owner of the breach-attempt counter

Follow-up from the #3215 advisory (2026-10-02). we:scripts/readiness/dispatch-plan.mjs:938 now always passes --no-track-attempts, so no per-tick caller advances the breach-attempt counter any more (conveyor-state already passed it). Fix: pass --no-track-attempts only when the planning-snapshot env is set, or name another owner; add a test pinning the scope-collect arguments and the counter owner.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
