---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a runReconcilePass test asserting openPrFiles for a capped (100-file) PR and an ordinary PR. Better… (from chalbert/web-everything#3420 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-pass.mjs:1039` — Add a runReconcilePass test asserting `openPrFiles` for a capped (100-file) PR and an ordinary PR. Better, extract one shared `FILES_CAP`/`cappedFilePaths` helper so the three `< 100` sites cannot drift.
2. `we:scripts/conveyor/reconcile-core.mjs:2218` — Add a ranking test where an old marker-less PR competes with a fresh high-fan-out waiter, so the intended outcome is pinned explicitly. If creation-based aging stays, document it as deliberate.
3. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:740` — Add a unit test that an empty `overlapScope` falls back to the declared scope, or still blocks, in both `acquireClaim` callers and in the claim-refresh loop. A lint rule against `??` on scope arrays would be a heavier alternative.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3420@90c0f319048c6053342540a81cd38cf9b97d67ed

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
