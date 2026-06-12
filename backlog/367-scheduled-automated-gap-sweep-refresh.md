---
type: idea
workItem: story
size: 3
parent: "315"
status: open
blockedBy: ["192", "366"]
dateOpened: "2026-06-12"
tags: []
---

# Scheduled / automated gap-sweep refresh

Graduate the manual gap-sweep re-run skill (#366) to a scheduled agent sweep that periodically re-runs the pipeline, reports the delta, and surfaces new candidate gaps — once the cadence has proven stable manually. Decided in #349: the automated half is a client of #192's freshness/automation mechanism, so it is gated on #192 (the general refresh engine) and #366 (the manual skill it automates). Until both land, refresh stays manual.
