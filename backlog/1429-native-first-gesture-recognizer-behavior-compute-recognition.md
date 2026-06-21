---
kind: story
size: 5
parent: "1396"
status: open
blockedBy: ["1428"]
dateOpened: "2026-06-21"
tags: []
---

# native-first gesture recognizer behavior — compute recognition on Pointer Events + touch-action with DI override

Build the default gesture recognizer behavior for the #1428 gesture intent: native-first recognition computed on Pointer Events (+ multi-pointer for pinch/rotate) and touch-action / overscroll-behavior opt-outs, exposed as a behavioral DI / Ambient-Intent seam so the engine (native math vs Hammer.js vs @use-gesture) is swappable. Mirrors hover-intent keeping its mechanic out of the intent. Recognition only — effects live elsewhere (pinch→#1393 viewport, swipe→carousel paging, long-press→contextmenu/command, pan/drag→data-transfer/reorder).
