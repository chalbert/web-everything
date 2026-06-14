---
type: idea
locus: exercise-app
workItem: story
size: 3
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-14"
graduatedTo: loan demo S11 notifications + audit UI — domain/notifications.ts (event-routing NotificationStore), topbar bell, two trace event affordances; audit-trail consumed, notification declared as tagged GAP driving #358
tags: [exercise-app, loan-origination, audit, notifications, phase]
---

# Phase S11 — notifications + audit-trail UI

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Event-driven
notifications (state change, condition added, doc rejected) to the relevant actor, and an immutable
per-application audit trail (actor / timestamp / before-after) UI. See the
[requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/) (M9). Drives the
**audit-trail** candidate standard ([#357]).

## Progress — resolved 2026-06-13

- **`domain/notifications.ts`** — pure event→notification mapping: `stateChangeNotification` (routes to
  the actor who owns the next move, severity by terminal state), `conditionAddedNotification` (→
  assignee), `docRejectedNotification` (→ borrower), plus an in-memory `NotificationStore`
  (push/list/unreadCount/markAllRead/subscribe).
- **`app.ts`** — a topbar notification bell (unread badge) + dropdown listing every notification with a
  Status-Indicator severity chip; wired to three event sources: lifecycle transitions, and two new
  trace affordances ("Add PTD condition", "Reject a document"). Each event raises a routed notification
  **and** writes an actor-attributed AuditEvent with before/after `AuditChange`s to the shipping audit
  trail. The immutable per-application audit-trail UI (actor / timestamp / before-after) already renders
  via `auditTimelineHTML` (auditLifecycle records `/state` before→after on every transition).
- **Platform-first** — the audit-trail half **consumes** the active audit-trail block. Notifications are
  a **tagged GAP**: the WE `notification` block is still `draft` (no shipping runtime), so the app
  hand-rolls the region/store and declares `notification` in conformance.json, tagged
  `PLATFORM-GAP: #358` — the exercise app is the forcing function driving #358 to active. Conformance:
  **91% (10/11), 0 FAIL, 1 tagged GAP → compliant**.
- Also fixed an unquoted-colon YAML footgun in #386's `graduatedTo` (the `resolve` writer left it bare,
  which silently skipped the item from the loader).
- Gates: `tsc` clean, `check:app-conformance` compliant, `check:demos` + `check:standards` green.
