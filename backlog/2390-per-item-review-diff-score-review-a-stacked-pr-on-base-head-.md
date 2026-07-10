---
kind: story
size: 3
parent: "2387"
status: open
blockedBy: ["2389"]
dateOpened: "2026-07-10"
tags: []
---

# Per-item review diff: score/review a stacked PR on base...head, not vs main

Compute the escalation score + reviewer-subagent input in we:scripts/merge-ai-prs.mjs as base...head (from the manifest base) instead of vs main, so a stacked PR is reviewed on its OWN delta — killing cumulative-diff blast-radius inflation and spurious review:human inheritance from ancestors. Tests: a deep stacked PR scores on its own change, not the cumulative stack; no spurious review:human inherited from an ancestor.
