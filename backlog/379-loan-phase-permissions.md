---
type: idea
locus: exercise-app
workItem: story
size: 5
status: open
parent: "317"
dateOpened: "2026-06-12"
tags: [exercise-app, loan-origination, permissions, identity, phase]
---

# Phase S1 — identity, roles & field/action/state permission model

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Borrower / loan
officer / processor / underwriter / admin roles with **field-, action-, and state-scoped** permissions
(state-scoped editing, walled-off HMDA fields, action-scoped decision authority, ownership-scoped pipeline).
See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/) (Permissions).
Drives the unbuilt **webpermissions/webidentity** projects (#009/#012) — likely a WE-surface gap.
