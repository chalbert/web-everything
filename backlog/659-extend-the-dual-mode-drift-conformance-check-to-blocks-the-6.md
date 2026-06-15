---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["658"]
dateOpened: "2026-06-15"
tags: []
---

# Extend the dual-mode/drift conformance check to blocks (the #606 plugs analogue for blocks)

Execute the conformance arm of the #641 ruling: extend the dual-mode/drift conformance check that #606/#649 established for plugs to cover blocks. Gate that WE's blocks.json block-protocol contracts stay content-equal with their canonical @frontierui/blocks impl (no silent drift, the #170 hazard), and that each block protocol's declared shape matches the impl it points at via sourcePath/implementedBy. Catches the re-divergence Fork 2 dedup closes, as an enforced check rather than a convention.
