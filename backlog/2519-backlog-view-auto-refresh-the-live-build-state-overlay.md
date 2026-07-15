---
bornAs: xr0ne0l
kind: story
size: 3
parent: "2505"
status: resolved
blockedBy: ["2509"]
dateOpened: "2026-07-15"
dateResolved: "2026-07-15"
graduatedTo: none
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: auto-refresh the live build-state overlay

Keep the live build-state overlay current without a manual reload. Once the overlay slice shows per-item pipeline state (claimed / queued / PR / CI / merged), that state goes stale the moment a lane advances; this polls the live seam on an interval and reconciles each row's overlay in place. Read-only.

**Acceptance:** overlay state refreshes on a bounded interval while the view is open; refresh pauses when the tab is hidden and resumes on focus; a failed poll degrades quietly (keeps the last-known state), never blanking the list.
