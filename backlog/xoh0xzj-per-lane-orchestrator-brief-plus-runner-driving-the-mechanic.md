---
kind: story
size: 5
parent: "2677"
status: open
blockedBy: ["xyr248a", "xyp63w5"]
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-27"
tags: []
---

# Per-lane orchestrator: brief plus runner driving the mechanical tick core for one lane

The DELEGATE half of #2677(b): a per-lane orchestrator (a delegated agent brief + runner under we:skills-src/conveyor/) that drives the mechanized tick core for ITS lane, so orchestration moves off the single serial main session out to the lanes. BLOCKED on the boundary decision #xyr248a (how much is pure mechanics vs per-lane agent autonomy) so the brief is written against a settled boundary, AND on #xyp63w5 (the mechanical core the orchestrator drives must exist first). Not batchable until #xyr248a ratifies.
