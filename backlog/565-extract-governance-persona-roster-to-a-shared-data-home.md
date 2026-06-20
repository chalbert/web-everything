---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: src/profiles/roster.ts (shared data home) + src/profiles/schema.ts; profiles.ts now a barrel
locus: plateau-app
tags: [personas, profiles, governance, plateau, dev-browser, refactor]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona decision (#166)" }
---

# Extract governance-persona roster to a shared data home

Graduated from [#166](/backlog/166-governance-persona-roster-charter-schema/) (Fork 3·A). The seven personas live as a static TypeScript array compiled into plateau-app ([plateau:profiles.ts:941](../../plateau-app/src/profiles/profiles.ts#L941)), which the dev-browser cannot import without coupling. Extract the roster into a data file (JSON/data module) both lenses read — plateau-app owned, dev-browser imports the data not the app internals — so the governance charter and the dev-browser toggle-map stay projections of one source of truth.

## Scope

- Move the `export const profiles` array out of compiled TS into a data module (JSON or a plain data `.ts` that emits data, no app imports) both products can read.
- Keep the `Profile`/`ReviewArea`/`Gate` schema unchanged (this is a *home* change, not a schema change — the schema change is [#566](/backlog/566-migrate-persona-gate-schema-blocksdeployment-boolean-to-four/)).
- plateau-app `/profiles` continues to render from the extracted data; verify no visual/behavior change.
- Establish the import path the dev-browser toggle-map lens ([#141](/backlog/141-dev-browser-vision/)) will consume — data, not the SaaS app internals.

## Foundational

Blocks the clone-to-derive mechanism ([#567](/backlog/567-clone-to-derive-custom-personas-with-local-free-share-paid-t/)) — custom personas need a data home to live in.

## Progress

Resolved 2026-06-14 (batch). Split `plateau:plateau-app/src/profiles/profiles.ts` into:
- `plateau:schema.ts` — the `Profile`/`ReviewArea`/`Gate`/`Signal`/`PlatformArea` interfaces + `PLATFORM_AREA_LABELS` (unchanged schema).
- `plateau:roster.ts` — the seven persona objects + `export const profiles`, importing only `type { Profile }` from `./schema` (no app imports) — the shared data home both lenses read.
- `plateau:profiles.ts` — now a barrel re-exporting both + `getProfile`, so every existing `./profiles` import path is unchanged.

The dev-browser toggle-map (#141) imports `plateau:roster.ts` (data) + `plateau:schema.ts` (types), not the SaaS app internals. No schema change (that is #566); no visual/behavior change — `/profiles` renders from the same data, 61 plateau-app tests green, profiles type-clean. Unblocks the clone-to-derive data home (#567).
