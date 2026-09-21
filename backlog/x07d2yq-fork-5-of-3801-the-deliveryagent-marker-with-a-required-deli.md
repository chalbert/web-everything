---
kind: story
size: 3
parent: "3717"
status: open
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs", "we:scripts/operations/delivery-agent-marker.mjs", "we:scripts/operations/fix-run.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/dispatch-providers/"]
dateOpened: "2026-09-21"
tags: []
---

# Fork 5 of #3801: the deliveryAgent marker with a required deliveryAgentReason is the one provider override; retire the process-wide override variables

Ruled in #3801 Fork 5 (c) and its Settled-by-statute points: the per-item deliveryAgent: marker, with a required deliveryAgentReason:, is the only provider override. WE_DISPATCH_PROVIDER_OVERRIDE and WE_DISPATCH_OVERRIDE_REASON (we:scripts/operations/dispatch-lane-io.mjs:229-230) and DELIVERY_AGENT_PROVIDER (we:scripts/operations/fix-run.mjs:122, we:scripts/operations/deliver-item-run.mjs:116) are retired. routed stays the criteria choice and the override is recorded beside it, and an overridden route gets the supervision level of its own triple, never the routed one.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/operations/delivery-agent-marker.mjs`, `we:scripts/operations/fix-run.mjs` and `we:scripts/operations/deliver-item-run.mjs` exist only there (checked on `5ab89f87b`). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**What the build does today (checked on `5ab89f87b`).** `decideDispatchRoute` sets `routed` to the override's provider when one is given (`we:scripts/lib/dispatch-contracts.mjs:847`) and keeps the supervision level the routed triple earned (`:859`). So an override to a provider with no trials can inherit `spot-check`. The two override variables are read as default parameters at `we:scripts/operations/dispatch-lane-io.mjs:229-230`.

**Limits carried from the ruling, not built here:** the marker's vocabulary is the registered vendors (`claude-restricted`, `codex` today), so Antigravity cannot be forced until #3658 gives it a descriptor, and the reconcile conflict path does not read the marker. The marker's meaning under a planner build is for the G2 decision (#3801 follow-up 1).

## Done when

1. **Executable** — on the branch, `grep -rnwE 'WE_DISPATCH_PROVIDER_OVERRIDE|WE_DISPATCH_OVERRIDE_REASON|DELIVERY_AGENT_PROVIDER' we:scripts/ --include='*.mjs' --exclude-dir=__tests__` prints nothing. Today it prints the reads at `we:scripts/operations/dispatch-lane-io.mjs:229-230`, `we:scripts/operations/fix-run.mjs:122` and `we:scripts/operations/deliver-item-run.mjs:116`.
2. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs` passes with new cases that fail before: (a) a card with `deliveryAgent: codex` and no `deliveryAgentReason:` is refused with a named reason; (b) with the reason, the record keeps `routed` as the criteria's choice and records the override beside it, referencing the marker's rule-4 fields (`requestedVendor`, `executedVendor`, `reason`) rather than copying them; (c) given scorecards where the routed triple is at `spot-check`, an override to a triple with no trials records `supervision: full`.
