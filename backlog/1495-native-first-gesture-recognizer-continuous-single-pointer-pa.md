---
kind: story
size: 3
parent: "1396"
locus: frontierui
status: resolved
blockedBy: ["1429"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: frontierui/plugs/webbehaviors/gestureRecognizer.ts
tags: []
---

# native-first gesture recognizer — continuous single-pointer pan + swipe

Slice B of #1429: pan + swipe recognizers on setPointerCapture + pointermove velocity/direction tracking, dispatched through the #1429 GestureAttribute/engine. fui:plugs/webbehaviors/gestureRecognizer.ts (+pan/swipe) + demo fui:demos/gesture-pan-swipe-demo.html.

## Progress

Landed (locus frontierui; locus field was missing — added):
- `fui:plugs/webbehaviors/gestureRecognizer.ts` — `ContinuousGestureName='pan'|'swipe'`, `CONTINUOUS_GESTURES`, `SwipeDirection`; thresholds `swipeVelocityPxPerMs` (0.5) + `swipeMinDistancePx` (30); `RecognizedGesture` gains optional kinematics (`deltaX/Y`, `velocityX/Y`, `direction`). Native engine promotes a past-tolerance move to a **pan** (cancelling tap/long-press), emits per-sample velocity, `setPointerCapture` for off-host tracking, and on a ballistic release (speed ≥ threshold ∧ travel ≥ min) emits a **swipe** with dominant-axis direction. A pan/swipe never also emits a tap.
- `fui:plugs/webbehaviors/GestureAttribute.ts` — `parseGestures` now validates pan/swipe tokens; `touch-action: none` (vs `manipulation`) when a continuous gesture is requested so the drag is owned; `#dispatch` already forwards kinematics into `event.detail`.
- `fui:demos/gesture-pan-swipe-demo.html` + `.ts` — three pads (pan / swipe / pan+swipe); puck tracks live pan delta, swipe pad shows direction arrow + release velocity.
- Tests: +6 continuous-recognition cases (16 in the engine suite, 128 webbehaviors total, green); `check:standards` 0 errors.
