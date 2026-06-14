---
type: idea
locus: exercise-app
workItem: story
size: 3
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: notification
tags: [exercise-app, auto-insurance, documents, notifications, audit, phase]
---

# Phase S10 — documents, notifications & audit

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). Document
handling (upload/generate: dec page, ID cards, claim docs), event-driven notifications (bound, referred,
claim status), and an immutable **audit trail** per policy and per claim. See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M11). **Consumes:**
audit (lifecycle + decision events auto-feed it); **drives:** file handling, Web Reporting.

## Progress (resolved 2026-06-14)

Two of the three S10 surfaces were already in place from earlier slices; this phase added the missing one:

- **Documents (already present)** — policy issuance generates the declarations page + ID card(s)
  (`issuePolicyDocuments`, bound → in-force), and the FNOL claim form takes docs via a native
  `<input type=file>` (the richer upload UX is the standing `file-upload` gap #028). No change needed.
- **Audit (already present)** — per-policy (`bookAudit`) and per-claim (`claimAudit`) immutable trails,
  both auto-fed by `auditLifecycle` on every lifecycle transition, rendered via the audit-timeline block.
- **Notifications (added)** — the missing surface. New
  [demos/auto-insurance/domain/notifications.ts](../demos/auto-insurance/domain/notifications.ts): a pure
  event→notification mapping (`policyStateNotification` for bound/referred/…, `claimStateNotification` for
  claim status) routing each to the relevant actor (policyholder/agent/underwriter/adjuster) with a
  severity, plus an in-memory `NotificationStore`. [app.ts](../demos/auto-insurance/app.ts) adds a topbar
  bell + dropdown (unread badge, mark-read on open) and pushes a notification on every policy transition
  (bind → bound, issue → in-force, UW decision → referred/quoted/declined) and every claim transition.
  The notifications auto-feed off the SAME lifecycle transitions the audit trail records, so the two stay
  consistent.

**PLATFORM-GAP #358** — the `notification` standard is still `draft` (no shipping runtime), so the surface
is hand-rolled and tagged as the gap this app drives (the second consumer after loan app A's S11),
declared in `conformance.json` so the gate registers it as a GAP rather than an untracked bypass.

Gate: `check:standards` 0 errors; `check:app-conformance --app=demos/auto-insurance` **compliant** —
12/13 OK, 0 FAIL, the lone GAP being `notification` (gap-consuming-draft, correctly tagged). Demo
typechecks clean. Smoke (Playwright, live `:3000`): a UW Approve fires the real lifecycle transition,
the bell badge goes 0 → 1, and the dropdown shows "Policy PA-100016 moved to quoted" — no console errors.
