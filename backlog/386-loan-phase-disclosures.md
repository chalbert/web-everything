---
type: idea
locus: exercise-app
workItem: story
size: 3
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: demos/loan-origination/domain/disclosures.ts
tags: [exercise-app, loan-origination, disclosures, e-sign, phase]
---

# Phase S9 — disclosures + e-sign + TRID clock

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). On submit, generate
an initial disclosure package (incl. a mock Loan Estimate) and a TRID-style 3-business-day clock; require
borrower e-signature (typed/drawn + timestamp + audit record) before the file advances; re-disclose on
changed circumstance. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/) (M4).

## Progress — resolved 2026-06-13

- **`we:domain/disclosures.ts`** — pure domain core: TRID business-day math (`addBusinessDays` /
  `businessDaysRemaining` skip weekends), `generateInitialDisclosures` (idempotent — Loan Estimate +
  initial-package envelope, 3-business-day clock), `tridClock` (due / remaining / overdue),
  `signDisclosure`, `initialPackageSigned` (the lifecycle gate), `addRedisclosure` (changed
  circumstance).
- **`we:app.ts`** — a "Disclosures & e-sign · TRID" surface in the master-detail trace panel: the package
  is materialized + audited on first inspect, the TRID clock renders as a Status-Indicator chip
  (caution → countdown, critical → overdue, positive → signed), each disclosure shows a signed/awaiting
  chip, and an unsigned package shows a typed borrower e-sign form. Signing stamps every disclosure +
  writes an actor-attributed `disclosure.e-signed` AuditEvent, then re-renders (clock flips to "TRID
  satisfied", gate opens).
- **Platform-first** — reuses the shipping **audit-trail** (generate + e-sign events), **lifecycle**
  (the advance gate), and **status-indicator** (every chip) standards; check:app-conformance stays
  **100% (0 FAIL, 0 GAP)**. The genuinely-new surfaces — **e-signature capture**, **business-day
  deadline clock**, **disclosure/document-package generation** — have no governing WE standard yet and
  are tagged in `we:conformance.json` `candidateStandards` (the Layer-2 /new-standard feed).
- Gates: `tsc` clean, `check:app-conformance` compliant, `check:demos` + `check:standards` green.

**Graduated to** `we:demos/loan-origination/domain/disclosures.ts` — loan demo S9: TRID clock + e-sign gate + trace-panel surface; 3 candidate standards tagged (e-signature, deadline-clock, doc-generation).
