---
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Subagent-stall harness backstop — detect + auto-clear a stuck background-wait subagent (the reap/detect + regression AC #2833 deferred)

#2833 shipped only the delivery-path half of the subagent-stall fix (synchronous verify wrapper + `.lane-verify` marker + pr-land finish-guard + a PreToolUse(Bash) guard against backgrounding it). Two ACs are NOT delivered and are tracked here: (a) the harness/orchestrator DETECTING a subagent blocked on a never-advancing background wait past a threshold and REAPING (fail + reclaim its lane) or RESUMING it; (b) a regression reproducing a stalled build subagent and proving it clears automatically with its lane freed. Both lean on agent-runtime capability largely out of in-repo scope, so #2833 split them off rather than claim them.

## Definition of done

- A subagent blocked on a background wait past a threshold is auto-detected and reaped or resumed, with no main-session intervention.
- A regression reproduces the stalled-build-subagent scenario and proves it is cleared automatically and its lane freed.
