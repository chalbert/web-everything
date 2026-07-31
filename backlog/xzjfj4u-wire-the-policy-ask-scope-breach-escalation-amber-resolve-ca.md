---
kind: story
size: 3
parent: "2555"
status: open
dateOpened: "2026-07-31"
tags: [plateau-loop, console, console-board, scope-lease, canonical-2554]
---

# Wire the policy=ask scope-breach escalation (amber Resolve card)

When a lane's scope-lease carries policy=ask, promote a paused scope-breach from the ratified agent-state (#2574 default) to an amber human card with a Resolve verb + resolve-at-drain plumbing; needs a live policy/retry-count signal in the scope-lease read-model first. Deferred out of #2792 (chrome-consistency) because #2574 keeps agent-state the default.
