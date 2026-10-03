---
bornAs: xd3dq38
kind: story
status: open
size: 3
parent: "4733"
scope: ["we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs"]
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Route stuck PR inspection through the model policy

The inspector calls the native background adapter. Route provider, model and effort together while preserving the inspection tool restrictions and session guards.

## Done when

- Use we:scripts/lib/dispatch-routing-policy.json and we:scripts/lib/dispatch-routing-policy-io.mjs for the launch decision, or encode and validate its native-only authority constraint explicitly.
- Persist the chosen provider, model and effort; pass supported effort explicitly to the CLI.
- Test launch argv, unknown effort, critical scope and unavailable/quota-held provider behavior. Do not retry an indeterminate launch.

## Follow-ups

The 2026-09-30 launch audit deferred this adapter so repair routing could ship as one reviewable change. Prove its own lifecycle in a bounded dry run before widening defaults; preserve all existing guards.
