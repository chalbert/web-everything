---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
locus: plateau-app
tags: [personas, profiles, governance, gates, plateau, schema]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona decision (#166)" }
---

# Migrate persona gate schema: blocksDeployment boolean to four-type gateType enum

Graduated from [#166](/backlog/166-governance-persona-roster-charter-schema/) (Fork 4·A). Every persona gate carries `blocksDeployment: boolean` (~30 gates, [profiles.ts:39](../../plateau-app/src/profiles/profiles.ts#L39)) but it is purely descriptive. Replace it with `gateType: 'advisory' | 'validating' | 'blocking' | 'escalating'` (the established design-system governance vocabulary; the richer enum strictly subsumes the boolean). Schema change with NO enforcement change — gates stay documentation today, but the seam is forward-compatible so CI enforcement can land later without a breaking migration.

## Scope

- Change the `Gate` type ([profiles.ts:34](../../plateau-app/src/profiles/profiles.ts#L34)): `blocksDeployment: boolean` → `gateType: 'advisory' | 'validating' | 'blocking' | 'escalating'`.
- Migrate the ~30 existing gates: `true` → `blocking`, `false` → `advisory` as the baseline mapping; promote individual gates to `validating`/`escalating` where the charter prose already implies it (`escalation` route at [profiles.ts:104](../../plateau-app/src/profiles/profiles.ts#L104) is the Escalating signal).
- Update `/profiles` rendering to display the gate type.
- No enforcement behavior — purely a schema widening. Enforcement is the follow-on [#568](/backlog/568-enforce-blocking-persona-gates-in-ci-deploy-gate-enforcement/).

## Note

Independent of the data-home extraction ([#565](/backlog/565-extract-governance-persona-roster-to-a-shared-data-home/)) but touches the same roster file — sequence to avoid churn if both are in flight.
