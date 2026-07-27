---
bornAs: xoh0xzj
kind: story
size: 5
parent: "2677"
status: open
blockedBy: ["2701", "2699"]
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-27"
tags: []
---

# Per-lane orchestrator: brief plus runner driving the mechanical tick core for one lane

The DELEGATE half of #2677(b): a per-lane orchestrator (a delegated agent brief + runner under we:skills-src/conveyor/) that drives the mechanized tick core for ITS lane, so orchestration moves off the single serial main session out to the lanes. BLOCKED on the boundary decision #2701 (how much is pure mechanics vs per-lane agent autonomy) so the brief is written against a settled boundary, AND on #2699 (the mechanical core the orchestrator drives must exist first). Not batchable until #2701 ratifies.
