---
kind: story
size: 5
parent: "099"
status: open
relatedTo: ["1406", "1396", "1384"]
dateOpened: "2026-06-21"
tags: [build, selection, marquee, spatial, gesture, behavior-block]
---

# Author the marquee-select behavior block (selection + gesture, intersect default)

Realizing build for ratified #1406 Fork-1(a): author a marquee-select behavior block composing selection + the gesture pan recognizer. Owns band geometry + AABB hit-testing over getBoundingClientRect (Pointer Events + setPointerCapture, never HTML DnD), selection-mode dimension (mode: intersect | contain | center, intersect default per Fork 2), modifier vocab (replace | add Shift | toggle Ctrl/Cmd | subtract Alt), drag threshold + edge auto-scroll. Forced a11y-parity invariant: a keyboard equivalent (APG Listbox/Grid Shift+Arrow range-extend, Ctrl+Space toggle, WCAG 2.5.1) that produces the same selection set via model: multiple. Recognizer engine = native math default + DI override + Configurator card, no protocol minted (minimize-lock-in). Ship a demo over a file-grid / board surface. File via /new-standard.
