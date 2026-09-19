---
bornAs: x25vnei
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/driver-watchdog.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# Design a stray-resource safety net: idle peer sessions + orphaned watchers past target resolution

Design (do not build) a monitoring safety net that catches two classes of stray agent resource as defense-in-depth, NOT a replacement for the landed behavioral fix (agents must stop their own watchers before reporting done; see we:agent-memory-src/no-stray-sessions-or-orphaned-watchers.md): (a) peer Claude sessions that have existed a long time with zero dispatched work ever, and (b) background watch/monitor processes whose target (a PR, a delivery item) has already resolved/completed. Investigated 2026-09-13: this needs data from a layer we:scripts/conveyor/session-reaper.mjs and we:scripts/conveyor/driver-watchdog.mjs cannot reach today — both only read `claude agents --json` and the conveyor's own queue/lease files, neither of which records whether a session was ever handed real work or whether a watcher's target already resolved. The candidate data source is the per-session state file each job saves under ~/.claude/jobs/<sessionId>/ (its inFlight block: tasks, drainableMonitors, tempo, createdAt) — but this was stress-tested and found NOT reliably live: a session that had genuinely stopped its own background poller still showed tasks:1 in its saved state afterward. A real design is needed, likely requiring a pid-level liveness cross-check before acting on stale-looking state, not a quick bolt-on. Not dev-ready; do not implement until a design is ratified.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
