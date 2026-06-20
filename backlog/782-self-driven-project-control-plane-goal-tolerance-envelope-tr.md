---
kind: story
size: 3
parent: "666"
status: resolved
blockedBy: ["674"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: "plateau-app/src/control-plane/trip-planner.ts"
tags: []
---

# Self-Driven Project control plane — goal + tolerance-envelope trip planner (plateau-app)

Sibling panel of the control-plane shell (#674). Set the autonomy ceiling (L0-L4 from the #672 artefact contract) + tolerance/risk dials in plain founder language; persist to a we:process.config.json-shaped state (the recipe layer of the contract). New plateau:src/control-plane/trip-planner.ts on the mountProfiles pattern. plateau-app product layer (#091).

## Progress (resolved 2026-06-16) — locus: plateau-app
- New `plateau:src/control-plane/trip-planner.ts`: the `we:process.config.json`-shaped recipe (Layer 2 of the #672 contract) — `ProcessConfig { autonomyCeiling: L0–L4, riskTolerance: cautious|balanced|bold }`. Pure model: `defaultProcessConfig()` (conservative L2/balanced, config-extends-platform-default), `normalizeConfig()` (bad/partial input → defaults), `tripSummary()` (plain "Runs up to L2 (Supervised), balanced on risk…"). Autonomy ladder reused from the dashboard's `AUTONOMY_LADDER` (compose, don't rebuild); risk dials in founder language.
- `mountTripPlanner()` renders two radio groups (ceiling + risk) with a live summary, persisting the recipe to localStorage; CSS added; wired into `/control-plane` (`we:index.html` + `plateau:main.ts`) below the audit view.
- Tests: `plateau:trip-planner.test.ts` (6/6) pin the vocabularies, the conservative default, normalization of unknown/null input, and the plain summary. Full plateau-app suite green (24 files, 189 tests). Browser-verified on `:4000/control-plane`: 5 autonomy levels + 3 risk dials, default L2/balanced.
