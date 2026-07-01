---
kind: story
size: 3
parent: "1522"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Explorer: real focus-trap oracle (replace the tabbable<=1 heuristic)

The noStuckFocus oracle only fires when a page has <=1 tabbable element total — it misses real modal/dialog focus traps. Detect a genuine trap by walking Tab within a container scope.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — the existing noStuckFocus oracle was verified as a stub (fires only on ≤1 tabbable total). Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
