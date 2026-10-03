---
bornAs: xmob37p
kind: story
status: open
size: 3
parent: "4733"
scope: ["we:scripts/lib/dispatch-routing-policy.json"]
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Make the plateau dev panel model launch an explicit policy choice

The sibling dev panel at we:../plateau-app/tools/dev-panel/vite-plugin.ts starts Claude directly via streamClaudeResponse. Provide a policy bridge or a documented interactive native-only operation with explicit model/effort records. This card is tracked in WE; implementation changes in the sibling require its own checkout.

## Done when

- Use we:scripts/lib/dispatch-routing-policy.json and we:scripts/lib/dispatch-routing-policy-io.mjs for the launch decision, or encode and validate its native-only authority constraint explicitly.
- Persist the chosen provider, model and effort; pass supported effort explicitly to the CLI.
- Test launch argv, unknown effort, critical scope and unavailable/quota-held provider behavior. Do not retry an indeterminate launch.

## Follow-ups

The 2026-09-30 launch audit deferred this adapter so repair routing could ship as one reviewable change. Prove its own lifecycle in a bounded dry run before widening defaults; preserve all existing guards.
