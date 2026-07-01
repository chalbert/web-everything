---
kind: story
size: 2
status: open
dateOpened: "2026-07-01"
tags: []
---

# Prioritisation tab batchable count includes priority:low — inconsistent with demote-not-hide (#1620/#1622)

The prioritisation tab's batchable count (fui? no — we:src/_data/backlog.js:368 'item.batchable = tier A && batchShape && !stopTheWorld', surfaced as countBatch in we:src/backlog.njk) counts every Tier-A task/story<=8 INCLUDING priority:low items. But #1622 ratified priority:low as demote-from-auto-select: the readiness engine (we:scripts/readiness/engine.mjs) excludes them into a filler group. So the tab shows ~14 batchable while check:readiness --select recommends 2 (the 11-item gap is all priority:low: #1633,#1637-1650,#1733,#1853). Fix: subtract priority:low from the tab's batchable/countBatch (or split a visible filler sub-tally) to match the engine. Gate must stay green.
