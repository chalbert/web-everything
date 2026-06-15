---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/profiles/schema.ts
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

## Progress

Resolved 2026-06-14 (batch). Schema widened, no enforcement change:
- `schema.ts` — replaced `blocksDeployment: boolean` on `Gate` with `gateType: GateType`, a new `'advisory' | 'validating' | 'blocking' | 'escalating'` union (with doc-comment defining each + noting CI enforcement is the follow-on #568).
- `roster.ts` — migrated all 28 gates: baseline `true → blocking` (22), `false → advisory` (6), then 7 charter-implied promotions → final distribution **5 advisory / 3 validating / 16 blocking / 4 escalating**. Promotions: `green-ci`/`critical-rule-uncovered`/`a11y-regression` → validating (objective checks); `critical-cve`/`coordinated-go-nogo`/`risky-experiment`/`standard-exception` → escalating.
- `profiles-page.ts` — renders the gate type via a `GATE_TYPE_LABELS` map + per-type badge class; "blocking" dashboard count now = blocking + escalating.
- `profiles.css` — added `--validating` / `--escalating` badge styles.

Pure widening (the enum strictly subsumes the boolean); 61 plateau-app tests green, profiles type-clean. Enforcement is the follow-on #568.

**Graduated to** `plateau-app/src/profiles/schema.ts` — GateType enum (advisory|validating|blocking|escalating); 28 gates migrated; /profiles renders gate type.
