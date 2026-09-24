---
kind: story
size: 3
parent: "3383"
status: open
blockedBy: ["xt8j3yk"]
scope: ["we:scripts/operations/runner-activity.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Heartbeat publishes each daemon's running revision and active overlays

Ruling #3681, we:docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle clause 6. Record the boot input heads (per repo: origin/main sha and each overlay head) in the daemon's heartbeat or lease record, and have we:scripts/operations/runner-activity.mjs report them for every daemon listed in DAEMON_MANIFEST (we:skills-src/conveyor/daemon-manifest.mjs), so an operator can read 'running abc plus overlay X, clone at def'. bootSha appears nowhere today. #3756 reads the same record.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
