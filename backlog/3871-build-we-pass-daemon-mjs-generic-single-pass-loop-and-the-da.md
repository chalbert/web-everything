---
bornAs: x3fixx3
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/pass-daemon.mjs", "we:skills-src/conveyor/daemon-manifest.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Build we:pass-daemon.mjs (generic single-pass loop) and the daemon manifest schema

New generic wrapper: we:skills-src/conveyor/pass-daemon.mjs runs ONE mechanical pass script on its own interval, under a singleton lock, with its OWN heartbeat on an independent timer (not only between iterations, so a long-running pass like we:scripts/conveyor/infra-blocked.mjs's unlocked resumeOpen call, which can legitimately block for minutes, doesn't silently stall the daemon's own liveness signal the way today's single shared lease does). Its script argument resolves ONLY from a closed allowlist (a manifest file, we:skills-src/conveyor/daemon-manifest.mjs) -- never an arbitrary path -- covering every entry any daemon launcher in this epic can start, not just the watcher passes. This is foundational for we:3860's sibling watcher-wiring slice and for the Supervisor manifest launcher slice; it introduces no changes to any existing pass script. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
