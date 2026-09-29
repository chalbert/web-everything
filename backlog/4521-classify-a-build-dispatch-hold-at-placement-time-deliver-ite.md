---
bornAs: xmrsucc
kind: story
size: 3
status: open
blockedBy: ["4465"]
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/conveyor/build-dispatch-hold-router.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Classify a build-dispatch hold at placement time (deliver-item-wrapper), not only on the daemon's next tick

#4465's MVP routes a held build-dispatch item on the daemon's NEXT tick sweep (up to ~2 minutes later), by classifying we:scripts/conveyor/build-dispatch-hold-router.mjs#classifyHoldReason over every LIVE hold each tick. It never touches we:scripts/operations/deliver-item-wrapper.mjs's own placeBuildDispatchHold call site (deliberately dropped from #4465's scope — a 2497-line, six-firm-requirements, live-critical file). A same-tick, immediate classify-and-route AT the wrapper's own hold-placement call would close the last few minutes of latency, if ever worth the added risk to that file.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
