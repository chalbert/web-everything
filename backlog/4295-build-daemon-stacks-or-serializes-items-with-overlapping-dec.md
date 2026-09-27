---
bornAs: x3bt7x7
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/readiness/overlap-chain.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Build daemon stacks or serializes items with overlapping declared scope

we:scripts/conveyor/build-dispatch-policy.mjs already declares a hot-file/scope-vs-open-prs rule (no two in-flight builds share a file), but enforces it ad hoc (firstScopeOverlap/pathsOverlap against open PRs) rather than through the same planner we:scripts/readiness/overlap-chain.mjs already uses for serial-batch lane stacking, and it never reasons jointly with FIX dispatch's own claim store (we:scripts/conveyor/build-dispatch-claim.mjs and we:scripts/conveyor/fix-dispatch-claim.mjs are separate, independently-keyed claim stores), so a build and a fix can be dispatched concurrently against overlapping declared scope with nothing to stop them. Reuse we:scripts/readiness/overlap-chain.mjs's pure chain/overlap planner (createStackPlan/planNextItem/overlappingChains) as the shared overlap check across BOTH build and fix dispatch, so two concurrent items (build+build, fix+fix, or build+fix) with overlapping declared scope stack or serialize instead of racing. Note: an item with no declared scope is already unshaped-no-scope by design (operator has flagged this as known); this card only strengthens the check where scope IS declared, and the operator expects scope handling to keep getting stricter as the build daemon takes on more work.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
