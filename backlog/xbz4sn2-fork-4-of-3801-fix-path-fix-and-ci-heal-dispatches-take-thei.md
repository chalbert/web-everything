---
kind: story
size: 2
parent: "3717"
status: open
blockedBy: ["xlq2jh7"]
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-routing.test.mjs", "we:scripts/operations/dispatch-providers/fix.mjs", "we:scripts/operations/dispatch-providers/ci-heal.mjs", "we:scripts/lib/dispatch-contracts.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Fork 4 of #3801, fix path: fix and ci-heal dispatches take their size from the fixSizeSource chain (card size, then the measured diff, then assumed), so they are never blocked

Ruled in #3801 Fork 4: the reconcile fix path passes no size (we:scripts/conveyor/reconcile-fix-dispatch.mjs:521-526), so block alone would stop conflict fixes. The default chain is card-size (the item the PR was built from, already looked up through findItemFn), then measured-diff (the changed-line count of the PR being repaired), then assumed (the 13 band, so Claude). Every fix and ci-heal route records which step supplied its size. Carried unverified from the ruling: how closely a repaired diff tracks the size of the fix, which affects only the measured-diff step.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/conveyor/reconcile-fix-dispatch.mjs` also exists on `main`; its routing call exists only in the branch copy (`decideDispatchRoute`, imported at `:74` and called at `:521`). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the Fork 4 policy slice, which defines `fixSizeSource`.

**No runtime effect yet, stated by the ruling:** the reconcile fix spawn is Claude either way, so the route only records what would have been chosen (`routed` against `executed`).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/reconcile-fix-routing.test.mjs` passes with new cases that fail before: (a) a planned fix whose item has `size: 2` records an estimate of 80 lines, `sized: true` and the source `card-size`; (b) with no item size and a PR diff of 120 changed lines, it records the source `measured-diff`; (c) with neither, it records `assumed` and the 13 band, and is dispatched, not held, under `unsizedCardPolicy: block`.
2. **Executable** — the same three cases pass for a `ci-heal` dispatch in the `ci-heal` provider's test.
