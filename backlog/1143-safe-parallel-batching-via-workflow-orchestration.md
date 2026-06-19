---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-19"
tags: []
---

# Safe parallel batching via Workflow orchestration

Make /batch --parallel run on the Workflow tool safely. Keystone: a single orchestrator owns all shared-registry writes (lane agents touch only their own code + their own `we:backlog/NNN.md`, returning a registry-effects manifest applied by one serial integrator). Plus the two enablers — split high-churn monolithic registries to per-entry files (the `we:src/_data/blocks/` precedent), and split gating by KIND (per-lane = ~35 LOCAL file-isolation checks; per-merge = full ~60 GLOBAL/RELATIONAL checks). Slice S1 (gate --local mode, #1144), S2/S3 (registry splits, #1145/#1146), S4 (orchestrator + --parallel wiring, #1147). Design grounded in the `we:scripts/check-standards.mjs` check map + a registry churn survey.
