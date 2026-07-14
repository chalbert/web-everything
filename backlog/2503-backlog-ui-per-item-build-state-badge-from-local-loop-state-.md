---
bornAs: xgzsf63
kind: story
size: 3
parent: "2472"
status: resolved
dateOpened: "2026-07-14"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, backlog-ui]
---

# Backlog UI: per-item build-state badge from local loop state (L1 — backlog-driven console)

First increment of the operator's "backlog driven from the UI" vision (the #2474 morph, tracked under #2472). The WE `/backlog/` tracker now shows a per-item **build-state badge**, joined defensively from the batch skill's local loop-state files (`we:.claude/skills/batch-backlog-items/claims.json` + `we:.claude/skills/batch-backlog-items/queued.json`) the same way `we:.claude/skills/batch-backlog-items/reservations.json` is already joined in `we:src/_data/backlog.js` — deriving `resolved > queued > claimed > status` per item. The change is purely additive: nothing new renders when the files are absent, and the badge shows on both the tile and the detail page (tile ⊆ detail parity). It establishes the build-state badge vocabulary that the later live-remote overlay (L2) extends.

**Delivered by** WE PR #502.
