---
bornAs: xccqc6a
kind: story
status: open
size: 3
parent: "4733"
scope: ["we:scripts/operations/explore-io.mjs"]
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Route explore sessions through the shared model policy

The independent explore background adapter still starts Claude. Migrate its provider decision and effort record while preserving scope, claim and sandbox guards.

## Done when

- Use we:scripts/lib/dispatch-routing-policy.json and we:scripts/lib/dispatch-routing-policy-io.mjs for the launch decision, or encode and validate its native-only authority constraint explicitly.
- Persist the chosen provider, model and effort; pass supported effort explicitly to the CLI.
- Test launch argv, unknown effort, critical scope and unavailable/quota-held provider behavior. Do not retry an indeterminate launch.

## Follow-ups

The 2026-09-30 launch audit deferred this adapter so repair routing could ship as one reviewable change. Prove its own lifecycle in a bounded dry run before widening defaults; preserve all existing guards.
