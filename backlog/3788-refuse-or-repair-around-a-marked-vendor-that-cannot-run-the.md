---
bornAs: xirxlz4
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3787"]
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/agent-provider-registry.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/fix-run.mjs", "we:scripts/operations/ci-heal-run.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Refuse or repair-around a marked vendor that cannot run the kind, and record it apart from routing (#3658)

Build Fork 4 of #3658 (we:docs/agent/platform-decisions.md#agent-vendor-registry rule 4) on top of the vendor registry. In the *-run.mjs selector, through resolveAgentProvider: for build, a marked vendor with no build adapter is refused by name before a lane is acquired; for fix and ci-heal it falls back to claude-restricted. Record requestedVendor, executedVendor and reason in their own run-record fields, apart from #3717's routedProvider/executedProvider in we:scripts/operations/dispatch-lane-io.mjs, so a marker fallback is never counted as a router delegation gap in the trial data. Replace executedProvider: EXECUTABLE_PROVIDER with the vendor the child actually ran, as the child reports it back. Lands on lane/mechanical-dispatcher and reaches main through #3443's slices.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
