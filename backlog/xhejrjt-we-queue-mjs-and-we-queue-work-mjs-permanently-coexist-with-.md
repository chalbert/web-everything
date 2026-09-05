---
kind: task
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: []
---

# we:queue.mjs and we:queue-work.mjs permanently coexist with the same add/remove/list verb surface

#3478 added we:scripts/conveyor/queue-work.mjs alongside the existing we:scripts/conveyor/queue.mjs — same add/remove/list verbs, different checkout-resolution strategy (runner-lock-derived vs. cwd/script-location). #3478's own text left retiring or merging them an open implementation call for whoever builds this (#3478 review round 3, simplicity finding). Decide whether we:queue.mjs should be retired in we:queue-work.mjs's favor, kept as a deliberate fast-path for a caller who already knows their checkout is correct, or merged into one CLI with a flag.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
