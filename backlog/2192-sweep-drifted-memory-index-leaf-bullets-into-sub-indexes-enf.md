---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Sweep drifted memory-index leaf-bullets into sub-indexes + enforce check:memory in the gate

The always-loaded memory map (we:.claude/agent-memory/MEMORY.md) has accumulated ~27 flat leaf-link bullets that belong in their category sub-indexes — the exact tree-shape violation the check:memory SWEEP already flags but nothing enforces (the check is a package script, not in check:standards, and is currently red). Relocate all ~27 into their we:.claude/agent-memory/index-dec.md-style sub-indexes; fix the ~4 malformed numbered entries (#139–142 use bare-slug leaf files plus inline links, tripping the numbered-ref check that expects an N-slug filename — pick one convention). Then wire check:memory into check:standards (or close-out) so the sweep actually gates, now that it can go green. The write-time pre-hook was extended in the #2096 session to block NEW drift; this clears the existing backlog and turns on absolute enforcement.
