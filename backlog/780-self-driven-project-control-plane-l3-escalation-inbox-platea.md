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
graduatedTo: "plateau-app: src/control-plane/escalation-inbox.ts"
tags: []
---

# Self-Driven Project control plane — L3 escalation inbox (plateau-app)

Sibling panel of the control-plane shell (#674). Plain-words 'X requests your decision' inbox over GateRecord.escalatedTo (src/profiles/gate-enforcement.ts:163 escalate, :32 GateRecord) + roster escalation strings (src/profiles/roster.ts); approve/refuse wired to GateEnforcer.signOff/refuse (:135/:145). New src/control-plane/escalation-inbox.ts on the mountProfiles pattern. plateau-app product layer (#091).

## Progress (resolved 2026-06-16) — locus: plateau-app
- New `src/control-plane/escalation-inbox.ts` (mirrors the #674 dashboard pattern): pure model — `escalationRequests()` flattens every `gateType: 'escalating'` gate across the roster, carrying each persona's `escalation` routing string; `decisionRequestText()` is the plain "X requests your decision: <trigger>" line; `applyDecision()` drives the **real** `GateEnforcer` — approve → `signOff` (passes), refuse → `refuse` + `escalate(authority)` (routes onward) — never re-implementing enforcement (#568 owns it).
- `mountEscalationInbox()` renders the queue with approve/refuse buttons + a localStorage decision log; styles added to `control-plane.css`; wired into the `/control-plane` route (`index.html` + `main.ts`) below the dashboard.
- Tests: `escalation-inbox.test.ts` (5/5) pin the gate selection, the request text, and that approve/refuse round-trip through the enforcer (passed / failed+escalatedTo). Full plateau-app suite green (22 files, 177 tests); my files tsc-clean (pre-existing `@frontierui/*` resolution errors unrelated). Browser-verified on `:4000/control-plane`: 4 requests render with working buttons.
