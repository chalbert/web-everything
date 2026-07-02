---
kind: story
size: 3
parent: "2162"
status: open
blockedBy: ["2172"]
dateOpened: "2026-07-02"
tags: []
---

# Drain monitor/watch loop: poll the queue, order by cross-item blockedBy, drain ready couples serially

The #2162 drain's outer loop. Poll we:.claude/skills/batch-backlog-items/queued.json, resolve cross-item blockedBy order from each we:.lane-manifest.json, drain each ready couple serially via the #2172 drain-one-couple core, and regenerate WE derived artifacts once at the end (the Phase 4c relocation). Human-launched (watch or one-shot).
