---
bornAs: xyp63w5
kind: story
size: 5
parent: "2677"
status: resolved
scope: ["we:scripts/conveyor/", "we:scripts/readiness/", "we:skills-src/conveyor/SKILL.md"]
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Mechanize the conveyor tick core into a tested state machine (dispatch orchestration + the three guards + watcher arming)

Extract the deterministic per-tick orchestration the /conveyor SKILL prose runs today (we:skills-src/conveyor/SKILL.md sections 2-3: chain state-read to dispatch-plan, filter launches through the in-flight/prepare/fix guards, arm watchers, retire guards on TTL/PR-terminal/re-dispatch-gate, idle-stop) into a PURE tested tick-plan module under we:scripts/conveyor/ that mirrors the pure-core/IO-shell pattern of we:scripts/readiness/dispatch-plan.mjs + we:scripts/readiness/conveyor-state.mjs. Given the state read, the dispatch plan, and the current guard/watcher bookkeeping it returns the tick's mechanical decisions (spawn, armWatchers, retireGuards, idleStop, statusLine); the SKILL then only EXECUTES spawns/watches and stops re-deriving guard retirement/TTL/re-dispatch gates in prose. The keystone MECHANIZE half of #2677(a); builds on #2609/#2607.
