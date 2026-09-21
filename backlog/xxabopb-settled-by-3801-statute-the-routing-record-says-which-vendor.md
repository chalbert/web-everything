---
kind: story
size: 2
parent: "3717"
status: open
blockedBy: ["x07d2yq"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs", "we:scripts/operations/dispatch-providers/", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Settled by #3801 statute: the routing record says which vendor actually ran the dispatch, and the trial row says when a Claude converge editor also edited the lane

#3801 Settled by statute: executed records the vendor actually spawned, taken from the marker rule-4 field executedVendor, not the constant EXECUTABLE_PROVIDER = claude (we:scripts/lib/dispatch-contracts.mjs:759). Today a Codex-delivered item is recorded executed: claude, a false trial row. The delivery wrapper runs converge after the agent with a Claude editor (we:scripts/operations/deliver-item-wrapper.mjs:384-391), so the record also says when that editor changed the lane diff.

**Home:** the prototype branch `lane/mechanical-dispatcher` (the files in scope exist only there, checked on `5ab89f87b`). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** `blockedBy` the Fork 5 slice, because the marker's `executedVendor` field is the source this slice reads.

**What exists (checked on `5ab89f87b`).** The `build` provider already honours the `deliveryAgent:` marker and passes `--provider=<vendor>` to the delivery wrapper (`we:scripts/operations/dispatch-providers/build.mjs:117-121`), which can run Codex. The route still writes `executed: EXECUTABLE_PROVIDER` (`we:scripts/lib/dispatch-contracts.mjs:856`).

## Done when

1. **Executable** — on the branch, `grep -n 'EXECUTABLE_PROVIDER' we:scripts/lib/dispatch-contracts.mjs` prints nothing (today it prints the constant at `:759` and its use at `:856`).
2. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` passes with new cases that fail before: (a) a `build` whose card carries `deliveryAgent: codex` and a reason records `executed: codex` while `routed` stays the criteria's choice; (b) an unmarked `build` records `executed: claude`; (c) when the converge round changed the lane's diff after the agent, the run record carries a field saying so, and it is false when converge changed nothing.
