---
kind: story
size: 8
priority: low
parent: "2531"
status: open
scope: ["plateau:src/build-runner/"]
dateOpened: "2026-07-28"
tags: []
---

# Reliable per-build cost metering, attribution, model-tier policy and audit log

The foundation slice of the SaaS cost-governance epic: replace the unreliable, non-persisted costUsd counter (plateau:src/build-runner/events.ts, discarded at plateau:src/build-runner/build-action.ts) with a durable per-build cost record attributed to tenant + item + run. Folds model-tier cost policy (per-plan model + ceiling, wired to the runner --model hook / plateau:src/build-runner/profiles.ts) and the durable queryable audit/billing log, both of which read metering. Blocks the per-tenant budget-gate slice.
