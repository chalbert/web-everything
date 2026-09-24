---
bornAs: xi58xoz
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/", "we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Child-call timeouts and an outside heartbeat check for every resident daemon

Ruling #3681, we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 6. A per-tick budget cannot fire inside a synchronous execFileSync, so on 2026-09-23 an unreviewed we:scripts/lane-pool.mjs change hung the fix daemon's tick for more than 5 minutes and nothing noticed. Put a timeout on every child call a daemon tick makes, and add a check outside the daemon that its heartbeat keeps moving and alerts when it stalls. The overlay rollback builds on this check.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
