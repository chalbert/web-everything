---
kind: story
status: open
size: 3
parent: "x6gouf0"
scope: ["we:scripts/conveyor/health-investigate-dispatch.mjs"]
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Add a policy-selected non-Claude health investigation adapter

This site already reads the policy through dispatch-lane. Its lane-less read-only contract has only a native adapter, so an unavailable Codex adapter takes the declared Claude fallback. Add an equivalent read-only adapter before widening its provider set.

## Done when

- Use we:scripts/lib/dispatch-routing-policy.json and we:scripts/lib/dispatch-routing-policy-io.mjs for the launch decision, or encode and validate its native-only authority constraint explicitly.
- Persist the chosen provider, model and effort; pass supported effort explicitly to the CLI.
- Test launch argv, unknown effort, critical scope and unavailable/quota-held provider behavior. Do not retry an indeterminate launch.

## Follow-ups

The 2026-09-30 launch audit deferred this adapter so repair routing could ship as one reviewable change. Prove its own lifecycle in a bounded dry run before widening defaults; preserve all existing guards.
