---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["566", "178"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/profiles/gate-enforcement.ts — GateEnforcer (per-gateType blocking semantics, sign-off/check/waiver flow, permission-checked override, audit trail, DeployVerdict) + DeployGateGuard CI seam (throwingDeployGuard)
locus: plateau-app
tags: [personas, profiles, governance, gates, ci, enforcement, plateau]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona decision (#166)" }
---

# Enforce blocking persona gates in CI/deploy (gate enforcement follow-on)

Graduated follow-on from [#166](/backlog/166-governance-persona-roster-charter-schema/) (Fork 4·B, deferred to after the enum lands). Make a `blocking` gate actually fail a pipeline: CI/deploy integration, gate-state storage, sign-off UX, and an override/waiver flow. Depends on the `gateType` enum ([#566](/backlog/566-migrate-persona-gate-schema-blocksdeployment-boolean-to-four/)) as the schema seam and overlaps the access-control/authorization gate work in [#178](/backlog/178-access-control-authorization-gate/). Deliberately deferred from the #166 ratification — the schema seam is forward-compatible so this can arrive without a breaking migration.

## Scope (sketch — refine when unblocked)

- Consume `gateType` ([#566](/backlog/566-migrate-persona-gate-schema-blocksdeployment-boolean-to-four/)): `blocking` fails the pipeline; `validating` runs the check non-fatally; `advisory` documents only; `escalating` routes for sign-off.
- Gate-state storage + the sign-off/override/waiver flow (who can waive, audit trail).
- CI/deploy integration point.

## Why blocked

`blockedBy: 566` (needs the enum seam) and `178` (access-control/authorization gate — overlapping sign-off/permission work). Not Tier-A until both land.
