---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "project:webnotifications"
tags: []
---

# Author the webnotifications project + push-delivery protocol (notification domain home)

Ratified in #009 (domain home) and #455 (by-purpose transport): mint the webnotifications project as the notification domain home — owning the notification orchestration concern (which surface, grouping, dedup) and the closed-app push-delivery protocol (Web Push API native anchor, CustomPushProvider seam for FCM/OneSignal/Novu hubs). It coordinates the render-intent family (system-notification, notification-marker) which publish standalone in webintents. Author the we:projects.json entry, the protocol contract + capability matrix, and the orchestration config surface.
