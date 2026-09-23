---
bornAs: xvzwiew
kind: task
parent: "3963"
status: open
scope: ["we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# review daemon hits spawnSync claude ENOENT dispatching frontierui reviews

The 2026-09-23 multi-repo audit saw the review daemon log spawnSync claude ENOENT for a frontierui review while web-everything and plateau-app dispatched fine. An ENOENT from spawnSync is also what a missing cwd produces, not only a missing binary -- check the cwd the frontierui dispatch spawns claude in, then fix whichever it is.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
