---
type: idea
locus: exercise-app
workItem: story
size: 3
status: open
parent: "317"
dateOpened: "2026-06-12"
tags: [exercise-app, loan-origination, lifecycle, phase]
---

# Phase S2 — application lifecycle state machine + guards

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). The application
moves `draft → submitted → processing → underwriting → approved-with-conditions → clear-to-close | declined`
with role-scoped, guarded transitions. Drives the **lifecycle/workflow-state** candidate standard ([#353])
— build it (or consume it once it exists) rather than hand-rolling the state machine.
