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
graduatedTo: "demos/loan-origination (S4 save-and-resume drafts + co-edit — domain/drafts.ts + app.ts; drove WE #648 durable-persistence runtime)"
tags: [exercise-app, loan-origination, persistence, drafts, phase]
---

# Phase S4 — save-and-resume drafts + co-edit conflict

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Autosave every
wizard step; resume days later to the exact field state; last-writer-wins + "X also editing" banner on
co-edit (settled decision). Drives the unbuilt **webpersistence** project (#011) — likely a WE-surface gap.

## Progress

- **Domain** [we:demos/loan-origination/domain/drafts.ts](/demos/loan-origination/domain/drafts.ts) — pure save-and-resume + co-edit: `snapshotDraft` / `applyDraft` (capture & restore the loan's working state — documents, conditions, decision), `reconcile` (last-writer-wins: ignore-self / adopt-newer / keep), and `coEditMessage` (the "X also editing" banner). Date-free; the caller stamps `savedAt`.
- **Wiring** in [we:app.ts](/demos/loan-origination/app.ts) — a per-tab `EDITOR_TOKEN`, a thin `localStorage` adapter, **autosave on every render**, **resume-once on loan open** (a saved draft overrides the freshly-derived checklist; shows a "Resumed…" note), and a cross-tab **`storage`-event** listener that reconciles a concurrent edit (adopt-if-newer → re-render with the co-edit banner). CSS in we:app.css.
- **WE gap surfaced → driven:** persistence has no shipping WE runtime — #011 ruled the durable store an unbuilt facet of `webstates` + co-edit a change-tracking strategy. The app hand-rolls `localStorage` behind `// PLATFORM-GAP: #648`, scaffolded **[#648](/backlog/648-build-the-durable-draft-persistence-runtime-save-and-resume-/)** (build the durable draft-persistence runtime) + a `candidateStandards` entry in `we:conformance.json`.
- Gate: `check:standards` 0 errors · `check:app-conformance` **compliant** (0 FAIL, 2 tagged GAP) · demo loads (200) · typecheck clean. Commit → webeverything.
