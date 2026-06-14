---
type: idea
locus: exercise-app
workItem: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "demos/loan-origination (S5 document checklist — domain/documents.ts + app.ts upload; drove WE #647 data-transfer runtime block)"
tags: [exercise-app, loan-origination, documents, files, phase]
---

# Phase S5 — document checklist (rules-driven) + upload

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). A dynamic,
rules-driven document checklist (paystub/W-2 for wage earners, business returns for self-employed, etc.)
with request → uploaded → accepted/rejected states, blocking vs non-blocking gaps, and drag-and-drop /
clipboard / multi-file upload. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M2). Drives the **clipboard/DnD/files** intents (draft → WE work).

## Progress

- **Domain** [demos/loan-origination/domain/documents.ts](/demos/loan-origination/domain/documents.ts) — the rules-driven checklist: `requiredDocuments(app)` derives the list from the application shape (wage-earner → paystub/W-2; self-employed → business returns + P&L; per asset account → a statement; gift → non-blocking gift letter; purchase → purchase agreement), plus the `requested → uploaded → accepted | rejected(reason)` state machine (reject re-opens), `blockingGapsRemain` (the `processing → underwriting` guard input), `openGaps`, and `validateUpload` (the data-transfer `acceptance` dimension — client-side type/size).
- **View + upload** in [app.ts](/demos/loan-origination/app.ts) — a rules-driven checklist panel in the loan detail (status-indicator chips per state, blocking flags, accept/reject), and the upload surface: a drop-zone wired for **drag-and-drop, clipboard paste, and multi-file** `<input>`, plus per-item upload. Reject audits + notifies the borrower (reusing the shipping audit + notification blocks). CSS in app.css.
- **Standard exercised → WE gap surfaced:** the upload exercises the WE **data-transfer** intent (clipboard/DnD/files), which has **no active runtime block** — so the drop-zone hand-rolls the native `DataTransfer` handlers behind a `// PLATFORM-GAP: #647` tag. Scaffolded **[#647](/backlog/647-build-the-data-transfer-runtime-block-dnd-clipboard-multi-fi/)** — build the data-transfer runtime block — as the WE work this phase drives, and declared `data-transfer` in `conformance.json` (a tagged, consuming-draft GAP).
- Gate: `check:standards` 0 errors · `check:app-conformance` **compliant** (0 FAIL, 2 GAP — both tagged) · demo loads (200). Commit → webeverything.
