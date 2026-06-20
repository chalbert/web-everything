---
kind: story
size: 3
parent: "1026"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:process/contract.ts"
tags: []
---

# webprocess contract — self-driven artefact contract types in @webeverything

Slice A of webprocess impl epic #1026. Define the self-driven artefact contract (artefact structure + meta-schema types) in @webeverything per the resolved #672/#690 design. Type-only crosses the seam. Foundation slice — B and C build on it.

## Progress

Shipped `we:process/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/self-driven-project-artefact-contract`): the everything-as-code artefact
structure (`ArtefactRef` — discoverable + metadata-bearing) + the four composable meta-schemas. Two
NEW + owned (`AutonomyLevel` open registry w/ the L0–L5 default ladder; `ToleranceDimension` /
`ToleranceProfile` value/risk-ODD dial); two COMPOSED + referenced (`GateDefinition` → webcompliance +
webpolicy; `Step` → webworkflows). Plus `ProcessRecipe` (config-extends-platform-default). Mirrors the
first-cut shapes in `we:reports/2026-06-15-self-driven-project-artefact-contract-spec.md` (#672/#690).
Driving loop + meta-schema registries + Plateau configurator stay impl (→ FUI/plateau-app).
