---
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/pr-land.mjs", "we:scripts/operations/__tests__/build-pr-authorship.test.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/__tests__/pr-land.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3117's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3117's review (reviewed head `c962f25c1b839f9e743ed7e7a98431a87d5743eb`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1036` — Add a test in `we:build-red-draft-recovery.test.mjs` where the receipt handle is dead and the current run-store entry with the same key has a live handle, and assert no dispatch. A comment stating that receipts are immutable evidence and liveness is always read live would also help.
2. `we:scripts/pr-land.mjs:888` — Add a `resumeOpen` or pr-land test that resumes with a `builderContext` whose run has been pruned. Decide whether that should degrade to opening without a receipt or fail loudly, and have the infra store hold the run alive. A lint that flags prune-retention sets against other stores' foreign keys would be a further guard.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1036` — In `backfillAuthorship`, require the open PR's `headRefName` to satisfy `prDeliversNum` for `entry.payload.num`. Add a test with a matching PR number but a non-matching branch. A review lens on 'authorship evidence must be two-factor' would also catch it.
4. `we:scripts/operations/__tests__/build-pr-authorship.test.mjs:36` — Add table-driven negatives to `we:scripts/operations/__tests__/build-pr-authorship.test.mjs`, one per skip clause: foreign scope, foreign URL, non-build launchKind, and a missing `num`.
5. `we:scripts/pr-land.mjs:919` — Add a deterministic integration test that simulates successful PR creation followed by failed checkpointing, then retries against the existing PR and requires a durable receipt before wrapper settlement.
6. `we:scripts/operations/deliver-item-wrapper.mjs` — A cross-domain integration test for deliverItem covering both build and fix dispatch flows, asserting non-builder dispatches can still publish.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
