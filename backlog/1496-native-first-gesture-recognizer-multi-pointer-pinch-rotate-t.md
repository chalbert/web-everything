---
kind: story
size: 5
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

# native-first gesture recognizer — multi-pointer pinch + rotate + two-finger-pan

Slice C of #1429: multi-pointer recognizers (pinch, rotate, two-finger-pan) via two-pointer tracking + centroid/distance/angle math, dispatched through the #1429 GestureAttribute/engine; the heaviest recognizers. fui:plugs/webbehaviors/gestureRecognizer.ts (+multi-pointer) + demo fui:demos/gesture-pinch-rotate-demo.html.

## Progress

Landed (locus frontierui — locus field was missing, added), extending the #1495 engine:
- `fui:plugs/webbehaviors/gestureRecognizer.ts` — `MultiPointerGestureName='pinch'|'rotate'|'twofingerpan'`, `MULTI_POINTER_GESTURES`; `RecognizedGesture` gains optional `scale`/`rotation`/`centroidX/Y`/`centroidDeltaX/Y`. The native engine now tracks ALL pointers in a `Map`; a second pointer (when a multi gesture is requested) cancels the single-pointer interaction and seeds a two-pointer baseline (distance/angle/centroid). Each move emits `pinch` (current÷initial distance), `rotate` (shortest-signed degrees turned), and/or `twofingerpan` (centroid travel); a lifted finger ends the gesture. Best-effort pointer capture on both pointers.
- `fui:plugs/webbehaviors/GestureAttribute.ts` — `parseGestures` now accepts the multi-pointer tokens; `touch-action: none` applies for multi gestures too (own the two-finger interaction).
- `fui:demos/gesture-pinch-rotate-demo.html` + `.ts` — three pads (pinch scales a box, rotate turns it, combo composes scale+rotate+translate).
- Tests: +5 multi-pointer cases (21 in the engine suite, 133 webbehaviors total, green); `check:standards` (frontierui) 0 errors.
