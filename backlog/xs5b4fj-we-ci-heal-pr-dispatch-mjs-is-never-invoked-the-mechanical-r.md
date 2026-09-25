---
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/__tests__/runner.test.mjs", "we:skills-src/conveyor/__tests__/runner-repos.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# we:ci-heal-pr-dispatch.mjs is never invoked — the mechanical runner plans ci-heal but never dispatches it

we:scripts/conveyor/reconcile-core.mjs#planReconcile correctly plans a kind:'ci-heal' dispatch entry for any open PR with a red required check and nothing live on it, but the ONLY function that ever acts on that entry, we:scripts/operations/ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch, has no caller anywhere in the tree — we:skills-src/conveyor/runner.mjs's MECHANICAL_PASS_NAMES and its per-repo tick loop wire we:scripts/conveyor/reconcile-fix-dispatch.mjs (the 'fix' kind sibling) but never we:scripts/operations/ci-heal-pr-dispatch.mjs (the 'ci-heal' kind). Live-confirmed 2026-09-25 against chalbert/web-everything PR #2635 and #2636: both are DIRTY + ci:failed + carry no review label, we:scripts/conveyor/reconcile-pass.mjs's own plan already reports kind:'ci-heal' for both (0/3 attempts spent), yet neither has ever had a ci-heal agent dispatched — because the runner never calls the one pass that would. Fix: wire we:scripts/operations/ci-heal-pr-dispatch.mjs into we:skills-src/conveyor/runner.mjs's MECHANICAL_PASS_NAMES + per-repo tick loop, mirroring we:scripts/conveyor/reconcile-fix-dispatch.mjs's own wiring exactly (same prsArgs, same per-repo --repo= threading).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
