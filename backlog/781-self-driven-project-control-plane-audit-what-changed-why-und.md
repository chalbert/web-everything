---
type: idea
workItem: story
size: 3
parent: "666"
status: resolved
blockedBy: ["674"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: "plateau-app: src/control-plane/audit-view.ts"
tags: []
---

# Self-Driven Project control plane — audit / what-changed-why-undo view (plateau-app)

Sibling panel of the control-plane shell (#674). Render the immutable audit trail (AuditEntry{action,actor,reason,at} plateau:src/profiles/gate-enforcement.ts:45, audit() :124) + reversibility model (plateau:src/technical-configurator/seed-change-tracking.ts:82) as plain what-changed / why / undo-ability. New plateau:src/control-plane/audit-view.ts on the mountProfiles pattern. plateau-app product layer (#091).

## Progress (resolved 2026-06-16) — locus: plateau-app
- New `plateau:src/control-plane/audit-view.ts`: pure model — `auditRow()` projects each immutable `AuditEntry` into plain `{ what, gateId, who, why, at }` and annotates **undo-ability** from the reversibility axis of `changeTrackingDomain` (`plateau:seed-change-tracking.ts`): decisions (sign-off/refuse/escalate) → `inverse-patch` (undo by the opposite decision); waive/check → `none` (need a fresh decision). `auditRows()` reverses the append-only trail to newest-first.
- `sampleTrail()` builds a **genuine** trail by driving a real `GateEnforcer` over roster gates and reading `audit()` — no faked entries; deterministic under an injected clock.
- `mountAuditView()` renders the trail with per-entry undo-ability; CSS added; wired into `/control-plane` (`we:index.html` + `plateau:main.ts`) below the escalation inbox.
- Tests: `plateau:audit-view.test.ts` (6/6) pin the plain projection, the action→reversibility mapping, newest-first order, and that `sampleTrail` is real enforcer output. Full plateau-app suite green (23 files, 183 tests). Browser-verified on `:4000/control-plane`: 3 entries render, undo-ability shown.
