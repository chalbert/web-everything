---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "intent:permission"
tags: []
---

# Author the permission intent (cross-cutting Permissions API state)

Ratified in #009 Fork A: a small cross-cutting permission intent owning the Permissions API tri-state (granted|denied|prompt) plus change events and the request/re-prompt affordance — spanning camera/geolocation/clipboard/notifications, not notification-specific. Borrows the W3C Permissions API tokens verbatim. Publishes standalone in webintents; explicitly NOT folded into feedback (state vs render axis, far broader breadth).
