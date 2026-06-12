---
type: idea
workItem: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: audit-trail
blockedBy: []
tags: [exercise-app, loan-origination, webaudit, audit-trail, block, conformance]
crossRef: { url: /backlog/357-audit-trail-standard/, label: "Audit Trail standard (#357, codified)" }
---

> **Resolved 2026-06-12 — shipped.** Two active blocks satisfy the Web Audit protocol + Audit Timeline
> intent: **`audit-trail`** (`blocks/audit/AuditProvider.ts` — `DefaultAuditProvider` [append-only,
> frozen events] / `CustomAuditRegistry` / `registerAudit` / `auditLifecycle`) and **`audit-timeline`**
> (`blocks/renderers/audit-timeline/renderAuditTimeline.ts`). 11 new unit tests (incl. the
> lifecycle→audit composition), all green. The loan app consumes them: `auditLifecycle(loanLifecycle,
> loanAudit, 'loan')` wires every transition into the log, the trace panel renders the selected loan's
> timeline, and **actionable advance buttons** (status-indicator `actionable` affordance) fire real
> `loanLifecycle.transition()` calls that auto-append to audit and re-render. `conformance.json` declares
> it → **`check:app-conformance` = 100% (8/8), 0 GAP, compliant**. Live smoke test: advancing
> Underwriting → Approved-w/-Conditions grows the timeline 1→2, zero console errors. This is the first
> live cross-standard composition (lifecycle → audit → timeline).

# Build the audit runtime block (make the loan app conformant against Web Audit)

The **Web Audit** standard is now codified — the project `webaudit`, the `audit-trail` protocol (draft,
`src/_includes/project-webaudit.njk` §`protocol-audit-trail`), and the `audit-timeline` intent ([#357]
resolved). The contract exists; **no runtime ships yet**, so the loan-origination app
([#317](/backlog/317-exercise-app-loan-origination/)) still has only an ad-hoc `AuditEvent` shape in
`domain/seed.ts`. This is the next `/exercise-app` loop turn: build the reference runtime so the app
becomes the standard's first conformant consumer.

## Scope

- An **`audit` block** — a reference `CustomAuditProvider` (append-only in-memory log) +
  `CustomAuditRegistry` (`window.customAudit`) per the protocol's seam (`append()` / `queryByEntity()` /
  optional `subscribe()`), with the normalized `AuditEvent` (before/after reusing the Web States
  `ChangeRecord` shape). Design-first: ship with a **conformance demo + unit tests** like every block.
- The **headline composition**: wire the loan app's `DefaultLifecycleProvider.subscribe(...)` (from the
  shipped `lifecycle` block) straight into `auditProvider.append(...)`, so every transition auto-logs.
- An **`audit-timeline`** reference render (the intent's `density`/`grouping`/`detail` dimensions),
  surfaced in the trace panel as the selected loan's history.
- Register both in `src/_data/blocks.json` (+ `block-descriptions/*.njk`), run `gen:inventory`.
- Move `audit-trail` from a Layer-1 gap to a declared standard in `demos/loan-origination/conformance.json`
  with an `evidence` regex.

## Done when

- `npm run check:app-conformance -- --app=demos/loan-origination` shows `audit-trail` **conformant** (was
  a Layer-1 gap after codification); score returns to 100%; no new untagged bypass.
- The block ships with its conformance demo + unit tests; `check:standards` clean.
- Composes with the `lifecycle` block ([#391]) and can feed Web Reporting ([#350]).
