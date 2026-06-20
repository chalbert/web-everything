---
kind: story
size: 3
status: resolved
blockedBy: ["456"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "intent:notification-marker"
tags: []
---

# Author the notification-marker intent family (favicon / title / app-icon badge)

Spun out of #009: a notification-marker intent for unread-count indicators across surfaces — favicon badge, document.title count, and the app-icon Badging API (navigator.setAppBadge). Models the count/clear lifecycle and per-surface graceful degradation (favicon + title everywhere; Badging API where supported). Publishes standalone in webintents; coordinated by the webnotifications domain (#456) alongside system-notification.

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `notification-marker` intent as a new entry in
[we:src/_data/intents.json](../src/_data/intents.json) (catalog auto-renders it — verified live at
`/intents/notification-marker/`).

- **Framing** — a *marker* (ambient count/dot on app chrome), explicitly **not** a message surface like
  Feedback / System Notification; a new item composes both (update the marker AND maybe notify).
- **Dimensions** — `surface` (open set: `favicon` / `title` / `app-badge`, ordered by reach — favicon +
  title everywhere, app-badge needs Badging API support so it degrades first) and `marker` (`count`
  numeric, capped; `flag` presence dot = `setAppBadge()` no-arg).
- **Lifecycle** — single `set(count)` / `clear()` model fanning out to every available surface;
  unsupported surfaces silently skipped (graceful degradation), `0` clears, idempotent.
- **Platform anchors** — Badging API (`navigator.setAppBadge`/`clearAppBadge`), favicon overlay,
  `document.title` prefix. Events: `set` / `clear`. Sibling to #459 (system-notification) — together the
  two halves of the #009 webnotifications split.
