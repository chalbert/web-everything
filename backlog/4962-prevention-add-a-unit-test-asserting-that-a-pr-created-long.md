---
bornAs: xy81enf
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a unit test asserting that a PR created long ago with a fresh CI-red fix and no marker does NOT out… (from chalbert/web-everything#3420 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-core.mjs:2218` — Add a unit test asserting that a PR created long ago with a fresh CI-red fix and no marker does NOT outrank a higher-fan-out waiter. Alternatively, have the planner record the first-seen-owed time.
2. `we:scripts/conveyor/reconcile-pass.mjs:1039` — Add a `runReconcilePass` test that asserts `openPrFiles` for a small file list and for exactly 100 files. Prefer a shared constant (for example `GH_FILES_CAP = 100`) over three repeated literals.
3. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1129` — Add a test or lint that a claim's scope is a superset of the dispatched fence, or keep a second fence-overlap check in filterFixesByInFlightScope.
4. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1147` — Treat an empty observed file list as unknown (keep the conservative claim), and add a test for `openPrFiles` with `files: []`.
5. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:278` — Add a check:standards or unit rule that every scope-like field derived from PR paths passes through isSafeFallbackScopeEntry. Or filter overlapScope with it, which would redden the test case that currently pins the hostile entry.
6. `we:scripts/conveyor/reconcile-fix-dispatch.mjs:279` — A test that asserts an itemless PR failing its diff read is refused with 'scope-read-failed', mirroring the existing test for the main branch.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3420@813ff65750176374c7d03f2ca8286d8cbd08e03f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
