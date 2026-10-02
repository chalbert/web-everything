---
kind: story
status: open
size: 3
parent: "x6gouf0"
scope: ["we:scripts/lib/judge-panel.mjs"]
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Expose native juror effort and model policy without changing authority

Mandatory jurors stay native Claude at high care under #4374. Make their native-only model and effort choices explicit in policy and records; reject provider edits that would change review authority. Include the direct judge-spawn adapter and the jury panel-fanout caller.

## Done when

- Use we:scripts/lib/dispatch-routing-policy.json and we:scripts/lib/dispatch-routing-policy-io.mjs for the launch decision, or encode and validate its native-only authority constraint explicitly.
- Persist the chosen provider, model and effort; pass supported effort explicitly to the CLI.
- Test launch argv, unknown effort, critical scope and unavailable/quota-held provider behavior. Do not retry an indeterminate launch.

## Follow-ups

The 2026-09-30 launch audit deferred this adapter so repair routing could ship as one reviewable change. Prove its own lifecycle in a bounded dry run before widening defaults; preserve all existing guards.
