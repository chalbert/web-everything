---
bornAs: xzdgabp
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-smells/machine-overload.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/__tests__/machine-overload.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Health-watch sign: machine-overload (name the culprit process tree)

Live incident 2026-09-26 ~10:34-10:55 ET: an orphaned scratchpad/spawn-hog2.sh (reparented to launchd) forked ~50 copies each spawning `node -e 1` in a loop; load hit 293 with 0% idle, the drain's pass took 19 min (normally ~1), and nothing flagged it. Build a health-watch sign `machine-overload` in we:scripts/conveyor/health-smells/, following the #4077 framework (see we:scripts/conveyor/health-smells/claude-auth-expired.mjs / PR #2717 for the notifyEvenInShadow pattern). Trigger: sustained loadavg-per-core above a threshold (e.g. 3) for >=2 consecutive checks (openAfter:2), or idle CPU near 0. The episode NAMES the culprit: group live processes by process tree (root ancestor, or command pattern) and report the top trees by process count and CPU, e.g. '50 x /bin/sh .../spawn-hog2.sh (orphaned, parent launchd) spawning node -e 1'. Flag orphaned process trees (parent pid 1) whose command lives in a scratch/tmp dir as a likely runaway. Notify the operator even in shadow mode (notifyEvenInShadow: true); the proposed action names the tree + root pid ('stop tree <pid>') but the watch never kills anything itself. Proof: vitest red->green with a real-shaped `ps -Ao pid,ppid,pcpu,etime,command` fixture reproducing the incident, plus a live read-only health tick on the real machine (normal load, no episode) and the same tick fed the incident fixture (episode opens).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
