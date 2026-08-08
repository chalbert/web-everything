---
bornAs: xku0t6u
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: []
---

# Harvest may defer a cluster whose cause is not yet clear

Fork 4 of #2978 rules that a harvest need not drain the whole pool. Archiving is per session FILE today (archivePool in we:scripts/conveyor/learnings-harvest.mjs), and archived entries are unrecoverable, so a file mixing acted-on and deferred notes is all-or-nothing. Keep the append-only design: archive as today, then re-emit deferred clusters as a fresh deferred-<stamp>.jsonl carrying the deferral reason and count. A repeatedly-deferred cluster surfaces as its own finding.
