---
kind: story
size: 3
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: [exercise-app, auto-insurance, claims, fnol, files, phase]
---

> **Resolved 2026-06-12 — built; WE value = the claim lifecycle is a SECOND Web Lifecycle entity machine.**
> The `/claims` workbench stands up a **Claim** entity (seed of 240 against in-force policies) on the same
> Web Lifecycle standard as the policy — `fnol → triage → investigating → approved/denied → paid → closed`,
> a distinct `DefaultLifecycleProvider` + audit provider on the shared registry — proving the standard
> generalizes beyond one entity type. The adjuster acts via role-scoped guarded transitions (reusing the
> guard seam for a second machine), each auto-logged to the claim's audit timeline. An **FNOL form** files
> a new claim (status `fnol`) with a **native `<input type=file>`** for photos — native-first; the richer
> file-upload component (dropzone/preview/multi/progress) is the surfaced gap ([#028], file-revision intent
> is concept-stage, no block). Pure reuse of lifecycle/status-indicator/audit/master-detail/decision —
> conformance **100% (12/12)**.

# Phase S7 — FNOL & claims intake

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)). First
notice of loss: incident questionnaire (date, type, parties, photos/docs) that creates a **Claim** entity
with its own lifecycle. See the [requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/)
(M8). **Drives:** file handling; **consumes:** lifecycle (a second entity machine), status-indicator.
