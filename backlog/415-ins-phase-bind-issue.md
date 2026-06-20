---
kind: story
locus: exercise-app
size: 3
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: demos/auto-insurance/domain/binding.ts
tags: [exercise-app, auto-insurance, bind, issue, lifecycle, phase]
---

# Phase S4 — bind, issue & payment

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). On an
acceptable UW outcome + payment, the guarded transition quote → bound → issued; generate the policy doc +
ID cards (mock). See the [requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/)
(M5). **Consumes:** lifecycle, audit; **drives:** Web Guards (guarded transition), file handling.

## Progress — resolved 2026-06-13

- **`we:domain/binding.ts`** — pure core: `collectPayment` (stamps the premium payment + a mock
  confirmation ref), `paymentReceived` (the `payment-received` guard predicate), `issuePolicyDocuments`
  (idempotent — a mock declarations page + one ID card per insured vehicle, mock VIN). New
  `PremiumPayment` / `IdCard` / `IssuedDocuments` types on `Policy`.
- **`we:app.ts`** — the `payment-received` guard now reads the policy's payment record (was permissively
  `true`), so `quoted → bound` is genuinely gated. The policy-detail panel gains a state-driven
  **Bind & issue** surface: `quoted` → collect-payment-and-bind form, `bound` → issue button,
  `in-force` → the rendered declarations page + ID cards. Payment fires the guarded `quoted→bound`
  transition; issue fires `bound→in-force` and generates the documents. Both transitions auto-audit via
  `auditLifecycle`; explicit `payment.collected` + `policy.issued` AuditEvents are appended.
- **Platform-first** — consumes the active **lifecycle**, **audit-trail**, and **status-indicator**
  blocks; check:app-conformance stays **100% (0 FAIL, 0 GAP)**. The guarded-transition seam stays the
  in-app lifecycle GuardResolver (Web Guards stand-in, candidate **#289**) and the issued documents are
  app-generated artifacts (richer file-handling block uncodified, candidate **#028**) — both already in
  `we:conformance.json` candidateStandards.
- Gates: `tsc` clean, `check:app-conformance` compliant, `check:demos` + `check:standards` green.

**Graduated to** `we:demos/auto-insurance/domain/binding.ts` — insurance demo S4 — payment-received guard, mock declarations + ID cards, bind/pay/issue surface; consumes lifecycle/audit/status-indicator; drives guards #289 + file-handling #028.
