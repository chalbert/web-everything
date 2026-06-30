---
kind: story
size: 3
parent: "1963"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
tags: []
---

# Case 9 portal — cross-browser moveBefore() fallback (Safari-blocked)

Case 9 (teleport/portal) state-preserving reparent uses Node.moveBefore() — Chrome 133 and Firefox 144, but Safari unsupported (blocks Baseline). Add a feature-detected fallback (moveBefore in Element.prototype, else insertBefore) so the logical portal degrades gracefully cross-browser. Ratified under #1963.
