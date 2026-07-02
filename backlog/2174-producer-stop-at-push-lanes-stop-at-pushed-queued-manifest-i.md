---
kind: story
size: 5
parent: "2162"
status: open
blockedBy: ["2172"]
dateOpened: "2026-07-02"
tags: []
---

# Producer stop-at-push: lanes stop at pushed+queued+manifest instead of integrating inline

The other half of the #2162 relocation. Wire the /workflow orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js Phase 4) and solo #2123 lanes to STOP at 'lane pushed + we:scripts/backlog.mjs queue + we:.lane-manifest.json written' rather than merging inline — so the deferred drain (#2173) owns all landing. Gated behind the drain core being proven.
