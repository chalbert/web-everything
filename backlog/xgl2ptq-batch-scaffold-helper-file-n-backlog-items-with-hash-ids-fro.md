---
kind: story
size: 2
status: open
dateOpened: "2026-07-18"
tags: []
---

# Batch-scaffold helper — file N backlog items with hash ids from one spec

scaffold is one-item-at-a-time, so filing a large red-teamed set (14 items, #558) tempted a hand-authored batch with hand-numbered ids — the sanctioned-path bypass that caused the collision and corruption. Add a batch mode that mints hash ids for N items at once from a single spec input, wires their cross-refs by hash, and writes standards-shaped files — so filing a whole program set uses hash ids with no per-item friction and no incentive to hand-number.
