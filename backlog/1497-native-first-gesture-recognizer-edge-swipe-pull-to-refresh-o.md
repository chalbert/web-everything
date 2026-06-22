---
kind: story
size: 3
parent: "1396"
locus: frontierui
status: resolved
blockedBy: ["1495"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/plugs/webbehaviors/gestureRecognizer.ts
tags: []
---

# native-first gesture recognizer — edge-swipe + pull-to-refresh + overscroll opt-outs

Slice D of #1429: edge-origin path gestures (edge-swipe, pull-to-refresh) layered on slice B (#1495) pan/swipe path tracking, adding edge-origin detection + overscroll-behavior opt-out. fui:plugs/webbehaviors/gestureRecognizer.ts (+edge/pull) + demo fui:demos/gesture-pull-refresh-demo.html.

## Progress

Cascade-freed by resolving #1495 this batch; landed (locus frontierui — locus field was missing, added), extending the #1495/#1496 engine:
- `fui:plugs/webbehaviors/gestureRecognizer.ts` — `EdgeGestureName='edgeswipe'|'pullrefresh'`, `EDGE_GESTURES`, `EdgeOrigin`; thresholds `edgeSizePx` (24) + `pullRefreshThresholdPx` (64); `RecognizedGesture` gains `edge`/`pullDistance`. Edge gestures layer on the slice-B pan/swipe path: on pointerdown the start point's host-edge band is recorded (`edgeOf`); a ballistic release that BEGAN at an edge emits `edgeswipe` (edge + direction); a downward top-edge drag past the threshold arms `pullrefresh` once (one-shot).
- `fui:plugs/webbehaviors/GestureAttribute.ts` — `parseGestures` accepts the edge tokens; an edge gesture adds `overscroll-behavior: contain` (restored on teardown) so the browser's native overscroll/pull-to-refresh doesn't interfere.
- `fui:demos/gesture-pull-refresh-demo.html` + `.ts` — a pull-to-refresh pad (top-edge pull) + an edge-swipe pad (left-edge drawer).
- Tests: +4 edge cases (25 in the engine suite, 137 webbehaviors total, green); `check:standards` (frontierui) 0 errors.
