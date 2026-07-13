---
bornAs: xpqrhnk
kind: story
size: 5
parent: "2445"
status: open
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: rewrite the parallel orchestrator as plain Node fan-out over the runner interface

Replace the Claude-Code-coupled Workflow-sandbox orchestrator with plain Node fan-out over the runner interface — removing today's inline-mirror duplication of we:scripts/readiness/lane-partition.mjs. Gated on the runner decision (#2444).
