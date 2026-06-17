---
type: idea
workItem: task
parent: "623"
status: open
blockedBy: ["826"]
dateOpened: "2026-06-17"
tags: []
---

# Backfill webStandards a11y metadata on the blocks still missing it (46/75)

Authoring task: populate the optional webStandards field ({concern:{usage,reference}}) on the ~46 of 75 blocks that lack it, so the #826 Accessibility & Web Standards panel renders for them too. Per the #803 ruling, sparse coverage is a prioritisation input for WHEN to author, not a branch of the sourcing decision — separately prioritised, lands incremental value once the panel (#826) ships. Each concern's reference should point at the contract (MDN/APG/WAI), matching the existing 29/75 (e.g. wizard.webStandards at blocks.json:25).
