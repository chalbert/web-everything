---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/notification/NotificationRegionElement.ts"
tags: []
---

# Activate the notification block — runtime + draft→active (exercise-app driven)

The exercise-app loop (loan origination #317) drove the in-page notification block from draft to active. Built the runtime in fui:blocks/notification/ — `NotificationRegionElement` (the `<notification-region>` top-layer host via the Popover API + an imperative show/dismiss controller) over a DOM-free fui:blocks/notification/policy.ts (severity→politeness/role, severity-defaulted timeout forced indefinite by an action, stackLimit replace-vs-queue), with 18 unit tests. Flipped we:src/_data/blocks/notification.json to active + implementedBy + exports + events map. The loan app consumes it — each event raises a transient toast via the controller; the persistent bell inbox stays a distinct log. Conformance: loan app 13/13, browser-verified. Distinct from the webnotifications push-delivery project (#1024).
