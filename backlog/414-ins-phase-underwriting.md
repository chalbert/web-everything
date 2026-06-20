---
kind: story
size: 5
status: resolved
parent: "318"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: [exercise-app, auto-insurance, underwriting, decision-trace, master-detail, phase]
---

> **Resolved 2026-06-12 — built; WE value = first real exercise of the weblifecycle GuardResolver seam.**
> An `/underwriting` workbench: the referred queue (data-table + pagination) → master-detail → a detail
> showing the decision-trace ("why referred", `emphasis: deciding`) + audit timeline + **role-scoped
> guarded Approve/Decline actions**. Acting as the underwriter, Approve fires `referred → quoted` (gated by
> the lifecycle's `actor` match AND the `uwGuard` business rule — `uw-approve` denies a hard decline);
> the transition auto-logs to audit. Pure reuse of decision-trace / master-detail / audit / status-indicator
> + the lifecycle guard seam — no new block. The production server-authoritative authorization (Web Guards
> `CustomGuardProvider`) is surfaced as the gap [#289] (the in-app GuardResolver is the stand-in).

# Phase S3 — underwriting referral & workbench

Functional phase of exercise app B ([#318](/backlog/318-exercise-app-auto-insurance-lifecycle/)).
Eligibility/UW rules produce clean / refer / decline + reason codes; an underwriter workbench (referred
risks + rule trace + documents) to approve/condition/decline. See the
[requirements PRD](/reports/2026-06-12-exercise-app-auto-insurance-requirements/) (M4). **Consumes:**
decision-trace, master-detail, audit; **drives:** webpermissions/webidentity.
