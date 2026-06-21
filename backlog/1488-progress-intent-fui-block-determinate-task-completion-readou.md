---
kind: story
size: 3
status: open
blockedBy: []
dateOpened: "2026-06-21"
tags: []
---

# progress intent + FUI block — determinate task/completion readout (role=progressbar)

Realizing build for the #1469 ratification (Fork 2b): author the WE `progress` intent JSON adopting native `<progress>`/`role=progressbar` vocabulary verbatim (value, max; omit value → indeterminate, drops aria-valuenow; no min/zones — that is meter). Models a determinate task/completion readout decoupled from a pending/blocking lifecycle (profile % complete, course progress, fundraising goal). loader.progress and flow-progress compose it as consumers, not its home. FUI owns the rendered block; ship a demo. Codified rule: readout-placement-by-value-type. Low priority — common case is already covered by loader.progress.
